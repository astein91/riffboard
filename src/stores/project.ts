import { create } from 'zustand';

interface Project {
  id: string;
  name: string;
  description: string;
}

interface ProjectStore {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  setActiveProject: (project: Project | null) => void;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProject: null,
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    const res = await fetch('/api/projects');
    const projects = await res.json();
    set({ projects, loading: false });
  },

  createProject: async (name, description = '') => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const project = await res.json();
    set(s => ({ projects: [...s.projects, project], activeProject: project }));
    return project;
  },

  setActiveProject: (project) => set({ activeProject: project }),

  deleteProject: async (id) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    set(s => ({
      projects: s.projects.filter(p => p.id !== id),
      activeProject: s.activeProject?.id === id ? null : s.activeProject,
    }));
  },
}));
