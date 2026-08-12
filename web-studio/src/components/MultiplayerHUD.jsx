import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGitStore } from '../hooks/useGitStore'

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function AvatarChip({ collab }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <motion.div
        animate={{ boxShadow: [`0 0 6px ${collab.color}60`, `0 0 14px ${collab.color}90`, `0 0 6px ${collab.color}60`] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${collab.color}80, ${collab.color}30)`,
          border: `2px solid ${collab.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: '0.7rem',
          color: '#fff',
          fontWeight: 700,
          cursor: 'default',
          position: 'relative',
        }}
      >
        {collab.avatar}
        {/* Online dot */}
        <div style={{
          position: 'absolute',
          bottom: -1, right: -1,
          width: 7, height: 7,
          borderRadius: '50%',
          background: 'var(--success)',
          border: '1px solid var(--bg-base)',
          boxShadow: '0 0 4px var(--success)',
        }} />
      </motion.div>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '110%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--bg-elevated)',
              border: `1px solid ${collab.color}50`,
              padding: '6px 10px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              zIndex: 200,
              boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 8px ${collab.color}30`,
            }}
          >
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '0.78rem', color: collab.color }}>{collab.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              ⑂ {collab.activeBranch} · {collab.tool}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function MultiplayerHUD() {
  const { collaborators, activity } = useGitStore()
  const [showFeed, setShowFeed] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
      {/* Live badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: 'var(--success)',
            boxShadow: '0 0 6px var(--success)',
          }}
        />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          letterSpacing: '0.1em',
          color: 'var(--success)',
        }}>LIVE</span>
      </div>

      {/* Avatar stack */}
      <div style={{ display: 'flex', gap: '-6px' }}>
        {collaborators.map((c, i) => (
          <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: collaborators.length - i }}>
            <AvatarChip collab={c} />
          </div>
        ))}
      </div>

      {/* Count + activity trigger */}
      <button
        onClick={() => setShowFeed(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          background: showFeed ? 'var(--cyan-dim)' : 'transparent',
          border: `1px solid ${showFeed ? 'var(--border-active)' : 'var(--border-subtle)'}`,
          color: showFeed ? 'var(--cyan)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          letterSpacing: '0.06em',
          cursor: 'pointer',
          borderRadius: '3px',
          transition: 'all 150ms',
        }}
      >
        {collaborators.length} online · 📡
      </button>

      {/* Activity feed dropdown */}
      <AnimatePresence>
        {showFeed && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: '110%',
              right: 0,
              width: 310,
              background: 'var(--bg-modal)',
              border: '1px solid var(--border-default)',
              backdropFilter: 'blur(16px)',
              zIndex: 100,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(0,229,255,0.05)',
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
            }}
          >
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                LIVE ACTIVITY
              </span>
            </div>

            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {activity.map(a => (
                <div key={a.id} style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '8px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  alignItems: 'flex-start',
                }}>
                  {/* Color dot for user */}
                  <div style={{
                    width: 6, height: 6,
                    borderRadius: '50%',
                    background: (collaborators.find(c => c.name === a.user) ?? { color: 'var(--cyan)' }).color,
                    flexShrink: 0,
                    marginTop: '5px',
                  }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)' }}>{a.user} </span>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{a.msg}</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '2px' }}>{timeAgo(a.ts)} ago</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
