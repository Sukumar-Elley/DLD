import { useEffect, useRef } from 'react'

const COLORS = ['#00d4ff','#7b61ff','#00ff94','#ffd700','#ff6b6b','#fff']

export default function Confetti({ active, duration = 3500 }) {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    particlesRef.current = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      w: 6 + Math.random() * 8,
      h: 3 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      vr: (Math.random() - 0.5) * 0.2,
      opacity: 1,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rotation += p.vr
        p.vy += 0.08  // gravity
        p.opacity -= 0.005
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = Math.max(p.opacity, 0)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h)
        ctx.restore()
      })
      particlesRef.current = particlesRef.current.filter(p => p.y < canvas.height + 20 && p.opacity > 0)
      if (particlesRef.current.length > 0) rafRef.current = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    rafRef.current = requestAnimationFrame(draw)

    return () => { cancelAnimationFrame(rafRef.current); ctx?.clearRect(0, 0, canvas.width, canvas.height) }
  }, [active])

  return <canvas ref={canvasRef} id="confetti-canvas" style={{ pointerEvents:'none', position:'fixed', inset:0, zIndex:9990 }} />
}
