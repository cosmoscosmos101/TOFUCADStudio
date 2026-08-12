import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../hooks/useAuthStore'

function StorageBar({ used = 1.2, total = 5 }) {
  const pct = Math.min((used / total) * 100, 100)
  const color = pct > 80 ? '#ff5252' : pct > 60 ? '#ffd740' : '#00e5ff'
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-secondary)', letterSpacing:'0.1em' }}>STORAGE</span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color }}>
          {used} GB / {total} GB
        </span>
      </div>
      <div style={{ height:3, background:'var(--bg-elevated)', borderRadius:2, overflow:'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height:'100%', background: color, boxShadow:`0 0 6px ${color}80` }}
        />
      </div>
    </div>
  )
}

function Avatar({ user }) {
  const initials = (user?.displayName || user?.username || '?').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: 'linear-gradient(135deg, #00e5ff40, #e040fb40)',
      border: '2px solid var(--cyan)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--cyan)',
      boxShadow: '0 0 20px rgba(0,229,255,0.3)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {user?.avatarUrl
        ? <img src={user.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        : initials}
    </div>
  )
}

const MOCK_PROJECTS = [
  { id: 1, title: 'Suspension Bracket v3', thumb: '🔩', forks: 4 },
  { id: 2, title: 'Cooling Fan Assembly',  thumb: '⚙️',  forks: 1 },
  { id: 3, title: 'Gear Train Concept',    thumb: '🦷', forks: 7 },
]

export default function ProfileDrawer({ open, onClose }) {
  const { user, logout } = useAuthStore()
  const [projects] = useState(MOCK_PROJECTS)

  const handleLogout = async () => {
    await logout()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position:'fixed', inset:0, background:'rgba(2,2,9,0.6)', backdropFilter:'blur(4px)', zIndex:400 }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 340,
              background: 'var(--bg-modal)',
              borderLeft: '1px solid var(--border-default)',
              backdropFilter: 'blur(20px)',
              zIndex: 500,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header bar */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--cyan)', letterSpacing:'0.12em', textTransform:'uppercase' }}>PROFILE</span>
              <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:'1rem' }}>✕</button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              {user ? (
                <>
                  {/* Identity */}
                  <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:20 }}>
                    <Avatar user={user} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'var(--font-ui)', fontWeight:700, fontSize:'1rem', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.displayName || user.username}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-secondary)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis' }}>@{user.username}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-dim)', overflow:'hidden', textOverflow:'ellipsis' }}>{user.email}</div>
                    </div>
                  </div>

                  {/* XP / Level */}
                  <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                    {[
                      { label:'LEVEL', value: user.level ?? 1, color:'var(--cyan)' },
                      { label:'XP', value: (user.xpPoints ?? 500).toLocaleString(), color:'var(--gold)' },
                      { label:'STREAK', value:`${user.streak ?? 0}d`, color:'var(--magenta)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ flex:1, padding:'8px 10px', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:4, textAlign:'center' }}>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.55rem', color:'var(--text-dim)', letterSpacing:'0.1em', marginBottom:3 }}>{label}</div>
                        <div style={{ fontFamily:'var(--font-display)', fontSize:'1rem', color }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Storage */}
                  <div style={{ padding:'12px 14px', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:4, marginBottom:16 }}>
                    <StorageBar />
                  </div>

                  {/* Saved Projects */}
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>SAVED PROJECTS</div>
                    {projects.map(p => (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', marginBottom:4, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:4, cursor:'pointer', transition:'border-color 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-active)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-subtle)'}
                      >
                        <span style={{ fontSize:'1.1rem' }}>{p.thumb}</span>
                        <span style={{ flex:1, fontFamily:'var(--font-ui)', fontSize:'0.8rem', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</span>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-dim)' }}>⑂{p.forks}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:12 }}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-secondary)', letterSpacing:'0.1em' }}>NOT LOGGED IN</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-dim)' }}>Sign in to save your work</div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
              {user ? (
                <>
                  <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:'0.8rem' }}>
                    ⚙ Account Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{ width:'100%', padding:'8px', background:'rgba(255,82,82,0.08)', border:'1px solid rgba(255,82,82,0.3)', color:'#ff5252', fontFamily:'var(--font-mono)', fontSize:'0.75rem', letterSpacing:'0.08em', cursor:'pointer', borderRadius:3, transition:'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(255,82,82,0.18)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(255,82,82,0.08)' }}
                  >
                    ⬡ SIGN OUT
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', fontSize:'0.8rem' }}>
                  Sign In
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
