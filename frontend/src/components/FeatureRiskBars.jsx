import { useEffect, useState } from 'react'
import AnimatedCounter from './AnimatedCounter'

const SEV_COLORS = { CRITICAL:'var(--critical)', HIGH:'var(--high)', MEDIUM:'var(--medium)', LOW:'var(--low)' }

export default function FeatureRiskBars({ violations = [], maxShow = 10 }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [violations])

  const featureMap = {}
  violations.forEach(v => {
    const key = v.affected_feature.split(' ↔ ')[0].split(': ').slice(-1)[0]
    if (!featureMap[key]) featureMap[key] = { score: 0, severity: v.severity, count: 0 }
    if (v.severity_score > featureMap[key].score) {
      featureMap[key].score = v.severity_score
      featureMap[key].severity = v.severity
    }
    featureMap[key].count++
  })

  const sorted = Object.entries(featureMap)
    .sort(([,a],[,b]) => b.score - a.score)
    .slice(0, maxShow)

  if (sorted.length === 0) return (
    <div style={{ textAlign:'center', padding:'1.5rem', color:'var(--text3)', fontSize:'0.84rem' }}>
      No violations to display.
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {sorted.map(([feature, { score, severity, count }], i) => {
        const color = SEV_COLORS[severity] || 'var(--low)'
        return (
          <div key={feature} className="anim-fade-up" style={{ animationDelay:`${i*0.06}s`, opacity:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }}/>
                <span style={{ fontSize:'0.78rem', fontWeight:600, overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }} title={feature}>{feature}</span>
                {count > 1 && (
                  <span className="chip" style={{ fontSize:'0.6rem', color:'var(--text3)', flexShrink:0 }}>
                    {count}x
                  </span>
                )}
              </div>
              <span className="mono" style={{ fontSize:'0.75rem', color, fontWeight:700, flexShrink:0 }}>
                {Math.round(score * 100)}%
              </span>
            </div>
            <div className="progress-bar" style={{ height:6 }}>
              <div style={{
                height:'100%', borderRadius:3,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                width: animated ? `${score * 100}%` : '0%',
                transition: `width 0.8s cubic-bezier(0.16,1,0.3,1) ${i*0.06}s`,
                boxShadow: `0 0 8px ${color}44`,
              }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}
