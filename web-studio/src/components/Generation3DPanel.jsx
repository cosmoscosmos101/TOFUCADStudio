import { motion, AnimatePresence } from 'framer-motion'
import { useAIGeneration } from '../hooks/useAIGeneration'

const TYPE_OPTIONS = [
  { id: 'game',    icon: '🎮', label: 'Game Asset',  sub: 'PBR · Riggable · LODs' },
  { id: 'print',   icon: '🖨', label: '3D Print',    sub: 'Watertight · Manifold'  },
  { id: 'concept', icon: '💡', label: 'Concept',     sub: 'Sketch-grade · Fast'   },
]

const FORMAT_MAP = {
  game:    ['GLB', 'FBX', 'OBJ'],
  print:   ['STL', '3MF', 'OBJ'],
  concept: ['GLB', 'OBJ'],
}

export default function Generation3DPanel() {
  const {
    status, progress, currentPhase, generationType, quality, outputFormat, stats, attachedImage,
    setType, setQuality, setFormat, startGeneration, cancelGeneration, resetGeneration,
  } = useAIGeneration()

  const isGenerating = status === 'generating'
  const isComplete   = status === 'complete'
  const formats      = FORMAT_MAP[generationType] || FORMAT_MAP.game

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14, scrollbarWidth: 'thin' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%',
            background: isGenerating ? '#00F0FF' : isComplete ? '#80f0c8' : '#2a3040',
            boxShadow: isGenerating ? '0 0 8px #00F0FF' : 'none', transition: 'all 0.3s' }} />
          <span style={monoLabel(0.6, '#00F0FF')}>AI 3D GENERATOR</span>
        </div>
        {(isGenerating || isComplete) && (
          <span style={monoLabel(0.6, isComplete ? '#80f0c8' : 'rgba(0,240,255,0.6)')}>
            {progress}%
          </span>
        )}
      </div>

      {/* Reference image */}
      {attachedImage && (
        <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(0,240,255,0.2)', height: 80, flexShrink: 0 }}>
          <img src={attachedImage.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Reference" />
          <div style={{ padding: '3px 6px', background: 'rgba(0,0,0,0.7)', marginTop: -22, position: 'relative' }}>
            <span style={monoLabel(0.52, 'rgba(0,240,255,0.7)')}>IMAGE-TO-3D REFERENCE</span>
          </div>
        </div>
      )}

      {/* Type selector */}
      <Section label="OUTPUT TYPE">
        {TYPE_OPTIONS.map(t => (
          <TypeBtn key={t.id} {...t}
            active={generationType === t.id}
            onClick={() => setType(t.id)}
            disabled={isGenerating}
          />
        ))}
      </Section>

      {/* Quality */}
      <Section label="QUALITY">
        <div style={{ display: 'flex', gap: 5 }}>
          {['draft', 'standard', 'high'].map(q => (
            <PillBtn key={q} label={q} active={quality === q}
              onClick={() => setQuality(q)} disabled={isGenerating} />
          ))}
        </div>
      </Section>

      {/* Format */}
      <Section label="EXPORT FORMAT">
        <div style={{ display: 'flex', gap: 5 }}>
          {formats.map(f => (
            <PillBtn key={f} label={f}
              active={outputFormat.toUpperCase() === f}
              onClick={() => setFormat(f.toLowerCase())}
              disabled={isGenerating} />
          ))}
        </div>
      </Section>

      <div style={{ height: 1, background: 'rgba(0,240,255,0.07)' }} />

      {/* Generation progress */}
      <AnimatePresence>
        {(isGenerating || isComplete) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Section label="GENERATION PROGRESS">
              <div style={{ height: 2, background: 'rgba(0,240,255,0.08)', borderRadius: 1, marginBottom: 7, overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, rgba(0,240,255,0.5), #00F0FF)', borderRadius: 1, boxShadow: '0 0 8px rgba(0,240,255,0.5)' }}
                />
              </div>
              <div style={monoLabel(0.57, 'rgba(255,255,255,0.35)')}>{currentPhase}</div>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mesh stats */}
      <AnimatePresence>
        {isComplete && stats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Section label="MESH STATISTICS">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', padding: '10px', background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.1)', borderRadius: 6 }}>
                {[
                  ['Vertices',  stats.verts?.toLocaleString()],
                  ['Triangles', stats.tris?.toLocaleString()],
                  ['Textures',  stats.textures],
                  ['File Size', stats.size],
                  ...(stats.watertight ? [['Watertight', '✓ Manifold']] : []),
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={monoLabel(0.53, 'rgba(255,255,255,0.28)', '0 0 2px')}>{k}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
                      color: k === 'Watertight' ? '#80f0c8' : 'var(--text-primary)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isComplete && (
          <ActionBtn label={`↓  Download .${outputFormat.toUpperCase()}`} primary
            onClick={() => alert('Export pipeline: connect to backend mesh server')} />
        )}
        {isGenerating && <ActionBtn label="■  Cancel" onClick={cancelGeneration} />}
        {isComplete   && <ActionBtn label="↺  New Generation" onClick={resetGeneration} />}
        {status === 'idle' && <ActionBtn label="⚡  Generate" primary onClick={startGeneration} />}
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{ ...monoLabel(0.54, 'rgba(255,255,255,0.22)'), marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.11em' }}>{label}</div>
      {children}
    </div>
  )
}

function TypeBtn({ icon, label, sub, active, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', marginBottom: 5,
      background: active ? 'rgba(0,240,255,0.09)' : 'rgba(255,255,255,0.025)',
      border: `1px solid ${active ? 'rgba(0,240,255,0.38)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 6, cursor: disabled ? 'default' : 'pointer', textAlign: 'left', width: '100%',
      transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
    }}>
      <span style={{ fontSize: '0.9rem', width: 20, textAlign: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem',
          color: active ? '#00F0FF' : 'var(--text-primary)', letterSpacing: '0.03em' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em' }}>{sub}</div>
      </div>
    </button>
  )
}

function PillBtn({ label, active, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, padding: '5px 0',
      background: active ? 'rgba(0,240,255,0.1)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${active ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 4, color: active ? '#00F0FF' : 'rgba(255,255,255,0.38)',
      fontFamily: 'var(--font-mono)', fontSize: '0.59rem',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      cursor: disabled ? 'default' : 'pointer', transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
    }}>
      {label}
    </button>
  )
}

function ActionBtn({ label, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 0', width: '100%', textAlign: 'center',
      background: primary ? 'rgba(0,240,255,0.1)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${primary ? 'rgba(0,240,255,0.42)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 6, color: primary ? '#00F0FF' : 'rgba(255,255,255,0.45)',
      fontFamily: 'var(--font-mono)', fontSize: '0.64rem', letterSpacing: '0.08em',
      cursor: 'pointer', transition: 'all 0.2s',
      boxShadow: primary ? '0 0 20px rgba(0,240,255,0.1)' : 'none',
    }}>
      {label}
    </button>
  )
}

const monoLabel = (size, color, mb = '0') => ({
  fontFamily: 'var(--font-mono)', fontSize: `${size}rem`,
  color, letterSpacing: '0.08em', display: 'block', marginBottom: mb,
})
