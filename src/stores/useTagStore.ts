import { create } from 'zustand';
import type { Tag } from '../types/electron';

const api = () => window.electronAPI;

interface TagWithCount extends Tag {
  usageCount?: number;
}

interface TagState {
  tags: TagWithCount[];
  loading: boolean;

  fetchTags: () => Promise<void>;
  createTag: (name: string, color?: string) => Promise<Tag | null>;
  deleteTag: (id: string) => Promise<void>;
  addTagToPaper: (paperId: string, tagId: string) => Promise<void>;
  removeTagFromPaper: (paperId: string, tagId: string) => Promise<void>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loading: false,

  fetchTags: async () => {
    set({ loading: true });
    try {
      const tags = await api().getTags();
      set({ tags: tags as TagWithCount[], loading: false });
    } catch (err) {
      console.error('Failed to fetch tags:', err);
      set({ loading: false });
    }
  },

  createTag: async (name, color) => {
    try {
      const tag = await api().createTag(name, color);
      get().fetchTags();
      return tag;
    } catch (err) {
      console.error('Failed to create tag:', err);
      return null;
    }
  },

  deleteTag: async (id) => {
    try {
      await api().deleteTag(id);
      get().fetchTags();
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  },

  addTagToPaper: async (paperId, tagId) => {
    try {
      await api().addTagToPaper(paperId, tagId);
    } catch (err) {
      console.error('Failed to add tag to paper:', err);
    }
  },

  removeTagFromPaper: async (paperId, tagId) => {
    try {
      await api().removeTagFromPaper(paperId, tagId);
    } catch (err) {
      console.error('Failed to remove tag from paper:', err);
    }
  },
}));
