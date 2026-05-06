import { useState } from 'react'
import { ChevronDown, ChevronUp, Wrench, FlaskConical, Lightbulb } from 'lucide-react'
import SeverityBadge from './SeverityBadge'
import FeatureRiskBars from './FeatureRiskBars'
import AnimatedCounter from './AnimatedCounter'

const TYPE_ICONS = {
  'Train-Test Contamination':'🔄','Target Leakage':'🎯','Temporal Leakage':'📅',
  'Statistical Distribution Shift':'📊','Feature Correlation Leakage':'🔗','Preprocessing Anti-Pattern':'⚙️'
}
const SEV_ORDER = { CRITICAL:4, HIGH:3, MEDIUM:2, LOW:1 }

function ViolationCard({ v, idx }) {
  const [open, setOpen] = useState(false)
  const sevClass = v.severity.toLowerCase()

  return (
    <div className={`card violation-${sevClass} anim-fade-up ${v.severity==='CRITICAL' ? 'pulse-critical' : ''}`}
      style={{ marginBottom:8, animationDelay:`${idx*0.05}s`, opacity:0, cursor:'pointer' }}>

      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize:'1.2rem', flexShrink:0, marginTop:2,
          animation: v.severity==='CRITICAL' ? 'float 2s ease-in-out infinite' : 'none' }}>
          {TYPE_ICONS[v.leakage_type] || '⚠️'}
        </span>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', marginBottom:4 }}>
            <span style={{ fontWeight:800, fontSize:'0.88rem', overflow:'hidden',
              textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:260 }} title={v.affected_feature}>
              {v.affected_feature}
            </span>
            <SeverityBadge severity={v.severity} score={v.severity_score} />
            <span className="chip" style={{ fontSize:'0.62rem' }}>{v.leakage_type}</span>
            {v.confidence < 1 && (
              <span className="chip" style={{ fontSize:'0.62rem', color:'var(--text3)' }}>
                {(v.confidence*100).toFixed(0)}% conf
              </span>
            )}
          </div>
          <p style={{ fontSize:'0.8rem', color:'var(--text2)', lineHeight:1.55 }}>
            {open ? v.description : v.description.slice(0,130) + (v.description.length > 130 ? '…' : '')}
          </p>
        </div>

        <div style={{ flexShrink:0, color:'var(--text3)', padding:4 }}>
          {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </div>
      </div>

      {open && (
        <div className="anim-fade-up" style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
          {/* Remediation */}
          <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:10,
            background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.12)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6,
              fontSize:'0.65rem', fontWeight:800, color:'var(--accent)', letterSpacing:'0.08em' }}>
              <Wrench size={10}/> REMEDIATION
            </div>
            <p style={{ fontSize:'0.8rem', color:'var(--text2)', lineHeight:1.65, whiteSpace:'pre-wrap' }}>
              {v.remediation}
            </p>
          </div>

          {/* Statistical evidence */}
          {Object.keys(v.statistical_evidence || {}).length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:'0.62rem', fontWeight:800, color:'var(--text3)', marginBottom:6,
                letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:5 }}>
                <FlaskConical size={9}/> STATISTICAL EVIDENCE
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {Object.entries(v.statistical_evidence).slice(0,8).map(([k,val]) => (
                  <div key={k} style={{ padding:'3px 9px', borderRadius:7,
                    background:'var(--bg2)', border:'1px solid var(--border)', fontSize:'0.68rem' }}>
                    <span style={{ color:'var(--text3)' }}>{k}: </span>
                    <span className="mono" style={{ color:'var(--text)' }}>
                      {typeof val === 'object' ? JSON.stringify(val).slice(0,30) : String(val).slice(0,30)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {v.detector_name && (
            <div style={{ fontSize:'0.62rem', color:'var(--text3)' }}>
              Detector: <span className="mono">{v.detector_name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DetectionResults({ report }) {
  const [filter, setFilter]     = useState('ALL')
  const [typeFilter, setType]   = useState('ALL')
  const [view, setView]         = useState('violations') // violations | riskchart

  if (!report) return null

  const types = [...new Set(report.violations.map(v => v.leakage_type))]
  const filtered = report.violations.filter(v =>
    (filter === 'ALL' || v.severity === filter) &&
    (typeFilter === 'ALL' || v.leakage_type === typeFilter)
  )
  const counts = { ALL: report.violations.length }
  report.violations.forEach(v => { counts[v.severity] = (counts[v.severity]||0) + 1 })

  const HC = { CRITICAL:'var(--critical)', COMPROMISED:'var(--high)', AT_RISK:'var(--medium)', HEALTHY:'var(--low)' }

  return (
    <div>
      {/* Summary stats */}
      <div className="stat-grid stagger" style={{ marginBottom:14 }}>
        {[
          { label:'Health',    value: report.summary.pipeline_health,                        color: HC[report.summary.pipeline_health] },
          { label:'Risk',      value: Math.round(report.summary.overall_risk_score*100)+'%', color: HC[report.summary.pipeline_health] },
          { label:'Total',     value: report.summary.total_violations },
          { label:'Critical',  value: report.summary.critical_count,   color:'var(--critical)' },
          { label:'High',      value: report.summary.high_count,       color:'var(--high)' },
          { label:'Scan time', value: report.summary.detection_duration_ms+'ms', color:'var(--text2)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card anim-fade-up" style={{ opacity:0 }}>
            <div className="stat-val" style={{ color: color || 'var(--text)' }}>{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="tab-bar" style={{ marginBottom:10, width:'fit-content' }}>
        {['violations','riskchart'].map(v => (
          <button key={v} className={`tab-btn${view===v?' active':''}`} onClick={() => setView(v)}>
            {v === 'violations' ? `Violations (${filtered.length})` : 'Feature Risk Bars'}
          </button>
        ))}
      </div>

      {view === 'riskchart' && (
        <div className="card anim-slide-tab" style={{ marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:'0.88rem', marginBottom:14 }}>Feature Risk Score</div>
          <FeatureRiskBars violations={report.violations} maxShow={12}/>
        </div>
      )}

      {view === 'violations' && (
        <>
          {/* Filters */}
          <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
            {['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding:'4px 13px', borderRadius:20, border:'1px solid',
                cursor:'pointer', fontSize:'0.74rem', fontWeight:700, fontFamily:'var(--font)',
                background: filter===s ? 'rgba(0,212,255,0.08)' : 'transparent',
                borderColor: filter===s ? 'var(--accent)' : 'var(--border2)',
                color: filter===s ? 'var(--accent)' : 'var(--text2)',
                transition:'all 0.15s'
              }}>
                {s}{counts[s]!==undefined ? ` (${counts[s]})` : ''}
              </button>
            ))}
            <select className="field-select" style={{ width:'auto', padding:'4px 10px', fontSize:'0.74rem' }}
              value={typeFilter} onChange={e => setType(e.target.value)}>
              <option value="ALL">All Types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Cards */}
          <div>
            {filtered.length === 0
              ? <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>
                  No violations match filters.
                </div>
              : filtered.map((v, i) => <ViolationCard key={i} v={v} idx={i} />)
            }
          </div>
        </>
      )}
    </div>
  )
}
