import { useState, useEffect } from 'react'
import { getCorrelations } from '../services/api'

function heatColor(v) {
  const a = Math.abs(v)
  if (a < 0.3) return `rgba(0,212,255,${a * 0.35})`
  if (a < 0.6) return `rgba(255,215,0,${a * 0.6})`
  if (a < 0.85) return `rgba(255,140,0,${a * 0.8})`
  return `rgba(255,61,61,${Math.min(a * 1.1, 1)})`
}

export default function CorrelationHeatmap({ reportId }) {
  const [data, setData]         = useState([])
  const [features, setFeatures] = useState([])
  const [loading, setLoading]   = useState(true)
  const [hovered, setHovered]   = useState(null)
  const [minCorr, setMinCorr]   = useState(0.3)

  useEffect(() => {
    if (!reportId) return
    setLoading(true)
    getCorrelations(reportId, minCorr)
      .then(res => {
        const corrs = res.correlations || []
        const featSet = new Set()
        corrs.forEach(c => { featSet.add(c.feature_a); featSet.add(c.feature_b) })
        setFeatures([...featSet].slice(0, 22))
        setData(corrs)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [reportId, minCorr])

  if (loading) return (
    <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>
      <div className="spin" style={{ width:28, height:28, border:'2px solid var(--border)',
        borderTopColor:'var(--accent)', borderRadius:'50%', margin:'0 auto 10px' }}/>
      <span style={{ fontSize:'0.8rem' }}>Loading correlation matrix…</span>
    </div>
  )

  if (features.length < 2) return (
    <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)', fontSize:'0.84rem' }}>
      Not enough correlated features (min correlation: {minCorr}).
    </div>
  )

  const matrix = {}
  data.forEach(c => {
    matrix[`${c.feature_a}__${c.feature_b}`] = c.correlation
    matrix[`${c.feature_b}__${c.feature_a}`] = c.correlation
  })
  features.forEach(f => { matrix[`${f}__${f}`] = 1.0 })

  const cellSize = Math.max(26, Math.min(46, Math.floor(520 / features.length)))
  const labelW = 88

  return (
    <div>
      {/* Controls */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:'0.74rem', color:'var(--text3)' }}>
          Top {features.length} correlated features
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'0.72rem', color:'var(--text3)' }}>Min r:</span>
          <input type="range" min="0.1" max="0.9" step="0.1" value={minCorr}
            onChange={e => setMinCorr(parseFloat(e.target.value))}
            style={{ width:80, accentColor:'var(--accent)', cursor:'pointer' }}/>
          <span className="mono" style={{ fontSize:'0.72rem', color:'var(--accent)', minWidth:28 }}>{minCorr}</span>
        </div>
      </div>

      <div style={{ overflowX:'auto' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:2,
          minWidth: labelW + features.length * (cellSize + 2) }}>

          {/* Column labels */}
          <div style={{ display:'flex', marginLeft:labelW }}>
            {features.map(f => (
              <div key={f} style={{
                width:cellSize, fontSize:'0.52rem', color:'var(--text3)',
                transform:'rotate(-45deg)', transformOrigin:'bottom left',
                height:48, display:'flex', alignItems:'flex-end',
                marginRight:2, padding:'0 2px', overflow:'hidden',
                textOverflow:'ellipsis', whiteSpace:'nowrap'
              }}>
                {f.length > 11 ? f.slice(0,11)+'…' : f}
              </div>
            ))}
          </div>

          {/* Rows */}
          {features.map(fa => (
            <div key={fa} style={{ display:'flex', alignItems:'center', gap:2 }}>
              <div style={{ width:labelW, fontSize:'0.62rem', color:'var(--text2)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                textAlign:'right', paddingRight:8 }}>
                {fa.length > 13 ? fa.slice(0,13)+'…' : fa}
              </div>
              {features.map(fb => {
                const r    = matrix[`${fa}__${fb}`] ?? null
                const self = fa === fb
                const hov  = hovered?.a===fa && hovered?.b===fb
                return (
                  <div key={fb}
                    onMouseEnter={() => r !== null && setHovered({ a:fa, b:fb, r })}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      width:cellSize, height:cellSize,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      background: self ? 'rgba(0,212,255,0.12)' : r !== null ? heatColor(r) : 'var(--bg2)',
                      border: hov ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.03)',
                      borderRadius:3, fontSize:'0.55rem', fontFamily:'var(--mono)',
                      color: r !== null && Math.abs(r) > 0.6 ? '#fff' : 'var(--text3)',
                      cursor:'default',
                      transition:'transform 0.12s, border-color 0.12s',
                      transform: hov ? 'scale(1.15)' : 'scale(1)',
                      zIndex: hov ? 10 : 'auto', position:'relative',
                      boxShadow: hov ? '0 0 12px var(--glow)' : 'none',
                    }}>
                    {r !== null ? r.toFixed(2) : ''}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="anim-fade-in" style={{ marginTop:10, padding:'8px 14px', borderRadius:9,
          background:'var(--card2)', border:'1px solid var(--border2)', fontSize:'0.78rem', color:'var(--text2)' }}>
          <span style={{ color:'var(--accent)', fontWeight:700 }}>{hovered.a}</span>
          {' ↔ '}
          <span style={{ color:'var(--accent)', fontWeight:700 }}>{hovered.b}</span>
          {': '}
          <span className="mono" style={{
            color: Math.abs(hovered.r) >= 0.9 ? 'var(--critical)' : Math.abs(hovered.r) >= 0.7 ? 'var(--high)' : 'var(--text)',
            fontWeight:700
          }}>{hovered.r.toFixed(4)}</span>
          {Math.abs(hovered.r) >= 0.9 &&
            <span style={{ marginLeft:8, color:'var(--critical)', fontWeight:800 }}> ⚠ Suspicious</span>}
          {Math.abs(hovered.r) >= 0.7 && Math.abs(hovered.r) < 0.9 &&
            <span style={{ marginLeft:8, color:'var(--high)', fontWeight:700 }}> ⚡ High</span>}
        </div>
      )}

      {/* Legend */}
      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:12, fontSize:'0.66rem', color:'var(--text3)' }}>
        <span>Low</span>
        {[0.1,0.2,0.4,0.6,0.75,0.9,1.0].map(v => (
          <div key={v} style={{ width:18, height:10, borderRadius:2, background:heatColor(v) }}/>
        ))}
        <span>High</span>
      </div>
    </div>
  )
}
