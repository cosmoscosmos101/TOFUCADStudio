import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAIGeneration } from '../hooks/useAIGeneration'

const SUGGESTED_TAGS = ['#GameChar', '#3DPrint', '#HighPoly', '#Riggable', '#LowPoly', '#Mech', '#Organic', '#Watertight', '#Scifi', '#Fantasy']

const PLACEHOLDER_CYCLE = [
  'a cyberpunk mech helmet for 3D printing…',
  'a low-poly fantasy sword for a mobile game…',
  'an organic alien creature with subsurface detail…',
  'a modular sci-fi building facade panel…',
  'a futuristic spacecraft engine housing…',
]

function SpinnerDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle' }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          style={{ width: 3, height: 3, borderRadius: '50%', background: '#00F0FF', display: 'inline-block' }}
        />
      ))}
    </span>
  )
}

export default function AIPromptBar({ visible, onGenerate }) {
  const {
    prompt, enhancedPrompt, status, tags,
    setPrompt, addTag, removeTag, enhancePrompt, startGeneration, setImage,
  } = useAIGeneration()

  const [focused,      setFocused]      = useState(false)
  const [dragging,     setDragging]     = useState(false)
  const [hintIdx,      setHintIdx]      = useState(0)
  const [showEnhanced, setShowEnhanced] = useState(false)
  const [thumbUrl,     setThumbUrl]     = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setHintIdx(i => (i + 1) % PLACEHOLDER_CYCLE.length), 3500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (enhancedPrompt && status === 'idle') setShowEnhanced(true)
  }, [enhancedPrompt, status])

  const isEnhancing = status === 'enhancing'
  const isGenerating = status === 'generating'
  const activePrompt = showEnhanced ? enhancedPrompt : prompt
  const canSend = activePrompt.trim().length > 3 && !isGenerating

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer?.files[0]
    if (file?.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setImage({ file, url }); setThumbUrl(url)
    }
  }, [setImage])

  const handleFileChange = useCallback((e) => {
    const f = e.target.files[0]
    if (f) { const url = URL.createObjectURL(f); setImage({ file: f, url }); setThumbUrl(url) }
  }, [setImage])

  const handleSend = useCallback(() => {
    if (!canSend) return
    if (showEnhanced) setPrompt(enhancedPrompt)
    startGeneration()
    onGenerate?.()
  }, [canSend, showEnhanced, enhancedPrompt, setPrompt, startGeneration, onGenerate])

  if (!visible) return null

  const borderColor = dragging ? 'rgba(0,240,255,0.8)'
    : focused ? 'rgba(0,240,255,0.45)'
    : 'rgba(255,255,255,0.09)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(740px, calc(100% - 56px))',
        zIndex: 60,
        pointerEvents: 'auto',
      }}
    >
      {/* Tag pills */}
      <AnimatePresence>
        {(focused || tags.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8, padding: '0 2px' }}
          >
            {tags.map(tag => (
              <span key={tag} onClick={() => removeTag(tag)} style={pillStyle(true)}>{tag} ×</span>
            ))}
            {focused && SUGGESTED_TAGS.filter(t => !tags.includes(t)).slice(0, 6).map(tag => (
              <span key={tag} onClick={() => addTag(tag)} style={pillStyle(false)}>{tag}</span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          background: 'rgba(8,9,14,0.94)',
          backdropFilter: 'blur(28px)',
          border: `1px solid ${borderColor}`,
          borderRadius: 12,
          boxShadow: focused
            ? '0 0 0 3px rgba(0,240,255,0.07), 0 28px 64px rgba(0,0,0,0.75), 0 0 48px rgba(0,240,255,0.07)'
            : '0 20px 52px rgba(0,0,0,0.65)',
          transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Subtle top glow line */}
        <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
          background: focused ? 'linear-gradient(90deg, transparent, rgba(0,240,255,0.4), transparent)' : 'transparent',
          transition: 'background 0.25s', pointerEvents: 'none' }}
        />

        {/* Enhanced prompt display */}
        <AnimatePresence>
          {showEnhanced && enhancedPrompt && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ borderBottom: '1px solid rgba(0,240,255,0.1)', overflow: 'hidden' }}
            >
              <div style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginTop: 2 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00F0FF', boxShadow: '0 0 6px #00F0FF' }} />
                  <span style={monoText(0.58, '#00F0FF', '0.1em')}>AI ENHANCED</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, flex: 1 }}>
                  {enhancedPrompt}
                </span>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => { setPrompt(enhancedPrompt); setShowEnhanced(false) }} style={ghostBtn('#00F0FF')}>use →</button>
                  <button onClick={() => setShowEnhanced(false)} style={ghostBtn('rgba(255,255,255,0.2)')}>✕</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reference image thumbnail */}
        {thumbUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <img src={thumbUrl} style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', border: '1px solid rgba(0,240,255,0.2)' }} alt="" />
            <span style={monoText(0.6, 'rgba(255,255,255,0.4)')}>Image-to-3D reference attached</span>
            <button onClick={() => { setThumbUrl(null); setImage(null) }} style={ghostBtn('rgba(255,255,255,0.2)')}>✕</button>
          </div>
        )}

        {/* Textarea */}
        <textarea
          value={showEnhanced ? '' : prompt}
          onChange={e => { setPrompt(e.target.value); setShowEnhanced(false) }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend() }}
          placeholder={showEnhanced ? '' : `Describe your 3D model — e.g. ${PLACEHOLDER_CYCLE[hintIdx]}`}
          rows={2}
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', padding: '14px 14px 10px',
            fontFamily: 'var(--font-mono)', fontSize: '0.82rem',
            color: 'var(--text-primary)', lineHeight: 1.65,
            caretColor: '#00F0FF', boxSizing: 'border-box',
          }}
        />

        {/* Action bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => fileRef.current?.click()} title="Attach reference image (Image-to-3D)" style={iconActionBtn}>
            <span style={{ fontSize: '0.85rem' }}>🖼</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

          <span style={monoText(0.58, 'rgba(255,255,255,0.18)')}>{isGenerating ? 'Generating…' : '⌘↵ to send'}</span>

          <div style={{ flex: 1 }} />

          {/* Enhance button */}
          <motion.button
            onClick={enhancePrompt}
            disabled={!prompt.trim() || isEnhancing || isGenerating}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{
              padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(0,240,255,0.07)',
              border: '1px solid rgba(0,240,255,0.22)',
              borderRadius: 6, cursor: (!prompt.trim() || isEnhancing) ? 'default' : 'pointer',
              opacity: !prompt.trim() ? 0.4 : 1,
              fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
              letterSpacing: '0.06em', color: '#00F0FF',
              transition: 'opacity 0.15s',
            }}
          >
            {isEnhancing ? <><SpinnerDots /> Enhancing…</> : <>✨ Auto-Enhance</>}
          </motion.button>

          {/* Generate button */}
          <motion.button
            onClick={handleSend}
            disabled={!canSend}
            whileHover={{ scale: canSend ? 1.03 : 1 }}
            whileTap={{ scale: canSend ? 0.96 : 1 }}
            style={{
              padding: '6px 18px',
              background: canSend ? 'rgba(0,240,255,0.13)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${canSend ? 'rgba(0,240,255,0.5)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 6,
              color: canSend ? '#00F0FF' : 'rgba(255,255,255,0.2)',
              fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.06em',
              cursor: canSend ? 'pointer' : 'default',
              boxShadow: canSend ? '0 0 18px rgba(0,240,255,0.14)' : 'none',
              transition: 'all 0.18s',
            }}
          >
            {isGenerating ? 'Generating…' : 'Generate →'}
          </motion.button>
        </div>
      </div>

      {/* Drop overlay */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,240,255,0.06)',
              border: '2px dashed rgba(0,240,255,0.65)',
              borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <span style={monoText(0.72, '#00F0FF', '0.12em')}>DROP IMAGE FOR IMAGE-TO-3D</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const pillStyle = (active) => ({
  padding: '3px 9px', borderRadius: 20, cursor: 'pointer', userSelect: 'none',
  background: active ? 'rgba(0,240,255,0.13)' : 'rgba(255,255,255,0.04)',
  border: `1px solid ${active ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.09)'}`,
  color: active ? '#00F0FF' : 'rgba(255,255,255,0.4)',
  fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.06em', transition: 'all 0.15s',
})

const monoText = (size, color, ls = '0.04em') => ({
  fontFamily: 'var(--font-mono)', fontSize: `${size}rem`, color, letterSpacing: ls,
})

const ghostBtn = (color) => ({
  background: 'none', border: 'none', color, cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.05em',
  padding: '3px 6px', borderRadius: 4, transition: 'color 0.12s',
})

const iconActionBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '4px 6px', borderRadius: 4, lineHeight: 1,
}
