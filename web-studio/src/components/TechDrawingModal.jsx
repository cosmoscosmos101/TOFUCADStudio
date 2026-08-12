import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import * as THREE from 'three'
import { useCADStore } from '../hooks/useCADStore'

// ─── Renders a mini orthographic snapshot of the scene ────────────────────────
// For each of the 4 views, we position an orthographic camera, render once
// to an offscreen canvas, then display as <img> src.

const VIEW_CONFIGS = [
  { id: 'front',    label: 'FRONT',    pos: [0, 0, 12],   up: [0, 1, 0]  },
  { id: 'top',      label: 'TOP',      pos: [0, 12, 0],   up: [0, 0, -1] },
  { id: 'right',    label: 'RIGHT',    pos: [12, 0, 0],   up: [0, 1, 0]  },
  { id: 'isometric',label: 'ISO',      pos: [8, 8, 8],    up: [0, 1, 0]  },
]

function renderView({ pos, up, objects, size = 240 }) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  })
  renderer.setSize(size, size)
  renderer.setClearColor(0x07071a)
  renderer.setPixelRatio(1)

  const scene = new THREE.Scene()
  scene.fog = null

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))
  const dl = new THREE.DirectionalLight(0xffffff, 1.2)
  dl.position.set(5, 10, 5)
  scene.add(dl)

  // Grid
  const grid = new THREE.GridHelper(10, 10, 0x00e5ff15, 0x00e5ff08)
  scene.add(grid)

  // Build objects
  const GEO_MAP = {
    box:      () => new THREE.BoxGeometry(1, 1, 1),
    sphere:   () => new THREE.SphereGeometry(0.5, 16, 16),
    cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
    cone:     () => new THREE.ConeGeometry(0.5, 1, 12),
    torus:    () => new THREE.TorusGeometry(0.5, 0.18, 8, 24),
  }

  objects.forEach(obj => {
    const geoFn = GEO_MAP[obj.type]
    if (!geoFn) return
    const mat = new THREE.MeshStandardMaterial({
      color: obj.color,
      metalness: 0.4,
      roughness: 0.4,
      wireframe: obj.wireframe ?? false,
    })
    const mesh = new THREE.Mesh(geoFn(), mat)
    mesh.position.set(...(obj.position ?? [0, 0, 0]))
    mesh.scale.set(...(obj.scale ?? [1, 1, 1]))
    mesh.rotation.set(...(obj.rotation ?? [0, 0, 0]))
    scene.add(mesh)
  })

  // Demo geometry (always present)
  const demoMat = new THREE.MeshStandardMaterial({ color: 0x0a1a2a, metalness: 0.6, roughness: 0.3 })
  const demo = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), demoMat)
  demo.position.set(0, 1, 0)
  scene.add(demo)
  const demo2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), new THREE.MeshStandardMaterial({ color: 0x091523 }))
  demo2.position.set(0, 2.5, 0)
  scene.add(demo2)

  // Camera
  const aspect = 1
  const cam = new THREE.OrthographicCamera(-5 * aspect, 5 * aspect, 5, -5, 0.1, 100)
  cam.position.set(...pos)
  cam.up.set(...up)
  cam.lookAt(0, 1, 0)

  renderer.render(scene, cam)
  const dataURL = renderer.domElement.toDataURL('image/png')
  renderer.dispose()

  return dataURL
}

export default function TechDrawingModal({ onClose }) {
  const objects = useCADStore(s => s.objects)
  const [views, setViews] = useState({})
  const [generating, setGenerating] = useState(true)

  useEffect(() => {
    // Render all views async so the modal opens immediately
    const timer = setTimeout(() => {
      const result = {}
      VIEW_CONFIGS.forEach(vc => {
        result[vc.id] = renderView({ pos: vc.pos, up: vc.up, objects })
      })
      setViews(result)
      setGenerating(false)
    }, 50)
    return () => clearTimeout(timer)
  }, [])   // run once on mount

  const handleExport = () => {
    // Stitch all 4 views into a 2×2 layout on a canvas
    const canvas = document.createElement('canvas')
    canvas.width = 520
    canvas.height = 560
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#07071a'
    ctx.fillRect(0, 0, 520, 560)

    // Title
    ctx.fillStyle = '#00e5ff'
    ctx.font = 'bold 14px monospace'
    ctx.fillText('TOFU CAD STUDIO — Technical Drawing', 16, 30)
    ctx.fillStyle = '#3a3a60'
    ctx.font = '10px monospace'
    ctx.fillText(new Date().toISOString().slice(0, 19), 16, 48)

    const positions = [[16, 56], [272, 56], [16, 308], [272, 308]]
    const labels = VIEW_CONFIGS.map(v => v.label)

    Object.keys(views).forEach((id, i) => {
      const img = new Image()
      img.src = views[id]
      const [x, y] = positions[i]
      ctx.drawImage(img, x, y, 240, 240)
      // Border
      ctx.strokeStyle = '#00e5ff30'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, 240, 240)
      // Label
      ctx.fillStyle = '#00e5ff'
      ctx.font = 'bold 9px monospace'
      ctx.fillText(labels[i], x + 8, y + 18)
    })

    const link = document.createElement('a')
    link.download = 'tech-drawing.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(2,2,9,0.88)',
        backdropFilter: 'blur(12px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.3 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: 600,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
          boxShadow: '0 0 60px rgba(0,229,255,0.1), 0 32px 64px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div>
            <span className="tag tag-cyan" style={{ marginBottom: '6px', display: 'inline-block' }}>TECHNICAL DRAWING</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
              2D Projection Generator
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem' }}
          >✕</button>
        </div>

        {/* Drawing views */}
        <div style={{ padding: '16px 20px' }}>
          {generating ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: '12px' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{ width: 24, height: 24, border: '2px solid var(--border-subtle)', borderTop: '2px solid var(--cyan)', borderRadius: '50%' }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                GENERATING PROJECTIONS…
              </span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {VIEW_CONFIGS.map(vc => (
                <div key={vc.id} style={{
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-base)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {views[vc.id] && (
                    <img
                      src={views[vc.id]}
                      alt={vc.label}
                      style={{ width: '100%', display: 'block' }}
                    />
                  )}
                  <div style={{
                    position: 'absolute',
                    top: 6, left: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    color: 'var(--cyan)',
                    letterSpacing: '0.1em',
                    background: 'rgba(7,7,26,0.8)',
                    padding: '2px 6px',
                  }}>{vc.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: '0.8rem' }}>
            Close
          </button>
          {!generating && (
            <button className="btn btn-primary" onClick={handleExport} style={{ fontSize: '0.8rem' }}>
              ⬇ Export PNG
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
