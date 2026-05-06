import { useEffect, useRef, useState } from 'react'

export default function AnimatedCounter({ value, duration = 900, prefix = '', suffix = '', decimals = 0, style = {} }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const start = useRef(null)
  const from = useRef(0)

  useEffect(() => {
    const to = Number(value)
    if (isNaN(to)) return
    from.current = display
    start.current = null

    const raf = (ts) => {
      if (!start.current) start.current = ts
      const progress = Math.min((ts - start.current) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(from.current + (to - from.current) * ease)
      if (progress < 1) ref.current = requestAnimationFrame(raf)
    }
    ref.current = requestAnimationFrame(raf)
    return () => cancelAnimationFrame(ref.current)
  }, [value, duration])

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString()

  return (
    <span style={style} className="anim-count">
      {prefix}{formatted}{suffix}
    </span>
  )
}
