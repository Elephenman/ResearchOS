export interface Author {
  id: string;
  paperId: string;
  name: string;
  order: number;
  affiliation?: string;
}

export interface Paper {
  id: string;
  title: string;
  authors: Author[];
  year?: number;
  journal?: string;
  doi?: string;
  pmid?: string;
  abstract?: string;
  filePath?: string;
  coverUrl?: string;
  status: 'unread' | 'reading' | 'read' | 'cited';
  rating: 0 | 1 | 2 | 3 | 4 | 5;
  notes?: string;
  dateAdded: string;
  dateModified: string;
  collections: Collection[];
  tags: Tag[];
}

export interface Collection {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  count: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface Annotation {
  id: string;
  paperId: string;
  pageNumber: number;
  content: string;
  type: 'highlight' | 'note' | 'underline';
  color: string;
  position?: { x: number; y: number; width: number; height: number } | null;
  createdAt: string;
}

export interface Note {
  id: string;
  paperId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchQuery {
  keyword: string;
  sources: string[];
  filters?: {
    yearFrom?: number;
    yearTo?: number;
    author?: string;
    journal?: string;
  };
}

export interface SearchResult {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  doi?: string;
  pmid?: string;
  abstract: string;
  source: string;
  citedCount?: number;
}

export interface AIConversation {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: string;
  messageCount: number;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ReviewOutline {
  id: string;
  title: string;
  papers: string[];
  sections: ReviewSection[];
  createdAt: string;
}

export interface ReviewSection {
  id: string;
  outlineId: string;
  title: string;
  content: string;
  order: number;
}

export interface CitationFormat {
  id: string;
  name: string;
  style: 'apa' | 'mla' | 'gb-t' | 'vancouver' | 'chicago';
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'paper' | 'author' | 'keyword';
  size: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: 'cite' | 'coauthor' | 'cokeyword';
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

export interface ElectronAPI {
  // Generic invoke (for dynamic IPC channels like window controls)
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;

  // Window controls
  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;
  isMaximized(): Promise<boolean>;

  // Library
  getPapers(params: { page: number; pageSize: number; keyword?: string; status?: string; collectionId?: string; tagId?: string }): Promise<{ data: Paper[]; total: number }>;
  getPaperById(id: string): Promise<Paper | null>;
  addPaper(paper: Record<string, unknown>): Promise<Record<string, unknown>>;
  updatePaper(id: string, updates: Partial<Paper>): Promise<void>;
  deletePaper(id: string): Promise<void>;
  importPapers(files: string[]): Promise<number>;
  exportPapers(ids: string[], format: string): Promise<string>;
  checkDuplicates(paper: Partial<Paper>): Promise<Paper[]>;

  // Collections
  getCollections(): Promise<Collection[]>;
  createCollection(name: string, parentId?: string): Promise<Collection>;
  updateCollection(id: string, updates: Partial<Collection>): Promise<void>;
  deleteCollection(id: string): Promise<void>;

  // Tags
  getTags(): Promise<Tag[]>;
  createTag(name: string, color?: string): Promise<Tag>;
  deleteTag(id: string): Promise<void>;
  addTagToPaper(paperId: string, tagId: string): Promise<void>;
  removeTagFromPaper(paperId: string, tagId: string): Promise<void>;

  // Reader
  getAnnotations(paperId: string): Promise<Annotation[]>;
  addAnnotation(annotation: Omit<Annotation, 'id' | 'createdAt'>): Promise<Annotation>;
  deleteAnnotation(id: string): Promise<void>;
  getNotes(paperId: string): Promise<Note[]>;
  addNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note>;
  updateNote(id: string, content: string): Promise<void>;
  deleteNote(id: string): Promise<void>;

  // AI
  chat(messages: AIMessage[], options: { provider: string; model: string; temperature?: number }): Promise<string>;
  summarizePaper(paperId: string): Promise<string>;
  extractKeyFindings(paperId: string): Promise<string[]>;
  translateAbstract(paperId: string, targetLang: string): Promise<string>;

  // Citation
  formatCitation(paperId: string, style: CitationFormat['style']): Promise<string>;
  insertCitation(paperId: string, style: CitationFormat['style']): Promise<string>;

  // Graph
  getCitationGraph(paperId: string, depth: number): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
  getCoAuthorGraph(authorId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
  getKeywordGraph(paperId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;

  // Downloader
  downloadPaper(doi: string): Promise<string>;
  batchDownloadPapers(dois: string[]): Promise<{ success: number; failed: number }>;
  downloadFile(url: string, fileName: string): Promise<string>;

  // Search
  searchPapers(options: { keyword: string; sources: string[]; yearFrom?: number; yearTo?: number; page?: number; pageSize?: number }): Promise<SearchResult[]>;
  getSearchHistory(): Promise<Array<{ id: string; keyword: string; sources: string; resultCount: number; searchedAt: string }>>;

  // Review
  generateReviewOutline(paperIds: string[], topic: string): Promise<ReviewOutline>;
  generateReviewSection(sectionId: string): Promise<string>;

  // RAG
  indexPaper(paperId: string, filePath: string, meta?: Record<string, unknown>): Promise<{ status: string; chunks_created?: number; message?: string }>;
  indexBatch(documents: Record<string, unknown>[]): Promise<{ total: number; success: number; failed: number }>;
  searchRelevant(query: string, topK?: number, filterPaperIds?: string[]): Promise<Array<{
    chunk_id: string;
    paper_id: string;
    title: string;
    content: string;
    score: number;
    page_number?: number;
    metadata?: Record<string, unknown>;
  }>>;
  ragStatus(): Promise<{ status: string; version?: string; total_chunks?: number; total_papers?: number; message?: string }>;
  ragDeletePaper(paperId: string): Promise<{ paper_id: string; chunks_deleted: number; status: string }>;

  // Zotero
  zoteroFindDataDir(): Promise<string | null>;
  zoteroImport(dataDir: string): Promise<{ imported: number; skipped: number; errors: string[] }>;
  zoteroSelectDir(): Promise<string | null>;

  // Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;
}
