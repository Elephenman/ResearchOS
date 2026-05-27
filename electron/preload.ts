import { contextBridge, ipcRenderer } from 'electron';

// Allowed IPC channels — prevents renderer from invoking arbitrary handlers
const ALLOWED_CHANNELS = new Set([
  'window:minimize', 'window:maximize', 'window:close', 'window:isMaximized',
  'library:getPapers', 'library:getPaperById', 'library:addPaper', 'library:updatePaper',
  'library:deletePaper', 'library:importPapers', 'library:exportPapers', 'library:checkDuplicates',
  'collections:getCollections', 'collections:createCollection', 'collections:updateCollection', 'collections:deleteCollection',
  'tags:getTags', 'tags:createTag', 'tags:deleteTag', 'tags:addTagToPaper', 'tags:removeTagFromPaper',
  'reader:getAnnotations', 'reader:addAnnotation', 'reader:deleteAnnotation',
  'reader:getNotes', 'reader:addNote', 'reader:updateNote', 'reader:deleteNote',
  'ai:chat', 'ai:summarizePaper', 'ai:extractKeyFindings', 'ai:translateAbstract',
  'citation:formatCitation', 'citation:insertCitation',
  'graph:getCitationGraph', 'graph:getCoAuthorGraph', 'graph:getKeywordGraph',
  'downloader:downloadPaper', 'downloader:batchDownloadPapers', 'downloader:downloadFile',
  'search:searchPapers', 'search:getSearchHistory',
  'review:generateReviewOutline', 'review:generateReviewSection',
  'rag:indexPaper', 'rag:indexBatch', 'rag:searchRelevant', 'rag:status', 'rag:deletePaper',
  'zotero:findDataDir', 'zotero:import', 'zotero:selectDir',
  'settings:getSetting', 'settings:setSetting', 'settings:getAllSettings',
]);

function safeInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  if (!ALLOWED_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`IPC channel "${channel}" is not allowed`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: safeInvoke,

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Library
  getPapers: (params: object) => ipcRenderer.invoke('library:getPapers', params),
  getPaperById: (id: string) => ipcRenderer.invoke('library:getPaperById', id),
  addPaper: (paper: object) => ipcRenderer.invoke('library:addPaper', paper),
  updatePaper: (id: string, updates: object) => ipcRenderer.invoke('library:updatePaper', id, updates),
  deletePaper: (id: string) => ipcRenderer.invoke('library:deletePaper', id),
  importPapers: (files: string[]) => ipcRenderer.invoke('library:importPapers', files),
  exportPapers: (ids: string[], format: string) => ipcRenderer.invoke('library:exportPapers', ids, format),
  checkDuplicates: (paper: object) => ipcRenderer.invoke('library:checkDuplicates', paper),

  // Collections
  getCollections: () => ipcRenderer.invoke('collections:getCollections'),
  createCollection: (name: string, parentId?: string) => ipcRenderer.invoke('collections:createCollection', name, parentId),
  updateCollection: (id: string, updates: object) => ipcRenderer.invoke('collections:updateCollection', id, updates),
  deleteCollection: (id: string) => ipcRenderer.invoke('collections:deleteCollection', id),

  // Tags
  getTags: () => ipcRenderer.invoke('tags:getTags'),
  createTag: (name: string, color?: string) => ipcRenderer.invoke('tags:createTag', name, color),
  deleteTag: (id: string) => ipcRenderer.invoke('tags:deleteTag', id),
  addTagToPaper: (paperId: string, tagId: string) => ipcRenderer.invoke('tags:addTagToPaper', paperId, tagId),
  removeTagFromPaper: (paperId: string, tagId: string) => ipcRenderer.invoke('tags:removeTagFromPaper', paperId, tagId),

  // Reader
  getAnnotations: (paperId: string) => ipcRenderer.invoke('reader:getAnnotations', paperId),
  addAnnotation: (annotation: object) => ipcRenderer.invoke('reader:addAnnotation', annotation),
  deleteAnnotation: (id: string) => ipcRenderer.invoke('reader:deleteAnnotation', id),
  getNotes: (paperId: string) => ipcRenderer.invoke('reader:getNotes', paperId),
  addNote: (note: object) => ipcRenderer.invoke('reader:addNote', note),
  updateNote: (id: string, content: string) => ipcRenderer.invoke('reader:updateNote', id, content),
  deleteNote: (id: string) => ipcRenderer.invoke('reader:deleteNote', id),

  // AI
  chat: (messages: object[], options: object) => ipcRenderer.invoke('ai:chat', messages, options),
  summarizePaper: (paperId: string) => ipcRenderer.invoke('ai:summarizePaper', paperId),
  extractKeyFindings: (paperId: string) => ipcRenderer.invoke('ai:extractKeyFindings', paperId),
  translateAbstract: (paperId: string, targetLang: string) => ipcRenderer.invoke('ai:translateAbstract', paperId, targetLang),

  // Citation
  formatCitation: (paperId: string, style: string) => ipcRenderer.invoke('citation:formatCitation', paperId, style),
  insertCitation: (paperId: string, style: string) => ipcRenderer.invoke('citation:insertCitation', paperId, style),

  // Graph
  getCitationGraph: (paperId: string, depth: number) => ipcRenderer.invoke('graph:getCitationGraph', paperId, depth),
  getCoAuthorGraph: (authorId: string) => ipcRenderer.invoke('graph:getCoAuthorGraph', authorId),
  getKeywordGraph: (paperId: string) => ipcRenderer.invoke('graph:getKeywordGraph', paperId),

  // Downloader
  downloadPaper: (doi: string) => ipcRenderer.invoke('downloader:downloadPaper', doi),
  batchDownloadPapers: (dois: string[]) => ipcRenderer.invoke('downloader:batchDownloadPapers', dois),
  downloadFile: (url: string, fileName: string) => ipcRenderer.invoke('downloader:downloadFile', url, fileName),

  // Search
  searchPapers: (options: object) => ipcRenderer.invoke('search:searchPapers', options),
  getSearchHistory: () => ipcRenderer.invoke('search:getSearchHistory'),

  // Review
  generateReviewOutline: (paperIds: string[], topic: string) => ipcRenderer.invoke('review:generateReviewOutline', paperIds, topic),
  generateReviewSection: (sectionId: string) => ipcRenderer.invoke('review:generateReviewSection', sectionId),

  // RAG
  indexPaper: (paperId: string, filePath: string, meta?: object) => ipcRenderer.invoke('rag:indexPaper', paperId, filePath, meta),
  indexBatch: (documents: object[]) => ipcRenderer.invoke('rag:indexBatch', documents),
  searchRelevant: (query: string, topK?: number, filterPaperIds?: string[]) => ipcRenderer.invoke('rag:searchRelevant', query, topK, filterPaperIds),
  ragStatus: () => ipcRenderer.invoke('rag:status'),
  ragDeletePaper: (paperId: string) => ipcRenderer.invoke('rag:deletePaper', paperId),

  // Zotero
  zoteroFindDataDir: () => ipcRenderer.invoke('zotero:findDataDir'),
  zoteroImport: (dataDir: string) => ipcRenderer.invoke('zotero:import', dataDir),
  zoteroSelectDir: () => ipcRenderer.invoke('zotero:selectDir'),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:getSetting', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:setSetting', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAllSettings'),

  // Menu events
  onMenuImportPdf: (callback: () => void) => ipcRenderer.on('menu:import-pdf', callback),
  onMenuExportPapers: (callback: () => void) => ipcRenderer.on('menu:export-papers', callback),
  onMenuAbout: (callback: () => void) => ipcRenderer.on('menu:about', callback),
});
