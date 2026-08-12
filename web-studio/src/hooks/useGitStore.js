import { create } from 'zustand'
import { useCADStore } from './useCADStore'

// ═══════════════════════════════════════════════
// Git-for-CAD: Branch / Commit / Diff store
// Modeled after git: branches point to commits,
// commits point to parent commits, each stores
// a full parametric scene snapshot.
// ═══════════════════════════════════════════════

const INITIAL_SNAPSHOT = () => JSON.parse(JSON.stringify(useCADStore.getState().objects))

export const useGitStore = create((set, get) => ({
  branches: [
    { id: 'main', name: 'main', color: '#00e5ff', isDefault: true },
  ],
  activeBranch: 'main',

  // commits[branchId] = [{ id, message, authorName, timestamp, snapshot, parentId }]
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

  // Activity feed
  activity: [
    { id: 'a1', user: 'Yuki S.',  msg: 'Added 2.0mm Fillet to Motor_Mount',  ts: Date.now() - 12000 },
    { id: 'a2', user: 'Kenji T.', msg: 'Committed "Bore tolerance ±0.05mm"', ts: Date.now() - 45000 },
    { id: 'a3', user: 'Aiko M.',  msg: 'Forked from Base_Assembly v1.4',    ts: Date.now() - 90000 },
  ],

  // ── Branch operations ─────────────────────────

  createBranch(name) {
    const { activeBranch, commits } = get()
    const branchColors = ['#e040fb', '#ffd740', '#69ff47', '#ff6688', '#ffab40']
    const color = branchColors[get().branches.length % branchColors.length]
    const parentCommits = commits[activeBranch] ?? []

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
  },

  switchBranch(branchId) {
    const { commits } = get()
    const branchCommits = commits[branchId] ?? []
    const latestSnapshot = branchCommits.at(-1)?.snapshot ?? []
    // Restore scene to latest commit on this branch
    useCADStore.getState().restoreObjects(latestSnapshot)
    set({ activeBranch: branchId })
  },

  // ── Commit operations ─────────────────────────

  commit(message) {
    const { activeBranch, commits } = get()
    const branchCommits = commits[activeBranch] ?? []
    const parentId = branchCommits.at(-1)?.id ?? null
    const snapshot = JSON.parse(JSON.stringify(useCADStore.getState().objects))

    const newCommit = {
      id:         `c_${Date.now()}`,
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

    return newCommit.id
  },

  // Restore scene to a specific commit
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
