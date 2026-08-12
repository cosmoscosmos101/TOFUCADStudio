import { create } from 'zustand'

// ═══════════════════════════════════════════════
// CAD Undo/Redo — Combined Option A + B
//
// Option A (Command Pattern): each command carries a precise
//   inverse via undo(). Zero copies, instant for simple ops.
//
// Option B (Snapshot): every execute() captures a pre-state
//   snapshot. Restores automatically if A's undo() throws or
//   the command declares no undo. Reliable for complex ops
//   (boolean, loft, sweep) where exact inverse is hard.
//
// Execution flow:
//   execute(cmd) → snapshot() → cmd.execute() → push record
//   undo()       → try cmd._undo() [A] → on fail: _restore(_snapshot) [B]
//   redo()       → cmd._execute()
// ═══════════════════════════════════════════════

const MAX_HISTORY = 50

export const useCADHistory = create((set, get) => ({
  past:   [],   // most recent is last (stack top)
  future: [],   // redo stack; head = next to redo

  // ── Execute a command and record it ──────────────────────
  execute(command) {
    const { past } = get()

    // Option B: snapshot current state BEFORE mutation
    const snapshot = command.snapshot ? command.snapshot() : null

    // Option A: run the command's execute()
    command.execute()

    const record = {
      name:      command.name  ?? 'Action',
      icon:      command.icon  ?? '⚡',
      timestamp: Date.now(),
      _execute:  command.execute,
      _undo:     command.undo  ?? null,   // may be absent for complex ops
      _snapshot: snapshot,                // Option B snapshot
      _restore:  command.restore ?? null, // how to apply snapshot
    }

    set({
      past:   [...past.slice(-(MAX_HISTORY - 1)), record],
      future: [],
    })
  },

  // ── Undo ─────────────────────────────────────────────────
  undo() {
    const { past, future } = get()
    if (!past.length) return

    const record = past.at(-1)

    // Option A: try the precise command inverse first
    if (record._undo) {
      try {
        record._undo()
        set({ past: past.slice(0, -1), future: [record, ...future] })
        return
      } catch (err) {
        console.warn('[CADHistory] undo() threw — falling back to snapshot', err)
      }
    }

    // Option B: restore pre-execution snapshot
    if (record._snapshot && record._restore) {
      record._restore(record._snapshot)
    }

    set({ past: past.slice(0, -1), future: [record, ...future] })
  },

  // ── Redo ─────────────────────────────────────────────────
  redo() {
    const { past, future } = get()
    if (!future.length) return

    const record = future[0]

    if (record._execute) {
      record._execute()
    }

    set({ past: [...past, record], future: future.slice(1) })
  },

  // ── Jump to a specific point in history ──────────────────
  // Walks backward/forward until the target index is current.
  jumpTo(targetIndex) {
    const { past, undo, redo } = get()
    const currentIndex = past.length - 1

    if (targetIndex === currentIndex) return

    if (targetIndex < currentIndex) {
      // Undo multiple times
      const steps = currentIndex - targetIndex
      for (let i = 0; i < steps; i++) undo()
    } else {
      // Redo multiple times
      const steps = targetIndex - currentIndex
      for (let i = 0; i < steps; i++) redo()
    }
  },

  // ── Clear all history ────────────────────────────────────
  clear() {
    set({ past: [], future: [] })
  },
}))

// Shorthand hook for components that only need canUndo/canRedo
export const useUndoRedo = () => {
  const { past, future, undo, redo } = useCADHistory()
  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    historyCount: past.length,
    futureCount:  future.length,
  }
}
