import { useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useCADStore } from '../hooks/useCADStore'
import { useCADHistory } from '../hooks/useCADHistory'
import { changePropertyCmd } from '../hooks/useCADCommands'

// Each slider debounces at 80ms — avoids flooding the history stack
// while still giving real-time visual feedback.

function Slider({ label, value, min, max, step = 0.01, unit = '', color, onChange, onCommit }) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>{label}</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
          color: color ?? 'var(--cyan)',
          letterSpacing: '0.04em',
        }}>
          {Number(value).toFixed(step < 0.1 ? 2 : 1)}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px' }}>
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color ?? 'var(--cyan-mid)'}, ${color ?? 'var(--cyan)'})`,
          borderRadius: '2px',
          boxShadow: `0 0 6px ${color ?? 'var(--cyan-glow)'}`,
          transition: 'width 60ms linear',
        }} />
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          onMouseUp={onCommit}
          onTouchEnd={onCommit}
          style={{
            position: 'absolute',
            inset: '-6px 0',
            width: '100%',
            opacity: 0,
            cursor: 'ew-resize',
            height: '16px',
          }}
        />
        {/* Thumb */}
        <div style={{
          position: 'absolute',
          left: `calc(${pct}% - 5px)`,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 10, height: 10,
          borderRadius: '50%',
          background: color ?? 'var(--cyan)',
          boxShadow: `0 0 8px ${color ?? 'var(--cyan-glow)'}`,
          border: '1px solid rgba(255,255,255,0.3)',
          pointerEvents: 'none',
          transition: 'left 60ms linear',
        }} />
      </div>
    </div>
  )
}

function Vec3Control({ label, field, value = [0,0,0], selectedId, color, min = -5, max = 5 }) {
  const { updateObject }  = useCADStore()
  const { execute }       = useCADHistory()
  const pendingRef        = useRef(value)

  const handleChange = useCallback((axis, v) => {
    const next = [...pendingRef.current]
    next[axis] = v
    pendingRef.current = next
    // Live preview — direct store write (no history entry yet)
    updateObject(selectedId, { [field]: next })
  }, [selectedId, field, updateObject])

  const handleCommit = useCallback(() => {
    // On release: record as undoable command
    execute(changePropertyCmd(selectedId, field, [...pendingRef.current]))
  }, [selectedId, field, execute])

  const axisColors = ['#ff6688', '#66ff88', '#6688ff']
  const labels     = ['X', 'Y', 'Z']

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        letterSpacing: '0.12em',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        marginBottom: '8px',
      }}>{label}</div>
      {[0, 1, 2].map(i => (
        <Slider
          key={i}
          label={labels[i]}
          value={value[i] ?? 0}
          min={min} max={max} step={0.05}
          color={axisColors[i]}
          onChange={v => handleChange(i, v)}
          onCommit={handleCommit}
        />
      ))}
    </div>
  )
}

function GeometrySliders({ obj }) {
  const { updateObject } = useCADStore()
  const { execute }      = useCADHistory()
  const params = obj.params ?? {}

  const handleChange = useCallback((key, value) => {
    updateObject(obj.id, { params: { ...params, [key]: value } })
  }, [obj.id, params, updateObject])

  const handleCommit = useCallback((key) => {
    execute(changePropertyCmd(obj.id, 'params', { ...(obj.params ?? {}), [key]: obj.params?.[key] }))
  }, [obj.id, obj.params, execute])

  const fields = (() => {
    switch (obj.type) {
      case 'sphere':
        return [{ key: 'r', label: 'Radius', min: 0.1, max: 3, step: 0.05, value: params.r ?? 0.5 }]
      case 'cylinder':
        return [
          { key: 'r', label: 'Radius', min: 0.1, max: 3,   step: 0.05, value: params.r ?? 0.5 },
          { key: 'h', label: 'Height', min: 0.1, max: 6,   step: 0.05, value: params.h ?? 1 },
        ]
      case 'cone':
        return [
          { key: 'r', label: 'Base Radius', min: 0.1, max: 3, step: 0.05, value: params.r ?? 0.5 },
          { key: 'h', label: 'Height',      min: 0.1, max: 6, step: 0.05, value: params.h ?? 1 },
        ]
      case 'torus':
        return [
          { key: 'r',    label: 'Ring Radius', min: 0.2, max: 3,   step: 0.05, value: params.r    ?? 0.5 },
          { key: 'tube', label: 'Tube Size',   min: 0.04, max: 1,  step: 0.02, value: params.tube ?? 0.18 },
        ]
      default: // box
        return [
          { key: 'w', label: 'Width',  min: 0.1, max: 6, step: 0.05, value: params.w ?? 1 },
          { key: 'h', label: 'Height', min: 0.1, max: 6, step: 0.05, value: params.h ?? 1 },
          { key: 'd', label: 'Depth',  min: 0.1, max: 6, step: 0.05, value: params.d ?? 1 },
        ]
    }
  })()

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px' }}>
        Geometry
      </div>
      {fields.map(f => (
        <Slider
          key={f.key}
          label={f.label}
          value={f.value}
          min={f.min} max={f.max} step={f.step}
          color="var(--aqua)"
          onChange={v => handleChange(f.key, v)}
          onCommit={() => handleCommit(f.key)}
        />
      ))}
    </div>
  )
}

export default function LiveTweaksPanel({ selectedId }) {
  const objects       = useCADStore(s => s.objects)
  const { updateObject } = useCADStore()
  const { execute }   = useCADHistory()
  const obj           = objects.find(o => o.id === selectedId)

  if (!obj) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
          color: 'var(--text-dim)',
          letterSpacing: '0.08em',
          lineHeight: 1.8,
        }}>
          SELECT AN OBJECT<br />TO SEE LIVE TWEAKS
        </div>
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{
            width: 32, height: 32,
            border: '2px solid var(--border-default)',
            borderRadius: '50%',
            margin: '16px auto 0',
          }}
        />
      </div>
    )
  }

  const handleColorChange = (e) => {
    updateObject(obj.id, { color: e.target.value })
  }
  const handleColorCommit = (e) => {
    execute(changePropertyCmd(obj.id, 'color', e.target.value))
  }

  const handleWireframeToggle = () => {
    execute(changePropertyCmd(obj.id, 'wireframe', !obj.wireframe))
  }

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto', height: '100%' }}>
      {/* Object header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          width: 10, height: 10,
          borderRadius: '50%',
          background: obj.color,
          boxShadow: `0 0 8px ${obj.color}80`,
          flexShrink: 0,
        }} />
        <div>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
            textTransform: 'capitalize',
          }}>{obj.type}</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            color: 'var(--text-dim)',
            letterSpacing: '0.06em',
          }}>{obj.id}</div>
        </div>
      </div>

      {/* Geometry parameters */}
      <GeometrySliders obj={obj} />

      <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 16 }} />

      {/* Position */}
      <Vec3Control
        label="Position" field="position"
        value={obj.position} selectedId={obj.id}
        min={-8} max={8}
      />

      {/* Scale */}
      <Vec3Control
        label="Scale" field="scale"
        value={obj.scale} selectedId={obj.id}
        min={0.05} max={5}
        color="#ffd740"
      />

      {/* Rotation */}
      <Vec3Control
        label="Rotation (rad)" field="rotation"
        value={obj.rotation} selectedId={obj.id}
        min={-Math.PI} max={Math.PI}
        color="#e040fb"
      />

      {/* Color */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}>Material Color</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="color"
            value={obj.color}
            onChange={handleColorChange}
            onBlur={handleColorCommit}
            style={{
              width: 36, height: 28,
              border: `1px solid var(--border-active)`,
              borderRadius: '3px',
              padding: '2px',
              background: 'var(--bg-elevated)',
              cursor: 'pointer',
            }}
          />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: obj.color,
            letterSpacing: '0.06em',
          }}>{obj.color.toUpperCase()}</span>
        </div>
      </div>

      {/* Wireframe toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        background: obj.wireframe ? 'var(--cyan-dim)' : 'var(--bg-elevated)',
        border: `1px solid ${obj.wireframe ? 'var(--border-active)' : 'var(--border-subtle)'}`,
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'all 150ms',
        marginBottom: '14px',
      }} onClick={handleWireframeToggle}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
          color: obj.wireframe ? 'var(--cyan)' : 'var(--text-secondary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>Wireframe</span>
        <div style={{
          width: 28, height: 14,
          borderRadius: '7px',
          background: obj.wireframe ? 'var(--cyan)' : 'var(--bg-void)',
          border: '1px solid var(--border-active)',
          position: 'relative',
          transition: 'background 150ms',
          boxShadow: obj.wireframe ? '0 0 8px var(--cyan-glow)' : 'none',
        }}>
          <div style={{
            position: 'absolute',
            top: 2, left: obj.wireframe ? 15 : 2,
            width: 8, height: 8,
            borderRadius: '50%',
            background: obj.wireframe ? 'var(--bg-void)' : 'var(--text-dim)',
            transition: 'left 150ms',
          }} />
        </div>
      </div>
    </div>
  )
}
