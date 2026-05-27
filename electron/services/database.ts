import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async initialize(): Promise<void> {
    this.db.exec('BEGIN TRANSACTION');
    try {
      this.createTables();
      this.createIndexes();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS papers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        year INTEGER,
        journal TEXT,
        doi TEXT UNIQUE,
        pmid TEXT,
        abstract TEXT,
        file_path TEXT,
        cover_url TEXT,
        status TEXT DEFAULT 'unread' CHECK(status IN ('unread','reading','read','cited')),
        rating INTEGER DEFAULT 0 CHECK(rating BETWEEN 0 AND 5),
        notes TEXT,
        date_added TEXT DEFAULT (datetime('now')),
        date_modified TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS authors (
        id TEXT PRIMARY KEY,
        paper_id TEXT NOT NULL,
        name TEXT NOT NULL,
        author_order INTEGER DEFAULT 0,
        affiliation TEXT,
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        color TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS paper_collections (
        paper_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        PRIMARY KEY (paper_id, collection_id),
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS paper_tags (
        paper_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (paper_id, tag_id),
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY,
        paper_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        content TEXT,
        type TEXT DEFAULT 'highlight' CHECK(type IN ('highlight','note','underline')),
        color TEXT DEFAULT '#ffe066',
        position TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        paper_id TEXT NOT NULL,
        content TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        provider TEXT DEFAULT 'ollama',
        model TEXT DEFAULT 'llama3.2',
        created_at TEXT DEFAULT (datetime('now')),
        message_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        keyword TEXT NOT NULL,
        sources TEXT,
        result_count INTEGER DEFAULT 0,
        searched_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS keywords (
        id TEXT PRIMARY KEY,
        paper_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS review_outlines (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        papers TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS review_sections (
        id TEXT PRIMARY KEY,
        outline_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        section_order INTEGER DEFAULT 0,
        FOREIGN KEY (outline_id) REFERENCES review_outlines(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_papers_title ON papers(title);
      CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi);
      CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
      CREATE INDEX IF NOT EXISTS idx_papers_date_added ON papers(date_added);
      CREATE INDEX IF NOT EXISTS idx_authors_paper_id ON authors(paper_id);
      CREATE INDEX IF NOT EXISTS idx_annotations_paper_id ON annotations(paper_id);
      CREATE INDEX IF NOT EXISTS idx_notes_paper_id ON notes(paper_id);
      CREATE INDEX IF NOT EXISTS idx_keywords_paper_id ON keywords(paper_id);
      CREATE INDEX IF NOT EXISTS idx_paper_tags_paper_id ON paper_tags(paper_id);
      CREATE INDEX IF NOT EXISTS idx_paper_collections_paper_id ON paper_collections(paper_id);
    `);
  }

  // Helper: generate UUID
  generateId(): string {
    return uuidv4();
  }

  // Generic query helpers — no raw db exposure to prevent arbitrary SQL
  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  close(): void {
    this.db.close();
  }

  // Settings helpers
  getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }
}
