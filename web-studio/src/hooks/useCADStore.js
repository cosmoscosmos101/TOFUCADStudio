import { create } from 'zustand'

let _nextId = 1
const uid = () => `obj_${_nextId++}`

const defaultParams = (type) => {
  switch (type) {
    case 'sphere':   return { r: 0.5 }
    case 'cylinder': return { r: 0.5, h: 1 }
    case 'cone':     return { r: 0.5, h: 1 }
    case 'torus':    return { r: 0.5, tube: 0.18 }
    default:         return { w: 1, h: 1, d: 1 }
  }
}

export const useCADStore = create((set, get) => ({
  // ── View state ──
  activeTool:  'select',
  activeMode:  '3d',
  showGrid:    true,
  showStats:   false,
  snapEnabled: true,
  orthoMode:   false,
  shadingMode: 'solid',   // 'solid' | 'wireframe' | 'xray' | 'flat'
  showTree:       true,
  showRightPanel: true,
  studioMode:     'cad',  // 'cad' | 'ai3d' | 'gendesign'
  cameraPreset: null,     // { pos: [x,y,z], target: [x,y,z] }

  // ── Layers ──
  layers: [
    { id: '1', name: 'Default',    visible: true,  locked: false, color: '#00e5ff' },
    { id: '2', name: 'Dimensions', visible: true,  locked: false, color: '#ffd740' },
    { id: '3', name: 'References', visible: false, locked: true,  color: '#e040fb' },
  ],
  activeLayer: '1',

  // ── Gamification ──
  xp:        2340,
  xpMax:     3000,
  level:     5,
  rankTitle: 'Structural Engineer',

  // ── Scene objects ──
  objects: [],

  // ── Annotations (measurements, labels) ──
  annotations:  [],
  measureStart: null,  // { objId, position: [x,y,z] } — first point of a distance measure

  // ── View actions ──
  setTool:         tool => set({ activeTool: tool }),
  setMode:         mode => set({ activeMode: mode }),
  toggleGrid:       ()  => set(s => ({ showGrid:    !s.showGrid })),
  toggleSnap:       ()  => set(s => ({ snapEnabled: !s.snapEnabled })),
  toggleOrtho:      ()  => set(s => ({ orthoMode:   !s.orthoMode })),
  toggleStats:      ()  => set(s => ({ showStats:   !s.showStats })),
  setShadingMode:  mode => set({ shadingMode: mode }),
  toggleTree:        ()  => set(s => ({ showTree:       !s.showTree })),
  toggleRightPanel:  ()  => set(s => ({ showRightPanel: !s.showRightPanel })),
  setStudioMode:    mode => set({ studioMode: mode }),
  setCameraPreset: preset => set({ cameraPreset: preset }),
  clearCameraPreset: () => set({ cameraPreset: null }),

  // ── Layer actions ──
  setActiveLayer: id => set({ activeLayer: id }),
  toggleLayerVisibility: id => set(s => ({
    layers: s.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l),
  })),
  addLayer: () => {
    const id = uid()
    set(s => ({
      layers: [...s.layers, {
        id, name: `Layer ${s.layers.length + 1}`,
        visible: true, locked: false, color: '#ffffff',
      }],
    }))
  },

  // ── Object CRUD (called by commands — not directly from UI) ──

  // Add an object, returning its assigned ID
  addObject: (def) => {
    const id   = def.id ?? uid()
    const type = def.type ?? 'box'
    const obj = {
      id,
      name:      def.name      ?? type,
      type,
      position:  def.position  ?? [0, 0.5, 0],
      rotation:  def.rotation  ?? [0, 0, 0],
      scale:     def.scale     ?? [1, 1, 1],
      color:     def.color     ?? '#00e5ff',
      visible:   def.visible   ?? true,
      layerId:   def.layerId   ?? get().activeLayer,
      wireframe: def.wireframe ?? false,
      params:    def.params    ?? defaultParams(type),
      createdAt: def.createdAt ?? Date.now(),
      ...def._extra,
    }
    set(s => ({ objects: [...s.objects, obj] }))
    return id
  },

  // Remove an object by ID
  removeObject: (id) => {
    set(s => ({ objects: s.objects.filter(o => o.id !== id) }))
  },

  // Partial update — merges changes into matching object
  updateObject: (id, changes) => {
    set(s => ({
      objects: s.objects.map(o => o.id === id ? { ...o, ...changes } : o),
    }))
  },

  // Overwrite the full objects array (used by Option B snapshot restore)
  restoreObjects: (objects) => {
    set({ objects })
  },

  // ── Object tree actions ──
  renameObject: (id, name) => {
    set(s => ({ objects: s.objects.map(o => o.id === id ? { ...o, name } : o) }))
  },

  duplicateObject: (id) => {
    const obj = get().objects.find(o => o.id === id)
    if (!obj) return null
    const newId = uid()
    const copy  = {
      ...obj,
      id:       newId,
      name:     `${obj.name || obj.type} copy`,
      position: [obj.position[0] + 1.5, obj.position[1], obj.position[2]],
      createdAt: Date.now(),
    }
    set(s => ({ objects: [...s.objects, copy] }))
    return newId
  },

  toggleObjectVisibility: (id) => {
    set(s => ({
      objects: s.objects.map(o => o.id === id ? { ...o, visible: !(o.visible ?? true) } : o),
    }))
  },

  // ── Annotation actions ──
  addAnnotation:    ann  => set(s => ({ annotations: [...s.annotations, { id: `ann_${Date.now()}`, ...ann }] })),
  removeAnnotation: id   => set(s => ({ annotations: s.annotations.filter(a => a.id !== id) })),
  clearAnnotations:       () => set({ annotations: [], measureStart: null }),
  setMeasureStart:  pt   => set({ measureStart: pt }),
  clearMeasureStart:      () => set({ measureStart: null }),

  // XP helper
  addXP: (amount) => {
    set(s => {
      const next = s.xp + amount
      if (next >= s.xpMax) {
        return { xp: next - s.xpMax, xpMax: Math.floor(s.xpMax * 1.4), level: s.level + 1 }
      }
      return { xp: next }
    })
  },
}))
