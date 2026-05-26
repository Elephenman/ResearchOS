import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { DatabaseService } from '../services/database';
import { searchPapers, downloadOpenAccessPDF, createSearchHistoryEntry } from '../services/search';
import { chat as aiChat, summarizePaper, extractKeyFindings, translateAbstract } from '../services/ai';
import { findZoteroDataDir, importFromZotero } from '../services/zotero-import';
import fs from 'fs';
import path from 'path';
import https from 'https';

export function registerWindowIPC(mainWindow: BrowserWindow | null): void {
  ipcMain.handle('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    BrowserWindow.getFocusedWindow()?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
  });
}

export function registerLibraryIPC(db: DatabaseService): void {
  ipcMain.handle('library:getPapers', async (_event, params: {
    page: number; pageSize: number; keyword?: string; status?: string;
    collectionId?: string; tagId?: string;
  }) => {
    const offset = (params.page - 1) * params.pageSize;
    let whereClause = '1=1';
    const sqlParams: unknown[] = [];

    if (params.keyword) {
      whereClause += ' AND (p.title LIKE ? OR p.doi LIKE ? OR p.abstract LIKE ?)';
      const kw = `%${params.keyword}%`;
      sqlParams.push(kw, kw, kw);
    }
    if (params.status) {
      whereClause += ' AND p.status = ?';
      sqlParams.push(params.status);
    }
    if (params.collectionId) {
      whereClause += ' AND p.id IN (SELECT paper_id FROM paper_collections WHERE collection_id = ?)';
      sqlParams.push(params.collectionId);
    }
    if (params.tagId) {
      whereClause += ' AND p.id IN (SELECT paper_id FROM paper_tags WHERE tag_id = ?)';
      sqlParams.push(params.tagId);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM papers p WHERE ${whereClause}`).get(...sqlParams) as { total: number };

    const rows = db.prepare(
      `SELECT p.*, GROUP_CONCAT(DISTINCT k.keyword) as keywords
       FROM papers p
       LEFT JOIN keywords k ON k.paper_id = p.id
       WHERE ${whereClause}
       GROUP BY p.id
       ORDER BY p.date_added DESC LIMIT ? OFFSET ?`
    ).all(...sqlParams, params.pageSize, offset) as Record<string, unknown>[];

    // Enrich each paper with authors, tags, collections
    const data = rows.map(row => {
      const paperId = row.id as string;
      const authors = db.prepare('SELECT * FROM authors WHERE paper_id = ? ORDER BY author_order').all(paperId);
      const tags = db.prepare('SELECT t.* FROM tags t JOIN paper_tags pt ON t.id = pt.tag_id WHERE pt.paper_id = ?').all(paperId);
      const collections = db.prepare('SELECT c.* FROM collections c JOIN paper_collections pc ON c.id = pc.collection_id WHERE pc.paper_id = ?').all(paperId);
      return {
        ...row,
        authors,
        tags,
        collections,
        dateAdded: row.date_added,
        dateModified: row.date_modified,
        filePath: row.file_path,
        coverUrl: row.cover_url,
      };
    });

    return { data, total: countRow.total };
  });

  ipcMain.handle('library:getPaperById', async (_event, id: string) => {
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (paper) {
      const authors = db.prepare('SELECT * FROM authors WHERE paper_id = ? ORDER BY author_order').all(id);
      const tags = db.prepare('SELECT t.* FROM tags t JOIN paper_tags pt ON t.id = pt.tag_id WHERE pt.paper_id = ?').all(id);
      const collections = db.prepare('SELECT c.* FROM collections c JOIN paper_collections pc ON c.id = pc.collection_id WHERE pc.paper_id = ?').all(id);
      return {
        ...paper,
        authors,
        tags,
        collections,
        dateAdded: paper.date_added,
        dateModified: paper.date_modified,
        filePath: paper.file_path,
        coverUrl: paper.cover_url,
      };
    }
    return null;
  });

  ipcMain.handle('library:addPaper', async (_event, paper: Record<string, unknown>) => {
    const id = db.generateId();
    db.prepare(`INSERT INTO papers (id, title, year, journal, doi, pmid, abstract, file_path, status, rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, paper.title, paper.year ?? null, paper.journal ?? null,
      paper.doi ?? null, paper.pmid ?? null, paper.abstract ?? null,
      paper.filePath ?? null, paper.status ?? 'unread', paper.rating ?? 0
    );

    // Insert authors if provided
    if (Array.isArray(paper.authors)) {
      for (let i = 0; i < paper.authors.length; i++) {
        const author = paper.authors[i] as Record<string, unknown>;
        const authorId = db.generateId();
        db.prepare('INSERT INTO authors (id, paper_id, name, author_order, affiliation) VALUES (?, ?, ?, ?, ?)').run(
          authorId, id, author.name, i, (author.affiliation as string) ?? null
        );
      }
    }

    const result = db.prepare('SELECT * FROM papers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    const authors = db.prepare('SELECT * FROM authors WHERE paper_id = ? ORDER BY author_order').all(id);
    return { ...(result || {}), authors, tags: [], collections: [] };
  });

  ipcMain.handle('library:updatePaper', async (_event, id: string, updates: Record<string, unknown>) => {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (['title', 'year', 'journal', 'doi', 'pmid', 'abstract', 'filePath', 'status', 'rating', 'notes'].includes(key)) {
        fields.push(`${key === 'filePath' ? 'file_path' : key} = ?`);
        values.push(value);
      }
    }
    if (fields.length > 0) {
      fields.push("date_modified = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE papers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
  });

  ipcMain.handle('library:deletePaper', async (_event, id: string) => {
    db.prepare('DELETE FROM authors WHERE paper_id = ?').run(id);
    db.prepare('DELETE FROM paper_tags WHERE paper_id = ?').run(id);
    db.prepare('DELETE FROM paper_collections WHERE paper_id = ?').run(id);
    db.prepare('DELETE FROM annotations WHERE paper_id = ?').run(id);
    db.prepare('DELETE FROM notes WHERE paper_id = ?').run(id);
    db.prepare('DELETE FROM keywords WHERE paper_id = ?').run(id);
    db.prepare('DELETE FROM papers WHERE id = ?').run(id);
  });

  ipcMain.handle('library:importPapers', async (_event, _files: string[]) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return 0;

    const result = await dialog.showOpenDialog(win, {
      title: '导入文献',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '文献文件', extensions: ['pdf', 'bib', 'ris', 'xml'] },
        { name: 'PDF 文件', extensions: ['pdf'] },
        { name: 'BibTeX 文件', extensions: ['bib'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return 0;

    let importedCount = 0;
    for (const filePath of result.filePaths) {
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.pdf') {
        // Import PDF - extract filename as title
        const fileName = path.basename(filePath, '.pdf');
        const id = db.generateId();

        // Check duplicate by file path
        const existing = db.prepare('SELECT id FROM papers WHERE file_path = ?').get(filePath);
        if (existing) continue;

        db.prepare(`INSERT INTO papers (id, title, file_path, status, rating)
          VALUES (?, ?, ?, 'unread', 0)`).run(id, fileName, filePath);
        importedCount++;
      } else if (ext === '.bib') {
        // BibTeX import - basic parser
        const content = fs.readFileSync(filePath, 'utf-8');
        const entries = parseBibTeX(content);
        for (const entry of entries) {
          const id = db.generateId();
          // Check duplicate by DOI
          if (entry.doi) {
            const existing = db.prepare('SELECT id FROM papers WHERE doi = ?').get(entry.doi);
            if (existing) continue;
          }
          db.prepare(`INSERT INTO papers (id, title, year, journal, doi, abstract, status, rating)
            VALUES (?, ?, ?, ?, ?, ?, 'unread', 0)`).run(
            id, entry.title ?? 'Untitled', entry.year ?? null,
            entry.journal ?? null, entry.doi ?? null, entry.abstract ?? null
          );
          // Add authors
          if (entry.authors) {
            const authorList = entry.authors as string[];
            for (let i = 0; i < authorList.length; i++) {
              const authorId = db.generateId();
              db.prepare('INSERT INTO authors (id, paper_id, name, author_order) VALUES (?, ?, ?, ?)').run(
                authorId, id, authorList[i], i
              );
            }
          }
          importedCount++;
        }
      }
    }
    return importedCount;
  });

  ipcMain.handle('library:exportPapers', async (_event, ids: string[], format: string) => {
    const papers = ids.map(id => db.prepare('SELECT * FROM papers WHERE id = ?').get(id)).filter(Boolean);

    if (format === 'bib') {
      return papers.map((p: any) => {
        const authors = db.prepare('SELECT * FROM authors WHERE paper_id = ? ORDER BY author_order').all(p.id);
        const authorStr = authors.map((a: any) => a.name).join(' and ');
        return `@article{${p.id},\n  title = {${p.title}},\n  author = {${authorStr}},\n  year = {${p.year}},\n  journal = {${p.journal}},\n  doi = {${p.doi}}\n}`;
      }).join('\n\n');
    }
    return JSON.stringify(papers, null, 2);
  });

  ipcMain.handle('library:checkDuplicates', async (_event, paper: Record<string, unknown>) => {
    if (paper.doi) {
      return db.prepare('SELECT * FROM papers WHERE doi = ?').all(paper.doi);
    }
    if (paper.title) {
      return db.prepare('SELECT * FROM papers WHERE title = ?').all(paper.title);
    }
    return [];
  });
}

/**
 * Basic BibTeX parser - handles @article, @inproceedings, @book, etc.
 */
function parseBibTeX(content: string): Array<Record<string, unknown>> {
  const entries: Array<Record<string, unknown>> = [];
  const entryRegex = /@(\w+)\{([^,]+),\s*([\s\S]*?)\n\}/g;
  let match;

  while ((match = entryRegex.exec(content)) !== null) {
    const fields: Record<string, unknown> = {};
    const fieldContent = match[3];

    // Parse fields
    const fieldRegex = /(\w+)\s*=\s*\{([^}]*)\}/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(fieldContent)) !== null) {
      const key = fieldMatch[1].toLowerCase();
      const value = fieldMatch[2].trim();
      if (key === 'author') {
        fields.authors = value.split(' and ').map(a => a.trim());
      } else {
        fields[key] = value;
      }
    }

    // Try to parse year as number
    if (fields.year) {
      const yearNum = parseInt(fields.year as string, 10);
      if (!isNaN(yearNum)) fields.year = yearNum;
    }

    entries.push(fields);
  }

  return entries;
}

export function registerCollectionsIPC(db: DatabaseService): void {
  ipcMain.handle('collections:getCollections', async () => {
    return db.prepare('SELECT c.*, (SELECT COUNT(*) FROM paper_collections WHERE collection_id = c.id) as count FROM collections c ORDER BY name').all();
  });

  ipcMain.handle('collections:createCollection', async (_event, name: string, parentId?: string) => {
    const id = db.generateId();
    db.prepare('INSERT INTO collections (id, name, parent_id) VALUES (?, ?, ?)').run(id, name, parentId ?? null);
    return db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  });

  ipcMain.handle('collections:updateCollection', async (_event, id: string, updates: Record<string, unknown>) => {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.name) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.color) { fields.push('color = ?'); values.push(updates.color); }
    if (updates.parentId !== undefined) { fields.push('parent_id = ?'); values.push(updates.parentId); }
    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE collections SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
  });

  ipcMain.handle('collections:deleteCollection', async (_event, id: string) => {
    db.prepare('DELETE FROM paper_collections WHERE collection_id = ?').run(id);
    db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  });
}

export function registerTagsIPC(db: DatabaseService): void {
  ipcMain.handle('tags:getTags', async () => {
    return db.prepare('SELECT t.*, (SELECT COUNT(*) FROM paper_tags WHERE tag_id = t.id) as usage_count FROM tags t ORDER BY name').all();
  });

  ipcMain.handle('tags:createTag', async (_event, name: string, color?: string) => {
    const id = db.generateId();
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, name, color ?? null);
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  });

  ipcMain.handle('tags:deleteTag', async (_event, id: string) => {
    db.prepare('DELETE FROM paper_tags WHERE tag_id = ?').run(id);
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  });

  ipcMain.handle('tags:addTagToPaper', async (_event, paperId: string, tagId: string) => {
    db.prepare('INSERT OR IGNORE INTO paper_tags (paper_id, tag_id) VALUES (?, ?)').run(paperId, tagId);
  });

  ipcMain.handle('tags:removeTagFromPaper', async (_event, paperId: string, tagId: string) => {
    db.prepare('DELETE FROM paper_tags WHERE paper_id = ? AND tag_id = ?').run(paperId, tagId);
  });
}

export function registerReaderIPC(db: DatabaseService): void {
  ipcMain.handle('reader:getAnnotations', async (_event, paperId: string) => {
    return db.prepare('SELECT * FROM annotations WHERE paper_id = ? ORDER BY page_number, created_at').all(paperId);
  });

  ipcMain.handle('reader:addAnnotation', async (_event, annotation: Record<string, unknown>) => {
    const id = db.generateId();
    db.prepare(`INSERT INTO annotations (id, paper_id, page_number, content, type, color, position)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id, annotation.paperId, annotation.pageNumber, annotation.content ?? null,
      annotation.type ?? 'highlight', annotation.color ?? '#ffe066',
      annotation.position ? JSON.stringify(annotation.position) : null
    );
    return db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
  });

  ipcMain.handle('reader:deleteAnnotation', async (_event, id: string) => {
    db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
  });

  ipcMain.handle('reader:getNotes', async (_event, paperId: string) => {
    return db.prepare('SELECT * FROM notes WHERE paper_id = ? ORDER BY created_at').all(paperId);
  });

  ipcMain.handle('reader:addNote', async (_event, note: Record<string, unknown>) => {
    const id = db.generateId();
    db.prepare('INSERT INTO notes (id, paper_id, content) VALUES (?, ?, ?)').run(id, note.paperId, note.content ?? '');
    return db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  });

  ipcMain.handle('reader:updateNote', async (_event, id: string, content: string) => {
    db.prepare("UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, id);
  });

  ipcMain.handle('reader:deleteNote', async (_event, id: string) => {
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  });
}

export function registerSettingsIPC(db: DatabaseService): void {
  ipcMain.handle('settings:getSetting', async (_event, key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  });

  ipcMain.handle('settings:setSetting', async (_event, key: string, value: string) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  });

  ipcMain.handle('settings:getAllSettings', async () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  });
}

// Stubs for modules not yet implemented
export function registerAIIPC(db: DatabaseService): void {
  // Get all settings for AI provider config
  const getSettings = (): Record<string, string> => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  };

  ipcMain.handle('ai:chat', async (_event, messages: Array<{ role: string; content: string }>, options: { provider: string; model: string; temperature?: number }) => {
    try {
      const settings = getSettings();
      return await aiChat(messages as any, options, settings);
    } catch (err: any) {
      return `AI 对话失败: ${err.message || '未知错误'}`;
    }
  });

  ipcMain.handle('ai:summarizePaper', async (_event, paperId: string) => {
    try {
      const settings = getSettings();
      return await summarizePaper(paperId, db, settings);
    } catch (err: any) {
      return `摘要生成失败: ${err.message || '未知错误'}`;
    }
  });

  ipcMain.handle('ai:extractKeyFindings', async (_event, paperId: string) => {
    try {
      const settings = getSettings();
      return await extractKeyFindings(paperId, db, settings);
    } catch {
      return [];
    }
  });

  ipcMain.handle('ai:translateAbstract', async (_event, paperId: string, targetLang: string) => {
    try {
      const settings = getSettings();
      return await translateAbstract(paperId, targetLang, db, settings);
    } catch (err: any) {
      return `翻译失败: ${err.message || '未知错误'}`;
    }
  });
}

export function registerCitationIPC(_db: DatabaseService): void {
  ipcMain.handle('citation:formatCitation', async () => '');
  ipcMain.handle('citation:insertCitation', async () => '');
}

export function registerGraphIPC(_db: DatabaseService): void {
  ipcMain.handle('graph:getCitationGraph', async () => ({ nodes: [], edges: [] }));
  ipcMain.handle('graph:getCoAuthorGraph', async () => ({ nodes: [], edges: [] }));
  ipcMain.handle('graph:getKeywordGraph', async () => ({ nodes: [], edges: [] }));
}

export function registerSearchIPC(db: DatabaseService): void {
  ipcMain.handle('search:searchPapers', async (_event, options: {
    keyword: string; sources: string[]; yearFrom?: number; yearTo?: number;
    page?: number; pageSize?: number;
  }) => {
    const results = await searchPapers(options);
    createSearchHistoryEntry(db, options.keyword, options.sources, results.length);
    return results;
  });

  ipcMain.handle('search:getSearchHistory', async () => {
    return db.prepare('SELECT * FROM search_history ORDER BY searched_at DESC LIMIT 20').all();
  });
}

export function registerDownloaderIPC(db: DatabaseService): void {
  ipcMain.handle('downloader:downloadPaper', async (_event, doi: string) => {
    if (!doi) return '';
    const email = 'researchos@example.com';
    const pdfUrl = await downloadOpenAccessPDF(doi, email);
    return pdfUrl || '';
  });

  ipcMain.handle('downloader:batchDownloadPapers', async (_event, dois: string[]) => {
    let success = 0;
    let failed = 0;
    for (const doi of dois) {
      try {
        const pdfUrl = await downloadOpenAccessPDF(doi, 'researchos@example.com');
        if (pdfUrl) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    return { success, failed };
  });

  ipcMain.handle('downloader:downloadFile', async (_event, url: string, fileName: string) => {
    const win = BrowserWindow.getFocusedWindow();
    const downloadsDir = path.join(app.getPath('home'), 'Downloads', 'ResearchOS');
    if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

    const filePath = path.join(downloadsDir, fileName);
    return new Promise<string>((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            https.get(redirectUrl, (redirectResponse) => {
              redirectResponse.pipe(file);
              file.on('finish', () => { file.close(); resolve(filePath); });
            }).on('error', () => { fs.unlinkSync(filePath); reject(new Error('Download failed')); });
          }
        } else {
          response.pipe(file);
          file.on('finish', () => { file.close(); resolve(filePath); });
        }
      }).on('error', () => { fs.unlinkSync(filePath); reject(new Error('Download failed')); });
    });
  });
}

export function registerReviewIPC(_db: DatabaseService): void {
  ipcMain.handle('review:generateReviewOutline', async () => null);
  ipcMain.handle('review:generateReviewSection', async () => '');
}

export function registerRAGIPC(_db: DatabaseService): void {
  const { sidecarFetch, isSidecarReady } = require('../services/sidecar') as typeof import('../services/sidecar');

  // Ingest a paper's PDF into the RAG index
  ipcMain.handle('rag:indexPaper', async (_event, paperId: string, filePath: string, meta?: Record<string, unknown>) => {
    if (!isSidecarReady()) {
      return { status: 'error', message: 'RAG engine not available. Start the Python sidecar first.' };
    }
    try {
      return await sidecarFetch('POST', '/api/v1/ingest', {
        paper_id: paperId,
        file_path: filePath,
        title: meta?.title || '',
        authors: meta?.authors || '',
        year: meta?.year || null,
      });
    } catch (err: unknown) {
      return { status: 'error', message: (err as Error).message };
    }
  });

  // Batch index multiple papers
  ipcMain.handle('rag:indexBatch', async (_event, documents: Array<Record<string, unknown>>) => {
    if (!isSidecarReady()) {
      return { status: 'error', message: 'RAG engine not available' };
    }
    try {
      return await sidecarFetch('POST', '/api/v1/ingest/batch', { documents });
    } catch (err: unknown) {
      return { status: 'error', message: (err as Error).message };
    }
  });

  // Semantic search across indexed papers
  ipcMain.handle('rag:searchRelevant', async (_event, query: string, topK?: number, filterPaperIds?: string[]) => {
    if (!isSidecarReady()) {
      return [];
    }
    try {
      const result = await sidecarFetch('POST', '/api/v1/query', {
        query,
        top_k: topK || 8,
        filter_paper_ids: filterPaperIds || null,
        use_rerank: true,
      }) as Record<string, unknown>;
      return result.results || [];
    } catch (err: unknown) {
      console.error('[RAG] Search failed:', (err as Error).message);
      return [];
    }
  });

  // Get RAG engine status
  ipcMain.handle('rag:status', async () => {
    if (!isSidecarReady()) {
      return { status: 'offline', message: 'Python sidecar not running' };
    }
    try {
      return await sidecarFetch('GET', '/api/v1/status');
    } catch {
      return { status: 'error', message: 'Failed to reach sidecar' };
    }
  });

  // Delete a paper from the RAG index
  ipcMain.handle('rag:deletePaper', async (_event, paperId: string) => {
    if (!isSidecarReady()) {
      return { status: 'error', message: 'RAG engine not available' };
    }
    try {
      return await sidecarFetch('DELETE', `/api/v1/paper/${paperId}`);
    } catch (err: unknown) {
      return { status: 'error', message: (err as Error).message };
    }
  });
}

export function registerZoteroIPC(db: DatabaseService): void {
  // Find Zotero data directory
  ipcMain.handle('zotero:findDataDir', async () => {
    return findZoteroDataDir();
  });

  // Import from Zotero
  ipcMain.handle('zotero:import', async (_event, dataDir: string) => {
    try {
      const result = importFromZotero(dataDir, db);
      return result;
    } catch (err: unknown) {
      return { imported: 0, skipped: 0, errors: [(err as Error).message] };
    }
  });

  // Select Zotero directory via dialog
  ipcMain.handle('zotero:selectDir', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Zotero Data Directory',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

export function registerAllIPC(db: DatabaseService, mainWindow: BrowserWindow | null): void {
  registerWindowIPC(mainWindow);
  registerLibraryIPC(db);
  registerCollectionsIPC(db);
  registerTagsIPC(db);
  registerReaderIPC(db);
  registerSettingsIPC(db);
  registerAIIPC(db);
  registerCitationIPC(db);
  registerGraphIPC(db);
  registerSearchIPC(db);
  registerDownloaderIPC(db);
  registerReviewIPC(db);
  registerRAGIPC(db);
  registerZoteroIPC(db);
}
