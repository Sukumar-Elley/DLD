import { useState } from 'react'
import { AlertTriangle, CheckCircle, ChevronRight, Info } from 'lucide-react'
import SeverityBadge from './SeverityBadge'

const ROLE_COLORS = {
  'Scaler':           '#00d4ff',
  'Imputer':          '#7b61ff',
  'Encoder':          '#f97316',
  'Feature Selection':'#eab308',
  'Decomposition':    '#a78bfa',
  'Resampler':        '#ec4899',
  'Estimator':        '#00e676',
  'Custom':           '#94a3b8',
  'Unknown':          '#475569',
}

const ROLE_ICONS = {
  'Scaler':           '📏',
  'Imputer':          '🩹',
  'Encoder':          '🔤',
  'Feature Selection':'🎯',
  'Decomposition':    '🧩',
  'Resampler':        '⚖️',
  'Estimator':        '🤖',
  'Custom':           '🔧',
  'Unknown':          '❓',
}

function StepNode({ step, violation, index, total }) {
  const [hover, setHover] = useState(false)
  const [open, setOpen]   = useState(false)
  const color   = ROLE_COLORS[step.role] || '#94a3b8'
  const icon    = ROLE_ICONS[step.role]  || '❓'
  const isLast  = index === total - 1
  const sevColor = violation?.severity === 'CRITICAL' ? 'var(--critical)'
                 : violation?.severity === 'HIGH'     ? 'var(--high)'
                 : violation?.severity === 'MEDIUM'   ? 'var(--medium)'
                 : null

  return (
    <div style={{ display:'flex', alignItems:'center', gap:0 }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
        {/* Node */}
        <div onClick={() => violation && setOpen(o=>!o)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position:'relative', width:90, minHeight:80,
            borderRadius:12, padding:'10px 8px', textAlign:'center',
            background: hover ? `${color}18` : `${color}0c`,
            border:`2px solid ${sevColor || (hover ? color : color+'40')}`,
            cursor: violation ? 'pointer' : 'default',
            transition:'all 0.2s',
            boxShadow: sevColor ? `0 0 16px ${sevColor}30` : (hover ? `0 0 16px ${color}25` : 'none'),
          }}>
          <div style={{ fontSize:'1.4rem', marginBottom:4 }}>{icon}</div>
          <div style={{ fontSize:'0.65rem', fontWeight:800, color, lineHeight:1.2,
            overflow:'hidden', textOverflow:'ellipsis', wordBreak:'break-word' }}>
            {step.step_name}
          </div>
          <div style={{ fontSize:'0.55rem', color:'var(--text3)', marginTop:3 }}>
            {step.role}
          </div>

          {/* Violation badge */}
          {violation && (
            <div style={{ position:'absolute', top:-8, right:-8,
              width:18, height:18, borderRadius:'50%',
              background: sevColor, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.6rem', color:'#fff', fontWeight:800,
              animation: violation.severity==='CRITICAL' ? 'pulse 1.5s ease-in-out infinite' : 'none',
              boxShadow:`0 0 8px ${sevColor}` }}>
              !
            </div>
          )}
        </div>

        {/* Class name */}
        <div className="mono" style={{ fontSize:'0.52rem', color:'var(--text3)',
          marginTop:5, textAlign:'center', maxWidth:90,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {step.class_name}
        </div>

        {/* Expanded violation */}
        {open && violation && (
          <div className="anim-scale-in" style={{
            position:'absolute', zIndex:50, top:'100%', left:'50%',
            transform:'translateX(-50%)', marginTop:8,
            background:'var(--card2)', border:`1px solid ${sevColor}50`,
            borderRadius:10, padding:'10px 14px', width:240,
            boxShadow:`0 8px 32px rgba(0,0,0,0.5), 0 0 16px ${sevColor}20`,
          }}>
            <div style={{ fontSize:'0.7rem', fontWeight:700, color: sevColor, marginBottom:5 }}>
              {violation.violation_type}
            </div>
            <p style={{ fontSize:'0.72rem', color:'var(--text2)', lineHeight:1.5, marginBottom:6 }}>
              {violation.description}
            </p>
            <p style={{ fontSize:'0.7rem', color:'var(--accent)', fontStyle:'italic' }}>
              {violation.remediation?.slice(0,100)}…
            </p>
          </div>
        )}
      </div>

      {/* Arrow */}
      {!isLast && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'0 4px' }}>
          <ChevronRight size={16} color="var(--text3)" />
        </div>
      )}
    </div>
  )
}

export default function PipelineVisualizer({ auditResult }) {
  if (!auditResult) return null

  const { steps, violations, overall_risk, risk_score, pipeline_type, framework, recommendations } = auditResult

  const violMap = {}
  violations.forEach(v => { violMap[v.step_index] = v })

  const riskColor = overall_risk === 'LEAKY'   ? 'var(--critical)'
                  : overall_risk === 'AT_RISK'  ? 'var(--high)'
                  : 'var(--low)'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
        padding:'12px 16px', borderRadius:12,
        background: overall_risk==='SAFE' ? 'rgba(0,230,118,0.05)' : overall_risk==='LEAKY' ? 'rgba(255,61,61,0.06)' : 'rgba(255,140,0,0.05)',
        border:`1px solid ${riskColor}25` }}>
        <div>
          <div style={{ fontSize:'0.62rem', color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', marginBottom:2 }}>
            PIPELINE AUDIT
          </div>
          <div style={{ fontSize:'1.1rem', fontWeight:800, color: riskColor }}>{overall_risk}</div>
          <div style={{ fontSize:'0.72rem', color:'var(--text2)' }}>
            {pipeline_type}  ·  {steps.length} steps  ·  {violations.length} issue{violations.length!==1?'s':''}
          </div>
        </div>
        <div style={{ marginLeft:'auto', textAlign:'center' }}>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color: riskColor }}>{Math.round(risk_score*100)}%</div>
          <div style={{ fontSize:'0.62rem', color:'var(--text3)', fontWeight:700 }}>RISK</div>
        </div>
      </div>

      {/* Pipeline flow diagram */}
      <div style={{ overflowX:'auto', paddingBottom:8 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:0,
          minWidth: steps.length * 110, position:'relative' }}>
          {steps.map((step, i) => (
            <StepNode key={i} step={step} index={i} total={steps.length}
              violation={violMap[i] || null} />
          ))}
        </div>
      </div>

      {/* Violations list */}
      {violations.length > 0 && (
        <div>
          <div style={{ fontSize:'0.65rem', fontWeight:800, color:'var(--text3)',
            letterSpacing:'0.08em', marginBottom:8 }}>
            PIPELINE VIOLATIONS ({violations.length})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {violations.map((v, i) => {
              const sc = v.severity==='CRITICAL'?'var(--critical)':v.severity==='HIGH'?'var(--high)':v.severity==='MEDIUM'?'var(--medium)':'var(--low)'
              return (
                <div key={i} className="card anim-fade-up" style={{ opacity:0, animationDelay:`${i*0.06}s`,
                  borderLeft:`3px solid ${sc}`, padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:'1rem' }}>
                      {v.severity==='CRITICAL'?'🚨':v.severity==='HIGH'?'⚠️':'⚡'}
                    </span>
                    <span style={{ fontWeight:800, fontSize:'0.84rem' }}>{v.step_name}</span>
                    <SeverityBadge severity={v.severity} score={v.severity_score}/>
                    <span className="chip" style={{ fontSize:'0.6rem' }}>{v.violation_type}</span>
                  </div>
                  <p style={{ fontSize:'0.78rem', color:'var(--text2)', lineHeight:1.6, marginBottom:6 }}>
                    {v.description}
                  </p>
                  <div style={{ padding:'8px 12px', borderRadius:8, background:'rgba(0,212,255,0.04)',
                    border:'1px solid rgba(0,212,255,0.12)', fontSize:'0.76rem',
                    color:'var(--accent)', whiteSpace:'pre-wrap', fontFamily:'var(--mono)' }}>
                    {v.remediation}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations?.length > 0 && (
        <div>
          <div style={{ fontSize:'0.65rem', fontWeight:800, color:'var(--text3)',
            letterSpacing:'0.08em', marginBottom:8 }}>
            RECOMMENDATIONS
          </div>
          {recommendations.map((r,i) => (
            <div key={i} style={{ padding:'8px 14px', borderRadius:9, marginBottom:5,
              background:'var(--bg2)', border:'1px solid var(--border)',
              fontSize:'0.8rem', color:'var(--text2)', lineHeight:1.55 }}>
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
