import { create } from 'zustand'

const API = 'http://localhost:4000/api'

export const useProjectsStore = create((set) => ({
  projects: [],
  loading:  false,
  error:    null,

  fetchMyProjects: async () => {
    set({ loading: true, error: null })
    try {
      const r    = await fetch(`${API}/projects`, { credentials: 'include' })
      const data = await r.json()
      if (!r.ok) { set({ loading: false, error: data.error }); return }
      set({ projects: data, loading: false })
    } catch {
      set({ loading: false, error: 'Failed to load projects' })
    }
  },

  createProject: async (fields) => {
    const r    = await fetch(`${API}/projects`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(fields),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Failed to create project')
    set(s => ({ projects: [data, ...s.projects] }))
    return data
  },

  deleteProject: async (id) => {
    await fetch(`${API}/projects/${id}`, { method: 'DELETE', credentials: 'include' })
    set(s => ({ projects: s.projects.filter(p => p.id !== id) }))
  },

  clearError: () => set({ error: null }),
}))
