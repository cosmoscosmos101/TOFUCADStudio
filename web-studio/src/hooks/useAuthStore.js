import { create } from 'zustand'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

export const useAuthStore = create((set, get) => ({
  user:    null,
  loading: false,
  error:   null,

  fetchMe: async () => {
    set({ loading: true, error: null })
    try {
      const r = await fetch(`${API}/auth/me`, { credentials: 'include' })
      if (!r.ok) { set({ user: null, loading: false }); return }
      const data = await r.json()
      set({ user: data, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) { set({ loading: false, error: data.error ?? 'Login failed' }); return false }
    set({ user: data.user, loading: false, error: null })
    return true
  },

  register: async (email, username, displayName, password) => {
    set({ loading: true, error: null })
    const r = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, username, displayName, password }),
    })
    const data = await r.json()
    if (!r.ok) { set({ loading: false, error: data.error ?? 'Registration failed' }); return false }
    set({ user: data.user, loading: false, error: null })
    return true
  },

  logout: async () => {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' })
    set({ user: null, error: null })
  },

  clearError: () => set({ error: null }),
}))
