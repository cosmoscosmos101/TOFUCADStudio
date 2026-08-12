import { useRef, useMemo, Suspense, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Float } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import AuthModal from '../components/AuthModal'
import '../styles/globals.css'

/* ══════════════════════════════════════════════
   THREE.JS — Holographic Neural Crystal
   ══════════════════════════════════════════════ */

function DataParticles({ count = 140 }) {
  const mesh = useRef(null)

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const palette = [
      [0.77, 0.69, 1.0],   // lavender
      [1.0,  0.68, 0.83],  // sakura
      [0.50, 0.94, 0.88],  // aqua
      [0.99, 0.90, 0.54],  // stardust
    ]
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16
      const c = palette[Math.floor(Math.random() * palette.length)]
      col[i * 3 + 0] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]
    }
    return { positions: pos, colors: col }
  }, [count])

  const speeds  = useMemo(() => Array.from({ length: count }, () => Math.random() * 0.35 + 0.06), [count])
  const offsets = useMemo(() => Array.from({ length: count }, () => Math.random() * Math.PI * 2), [count])

  useFrame(({ clock }) => {
    if (!mesh.current) return
    const t = clock.getElapsedTime()
    const pos = mesh.current.geometry.attributes.position.array
    for (let i = 0; i < count; i++) {
      const spd = speeds[i], off = offsets[i]
      pos[i * 3 + 1] += spd * 0.0025
      pos[i * 3 + 0] += Math.sin(t * spd * 0.8 + off) * 0.0018
      pos[i * 3 + 2] += Math.cos(t * spd * 0.5 + off) * 0.001
      if (pos[i * 3 + 1] > 7) pos[i * 3 + 1] = -7
    }
    mesh.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

function DataOrb({ index }) {
  const ref = useRef(null)
  const angle  = (index / 6) * Math.PI * 2
  const radius = 5.4
  const speed  = 0.13 + index * 0.018

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    const a = angle + t * speed
    ref.current.position.x = Math.cos(a) * radius
    ref.current.position.z = Math.sin(a) * radius
    ref.current.position.y = Math.sin(t * 0.28 + index) * 0.55
    ref.current.rotation.y = t * 1.1
    ref.current.rotation.x = t * 0.75
  })

  const COLORS = ['#c4b0ff', '#ffadd4', '#80f0e0', '#fde68a', '#e0b0ff', '#ffcce8']
  const col = COLORS[index % COLORS.length]
  const sz  = 0.07 + (index % 3) * 0.03

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[sz, 1]} />
      <meshStandardMaterial
        color={col}
        emissive={col}
        emissiveIntensity={1.4}
        metalness={0.1}
        roughness={0.05}
        transparent
        opacity={0.95}
      />
    </mesh>
  )
}

function HoloCrystal() {
  const knotRef  = useRef(null)
  const ring1Ref = useRef(null)
  const ring2Ref = useRef(null)
  const ring3Ref = useRef(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (knotRef.current)  { knotRef.current.rotation.y  = t * 0.16;  knotRef.current.rotation.x  = Math.sin(t * 0.09) * 0.18 }
    if (ring1Ref.current) { ring1Ref.current.rotation.z = t * 0.22 }
    if (ring2Ref.current) { ring2Ref.current.rotation.x = t * -0.18; ring2Ref.current.rotation.y = t * 0.11 }
    if (ring3Ref.current) { ring3Ref.current.rotation.z = t * -0.13; ring3Ref.current.rotation.x = t * 0.09 }
  })

  return (
    <Float speed={1.3} rotationIntensity={0.07} floatIntensity={0.55}>
      <group>
        {/* Core — soft lavender iridescent torus knot */}
        <mesh ref={knotRef}>
          <torusKnotGeometry args={[1.55, 0.36, 240, 26, 2, 3]} />
          <meshStandardMaterial
            color="#8070c8"
            metalness={0.15}
            roughness={0.04}
            emissive="#c4a8ff"
            emissiveIntensity={0.7}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Ring 1 — sakura orbit */}
        <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.1, 0.022, 10, 110]} />
          <meshBasicMaterial color="#ffadd4" transparent opacity={0.52} />
        </mesh>

        {/* Ring 2 — aqua trace */}
        <mesh ref={ring2Ref} rotation={[Math.PI / 3, Math.PI / 5, 0]}>
          <torusGeometry args={[3.75, 0.016, 8, 110]} />
          <meshBasicMaterial color="#80f0e0" transparent opacity={0.38} />
        </mesh>

        {/* Ring 3 — lavender filament */}
        <mesh ref={ring3Ref} rotation={[Math.PI / 6, 0, Math.PI / 4]}>
          <torusGeometry args={[4.35, 0.011, 8, 130]} />
          <meshBasicMaterial color="#c4b0ff" transparent opacity={0.26} />
        </mesh>

        {[0, 1, 2, 3, 4, 5].map(i => <DataOrb key={i} index={i} />)}
      </group>
    </Float>
  )
}

function SceneEnvironment() {
  return (
    <>
      {/* Violet ambient */}
      <ambientLight intensity={0.28} color="#5030a0" />
      {/* Lavender key — overhead soft */}
      <directionalLight position={[5, 12, 7]} intensity={2.0} color="#b0a0f0" />
      {/* Sakura fill — left warm */}
      <directionalLight position={[-10, 4, -6]} intensity={0.7} color="#ff90c0" />
      {/* Aqua rim — rear depth */}
      <directionalLight position={[2, -3, -14]} intensity={0.35} color="#60e8d8" />
      {/* Lavender point — emanates from crystal */}
      <pointLight position={[0, 0, 0]} intensity={1.4} color="#c4a0ff" distance={13} decay={2} />
      {/* Sakura accent */}
      <pointLight position={[4, 5, 3]} intensity={0.5} color="#ff88cc" distance={10} decay={2} />

      <DataParticles count={140} />
      <HoloCrystal />
      <EffectComposer>
        <Bloom intensity={1.3} luminanceThreshold={0.18} luminanceSmoothing={0.88} mipmapBlur />
      </EffectComposer>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.35} />
    </>
  )
}

/* ══════════════════════════════════════════════
   UI — Hero & Features
   ══════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: '⬡',
    title: 'Parametric Sequence',
    body: 'Every operation lives in a replayable timeline. Branch storylines, rewind decisions, and fork histories like a visual novel with deterministic state.',
    accent: '#c4b0ff',
    glow: 'rgba(196,176,255,0.22)',
  },
  {
    icon: '✦',
    title: 'Neural Synthesis',
    body: 'Speak your geometry into existence. The AI engine translates natural language into fully parametric mesh — from concept to solid in under a second.',
    accent: '#ffadd4',
    glow: 'rgba(255,173,212,0.22)',
  },
  {
    icon: '◈',
    title: 'Sync Protocol',
    body: 'Invite your crew. Live avatar presence, shared cursors, and merge conflict resolution — design together in real time across any timezone.',
    accent: '#80f0e0',
    glow: 'rgba(128,240,224,0.18)',
  },
  {
    icon: '⟴',
    title: 'Blueprint Export',
    body: 'Render crisp orthographic blueprints — front, top, side, isometric — with a single command. Four views, zero manual setup.',
    accent: '#fde68a',
    glow: 'rgba(253,230,138,0.18)',
  },
]

function FeatureCard({ feature, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.52, delay: index * 0.09, ease: 'easeOut' }}
      style={{
        position: 'relative',
        padding: '26px 22px 24px',
        background: 'linear-gradient(145deg, rgba(16,14,42,0.95), rgba(11,9,33,0.98))',
        border: `1px solid rgba(196,176,255,0.16)`,
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'border-color 200ms, box-shadow 200ms',
        backdropFilter: 'blur(8px)',
      }}
      whileHover={{
        borderColor: `${feature.accent}55`,
        boxShadow: `0 0 32px ${feature.glow}, 0 8px 36px rgba(0,0,0,0.55)`,
      }}
    >
      {/* Corner marks */}
      <div style={{ position:'absolute', top:0, left:0, width:12, height:12, borderTop:`1.5px solid ${feature.accent}65`, borderLeft:`1.5px solid ${feature.accent}65` }} />
      <div style={{ position:'absolute', bottom:0, right:0, width:12, height:12, borderBottom:`1.5px solid ${feature.accent}65`, borderRight:`1.5px solid ${feature.accent}65` }} />

      {/* Shimmer overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${feature.glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
        opacity: 0.5,
      }} />

      {/* Icon */}
      <div style={{
        width: 46, height: 46, marginBottom: 18,
        background: `${feature.accent}14`,
        border: `1px solid ${feature.accent}30`,
        borderRadius: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.35rem',
        boxShadow: `0 0 14px ${feature.glow}`,
        position: 'relative',
      }}>
        {feature.icon}
      </div>

      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.75rem',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: feature.accent,
        marginBottom: 11,
        fontWeight: 400,
      }}>
        {feature.title}
      </h3>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.88rem',
        fontWeight: 300,
        lineHeight: 1.7,
        color: 'rgba(237,232,255,0.65)',
      }}>
        {feature.body}
      </p>
    </motion.div>
  )
}

function SignalDivider({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, margin:'0 auto', maxWidth:440 }}>
      <div style={{ flex:1, height:1, background:'linear-gradient(90deg, transparent, rgba(196,176,255,0.28))' }} />
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.55rem',
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: 'rgba(196,176,255,0.55)',
        whiteSpace: 'nowrap',
      }}>
        ✦ {label} ✦
      </span>
      <div style={{ flex:1, height:1, background:'linear-gradient(90deg, rgba(196,176,255,0.28), transparent)' }} />
    </div>
  )
}

export default function Homepage() {
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const navigate = useNavigate()

  const openLogin    = () => { setAuthMode('login');    setShowAuth(true) }
  const openRegister = () => { setAuthMode('register'); setShowAuth(true) }
  const goToStudio   = () => navigate('/studio')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.32, ease: 'easeInOut' }}
      style={{ minHeight: '100vh', background: 'var(--bg-void)', overflow: 'hidden', position: 'relative' }}
    >

      {/* ── Topnav ── */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px',
          height: 56,
          background: 'rgba(6,6,18,0.88)',
          borderBottom: '1px solid rgba(196,176,255,0.12)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width: 24, height: 24,
            background: 'linear-gradient(135deg, #c4b0ff, #ffadd4)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            boxShadow: '0 0 16px rgba(196,176,255,0.55)',
          }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.76rem',
            letterSpacing: '0.14em',
            background: 'linear-gradient(135deg, #ddd0ff, #ffadd4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>TOFU CAD</span>
        </div>

        {/* Nav links */}
        <div style={{ display:'flex', gap:2 }}>
          {['Gallery', 'Docs', 'Community', 'Pricing'].map(l => (
            <button key={l} style={{
              background: 'none', border: 'none',
              fontFamily: 'var(--font-ui)', fontSize: '0.68rem',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(128,112,184,0.85)', cursor: 'pointer',
              padding: '0 14px', height: 56,
              transition: 'color 150ms',
            }}
            onMouseEnter={e => e.target.style.color = '#c4b0ff'}
            onMouseLeave={e => e.target.style.color = 'rgba(128,112,184,0.85)'}
            >{l}</button>
          ))}
        </div>

        {/* Auth */}
        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={openLogin}
            style={{
              background: 'transparent',
              border: '1px solid rgba(196,176,255,0.28)',
              color: '#8878c0', fontFamily: 'var(--font-ui)',
              fontSize: '0.68rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', cursor: 'pointer',
              padding: '6px 16px', borderRadius: 1,
              transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.color='#c4b0ff'; e.currentTarget.style.borderColor='rgba(196,176,255,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.color='#8878c0'; e.currentTarget.style.borderColor='rgba(196,176,255,0.28)' }}
          >Sign In</button>
          <button
            onClick={openRegister}
            style={{
              background: 'linear-gradient(135deg, rgba(196,176,255,0.18), rgba(255,173,212,0.1))',
              border: '1px solid rgba(255,173,212,0.48)',
              color: '#ddd0ff', fontFamily: 'var(--font-ui)',
              fontSize: '0.68rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', cursor: 'pointer',
              padding: '6px 16px', borderRadius: 1,
              boxShadow: '0 0 14px rgba(196,176,255,0.2)',
              transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow='0 0 24px rgba(255,173,212,0.35)'; e.currentTarget.style.borderColor='rgba(255,173,212,0.68)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow='0 0 14px rgba(196,176,255,0.2)'; e.currentTarget.style.borderColor='rgba(255,173,212,0.48)' }}
          >Join the Network</button>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <div style={{ position: 'relative', height: '100vh', display: 'flex', alignItems: 'center' }}>

        {/* 3D Canvas — full bleed */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <Canvas
            camera={{ position: [0, 0, 11], fov: 48 }}
            gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.25 }}
            dpr={[1, 2]}
          >
            <color attach="background" args={['#060612']} />
            <fog attach="fog" args={['#060612', 18, 40]} />
            <Suspense fallback={null}>
              <SceneEnvironment />
            </Suspense>
          </Canvas>
        </div>

        {/* Dark gradient right — text overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(105deg, rgba(6,6,18,0) 0%, rgba(6,6,18,0.08) 32%, rgba(6,6,18,0.72) 55%, rgba(6,6,18,0.97) 70%)',
          pointerEvents: 'none',
        }} />

        {/* Hero text */}
        <div style={{
          position: 'relative', zIndex: 10,
          marginLeft: 'auto',
          width: '48%',
          paddingRight: '7%',
          paddingLeft: '2%',
        }}>
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}
          >
            <div style={{ height:1, width:32, background:'rgba(196,176,255,0.42)' }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.55rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(196,176,255,0.7)',
            }}>Neural CAD System v2</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.9rem, 4vw, 3.1rem)',
              fontWeight: 400,
              lineHeight: 1.18,
              letterSpacing: '0.06em',
              marginBottom: 8,
              background: 'linear-gradient(150deg, #ddd0ff 0%, #c4b0ff 30%, #ffadd4 62%, #80f0e0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: 'none',
            }}
          >
            TOFU<br />CAD STUDIO
          </motion.h1>

          {/* Signal rule */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' }}
            style={{ transformOrigin: 'left', marginBottom: 20 }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <div style={{ height:1.5, width:'100%', background:'linear-gradient(90deg, rgba(196,176,255,0.65), rgba(255,173,212,0.35), transparent)' }} />
              <span style={{ color:'rgba(196,176,255,0.5)', fontSize:'0.5rem', whiteSpace:'nowrap', fontFamily:'var(--font-display)', letterSpacing:'0.3em' }}>✦ ✦ ✦</span>
            </div>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.6 }}
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 300,
              fontSize: 'clamp(0.95rem, 1.7vw, 1.1rem)',
              lineHeight: 1.75,
              color: 'rgba(196,176,255,0.6)',
              marginBottom: 36,
              maxWidth: 440,
            }}
          >
            Design the future. Frame by frame.
            Parametric CAD powered by neural synthesis — speak your intent,
            watch geometry bloom in real time.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            style={{ display:'flex', gap:12, flexWrap:'wrap' }}
          >
            <button
              onClick={openRegister}
              style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '13px 34px',
                background: 'linear-gradient(135deg, rgba(196,176,255,0.22), rgba(255,173,212,0.12))',
                border: '1px solid rgba(255,173,212,0.55)',
                color: '#ddd0ff',
                fontFamily: 'var(--font-display)',
                fontSize: '0.72rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                boxShadow: '0 0 22px rgba(196,176,255,0.24), inset 0 0 20px rgba(196,176,255,0.06)',
                transition: 'all 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 0 38px rgba(255,173,212,0.4), inset 0 0 24px rgba(255,173,212,0.1)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='0 0 22px rgba(196,176,255,0.24), inset 0 0 20px rgba(196,176,255,0.06)'; e.currentTarget.style.transform='translateY(0)' }}
            >
              ✦ Launch Studio
            </button>

            <button
              onClick={goToStudio}
              style={{
                padding: '13px 28px',
                background: 'transparent',
                border: '1px solid rgba(196,176,255,0.24)',
                color: 'rgba(196,176,255,0.65)',
                fontFamily: 'var(--font-display)',
                fontSize: '0.72rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                transition: 'all 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color='#c4b0ff'; e.currentTarget.style.borderColor='rgba(196,176,255,0.5)'; e.currentTarget.style.background='rgba(196,176,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.color='rgba(196,176,255,0.65)'; e.currentTarget.style.borderColor='rgba(196,176,255,0.24)'; e.currentTarget.style.background='transparent' }}
            >
              Open Studio
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            style={{ display:'flex', gap:28, marginTop:38 }}
          >
            {[['2,400+','Network Users'],['18k+','Meshes Created'],['4.9★','Signal Rating']].map(([num, label]) => (
              <div key={label}>
                <div style={{
                  fontFamily:'var(--font-display)', fontSize:'1.05rem', letterSpacing:'0.06em',
                  background: 'linear-gradient(135deg, #c4b0ff, #ffadd4)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>{num}</div>
                <div style={{ fontFamily:'var(--font-ui)', fontWeight:300, fontSize:'0.54rem', letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(128,112,184,0.6)', marginTop:2 }}>{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Features Section ── */}
      <section style={{
        position: 'relative',
        padding: '100px 5% 120px',
        background: 'linear-gradient(180deg, var(--bg-void) 0%, #0a0820 100%)',
      }}>
        {/* Top fade */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:80, background:'linear-gradient(0deg, transparent, var(--bg-void))', pointerEvents:'none' }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign:'center', marginBottom:58 }}
        >
          <SignalDivider label="System Modules" />
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.3rem, 3vw, 1.9rem)',
            fontWeight: 400,
            letterSpacing: '0.12em',
            background: 'linear-gradient(135deg, #ede8ff, #c4b0ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginTop: 28,
            marginBottom: 12,
          }}>
            Engineered for the Digital Creator
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
            fontSize: '0.96rem',
            color: 'rgba(196,176,255,0.55)',
            maxWidth: 460,
            margin: '0 auto',
            lineHeight: 1.7,
          }}>
            Every module precision-built. Zero bloat.
            Pure signal — only what a next-gen designer needs.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          maxWidth: 1100,
          margin: '0 auto',
        }}>
          {FEATURES.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ textAlign:'center', marginTop:76 }}
        >
          <SignalDivider label="Initialize Session" />
          <div style={{ marginTop:34, display:'flex', justifyContent:'center', gap:14, flexWrap:'wrap' }}>
            <button
              onClick={openRegister}
              style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '14px 44px',
                background: 'linear-gradient(135deg, rgba(196,176,255,0.2), rgba(255,173,212,0.1))',
                border: '1px solid rgba(255,173,212,0.52)',
                color: '#ddd0ff',
                fontFamily: 'var(--font-display)',
                fontSize: '0.72rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                boxShadow: '0 0 26px rgba(196,176,255,0.2)',
                transition: 'all 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 0 42px rgba(255,173,212,0.38)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='0 0 26px rgba(196,176,255,0.2)'; e.currentTarget.style.transform='none' }}
            >
              ✦ Begin Your Design
            </button>
          </div>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
            fontSize: '0.83rem',
            color: 'rgba(128,112,184,0.5)',
            marginTop: 14,
          }}>
            Free to start · No setup required
          </p>
        </motion.div>
      </section>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={authMode} />}
      </AnimatePresence>
    </motion.div>
  )
}
