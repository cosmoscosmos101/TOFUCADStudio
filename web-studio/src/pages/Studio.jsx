import { useRef, useState, Suspense, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Grid, OrbitControls, GizmoHelper, GizmoViewport, Stats, TransformControls, Html, Line,
} from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'

import { useCADStore }                from '../hooks/useCADStore'
import { useFileOperations, importGeometryCache } from '../hooks/useFileOperations'
import { useCADHistory, useUndoRedo } from '../hooks/useCADHistory'
import { deleteObjectCmd, addObjectCmd, changePropertyCmd } from '../hooks/useCADCommands'
import { ToolProvider, useTool }      from '../context/ToolContext'
import { useAuthStore }               from '../hooks/useAuthStore'
import { useGitStore }                from '../hooks/useGitStore'
import HistoryPanel                   from '../components/HistoryPanel'
import LiveTweaksPanel                from '../components/LiveTweaksPanel'
import GitPanel                       from '../components/GitPanel'
import MultiplayerHUD                 from '../components/MultiplayerHUD'
import AICommandBar                   from '../components/AICommandBar'
import TechDrawingModal               from '../components/TechDrawingModal'
import ProfileDrawer                  from '../components/ProfileDrawer'
import AIPromptBar                    from '../components/AIPromptBar'
import Generation3DPanel              from '../components/Generation3DPanel'
import GenerativeDesignPanel          from '../components/GenerativeDesignPanel'
import { useAIGeneration }            from '../hooks/useAIGeneration'
import '../styles/globals.css'

/* ── Keyboard shortcuts ── */
function useKeyboardShortcuts() {
  const { undo, redo }   = useUndoRedo()
  const { setMode, cycleTransform } = useTool()
  useEffect(() => {
    const h = e => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo();  return }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      if (k === 'escape') setMode('SELECT')
      if (k === 'e') setMode('EXTRUDE')
      if (k === 'f') setMode('FILLET')
      if (k === 'm') setMode('MEASURE')
      if (k === 'r') setMode('RECT')
      if (k === 'c') setMode('CIRCLE')
      if (k === 'v') setMode('REVOLVE')
      if (k === 'w' && !mod) setMode('SWEEP')
      if (k === 'g') cycleTransform()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [undo, redo, setMode, cycleTransform])
}

/* ── Tool palette ── */
const TOOL_GROUPS = [
  { label: '2D', tools: [
    { id: 'POLYLINE', icon: '⌒', tip: 'Polyline (P)' },
    { id: 'CIRCLE',   icon: '○', tip: 'Circle (C)'   },
    { id: 'ARC',      icon: '◠', tip: 'Arc (A)'      },
    { id: 'RECT',     icon: '□', tip: 'Rectangle (R)' },
    { id: 'SPLINE',   icon: '〜', tip: 'Spline (S)'  },
    { id: 'POLYGON',  icon: '⬡', tip: 'Polygon (G)'  },
  ]},
  { label: '3D', tools: [
    { id: 'EXTRUDE', icon: '⬆', tip: 'Extrude (E)' },
    { id: 'REVOLVE', icon: '↻', tip: 'Revolve (V)'  },
    { id: 'SWEEP',   icon: '⤸', tip: 'Sweep (W)'    },
    { id: 'LOFT',    icon: '◇', tip: 'Loft (T)'     },
    { id: 'BOOLEAN', icon: '⊕', tip: 'Boolean (B)'  },
  ]},
  { label: 'MOD', tools: [
    { id: 'FILLET',  icon: '⌔', tip: 'Fillet (F)'   },
    { id: 'CHAMFER', icon: '◰', tip: 'Chamfer (H)'  },
    { id: 'SHELL',   icon: '◱', tip: 'Shell (K)'    },
    { id: 'MEASURE', icon: '↔', tip: 'Measure (M)'  },
  ]},
]

/* ── CAD Object Mesh ── */
function CADObject({ obj, selected, onClick, onRef, onContextMenu: onCtx }) {
  const groupRef  = useRef(null)
  const [hovered, setHovered] = useState(false)
  const shadingMode    = useCADStore(s => s.shadingMode)
  const measureStart   = useCADStore(s => s.measureStart)
  const setMeasureStart   = useCADStore(s => s.setMeasureStart)
  const addAnnotation  = useCADStore(s => s.addAnnotation)
  const clearMeasureStart = useCADStore(s => s.clearMeasureStart)
  const { mode } = useTool()

  useEffect(() => {
    onRef?.(obj.id, groupRef.current)
    return () => onRef?.(obj.id, null)
  }, [obj.id])

  useFrame(({ clock }) => {
    if (groupRef.current && selected) {
      groupRef.current.position.y = obj.position[1] + Math.sin(clock.getElapsedTime() * 2.5) * 0.04
    }
  })

  if (obj.visible === false) return null

  const p = obj.params ?? {}

  // Render imported geometry from session cache, otherwise parametric JSX
  const importedGeo = obj.type === 'import' ? importGeometryCache.get(obj.id) : null
  const geo = importedGeo ? null : (() => {
    switch (obj.type) {
      case 'sphere':   return <sphereGeometry   args={[p.r ?? 0.5, 32, 32]} />
      case 'cylinder': return <cylinderGeometry args={[p.r ?? 0.5, p.r ?? 0.5, p.h ?? 1, 32]} />
      case 'cone':     return <coneGeometry     args={[p.r ?? 0.5, p.h ?? 1, 16]} />
      case 'torus':    return <torusGeometry    args={[p.r ?? 0.5, p.tube ?? 0.18, 16, 48]} />
      default:         return <boxGeometry      args={[p.w ?? 1, p.h ?? 1, p.d ?? 1]} />
    }
  })()

  const isWire = shadingMode === 'wireframe' || (shadingMode === 'solid' && (obj.wireframe ?? false))
  const isXray = shadingMode === 'xray'
  const isFlat = shadingMode === 'flat'

  const handleClick = (e) => {
    e.stopPropagation()
    if (mode === 'MEASURE') {
      // Measurement: capture two object centres and record distance
      if (!measureStart) {
        setMeasureStart({ objId: obj.id, position: [...obj.position] })
      } else if (measureStart.objId !== obj.id) {
        const [ax, ay, az] = measureStart.position
        const [bx, by, bz] = obj.position
        const dist = Math.sqrt((bx-ax)**2 + (by-ay)**2 + (bz-az)**2)
        const mid  = [(ax+bx)/2, (ay+by)/2, (az+bz)/2]
        addAnnotation({ type:'distance', from: measureStart.position, to: [...obj.position], mid, dist: dist.toFixed(3) })
        clearMeasureStart()
      }
    } else {
      onClick(obj.id)
    }
  }

  const matProps = isWire ? null : isXray
    ? { color: obj.color, transparent: true, opacity: 0.22, depthWrite: false, emissive: obj.color, emissiveIntensity: 0.55 }
    : { color: obj.color, metalness: 0.35, roughness: 0.3, emissive: obj.color,
        emissiveIntensity: selected ? 0.18 : hovered ? 0.12 : 0.03, flatShading: isFlat }

  return (
    <group
      ref={groupRef}
      position={obj.position}
      rotation={obj.rotation}
      scale={obj.scale}
      onClick={handleClick}
      onContextMenu={e => { e.stopPropagation(); onCtx?.(obj.id, e.nativeEvent) }}
      onPointerEnter={e => { e.stopPropagation(); setHovered(true);  document.body.style.cursor = mode === 'MEASURE' ? 'crosshair' : 'pointer' }}
      onPointerLeave={e => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto' }}
    >
      <mesh castShadow={!isXray} receiveShadow>
        {importedGeo
          ? <primitive object={importedGeo.clone()} attach="geometry" />
          : geo
        }
        {isWire
          ? <meshBasicMaterial color={obj.color} wireframe />
          : isXray
          ? <meshStandardMaterial {...matProps} />
          : <meshStandardMaterial {...matProps} />
        }
      </mesh>

      {/* Hover outline */}
      {!isWire && hovered && !selected && (
        <mesh>
          {importedGeo ? <primitive object={importedGeo.clone()} attach="geometry" /> : geo}
          <meshBasicMaterial color="#ff007a" wireframe transparent opacity={0.45} />
        </mesh>
      )}
      {/* Selection outline */}
      {!isWire && selected && (
        <mesh>
          {importedGeo ? <primitive object={importedGeo.clone()} attach="geometry" /> : geo}
          <meshBasicMaterial color={obj.color} wireframe transparent opacity={0.35} />
        </mesh>
      )}

      {/* Measure-start glow indicator */}
      {measureStart?.objId === obj.id && (
        <mesh>
          {importedGeo ? <primitive object={importedGeo.clone()} attach="geometry" /> : geo}
          <meshBasicMaterial color="#00F0FF" wireframe transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  )
}

/* ── Origin cross-hair (clean scene indicator) ── */
function OriginMarker() {
  return (
    <group>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.09, 0.12, 32]} />
        <meshBasicMaterial color="#c4b0ff" transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

/* ── Transform Gizmo (inside Canvas) ── */
function SelectionGizmo({ selectedRef, transformMode }) {
  const tcRef     = useRef(null)
  const { invalidate } = useThree()

  useEffect(() => {
    const tc = tcRef.current
    if (!tc) return
    const onStart = () => {
      const controls = tc.domElement?.__r3f?.orbitControls
      if (controls) controls.enabled = false
    }
    const onEnd = () => {
      const controls = tc.domElement?.__r3f?.orbitControls
      if (controls) controls.enabled = true
      invalidate()
    }
    tc.addEventListener('mouseDown', onStart)
    tc.addEventListener('mouseUp',   onEnd)
    return () => {
      tc.removeEventListener('mouseDown', onStart)
      tc.removeEventListener('mouseUp',   onEnd)
    }
  }, [invalidate])

  if (!selectedRef) return null
  return (
    <TransformControls
      ref={tcRef}
      object={selectedRef}
      mode={transformMode}
      size={0.8}
    />
  )
}

/* ── Smooth camera preset animator (inside Canvas) ── */
function CameraAnimator({ orbitRef }) {
  const { camera } = useThree()
  const cameraPreset    = useCADStore(s => s.cameraPreset)
  const clearCameraPreset = useCADStore(s => s.clearCameraPreset)
  const tPos  = useRef(null)
  const tLook = useRef(null)

  useEffect(() => {
    if (cameraPreset) {
      tPos.current  = new THREE.Vector3(...cameraPreset.pos)
      tLook.current = new THREE.Vector3(...cameraPreset.target)
    }
  }, [cameraPreset])

  useFrame(() => {
    if (!cameraPreset || !tPos.current) return
    camera.position.lerp(tPos.current, 0.1)
    if (orbitRef.current) {
      orbitRef.current.target.lerp(tLook.current, 0.1)
      orbitRef.current.update()
    }
    if (camera.position.distanceTo(tPos.current) < 0.08) {
      camera.position.copy(tPos.current)
      if (orbitRef.current) orbitRef.current.target.copy(tLook.current)
      clearCameraPreset()
      tPos.current = null
    }
  })
  return null
}

/* ── AI Generation mesh preview (inside Canvas) ── */
function GenerationMesh() {
  const status        = useAIGeneration(s => s.status)
  const progress      = useAIGeneration(s => s.progress)
  const objectsPlaced = useAIGeneration(s => s.objectsPlaced)
  const meshRef  = useRef(null)
  const groupRef = useRef(null)

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.25
  })

  // Hide once actual objects have been placed into the scene
  if (objectsPlaced) return null
  if (status !== 'generating' && status !== 'complete') return null

  const pct       = progress / 100
  const subdivs   = Math.max(1, Math.floor(pct * 5))
  const wireframe = progress < 70
  const opacity   = Math.min(1, pct * 1.8)
  const scale     = 0.4 + pct * 0.9

  return (
    <group ref={groupRef} position={[0, 1.5, 0]}>
      {/* Primary mesh — icosahedron refining as progress increases */}
      <mesh ref={meshRef} scale={scale}>
        <icosahedronGeometry args={[1.4, subdivs]} />
        <meshStandardMaterial
          color={wireframe ? '#00F0FF' : '#80e0ff'}
          wireframe={wireframe}
          opacity={opacity}
          transparent
          emissive="#00F0FF"
          emissiveIntensity={wireframe ? 0.4 : 0.08}
          roughness={0.15}
          metalness={0.85}
        />
      </mesh>

      {/* Scan ring */}
      {progress > 10 && progress < 95 && (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={scale * 1.35}>
          <ringGeometry args={[1.35, 1.42, 64]} />
          <meshBasicMaterial color="#00F0FF" opacity={0.35} transparent side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Point light pulse on completion */}
      {status === 'complete' && (
        <pointLight color="#00F0FF" intensity={1.6} distance={6} decay={2} />
      )}
    </group>
  )
}

/* ── In-scene annotation renderer ── */
function MeasurementRenderer() {
  const annotations = useCADStore(s => s.annotations)
  return (
    <>
      {annotations.filter(a => a.type === 'distance').map(a => (
        <group key={a.id}>
          <Line
            points={[a.from, a.to]}
            color="#00F0FF"
            lineWidth={1.5}
            dashed
            dashSize={0.12}
            gapSize={0.06}
          />
          <Html position={a.mid} center style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(8,9,14,0.88)', border: '1px solid rgba(0,240,255,0.45)',
              borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap',
              fontFamily: 'monospace', fontSize: '11px', color: '#00F0FF',
              backdropFilter: 'blur(8px)',
            }}>
              {a.dist} u
            </div>
          </Html>
          {/* endpoint dots */}
          {[a.from, a.to].map((pt, i) => (
            <mesh key={i} position={pt}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshBasicMaterial color="#00F0FF" />
            </mesh>
          ))}
        </group>
      ))}
      {annotations.filter(a => a.type === 'label').map(a => (
        <Html key={a.id} position={a.position} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(8,9,14,0.85)', border: '1px solid rgba(196,176,255,0.4)',
            borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap',
            fontFamily: 'monospace', fontSize: '11px', color: '#c4b0ff',
          }}>
            {a.text}
          </div>
        </Html>
      ))}
    </>
  )
}

/* ── Viewport scene ── */
function ViewportScene({ selectedId, onSelect, meshRefs, onObjectContextMenu }) {
  const showGrid  = useCADStore(s => s.showGrid)
  const showStats = useCADStore(s => s.showStats)
  const objects   = useCADStore(s => s.objects)
  const { mode, transformMode, setHoveredId } = useTool()
  const orbitRef = useRef(null)

  const selectedRef = selectedId ? meshRefs.current[selectedId] : null

  const handleRef = useCallback((id, el) => {
    if (el) meshRefs.current[id] = el
    else delete meshRefs.current[id]
  }, [])

  return (
    <>
      {/* ── Neural Bloom: Pastel Cyber Lighting ── */}
      <ambientLight intensity={0.28} color="#3020a0" />

      {/* Key — lavender overhead soft fill */}
      <directionalLight
        position={[6, 14, 8]}
        intensity={1.9}
        color="#b0a0f0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />

      {/* Fill — sakura side wash */}
      <directionalLight position={[-14, 8, -16]} intensity={0.6} color="#ff90c0" />

      {/* Rim — aqua depth from behind */}
      <directionalLight position={[2, -3, -12]} intensity={0.28} color="#60e8d8" />

      {/* Lavender point — emanates from origin */}
      <pointLight position={[0, 2, 0]} intensity={0.8} color="#c4a0ff" distance={14} decay={2} />

      {showGrid && (
        <Grid
          infiniteGrid
          fadeDistance={32}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#4a3888"
          sectionSize={2}
          sectionThickness={0.9}
          sectionColor="#c4b0ff"
          fadeStrength={2.2}
        />
      )}

      <OriginMarker />
      <MeasurementRenderer />

      {objects.map(obj => (
        <CADObject
          key={obj.id}
          obj={obj}
          selected={obj.id === selectedId}
          onClick={onSelect}
          onRef={handleRef}
          onContextMenu={onObjectContextMenu}
        />
      ))}

      {/* TransformControls gizmo for selected object in SELECT mode */}
      {mode === 'SELECT' && selectedId && (
        <SelectionGizmo selectedRef={selectedRef} transformMode={transformMode} />
      )}

      <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
        <GizmoViewport axisColors={['#ff4444', '#44ff44', '#4488ff']} labelColor="white" hideNegativeAxes />
      </GizmoHelper>

      {showStats && <Stats />}

      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={0.28} luminanceSmoothing={0.75} mipmapBlur />
      </EffectComposer>

      <CameraAnimator orbitRef={orbitRef} />
      <GenerationMesh />
      <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.08} />
    </>
  )
}

/* ── Ribbon helpers ── */
function RibbonGroup({ title, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', padding:'4px 8px 0', borderRight:'1px solid rgba(196,176,255,0.09)', minWidth:0, flexShrink:0 }}>
      <div style={{ flex:1, display:'flex', alignItems:'flex-start', gap:2, paddingBottom:2, flexWrap:'wrap' }}>{children}</div>
      <div style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontSize:'0.47rem', letterSpacing:'0.13em', color:'rgba(128,112,184,0.42)', textTransform:'uppercase', padding:'2px 0', borderTop:'1px solid rgba(196,176,255,0.07)', marginTop:2, whiteSpace:'nowrap' }}>{title}</div>
    </div>
  )
}

function RibbonBtn({ icon, label, active, onClick, large = false, tip, color, disabled }) {
  const [hov, setHov] = useState(false)
  const bg  = active ? 'rgba(196,176,255,0.16)' : hov ? 'rgba(196,176,255,0.09)' : 'transparent'
  const col = disabled ? 'var(--text-dim)' : active ? 'var(--cyan)' : hov ? 'var(--lavender-bright)' : color ?? 'var(--text-secondary)'
  const bdr = active ? '1px solid rgba(196,176,255,0.28)' : '1px solid transparent'

  if (large) {
    return (
      <button onClick={disabled ? undefined : onClick} title={tip ?? label}
        onMouseEnter={() => !disabled && setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, padding:'4px 6px 2px', background:bg, border:bdr, borderRadius:2, cursor:disabled?'not-allowed':'pointer', minWidth:42, height:60, transition:'all 100ms', boxShadow:active?'0 0 8px rgba(196,176,255,0.14)':'none', opacity:disabled?0.35:1 }}
      >
        <span style={{ fontSize:'1.2rem', color:col, lineHeight:1 }}>{icon}</span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.48rem', color:col, letterSpacing:'0.07em', textTransform:'uppercase', whiteSpace:'nowrap', textAlign:'center', lineHeight:1.2 }}>{label}</span>
      </button>
    )
  }
  return (
    <button onClick={disabled ? undefined : onClick} title={tip ?? label}
      onMouseEnter={() => !disabled && setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px', background:bg, border:bdr, borderRadius:2, cursor:disabled?'not-allowed':'pointer', height:22, transition:'all 100ms', whiteSpace:'nowrap', opacity:disabled?0.35:1 }}
    >
      <span style={{ fontSize:'0.82rem', color:col, lineHeight:1 }}>{icon}</span>
      {label && <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.53rem', color:col, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</span>}
    </button>
  )
}

/* ── AutoCAD-style Ribbon (replaces TopBar) ── */
function Ribbon({ onTechDrawing, onProfile, selectedId }) {
  const { activeMode, setMode, showGrid, toggleGrid, snapEnabled, toggleSnap, orthoMode, toggleOrtho, toggleStats,
          shadingMode, setShadingMode, showTree, toggleTree, setCameraPreset, xp, xpMax, level, objects,
          studioMode, setStudioMode, clearAnnotations, duplicateObject, removeObject, updateObject } = useCADStore()
  const { canUndo, canRedo, undo, redo, historyCount } = useUndoRedo()
  const { mode, setMode: setToolMode, transformMode, setTransformMode } = useTool()
  const { user } = useAuthStore()
  const { newFile, openFile, saveFile, saveAs, exportSTL, exportOBJ, exportSTEP, importSTL, importOBJ } = useFileOperations()
  const { execute } = useCADHistory()
  const objectCount = objects.length
  const xpPct = Math.round((xp / xpMax) * 100)
  const selectedObj = selectedId ? objects.find(o => o.id === selectedId) : null
  const projectTitle    = useGitStore(s => s.projectTitle)
  const loadingProject  = useGitStore(s => s.loadingProject)

  const [activeTab, setActiveTab] = useState('Home')
  const [openMenu,  setOpenMenu]  = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    const h = e => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'n') { e.preventDefault(); newFile() }
      if (e.key === 'o') { e.preventDefault(); openFile() }
      if (e.key === 's' && !e.shiftKey) { e.preventDefault(); saveFile() }
      if (e.key === 's' &&  e.shiftKey) { e.preventDefault(); saveAs() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [newFile, openFile, saveFile, saveAs])

  const addShape = useCallback((type, color) => {
    const spread = (objectCount % 6) - 2.5
    execute(addObjectCmd({ type, color, position: [spread * 2, 0.6, -(Math.floor(objectCount / 6)) * 2] }))
  }, [execute, objectCount])

  const FILE_ITEMS = [
    { label: 'New File',    shortcut: 'Ctrl+N',  onClick: newFile },
    { label: 'Open…',       shortcut: 'Ctrl+O',  onClick: openFile },
    { label: 'Save',        shortcut: 'Ctrl+S',  onClick: () => saveFile() },
    { label: 'Save As…',    shortcut: '⇧Ctrl+S', onClick: saveAs },
    { type: 'divider' },
    { label: 'Export STL',  onClick: exportSTL },
    { label: 'Export STEP', onClick: exportSTEP },
    { label: 'Export OBJ',  onClick: exportOBJ },
    { type: 'divider' },
    { label: 'Close',       shortcut: 'Ctrl+W', onClick: () => window.close() },
  ]

  const TABS = ['Home', 'Insert', 'Modify', 'Annotate', 'View', 'Manage', 'Output']

  const tabContent = () => {
    switch (activeTab) {
      case 'Home': return (
        <>
          <RibbonGroup title="Primitives">
            {[['□','Box','box','#00e5ff'],['○','Sphere','sphere','#e040fb'],['⊡','Cyl','cylinder','#ffd740'],['△','Cone','cone','#69ff47'],['◎','Torus','torus','#ff6688']].map(([icon, label, type, color]) => (
              <RibbonBtn key={type} icon={icon} label={label} onClick={() => addShape(type, color)} large tip={`Add ${type}`} />
            ))}
          </RibbonGroup>
          <RibbonGroup title="Draw 2D">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {[['⌒','PLINE','POLYLINE'],['○','CIRCLE','CIRCLE'],['◠','ARC','ARC']].map(([icon, label, m]) => (
                <RibbonBtn key={m} icon={icon} label={label} active={mode===m} onClick={() => setToolMode(m)} />
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {[['□','RECT','RECT'],['〜','SPLINE','SPLINE'],['⬡','POLY','POLYGON']].map(([icon, label, m]) => (
                <RibbonBtn key={m} icon={icon} label={label} active={mode===m} onClick={() => setToolMode(m)} />
              ))}
            </div>
          </RibbonGroup>
          <RibbonGroup title="Solids">
            {[['⬆','EXT','EXTRUDE'],['↻','REV','REVOLVE'],['⤸','SWEEP','SWEEP'],['◇','LOFT','LOFT'],['⊕','BOOL','BOOLEAN']].map(([icon, label, m]) => (
              <RibbonBtn key={m} icon={icon} label={label} active={mode===m} onClick={() => setToolMode(m)} large />
            ))}
          </RibbonGroup>
          <RibbonGroup title="Modify">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {[['⌔','FILLET','FILLET'],['◰','CHAMFER','CHAMFER'],['◱','SHELL','SHELL'],['↔','MEASURE','MEASURE']].map(([icon, label, m]) => (
                <RibbonBtn key={m} icon={icon} label={label} active={mode===m} onClick={() => setToolMode(m)} />
              ))}
            </div>
          </RibbonGroup>
          <RibbonGroup title="Transform">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {[['↕','MOVE','translate'],['↻','ROT','rotate'],['⤢','SCALE','scale']].map(([icon, label, m]) => (
                <RibbonBtn key={m} icon={icon} label={label} active={transformMode===m} onClick={() => { setToolMode('SELECT'); setTransformMode(m) }} />
              ))}
            </div>
          </RibbonGroup>
          <RibbonGroup title="Layer">
            <div style={{ display:'flex', flexDirection:'column', gap:4, justifyContent:'center', height:60 }}>
              <div style={{ background:'var(--bg-void)', border:'1px solid var(--border-subtle)', borderRadius:2, padding:'3px 8px', fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:5, cursor:'pointer', minWidth:110 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#00e5ff', boxShadow:'0 0 4px #00e5ff80', flexShrink:0 }} />
                <span style={{ flex:1 }}>Default</span>
                <span style={{ opacity:0.4 }}>▾</span>
              </div>
              <RibbonBtn icon="⊞" label="Layers" onClick={() => {}} tip="Layer Manager" />
            </div>
          </RibbonGroup>
          <RibbonGroup title="Mode">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <RibbonBtn icon="⬡" label="3D" active={activeMode==='3d'} onClick={() => setMode('3d')} />
              <RibbonBtn icon="□" label="2D" active={activeMode==='2d'} onClick={() => setMode('2d')} />
              <RibbonBtn icon="📐" label="Draft" onClick={onTechDrawing} tip="2D Technical Drawing" />
            </div>
          </RibbonGroup>
        </>
      )
      case 'View': return (
        <>
          <RibbonGroup title="Navigate">
            {Object.entries(CAMERA_PRESETS).map(([label, preset]) => (
              <RibbonBtn key={label} icon="⊹" label={label} onClick={() => setCameraPreset(preset)} large tip={`${label} view`} />
            ))}
          </RibbonGroup>
          <RibbonGroup title="Display">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <RibbonBtn icon="⊞" label="Grid"  active={showGrid}    onClick={toggleGrid}  />
              <RibbonBtn icon="◆" label="Snap"  active={snapEnabled} onClick={toggleSnap}  />
              <RibbonBtn icon="⊥" label="Ortho" active={orthoMode}   onClick={toggleOrtho} />
              <RibbonBtn icon="⊙" label="Stats" active={false}        onClick={toggleStats} />
            </div>
          </RibbonGroup>
          <RibbonGroup title="Shade">
            {[['▣','Solid','solid'],['⬡','Wire','wireframe'],['◈','X-Ray','xray'],['▪','Flat','flat']].map(([icon, label, m]) => (
              <RibbonBtn key={m} icon={icon} label={label} active={shadingMode===m} onClick={() => setShadingMode(m)} large tip={`${label} shading`} />
            ))}
          </RibbonGroup>
          <RibbonGroup title="Panels">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <RibbonBtn icon="⬡" label="Tree"  active={showTree} onClick={toggleTree}    tip="Feature Tree" />
              <RibbonBtn icon="▦" label="Ruler"  onClick={() => {}}                       tip="Ruler" />
            </div>
          </RibbonGroup>
        </>
      )
      case 'Manage': return (
        <>
          <RibbonGroup title="History">
            <RibbonBtn icon="↩" label={`Undo${historyCount > 0 ? ` (${historyCount})` : ''}`} active={canUndo} disabled={!canUndo} onClick={undo} large tip="Undo (Ctrl+Z)" />
            <RibbonBtn icon="↪" label="Redo" active={canRedo} disabled={!canRedo} onClick={redo} large tip="Redo (Ctrl+Y)" />
          </RibbonGroup>
          <RibbonGroup title="File">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <RibbonBtn icon="📄" label="New"  onClick={newFile}  tip="New (Ctrl+N)" />
              <RibbonBtn icon="📂" label="Open" onClick={openFile} tip="Open (Ctrl+O)" />
              <RibbonBtn icon="💾" label="Save" onClick={() => saveFile()} tip="Save (Ctrl+S)" />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <RibbonBtn icon="📋" label="Save As" onClick={saveAs}    tip="Save As (⇧Ctrl+S)" />
              <RibbonBtn icon="◬"  label="STL"     onClick={exportSTL} tip="Export STL" />
              <RibbonBtn icon="◬"  label="OBJ"     onClick={exportOBJ} tip="Export OBJ" />
            </div>
          </RibbonGroup>
        </>
      )
      case 'Insert': return (
        <>
          <RibbonGroup title="Primitives">
            {[['□','Box','box','#00e5ff'],['○','Sphere','sphere','#e040fb'],['⊡','Cyl','cylinder','#ffd740'],['△','Cone','cone','#69ff47'],['◎','Torus','torus','#ff6688']].map(([icon, label, type, color]) => (
              <RibbonBtn key={type} icon={icon} label={label} onClick={() => addShape(type, color)} large tip={`Add ${type}`} />
            ))}
          </RibbonGroup>
          <RibbonGroup title="Import Mesh">
            <RibbonBtn icon="⬆" label="STL" onClick={importSTL} large tip="Import STL mesh" />
            <RibbonBtn icon="⬆" label="OBJ" onClick={importOBJ} large tip="Import OBJ mesh" />
          </RibbonGroup>
        </>
      )
      case 'Modify': return (
        <>
          <RibbonGroup title="Transform">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {[['↕','Move','translate'],['↻','Rot','rotate'],['⤢','Scale','scale']].map(([icon, label, m]) => (
                <RibbonBtn key={m} icon={icon} label={label} disabled={!selectedId}
                  active={transformMode===m && !!selectedId}
                  onClick={() => { setToolMode('SELECT'); setTransformMode(m) }} />
              ))}
            </div>
          </RibbonGroup>
          <RibbonGroup title="Mirror">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {[['↔','Mirror X',0],['↕','Mirror Y',1],['⇅','Mirror Z',2]].map(([icon, label, axis]) => (
                <RibbonBtn key={axis} icon={icon} label={label} disabled={!selectedObj}
                  onClick={() => {
                    if (!selectedObj) return
                    const s = [...(selectedObj.scale ?? [1,1,1])]
                    s[axis] *= -1
                    execute(changePropertyCmd(selectedId, 'scale', s))
                  }} />
              ))}
            </div>
          </RibbonGroup>
          <RibbonGroup title="Array">
            <RibbonBtn icon="⊞" label="Linear×3" large disabled={!selectedObj}
              tip="Create 3 copies along X axis"
              onClick={() => {
                if (!selectedObj) return
                for (let i = 1; i <= 3; i++) {
                  const p = [...(selectedObj.position ?? [0,0,0])]
                  p[0] += i * 2
                  execute(addObjectCmd({ ...selectedObj, id: undefined, position: p, createdAt: undefined }))
                }
              }} />
          </RibbonGroup>
          <RibbonGroup title="Align">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <RibbonBtn icon="⊙" label="To Origin" disabled={!selectedObj}
                onClick={() => {
                  if (!selectedObj) return
                  execute(changePropertyCmd(selectedId, 'position', [0, selectedObj.position?.[1] ?? 0.5, 0]))
                }} />
              <RibbonBtn icon="⊟" label="Center Y" disabled={!selectedObj}
                onClick={() => {
                  if (!selectedObj) return
                  const p = selectedObj.position ?? [0,0,0]
                  execute(changePropertyCmd(selectedId, 'position', [p[0], 0, p[2]]))
                }} />
              <RibbonBtn icon="⊞" label="Reset Scale" disabled={!selectedObj}
                onClick={() => {
                  if (!selectedObj) return
                  execute(changePropertyCmd(selectedId, 'scale', [1,1,1]))
                }} />
            </div>
          </RibbonGroup>
          <RibbonGroup title="Boolean">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <RibbonBtn icon="⊕" label="Union"     active={mode==='BOOLEAN'} disabled={!selectedId} onClick={() => setToolMode('BOOLEAN')} />
              <RibbonBtn icon="⊖" label="Subtract"  active={mode==='BOOLEAN'} disabled={!selectedId} onClick={() => setToolMode('BOOLEAN')} />
              <RibbonBtn icon="⊗" label="Intersect" active={mode==='BOOLEAN'} disabled={!selectedId} onClick={() => setToolMode('BOOLEAN')} />
            </div>
          </RibbonGroup>
          {!selectedId && (
            <div style={{ display:'flex', alignItems:'center', padding:'0 14px', fontFamily:'var(--font-mono)', fontSize:'0.55rem', color:'var(--text-dim)', letterSpacing:'0.07em', flex:1 }}>
              ← Select an object to enable modify tools
            </div>
          )}
        </>
      )
      case 'Annotate': return (
        <>
          <RibbonGroup title="Measure">
            <RibbonBtn icon="↔" label="Distance" large active={mode==='MEASURE'} tip="Click two objects to measure distance (M)"
              onClick={() => setToolMode(mode === 'MEASURE' ? 'SELECT' : 'MEASURE')} />
          </RibbonGroup>
          <RibbonGroup title="Callout">
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <RibbonBtn icon="✎" label="Text" tip="Add text callout" onClick={() => setToolMode('TEXT')} />
              <RibbonBtn icon="→" label="Leader" tip="Add leader line" onClick={() => setToolMode('LEADER')} />
            </div>
          </RibbonGroup>
          <RibbonGroup title="Clear">
            <RibbonBtn icon="✕" label="Clear All" large tip="Remove all annotations and measurements"
              onClick={() => { if (window.confirm('Clear all annotations?')) clearAnnotations() }} />
          </RibbonGroup>
          {mode === 'MEASURE' && (
            <div style={{ display:'flex', alignItems:'center', padding:'0 14px', fontFamily:'var(--font-mono)', fontSize:'0.55rem', color:'var(--cyan)', letterSpacing:'0.07em', flex:1 }}>
              ✦ MEASURE — click first object, then second
            </div>
          )}
        </>
      )
      default: return (
        <div style={{ display:'flex', alignItems:'center', padding:'0 20px', height:68, fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)', letterSpacing:'0.1em' }}>
          {activeTab.toUpperCase()} — COMING SOON
        </div>
      )
    }
  }

  return (
    <div style={{ background:'var(--bg-base)', borderBottom:'1px solid var(--border-subtle)', userSelect:'none' }}>

      {/* ── Row 1: App menu + Quick Access Toolbar + Tab bar + user ── */}
      <div style={{ height:30, display:'flex', alignItems:'center', background:'var(--bg-void)', borderBottom:'1px solid rgba(196,176,255,0.07)', padding:'0 6px', gap:0 }}>

        {/* App menu (diamond logo button → File dropdown) */}
        <div ref={menuRef} style={{ position:'relative', marginRight:8 }}>
          <button onClick={() => setOpenMenu(p => p ? null : 'file')}
            style={{ width:24, height:24, borderRadius:2, background:openMenu?'var(--lavender-dim)':'var(--bg-elevated)', border:`1px solid ${openMenu?'var(--border-active)':'var(--border-default)'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, boxShadow:'0 0 8px rgba(196,176,255,0.12)' }}
          >
            <div style={{ width:11, height:11, background:'linear-gradient(135deg,#c4b0ff,#ffadd4)', clipPath:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)' }} />
          </button>
          <AnimatePresence>
            {openMenu === 'file' && <MenuDropdown items={FILE_ITEMS} onClose={() => setOpenMenu(null)} />}
          </AnimatePresence>
        </div>

        {/* QAT: Save | Undo | Redo */}
        <div style={{ display:'flex', alignItems:'center', gap:1, paddingRight:10, borderRight:'1px solid rgba(196,176,255,0.08)', marginRight:8 }}>
          {[['💾','Save (Ctrl+S)', () => saveFile(), true],
            ['↩', `Undo (Ctrl+Z)`, undo, canUndo],
            ['↪', 'Redo (Ctrl+Y)', redo, canRedo],
          ].map(([icon, tip, action, enabled]) => (
            <button key={tip} onClick={enabled ? action : undefined} title={tip}
              style={{ width:22, height:22, background:'none', border:'none', color:enabled?'var(--text-secondary)':'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:'0.75rem', cursor:enabled?'pointer':'default', borderRadius:2, transition:'all 100ms', display:'flex', alignItems:'center', justifyContent:'center' }}
              onMouseEnter={e => { if (enabled) { e.currentTarget.style.background='var(--lavender-dim)'; e.currentTarget.style.color='var(--cyan)' } }}
              onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color=enabled?'var(--text-secondary)':'var(--text-dim)' }}
            >{icon}</button>
          ))}
        </div>

        {/* Project breadcrumb — only shown when a project is loaded */}
        {(projectTitle || loadingProject) && (
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'0 10px', borderRight:'1px solid rgba(196,176,255,0.08)', marginRight:8, flexShrink:0 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'var(--text-dim)', letterSpacing:'0.06em' }}>⌂</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'var(--text-dim)', letterSpacing:'0.04em' }}>/</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color: loadingProject ? 'var(--text-dim)' : 'var(--lavender-bright)', letterSpacing:'0.04em', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {loadingProject ? '…' : projectTitle}
            </span>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display:'flex', flex:1, height:'100%' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ height:'100%', padding:'0 11px', background:activeTab===tab?'var(--bg-base)':'none', border:'none', borderBottom:activeTab===tab?'2px solid var(--cyan)':'2px solid transparent', color:activeTab===tab?'var(--cyan)':'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:600, fontSize:'0.62rem', letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', transition:'all 130ms', flexShrink:0 }}
              onMouseEnter={e => { if (activeTab !== tab) { e.currentTarget.style.color='var(--lavender-bright)'; e.currentTarget.style.background='rgba(196,176,255,0.05)' } }}
              onMouseLeave={e => { if (activeTab !== tab) { e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.background='none' } }}
            >{tab}</button>
          ))}
        </div>

        {/* Studio Mode Switcher */}
        <div style={{ display:'flex', alignItems:'center', gap:3, padding:'0 10px', borderLeft:'1px solid rgba(196,176,255,0.08)', borderRight:'1px solid rgba(196,176,255,0.08)', marginRight:8, flexShrink:0 }}>
          {[
            { id:'cad',       label:'CAD',    icon:'⬡', color:'var(--cyan)' },
            { id:'ai3d',      label:'AI 3D',  icon:'✦', color:'#00F0FF' },
            { id:'gendesign', label:'GEN',    icon:'⬢', color:'#8B5CF6' },
          ].map(({ id, label, icon, color }) => (
            <button key={id} onClick={() => setStudioMode(id)}
              title={{ cad:'CAD Studio', ai3d:'AI 3D Generator', gendesign:'Generative Design' }[id]}
              style={{
                height:20, padding:'0 8px', border:'none', borderRadius:3, cursor:'pointer',
                background: studioMode===id ? `rgba(${id==='ai3d'?'0,240,255':id==='gendesign'?'139,92,246':'196,176,255'},0.15)` : 'transparent',
                color: studioMode===id ? color : 'var(--text-secondary)',
                fontFamily:'var(--font-mono)', fontSize:'0.58rem', letterSpacing:'0.07em', fontWeight:600,
                transition:'all 130ms', display:'flex', alignItems:'center', gap:4,
                boxShadow: studioMode===id ? `0 0 8px rgba(${id==='ai3d'?'0,240,255':id==='gendesign'?'139,92,246':'196,176,255'},0.25)` : 'none',
              }}
            >
              <span style={{ fontSize:'0.65rem' }}>{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* Right: Multiplayer + XP + Profile */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <MultiplayerHUD />
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.54rem', color:'var(--gold)' }}>L{level}</span>
            <div style={{ width:56, height:3, background:'var(--bg-elevated)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ width:`${xpPct}%`, height:'100%', background:'linear-gradient(90deg,var(--lavender),var(--sakura))', borderRadius:2 }} />
            </div>
          </div>
          <motion.button onClick={onProfile} whileHover={{ scale:1.1 }} whileTap={{ scale:0.95 }}
            style={{ width:20, height:20, borderRadius:'50%', background:user?'linear-gradient(135deg,#c4b0ff,#ffadd4)':'var(--bg-elevated)', border:user?'1px solid var(--border-active)':'1px dashed var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-ui)', fontSize:'0.58rem', color:user?'var(--bg-void)':'var(--text-dim)', fontWeight:700, cursor:'pointer' }}
            title={user ? `${user.displayName || user.username}` : 'Sign in'}
          >{user ? (user.displayName || user.username || '?')[0].toUpperCase() : '?'}</motion.button>
        </div>
      </div>

      {/* ── Row 2: Ribbon content ── */}
      <div style={{ height:78, display:'flex', alignItems:'stretch', background:'var(--bg-base)', overflowX:'auto', overflowY:'hidden', scrollbarWidth:'none' }}>
        {tabContent()}
      </div>
    </div>
  )
}

/* ── Model/Layout tabs ── */
function ModelTabs() {
  const [active, setActive] = useState('Model')
  return (
    <div style={{ height:26, background:'var(--bg-void)', borderTop:'1px solid rgba(196,176,255,0.08)', display:'flex', alignItems:'center', paddingLeft:4 }}>
      {['Model','Layout1','Layout2'].map(tab => (
        <button key={tab} onClick={() => setActive(tab)}
          style={{ height:'100%', padding:'0 11px', background:active===tab?'var(--bg-base)':'none', border:'none', borderTop:active===tab?'2px solid var(--cyan)':'2px solid transparent', color:active===tab?'var(--cyan)':'var(--text-secondary)', fontFamily:'var(--font-mono)', fontSize:'0.55rem', letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', transition:'all 130ms', flexShrink:0 }}
        >{tab}</button>
      ))}
      <button style={{ height:'100%', padding:'0 8px', background:'none', border:'none', color:'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:'0.7rem', cursor:'pointer' }} title="New layout">+</button>
    </div>
  )
}

/* ── AutoCAD-style Command Line ── */
function CommandLine() {
  const [history, setHistory] = useState([
    { t:'sys', s:'TOFU CAD Studio — Neural Forge Engine ready.' },
    { t:'hint', s:'Commands: BOX SPHERE CYL CONE TORUS CIRCLE ARC RECT EXT FILLET UNDO REDO HELP' },
  ])
  const [input, setInput] = useState('')
  const histRef = useRef(null)
  const { execute } = useCADHistory()
  const { undo, redo } = useUndoRedo()
  const { setMode: setToolMode } = useTool()
  const objectCount = useCADStore(s => s.objects.length)

  useEffect(() => { if (histRef.current) histRef.current.scrollTop = histRef.current.scrollHeight }, [history])

  const push = (s, t = 'out') => setHistory(prev => [...prev.slice(-30), { t, s }])

  const run = useCallback((raw) => {
    const cmd = raw.trim().toUpperCase()
    const [verb] = cmd.split(/\s+/)
    push(`> ${raw}`, 'in')
    const spread = (objectCount % 6) - 2.5
    const pos = [spread * 2, 0.6, -(Math.floor(objectCount / 6)) * 2]
    const shapes = { BOX:'box', SPHERE:'sphere', CYL:'cylinder', CYLINDER:'cylinder', CONE:'cone', TORUS:'torus', TOR:'torus' }
    const colors  = { box:'#00e5ff', sphere:'#e040fb', cylinder:'#ffd740', cone:'#69ff47', torus:'#ff6688' }
    const tools   = { LINE:'POLYLINE', PL:'POLYLINE', CIRCLE:'CIRCLE', C:'CIRCLE', ARC:'ARC', A:'ARC', RECT:'RECT', REC:'RECT', SPLINE:'SPLINE', EXT:'EXTRUDE', EXTRUDE:'EXTRUDE', FILLET:'FILLET', F:'FILLET', CHAMFER:'CHAMFER', SHELL:'SHELL', MEASURE:'MEASURE', M:'MEASURE', BOOLEAN:'BOOLEAN' }
    if (shapes[verb]) { execute(addObjectCmd({ type: shapes[verb], color: colors[shapes[verb]], position: pos })); push(`${shapes[verb]} added.`) }
    else if (tools[verb]) { setToolMode(tools[verb]); push(`${tools[verb]} tool active.`) }
    else if (verb === 'UNDO' || verb === 'U') { undo(); push('Undo.') }
    else if (verb === 'REDO') { redo(); push('Redo.') }
    else if (verb === 'ESC' || verb === 'ESCAPE') { setToolMode('SELECT'); push('Select mode.') }
    else if (verb === 'ZOOM' || verb === 'Z') push('Use scroll wheel or View → Navigate.')
    else if (verb === 'HELP' || verb === '?') push('BOX SPHERE CYL CONE TORUS LINE CIRCLE ARC RECT EXT FILLET UNDO REDO ESC CLEAR')
    else if (verb === 'CLEAR') setHistory([])
    else if (verb) push(`Unknown: "${verb}". Type HELP.`, 'err')
  }, [execute, undo, redo, setToolMode, objectCount])

  return (
    <div style={{ background:'var(--bg-void)', borderTop:'1px solid rgba(196,176,255,0.08)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div ref={histRef} style={{ flex:1, overflowY:'auto', padding:'3px 12px', scrollbarWidth:'thin' }}>
        {history.map((item, i) => (
          <div key={i} style={{ fontFamily:'var(--font-mono)', fontSize:'0.63rem', lineHeight:1.65, color: item.t==='in'?'var(--cyan)':item.t==='err'?'var(--error)':item.t==='hint'?'var(--text-dim)':'var(--text-secondary)' }}>{item.s}</div>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', padding:'4px 12px', borderTop:'1px solid rgba(196,176,255,0.06)', flexShrink:0, gap:8 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:'var(--cyan)', flexShrink:0 }}>Command:</span>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { run(input); setInput('') } if (e.key === 'Escape') { setToolMode('SELECT'); setInput('') } }}
          placeholder="Enter command…"
          style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:'0.68rem', caretColor:'var(--cyan)' }}
        />
      </div>
    </div>
  )
}

/* ── Crosshair overlay ── */
function CrosshairOverlay({ pos }) {
  if (!pos) return null
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:5 }}>
      <div style={{ position:'absolute', left:0, right:0, top:pos.y - 0.5, height:1, background:'rgba(196,176,255,0.28)' }} />
      <div style={{ position:'absolute', top:0, bottom:0, left:pos.x - 0.5, width:1, background:'rgba(196,176,255,0.28)' }} />
      <div style={{ position:'absolute', left:pos.x - 6, top:pos.y - 6, width:12, height:12, border:'1px solid rgba(196,176,255,0.5)', background:'transparent' }} />
    </div>
  )
}

/* ── Dropdown Menu ── */
function MenuDropdown({ items, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        top: 'calc(100% + 2px)',
        left: 0,
        minWidth: 210,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 4,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px var(--border-subtle), 0 0 24px rgba(196,176,255,0.06)',
        backdropFilter: 'blur(20px)',
        zIndex: 1000,
        padding: '4px 0',
        overflow: 'hidden',
      }}
    >
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return <div key={i} style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
        }
        if (item.type === 'label') {
          return (
            <div key={i} style={{ padding: '5px 12px 3px', fontFamily: 'var(--font-mono)', fontSize: '0.52rem', letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              {item.label}
            </div>
          )
        }
        const disabled = item.disabled === true
        return (
          <button
            key={i}
            onClick={() => { if (!disabled && item.onClick) { item.onClick(); onClose() } }}
            disabled={disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '0 12px',
              height: 30,
              background: 'none', border: 'none',
              fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 400,
              color: disabled ? 'var(--text-dim)' : 'var(--text-primary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left', transition: 'background 100ms, color 100ms',
              opacity: disabled ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--lavender-dim)'; e.currentTarget.style.color = 'var(--lavender-bright)' } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = disabled ? 'var(--text-dim)' : 'var(--text-primary)' }}
          >
            {/* Check / icon slot */}
            <span style={{ width: 14, flexShrink: 0, textAlign: 'center', fontSize: '0.7rem', color: 'var(--cyan)' }}>
              {item.checked === true ? '✓' : item.icon || ''}
            </span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', marginLeft: 16 }}>
                {item.shortcut}
              </span>
            )}
          </button>
        )
      })}
    </motion.div>
  )
}

/* ── Camera view presets ── */
const CAMERA_PRESETS = {
  ISO:   { pos: [6, 5, 8],      target: [0, 0, 0] },
  TOP:   { pos: [0, 14, 0.01],  target: [0, 0, 0] },
  FRONT: { pos: [0, 0, 14],     target: [0, 0, 0] },
  RIGHT: { pos: [14, 0, 0],     target: [0, 0, 0] },
  BACK:  { pos: [0, 0, -14],    target: [0, 0, 0] },
  LEFT:  { pos: [-14, 0, 0],    target: [0, 0, 0] },
}

function ViewCube({ onPreset }) {
  return (
    <div style={{
      position: 'absolute', top: 56, right: 12,
      display: 'flex', flexDirection: 'column', gap: 2,
      zIndex: 15, pointerEvents: 'all',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', letterSpacing: '0.14em', color: 'var(--text-dim)', textAlign: 'center', marginBottom: 3, textTransform: 'uppercase' }}>View</div>
      {Object.entries(CAMERA_PRESETS).map(([label, preset]) => (
        <button
          key={label}
          onClick={() => onPreset(preset)}
          style={{
            width: 46, height: 22,
            background: 'rgba(6,6,18,0.82)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.1em',
            cursor: 'pointer', borderRadius: 2, backdropFilter: 'blur(10px)',
            transition: 'all 110ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--lavender-dim)'; e.currentTarget.style.color = 'var(--cyan)'; e.currentTarget.style.borderColor = 'var(--border-active)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(6,6,18,0.82)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
        >{label}</button>
      ))}
    </div>
  )
}

/* ── Feature Tree Panel ── */
function FeatureTreePanel({ selectedId, onSelect }) {
  const { objects, renameObject, duplicateObject, toggleObjectVisibility } = useCADStore()
  const { execute } = useCADHistory()
  const [contextMenu, setContextMenu] = useState(null)
  const [renaming,    setRenaming]    = useState(null)
  const [editName,    setEditName]    = useState('')

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [contextMenu])

  const startRename = (obj) => {
    setRenaming(obj.id)
    setEditName(obj.name || obj.type)
    setContextMenu(null)
  }
  const commitRename = () => {
    if (renaming && editName.trim()) renameObject(renaming, editName.trim())
    setRenaming(null)
  }

  const typeIcon = (type) => ({ sphere: '○', cylinder: '⊡', cone: '△', torus: '◎' }[type] ?? '□')

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '7px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>⬡ Tree</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>{objects.length}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '3px' }}>
        {objects.length === 0 && (
          <div style={{ padding: '18px 6px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)', lineHeight: 2 }}>
            NO OBJECTS<br /><span style={{ fontSize: '0.52rem' }}>Add shapes below ↓</span>
          </div>
        )}
        {objects.map(obj => (
          <div
            key={obj.id}
            onClick={() => onSelect(obj.id === selectedId ? null : obj.id)}
            onContextMenu={e => { e.preventDefault(); setContextMenu({ id: obj.id, x: e.clientX, y: e.clientY }) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 5px', marginBottom: 1,
              background: selectedId === obj.id ? 'var(--lavender-dim)' : 'transparent',
              border: `1px solid ${selectedId === obj.id ? 'var(--border-active)' : 'transparent'}`,
              borderRadius: 3, cursor: 'pointer',
              opacity: obj.visible === false ? 0.35 : 1,
              transition: 'all 110ms',
            }}
            onMouseEnter={e => { if (selectedId !== obj.id) e.currentTarget.style.background = 'var(--bg-elevated)' }}
            onMouseLeave={e => { if (selectedId !== obj.id) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ color: obj.color, fontSize: '0.65rem', width: 13, textAlign: 'center', flexShrink: 0 }}>{typeIcon(obj.type)}</span>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: obj.color, flexShrink: 0 }} />
            {renaming === obj.id ? (
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }}
                autoFocus
                onClick={e => e.stopPropagation()}
                style={{ flex: 1, background: 'var(--bg-void)', border: '1px solid var(--border-active)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: '0.68rem', padding: '1px 3px', borderRadius: 2, outline: 'none', minWidth: 0 }}
              />
            ) : (
              <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {obj.name || obj.type}
              </span>
            )}
            <button
              onClick={e => { e.stopPropagation(); toggleObjectVisibility(obj.id) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', fontSize: '0.6rem', color: obj.visible === false ? 'var(--text-dim)' : 'var(--text-secondary)', flexShrink: 0 }}
              title="Toggle visibility"
            >{obj.visible === false ? '○' : '◉'}</button>
          </div>
        ))}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            onMouseDown={e => e.stopPropagation()}
            style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '4px 0', zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', minWidth: 152 }}
          >
            {[
              { label: 'Rename',    action: () => { const o = objects.find(x => x.id === contextMenu.id); if (o) startRename(o) } },
              { label: 'Duplicate', action: () => { duplicateObject(contextMenu.id); setContextMenu(null) } },
              null,
              { label: 'Delete', color: '#ff6688', action: () => { execute(deleteObjectCmd(contextMenu.id)); setContextMenu(null) } },
            ].map((item, i) => item === null
              ? <div key={i} style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 0' }} />
              : (
                <button key={i} onClick={item.action}
                  style={{ display: 'block', width: '100%', padding: '6px 14px', background: 'none', border: 'none', fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: item.color ?? 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender-dim)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >{item.label}</button>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Top Bar (removed — see Ribbon above) ── */
function _TopBar_removed({ onTechDrawing, onProfile }) {
  const { activeMode, setMode, showGrid, toggleGrid, snapEnabled, toggleSnap, orthoMode, toggleOrtho, toggleStats, shadingMode, setShadingMode, showTree, toggleTree, xp, xpMax, level } = useCADStore()
  const { canUndo, canRedo, undo, redo, historyCount } = useUndoRedo()
  const { mode, setMode: setToolMode, transformMode, setTransformMode } = useTool()
  const { user } = useAuthStore()
  const { newFile, openFile, saveFile, saveAs, exportSTL, exportOBJ, exportSTEP } = useFileOperations()
  const xpPct = Math.round((xp / xpMax) * 100)

  const [openMenu, setOpenMenu] = useState(null)
  const menuBarRef = useRef(null)

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* Keyboard shortcuts for file ops */
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      if (e.key === 'n') { e.preventDefault(); newFile() }
      if (e.key === 'o') { e.preventDefault(); openFile() }
      if (e.key === 's' && !e.shiftKey) { e.preventDefault(); saveFile() }
      if (e.key === 's' &&  e.shiftKey) { e.preventDefault(); saveAs() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [newFile, openFile, saveFile, saveAs])

  const toggleMenu = (name) => setOpenMenu(prev => prev === name ? null : name)

  /* Menu definitions — all actions live */
  const MENUS = {
    File: [
      { label: 'New File',    shortcut: 'Ctrl+N',  onClick: newFile },
      { label: 'Open…',       shortcut: 'Ctrl+O',  onClick: openFile },
      { label: 'Save',        shortcut: 'Ctrl+S',  onClick: () => saveFile() },
      { label: 'Save As…',    shortcut: '⇧Ctrl+S', onClick: saveAs },
      { type: 'divider' },
      { label: 'Export STL',  onClick: exportSTL },
      { label: 'Export STEP', onClick: exportSTEP },
      { label: 'Export OBJ',  onClick: exportOBJ },
      { type: 'divider' },
      { label: 'Close',       shortcut: 'Ctrl+W', onClick: () => window.close() },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', disabled: !canUndo, onClick: undo },
      { label: 'Redo', shortcut: 'Ctrl+Y', disabled: !canRedo, onClick: redo },
      { type: 'divider' },
      { label: 'Cut',       shortcut: 'Ctrl+X', onClick: () => {} },
      { label: 'Copy',      shortcut: 'Ctrl+C', onClick: () => {} },
      { label: 'Paste',     shortcut: 'Ctrl+V', onClick: () => {} },
      { label: 'Delete',    shortcut: 'Del',    onClick: () => {} },
      { type: 'divider' },
      { label: 'Select All',   shortcut: 'Ctrl+A', onClick: () => {} },
      { label: 'Deselect All', shortcut: 'Esc',    onClick: () => setToolMode('SELECT') },
    ],
    View: [
      { label: 'Grid',              checked: showGrid,    onClick: toggleGrid },
      { label: 'Snap to Grid',      checked: snapEnabled, onClick: toggleSnap },
      { label: 'Ortho Mode',        checked: orthoMode,   onClick: toggleOrtho },
      { label: 'Performance Stats', checked: false,       onClick: toggleStats },
      { type: 'divider' },
      { type: 'label', label: 'Camera' },
      { label: 'Front View',   shortcut: 'Num 1', onClick: () => {} },
      { label: 'Top View',     shortcut: 'Num 7', onClick: () => {} },
      { label: 'Right View',   shortcut: 'Num 3', onClick: () => {} },
      { label: 'Isometric',    shortcut: 'Num 0', onClick: () => {} },
      { type: 'divider' },
      { label: 'Zoom to Fit', shortcut: 'F', onClick: () => {} },
    ],
    Sketch: [
      { type: 'label', label: '2D Tools' },
      { label: 'Polyline',  shortcut: 'P', onClick: () => setToolMode('POLYLINE'),  checked: mode === 'POLYLINE' },
      { label: 'Circle',    shortcut: 'C', onClick: () => setToolMode('CIRCLE'),    checked: mode === 'CIRCLE' },
      { label: 'Arc',       shortcut: 'A', onClick: () => setToolMode('ARC'),       checked: mode === 'ARC' },
      { label: 'Rectangle', shortcut: 'R', onClick: () => setToolMode('RECT'),      checked: mode === 'RECT' },
      { label: 'Spline',    shortcut: 'S', onClick: () => setToolMode('SPLINE'),    checked: mode === 'SPLINE' },
      { label: 'Polygon',               onClick: () => setToolMode('POLYGON'),   checked: mode === 'POLYGON' },
    ],
    Model: [
      { type: 'label', label: 'Solids' },
      { label: 'Extrude', shortcut: 'E', onClick: () => setToolMode('EXTRUDE'), checked: mode === 'EXTRUDE' },
      { label: 'Revolve', shortcut: 'V', onClick: () => setToolMode('REVOLVE'), checked: mode === 'REVOLVE' },
      { label: 'Sweep',   shortcut: 'W', onClick: () => setToolMode('SWEEP'),   checked: mode === 'SWEEP' },
      { label: 'Loft',                  onClick: () => setToolMode('LOFT'),     checked: mode === 'LOFT' },
      { label: 'Boolean', shortcut: 'B', onClick: () => setToolMode('BOOLEAN'), checked: mode === 'BOOLEAN' },
      { type: 'divider' },
      { type: 'label', label: 'Modify' },
      { label: 'Fillet',  shortcut: 'F', onClick: () => setToolMode('FILLET'),  checked: mode === 'FILLET' },
      { label: 'Chamfer', shortcut: 'H', onClick: () => setToolMode('CHAMFER'), checked: mode === 'CHAMFER' },
      { label: 'Shell',   shortcut: 'K', onClick: () => setToolMode('SHELL'),   checked: mode === 'SHELL' },
    ],
    Tools: [
      { label: 'Measure',              shortcut: 'M',      onClick: () => setToolMode('MEASURE'), checked: mode === 'MEASURE' },
      { label: '2D Technical Drawing', shortcut: '📐',     onClick: onTechDrawing },
      { type: 'divider' },
      { label: 'AI Command Bar',       shortcut: 'Ctrl+K', onClick: () => {} },
      { type: 'divider' },
      { label: 'Keyboard Shortcuts',   onClick: () => {} },
      { label: 'Preferences',          onClick: () => {} },
    ],
  }

  const chip = (label, active, onClick) => (
    <button key={label} onClick={onClick} title={label}
      style={{
        height: 24, padding: '0 7px',
        background: active ? 'var(--cyan-dim)' : 'none',
        border: `1px solid ${active ? 'var(--border-active)' : 'var(--border-subtle)'}`,
        color: active ? 'var(--cyan)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.07em',
        cursor: 'pointer', borderRadius: 3, transition: 'all 150ms',
        boxShadow: active ? '0 0 7px var(--cyan-glow)' : 'none',
        flexShrink: 0,
      }}>{label}</button>
  )

  return (
    <div style={{
      height: 48, background: 'var(--bg-base)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center',
      padding: '0 10px', gap: 4, zIndex: 20,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:7, paddingRight:10, borderRight:'1px solid var(--border-subtle)', flexShrink:0 }}>
        <div style={{ width:20, height:20, background:'linear-gradient(135deg,#c4b0ff,#ffadd4)', clipPath:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)', boxShadow:'0 0 10px rgba(196,176,255,.5)', flexShrink:0 }} />
        <span style={{ fontFamily:'var(--font-display)', fontSize:'0.72rem', letterSpacing:'0.1em', color:'var(--cyan)', whiteSpace:'nowrap' }}>TOFU CAD</span>
      </div>

      {/* Menu items with dropdowns */}
      <div ref={menuBarRef} style={{ display:'flex', alignItems:'stretch', height:'100%', flexShrink:0 }}>
        {Object.keys(MENUS).map(name => (
          <div key={name} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => toggleMenu(name)}
              style={{
                background: openMenu === name ? 'var(--lavender-dim)' : 'none',
                border: 'none',
                fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: '0.7rem',
                letterSpacing: '0.04em',
                color: openMenu === name ? 'var(--lavender-bright)' : 'var(--text-secondary)',
                cursor: 'pointer', padding: '0 8px', height: '100%',
                transition: 'color 150ms, background 150ms', flexShrink: 0,
              }}
              onMouseEnter={e => { if (openMenu !== name) { e.currentTarget.style.color = 'var(--cyan)' } }}
              onMouseLeave={e => { if (openMenu !== name) { e.currentTarget.style.color = 'var(--text-secondary)' } }}
            >{name}</button>

            <AnimatePresence>
              {openMenu === name && (
                <MenuDropdown items={MENUS[name]} onClose={() => setOpenMenu(null)} />
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="divider-v" style={{ margin:'10px 4px', flexShrink:0 }} />

      {/* Undo / Redo */}
      <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
        style={{ height:24, padding:'0 8px', background:canUndo?'var(--cyan-dim)':'none', border:`1px solid ${canUndo?'var(--border-active)':'var(--border-subtle)'}`, color:canUndo?'var(--cyan)':'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:'0.72rem', cursor:canUndo?'pointer':'not-allowed', borderRadius:'3px 0 0 3px', flexShrink:0, transition:'all 150ms' }}>
        ↩{historyCount > 0 ? ` ${historyCount}` : ''}
      </button>
      <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"
        style={{ height:24, padding:'0 8px', background:canRedo?'var(--magenta-dim)':'none', border:`1px solid ${canRedo?'var(--border-magenta)':'var(--border-subtle)'}`, borderLeft:'none', color:canRedo?'var(--magenta)':'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:'0.72rem', cursor:canRedo?'pointer':'not-allowed', borderRadius:'0 3px 3px 0', flexShrink:0, transition:'all 150ms' }}>
        ↪
      </button>

      <div className="divider-v" style={{ margin:'10px 4px', flexShrink:0 }} />

      {/* Transform mode (SELECT only) */}
      {mode === 'SELECT' && (
        <div style={{ display:'flex', background:'var(--bg-void)', border:'1px solid var(--border-subtle)', borderRadius:3, overflow:'hidden', flexShrink:0 }}>
          {[['translate','↕'],['rotate','↻'],['scale','⤢']].map(([m, ic]) => (
            <button key={m} onClick={() => setTransformMode(m)} title={`${m} (G)`}
              style={{ padding:'3px 7px', background:transformMode===m?'var(--cyan-dim)':'none', border:'none', color:transformMode===m?'var(--cyan)':'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:'0.85rem', cursor:'pointer', transition:'all 150ms' }}
            >{ic}</button>
          ))}
        </div>
      )}

      {/* 2D/3D toggle */}
      <div style={{ display:'flex', background:'var(--bg-void)', border:'1px solid var(--border-subtle)', borderRadius:3, overflow:'hidden', flexShrink:0 }}>
        {['2d','3d'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding:'3px 9px', background:activeMode===m?'var(--cyan-dim)':'none', border:'none', color:activeMode===m?'var(--cyan)':'var(--text-secondary)', fontFamily:'var(--font-mono)', fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', fontWeight:activeMode===m?700:400, transition:'all 150ms' }}
          >{m}</button>
        ))}
      </div>

      {/* View chips */}
      {chip('GRID',  showGrid,    toggleGrid)}
      {chip('SNAP',  snapEnabled, toggleSnap)}
      {chip('ORTHO', orthoMode,   toggleOrtho)}
      {chip('TREE',  showTree,    toggleTree)}

      <div className="divider-v" style={{ margin:'10px 2px', flexShrink:0 }} />

      {/* Shading mode */}
      <div style={{ display:'flex', background:'var(--bg-void)', border:'1px solid var(--border-subtle)', borderRadius:3, overflow:'hidden', flexShrink:0 }} title="Shading Mode">
        {[['▣','solid','Solid'],['⬡','wireframe','Wireframe'],['◈','xray','X-Ray'],['▪','flat','Flat']].map(([icon, mode, tip]) => (
          <button key={mode} onClick={() => setShadingMode(mode)} title={tip}
            style={{ padding:'3px 6px', background:shadingMode===mode?'var(--lavender-dim)':'none', border:'none', color:shadingMode===mode?'var(--cyan)':'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:'0.8rem', cursor:'pointer', transition:'all 150ms' }}
          >{icon}</button>
        ))}
      </div>

      {/* 2D Drawing */}
      <button onClick={onTechDrawing} title="2D Technical Drawing"
        style={{ height:24, padding:'0 8px', background:'rgba(253,230,138,.07)', border:'1px solid rgba(253,230,138,.28)', color:'var(--gold)', fontFamily:'var(--font-mono)', fontSize:'0.6rem', letterSpacing:'0.06em', cursor:'pointer', borderRadius:3, flexShrink:0, transition:'all 150ms' }}
        onMouseEnter={e => { e.currentTarget.style.background='rgba(253,230,138,.16)'; e.currentTarget.style.boxShadow='0 0 8px var(--gold-glow)' }}
        onMouseLeave={e => { e.currentTarget.style.background='rgba(253,230,138,.07)'; e.currentTarget.style.boxShadow='none' }}
      >📐 2D</button>

      <div style={{ flex:1, minWidth:0 }} />

      {/* Multiplayer HUD */}
      <MultiplayerHUD />

      <div className="divider-v" style={{ margin:'10px 6px', flexShrink:0 }} />

      {/* XP bar — compact inline */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--gold)', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>L{level}</span>
        <div style={{ width:80, height:3, background:'var(--bg-elevated)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ width:`${xpPct}%`, height:'100%', background:'linear-gradient(90deg,var(--lavender),var(--sakura))', borderRadius:2, transition:'width 0.8s ease' }} />
        </div>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.56rem', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{xp}</span>
      </div>

      {/* Profile avatar */}
      <motion.button
        onClick={onProfile}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.96 }}
        style={{
          width:28, height:28, borderRadius:'50%', flexShrink:0,
          background: user ? 'linear-gradient(135deg,#c4b0ff,#ffadd4)' : 'var(--bg-elevated)',
          border: user ? '1px solid var(--border-active)' : '1px dashed var(--border-subtle)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'var(--font-ui)', fontSize:'0.7rem',
          color: user ? 'var(--bg-void)' : 'var(--text-dim)',
          fontWeight:700, cursor:'pointer',
          boxShadow: user ? '0 0 10px var(--cyan-glow)' : 'none',
          marginLeft:4,
        }}
        title={user ? `${user.displayName || user.username} — profile` : 'Sign in'}
      >
        {user ? (user.displayName || user.username || '?')[0].toUpperCase() : '?'}
      </motion.button>
    </div>
  )
}

/* ── Scene Context Menu ── */
const CTX_PALETTE = [
  '#00e5ff','#e040fb','#ffd740','#69ff47',
  '#ff6688','#80f0e0','#c4b0ff','#ffadd4',
  '#ff5252','#448aff','#ffffff','#aaaaaa',
]

function SceneContextMenu({ x, y, objectId, onClose }) {
  const ref     = useRef(null)
  const obj     = useCADStore(s => s.objects.find(o => o.id === objectId))
  const { updateObject, duplicateObject, removeObject, toggleObjectVisibility } = useCADStore()
  const { execute } = useCADHistory()
  const { setTransformMode, setMode: setToolMode } = useTool()

  // Close on outside click or Escape
  useEffect(() => {
    const down = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const key  = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', down, true)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down, true)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])

  // Clamp to viewport
  const cx = Math.min(x, window.innerWidth  - 230)
  const cy = Math.min(y, window.innerHeight - 380)

  const item = (icon, label, action, danger) => (
    <button key={label} onClick={() => { action(); onClose() }} style={{
      display:'flex', alignItems:'center', gap:9, width:'100%',
      padding:'6px 12px', background:'none', border:'none',
      color: danger ? '#ff6688' : 'var(--text-primary)',
      fontFamily:'var(--font-mono)', fontSize:'0.68rem', letterSpacing:'0.04em',
      cursor:'pointer', textAlign:'left', transition:'background 100ms',
      borderRadius:3,
    }}
    onMouseEnter={e=>e.currentTarget.style.background='rgba(196,176,255,0.08)'}
    onMouseLeave={e=>e.currentTarget.style.background='none'}
    >
      <span style={{ width:16, textAlign:'center', fontSize:'0.8rem', opacity:0.7 }}>{icon}</span>
      {label}
    </button>
  )

  return (
    <motion.div
      ref={ref}
      initial={{ opacity:0, scale:0.93, y:-4 }}
      animate={{ opacity:1, scale:1,    y:0  }}
      exit={{ opacity:0, scale:0.93, y:-4 }}
      transition={{ duration:0.12, ease:'easeOut' }}
      style={{
        position:'fixed', left:cx, top:cy, zIndex:9000,
        width:220, background:'rgba(8,9,14,0.96)',
        border:'1px solid rgba(0,240,255,0.25)',
        borderRadius:6,
        boxShadow:'0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,240,255,0.05), 0 0 32px rgba(0,240,255,0.06)',
        backdropFilter:'blur(20px)',
        overflow:'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding:'7px 12px 5px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.55rem', color:'rgba(0,240,255,0.6)', letterSpacing:'0.12em', textTransform:'uppercase' }}>
          {obj ? `${obj.type.toUpperCase()} · ${obj.id}` : 'SCENE'}
        </span>
      </div>

      {/* Quick actions */}
      <div style={{ padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        {obj && item('⧉','Duplicate', () => duplicateObject(obj.id))}
        {obj && item('👁', obj?.visible === false ? 'Show' : 'Hide', () => toggleObjectVisibility(obj.id))}
        {obj && item('⊹','Focus Camera', () => {})}
        {obj && item('↕','Move',   () => { setToolMode('SELECT'); setTransformMode('translate') })}
        {obj && item('↻','Rotate', () => { setToolMode('SELECT'); setTransformMode('rotate') })}
        {obj && item('⤢','Scale',  () => { setToolMode('SELECT'); setTransformMode('scale') })}
        {obj && item('✕','Delete', () => execute(deleteObjectCmd(obj.id)), true)}
        {!obj && item('⬡','Add Box',    () => execute(addObjectCmd({ type:'box',    color:'#00e5ff', position:[0,0.5,0] })))}
        {!obj && item('○','Add Sphere', () => execute(addObjectCmd({ type:'sphere', color:'#e040fb', position:[0,0.5,0] })))}
      </div>

      {/* Color palette */}
      {obj && (
        <div style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'rgba(255,255,255,0.28)', letterSpacing:'0.1em', marginBottom:6, textTransform:'uppercase' }}>Material Color</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:4 }}>
            {CTX_PALETTE.map(c => (
              <button key={c} onClick={() => { updateObject(obj.id, { color:c }); onClose() }}
                style={{ width:'100%', aspectRatio:'1', borderRadius:3, background:c, border:`2px solid ${obj.color===c?'rgba(255,255,255,0.9)':'transparent'}`, cursor:'pointer', boxShadow:obj.color===c?`0 0 8px ${c}`:'none', transition:'all 0.12s' }} />
            ))}
          </div>
          <input type="color" value={obj.color}
            onChange={e => updateObject(obj.id, { color: e.target.value })}
            style={{ width:'100%', height:22, marginTop:6, border:'1px solid rgba(255,255,255,0.12)', borderRadius:3, padding:2, background:'var(--bg-elevated)', cursor:'pointer' }} />
        </div>
      )}

      {/* Transform fast-toggle */}
      {obj && (
        <div style={{ padding:'6px 12px 8px' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'rgba(255,255,255,0.28)', letterSpacing:'0.1em', marginBottom:5, textTransform:'uppercase' }}>Transform</div>
          <div style={{ display:'flex', gap:4 }}>
            {[['↕','Move','translate'],['↻','Rot','rotate'],['⤢','Scale','scale']].map(([icon, label, tm]) => (
              <button key={tm} onClick={() => { setToolMode('SELECT'); setTransformMode(tm); onClose() }}
                style={{ flex:1, padding:'5px 4px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:4, color:'var(--text-secondary)', fontFamily:'var(--font-mono)', fontSize:'0.58rem', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2, transition:'all 0.12s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(196,176,255,0.1)';e.currentTarget.style.color='var(--cyan)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='var(--text-secondary)'}}
              >
                <span style={{ fontSize:'0.85rem' }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

/* ── Right Panel ── */
function RightPanel({ selectedId, onDeselect }) {
  const [tab, setTab] = useState('tweaks')
  const { layers, activeLayer, setActiveLayer, toggleLayerVisibility, objects } = useCADStore()
  const { execute } = useCADHistory()

  const TABS = [
    { id:'tweaks',  label:'Tweaks'   },
    { id:'layers',  label:'Layers'   },
    { id:'history', label:'History'  },
    { id:'git',     label:'Git ⑂'   },
  ]

  return (
    <div style={{ width: 252, background:'var(--bg-surface)', borderLeft:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', zIndex:10, overflow:'hidden' }}>
      <div style={{ display:'flex', borderBottom:'1px solid var(--border-subtle)', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:'8px 4px', background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?'var(--cyan)':'transparent'}`, color: tab===t.id?'var(--cyan)':'var(--text-secondary)', fontFamily:'var(--font-ui)', fontWeight:700, fontSize:'0.65rem', letterSpacing:'0.07em', textTransform:'uppercase', cursor:'pointer', transition:'all 150ms' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'tweaks' && (
        <div style={{ flex:1, overflowY:'auto' }}>
          <LiveTweaksPanel selectedId={selectedId} />
        </div>
      )}

      {tab === 'layers' && (
        <div style={{ flex:1, overflowY:'auto', padding:8 }}>
          <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', marginBottom:6, fontSize:'0.7rem', padding:'6px' }}>+ New Layer</button>
          {layers.map(l => (
            <div key={l.id} onClick={() => setActiveLayer(l.id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', marginBottom:3, background: activeLayer===l.id?'var(--cyan-dim)':'transparent', border:`1px solid ${activeLayer===l.id?'var(--border-active)':'transparent'}`, borderRadius:3, cursor:'pointer', transition:'all 150ms' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:l.color, boxShadow:`0 0 5px ${l.color}80`, flexShrink:0 }} />
              <span style={{ flex:1, fontFamily:'var(--font-ui)', fontSize:'0.8rem', color: l.visible?'var(--text-primary)':'var(--text-dim)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.name}</span>
              <button onClick={e=>{e.stopPropagation();toggleLayerVisibility(l.id)}} style={{ background:'none', border:'none', cursor:'pointer', color: l.visible?'var(--cyan)':'var(--text-dim)', fontSize:'0.75rem', padding:0 }}>{l.visible?'👁':'◻'}</button>
              {l.locked && <span style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>🔒</span>}
            </div>
          ))}
          {objects.length > 0 && (
            <>
              <div className="divider" style={{ margin:'12px 0' }} />
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)', letterSpacing:'0.1em', marginBottom:6 }}>OBJECTS ({objects.length})</div>
              {objects.map(o => (
                <div key={o.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', marginBottom:2, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:3 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:o.color, boxShadow:`0 0 5px ${o.color}80`, flexShrink:0 }} />
                  <span style={{ flex:1, fontFamily:'var(--font-ui)', fontSize:'0.75rem', color:'var(--text-primary)', textTransform:'capitalize' }}>{o.type}</span>
                  <button onClick={() => execute(deleteObjectCmd(o.id))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-dim)', fontSize:'0.7rem', padding:'0 2px', transition:'color 150ms' }} onMouseEnter={e=>e.target.style.color='#ff5252'} onMouseLeave={e=>e.target.style.color='var(--text-dim)'}>✕</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <HistoryPanel />
        </div>
      )}

      {tab === 'git' && (
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <GitPanel />
        </div>
      )}
    </div>
  )
}

/* ── Status Bar ── */
function StatusBar() {
  const { snapEnabled, activeLayer, layers, objects } = useCADStore()
  const { historyCount } = useUndoRedo()
  const { mode, transformMode } = useTool()
  const layer = layers.find(l => l.id === activeLayer)

  return (
    <div style={{ height:26, background:'var(--bg-base)', borderTop:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', padding:'0 16px', gap:20, zIndex:10 }}>
      {[['X',0],['Y',0],['Z',0]].map(([a,v]) => (
        <span key={a} style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color: a==='X'?'#ff6688':a==='Y'?'#66ff88':'#6688ff', letterSpacing:'0.04em' }}>
          {a}: <span style={{ color:'var(--text-primary)' }}>{Number(v).toFixed(3)}</span>
        </span>
      ))}
      <div className="divider-v" />
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.66rem', color:'var(--cyan)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
        {mode}{mode === 'SELECT' ? ` · ${transformMode}` : ''}
      </span>
      <div className="divider-v" />
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.66rem', color:'var(--text-secondary)', letterSpacing:'0.06em' }}>
        LAYER: <span style={{ color:layer?.color }}>{layer?.name.toUpperCase()}</span>
      </span>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.66rem', color: snapEnabled?'var(--cyan)':'var(--text-dim)', letterSpacing:'0.06em' }}>
        {snapEnabled?'◆ SNAP':'◇ SNAP'}
      </span>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.66rem', color:'var(--text-secondary)' }}>
        OBJ: <span style={{ color:'var(--text-primary)' }}>{objects.length}</span>
      </span>
      {historyCount > 0 && (
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.66rem', color:'var(--text-dim)' }}>HISTORY: {historyCount}</span>
      )}
      <div style={{ flex:1 }} />
      <span className="status-chip"><span className="dot" />FORGE ENGINE ONLINE</span>
    </div>
  )
}

function ViewportOverlay() {
  const { activeMode, orthoMode } = useCADStore()
  const { mode } = useTool()
  return (
    <div style={{ position:'absolute', top:12, left:12, pointerEvents:'none', display:'flex', flexDirection:'column', gap:6 }}>
      <span className="tag tag-cyan">{orthoMode?'ORTHOGRAPHIC':'PERSPECTIVE'}</span>
      <span className="tag tag-magenta">{activeMode==='3d'?'3D MODEL':'2D SKETCH'}</span>
      {mode !== 'SELECT' && (
        <span className="tag" style={{ background:'rgba(255,0,122,0.12)', border:'1px solid rgba(255,0,122,0.4)', color:'#ff007a', fontFamily:'var(--font-mono)', fontSize:'0.6rem', padding:'3px 8px', letterSpacing:'0.1em' }}>
          ⬡ {mode}
        </span>
      )}
    </div>
  )
}

/* ── Collapsible panel nub ── */
function PanelNub({ side, icon, label, onClick }) {
  return (
    <div
      onClick={onClick}
      title={`Expand ${label}`}
      style={{
        gridArea: side === 'left' ? 'tree' : 'rightpanel',
        width: side === 'left' ? 28 : 28,
        background: 'var(--bg-base)',
        borderRight: side === 'left' ? '1px solid var(--border-subtle)' : 'none',
        borderLeft:  side === 'right' ? '1px solid var(--border-subtle)' : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 8, cursor: 'pointer',
        transition: 'background 150ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-base)'}
    >
      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.48rem',
        color: 'var(--text-dim)', letterSpacing: '0.1em',
        writingMode: 'vertical-lr', textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  )
}

/* ── Main Studio ── */
function StudioInner() {
  const { projectId } = useParams()
  const [selectedId,      setSelectedId]      = useState(null)
  const [showDrawing,     setShowDrawing]      = useState(false)
  const [showAchievement, setShowAchievement] = useState(true)
  const [showProfile,     setShowProfile]      = useState(false)
  const [cursorPos,       setCursorPos]        = useState({ x: 0, y: 0 })
  const [ctxMenu,         setCtxMenu]          = useState(null)  // { x, y, objectId }
  const meshRefs          = useRef({})
  const rightClickedIdRef = useRef(null)

  const handleObjectContextMenu = useCallback((objectId, nativeEvent) => {
    rightClickedIdRef.current = objectId
    setSelectedId(objectId)
    setCtxMenu({ x: nativeEvent.clientX, y: nativeEvent.clientY, objectId })
  }, [])

  const showTree        = useCADStore(s => s.showTree)
  const toggleTree      = useCADStore(s => s.toggleTree)
  const showRightPanel  = useCADStore(s => s.showRightPanel)
  const toggleRight     = useCADStore(s => s.toggleRightPanel)
  const studioMode      = useCADStore(s => s.studioMode)
  const setCameraPreset = useCADStore(s => s.setCameraPreset)

  const aiStatus = useAIGeneration(s => s.status)

  const loadFromServer   = useGitStore(s => s.loadFromServer)
  const loadingProject   = useGitStore(s => s.loadingProject)

  useEffect(() => {
    if (projectId) loadFromServer(projectId)
  }, [projectId])

  useKeyboardShortcuts()

  const handleViewportClick = useCallback(() => setSelectedId(null), [])
  const handleMouseMove = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setCursorPos({ x: e.clientX - r.left, y: e.clientY - r.top })
  }, [])

  // In AI modes, hide the command row and model tabs
  const isAIMode   = studioMode === 'ai3d' || studioMode === 'gendesign'
  const treeWidth  = showTree       ? '200px' : '28px'
  const rightWidth = showRightPanel ? '280px' : '28px'

  const gridRows = isAIMode
    ? '108px 1fr 26px'
    : '108px 1fr 26px 52px 26px'

  const gridAreas = isAIMode
    ? `"ribbon    ribbon    ribbon"
       "tree      viewport  rightpanel"
       "status    status    status"`
    : `"ribbon    ribbon    ribbon"
       "tree      viewport  rightpanel"
       "tree      modtabs   rightpanel"
       "tree      cmdline   rightpanel"
       "status    status    status"`

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: gridRows,
      gridTemplateColumns: `${treeWidth} 1fr ${rightWidth}`,
      gridTemplateAreas: gridAreas,
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--bg-void)',
      transition: 'grid-template-columns 200ms ease, grid-template-rows 200ms ease',
    }}>

      {/* Ribbon */}
      <div style={{ gridArea: 'ribbon', overflow: 'hidden', borderBottom: '1px solid var(--border-subtle)' }}>
        <Ribbon
          onTechDrawing={() => setShowDrawing(true)}
          onProfile={() => setShowProfile(true)}
          selectedId={selectedId}
        />
      </div>

      {/* Left: Feature Tree or collapsed nub */}
      {showTree ? (
        <div style={{ gridArea: 'tree', overflow: 'hidden', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
          {/* Tree collapse button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 4px 0', flexShrink: 0 }}>
            <button onClick={toggleTree} title="Collapse tree"
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 5px', borderRadius: 2 }}>◀</button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <FeatureTreePanel selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      ) : (
        <PanelNub side="left" icon="▶" label="Tree" onClick={toggleTree} />
      )}

      {/* 3D Viewport */}
      <div
        style={{ gridArea: 'viewport', position: 'relative', overflow: 'hidden',
          background: isAIMode ? '#090A0F' : 'var(--bg-void)',
          cursor: 'none',
          transition: 'background 400ms ease',
        }}
        onClick={handleViewportClick}
        onMouseMove={handleMouseMove}
        onContextMenu={e => {
          e.preventDefault()
          if (rightClickedIdRef.current) {
            rightClickedIdRef.current = null  // already handled in handleObjectContextMenu
          } else {
            setCtxMenu({ x: e.clientX, y: e.clientY, objectId: null })
          }
        }}
      >
        <Canvas
          camera={{ position:[6, 5, 8], fov: 50 }}
          gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
          shadows
          dpr={[1, 2]}
          style={{ width:'100%', height:'100%' }}
        >
          <color attach="background" args={[isAIMode ? '#090A0F' : '#060612']} />
          <fog  attach="fog"         args={[isAIMode ? '#090A0F' : '#060612', 24, 48]} />
          <Suspense fallback={null}>
            <ViewportScene
              selectedId={selectedId}
              onSelect={setSelectedId}
              meshRefs={meshRefs}
              onObjectContextMenu={handleObjectContextMenu}
            />
          </Suspense>
        </Canvas>

        <ViewportOverlay />
        <ViewCube onPreset={setCameraPreset} />
        <CrosshairOverlay pos={cursorPos} />

        {/* AI mode: studio-mode badge */}
        {isAIMode && (
          <div style={{ position: 'absolute', top: 12, right: 12, pointerEvents: 'none' }}>
            <div style={{
              padding: '4px 10px', borderRadius: 20,
              background: studioMode === 'ai3d' ? 'rgba(0,240,255,0.1)' : 'rgba(139,92,246,0.12)',
              border: `1px solid ${studioMode === 'ai3d' ? 'rgba(0,240,255,0.35)' : 'rgba(139,92,246,0.4)'}`,
              fontFamily: 'var(--font-mono)', fontSize: '0.58rem',
              color: studioMode === 'ai3d' ? '#00F0FF' : '#c4b0ff',
              letterSpacing: '0.1em',
            }}>
              {studioMode === 'ai3d' ? '✦ AI 3D GENERATOR' : '⬢ GENERATIVE DESIGN'}
            </div>
          </div>
        )}

        {/* AI generation progress bar at top of viewport */}
        {aiStatus === 'generating' && (
          <GenerationProgressBar />
        )}

        {/* Claude-style floating prompt bar */}
        <AnimatePresence>
          {studioMode === 'ai3d' && (
            <AIPromptBar visible={true} onGenerate={() => {}} />
          )}
        </AnimatePresence>
      </div>

      {/* Right: Properties / AI / GenDesign panel or collapsed nub */}
      {showRightPanel ? (
        <div style={{ gridArea: 'rightpanel', borderLeft: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
          {/* Right panel collapse button */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 4px 0', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)' }}>
            <button onClick={toggleRight} title="Collapse panel"
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.65rem', padding: '2px 5px', borderRadius: 2 }}>▶</button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {studioMode === 'cad'       && <RightPanel selectedId={selectedId} onDeselect={() => setSelectedId(null)} />}
            {studioMode === 'ai3d'      && <Generation3DPanel />}
            {studioMode === 'gendesign' && <GenerativeDesignPanel />}
          </div>
        </div>
      ) : (
        <PanelNub side="right" icon="◀"
          label={studioMode === 'ai3d' ? 'AI Gen' : studioMode === 'gendesign' ? 'Gen Design' : 'Props'}
          onClick={toggleRight}
        />
      )}

      {/* Model / Layout tabs (CAD mode only) */}
      {!isAIMode && (
        <div style={{ gridArea: 'modtabs', borderTop: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <ModelTabs />
        </div>
      )}

      {/* Command Line (CAD mode only) */}
      {!isAIMode && (
        <div style={{ gridArea: 'cmdline', overflow: 'hidden' }}>
          <CommandLine />
        </div>
      )}

      {/* Status Bar */}
      <div style={{ gridArea: 'status' }}>
        <StatusBar />
      </div>

      <AnimatePresence>
        {showDrawing && <TechDrawingModal onClose={() => setShowDrawing(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {ctxMenu && (
          <SceneContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            objectId={ctxMenu.objectId}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </AnimatePresence>

      <ProfileDrawer open={showProfile} onClose={() => setShowProfile(false)} />

      <AnimatePresence>
        {showAchievement && (
          <motion.div
            initial={{ x:'120%', opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:'120%', opacity:0 }}
            transition={{ duration:0.4 }}
            style={{ position:'fixed', bottom:40, right:24, zIndex:600 }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'var(--bg-elevated)', border:'1px solid var(--border-active)', borderRadius:6, boxShadow:'0 0 24px rgba(0,229,255,.2)', minWidth:260, position:'relative' }}>
              <button onClick={()=>setShowAchievement(false)} style={{ position:'absolute', top:6, right:8, background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'0.75rem' }}>✕</button>
              <div style={{ width:36, height:36, background:'linear-gradient(135deg,#ffd740,#ff9800)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', boxShadow:'0 0 12px rgba(255,215,64,.5)', flexShrink:0 }}>🧊</div>
              <div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--gold)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:2 }}>ACHIEVEMENT UNLOCKED</div>
                <div style={{ fontFamily:'var(--font-ui)', fontWeight:700, fontSize:'0.88rem', color:'var(--text-primary)' }}>AI Forge Activated</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--text-secondary)' }}>+500 XP · Studio access granted</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Thin progress bar across top of viewport during generation ── */
function GenerationProgressBar() {
  const progress = useAIGeneration(s => s.progress)
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 20, pointerEvents: 'none' }}>
      <motion.div
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ height: '100%', background: 'linear-gradient(90deg, rgba(0,240,255,0.6), #00F0FF, rgba(0,240,255,0.8))', boxShadow: '0 0 12px rgba(0,240,255,0.7)' }}
      />
    </div>
  )
}

export default function Studio() {
  return (
    <ToolProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
      >
        <StudioInner />
      </motion.div>
    </ToolProvider>
  )
}
