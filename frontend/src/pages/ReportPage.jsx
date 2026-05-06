import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Download, ExternalLink, Info, RefreshCw } from 'lucide-react'
import { getReport, explainReport } from '../services/api'
import DetectionResults from '../components/DetectionResults'
import ReportViewer from '../components/ReportViewer'
import CorrelationHeatmap from '../components/CorrelationHeatmap'
import FeatureExplorer from '../components/FeatureExplorer'
import RiskGauge from '../components/RiskGauge'
import PipelineAuditPanel from '../components/PipelineAuditPanel'
import MLInsights from '../components/MLInsights'
import { useToast } from '../components/Toast'

const TABS = ['Violations', 'Report', 'Heatmap', 'Features', 'Pipeline', 'ML Insights']
const HC = { CRITICAL:'var(--critical)', COMPROMISED:'var(--high)', AT_RISK:'var(--medium)', HEALTHY:'var(--low)' }

function ExplainBanner({ reportId }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)

  const load = async () => {
    if (data) { setOpen(o => !o); return }
    setLoading(true)
    try {
      const r = await explainReport(reportId)
      setData(r); setOpen(true)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  return (
    <div className="anim-fade-up" style={{ opacity:0, animationDelay:'0.3s' }}>
      <button className="btn-ghost" onClick={load} style={{ width:'100%', justifyContent:'center', marginBottom:8 }}>
        {loading
          ? <><div className="spin" style={{ width:12,height:12,border:'2px solid rgba(255,255,255,0.15)',borderTopColor:'var(--accent)',borderRadius:'50%'}}/>Loading explanation…</>
          : <><Info size={13}/>{open ? 'Hide' : 'Show'} Plain-Language Explanation</>
        }
      </button>
      {open && data && (
        <div className="card anim-scale-in" style={{ marginBottom:12,
          background:'rgba(0,212,255,0.03)', border:'1px solid rgba(0,212,255,0.15)' }}>
          <div style={{ fontWeight:800, fontSize:'0.88rem', marginBottom:10, color:'var(--accent)' }}>
            🤖 AI Explanation
          </div>
          <p style={{ fontSize:'0.82rem', color:'var(--text2)', lineHeight:1.65, marginBottom:10 }}>
            {data.health_explanation}
          </p>
          <p style={{ fontSize:'0.82rem', color:'var(--text2)', lineHeight:1.65, marginBottom:12 }}>
            {data.risk_score_meaning}
          </p>
          {data.top_issues?.length > 0 && (
            <div>
              <div style={{ fontSize:'0.65rem', fontWeight:800, color:'var(--text3)', letterSpacing:'0.08em', marginBottom:8 }}>
                TOP ISSUES
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {data.top_issues.map((issue, i) => (
                  <div key={i} style={{ padding:'8px 12px', borderRadius:9,
                    background:'var(--bg2)', border:'1px solid var(--border)',
                    fontSize:'0.78rem', color:'var(--text2)', lineHeight:1.55 }}>
                    <span style={{ fontWeight:700, color:'var(--text)', marginRight:8 }}>{issue.feature}</span>
                    <span className="chip" style={{ fontSize:'0.62rem', marginRight:6 }}>{issue.type}</span>
                    {issue.one_liner}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.priority_action && (
            <div style={{ marginTop:10, padding:'8px 12px', borderRadius:9,
              background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.12)',
              fontSize:'0.8rem', color:'var(--accent)', fontWeight:600 }}>
              🎯 Priority: {data.priority_action}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReportPage() {
  const { reportId } = useParams()
  const toast = useToast()
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [tab, setTab]         = useState('Violations')

  useEffect(() => {
    getReport(reportId)
      .then(r => { setReport(r); toast?.info('Report loaded') })
      .catch(e => setError(e.response?.data?.detail || 'Report not found — it may have expired.'))
      .finally(() => setLoading(false))
  }, [reportId])

  const exportJSON = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type:'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `leakshield-${reportId.slice(0,8)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast?.info('Report exported as JSON')
  }

  return (
    <div style={{ maxWidth:1240, margin:'0 auto', padding:'1.5rem' }}>

      {/* Back bar */}
      <div className="anim-fade-up" style={{ opacity:0,
        display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <Link to="/analysis" style={{ textDecoration:'none', display:'flex', alignItems:'center',
          gap:6, color:'var(--text2)', fontSize:'0.82rem', transition:'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color='var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--text2)'}>
          <ArrowLeft size={14}/> Back to Analysis
        </Link>
        <Link to="/history" style={{ textDecoration:'none', display:'flex', alignItems:'center',
          gap:6, color:'var(--text3)', fontSize:'0.78rem' }}>
          <ExternalLink size={12}/> History
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign:'center', padding:'5rem', color:'var(--text2)' }}>
          <div style={{ position:'relative', width:64, height:64, margin:'0 auto 16px' }}>
            <div className="spin" style={{
              width:64, height:64, border:'3px solid var(--border)',
              borderTopColor:'var(--accent)', borderRadius:'50%'
            }}/>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div className="pulse" style={{ width:12, height:12, borderRadius:'50%', background:'var(--accent)' }}/>
            </div>
          </div>
          <p style={{ fontSize:'0.88rem' }}>Fetching report…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="anim-scale-in" style={{ padding:'1.5rem', borderRadius:14,
          background:'rgba(255,61,61,0.07)', border:'1px solid rgba(255,61,61,0.2)', color:'var(--critical)' }}>
          <div style={{ fontWeight:800, marginBottom:6 }}>Report Not Found</div>
          <div style={{ fontSize:'0.84rem', opacity:0.8, marginBottom:14 }}>{error}</div>
          <Link to="/analysis" className="btn-ghost" style={{ textDecoration:'none' }}>
            <RefreshCw size={13}/> Run New Analysis
          </Link>
        </div>
      )}

      {/* Report */}
      {report && (
        <>
          {/* Header card */}
          <div className="card anim-scale-in" style={{
            marginBottom:14, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap',
            background:'linear-gradient(135deg,rgba(0,212,255,0.04),rgba(123,97,255,0.04))',
            border:'1px solid rgba(0,212,255,0.14)'
          }}>
            <RiskGauge
              score={report.summary.overall_risk_score}
              health={report.summary.pipeline_health}
              size={110}
            />
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5, flexWrap:'wrap' }}>
                <h1 style={{ fontSize:'1.1rem', fontWeight:800, letterSpacing:'-0.02em' }}>
                  {report.dataset_name}
                </h1>
                <span style={{ fontWeight:800, color: HC[report.summary.pipeline_health] }}>
                  {report.summary.pipeline_health}
                </span>
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:'0.74rem', color:'var(--text3)', marginBottom:8 }}>
                <span>{report.total_rows?.toLocaleString()} rows</span>
                <span>·</span>
                <span>{report.total_features} features</span>
                <span>·</span>
                <span style={{ color: report.summary.total_violations > 0 ? 'var(--high)' : 'var(--low)' }}>
                  {report.summary.total_violations} violations
                </span>
                <span>·</span>
                <span>Risk: {Math.round(report.summary.overall_risk_score*100)}%</span>
                <span>·</span>
                <span className="mono">{report.report_id.slice(0,8)}…</span>
                <span>·</span>
                <span>{new Date(report.created_at).toLocaleString()}</span>
              </div>

              {/* Severity pills */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[
                  ['CRITICAL', report.summary.critical_count, 'var(--critical)'],
                  ['HIGH',     report.summary.high_count,     'var(--high)'],
                  ['MEDIUM',   report.summary.medium_count,   'var(--medium)'],
                  ['LOW',      report.summary.low_count,      'var(--low)'],
                ].filter(([,c]) => c > 0).map(([sev, cnt, color]) => (
                  <div key={sev} style={{
                    padding:'2px 10px', borderRadius:20, fontSize:'0.68rem', fontWeight:700,
                    color, background:`${color}15`, border:`1px solid ${color}30`,
                    display:'flex', alignItems:'center', gap:5
                  }}>
                    <div style={{ width:5, height:5, borderRadius:'50%', background:color,
                      animation: sev==='CRITICAL' ? 'pulse 1.5s ease-in-out infinite' : 'none' }}/>
                    {sev}: {cnt}
                  </div>
                ))}
              </div>
            </div>

            <button className="btn-ghost" onClick={exportJSON} style={{ flexShrink:0 }}>
              <Download size={13}/> Export JSON
            </button>
          </div>

          {/* AI Explain banner */}
          <ExplainBanner reportId={report.report_id} />

          {/* Tab bar */}
          <div className="tab-bar" style={{ marginBottom:12 }}>
            {TABS.map(t => (
              <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>
                {t}{t==='Violations' ? ` (${report.violations.length})` : ''}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="anim-slide-tab" key={tab}>
            {tab === 'Violations' && <DetectionResults report={report}/>}
            {tab === 'Report'     && <ReportViewer report={report}/>}
            {tab === 'Heatmap'    && (
              <div className="card">
                <div style={{ fontWeight:800, marginBottom:14 }}>Feature Correlation Heatmap</div>
                <CorrelationHeatmap reportId={report.report_id}/>
              </div>
            )}
            {tab === 'Features'   && (
              <div className="card">
                <div style={{ fontWeight:800, marginBottom:14 }}>Feature Explorer</div>
                <FeatureExplorer profiles={report.feature_profiles} violations={report.violations}/>
              </div>
            )}
            {tab === 'Pipeline' && (
              <div className="card">
                <div style={{ fontWeight:800, marginBottom:4 }}>ML Pipeline Auditor</div>
                <p style={{ fontSize:'0.78rem', color:'var(--text2)', marginBottom:16, lineHeight:1.5 }}>
                  Audit your ML pipeline structure to find ordering and anti-pattern violations.
                </p>
                <PipelineAuditPanel />
              </div>
            )}
            {tab === 'ML Insights' && (
              <div className="card">
                <div style={{ fontWeight:800, marginBottom:4 }}>Framework Knowledge Base</div>
                <p style={{ fontSize:'0.78rem', color:'var(--text2)', marginBottom:16, lineHeight:1.5 }}>
                  Leakage patterns, safe practices and code for 8 ML frameworks.
                </p>
                <MLInsights />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
