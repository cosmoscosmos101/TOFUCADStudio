// ═══════════════════════════════════════════════
// CAD Command Factories
//
// Every command implements the A+B contract:
//   execute()  — perform the operation
//   undo()     — precise inverse (Option A)
//   snapshot() — capture state before mutation (Option B)
//   restore()  — apply a snapshot (Option B fallback)
//
// Commands are plain objects, not classes — keeping them
// serializable-friendly and easy to inspect in devtools.
// ═══════════════════════════════════════════════

import { useCADStore } from './useCADStore'

// ── Shared snapshot/restore helpers ──────────────────────

const objectsSnapshot = () =>
  JSON.parse(JSON.stringify(useCADStore.getState().objects))

const objectsRestore = (snapshot) =>
  useCADStore.getState().restoreObjects(snapshot)

// ── Command: Add Object ───────────────────────────────────

export const addObjectCmd = (def) => {
  let assignedId = null

  return {
    name:    `Add ${def.type ?? 'Object'}`,
    icon:    shapeIcon(def.type),

    execute() {
      assignedId = useCADStore.getState().addObject(def)
      useCADStore.getState().addXP(25)
    },

    undo() {
      if (assignedId) useCADStore.getState().removeObject(assignedId)
    },

    snapshot: objectsSnapshot,
    restore:  objectsRestore,
  }
}

// ── Command: Delete Object ────────────────────────────────

export const deleteObjectCmd = (id) => {
  let saved = null

  return {
    name: 'Delete Object',
    icon: '🗑',

    execute() {
      const { objects } = useCADStore.getState()
      saved = objects.find(o => o.id === id) ?? null
      useCADStore.getState().removeObject(id)
    },

    undo() {
      if (saved) {
        // Restore with exact same ID so scene references still work
        useCADStore.getState().addObject({ ...saved, id: saved.id })
      }
    },

    snapshot: objectsSnapshot,
    restore:  objectsRestore,
  }
}

// ── Command: Move Object ──────────────────────────────────

export const moveObjectCmd = (id, from, to) => ({
  name:    'Move',
  icon:    '↗',

  execute() {
    useCADStore.getState().updateObject(id, { position: to })
  },

  undo() {
    useCADStore.getState().updateObject(id, { position: from })
  },

  snapshot: objectsSnapshot,
  restore:  objectsRestore,
})

// ── Command: Change Property ──────────────────────────────
// Handles color, scale, wireframe, layerId, etc.

export const changePropertyCmd = (id, property, newValue) => {
  let oldValue = undefined

  return {
    name:    `Set ${property}`,
    icon:    '⚙',

    execute() {
      const obj = useCADStore.getState().objects.find(o => o.id === id)
      oldValue = obj?.[property]
      useCADStore.getState().updateObject(id, { [property]: newValue })
    },

    undo() {
      if (oldValue !== undefined) {
        useCADStore.getState().updateObject(id, { [property]: oldValue })
      }
    },

    snapshot: objectsSnapshot,
    restore:  objectsRestore,
  }
}

// ── Command: Extrude (complex — leans on snapshot) ────────
// Option A provides a best-effort inverse; Option B is the
// real safety net for geometry ops like this.

export const extrudeCmd = (sketchId, height) => {
  let extrudedId = null

  return {
    name:    `Extrude (${height}mm)`,
    icon:    '⬆',

    execute() {
      // Stub: in a real app this would call into a WASM geometry kernel.
      // Here we create a tall box to represent the extruded solid.
      const sketch = useCADStore.getState().objects.find(o => o.id === sketchId)
      extrudedId = useCADStore.getState().addObject({
        type:     'box',
        position: sketch?.position ?? [0, height / 2, 0],
        scale:    [1, height / 10, 1],
        color:    '#e040fb',
        _extra:   { sourceSketchId: sketchId, isExtrusion: true, height },
      })
      useCADStore.getState().addXP(80)
    },

    // Attempt precise inverse (Option A)
    undo() {
      if (extrudedId) useCADStore.getState().removeObject(extrudedId)
    },

    // Snapshot always taken (Option B fallback)
    snapshot: objectsSnapshot,
    restore:  objectsRestore,
  }
}

// ── Command: Boolean Operation ────────────────────────────
// Most complex — no reliable exact inverse without the
// geometry kernel, so this command declares NO undo() and
// relies entirely on the Option B snapshot for reversal.

export const booleanCmd = (type, id1, id2) => {
  return {
    name:    `Boolean ${type}`,
    icon:    '⊕',

    execute() {
      // Stub: represent the result as a merged single object
      const { objects } = useCADStore.getState()
      const a = objects.find(o => o.id === id1)
      const b = objects.find(o => o.id === id2)
      if (!a || !b) return

      useCADStore.getState().removeObject(id1)
      useCADStore.getState().removeObject(id2)
      useCADStore.getState().addObject({
        type:     'box',
        position: midpoint(a.position, b.position),
        color:    '#ffd740',
        _extra:   { isBooleanResult: true, boolType: type },
      })
      useCADStore.getState().addXP(150)
    },

    // undo() intentionally omitted — Option B snapshot handles reversal
    snapshot: objectsSnapshot,
    restore:  objectsRestore,
  }
}

// ── Utilities ─────────────────────────────────────────────

function shapeIcon(type) {
  return { box: '🧊', sphere: '⚽', cylinder: '🥫', cone: '▲', torus: '⭕' }[type] ?? '⬡'
}

function midpoint(a = [0,0,0], b = [0,0,0]) {
  return [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2]
}
