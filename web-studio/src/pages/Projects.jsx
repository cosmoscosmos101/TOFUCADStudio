import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'
import { useProjectsStore } from '../hooks/useProjectsStore'
import ProfileDrawer from '../components/ProfileDrawer'

/* ── Constants ── */
const CAD_TYPES = ['ALL', 'MIXED', 'SKETCH_2D', 'MODEL_3D', 'ASSEMBLY']
const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Recent' },
  { value: 'likeCount', label: 'Likes' },
  { value: 'forkCount', label: 'Forks' },
  { value: 'viewCount', label: 'Views' },
]

const TYPE_META = {
  MIXED:     { label: 'Mixed',    color: '#c4b0ff', icon: '◈' },
  SKETCH_2D: { label: '2D',       color: '#80f0e0', icon: '⬡' },
  MODEL_3D:  { label: '3D',       color: '#ffadd4', icon: '⬡' },
  ASSEMBLY:  { label: 'Assembly', color: '#fde68a', icon: '✦' },
}

/* ── New Project Modal ── */
function NewProjectModal({ onClose, onCreate }) {
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [cadType, setCadType]       = useState('MIXED')
  const [isPublic, setIsPublic]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true)
    setError(null)
    try {
      await onCreate({ title: title.trim(), description: description.trim() || undefined, cadType, isPublic })
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(2,2,9,0.85)', backdropFilter:'blur(12px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}
    >
      <motion.div
        initial={{ opacity:0, scale:0.93, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.96, y:10 }}
        transition={{ duration:0.28, ease:[0.4,0,0.2,1] }}
        onClick={e => e.stopPropagation()}
        style={{ width:'100%', maxWidth:460, background:'var(--bg-surface)', border:'1px solid var(--border-default)', clipPath:'polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))', boxShadow:'0 0 60px rgba(196,176,255,0.1),0 32px 64px rgba(0,0,0,0.6)', overflow:'hidden' }}
      >
        {/* Header */}
        <div style={{ padding:'24px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--cyan)', letterSpacing:'0.14em', textTransform:'uppercase' }}>New Project</span>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', letterSpacing:'0.06em', color:'var(--text-primary)', marginTop:6 }}>Initialize Design</h2>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:'1.1rem' }}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding:'20px 24px 24px', display:'flex', flexDirection:'column', gap:16 }}>
          {/* Title */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-secondary)' }}>Title *</label>
            <input className="input" placeholder="Suspension Bracket v2" value={title} onChange={e => setTitle(e.target.value)} disabled={loading} autoFocus />
          </div>

          {/* Description */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-secondary)' }}>Description</label>
            <textarea
              className="input" placeholder="What are you designing?" value={description} onChange={e => setDescription(e.target.value)} disabled={loading}
              style={{ resize:'vertical', minHeight:72, lineHeight:1.5 }}
            />
          </div>

          {/* CAD Type */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-secondary)' }}>Type</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['MIXED','SKETCH_2D','MODEL_3D','ASSEMBLY'].map(t => {
                const m = TYPE_META[t]
                const active = cadType === t
                return (
                  <button key={t} type="button" onClick={() => setCadType(t)}
                    style={{ padding:'5px 12px', fontFamily:'var(--font-mono)', fontSize:'0.65rem', letterSpacing:'0.08em', cursor:'pointer', borderRadius:2, transition:'all 150ms', background: active ? `${m.color}18` : 'transparent', border: `1px solid ${active ? m.color : 'var(--border-subtle)'}`, color: active ? m.color : 'var(--text-secondary)' }}
                  >{m.label}</button>
                )
              })}
            </div>
          </div>

          {/* Visibility */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:2, cursor:'pointer' }} onClick={() => setIsPublic(p => !p)}>
            <div style={{ width:32, height:18, borderRadius:9, background: isPublic ? 'rgba(196,176,255,0.4)' : 'var(--bg-surface)', border:`1px solid ${isPublic ? 'var(--cyan)' : 'var(--border-default)'}`, position:'relative', flexShrink:0, transition:'all 200ms' }}>
              <motion.div animate={{ x: isPublic ? 14 : 2 }} transition={{ type:'spring', stiffness:400, damping:28 }}
                style={{ position:'absolute', top:2, width:12, height:12, borderRadius:'50%', background: isPublic ? 'var(--cyan)' : 'var(--text-secondary)', boxShadow: isPublic ? '0 0 6px var(--cyan-glow)' : 'none' }}
              />
            </div>
            <div>
              <div style={{ fontFamily:'var(--font-ui)', fontSize:'0.8rem', color:'var(--text-primary)' }}>{isPublic ? 'Public' : 'Private'}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-secondary)', marginTop:1 }}>{isPublic ? 'Visible in community gallery' : 'Only you can see this'}</div>
            </div>
          </div>

          {error && (
            <div style={{ padding:'8px 12px', background:'rgba(255,82,82,0.08)', border:'1px solid rgba(255,82,82,0.3)', color:'#ff5252', fontFamily:'var(--font-mono)', fontSize:'0.7rem', borderRadius:2 }}>
              ⚠ {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'13px', opacity: loading ? 0.6 : 1 }}>
            {loading ? '...' : '✦ Create Project'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

/* ── Project Card ── */
function ProjectCard({ project, onOpen, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const meta = TYPE_META[project.cadType] || TYPE_META.MIXED

  const fmt = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : n

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <motion.div
      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.35, ease:'easeOut' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false) }}
      style={{
        position: 'relative',
        background: 'linear-gradient(145deg,rgba(16,14,42,0.95),rgba(11,9,33,0.98))',
        border: `1px solid ${hovered ? `${meta.color}44` : 'var(--border-subtle)'}`,
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'border-color 200ms, box-shadow 200ms',
        boxShadow: hovered ? `0 0 28px rgba(196,176,255,0.1),0 8px 32px rgba(0,0,0,0.5)` : 'none',
        cursor: 'default',
      }}
    >
      {/* Corner marks */}
      <div style={{ position:'absolute', top:0, left:0, width:10, height:10, borderTop:`1.5px solid ${meta.color}55`, borderLeft:`1.5px solid ${meta.color}55` }} />
      <div style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderBottom:`1.5px solid ${meta.color}55`, borderRight:`1.5px solid ${meta.color}55` }} />

      {/* Thumbnail area */}
      <div style={{ height:120, background:`linear-gradient(135deg,${meta.color}0a,${meta.color}18)`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
        <span style={{ fontSize:'2.8rem', opacity:0.35 }}>{meta.icon}</span>
        {/* Visibility badge */}
        <div style={{ position:'absolute', top:8, right:8, padding:'2px 8px', background: project.isPublic ? 'rgba(128,240,200,0.12)' : 'rgba(196,176,255,0.08)', border:`1px solid ${project.isPublic ? 'rgba(128,240,200,0.3)' : 'var(--border-subtle)'}`, fontFamily:'var(--font-mono)', fontSize:'0.55rem', color: project.isPublic ? 'var(--aqua)' : 'var(--text-dim)', letterSpacing:'0.1em', textTransform:'uppercase', borderRadius:1 }}>
          {project.isPublic ? 'Public' : 'Private'}
        </div>
        {/* Type badge */}
        <div style={{ position:'absolute', top:8, left:8, padding:'2px 8px', background:`${meta.color}14`, border:`1px solid ${meta.color}44`, fontFamily:'var(--font-mono)', fontSize:'0.55rem', color: meta.color, letterSpacing:'0.1em', borderRadius:1 }}>
          {meta.label}
        </div>

        {/* Hover overlay — action buttons */}
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
              style={{ position:'absolute', inset:0, background:'rgba(6,6,18,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
            >
              <button onClick={() => onOpen(project)} className="btn btn-primary" style={{ fontSize:'0.7rem', padding:'6px 14px' }}>⚡ Open Studio</button>
              {!confirmDelete
                ? <button onClick={() => setConfirmDelete(true)} style={{ padding:'6px 12px', background:'rgba(255,82,82,0.08)', border:'1px solid rgba(255,82,82,0.3)', color:'#ff5252', fontFamily:'var(--font-mono)', fontSize:'0.65rem', cursor:'pointer', borderRadius:2, transition:'all 150ms' }}>✕</button>
                : <button onClick={() => onDelete(project.id)} style={{ padding:'6px 12px', background:'rgba(255,82,82,0.2)', border:'1px solid rgba(255,82,82,0.6)', color:'#ff5252', fontFamily:'var(--font-mono)', fontSize:'0.65rem', cursor:'pointer', borderRadius:2 }}>Confirm</button>
              }
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Body */}
      <div style={{ padding:'14px 16px 16px' }}>
        <div style={{ fontFamily:'var(--font-ui)', fontWeight:600, fontSize:'0.9rem', color:'var(--text-primary)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {project.title}
        </div>
        {project.description && (
          <div style={{ fontFamily:'var(--font-body)', fontSize:'0.76rem', fontWeight:300, color:'var(--text-secondary)', lineHeight:1.5, marginBottom:10, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {project.description}
          </div>
        )}

        {/* Tags */}
        {project.tags?.length > 0 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
            {project.tags.slice(0,4).map(tag => (
              <span key={tag} style={{ padding:'2px 7px', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-secondary)', letterSpacing:'0.06em', borderRadius:1 }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop: project.tags?.length ? 0 : 8 }}>
          <div style={{ display:'flex', gap:12 }}>
            {[['👁', fmt(project.viewCount)], ['⑂', fmt(project.forkCount)], ['♥', fmt(project.likeCount)]].map(([icon, val]) => (
              <span key={icon} style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-dim)', display:'flex', alignItems:'center', gap:3 }}>
                {icon} {val}
              </span>
            ))}
          </div>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-dim)' }}>
            {timeAgo(project.updatedAt)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Topnav ── */
function Topnav({ user, onProfileOpen }) {
  const navigate = useNavigate()
  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', background:'rgba(6,6,18,0.9)', borderBottom:'1px solid rgba(196,176,255,0.1)', backdropFilter:'blur(16px)' }}>
      {/* Logo */}
      <button onClick={() => navigate('/')} style={{ display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer', padding:0 }}>
        <div style={{ width:20, height:20, background:'linear-gradient(135deg,#c4b0ff,#ffadd4)', clipPath:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)', boxShadow:'0 0 12px rgba(196,176,255,0.5)' }} />
        <span style={{ fontFamily:'var(--font-display)', fontSize:'0.72rem', letterSpacing:'0.14em', background:'linear-gradient(135deg,#ddd0ff,#ffadd4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>TOFU CAD</span>
      </button>

      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-dim)' }}>Home</span>
        <span style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>›</span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--cyan)', letterSpacing:'0.1em' }}>PROJECTS</span>
      </div>

      {/* User chip */}
      {user && (
        <button onClick={onProfileOpen}
          style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(196,176,255,0.08)', border:'1px solid rgba(196,176,255,0.28)', color:'#c4b0ff', fontFamily:'var(--font-ui)', fontSize:'0.68rem', letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', padding:'5px 14px 5px 8px', borderRadius:1, transition:'all 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(196,176,255,0.5)'; e.currentTarget.style.background='rgba(196,176,255,0.14)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(196,176,255,0.28)'; e.currentTarget.style.background='rgba(196,176,255,0.08)' }}
        >
          <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#c4b0ff40,#ffadd440)', border:'1px solid rgba(196,176,255,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:'0.6rem', color:'#c4b0ff' }}>
            {(user.displayName || user.username || '?').slice(0,2).toUpperCase()}
          </div>
          {user.username}
        </button>
      )}
    </div>
  )
}

/* ── Empty State ── */
function EmptyState({ onNew }) {
  return (
    <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px', textAlign:'center' }}
    >
      <div style={{ fontSize:'3.5rem', marginBottom:20, opacity:0.3 }}>◈</div>
      <h3 style={{ fontFamily:'var(--font-display)', fontSize:'1rem', letterSpacing:'0.1em', color:'var(--text-secondary)', marginBottom:8 }}>No Projects Yet</h3>
      <p style={{ fontFamily:'var(--font-body)', fontSize:'0.84rem', color:'var(--text-dim)', lineHeight:1.6, maxWidth:320, marginBottom:28 }}>
        Your design workspace is empty. Start your first project and begin building.
      </p>
      <button onClick={onNew} className="btn btn-primary" style={{ padding:'11px 28px' }}>✦ Create First Project</button>
    </motion.div>
  )
}

/* ── Main Page ── */
export default function Projects() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { projects, loading, fetchMyProjects, createProject, deleteProject } = useProjectsStore()

  const [showNew, setShowNew]         = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [typeFilter, setTypeFilter]   = useState('ALL')
  const [sort, setSort]               = useState('updatedAt')
  const [search, setSearch]           = useState('')

  useEffect(() => { fetchMyProjects() }, [])

  const handleOpen = (project) => navigate(`/studio/${project.id}`)

  const filtered = projects
    .filter(p => typeFilter === 'ALL' || p.cadType === typeFilter)
    .filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b[sort] ?? 0) > (a[sort] ?? 0) ? 1 : -1)

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      transition={{ duration:0.3 }}
      style={{ minHeight:'100vh', background:'var(--bg-void)', paddingTop:56 }}
    >
      <Topnav user={user} onProfileOpen={() => setShowProfile(true)} />

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'40px 28px' }}>
        {/* Page header */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:32, flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-dim)', letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:6 }}>
              ◈ Design Workspace
            </div>
            <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.4rem,3vw,2rem)', fontWeight:400, letterSpacing:'0.1em', background:'linear-gradient(135deg,#ddd0ff,#c4b0ff,#ffadd4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              My Projects
            </h1>
            {!loading && (
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-secondary)', marginTop:4 }}>
                {filtered.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <button onClick={() => setShowNew(true)} className="btn btn-primary" style={{ padding:'10px 22px', fontSize:'0.78rem' }}>
            + New Project
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display:'flex', gap:10, marginBottom:24, flexWrap:'wrap', alignItems:'center' }}>
          {/* Search */}
          <input
            className="input"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth:180, maxWidth:240, padding:'7px 12px', fontSize:'0.8rem' }}
          />

          {/* Type filter */}
          <div style={{ display:'flex', gap:4 }}>
            {CAD_TYPES.map(t => {
              const meta = TYPE_META[t]
              const active = typeFilter === t
              return (
                <button key={t} onClick={() => setTypeFilter(t)}
                  style={{ padding:'6px 12px', fontFamily:'var(--font-mono)', fontSize:'0.62rem', letterSpacing:'0.06em', cursor:'pointer', borderRadius:1, transition:'all 150ms', background: active ? (meta ? `${meta.color}18` : 'rgba(196,176,255,0.1)') : 'transparent', border:`1px solid ${active ? (meta?.color || 'var(--cyan)') : 'var(--border-subtle)'}`, color: active ? (meta?.color || 'var(--cyan)') : 'var(--text-secondary)' }}
                >
                  {t === 'ALL' ? 'All' : meta.label}
                </button>
              )
            })}
          </div>

          {/* Sort */}
          <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
            {SORT_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setSort(o.value)}
                style={{ padding:'6px 10px', fontFamily:'var(--font-mono)', fontSize:'0.6rem', letterSpacing:'0.08em', cursor:'pointer', borderRadius:1, transition:'all 150ms', background: sort === o.value ? 'rgba(196,176,255,0.1)' : 'transparent', border:`1px solid ${sort === o.value ? 'var(--cyan)' : 'var(--border-subtle)'}`, color: sort === o.value ? 'var(--cyan)' : 'var(--text-secondary)' }}
              >{o.label}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-dim)', letterSpacing:'0.12em' }}>LOADING...</div>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onNew={() => setShowNew(true)} />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:60 }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-dim)', letterSpacing:'0.1em' }}>No projects match your filter</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} onOpen={handleOpen} onDelete={deleteProject} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreate={createProject} />}
      </AnimatePresence>

      <ProfileDrawer open={showProfile} onClose={() => setShowProfile(false)} />
    </motion.div>
  )
}
