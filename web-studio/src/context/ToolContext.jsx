import { createContext, useContext, useState, useCallback } from 'react'

// ── Tool State Machine ──────────────────────────────────────────────
// Modes correspond to what the left toolbar buttons activate.
// TransformMode is a sub-mode only active when mode === 'SELECT'.

const VALID_MODES = ['SELECT', 'SKETCH_2D', 'EXTRUDE', 'REVOLVE', 'FILLET', 'MEASURE', 'LINE', 'POLYLINE', 'CIRCLE', 'ARC', 'RECT', 'SPLINE', 'POLYGON', 'SWEEP', 'BOOLEAN', 'LOFT', 'CHAMFER', 'SHELL', 'MEASURE', 'TEXT', 'LEADER']
const TRANSFORM_MODES = ['translate', 'rotate', 'scale']

const ToolContext = createContext(null)

export function ToolProvider({ children }) {
  const [mode, setModeRaw]          = useState('SELECT')
  const [transformMode, setTM]      = useState('translate')
  const [hoveredId, setHoveredId]   = useState(null)

  const setMode = useCallback((next) => {
    if (VALID_MODES.includes(next)) setModeRaw(next)
  }, [])

  const cycleTransform = useCallback(() => {
    setTM(t => {
      const i = TRANSFORM_MODES.indexOf(t)
      return TRANSFORM_MODES[(i + 1) % TRANSFORM_MODES.length]
    })
  }, [])

  return (
    <ToolContext.Provider value={{ mode, setMode, transformMode, setTransformMode: setTM, cycleTransform, hoveredId, setHoveredId }}>
      {children}
    </ToolContext.Provider>
  )
}

export function useTool() {
  const ctx = useContext(ToolContext)
  if (!ctx) throw new Error('useTool must be inside ToolProvider')
  return ctx
}
