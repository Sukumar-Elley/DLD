import { useState, useEffect } from 'react'
import { X, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import AnimatedCounter from './AnimatedCounter'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const HEALTH_COLORS = { CRITICAL:'#ff3d3d', COMPROMISED:'#ff8c00', AT_RISK:'#ffd700', HEALTHY:'#00e676' }

export default function ComparePanel({ reports, onClose }) {
  const [selected, setSelected] = useState({ a: '', b: '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const compare = async () => {
    if (!selected.a || !selected.b) return
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${API}/api/compare/${selected.a}/${selected.b}`)
      if (!r.ok) throw new Error('Comparison failed')
      setResult(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const delta = result?.delta
  const DeltaIcon = delta?.improved ? TrendingDown : delta?.risk_score_change === 0 ? Minus : TrendingUp
  const deltaColor = delta?.improved ? 'var(--low)' : delta?.risk_score_change === 0 ? 'var(--text3)' : 'var(--critical)'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(3,7,15,0.88)',
      backdropFilter: 'blur(16px)', zIndex: 500, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div className="card anim-scale-in" style={{ width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Compare Reports</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 2 }}>
              Side-by-side pipeline analysis
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}><X size={15}/></button>
        </div>

        {/* Selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <select className="field-select" value={selected.a} onChange={e => setSelected(s => ({...s, a: e.target.value}))}>
            <option value="">Select Report A</option>
            {reports.map(r => (
              <option key={r.report_id} value={r.report_id}>
                {r.dataset_name} — {r.pipeline_health} ({Math.round(r.overall_risk_score*100)}%)
              </option>
            ))}
          </select>
          <ArrowRight size={18} color="var(--text3)" />
          <select className="field-select" value={selected.b} onChange={e => setSelected(s => ({...s, b: e.target.value}))}>
            <option value="">Select Report B</option>
            {reports.map(r => (
              <option key={r.report_id} value={r.report_id}>
                {r.dataset_name} — {r.pipeline_health} ({Math.round(r.overall_risk_score*100)}%)
              </option>
            ))}
          </select>
        </div>

        <button className="btn-primary ripple" onClick={compare}
          disabled={!selected.a || !selected.b || loading} style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
          {loading ? <><div className="spin" style={{ width:14,height:14,border:'2px solid rgba(255,255,255,0.2)',borderTopColor:'#fff',borderRadius:'50%'}}/>Comparing…</> : 'Run Comparison'}
        </button>

        {error && <div style={{ color:'var(--critical)', fontSize:'0.82rem', marginBottom:10 }}>{error}</div>}

        {result && (
          <div className="anim-fade-up">
            {/* Delta banner */}
            <div style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
              borderRadius:12, marginBottom:14,
              background: delta.improved ? 'rgba(0,230,118,0.08)' : 'rgba(255,61,61,0.08)',
              border: `1px solid ${delta.improved ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,61,0.2)'}`
            }}>
              <DeltaIcon size={20} color={deltaColor}/>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color: deltaColor }}>{delta.verdict}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text2)', marginTop:2 }}>
                  Risk score change: <span style={{ color: deltaColor, fontWeight:700 }}>
                    {delta.risk_score_change > 0 ? '+' : ''}{(delta.risk_score_change*100).toFixed(1)}%
                  </span>
                  {' · '}
                  Violations: <span style={{ color: delta.violation_change > 0 ? 'var(--critical)' : 'var(--low)', fontWeight:700 }}>
                    {delta.violation_change > 0 ? '+' : ''}{delta.violation_change}
                  </span>
                </div>
              </div>
            </div>

            {/* Side-by-side */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              {[result.report_a, result.report_b].map((r,i) => (
                <div key={i} className="compare-col" style={{
                  borderColor: i===0 ? 'var(--border2)' : (delta.improved ? 'rgba(0,230,118,0.3)' : 'rgba(255,61,61,0.2)')
                }}>
                  <div style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--text3)', marginBottom:6, letterSpacing:'0.08em' }}>
                    REPORT {i===0?'A':'B'}
                  </div>
                  <div style={{ fontWeight:700, fontSize:'0.82rem', marginBottom:6, overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.dataset_name}</div>
                  <div style={{ fontSize:'1.4rem', fontWeight:800,
                    color: HEALTH_COLORS[r.pipeline_health] }}>{Math.round(r.overall_risk_score*100)}%</div>
                  <div style={{ fontSize:'0.7rem', color: HEALTH_COLORS[r.pipeline_health], fontWeight:700, marginBottom:8 }}>
                    {r.pipeline_health}
                  </div>
                  {[
                    ['Violations', r.total_violations],
                    ['Critical', r.critical],
                    ['High', r.high],
                    ['Features', r.total_features],
                  ].map(([l,v]) => (
                    <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem',
                      color:'var(--text2)', borderTop:'1px solid var(--border)', padding:'4px 0' }}>
                      <span>{l}</span>
                      <span style={{ fontWeight:700, color:'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Feature overlap */}
            {result.feature_overlap && (
              <div className="card" style={{ padding:'0.875rem' }}>
                <div style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--text3)', marginBottom:8, letterSpacing:'0.06em' }}>
                  FEATURE OVERLAP
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                  {[
                    ['Common leaking', result.feature_overlap.common_violating_features, 'var(--medium)'],
                    ['Fixed in B', result.feature_overlap.only_in_a, 'var(--low)'],
                    ['New in B', result.feature_overlap.only_in_b, 'var(--critical)'],
                  ].map(([label, feats, color]) => (
                    <div key={label}>
                      <div style={{ fontSize:'0.65rem', color:'var(--text3)', fontWeight:600, marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:'1.1rem', fontWeight:800, color }}>{feats.length}</div>
                      {feats.slice(0,2).map(f => (
                        <div key={f} className="chip" style={{ marginTop:3, fontSize:'0.6rem' }}>{f.slice(0,18)}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
