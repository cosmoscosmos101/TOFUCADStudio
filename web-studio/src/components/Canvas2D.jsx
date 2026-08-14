import { useRef, useEffect, useState, useCallback } from 'react'
import { useTool } from '../context/ToolContext'
import { useCADStore } from '../hooks/useCADStore'

/* ── helpers ── */
function uid() { return `e${Date.now()}${Math.random().toString(36).slice(2,5)}` }
const w2s = (x, y, v) => [x * v.scale + v.x, -y * v.scale + v.y]   // y flipped: CAD +Y = up
const s2w = (x, y, v) => [(x - v.x) / v.scale, -(y - v.y) / v.scale]

function snapPt(x, y, gs, on) {
  if (!on) return [x, y]
  return [Math.round(x / gs) * gs, Math.round(y / gs) * gs]
}

function orthoPt([x0, y0], [x1, y1], on) {
  if (!on) return [x1, y1]
  const dx = x1 - x0, dy = y1 - y0
  return Math.abs(dx) >= Math.abs(dy) ? [x1, y0] : [x0, y1]
}

function distSeg([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay
  const l2 = dx * dx + dy * dy
  if (!l2) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function hitTest(e, wx, wy, thr) {
  switch (e.type) {
    case 'line': return distSeg([wx, wy], e.p1, e.p2) < thr
    case 'circle': return Math.abs(Math.hypot(wx - e.center[0], wy - e.center[1]) - e.r) < thr
    case 'arc': return Math.abs(Math.hypot(wx - e.center[0], wy - e.center[1]) - e.r) < thr
    case 'rect': {
      const [x1, y1] = [Math.min(e.p1[0], e.p2[0]), Math.min(e.p1[1], e.p2[1])]
      const [x2, y2] = [Math.max(e.p1[0], e.p2[0]), Math.max(e.p1[1], e.p2[1])]
      return (
        (Math.abs(wx - x1) < thr && wy >= y1 - thr && wy <= y2 + thr) ||
        (Math.abs(wx - x2) < thr && wy >= y1 - thr && wy <= y2 + thr) ||
        (Math.abs(wy - y1) < thr && wx >= x1 - thr && wx <= x2 + thr) ||
        (Math.abs(wy - y2) < thr && wx >= x1 - thr && wx <= x2 + thr)
      )
    }
    case 'polyline': {
      for (let i = 0; i < e.points.length - 1; i++) {
        if (distSeg([wx, wy], e.points[i], e.points[i + 1]) < thr) return true
      }
      return false
    }
    default: return false
  }
}

/* ── grid ── */
function drawGrid(ctx, view, W, H) {
  const gs = 1
  const [wx0] = s2w(0, 0, view)
  const [wx1] = s2w(W, 0, view)
  const [, wy0] = s2w(0, 0, view)
  const [, wy1] = s2w(0, H, view)
  const x0 = Math.floor(Math.min(wx0, wx1) / gs) * gs
  const x1 = Math.ceil(Math.max(wx0, wx1) / gs) * gs
  const y0 = Math.floor(Math.min(wy0, wy1) / gs) * gs
  const y1 = Math.ceil(Math.max(wy0, wy1) / gs) * gs

  ctx.save()
  for (let x = x0; x <= x1; x += gs) {
    const isMaj = Math.round(Math.abs(x) % 5) === 0
    ctx.strokeStyle = isMaj ? 'rgba(196,176,255,0.2)' : 'rgba(74,56,136,0.28)'
    ctx.lineWidth = isMaj ? 0.8 : 0.5
    const [sx] = w2s(x, 0, view)
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke()
  }
  for (let y = y0; y <= y1; y += gs) {
    const isMaj = Math.round(Math.abs(y) % 5) === 0
    ctx.strokeStyle = isMaj ? 'rgba(196,176,255,0.2)' : 'rgba(74,56,136,0.28)'
    ctx.lineWidth = isMaj ? 0.8 : 0.5
    const [, sy] = w2s(0, y, view)
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke()
  }

  // axes
  const [ox, oy] = w2s(0, 0, view)
  ctx.strokeStyle = 'rgba(196,176,255,0.45)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke()
  ctx.restore()
}

/* ── entity draw ── */
function drawEntity(ctx, e, view, selected) {
  ctx.save()
  ctx.strokeStyle = selected ? '#00e5ff' : (e.color || '#c4b0ff')
  ctx.lineWidth = selected ? 2 : 1.4
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'

  switch (e.type) {
    case 'line': {
      const [x1, y1] = w2s(e.p1[0], e.p1[1], view)
      const [x2, y2] = w2s(e.p2[0], e.p2[1], view)
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); break
    }
    case 'circle': {
      const [cx, cy] = w2s(e.center[0], e.center[1], view)
      ctx.beginPath(); ctx.arc(cx, cy, e.r * view.scale, 0, Math.PI * 2); ctx.stroke(); break
    }
    case 'arc': {
      const [cx, cy] = w2s(e.center[0], e.center[1], view)
      // canvas arc goes clockwise; our coords are CCW (y-up) so negate angles
      ctx.beginPath()
      ctx.arc(cx, cy, e.r * view.scale, -e.endAngle, -e.startAngle)
      ctx.stroke(); break
    }
    case 'rect': {
      const [x1, y1] = w2s(e.p1[0], e.p1[1], view)
      const [x2, y2] = w2s(e.p2[0], e.p2[1], view)
      ctx.beginPath()
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
      ctx.stroke(); break
    }
    case 'polyline': {
      if (e.points.length < 2) break
      ctx.beginPath()
      const [sx, sy] = w2s(e.points[0][0], e.points[0][1], view)
      ctx.moveTo(sx, sy)
      for (let i = 1; i < e.points.length; i++) {
        const [px, py] = w2s(e.points[i][0], e.points[i][1], view)
        ctx.lineTo(px, py)
      }
      if (e.closed) ctx.closePath()
      ctx.stroke(); break
    }
  }

  if (selected) {
    ctx.setLineDash([])
    ctx.fillStyle = '#00e5ff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8
    const grips = e.type === 'line' ? [e.p1, e.p2]
      : e.type === 'circle' ? [e.center, [e.center[0] + e.r, e.center[1]]]
      : e.type === 'rect' ? [e.p1, e.p2, [e.p1[0], e.p2[1]], [e.p2[0], e.p1[1]]]
      : e.type === 'polyline' ? e.points : []
    grips.forEach(([gx, gy]) => {
      const [sx, sy] = w2s(gx, gy, view)
      ctx.fillRect(sx - 3, sy - 3, 6, 6)
      ctx.strokeRect(sx - 3, sy - 3, 6, 6)
    })
  }
  ctx.restore()
}

/* ── ghost (in-progress) ── */
function drawGhost(ctx, drawing, view, orthoOn) {
  if (!drawing) return
  ctx.save()
  ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 1.5
  ctx.setLineDash([6, 3]); ctx.lineJoin = 'round'; ctx.lineCap = 'round'

  const cur = drawing.cursor || [0, 0]

  if (drawing.type === 'line' && drawing.p1) {
    const pt = orthoPt(drawing.p1, cur, orthoOn)
    const [x1, y1] = w2s(drawing.p1[0], drawing.p1[1], view)
    const [x2, y2] = w2s(pt[0], pt[1], view)
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    ctx.setLineDash([]); ctx.lineWidth = 1
    ctx.strokeRect(x2 - 4, y2 - 4, 8, 8)
  }

  if (drawing.type === 'rect' && drawing.p1) {
    const [x1, y1] = w2s(drawing.p1[0], drawing.p1[1], view)
    const [x2, y2] = w2s(cur[0], cur[1], view)
    ctx.beginPath()
    ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
    ctx.stroke()
  }

  if (drawing.type === 'circle' && drawing.center) {
    const [cx, cy] = w2s(drawing.center[0], drawing.center[1], view)
    const r = Math.hypot(cur[0] - drawing.center[0], cur[1] - drawing.center[1]) * view.scale
    if (r > 1) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke() }
    ctx.setLineDash([]); ctx.fillStyle = '#ffd740'
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
  }

  if (drawing.type === 'arc' && drawing.center) {
    const [cx, cy] = w2s(drawing.center[0], drawing.center[1], view)
    if (drawing.phase === 'radius') {
      const r = Math.hypot(cur[0] - drawing.center[0], cur[1] - drawing.center[1]) * view.scale
      if (r > 1) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke() }
    } else {
      const ea = Math.atan2(cur[1] - drawing.center[1], cur[0] - drawing.center[0])
      const r = drawing.r * view.scale
      ctx.beginPath(); ctx.arc(cx, cy, r, -ea, -drawing.startAngle); ctx.stroke()
    }
    ctx.setLineDash([]); ctx.fillStyle = '#ffd740'
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
  }

  if (drawing.type === 'polyline' && drawing.points.length > 0) {
    const lastPt = drawing.points.at(-1)
    const pt = orthoPt(lastPt, cur, orthoOn)
    const pts = [...drawing.points, pt]
    ctx.beginPath()
    const [sx, sy] = w2s(pts[0][0], pts[0][1], view)
    ctx.moveTo(sx, sy)
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = w2s(pts[i][0], pts[i][1], view)
      ctx.lineTo(px, py)
    }
    ctx.stroke()
    ctx.setLineDash([]); ctx.fillStyle = '#ffd740'
    drawing.points.forEach(([wx, wy]) => {
      const [sx, sy] = w2s(wx, wy, view)
      ctx.fillRect(sx - 3, sy - 3, 6, 6)
    })
  }

  ctx.restore()
}

/* ── snap indicator ── */
function drawSnapCrosshair(ctx, wx, wy, view, snapOn) {
  if (!snapOn) return
  const [sx, sy] = w2s(wx, wy, view)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,215,64,0.5)'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(sx - 8, sy); ctx.lineTo(sx + 8, sy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx, sy - 8); ctx.lineTo(sx, sy + 8); ctx.stroke()
  ctx.restore()
}

/* ─────────────────────────────────────────────────────────── */
export default function Canvas2D({ entities, setEntities, selectedId, setSelectedId }) {
  const canvasRef = useRef(null)
  const { mode } = useTool()
  const { snapEnabled, showGrid, orthoMode } = useCADStore()

  const [view, setView]       = useState({ x: 0, y: 0, scale: 50 })
  const [drawing, setDrawing] = useState(null)
  const [cursorW, setCursorW] = useState([0, 0])

  // Mirror latest values into a ref so event handlers don't go stale
  const S = useRef(null)
  S.current = { view, drawing, entities, snapEnabled, showGrid, orthoMode, mode, selectedId }

  /* ── redraw ── */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { view, drawing, entities, showGrid, selectedId, orthoMode, cursorW: cw, snapEnabled } = S.current
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#060612'; ctx.fillRect(0, 0, W, H)
    if (showGrid) drawGrid(ctx, view, W, H)
    entities.forEach(e => drawEntity(ctx, e, view, e.id === selectedId))
    drawGhost(ctx, drawing, view, orthoMode)
    if (S.current.snapEnabled && S.current.cursorW)
      drawSnapCrosshair(ctx, S.current.cursorW[0], S.current.cursorW[1], view, snapEnabled)
  }, [])

  useEffect(() => { redraw() }, [entities, drawing, view, selectedId, showGrid, mode, redraw])

  /* ── resize canvas to match CSS size ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
      setView(v => v.x === 0 && v.y === 0
        ? { ...v, x: canvas.width / 2, y: canvas.height / 2 }
        : v)
      redraw()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [redraw])

  /* ── coordinate helpers ── */
  const panRef = useRef(null)

  const getPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const { view, snapEnabled } = S.current
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top
    const [wx, wy] = s2w(sx, sy, view)
    const [snx, sny] = snapPt(wx, wy, 1, snapEnabled)
    return { sx, sy, wx: snx, wy: sny }
  }, [])

  /* ── add entity ── */
  const addEntity = useCallback((spec) => {
    setEntities(prev => [...prev, { ...spec, id: uid() }])
  }, [setEntities])

  /* ── mouse down ── */
  const onMouseDown = useCallback((e) => {
    const { mode, drawing, view, orthoMode } = S.current
    const { wx, wy } = getPos(e)

    if (e.button === 1) {
      e.preventDefault()
      panRef.current = { ox: e.clientX, oy: e.clientY, vx: view.x, vy: view.y }
      return
    }
    if (e.button !== 0) return

    if (mode === 'SELECT') {
      const thr = 10 / view.scale
      const hit = [...S.current.entities].reverse().find(en => hitTest(en, wx, wy, thr))
      setSelectedId(hit ? hit.id : null)
      return
    }

    if (mode === 'LINE') {
      if (!drawing || drawing.type !== 'line') {
        setDrawing({ type: 'line', p1: [wx, wy], cursor: [wx, wy] })
      } else {
        const pt = orthoPt(drawing.p1, [wx, wy], orthoMode)
        if (Math.hypot(pt[0] - drawing.p1[0], pt[1] - drawing.p1[1]) > 0.001)
          addEntity({ type: 'line', p1: [...drawing.p1], p2: pt, color: '#c4b0ff' })
        setDrawing(null)
      }
      return
    }

    if (mode === 'POLYLINE') {
      if (!drawing || drawing.type !== 'polyline') {
        setDrawing({ type: 'polyline', points: [[wx, wy]], cursor: [wx, wy] })
      } else {
        const lastPt = drawing.points.at(-1)
        const pt = orthoPt(lastPt, [wx, wy], orthoMode)
        setDrawing(d => ({ ...d, points: [...d.points, pt], cursor: pt }))
      }
      return
    }

    if (mode === 'CIRCLE') {
      if (!drawing || drawing.type !== 'circle') {
        setDrawing({ type: 'circle', center: [wx, wy], cursor: [wx, wy] })
      } else {
        const r = Math.hypot(wx - drawing.center[0], wy - drawing.center[1])
        if (r > 0.001) addEntity({ type: 'circle', center: [...drawing.center], r, color: '#c4b0ff' })
        setDrawing(null)
      }
      return
    }

    if (mode === 'ARC') {
      if (!drawing || drawing.type !== 'arc') {
        setDrawing({ type: 'arc', center: [wx, wy], cursor: [wx, wy], phase: 'radius' })
      } else if (drawing.phase === 'radius') {
        const r = Math.hypot(wx - drawing.center[0], wy - drawing.center[1])
        const sa = Math.atan2(wy - drawing.center[1], wx - drawing.center[0])
        setDrawing(d => ({ ...d, r, startAngle: sa, phase: 'endAngle', cursor: [wx, wy] }))
      } else {
        const ea = Math.atan2(wy - drawing.center[1], wx - drawing.center[0])
        addEntity({ type: 'arc', center: [...drawing.center], r: drawing.r, startAngle: drawing.startAngle, endAngle: ea, color: '#c4b0ff' })
        setDrawing(null)
      }
      return
    }

    if (mode === 'RECT') {
      if (!drawing || drawing.type !== 'rect') {
        setDrawing({ type: 'rect', p1: [wx, wy], cursor: [wx, wy] })
      } else {
        const dx = Math.abs(wx - drawing.p1[0]), dy = Math.abs(wy - drawing.p1[1])
        if (dx > 0.001 && dy > 0.001)
          addEntity({ type: 'rect', p1: [...drawing.p1], p2: [wx, wy], color: '#c4b0ff' })
        setDrawing(null)
      }
      return
    }
  }, [getPos, addEntity])

  /* ── mouse move ── */
  const onMouseMove = useCallback((e) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.ox
      const dy = e.clientY - panRef.current.oy
      setView(v => ({ ...v, x: panRef.current.vx + dx, y: panRef.current.vy + dy }))
      return
    }
    const { wx, wy } = getPos(e)
    S.current.cursorW = [wx, wy]
    setCursorW([wx, wy])
    if (!S.current.drawing) return
    setDrawing(d => d ? { ...d, cursor: [wx, wy] } : d)
  }, [getPos])

  /* ── mouse up ── */
  const onMouseUp = useCallback((e) => {
    if (e.button === 1) panRef.current = null
  }, [])

  /* ── double click: finish polyline ── */
  const onDblClick = useCallback(() => {
    const { drawing, mode } = S.current
    if (mode === 'POLYLINE' && drawing?.type === 'polyline' && drawing.points.length >= 2) {
      addEntity({ type: 'polyline', points: drawing.points, closed: false, color: '#c4b0ff' })
      setDrawing(null)
    }
  }, [addEntity])

  /* ── right-click: finish/cancel ── */
  const onContextMenu = useCallback((e) => {
    e.preventDefault()
    const { drawing, mode } = S.current
    if (!drawing) return
    if (mode === 'POLYLINE' && drawing.type === 'polyline' && drawing.points.length >= 2) {
      addEntity({ type: 'polyline', points: drawing.points, closed: false, color: '#c4b0ff' })
    }
    setDrawing(null)
  }, [addEntity])

  /* ── Escape to cancel ── */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setDrawing(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  /* ── scroll to zoom ── */
  const onWheel = useCallback((e) => {
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const factor = e.deltaY > 0 ? 0.88 : 1.14
    setView(v => {
      const ns = Math.max(4, Math.min(1000, v.scale * factor))
      return { scale: ns, x: mx - (mx - v.x) * (ns / v.scale), y: my - (my - v.y) * (ns / v.scale) }
    })
  }, [])

  /* ── prompt message ── */
  const prompt2d = (() => {
    if (!drawing) return null
    if (drawing.type === 'line') return drawing.p1 ? 'Click end point' : 'Click start point'
    if (drawing.type === 'circle') return drawing.center ? 'Click to set radius' : 'Click center'
    if (drawing.type === 'arc') {
      if (drawing.phase === 'radius') return 'Click to set radius start'
      return 'Click to set end angle'
    }
    if (drawing.type === 'rect') return drawing.p1 ? 'Click opposite corner' : 'Click first corner'
    if (drawing.type === 'polyline') return `${drawing.points.length} pts — Dbl-click or RMB to finish`
    return null
  })()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: mode === 'SELECT' ? 'default' : 'crosshair' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDblClick}
        onContextMenu={onContextMenu}
        onWheel={onWheel}
      />

      {/* Coordinate readout */}
      <div style={{
        position: 'absolute', bottom: 6, left: 10, pointerEvents: 'none',
        fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
        color: 'rgba(196,176,255,0.55)', letterSpacing: '0.06em',
      }}>
        X {cursorW[0].toFixed(3)}  Y {cursorW[1].toFixed(3)}  |  1:{(view.scale / 50).toFixed(2)}
      </div>

      {/* Tool prompt */}
      {prompt2d && (
        <div style={{
          position: 'absolute', bottom: 6, right: 10, pointerEvents: 'none',
          fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
          color: '#ffd740', letterSpacing: '0.08em',
          background: 'rgba(6,6,18,0.75)', padding: '2px 8px', borderRadius: 3,
          border: '1px solid rgba(255,215,64,0.25)',
        }}>
          {mode} · {prompt2d}
        </div>
      )}

      {/* Mode tags */}
      <div style={{ position: 'absolute', top: 12, left: 12, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="tag tag-magenta">2D SKETCH</span>
        {mode !== 'SELECT' && (
          <span className="tag" style={{ background: 'rgba(255,215,64,0.1)', border: '1px solid rgba(255,215,64,0.4)', color: '#ffd740', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', padding: '3px 8px', letterSpacing: '0.1em' }}>
            ◈ {mode}
          </span>
        )}
      </div>
    </div>
  )
}
