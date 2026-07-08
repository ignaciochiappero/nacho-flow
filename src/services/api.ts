import { Model } from 'src/types';

const API_BASE = '/api';

export interface ProjectSummary {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project extends ProjectSummary {
  model: Model;
}

export const api = {
  // List all projects
  async listProjects(): Promise<ProjectSummary[]> {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to list projects');
    return res.json();
  },

  // Get single project
  async getProject(id: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    if (!res.ok) throw new Error('Failed to get project');
    return res.json();
  },

  // Create project
  async createProject(title: string, model: Model, description?: string): Promise<ProjectSummary> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, model, description })
    });
    if (!res.ok) throw new Error('Failed to create project');
    return res.json();
  },

  // Update project
  async updateProject(id: string, model: Model, title?: string): Promise<void> {
    const body: any = { model };
    if (title) body.title = title;

    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Failed to update project');
  },

  // Delete project
  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  // Export projects as SQLite file
  async exportSqlite(projectIds?: string[]): Promise<Blob> {
    const res = await fetch(`${API_BASE}/projects/export/sqlite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectIds })
    });
    if (!res.ok) throw new Error('Failed to export SQLite');
    return res.blob();
  },

  // Export single project as JSON
  exportJsonUrl(id: string): string {
    return `${API_BASE}/projects/${id}/export/json`;
  },

  // Import projects from SQLite (parsed client-side)
  async importSqlite(projects: any[]): Promise<number> {
    const res = await fetch(`${API_BASE}/projects/import/sqlite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects })
    });
    if (!res.ok) throw new Error('Failed to import SQLite');
    const data = await res.json();
    return data.imported;
  }
};
