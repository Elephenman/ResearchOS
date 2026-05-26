import { create } from 'zustand';
import type { Paper } from '../types/electron';

const api = () => window.electronAPI;

interface LibraryState {
  papers: Paper[];
  total: number;
  loading: boolean;
  keyword: string;
  statusFilter: string;
  collectionFilter: string;
  tagFilter: string;
  page: number;
  pageSize: number;
  selectedIds: string[];

  fetchPapers: () => Promise<void>;
  setKeyword: (keyword: string) => void;
  setStatusFilter: (status: string) => void;
  setCollectionFilter: (collectionId: string) => void;
  setTagFilter: (tagId: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSelectedIds: (ids: string[]) => void;
  addPaper: (paper: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  updatePaper: (id: string, updates: Record<string, unknown>) => Promise<void>;
  deletePaper: (id: string) => Promise<void>;
  importPapers: (files: string[]) => Promise<number>;
  checkDuplicates: (paper: Record<string, unknown>) => Promise<Paper[]>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  papers: [],
  total: 0,
  loading: false,
  keyword: '',
  statusFilter: '',
  collectionFilter: '',
  tagFilter: '',
  page: 1,
  pageSize: 20,
  selectedIds: [],

  fetchPapers: async () => {
    set({ loading: true });
    try {
      const { keyword, statusFilter, collectionFilter, tagFilter, page, pageSize } = get();
      const result = await api().getPapers({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        collectionId: collectionFilter || undefined,
        tagId: tagFilter || undefined,
      });
      set({ papers: result.data, total: result.total, loading: false });
    } catch (err) {
      console.error('Failed to fetch papers:', err);
      set({ loading: false });
    }
  },

  setKeyword: (keyword) => set({ keyword, page: 1 }),
  setStatusFilter: (status) => set({ statusFilter: status, page: 1 }),
  setCollectionFilter: (collectionId) => set({ collectionFilter: collectionId, page: 1 }),
  setTagFilter: (tagId) => set({ tagFilter: tagId, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),

  addPaper: async (paper) => {
    try {
      const result = await api().addPaper(paper);
      get().fetchPapers();
      return result as Record<string, unknown>;
    } catch (err) {
      console.error('Failed to add paper:', err);
      return null;
    }
  },

  updatePaper: async (id, updates) => {
    try {
      await api().updatePaper(id, updates);
      get().fetchPapers();
    } catch (err) {
      console.error('Failed to update paper:', err);
    }
  },

  deletePaper: async (id) => {
    try {
      await api().deletePaper(id);
      get().fetchPapers();
    } catch (err) {
      console.error('Failed to delete paper:', err);
    }
  },

  importPapers: async (files) => {
    try {
      const count = await api().importPapers(files);
      get().fetchPapers();
      return count;
    } catch (err) {
      console.error('Failed to import papers:', err);
      return 0;
    }
  },

  checkDuplicates: async (paper) => {
    try {
      return await api().checkDuplicates(paper);
    } catch (err) {
      console.error('Failed to check duplicates:', err);
      return [];
    }
  },
}));
