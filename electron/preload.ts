import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Generic invoke (for window controls and other dynamic IPC)
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

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
  indexPaper: (paperId: string) => ipcRenderer.invoke('rag:indexPaper', paperId),
  searchRelevant: (query: string, topK: number) => ipcRenderer.invoke('rag:searchRelevant', query, topK),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:getSetting', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:setSetting', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAllSettings'),

  // Menu events
  onMenuImportPdf: (callback: () => void) => ipcRenderer.on('menu:import-pdf', callback),
  onMenuExportPapers: (callback: () => void) => ipcRenderer.on('menu:export-papers', callback),
  onMenuAbout: (callback: () => void) => ipcRenderer.on('menu:about', callback),
});
