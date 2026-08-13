import { useEffect, useRef } from 'react'

const PALETTE = [
  [196, 176, 255], // lavender
  [255, 173, 212], // sakura
  [128, 240, 224], // aqua
  [253, 230, 138], // stardust
]

function rand(min, max) { return Math.random() * (max - min) + min }

export default function DotScatter({
  count = 120,
  speed = 0.35,
  radius = 1.8,
  repelStrength = 80,
  repelRadius = 110,
  opacity = 0.55,
  style = {},
}) {
  const canvasRef = useRef(null)
  const mouse = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let W, H
    let dots = []

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.parentElement.getBoundingClientRect()
      W = rect.width; H = rect.height
      canvas.width  = W * dpr
      canvas.height = H * dpr
      canvas.style.width  = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function makeDot() {
      const col = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      return {
        x:  rand(0, W),
        y:  rand(0, H),
        vx: rand(-speed, speed),
        vy: rand(-speed, speed),
        r:  rand(radius * 0.5, radius * 1.6),
        col,
        alpha: rand(0.4, 1.0),
        pulse: rand(0, Math.PI * 2),
        pulseSpeed: rand(0.008, 0.022),
      }
    }

    function init() {
      resize()
      dots = Array.from({ length: count }, makeDot)
    }

    function draw() {
      ctx.clearRect(0, 0, W, H)
      const mx = mouse.current.x
      const my = mouse.current.y

      for (const d of dots) {
        // repel from cursor
        const dx = d.x - mx
        const dy = d.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < repelRadius && dist > 0) {
          const force = (repelRadius - dist) / repelRadius
          d.vx += (dx / dist) * force * 0.55
          d.vy += (dy / dist) * force * 0.55
        }

        // dampen & move
        d.vx *= 0.985
        d.vy *= 0.985
        d.vx += (Math.random() - 0.5) * 0.018
        d.vy += (Math.random() - 0.5) * 0.018

        // clamp speed
        const spd = Math.sqrt(d.vx * d.vx + d.vy * d.vy)
        if (spd > speed * 3.5) { d.vx *= speed * 3.5 / spd; d.vy *= speed * 3.5 / spd }

        d.x += d.vx
        d.y += d.vy

        // wrap edges
        if (d.x < -10) d.x = W + 10
        if (d.x > W + 10) d.x = -10
        if (d.y < -10) d.y = H + 10
        if (d.y > H + 10) d.y = -10

        // pulse alpha
        d.pulse += d.pulseSpeed
        const a = d.alpha * (0.72 + 0.28 * Math.sin(d.pulse)) * opacity

        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${d.col[0]},${d.col[1]},${d.col[2]},${a})`
        ctx.fill()

        // soft glow
        const grd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * repelStrength / 50)
        grd.addColorStop(0, `rgba(${d.col[0]},${d.col[1]},${d.col[2]},${a * 0.18})`)
        grd.addColorStop(1, `rgba(${d.col[0]},${d.col[1]},${d.col[2]},0)`)
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r * repelStrength / 50, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = e.clientX - rect.left
      mouse.current.y = e.clientY - rect.top
    }
    function onMouseLeave() {
      mouse.current.x = -9999
      mouse.current.y = -9999
    }

    init()
    draw()

    const ro = new ResizeObserver(() => { resize(); dots = Array.from({ length: count }, makeDot) })
    ro.observe(canvas.parentElement)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [count, speed, radius, repelStrength, repelRadius, opacity])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
