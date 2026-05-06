import { useEffect, useState } from 'react'

const HEALTH_COLORS = {
  CRITICAL: '#ff3d3d', COMPROMISED: '#ff8c00', AT_RISK: '#ffd700', HEALTHY: '#00e676'
}

export default function RiskGauge({ score = 0, health = 'HEALTHY', size = 160, animate = true }) {
  const [displayed, setDisplayed] = useState(0)
  const r = (size / 2) - 14
  const circ = 2 * Math.PI * r
  const pct = Math.round(score * 100)
  const color = HEALTH_COLORS[health] || '#00e676'

  useEffect(() => {
    if (!animate) { setDisplayed(score); return }
    let start = null
    const from = displayed
    const raf = (ts) => {
      if (!start) start = ts
      const t = Math.min((ts - start) / 1000, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplayed(from + (score - from) * ease)
      if (t < 1) requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  }, [score])

  const dash = displayed * circ

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
        {/* Glow ring */}
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="10" strokeOpacity="0.12"
          strokeDasharray={circ} strokeDashoffset={0}
          strokeLinecap="round" />
        {/* Progress */}
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={0} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.05s', filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>

      {/* Center label */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: size * 0.18, fontWeight: 800, color, lineHeight: 1, fontFamily: 'var(--font)' }}>
          {Math.round(displayed * 100)}%
        </span>
        <span style={{ fontSize: size * 0.075, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>RISK</span>
        <span style={{ fontSize: size * 0.075, color, fontWeight: 700, marginTop: 1 }}>{health}</span>
      </div>
    </div>
  )
}
