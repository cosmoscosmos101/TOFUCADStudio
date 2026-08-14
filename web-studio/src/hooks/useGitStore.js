import { create } from 'zustand'
import { useCADStore } from './useCADStore'

const API = 'http://localhost:4000/api'

export const useGitStore = create((set, get) => ({
  // ── Persistence state ──
  projectId:    null,
  projectTitle: null,
  loadingProject: false,
  persistError: null,

  branches: [
    { id: 'main', name: 'main', color: '#00e5ff', isDefault: true },
  ],
  activeBranch: 'main',

  // branchDbId maps local branch name → DB UUID (populated after loadFromServer)
  branchDbId: {},

  // commits[branchName] = [{ id, message, authorName, timestamp, snapshot, parentId }]
  commits: {
    main: [
      {
        id:         'init',
        message:    'Initial commit — blank canvas',
        authorName: 'System',
        timestamp:  Date.now() - 60000,
        snapshot:   [],
        parentId:   null,
      },
    ],
  },

  // Collaborators (simulated)
  collaborators: [
    { id: 'u1', name: 'Yuki S.',   avatar: 'Y', color: '#e040fb', activeBranch: 'main',    tool: 'extrude' },
    { id: 'u2', name: 'Kenji T.',  avatar: 'K', color: '#ffd740', activeBranch: 'feat/v2', tool: 'fillet'  },
    { id: 'u3', name: 'Aiko M.',   avatar: 'A', color: '#69ff47', activeBranch: 'main',    tool: 'select'  },
  ],

  activity: [
    { id: 'a1', user: 'Yuki S.',  msg: 'Added 2.0mm Fillet to Motor_Mount',  ts: Date.now() - 12000 },
    { id: 'a2', user: 'Kenji T.', msg: 'Committed "Bore tolerance ±0.05mm"', ts: Date.now() - 45000 },
    { id: 'a3', user: 'Aiko M.',  msg: 'Forked from Base_Assembly v1.4',    ts: Date.now() - 90000 },
  ],

  // ── Load project from server ──────────────────

  async loadFromServer(projectId) {
    set({ loadingProject: true, persistError: null })
    try {
      const res = await fetch(`${API}/projects/${projectId}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Project fetch failed: ${res.status}`)
      const project = await res.json()

      // Build branch list from DB
      const remoteBranches = project.branches ?? []
      if (remoteBranches.length === 0) {
        set({ loadingProject: false, projectId, projectTitle: project.title })
        return
      }

      // Map branch DB rows → local branch objects + fetch commits per branch
      const branchDbId = {}
      const branchList = []
      const commitsMap = {}

      await Promise.all(remoteBranches.map(async (b) => {
        branchDbId[b.name] = b.id
        branchList.push({
          id:        b.name,
          name:      b.name,
          color:     b.color ?? '#00e5ff',
          isDefault: b.isDefault,
        })

        const cr = await fetch(`${API}/projects/${projectId}/branches/${b.id}/commits`, { credentials: 'include' })
        const remoteCommits = cr.ok ? await cr.json() : []

        commitsMap[b.name] = remoteCommits.length > 0
          ? remoteCommits.map(c => ({
              id:         c.id,
              message:    c.message,
              authorName: c.authorId,  // will resolve to username later
              timestamp:  new Date(c.createdAt).getTime(),
              snapshot:   c.sceneSnapshot ?? [],
              parentId:   c.parentId,
            }))
          : [{
              id: 'init', message: 'Initial commit — blank canvas',
              authorName: 'System', timestamp: Date.now() - 60000,
              snapshot: [], parentId: null,
            }]
      }))

      // Restore scene from main branch head (or first branch)
      const defaultBranch = remoteBranches.find(b => b.isDefault) ?? remoteBranches[0]
      const defaultBranchCommits = commitsMap[defaultBranch.name] ?? []
      const headSnapshot = defaultBranchCommits.at(-1)?.snapshot ?? []
      useCADStore.getState().restoreObjects(headSnapshot)

      set({
        projectId,
        projectTitle: project.title,
        loadingProject: false,
        branchDbId,
        branches:     branchList,
        activeBranch: defaultBranch.name,
        commits:      commitsMap,
      })
    } catch (err) {
      set({ loadingProject: false, persistError: err.message })
    }
  },

  // ── Branch operations ─────────────────────────

  async createBranch(name) {
    const { activeBranch, commits, projectId, branchDbId } = get()
    const branchColors = ['#e040fb', '#ffd740', '#69ff47', '#ff6688', '#ffab40']
    const color = branchColors[get().branches.length % branchColors.length]
    const parentCommits = commits[activeBranch] ?? []

    // Optimistic local update first
    set(s => ({
      branches: [...s.branches, { id: name, name, color, isDefault: false }],
      commits: {
        ...s.commits,
        [name]: parentCommits.length
          ? [{ ...parentCommits.at(-1), parentId: parentCommits.at(-1).id }]
          : [],
      },
      activeBranch: name,
    }))

    // Persist to server if we're in a real project
    if (projectId) {
      const baseBranchDbId = branchDbId[activeBranch]
      try {
        const res = await fetch(`${API}/projects/${projectId}/branches`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, color, baseBranchId: baseBranchDbId }),
        })
        if (res.ok) {
          const branch = await res.json()
          set(s => ({ branchDbId: { ...s.branchDbId, [name]: branch.id } }))
        }
      } catch {
        // local-only branch is fine for now
      }
    }
  },

  switchBranch(branchId) {
    const { commits } = get()
    const branchCommits = commits[branchId] ?? []
    const latestSnapshot = branchCommits.at(-1)?.snapshot ?? []
    useCADStore.getState().restoreObjects(latestSnapshot)
    set({ activeBranch: branchId })
  },

  // ── Commit operations ─────────────────────────

  async commit(message) {
    const { activeBranch, commits, projectId, branchDbId } = get()
    const branchCommits = commits[activeBranch] ?? []
    const parentId = branchCommits.at(-1)?.id ?? null
    const snapshot = JSON.parse(JSON.stringify(useCADStore.getState().objects))

    const localId = `c_${Date.now()}`
    const newCommit = {
      id:         localId,
      message:    message || `Commit ${branchCommits.length + 1}`,
      authorName: 'You',
      timestamp:  Date.now(),
      snapshot,
      parentId,
    }

    set(s => ({
      commits: {
        ...s.commits,
        [activeBranch]: [...(s.commits[activeBranch] ?? []), newCommit],
      },
    }))

    // Persist to Supabase if in a real project
    if (projectId) {
      const branchDbIdVal = branchDbId[activeBranch]
      if (branchDbIdVal) {
        try {
          const res = await fetch(`${API}/projects/${projectId}/branches/${branchDbIdVal}/commits`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: newCommit.message, sceneSnapshot: snapshot, parentId }),
          })
          if (res.ok) {
            const saved = await res.json()
            // Replace local temp ID with real DB ID
            set(s => ({
              commits: {
                ...s.commits,
                [activeBranch]: s.commits[activeBranch].map(c =>
                  c.id === localId ? { ...c, id: saved.id } : c
                ),
              },
            }))
          }
        } catch {
          // commit stays local-only
        }
      }
    }

    return localId
  },

  checkoutCommit(branchId, commitId) {
    const { commits } = get()
    const commit = (commits[branchId] ?? []).find(c => c.id === commitId)
    if (commit) {
      useCADStore.getState().restoreObjects(commit.snapshot)
    }
  },

  addActivity(user, msg) {
    set(s => ({
      activity: [{ id: `a_${Date.now()}`, user, msg, ts: Date.now() }, ...s.activity.slice(0, 19)],
    }))
  },
}))
