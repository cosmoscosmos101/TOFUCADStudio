import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCADHistory } from '../hooks/useCADHistory'
import { addObjectCmd } from '../hooks/useCADCommands'
import { useGitStore } from '../hooks/useGitStore'

// ── Natural Language → Parametric Parser ──────────────────
// In production: replace parseCommand() body with an API call
// to an LLM that returns a structured { type, dims, params } JSON.

function extractNum(text, keywords) {
  for (const kw of keywords) {
    const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:mm)?\\s*(?:${kw})|(${kw})\\s*(?:of\\s*|:?\\s*)(\\d+(?:\\.\\d+)?)`, 'i')
    const m = text.match(re)
    if (m) return parseFloat(m[1] ?? m[3])
  }
  const nums = text.match(/\d+(?:\.\d+)?/g)
  return nums ? parseFloat(nums[0]) : null
}

function parseCommand(text) {
  const t = text.toLowerCase()

  // Gear / Sprocket
  if (/gear|sprocket|helical|spur|bevel/.test(t)) {
    const teeth  = extractNum(t, ['teeth', 'tooth']) ?? 20
    const bore   = extractNum(t, ['bore', 'bore diameter', 'hole']) ?? 10
    const module = extractNum(t, ['module', 'mod', 'm']) ?? 2
    const r = (teeth * module) / 2 / 10   // scale to scene units
    return {
      type: 'torus', name: `Gear (T${teeth} M${module})`,
      position: [0, r, 0],
      scale:    [r, 0.3, r],
      color:    '#00e5ff',
      meta:     { teeth, bore, module },
      xp:       120,
    }
  }

  // Bolt / Screw / Fastener
  if (/bolt|screw|fastener|hex|m\d/.test(t)) {
    const size   = extractNum(t, ['m', 'diameter', 'd']) ?? 8
    const length = extractNum(t, ['length', 'l', 'long']) ?? size * 4
    return {
      type: 'cylinder', name: `M${size} Bolt`,
      scale:    [size / 20, length / 20, size / 20],
      color:    '#a0a0b0',
      meta:     { thread: `M${size}`, length },
      xp:       50,
    }
  }

  // Pipe / Tube
  if (/pipe|tube|duct|hollow cylinder/.test(t)) {
    const dia    = extractNum(t, ['diameter', 'd', 'outer']) ?? 20
    const length = extractNum(t, ['length', 'l', 'height']) ?? 60
    return {
      type: 'cylinder', name: `Tube Ø${dia}`,
      scale:    [dia / 20, length / 20, dia / 20],
      color:    '#e040fb',
      wireframe: true,
      xp:       60,
    }
  }

  // Box / Block / Plate
  if (/box|block|plate|rectangular|cube/.test(t)) {
    const parts = text.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/i)
    const w = parts ? parseFloat(parts[1]) / 20 : extractNum(t, ['width','w']) ? extractNum(t,['width','w'])/20 : 1
    const h = parts ? parseFloat(parts[2]) / 20 : extractNum(t, ['height','h']) ? extractNum(t,['height','h'])/20 : 1
    const d = parts ? parseFloat(parts[3]) / 20 : extractNum(t, ['depth','d','length']) ? extractNum(t,['depth','d','length'])/20 : 1
    return {
      type: 'box', name: `Block ${Math.round(w*20)}×${Math.round(h*20)}×${Math.round(d*20)}mm`,
      scale:    [w, h, d],
      color:    '#00e5ff',
      xp:       40,
    }
  }

  // Sphere / Ball / Dome
  if (/sphere|ball|dome|hemisphere/.test(t)) {
    const r = (extractNum(t, ['radius','r','diameter','d']) ?? 20) / 20
    return {
      type: 'sphere', name: `Sphere R${Math.round(r*20)}`,
      scale:    [r, r, r],
      color:    '#ffd740',
      xp:       40,
    }
  }

  // Cylinder / Rod / Shaft
  if (/cylinder|rod|shaft|pin|dowel/.test(t)) {
    const dia    = extractNum(t, ['diameter','d','radius','r']) ?? 20
    const height = extractNum(t, ['height','h','length','l']) ?? 60
    return {
      type: 'cylinder', name: `Shaft Ø${dia}`,
      scale:    [dia / 20, height / 20, dia / 20],
      color:    '#69ff47',
      xp:       55,
    }
  }

  return null
}

// ── Suggestion chips ──────────────────────────────────────

const SUGGESTIONS = [
  'Spur gear 20 teeth 5mm module',
  'M8 hex bolt 40mm length',
  'Box 50×30×20mm',
  'Cylinder diameter 25mm height 60mm',
  'Helical gear bore 12mm 15 teeth',
  'Pipe diameter 30mm length 100mm',
  'Sphere radius 18mm',
]

// ── Animated thinking dots ────────────────────────────────

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--cyan)' }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 0.9, delay: i * 0.2, repeat: Infinity }}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────

export default function AICommandBar() {
  const [text, setText]       = useState('')
  const [phase, setPhase]     = useState('idle')   // idle | thinking | done | error
  const [result, setResult]   = useState(null)
  const [showTips, setShowTips] = useState(false)
  const inputRef              = useRef()
  const { execute }           = useCADHistory()
  const { addActivity }       = useGitStore()

  const run = useCallback(async (cmd) => {
    const q = cmd ?? text.trim()
    if (!q) return

    setPhase('thinking')
    setShowTips(false)

    // Simulate 600–900ms "AI processing" delay
    await new Promise(r => setTimeout(r, 600 + Math.random() * 300))

    const parsed = parseCommand(q)

    if (!parsed) {
      setPhase('error')
      setResult({ message: `Could not parse: "${q}". Try e.g. "spur gear 20 teeth" or "box 50×30×20mm".` })
      setTimeout(() => setPhase('idle'), 3000)
      return
    }

    // Spawn via command system (undo-able)
    execute(addObjectCmd({
      type:      parsed.type,
      position:  parsed.position ?? [Math.random() * 4 - 2, parsed.scale?.[1] ?? 0.5, Math.random() * 4 - 2],
      scale:     parsed.scale    ?? [1, 1, 1],
      color:     parsed.color,
      wireframe: parsed.wireframe ?? false,
    }))

    addActivity('You', `AI generated: ${parsed.name}`)

    setResult(parsed)
    setPhase('done')
    setText('')
    setTimeout(() => setPhase('idle'), 3000)
  }, [text, execute, addActivity])

  const handleKey = e => {
    if (e.key === 'Enter') run()
    if (e.key === 'Escape') { setShowTips(false); setPhase('idle') }
  }

  return (
    <div style={{
      gridArea: 'aibar',
      background: 'rgba(7,7,26,0.96)',
      borderTop: '1px solid var(--border-default)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Suggestion chips — shown on focus */}
      <AnimatePresence>
        {showTips && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '0', right: '0',
              padding: '10px 16px',
              background: 'rgba(7,7,26,0.97)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              zIndex: 50,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-dim)', letterSpacing: '0.1em', alignSelf: 'center', marginRight: '4px' }}>EXAMPLES →</span>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => { setText(s); run(s); setShowTips(false) }}
                style={{
                  padding: '3px 10px',
                  background: 'var(--cyan-dim)',
                  border: '1px solid var(--border-active)',
                  color: 'var(--cyan)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  borderRadius: '2px',
                  transition: 'all 150ms',
                  clipPath: 'var(--clip-tag)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.25)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--cyan-dim)' }}
              >{s}</button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 16px',
        height: '52px',
      }}>
        {/* AI badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}>
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: phase === 'thinking' ? 'var(--gold)' : phase === 'error' ? '#ff5252' : 'var(--magenta)',
              boxShadow: `0 0 8px ${phase === 'error' ? '#ff525280' : 'var(--magenta-glow)'}`,
            }}
          />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.72rem',
            letterSpacing: '0.12em',
            color: 'var(--magenta)',
          }}>AI FORGE</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />

        {/* Input */}
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setShowTips(true)}
          onBlur={() => setTimeout(() => setShowTips(false), 200)}
          placeholder='Describe a parametric shape… e.g. "helical gear with 12mm bore, 20 teeth"'
          disabled={phase === 'thinking'}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
            fontSize: '0.9rem',
            color: phase === 'thinking' ? 'var(--text-secondary)' : 'var(--text-primary)',
            letterSpacing: '0.02em',
            caretColor: 'var(--cyan)',
          }}
        />

        {/* Status display */}
        <AnimatePresence mode="wait">
          {phase === 'thinking' && (
            <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <ThinkingDots />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan)', letterSpacing: '0.08em' }}>PARSING…</span>
            </motion.div>
          )}
          {phase === 'done' && result && (
            <motion.div key="done" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--success)', letterSpacing: '0.06em' }}>✓ +{result.xp} XP · {result.name}</span>
            </motion.div>
          )}
          {phase === 'error' && result && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#ff5252', letterSpacing: '0.04em' }}>{result.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate button */}
        <button
          onClick={() => run()}
          disabled={!text.trim() || phase === 'thinking'}
          style={{
            padding: '8px 20px',
            background: text.trim() && phase !== 'thinking'
              ? 'linear-gradient(135deg, rgba(224,64,251,0.25), rgba(224,64,251,0.1))'
              : 'transparent',
            border: `1px solid ${text.trim() && phase !== 'thinking' ? 'var(--border-magenta)' : 'var(--border-subtle)'}`,
            color: text.trim() && phase !== 'thinking' ? 'var(--magenta)' : 'var(--text-dim)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: '0.78rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: text.trim() && phase !== 'thinking' ? 'pointer' : 'not-allowed',
            borderRadius: '3px',
            flexShrink: 0,
            transition: 'all 150ms',
            boxShadow: text.trim() && phase !== 'thinking' ? '0 0 12px var(--magenta-glow)' : 'none',
          }}
        >
          ⚡ Generate
        </button>
      </div>
    </div>
  )
}
