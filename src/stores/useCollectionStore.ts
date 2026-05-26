import { create } from 'zustand';
import type { Collection } from '../types/electron';

const api = () => window.electronAPI;

interface CollectionState {
  collections: Collection[];
  loading: boolean;
  selectedCollectionId: string | null;

  fetchCollections: () => Promise<void>;
  createCollection: (name: string, parentId?: string) => Promise<Collection | null>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  setSelectedCollectionId: (id: string | null) => void;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  collections: [],
  loading: false,
  selectedCollectionId: null,

  fetchCollections: async () => {
    set({ loading: true });
    try {
      const collections = await api().getCollections();
      set({ collections, loading: false });
    } catch (err) {
      console.error('Failed to fetch collections:', err);
      set({ loading: false });
    }
  },

  createCollection: async (name, parentId) => {
    try {
      const collection = await api().createCollection(name, parentId);
      get().fetchCollections();
      return collection;
    } catch (err) {
      console.error('Failed to create collection:', err);
      return null;
    }
  },

  updateCollection: async (id, updates) => {
    try {
      await api().updateCollection(id, updates);
      get().fetchCollections();
    } catch (err) {
      console.error('Failed to update collection:', err);
    }
  },

  deleteCollection: async (id) => {
    try {
      await api().deleteCollection(id);
      if (get().selectedCollectionId === id) {
        set({ selectedCollectionId: null });
      }
      get().fetchCollections();
    } catch (err) {
      console.error('Failed to delete collection:', err);
    }
  },

  setSelectedCollectionId: (id) => set({ selectedCollectionId: id }),
}));
