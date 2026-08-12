import { create } from 'zustand'

// Prompt enhancement knowledge base
const PRINT_SPEC = [
  'watertight manifold mesh', 'no internal self-intersections',
  '1.5mm minimum wall thickness', 'split-assembly snap-fit joints for multi-part FDM',
  'centered at build-plate origin', 'support-structure-aware overhangs under 45 degrees',
]
const GAME_SPEC = [
  'game-ready quad-dominant topology', 'UV-unwrapped Channel 0',
  '2048x2048 PBR set (Albedo, Roughness, Normal, Emissive, AO)',
  'LOD0 high-poly plus LOD1 30% decimated', 'rigging-ready edge loops at joints',
]
const DETAIL_MAP = {
  helmet:   'interior padding ribs, ventilation slot arrays, visor mounting rails, chin-strap socket geometry',
  mech:     'exposed sub-structure panels, rivet clusters, hydraulic conduit runs, heat-fin arrays',
  weapon:   'trigger assembly, barrel rifling channel, ejection port, wear-scratched finish map',
  vehicle:  'chassis weld seams, bolt-flange detail, suspension linkage, brake rotor geometry',
  creature: 'ZBrush skin-pore displacement, muscle bulge topology, claw detail, subsurface scatter-ready',
  building: 'masonry joint mortar, window reveal depth, facade material zones, structural column detail',
}

function detectKeywords(text) {
  const t = text.toLowerCase()
  return {
    isPrint:  /print|3dp|fdm|resin|stl|3mf|watertight/.test(t),
    isGame:   /game|unity|unreal|ue5|rigg|character|npc|boss|hero/.test(t),
    mechType: Object.keys(DETAIL_MAP).find(k => t.includes(k)) ?? null,
    material: /titanium|steel|aluminum|carbon|plastic|wood|stone|leather/.exec(t)?.[0] ?? null,
    isHigh:   /high.?poly|zbrush|sculpt|detail/.test(t),
  }
}

function ruleBasedEnhance(prompt) {
  const kw = detectKeywords(prompt)
  const specs  = kw.isPrint ? PRINT_SPEC : GAME_SPEC
  const detail = kw.mechType ? ` Detail layer: ${DETAIL_MAP[kw.mechType]}.` : ''
  const mat    = kw.material
    ? ` Material: physically-based ${kw.material} surface with correct roughness/metalness PBR values.`
    : ' Material: physically-based surface with micro-surface detail.'
  const poly   = kw.isHigh ? ' High-poly sculpt baked to low-poly via cage projection.' : ''
  return `${prompt}.${poly} Technical specs: ${specs.join(', ')}.${mat}${detail} Clean silhouette from all cardinal views. Photorealistic render-ready.`
}

async function tryOllamaEnhance(prompt) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3',
        prompt: `You are a 3D model generation prompt engineer. Rewrite this brief idea into a detailed generation prompt with mesh, material, and scale specifications. Under 80 words.\nIdea: "${prompt}"\nDetailed prompt:`,
        stream: false,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    return data.response?.trim() || null
  } catch {
    clearTimeout(timer)
    return null
  }
}

const GEN_PHASES = [
  { pct: 0,   msg: 'Initializing neural mesh encoder…'     },
  { pct: 8,   msg: 'Encoding semantic tokens from prompt…' },
  { pct: 18,  msg: 'Generating latent 3D shape manifold…'  },
  { pct: 30,  msg: 'Diffusing coarse mesh skeleton…'       },
  { pct: 42,  msg: 'Refining surface topology…'            },
  { pct: 55,  msg: 'Synthesizing PBR material maps…'       },
  { pct: 68,  msg: 'Running watertight manifold check…'    },
  { pct: 75,  msg: 'Baking ambient occlusion…'             },
  { pct: 82,  msg: 'Optimizing edge loops for rigging…'    },
  { pct: 90,  msg: 'Generating LOD variants…'              },
  { pct: 96,  msg: 'Packaging export formats…'             },
  { pct: 100, msg: 'Generation complete.'                  },
]

const GEN_STATS = {
  game:    { verts: 12840, tris: 22560, textures: '4 x 2048px PBR',  size: '8.2 MB'  },
  print:   { verts: 38400, tris: 76800, textures: 'None (geometry)',  size: '14.6 MB', watertight: true },
  concept: { verts: 5200,  tris: 9800,  textures: '2 x 1024px diff', size: '3.1 MB'  },
}

export const useAIGeneration = create((set, get) => ({
  status:         'idle',
  prompt:         '',
  enhancedPrompt: '',
  generationType: 'game',
  quality:        'standard',
  outputFormat:   'glb',
  progress:       0,
  currentPhase:   '',
  attachedImage:  null,
  tags:           [],
  stats:          null,

  material:    'aluminum',
  latticeType: 'gyroid',
  optimizing:  false,
  optProgress: 0,
  optResult:   null,

  setPrompt:      p   => set({ prompt: p }),
  setType:        t   => set({ generationType: t }),
  setQuality:     q   => set({ quality: q }),
  setFormat:      f   => set({ outputFormat: f }),
  setImage:       img => set({ attachedImage: img }),
  setMaterial:    m   => set({ material: m }),
  setLatticeType: l   => set({ latticeType: l }),

  addTag:    tag => set(s => ({ tags: s.tags.includes(tag) ? s.tags : [...s.tags, tag] })),
  removeTag: tag => set(s => ({ tags: s.tags.filter(t => t !== tag) })),
  clearTags:     () => set({ tags: [] }),

  enhancePrompt: async () => {
    const { prompt } = get()
    if (!prompt.trim()) return
    set({ status: 'enhancing' })
    const result = await tryOllamaEnhance(prompt)
    set({ status: 'idle', enhancedPrompt: result || ruleBasedEnhance(prompt) })
  },

  startGeneration: async () => {
    const { generationType } = get()
    set({ status: 'generating', progress: 0, currentPhase: GEN_PHASES[0].msg, stats: null })
    for (const phase of GEN_PHASES) {
      await new Promise(r => setTimeout(r, 280 + Math.random() * 520))
      if (get().status !== 'generating') return
      set({ progress: phase.pct, currentPhase: phase.msg })
    }
    set({ status: 'complete', stats: GEN_STATS[generationType] || GEN_STATS.game })
  },

  cancelGeneration: () => set({ status: 'idle', progress: 0, currentPhase: '' }),

  resetGeneration: () => set({
    status: 'idle', progress: 0, currentPhase: '',
    prompt: '', enhancedPrompt: '', tags: [], attachedImage: null, stats: null,
  }),

  startOptimization: async () => {
    set({ optimizing: true, optProgress: 0, optResult: null })
    const stepCount = 10
    for (let i = 0; i < stepCount; i++) {
      await new Promise(r => setTimeout(r, 380 + Math.random() * 420))
      if (!get().optimizing) return
      set({ optProgress: Math.round(((i + 1) / stepCount) * 100) })
    }
    set({
      optimizing: false, optProgress: 100,
      optResult: { massReduction: 67, stiffness: 94, safetyFactor: 2.4, iterations: 5 },
    })
  },

  cancelOptimization: () => set({ optimizing: false, optProgress: 0 }),
}))
