/**
 * ResearchOS - Zotero Import Service
 *
 * Reads the Zotero SQLite database (zotero.sqlite) to import:
 * - Bibliographic items (papers) with metadata
 * - Collections (folders) and their hierarchy
 * - Tags
 * - Attachment paths (linked/stored PDFs)
 *
 * Zotero database schema reference:
 * - items: core item table
 * - itemData: field values for items
 * - collections: collection tree
 * - collectionItems: collection-item membership
 * - itemTags: tags attached to items
 * - itemAttachments: file attachments
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DatabaseService } from './database';

interface ZoteroItem {
  itemId: number;
  itemType: string;
  title: string;
  creators: string[];
  date: string;
  journal: string;
  doi: string;
  abstract: string;
  tags: string[];
  collections: string[];
  attachmentPath: string;
}

/**
 * Find Zotero data directory on the current system.
 */
export function findZoteroDataDir(): string | null {
  const platform = process.platform;

  const candidates: string[] = [];
  const home = process.env.USERPROFILE || process.env.HOME || '';

  if (platform === 'win32') {
    // Windows: %APPDATA%\Zotero\Zotero\Profiles\*.default\zotero.sqlite
    // But the actual data dir is usually at %HOMEPATH%\Zotero
    candidates.push(
      path.join(home, 'Zotero'),
      path.join(process.env.APPDATA || '', 'Zotero', 'Zotero'),
    );
  } else if (platform === 'darwin') {
    candidates.push(path.join(home, 'Zotero'));
  } else {
    candidates.push(path.join(home, 'Zotero'));
  }

  for (const dir of candidates) {
    const dbPath = path.join(dir, 'zotero.sqlite');
    if (fs.existsSync(dbPath)) {
      return dir;
    }
  }

  return null;
}

/**
 * Import data from a Zotero database into ResearchOS.
 */
export function importFromZotero(
  zoteroDataDir: string,
  rosDb: DatabaseService,
  onProgress?: (msg: string, count: number) => void,
): { imported: number; skipped: number; errors: string[] } {
  const dbPath = path.join(zoteroDataDir, 'zotero.sqlite');
  if (!fs.existsSync(dbPath)) {
    return { imported: 0, skipped: 0, errors: [`zotero.sqlite not found at ${dbPath}`] };
  }

  // Open Zotero DB in read-only mode
  const zoteroDb = new Database(dbPath, { readonly: true });
  zoteroDb.pragma('journal_mode = WAL');

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  try {
    // 1. Get all journal article items
    const items = getZoteroItems(zoteroDb);
    onProgress?.(`Found ${items.length} items in Zotero`, 0);

    // 2. Import collections first
    const collectionMap = importCollections(zoteroDb, rosDb);
    onProgress?.(`Imported ${Object.keys(collectionMap).length} collections`, 0);

    // 3. Import each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        // Skip non-journal-article types
        if (item.itemType !== 'journalArticle' && item.itemType !== 'conferencePaper' && item.itemType !== 'bookSection') {
          skipped++;
          continue;
        }

        // Check for duplicates by DOI or title
        if (item.doi) {
          const existing = rosDb.prepare('SELECT id FROM papers WHERE doi = ?').get(item.doi);
          if (existing) {
            skipped++;
            continue;
          }
        }

        // Insert paper
        const paperId = rosDb.generateId();
        const year = parseYear(item.date);

        rosDb.prepare(`
          INSERT INTO papers (id, title, year, journal, doi, abstract, status, rating, date_added, date_modified)
          VALUES (?, ?, ?, ?, ?, ?, 'unread', 0, datetime('now'), datetime('now'))
        `).run(paperId, item.title || 'Untitled', year, item.journal, item.doi, item.abstract);

        // Insert authors
        for (let j = 0; j < item.creators.length; j++) {
          const authorId = rosDb.generateId();
          rosDb.prepare(
            'INSERT INTO authors (id, paper_id, name, author_order) VALUES (?, ?, ?, ?)'
          ).run(authorId, paperId, item.creators[j], j);
        }

        // Insert tags
        for (const tagName of item.tags) {
          // Find or create tag
          let tag = rosDb.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: string } | undefined;
          if (!tag) {
            const tagId = rosDb.generateId();
            rosDb.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(tagId, tagName, '');
            tag = { id: tagId };
          }
          rosDb.prepare('INSERT OR IGNORE INTO paper_tags (paper_id, tag_id) VALUES (?, ?)').run(paperId, tag.id);
        }

        // Add to collections
        for (const collectionName of item.collections) {
          const collId = collectionMap[collectionName];
          if (collId) {
            rosDb.prepare('INSERT OR IGNORE INTO paper_collections (paper_id, collection_id) VALUES (?, ?)').run(paperId, collId);
          }
        }

        imported++;
        onProgress?.(`Imported ${imported}/${items.length}`, i);
      } catch (err) {
        errors.push(`Item "${item.title}": ${(err as Error).message}`);
      }
    }
  } finally {
    zoteroDb.close();
  }

  return { imported, skipped, errors };
}

/**
 * Query Zotero items with their metadata.
 */
function getZoteroItems(zoteroDb: Database.Database): ZoteroItem[] {
  // Get item types
  const itemTypeIDs: Record<string, number> = {};
  const typeRows = zoteroDb.prepare('SELECT itemTypeID, typeName FROM itemTypes').all() as Array<{ itemTypeID: number; typeName: string }>;
  for (const row of typeRows) {
    itemTypeIDs[row.typeName] = row.itemTypeID;
  }

  // Get field name IDs
  const fieldIDs: Record<string, number> = {};
  const fieldRows = zoteroDb.prepare('SELECT fieldID, fieldName FROM fields').all() as Array<{ fieldID: number; fieldName: string }>;
  for (const row of fieldRows) {
    fieldIDs[row.fieldName] = row.fieldID;
  }

  // Get all top-level items (not attachments/notes)
  const targetTypes = ['journalArticle', 'conferencePaper', 'bookSection', 'thesis'];
  const itemTypeConditions = targetTypes
    .map(t => itemTypeIDs[t])
    .filter(Boolean)
    .map(id => `i.itemTypeID = ${id}`)
    .join(' OR ');

  if (!itemTypeConditions) return [];

  const items = zoteroDb.prepare(`
    SELECT i.itemID, it.typeName
    FROM items i
    JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
    WHERE (${itemTypeConditions})
      AND i.itemID NOT IN (SELECT itemID FROM deletedItems)
    ORDER BY i.dateAdded DESC
  `).all() as Array<{ itemID: number; typeName: string }>;

  // For each item, get its field values
  const result: ZoteroItem[] = [];
  for (const item of items) {
    const fields = zoteroDb.prepare(`
      SELECT f.fieldName, idv.value
      FROM itemData id
      JOIN itemDataValues idv ON id.valueID = idv.valueID
      JOIN fields f ON id.fieldID = f.fieldID
      WHERE id.itemID = ?
    `).all(item.itemID) as Array<{ fieldName: string; value: string }>;

    const fieldMap: Record<string, string> = {};
    for (const f of fields) {
      fieldMap[f.fieldName] = f.value;
    }

    // Get creators (authors)
    const creators = zoteroDb.prepare(`
      SELECT c.firstName, c.lastName
      FROM itemCreators ic
      JOIN creators c ON ic.creatorID = c.creatorID
      WHERE ic.itemID = ?
      ORDER BY ic.orderIndex
    `).all(item.itemID) as Array<{ firstName: string; lastName: string }>;

    const authorNames = creators.map(c =>
      [c.firstName, c.lastName].filter(Boolean).join(' ')
    );

    // Get tags
    const tags = zoteroDb.prepare(`
      SELECT t.name
      FROM itemTags it
      JOIN tags t ON it.tagID = t.tagID
      WHERE it.itemID = ?
    `).all(item.itemID) as Array<{ name: string }>;

    // Get collections
    const collections = zoteroDb.prepare(`
      SELECT c.collectionName
      FROM collectionItems ci
      JOIN collections c ON ci.collectionID = c.collectionID
      WHERE ci.itemID = ?
    `).all(item.itemID) as Array<{ collectionName: string }>;

    // Get attachment path
    const attachment = zoteroDb.prepare(`
      SELECT ia.path
      FROM itemAttachments ia
      WHERE ia.parentItemID = ?
      AND ia.contentType = 'application/pdf'
      LIMIT 1
    `).get(item.itemID) as { path: string } | undefined;

    result.push({
      itemId: item.itemID,
      itemType: item.typeName,
      title: fieldMap['title'] || '',
      creators: authorNames,
      date: fieldMap['date'] || '',
      journal: fieldMap['publicationTitle'] || fieldMap['journalAbbreviation'] || '',
      doi: fieldMap['DOI'] || '',
      abstract: fieldMap['abstractNote'] || '',
      tags: tags.map(t => t.name),
      collections: collections.map(c => c.collectionName),
      attachmentPath: attachment?.path || '',
    });
  }

  return result;
}

/**
 * Import Zotero collections into ResearchOS.
 * Returns a map of collectionName -> collectionId.
 */
function importCollections(zoteroDb: Database.Database, rosDb: DatabaseService): Record<string, string> {
  const cols = zoteroDb.prepare(`
    SELECT collectionID, collectionName, parentCollectionID
    FROM collections
    ORDER BY parentCollectionID NULLS FIRST, collectionName
  `).all() as Array<{ collectionID: number; collectionName: string; parentCollectionID: number | null }>;

  const collectionMap: Record<string, string> = {};
  const zoteroIdToRosId: Record<number, string> = {};

  for (const col of cols) {
    const rosId = rosDb.generateId();
    const parentId = col.parentCollectionID ? zoteroIdToRosId[col.parentCollectionID] : null;

    rosDb.prepare(`
      INSERT OR IGNORE INTO collections (id, name, parent_id, color)
      VALUES (?, ?, ?, '')
    `).run(rosId, col.collectionName, parentId);

    collectionMap[col.collectionName] = rosId;
    zoteroIdToRosId[col.collectionID] = rosId;
  }

  return collectionMap;
}

/**
 * Parse a year from a date string like "2024", "2024-03", "March 2024".
 */
function parseYear(dateStr: string): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}
