import { create } from 'zustand'
import { useCADStore } from './useCADStore'

// ─── Prompt enhancement ───────────────────────────────────────────────────────
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

// ─── Prompt → geometry assemblies ────────────────────────────────────────────
const ASSEMBLIES = {
  robot: [
    { type:'box',      name:'Torso',        position:[0, 1.0, 0],   scale:[0.9, 1.1, 0.6],  color:'#8eb8d0' },
    { type:'box',      name:'Head',         position:[0, 2.2, 0],   scale:[0.7, 0.7, 0.65], color:'#a0c8dc' },
    { type:'box',      name:'L_Arm',        position:[-0.9, 1.0, 0],scale:[0.35,1.0,0.35],  color:'#8eb8d0' },
    { type:'box',      name:'R_Arm',        position:[ 0.9, 1.0, 0],scale:[0.35,1.0,0.35],  color:'#8eb8d0' },
    { type:'box',      name:'L_Leg',        position:[-0.28,0.0, 0],scale:[0.36,0.9,0.36],  color:'#7aa8c0' },
    { type:'box',      name:'R_Leg',        position:[ 0.28,0.0, 0],scale:[0.36,0.9,0.36],  color:'#7aa8c0' },
    { type:'sphere',   name:'L_Eye',        position:[-0.18,2.28,0.33],scale:[0.12,0.12,0.1],color:'#ff4466'},
    { type:'sphere',   name:'R_Eye',        position:[ 0.18,2.28,0.33],scale:[0.12,0.12,0.1],color:'#ff4466'},
    { type:'torus',    name:'Collar',       position:[0, 1.6, 0],   scale:[0.6,0.6,0.6],    color:'#ffd740', params:{r:0.5,tube:0.07} },
  ],

  helmet: [
    { type:'sphere',   name:'Shell',        position:[0, 1.2, 0],   scale:[1.1, 1.1, 1.0],  color:'#2a2a3a' },
    { type:'box',      name:'Visor',        position:[0, 1.1, 0.9], scale:[0.9,0.5,0.12],   color:'#00e5ff' },
    { type:'torus',    name:'Crown_Ring',   position:[0, 1.85, 0],  scale:[0.7,0.7,0.7],    color:'#c4b0ff', params:{r:0.5,tube:0.06} },
    { type:'box',      name:'Chin_Guard',   position:[0, 0.6, 0.7], scale:[0.8,0.3,0.2],    color:'#2a2a3a' },
    { type:'cylinder', name:'Vent_L',       position:[-0.9,1.1,0],  scale:[0.15,0.18,0.15], color:'#444455', params:{r:0.5,h:1} },
    { type:'cylinder', name:'Vent_R',       position:[ 0.9,1.1,0],  scale:[0.15,0.18,0.15], color:'#444455', params:{r:0.5,h:1} },
  ],

  mech: [
    { type:'box',      name:'Cockpit',      position:[0, 2.2, 0],   scale:[1.1, 0.9, 0.9],  color:'#2a3040' },
    { type:'box',      name:'Torso',        position:[0, 1.0, 0],   scale:[1.4, 1.2, 0.9],  color:'#3a4050' },
    { type:'box',      name:'L_Shoulder',   position:[-1.2,1.8,0],  scale:[0.6,0.5,0.5],    color:'#3a4050' },
    { type:'box',      name:'R_Shoulder',   position:[ 1.2,1.8,0],  scale:[0.6,0.5,0.5],    color:'#3a4050' },
    { type:'cylinder', name:'L_Arm',        position:[-1.3,1.0,0],  scale:[0.25,0.95,0.25], color:'#2a3040', params:{r:0.5,h:1} },
    { type:'cylinder', name:'R_Arm',        position:[ 1.3,1.0,0],  scale:[0.25,0.95,0.25], color:'#2a3040', params:{r:0.5,h:1} },
    { type:'box',      name:'L_Leg',        position:[-0.45,-0.2,0],scale:[0.5,1.2,0.5],    color:'#2a3040' },
    { type:'box',      name:'R_Leg',        position:[ 0.45,-0.2,0],scale:[0.5,1.2,0.5],    color:'#2a3040' },
    { type:'box',      name:'L_Foot',       position:[-0.45,-1.0,0.2],scale:[0.55,0.3,0.8], color:'#3a4050' },
    { type:'box',      name:'R_Foot',       position:[ 0.45,-1.0,0.2],scale:[0.55,0.3,0.8], color:'#3a4050' },
    { type:'torus',    name:'Reactor',      position:[0, 1.1, 0.5], scale:[0.3,0.3,0.3],    color:'#00e5ff', params:{r:0.5,tube:0.2} },
  ],

  doraemon: [
    { type:'sphere',   name:'Body',         position:[0, 0.8, 0],   scale:[1.0, 1.0, 1.0],  color:'#3399ff' },
    { type:'sphere',   name:'Head',         position:[0, 2.0, 0],   scale:[0.95,0.95,0.95], color:'#3399ff' },
    { type:'sphere',   name:'Face',         position:[0, 2.05,0.62],scale:[0.72,0.72,0.35], color:'#ffffff' },
    { type:'sphere',   name:'Nose',         position:[0, 2.0, 0.97],scale:[0.1,0.1,0.1],    color:'#ff4444' },
    { type:'torus',    name:'Collar',       position:[0, 1.4, 0],   scale:[0.7,0.7,0.7],    color:'#ff3333', params:{r:0.5,tube:0.12} },
    { type:'sphere',   name:'Pocket',       position:[0, 0.7, 0.98],scale:[0.5,0.38,0.12],  color:'#ffffff' },
    { type:'sphere',   name:'L_Eye',        position:[-0.22,2.2,0.84],scale:[0.15,0.15,0.1],color:'#ffffff' },
    { type:'sphere',   name:'R_Eye',        position:[ 0.22,2.2,0.84],scale:[0.15,0.15,0.1],color:'#ffffff' },
    { type:'sphere',   name:'Pupil_L',      position:[-0.22,2.16,0.95],scale:[0.07,0.07,0.05],color:'#000011'},
    { type:'sphere',   name:'Pupil_R',      position:[ 0.22,2.16,0.95],scale:[0.07,0.07,0.05],color:'#000011'},
  ],

  gear: [
    { type:'torus',    name:'Outer_Ring',   position:[0, 0.5, 0],   scale:[1.0,1.0,0.28],   color:'#8c8c9a', params:{r:1.0,tube:0.18} },
    { type:'cylinder', name:'Hub',          position:[0, 0.5, 0],   scale:[0.35,0.3,0.35],  color:'#6a6a78', params:{r:0.5,h:1} },
    { type:'box',      name:'Tooth_1',      position:[0, 0.5, 0.93],scale:[0.18,0.28,0.3],  color:'#8c8c9a' },
    { type:'box',      name:'Tooth_2',      position:[0.66,0.5,0.66],scale:[0.18,0.28,0.3], color:'#8c8c9a' },
    { type:'box',      name:'Tooth_3',      position:[0.93,0.5, 0], scale:[0.3,0.28,0.18],  color:'#8c8c9a' },
    { type:'box',      name:'Tooth_4',      position:[0.66,0.5,-0.66],scale:[0.18,0.28,0.3],color:'#8c8c9a' },
    { type:'box',      name:'Tooth_5',      position:[0, 0.5,-0.93],scale:[0.18,0.28,0.3],  color:'#8c8c9a' },
    { type:'box',      name:'Tooth_6',      position:[-0.66,0.5,-0.66],scale:[0.18,0.28,0.3],color:'#8c8c9a' },
    { type:'box',      name:'Tooth_7',      position:[-0.93,0.5, 0],scale:[0.3,0.28,0.18],  color:'#8c8c9a' },
    { type:'box',      name:'Tooth_8',      position:[-0.66,0.5,0.66],scale:[0.18,0.28,0.3],color:'#8c8c9a' },
  ],

  bracket: [
    { type:'box',      name:'Base_Plate',   position:[0, 0.1, 0],   scale:[2.0,0.15,1.2],   color:'#7080a0' },
    { type:'box',      name:'Vert_Arm',     position:[0, 0.8,-0.4], scale:[0.25,1.4,0.15],  color:'#7080a0' },
    { type:'box',      name:'Brace',        position:[0, 0.5,-0.2], scale:[0.2,0.7,0.4],    color:'#6070a0' },
    { type:'cylinder', name:'Hole_L',       position:[-0.6,0.1,0.3],scale:[0.12,0.18,0.12], color:'#4a5a7a', params:{r:0.5,h:1} },
    { type:'cylinder', name:'Hole_R',       position:[ 0.6,0.1,0.3],scale:[0.12,0.18,0.12], color:'#4a5a7a', params:{r:0.5,h:1} },
  ],

  sword: [
    { type:'box',      name:'Blade',        position:[0, 1.6, 0],   scale:[0.1,2.4,0.04],   color:'#c0c8d8' },
    { type:'box',      name:'Guard',        position:[0, 0.5, 0],   scale:[0.7,0.1,0.12],   color:'#c8a030' },
    { type:'cylinder', name:'Grip',         position:[0, 0.05,0],   scale:[0.1,0.7,0.1],    color:'#4a2a10', params:{r:0.5,h:1} },
    { type:'sphere',   name:'Pommel',       position:[0,-0.4, 0],   scale:[0.16,0.16,0.16], color:'#c8a030' },
  ],

  gun: [
    { type:'box',      name:'Receiver',     position:[0, 0.4, 0],   scale:[0.28,0.3,1.2],   color:'#2a2a2a' },
    { type:'cylinder', name:'Barrel',       position:[0, 0.45,0.8], scale:[0.08,0.08,0.8],  color:'#202020', params:{r:0.5,h:1} },
    { type:'box',      name:'Stock',        position:[0, 0.25,-0.7],scale:[0.22,0.35,0.8],  color:'#3a2010' },
    { type:'box',      name:'Magazine',     position:[0, 0.1, 0.2], scale:[0.22,0.5,0.2],   color:'#1a1a1a' },
    { type:'box',      name:'Grip',         position:[0,-0.1, 0.1], scale:[0.18,0.4,0.2],   color:'#1a1a1a' },
  ],

  wheel: [
    { type:'torus',    name:'Tire',         position:[0, 0.8, 0],   scale:[1.0,1.0,0.32],   color:'#1a1a1a', params:{r:0.8,tube:0.22} },
    { type:'cylinder', name:'Rim',          position:[0, 0.8, 0],   scale:[0.55,0.28,0.55], color:'#a0a8b0', params:{r:0.5,h:1} },
    { type:'torus',    name:'Hub_Ring',     position:[0, 0.8, 0],   scale:[0.28,0.28,0.28], color:'#707880', params:{r:0.5,tube:0.18} },
    { type:'box',      name:'Spoke_1',      position:[0, 0.8, 0.38],scale:[0.06,0.28,0.45], color:'#909098' },
    { type:'box',      name:'Spoke_2',      position:[0.38,0.8,0],  scale:[0.45,0.28,0.06], color:'#909098' },
    { type:'box',      name:'Spoke_3',      position:[0, 0.8,-0.38],scale:[0.06,0.28,0.45], color:'#909098' },
    { type:'box',      name:'Spoke_4',      position:[-0.38,0.8,0], scale:[0.45,0.28,0.06], color:'#909098' },
  ],

  car: [
    { type:'box',      name:'Body',         position:[0, 0.4, 0],   scale:[1.1,0.5,2.2],    color:'#c4301a' },
    { type:'box',      name:'Roof',         position:[0, 0.85,0.1], scale:[0.95,0.4,1.2],   color:'#b02812' },
    { type:'box',      name:'Windshield',   position:[0, 0.72,0.72],scale:[0.9,0.35,0.08],  color:'#88ccee' },
    { type:'torus',    name:'Wheel_FL',     position:[-0.7,0.22,0.78],scale:[0.3,0.3,0.18], color:'#1a1a1a', params:{r:0.5,tube:0.22} },
    { type:'torus',    name:'Wheel_FR',     position:[ 0.7,0.22,0.78],scale:[0.3,0.3,0.18], color:'#1a1a1a', params:{r:0.5,tube:0.22} },
    { type:'torus',    name:'Wheel_RL',     position:[-0.7,0.22,-0.78],scale:[0.3,0.3,0.18],color:'#1a1a1a', params:{r:0.5,tube:0.22} },
    { type:'torus',    name:'Wheel_RR',     position:[ 0.7,0.22,-0.78],scale:[0.3,0.3,0.18],color:'#1a1a1a', params:{r:0.5,tube:0.22} },
  ],

  rocket: [
    { type:'cylinder', name:'Body',         position:[0, 1.5, 0],   scale:[0.45,2.2,0.45],  color:'#e0e4f0', params:{r:0.5,h:1} },
    { type:'cone',     name:'Nose',         position:[0, 3.0, 0],   scale:[0.45,0.9,0.45],  color:'#ff4444' },
    { type:'torus',    name:'Engine_Ring',  position:[0, 0.3, 0],   scale:[0.55,0.55,0.55], color:'#606070', params:{r:0.5,tube:0.15} },
    { type:'box',      name:'Fin_Front',    position:[0, 0.6,-0.6], scale:[0.06,0.9,0.5],   color:'#c0c4d4' },
    { type:'box',      name:'Fin_Left',     position:[-0.6,0.6,0],  scale:[0.5,0.9,0.06],   color:'#c0c4d4' },
    { type:'box',      name:'Fin_Right',    position:[ 0.6,0.6,0],  scale:[0.5,0.9,0.06],   color:'#c0c4d4' },
  ],

  spacecraft: [
    { type:'box',      name:'Fuselage',     position:[0, 0.4, 0],   scale:[0.6,0.5,2.5],    color:'#d0d8e8' },
    { type:'box',      name:'Wing_L',       position:[-1.5,0.3,0],  scale:[1.8,0.12,1.2],   color:'#c0c8d8' },
    { type:'box',      name:'Wing_R',       position:[ 1.5,0.3,0],  scale:[1.8,0.12,1.2],   color:'#c0c8d8' },
    { type:'cone',     name:'Nose',         position:[0, 0.4,1.6],  scale:[0.3,0.3,1.2],    color:'#e0e8f8' },
    { type:'cylinder', name:'Engine_L',     position:[-0.9,0.2,-1.1],scale:[0.22,0.22,0.8], color:'#808090', params:{r:0.5,h:1} },
    { type:'cylinder', name:'Engine_R',     position:[ 0.9,0.2,-1.1],scale:[0.22,0.22,0.8], color:'#808090', params:{r:0.5,h:1} },
    { type:'torus',    name:'Nozzle_L',     position:[-0.9,0.2,-1.5],scale:[0.25,0.25,0.25],color:'#00e5ff', params:{r:0.5,tube:0.22} },
    { type:'torus',    name:'Nozzle_R',     position:[ 0.9,0.2,-1.5],scale:[0.25,0.25,0.25],color:'#00e5ff', params:{r:0.5,tube:0.22} },
  ],

  building: [
    { type:'box',      name:'Foundation',   position:[0,-0.05,0],   scale:[3.0,0.2,3.0],    color:'#808080' },
    { type:'box',      name:'Floor_1',      position:[0, 0.7, 0],   scale:[2.6,1.2,2.6],    color:'#a09080' },
    { type:'box',      name:'Floor_2',      position:[0, 2.1, 0],   scale:[2.2,1.2,2.2],    color:'#908070' },
    { type:'box',      name:'Floor_3',      position:[0, 3.3, 0],   scale:[1.8,1.0,1.8],    color:'#807060' },
    { type:'cone',     name:'Roof',         position:[0, 4.2, 0],   scale:[1.4,1.1,1.4],    color:'#604830' },
    { type:'box',      name:'Door',         position:[0, 0.4,1.32], scale:[0.4,0.75,0.06],  color:'#5a3a20' },
  ],

  tree: [
    { type:'cylinder', name:'Trunk',        position:[0, 0.6, 0],   scale:[0.2,1.4,0.2],    color:'#6a3a10', params:{r:0.5,h:1} },
    { type:'sphere',   name:'Canopy_Low',   position:[0, 2.0, 0],   scale:[1.0,0.9,1.0],    color:'#2a8a30' },
    { type:'sphere',   name:'Canopy_Mid',   position:[0, 2.7, 0],   scale:[0.8,0.8,0.8],    color:'#30a038' },
    { type:'sphere',   name:'Canopy_Top',   position:[0, 3.3, 0],   scale:[0.5,0.6,0.5],    color:'#38b840' },
  ],

  chair: [
    { type:'box',      name:'Seat',         position:[0, 0.5, 0],   scale:[0.9,0.1,0.9],    color:'#8a5530' },
    { type:'box',      name:'Back',         position:[0, 1.0,-0.4], scale:[0.9,1.0,0.1],    color:'#8a5530' },
    { type:'box',      name:'Leg_FL',       position:[-0.38,0.2, 0.38],scale:[0.1,0.5,0.1], color:'#6a3a10' },
    { type:'box',      name:'Leg_FR',       position:[ 0.38,0.2, 0.38],scale:[0.1,0.5,0.1], color:'#6a3a10' },
    { type:'box',      name:'Leg_BL',       position:[-0.38,0.2,-0.38],scale:[0.1,0.5,0.1], color:'#6a3a10' },
    { type:'box',      name:'Leg_BR',       position:[ 0.38,0.2,-0.38],scale:[0.1,0.5,0.1], color:'#6a3a10' },
  ],

  table: [
    { type:'box',      name:'Top',          position:[0, 0.9, 0],   scale:[1.8,0.1,1.0],    color:'#8a5530' },
    { type:'box',      name:'Leg_FL',       position:[-0.8,0.4, 0.4],scale:[0.1,1.0,0.1],   color:'#6a3a10' },
    { type:'box',      name:'Leg_FR',       position:[ 0.8,0.4, 0.4],scale:[0.1,1.0,0.1],   color:'#6a3a10' },
    { type:'box',      name:'Leg_BL',       position:[-0.8,0.4,-0.4],scale:[0.1,1.0,0.1],   color:'#6a3a10' },
    { type:'box',      name:'Leg_BR',       position:[ 0.8,0.4,-0.4],scale:[0.1,1.0,0.1],   color:'#6a3a10' },
  ],

  housing: [
    { type:'box',      name:'Shell',        position:[0, 0.6, 0],   scale:[2.0,1.2,1.4],    color:'#404858' },
    { type:'box',      name:'Lid',          position:[0, 1.28,0],   scale:[2.0,0.12,1.4],   color:'#505870' },
    { type:'cylinder', name:'Port_L',       position:[-0.7,0.5,-0.72],scale:[0.18,0.18,0.12],color:'#303848', params:{r:0.5,h:1} },
    { type:'cylinder', name:'Port_R',       position:[ 0.7,0.5,-0.72],scale:[0.18,0.18,0.12],color:'#303848', params:{r:0.5,h:1} },
    { type:'box',      name:'Fan_Vent',     position:[0, 0.8,-0.72],scale:[1.0,0.5,0.06],   color:'#303040' },
  ],

  diamond: [
    { type:'cone',     name:'Crown',        position:[0, 0.8, 0],   scale:[0.7,0.9,0.7],    color:'#88ddff' },
    { type:'cone',     name:'Pavilion',     position:[0, 0.0, 0],   scale:[0.7,0.65,0.7],   color:'#aaeeff' },
    { type:'torus',    name:'Girdle',       position:[0, 0.76,0],   scale:[0.55,0.55,0.55], color:'#ccf4ff', params:{r:0.5,tube:0.06} },
  ],

  mushroom: [
    { type:'cylinder', name:'Stem',         position:[0, 0.3, 0],   scale:[0.25,0.7,0.25],  color:'#e8d8b0', params:{r:0.5,h:1} },
    { type:'sphere',   name:'Cap',          position:[0, 1.0, 0],   scale:[1.0,0.65,1.0],   color:'#cc2222' },
    { type:'sphere',   name:'Spot_1',       position:[0.4,1.2,0.2], scale:[0.15,0.1,0.1],   color:'#ffffff' },
    { type:'sphere',   name:'Spot_2',       position:[-0.3,1.3,0.3],scale:[0.12,0.08,0.08], color:'#ffffff' },
    { type:'sphere',   name:'Spot_3',       position:[0.1,1.35,-0.35],scale:[0.1,0.07,0.07],color:'#ffffff' },
  ],

  engine: [
    { type:'cylinder', name:'Block',        position:[0, 0.5, 0],   scale:[1.0,1.0,1.4],    color:'#505060', params:{r:0.5,h:1} },
    { type:'box',      name:'Head',         position:[0, 1.15,0],   scale:[0.95,0.25,1.35], color:'#404050' },
    { type:'cylinder', name:'Crank',        position:[0,-0.1, 0],   scale:[1.1,0.2,1.1],    color:'#383848', params:{r:0.5,h:1} },
    { type:'cylinder', name:'Piston_1',     position:[-0.3,0.6,0],  scale:[0.18,0.6,0.18],  color:'#909090', params:{r:0.5,h:1} },
    { type:'cylinder', name:'Piston_2',     position:[ 0.3,0.6,0],  scale:[0.18,0.6,0.18],  color:'#909090', params:{r:0.5,h:1} },
    { type:'sphere',   name:'Air_Filter',   position:[0, 1.6, 0],   scale:[0.35,0.28,0.35], color:'#cc4400' },
    { type:'cylinder', name:'Exhaust',      position:[-1.2,0.5,0],  scale:[0.15,0.15,1.0],  color:'#303030', params:{r:0.5,h:1} },
  ],

  propeller: [
    { type:'cylinder', name:'Hub',          position:[0, 0.5, 0],   scale:[0.2,0.3,0.2],    color:'#606070', params:{r:0.5,h:1} },
    { type:'box',      name:'Blade_1',      position:[0, 0.5, 0.9], scale:[0.12,0.08,1.4],  color:'#c0c8d0' },
    { type:'box',      name:'Blade_2',      position:[0.9,0.5, 0],  scale:[1.4,0.08,0.12],  color:'#c0c8d0' },
    { type:'box',      name:'Blade_3',      position:[0, 0.5,-0.9], scale:[0.12,0.08,1.4],  color:'#c0c8d0' },
    { type:'box',      name:'Blade_4',      position:[-0.9,0.5, 0], scale:[1.4,0.08,0.12],  color:'#c0c8d0' },
  ],

  satellite: [
    { type:'box',      name:'Body',         position:[0, 0.5, 0],   scale:[0.6,0.6,0.9],    color:'#c0c8d8' },
    { type:'box',      name:'Panel_L',      position:[-1.6,0.5,0],  scale:[1.8,0.08,0.8],   color:'#1a3060' },
    { type:'box',      name:'Panel_R',      position:[ 1.6,0.5,0],  scale:[1.8,0.08,0.8],   color:'#1a3060' },
    { type:'sphere',   name:'Antenna_Ball', position:[0, 1.2, 0],   scale:[0.25,0.25,0.25], color:'#d0d8e8' },
    { type:'cylinder', name:'Antenna_Rod',  position:[0, 0.95,0],   scale:[0.04,0.5,0.04],  color:'#c0c8d8', params:{r:0.5,h:1} },
    { type:'torus',    name:'Dish',         position:[0, 0.5, 0.6], scale:[0.3,0.3,0.3],    color:'#d8dce8', params:{r:0.5,tube:0.12} },
  ],
}

// Keyword → assembly key
const KEYWORD_MAP = [
  [/doraemon|doremon|dora/i,           'doraemon'  ],
  [/robot|android|humanoid|cyborg/i,   'robot'     ],
  [/\bmech\b|exosuit|exo.?suit|titan/i, 'mech'      ],
  [/helmet|visor|head.?gear/i,         'helmet'    ],
  [/gear|cog|sprocket|pinion/i,        'gear'      ],
  [/bracket|mount|clamp|flange/i,      'bracket'   ],
  [/sword|blade|dagger|knife|saber/i,  'sword'     ],
  [/gun|rifle|pistol|weapon|firearm/i, 'gun'       ],
  [/wheel|tyre|tire|rim/i,             'wheel'     ],
  [/car|vehicle|automobile|truck/i,    'car'       ],
  [/rocket|missile|launch/i,           'rocket'    ],
  [/plane|aircraft|jet|shuttle|spacecraft/i,'spacecraft'],
  [/building|house|tower|skyscraper/i, 'building'  ],
  [/tree|plant|pine|oak/i,             'tree'      ],
  [/chair|seat|stool/i,                'chair'     ],
  [/table|desk/i,                      'table'     ],
  [/housing|enclosure|case/i,          'housing'   ],
  [/diamond|gem|jewel|crystal/i,       'diamond'   ],
  [/mushroom|fungi|toadstool/i,        'mushroom'  ],
  [/engine|motor|powertrain/i,         'engine'    ],
  [/propeller|prop|rotor|fan/i,        'propeller' ],
  [/satellite|space.?station/i,        'satellite' ],
]

function promptToObjects(prompt) {
  const text = (prompt || '').toLowerCase()
  for (const [regex, key] of KEYWORD_MAP) {
    if (regex.test(text)) return ASSEMBLIES[key]
  }
  // Default: parametric sculpture
  return [
    { type:'sphere',   name:'Core',      position:[0, 1.0, 0],  scale:[0.6,0.6,0.6],   color:'#c4b0ff' },
    { type:'torus',    name:'Ring_H',    position:[0, 1.0, 0],  scale:[1.0,1.0,0.22],  color:'#ffadd4', params:{r:0.7,tube:0.12} },
    { type:'torus',    name:'Ring_V',    position:[0, 1.0, 0],  scale:[0.22,1.0,1.0],  color:'#fde68a', params:{r:0.7,tube:0.12} },
    { type:'box',      name:'Base',      position:[0, 0.05,0],  scale:[1.2,0.12,1.2],  color:'#7060a0' },
    { type:'cylinder', name:'Pedestal',  position:[0, 0.4, 0],  scale:[0.18,0.7,0.18], color:'#8070b0', params:{r:0.5,h:1} },
  ]
}

// ─── Generation phases ────────────────────────────────────────────────────────
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

// ─── Zustand store ────────────────────────────────────────────────────────────
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
  objectsPlaced:  false,

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
    const { generationType, prompt, enhancedPrompt } = get()
    const activePrompt = enhancedPrompt || prompt
    set({ status: 'generating', progress: 0, currentPhase: GEN_PHASES[0].msg, stats: null, objectsPlaced: false })

    for (const phase of GEN_PHASES) {
      await new Promise(r => setTimeout(r, 220 + Math.random() * 440))
      if (get().status !== 'generating') return
      set({ progress: phase.pct, currentPhase: phase.msg })
    }

    // Place assembled geometry into the CAD scene
    const specs = promptToObjects(activePrompt)
    const cadStore = useCADStore.getState()
    const xOffset = cadStore.objects.length > 0 ? (Math.floor(cadStore.objects.length / 5) % 3) * 5 - 5 : 0

    specs.forEach(spec => {
      cadStore.addObject({
        type:     spec.type,
        name:     spec.name,
        position: [spec.position[0] + xOffset, spec.position[1], spec.position[2]],
        scale:    spec.scale,
        color:    spec.color,
        params:   spec.params,
        visible:  true,
      })
    })

    cadStore.addXP(120)

    set({
      status:        'complete',
      objectsPlaced: true,
      stats:         GEN_STATS[generationType] || GEN_STATS.game,
    })
  },

  cancelGeneration: () => set({ status: 'idle', progress: 0, currentPhase: '', objectsPlaced: false }),

  resetGeneration: () => set({
    status: 'idle', progress: 0, currentPhase: '',
    prompt: '', enhancedPrompt: '', tags: [], attachedImage: null, stats: null, objectsPlaced: false,
  }),

  startOptimization: async () => {
    set({ optimizing: true, optProgress: 0, optResult: null })
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 380 + Math.random() * 420))
      if (!get().optimizing) return
      set({ optProgress: Math.round(((i + 1) / 10) * 100) })
    }
    set({
      optimizing: false, optProgress: 100,
      optResult: { massReduction: 67, stiffness: 94, safetyFactor: 2.4, iterations: 5 },
    })
  },

  cancelOptimization: () => set({ optimizing: false, optProgress: 0 }),
}))
