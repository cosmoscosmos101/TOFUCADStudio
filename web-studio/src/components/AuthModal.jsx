import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

const backdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.25 },
}

const modal = {
  initial: { opacity: 0, scale: 0.92, y: 24 },
  animate: { opacity: 1, scale: 1,    y: 0  },
  exit:    { opacity: 0, scale: 0.95, y: 12 },
  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${active ? 'var(--cyan)' : 'transparent'}`,
        color: active ? 'var(--cyan)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-ui)',
        fontWeight: 700,
        fontSize: '0.85rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all 150ms',
        boxShadow: active ? '0 2px 12px var(--cyan-glow)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function Field({ label, type = 'text', placeholder, autoFocus }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
      }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="input"
      />
    </div>
  )
}

export default function AuthModal({ onClose, initialMode = 'login' }) {
  const [tab, setTab] = useState(initialMode) // 'login' | 'register'

  return (
    <motion.div
      key="backdrop"
      {...backdrop}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,2,9,0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        key="modal"
        {...modal}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
          boxShadow: '0 0 60px rgba(0,229,255,0.12), 0 32px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '28px 28px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="tag tag-cyan" style={{ marginBottom: '10px', display: 'inline-block' }}>
                AUTH PORTAL
              </span>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                letterSpacing: '0.06em',
                color: 'var(--text-primary)',
              }}>
                {tab === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginTop: '4px',
              }}>
                {tab === 'login'
                  ? 'Resume your forge session.'
                  : 'Join the studio. Rank 1 awaits.'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: '1.2rem', lineHeight: 1,
                padding: '4px',
                transition: 'color 150ms',
              }}
              onMouseEnter={e => e.target.style.color = 'var(--cyan)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
            >✕</button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            marginTop: '20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <TabButton label="Login"    active={tab === 'login'}    onClick={() => setTab('login')} />
            <TabButton label="Register" active={tab === 'register'} onClick={() => setTab('register')} />
          </div>
        </div>

        {/* Form */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: tab === 'login' ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {tab === 'register' && (
            <Field label="Username" placeholder="apprentice_drafter" autoFocus />
          )}
          <Field label="Email"    type="email"    placeholder="you@forge.io" autoFocus={tab === 'login'} />
          <Field label="Password" type="password" placeholder="••••••••••••" />

          {tab === 'login' && (
            <div style={{ textAlign: 'right' }}>
              <a style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                letterSpacing: '0.06em',
                textDecoration: 'none',
              }}
              onMouseEnter={e => e.target.style.color = 'var(--cyan)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
              >
                Forgot password?
              </a>
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
            {tab === 'login' ? '⚡ Enter Studio' : '🚀 Create & Enter'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="divider" style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>OR</span>
            <div className="divider" style={{ flex: 1 }} />
          </div>

          {/* OAuth */}
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* XP incentive */}
          {tab === 'register' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'rgba(255,215,64,0.06)',
              border: '1px solid rgba(255,215,64,0.2)',
              clipPath: 'var(--clip-tag)',
            }}>
              <span style={{ fontSize: '1.2rem' }}>🏆</span>
              <div>
                <div style={{
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  color: 'var(--gold)',
                  letterSpacing: '0.06em',
                }}>+500 XP SIGN-UP BONUS</div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                }}>Instantly reach Rank 2: Apprentice</div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
