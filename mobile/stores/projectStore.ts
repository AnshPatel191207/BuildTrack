import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProjectThemeConfig } from '@/constants/dynamicTheme';

const ACTIVE_PROJECT_KEY = 'bt.active_project_data';

export interface ActiveProjectState {
  activeProjectId: string | null;
  activeProjectName: string;
  activeProjectShortName: string;
  activeProjectLogo: string | null;
  activeProjectLogoDark: string | null;
  developerName: string;
  reraNumber: string;
  activeTheme: ProjectThemeConfig | null;
  isLoaded: boolean;
  setActiveProject: (project: any) => Promise<void>;
  updateThemeColors: (colors: ProjectThemeConfig) => void;
  updateBrandingData: (branding: any) => void;
  loadActiveProject: () => Promise<void>;
  resetProject: () => Promise<void>;
}

export const useProjectStore = create<ActiveProjectState>((set, get) => ({
  activeProjectId: null,
  activeProjectName: 'BuildTrack ERP',
  activeProjectShortName: 'BuildTrack',
  activeProjectLogo: null,
  activeProjectLogoDark: null,
  developerName: 'Developer',
  reraNumber: '',
  activeTheme: null,
  isLoaded: false,

  setActiveProject: async (project: any) => {
    if (!project) return;
    const patch = {
      activeProjectId: project._id || project.id,
      activeProjectName: project.name || 'BuildTrack ERP',
      activeProjectShortName: project.branding?.shortName || project.name?.split(' ')[0] || 'BuildTrack',
      activeProjectLogo: project.branding?.logoUrl || null,
      activeProjectLogoDark: project.branding?.logoDarkUrl || null,
      developerName: project.branding?.developerName || project.builderName || 'Developer',
      reraNumber: project.branding?.reraNumber || project.reraNumber || '',
      activeTheme: project.theme || null,
      isLoaded: true,
    };
    set(patch);
    try {
      await AsyncStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify(project));
    } catch {}
  },

  updateThemeColors: (colors: ProjectThemeConfig) => {
    const activeTheme = { ...get().activeTheme, ...colors };
    set({ activeTheme });
  },

  updateBrandingData: (branding: any) => {
    set({
      activeProjectShortName: branding.shortName || get().activeProjectShortName,
      activeProjectLogo: branding.logoUrl !== undefined ? branding.logoUrl : get().activeProjectLogo,
      activeProjectLogoDark: branding.logoDarkUrl !== undefined ? branding.logoDarkUrl : get().activeProjectLogoDark,
      developerName: branding.developerName || get().developerName,
      reraNumber: branding.reraNumber || get().reraNumber,
    });
  },

  loadActiveProject: async () => {
    if (get().isLoaded) return;
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_PROJECT_KEY);
      if (raw) {
        const project = JSON.parse(raw);
        set({
          activeProjectId: project._id || project.id,
          activeProjectName: project.name || 'BuildTrack ERP',
          activeProjectShortName: project.branding?.shortName || project.name?.split(' ')[0] || 'BuildTrack',
          activeProjectLogo: project.branding?.logoUrl || null,
          activeProjectLogoDark: project.branding?.logoDarkUrl || null,
          developerName: project.branding?.developerName || project.builderName || 'Developer',
          reraNumber: project.branding?.reraNumber || project.reraNumber || '',
          activeTheme: project.theme || null,
          isLoaded: true,
        });
        return;
      }
    } catch {}
    set({ isLoaded: true });
  },

  resetProject: async () => {
    try {
      await AsyncStorage.removeItem(ACTIVE_PROJECT_KEY);
    } catch {}
    set({
      activeProjectId: null,
      activeProjectName: 'BuildTrack ERP',
      activeProjectShortName: 'BuildTrack',
      activeProjectLogo: null,
      activeProjectLogoDark: null,
      developerName: 'Developer',
      reraNumber: '',
      activeTheme: null,
      isLoaded: true,
    });
  },
}));
