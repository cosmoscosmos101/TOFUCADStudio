import { motion, AnimatePresence } from 'framer-motion'
import { useAIGeneration } from '../hooks/useAIGeneration'

const MATERIALS = [
  { id: 'aluminum', label: 'Aluminum 6061-T6', yield: '276 MPa', density: '2.7 g/cm³' },
  { id: 'steel',    label: 'Steel 1018',       yield: '370 MPa', density: '7.87 g/cm³' },
  { id: 'titanium', label: 'Ti-6Al-4V',        yield: '880 MPa', density: '4.43 g/cm³' },
  { id: 'carbon',   label: 'Carbon Fiber CFRP',yield: '600 MPa', density: '1.55 g/cm³' },
  { id: 'pla',      label: 'PLA (FDM Print)',  yield: '50 MPa',  density: '1.24 g/cm³' },
]

const LATTICE_TYPES = [
  { id: 'gyroid',    label: 'Gyroid',    icon: '∿', desc: 'Balanced, smooth strength' },
  { id: 'honeycomb', label: 'Honeycomb', icon: '⬡', desc: 'High compressive resistance' },
  { id: 'voronoi',   label: 'Voronoi',   icon: '◈', desc: 'Organic load distribution' },
  { id: 'kelvin',    label: 'Kelvin',    icon: '⊛', desc: 'Uniform space-fill density' },
]

const LOAD_CASES = [
  { icon: '⬇', label: 'Axial Load',    value: '−1500 N  (−Z)', color: '#ff88aa'  },
  { icon: '↔', label: 'Shear Force',   value: '300 N  (X)',    color: '#fde68a'  },
  { icon: '⚓', label: 'Fixed Points',  value: '4 anchors',     color: '#80f0e0'  },
  { icon: '📐', label: 'Safety Factor', value: '≥ 2.0×',       color: '#c4b0ff'  },
]

export default function GenerativeDesignPanel() {
  const {
    material, latticeType, optimizing, optProgress, optResult,
    setMaterial, setLatticeType, startOptimization, cancelOptimization,
  } = useAIGeneration()

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14, scrollbarWidth: 'thin' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%',
            background: optimizing ? '#8B5CF6' : optResult ? '#80f0c8' : '#2a2040',
            boxShadow: optimizing ? '0 0 8px #8B5CF6' : 'none', transition: 'all 0.3s' }} />
          <span style={monoLabel(0.6, '#8B5CF6')}>GENERATIVE DESIGN</span>
        </div>
        {optimizing && <span style={monoLabel(0.6, 'rgba(139,92,246,0.7)')}>{optProgress}%</span>}
      </div>

      {/* Material */}
      <Section label="MATERIAL" accent="#8B5CF6">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {MATERIALS.map(m => (
            <button key={m.id} onClick={() => setMaterial(m.id)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 9px', textAlign: 'left', width: '100%',
              background: material === m.id ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${material === m.id ? 'rgba(139,92,246,0.38)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 5, cursor: 'pointer', transition: 'all 0.14s',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                color: material === m.id ? '#c4b0ff' : 'rgba(255,255,255,0.5)' }}>{m.label}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)' }}>{m.yield}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'rgba(255,255,255,0.18)' }}>{m.density}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Lattice infill */}
      <Section label="LATTICE INFILL" accent="#8B5CF6">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {LATTICE_TYPES.map(l => (
            <button key={l.id} onClick={() => setLatticeType(l.id)} style={{
              padding: '9px 8px', textAlign: 'center',
              background: latticeType === l.id ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.025)',
              border: `1px solid ${latticeType === l.id ? 'rgba(139,92,246,0.42)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: '1.05rem', marginBottom: 3 }}>{l.icon}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
                color: latticeType === l.id ? '#c4b0ff' : 'rgba(255,255,255,0.4)' }}>{l.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
                color: 'rgba(255,255,255,0.2)', marginTop: 2, lineHeight: 1.4 }}>{l.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Load constraints */}
      <Section label="LOAD CONSTRAINTS" accent="#8B5CF6">
        <div style={{ padding: '9px 10px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 6 }}>
          {LOAD_CASES.map(({ icon, label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: '0.75rem', width: 16 }}>{icon}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', flex: 1 }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color }}>{value}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Optimization progress */}
      <AnimatePresence>
        {(optimizing || optResult) && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Section label="OPTIMIZATION RESULT" accent="#8B5CF6">
              <div style={{ height: 2, background: 'rgba(139,92,246,0.12)', borderRadius: 1, overflow: 'hidden', marginBottom: 8 }}>
                <motion.div
                  animate={{ width: `${optProgress}%` }}
                  transition={{ duration: 0.4 }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, rgba(139,92,246,0.5), #8B5CF6)', borderRadius: 1, boxShadow: '0 0 8px rgba(139,92,246,0.5)' }}
                />
              </div>

              {optResult && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', padding: '10px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 6 }}>
                  {[
                    ['Mass Reduction',    `${optResult.massReduction}%`,  '#80f0c8'],
                    ['Stiffness Kept',    `${optResult.stiffness}%`,      '#c4b0ff'],
                    ['Safety Factor',     `${optResult.safetyFactor}×`,   '#fde68a'],
                    ['FEA Iterations',    `${optResult.iterations}`,       '#80f0e0'],
                  ].map(([k, v, c]) => (
                    <div key={k}>
                      <div style={monoLabel(0.53, 'rgba(255,255,255,0.28)', '2px')}>{k}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: c, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optimize button */}
      <div style={{ marginTop: 'auto' }}>
        {optimizing ? (
          <button onClick={cancelOptimization} style={actionBtnStyle(false, '#8B5CF6')}>■  Cancel Optimization</button>
        ) : (
          <button onClick={startOptimization} style={actionBtnStyle(true, '#8B5CF6')}>
            {optResult ? '↺  Re-optimize Topology' : '⚡  Run Topology Optimization'}
          </button>
        )}
        {optResult && (
          <button style={{ ...actionBtnStyle(false, '#8B5CF6'), marginTop: 6 }}>↓  Export Optimized Mesh</button>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'rgba(255,255,255,0.22)',
        letterSpacing: '0.11em', textTransform: 'uppercase', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  )
}

const monoLabel = (size, color, mb = '0') => ({
  fontFamily: 'var(--font-mono)', fontSize: `${size}rem`,
  color, letterSpacing: '0.08em', display: 'block', marginBottom: mb,
})

const actionBtnStyle = (primary, accent) => ({
  width: '100%', padding: '10px 0', textAlign: 'center',
  background: primary ? `rgba(${hexToRgb(accent)},0.12)` : 'rgba(255,255,255,0.03)',
  border: `1px solid ${primary ? `rgba(${hexToRgb(accent)},0.45)` : 'rgba(255,255,255,0.07)'}`,
  borderRadius: 6,
  color: primary ? lighten(accent) : 'rgba(255,255,255,0.4)',
  fontFamily: 'var(--font-mono)', fontSize: '0.64rem', letterSpacing: '0.08em',
  cursor: 'pointer', transition: 'all 0.2s',
  boxShadow: primary ? `0 0 20px rgba(${hexToRgb(accent)},0.12)` : 'none',
})

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
function lighten(hex) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 60)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 60)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 60)
  return `rgb(${r},${g},${b})`
}
