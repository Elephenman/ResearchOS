import { create } from 'zustand';

const api = () => window.electronAPI;

interface SettingsState {
  settings: Record<string, string>;
  loading: boolean;

  fetchSettings: () => Promise<void>;
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;

  // Computed helpers
  aiProvider: string;
  aiModel: string;
  citationStyle: string;
  language: string;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  loading: false,
  aiProvider: 'ollama',
  aiModel: 'llama3.2',
  citationStyle: 'apa',
  language: 'zh-CN',

  fetchSettings: async () => {
    set({ loading: true });
    try {
      const settings = await api().getAllSettings();
      set({
        settings,
        loading: false,
        aiProvider: settings['ai.provider'] || 'ollama',
        aiModel: settings['ai.model'] || 'llama3.2',
        citationStyle: settings['citation.style'] || 'apa',
        language: settings['app.language'] || 'zh-CN',
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      set({ loading: false });
    }
  },

  getSetting: async (key) => {
    try {
      return await api().getSetting(key);
    } catch (err) {
      console.error('Failed to get setting:', err);
      return null;
    }
  },

  setSetting: async (key, value) => {
    try {
      await api().setSetting(key, value);
      const updated = { ...get().settings, [key]: value };
      const updates: Partial<SettingsState> = { settings: updated };

      if (key === 'ai.provider') updates.aiProvider = value;
      if (key === 'ai.model') updates.aiModel = value;
      if (key === 'citation.style') updates.citationStyle = value;
      if (key === 'app.language') updates.language = value;

      set(updates as SettingsState);
    } catch (err) {
      console.error('Failed to set setting:', err);
    }
  },
}));
