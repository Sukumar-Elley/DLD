import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, ExternalLink, Clock, Shield, GitCompare } from 'lucide-react'
import { useApp } from '../context/AppContext'
import ComparePanel from '../components/ComparePanel'
import AnimatedCounter from '../components/AnimatedCounter'

const HC = { CRITICAL:'var(--critical)', COMPROMISED:'var(--high)', AT_RISK:'var(--medium)', HEALTHY:'var(--low)' }
const HI = { CRITICAL:'🚨', COMPROMISED:'🔶', AT_RISK:'⚠️', HEALTHY:'✅' }

export default function History() {
  const { history, clearHistory } = useApp()
  const [confirmClear, setConfirmClear] = useState(false)
  const [showCompare, setShowCompare] = useState(false)

  if (history.length === 0) return (
    <div style={{ maxWidth:680, margin:'5rem auto', textAlign:'center', padding:'0 1.5rem' }}>
      <div className="anim-float" style={{
        width:72, height:72, borderRadius:18,
        background:'rgba(0,212,255,0.07)', border:'1px solid rgba(0,212,255,0.2)',
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem',
        boxShadow:'0 0 40px rgba(0,212,255,0.1)'
      }}>
        <Clock size={30} color="var(--accent)"/>
      </div>
      <h2 style={{ fontWeight:800, marginBottom:8, fontSize:'1.3rem' }}>No Analysis History</h2>
      <p style={{ color:'var(--text2)', marginBottom:20, fontSize:'0.88rem' }}>Run your first analysis to see reports here.</p>
      <Link to="/analysis" className="btn-primary ripple" style={{ textDecoration:'none' }}>
        <Shield size={14}/>Start Analysis
      </Link>
    </div>
  )

  const avgRisk = history.reduce((s, h) => s + (h.overall_risk_score || 0), 0) / history.length
  const worstHealth = history.find(h => h.pipeline_health === 'CRITICAL') ? 'CRITICAL'
    : history.find(h => h.pipeline_health === 'COMPROMISED') ? 'COMPROMISED'
    : history.find(h => h.pipeline_health === 'AT_RISK') ? 'AT_RISK' : 'HEALTHY'

  return (
    <>
      {showCompare && <ComparePanel reports={history} onClose={() => setShowCompare(false)}/>}

      <div style={{ maxWidth:960, margin:'0 auto', padding:'1.5rem' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
          <div>
            <h1 className="anim-fade-up" style={{ fontSize:'1.4rem', fontWeight:800, letterSpacing:'-0.02em', opacity:0 }}>
              Analysis History
            </h1>
            <p className="anim-fade-up" style={{ color:'var(--text2)', fontSize:'0.8rem', marginTop:4, opacity:0, animationDelay:'0.05s' }}>
              {history.length} report{history.length!==1?'s':''} · Avg risk: {Math.round(avgRisk*100)}% · Session worst: {worstHealth}
            </p>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {history.length >= 2 && (
              <button className="btn-ghost" onClick={() => setShowCompare(true)}>
                <GitCompare size={13}/>Compare
              </button>
            )}
            {confirmClear ? (
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
                <button className="btn-danger" onClick={() => { clearHistory(); setConfirmClear(false) }}>
                  <Trash2 size={12}/>Confirm
                </button>
              </div>
            ) : (
              <button className="btn-ghost" onClick={() => setConfirmClear(true)}>
                <Trash2 size={13}/>Clear All
              </button>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="stat-grid stagger" style={{ marginBottom:20 }}>
          {[
            { label:'Total Scans',   value: history.length },
            { label:'Avg Risk',      value: Math.round(avgRisk*100),  suffix:'%' },
            { label:'Total Issues',  value: history.reduce((s,h) => s+(h.total_violations||0),0) },
            { label:'Healthy Runs',  value: history.filter(h=>h.pipeline_health==='HEALTHY').length },
          ].map(({ label, value, suffix='' }) => (
            <div key={label} className="stat-card anim-fade-up" style={{ opacity:0 }}>
              <div className="stat-val grad"><AnimatedCounter value={value} suffix={suffix} duration={800}/></div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* History list */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {history.map((h, i) => (
            <div key={h.report_id} className="card hover-lift anim-fade-up"
              style={{ opacity:0, animationDelay:`${i*0.05}s`,
                borderLeft:`3px solid ${HC[h.pipeline_health]}33`,
                transition:'all 0.25s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderLeftColor = HC[h.pipeline_health]}
              onMouseLeave={e => e.currentTarget.style.borderLeftColor = HC[h.pipeline_health]+'33'}>

              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{
                  fontSize:'1.8rem', flexShrink:0,
                  animation: h.pipeline_health === 'CRITICAL' ? 'pulse 1.5s ease-in-out infinite' : 'none'
                }}>{HI[h.pipeline_health] || '📋'}</div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3 }}>
                    {h.dataset_name}
                  </div>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:'0.75rem' }}>
                    <span style={{ color: HC[h.pipeline_health], fontWeight:700 }}>{h.pipeline_health}</span>
                    <span style={{ color:'var(--text3)' }}>·</span>
                    <span style={{ color:'var(--text2)' }}>{h.total_violations} violation{h.total_violations!==1?'s':''}</span>
                    <span style={{ color:'var(--text3)' }}>·</span>
                    <span style={{ color:'var(--text2)' }}>Risk: {Math.round((h.overall_risk_score||0)*100)}%</span>
                    <span style={{ color:'var(--text3)' }}>·</span>
                    <span style={{ color:'var(--text3)' }}>{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Mini risk bar */}
                <div style={{ width:64, flexShrink:0 }}>
                  <div className="progress-bar" style={{ height:5 }}>
                    <div style={{
                      height:'100%', borderRadius:3,
                      background: HC[h.pipeline_health],
                      width:`${Math.round((h.overall_risk_score||0)*100)}%`,
                      transition:'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                      boxShadow:`0 0 6px ${HC[h.pipeline_health]}55`
                    }}/>
                  </div>
                  <div style={{ fontSize:'0.62rem', color:'var(--text3)', textAlign:'center', marginTop:2 }}>
                    {Math.round((h.overall_risk_score||0)*100)}%
                  </div>
                </div>

                <Link to={`/report/${h.report_id}`} className="btn-ghost" style={{ textDecoration:'none', flexShrink:0 }}>
                  <ExternalLink size={12}/>View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
