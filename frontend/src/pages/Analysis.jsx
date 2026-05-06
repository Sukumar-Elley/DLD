import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Settings, ChevronDown, Download, RotateCcw, GitCompare, Info } from 'lucide-react'
import FileUpload from '../components/FileUpload'
import DetectionResults from '../components/DetectionResults'
import ReportViewer from '../components/ReportViewer'
import CorrelationHeatmap from '../components/CorrelationHeatmap'
import FeatureExplorer from '../components/FeatureExplorer'
import DetectionStepper from '../components/DetectionStepper'
import Confetti from '../components/Confetti'
import ComparePanel from '../components/ComparePanel'
import { useDetection } from '../hooks/useDetection'
import { useApp } from '../context/AppContext'
import { useToast } from '../components/Toast'
import PipelineAuditPanel from '../components/PipelineAuditPanel'
import MLInsights from '../components/MLInsights'
import { listReports } from '../services/api'

const TABS = ['Violations','Report','Heatmap','Features','Pipeline','ML Insights']

export default function Analysis() {
  const { addToHistory } = useApp()
  const toast = useToast()
  const {
    uploadData, report, uploading, detecting, uploadError, detectError,
    progress, upload, detect, reset, setUploadData
  } = useDetection()

  const [tab, setTab]             = useState('Violations')
  const [cfg, setCfg]             = useState({ test_size:0.2, correlation_threshold:0.95,
    run_statistical:true, run_correlation:true, run_preprocessing:true })
  const [targetCol, setTargetCol] = useState('')
  const [dateCol, setDateCol]     = useState('')
  const [showCfg, setShowCfg]     = useState(false)
  const [confetti, setConfetti]   = useState(false)
  const [showStepper, setShowStepper] = useState(false)
  const [stepperDone, setStepperDone] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [pastReports, setPastReports] = useState([])

  const handleFile = async (file) => {
    const data = await upload(file)
    if (data) {
      setTargetCol(data.inferred_target || data.columns?.at(-1) || '')
      toast.success(`Loaded ${data.total_rows?.toLocaleString()} rows × ${data.total_columns} columns`)
    }
  }

  const handleDetect = async () => {
    if (!uploadData) return
    setShowStepper(true)
    setStepperDone(false)

    const result = await detect({
      dataset_id: uploadData.dataset_id,
      target_column: targetCol || undefined,
      date_column: dateCol || undefined,
      ...cfg,
    })

    if (result) {
      addToHistory({
        report_id: result.report_id,
        dataset_name: uploadData.filename,
        pipeline_health: result.summary.pipeline_health,
        overall_risk_score: result.summary.overall_risk_score,
        total_violations: result.summary.total_violations,
        created_at: result.created_at,
      })
      setTab('Violations')

      if (result.summary.pipeline_health === 'HEALTHY') {
        setConfetti(true)
        toast.success('Pipeline is HEALTHY! No significant leakage detected 🎉')
        setTimeout(() => setConfetti(false), 4000)
      } else if (result.summary.critical_count > 0) {
        toast.error(`${result.summary.critical_count} CRITICAL violation(s) found — stop training now`)
      } else {
        toast.info(`Scan complete — ${result.summary.total_violations} violations found`)
      }

      // Load past reports for compare
      try {
        const pr = await listReports()
        setPastReports(pr.reports || [])
      } catch {}
    } else if (detectError) {
      toast.error('Detection failed: ' + detectError)
    }
  }

  const exportJSON = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `leakshield-${report.report_id.slice(0,8)}.json`
    a.click(); URL.revokeObjectURL(url)
    toast.info('Report exported')
  }

  const handleReset = () => { reset(); setShowStepper(false); setStepperDone(false) }

  return (
    <>
      <Confetti active={confetti} />
      {showCompare && (
        <ComparePanel reports={pastReports} onClose={() => setShowCompare(false)} />
      )}

      <div style={{ maxWidth:1320, margin:'0 auto', padding:'1.5rem' }}>
        <div style={{ display:'grid', gridTemplateColumns: report ? '420px 1fr' : '760px', gap:16, justifyContent:'center' }}>

          {/* ─── Left Panel ─────────────────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Upload */}
            <div className="card anim-fade-up" style={{ opacity:0 }}>
              <div style={{ fontSize:'0.62rem', fontWeight:800, color:'var(--text3)', letterSpacing:'0.09em', marginBottom:10 }}>
                STEP 1 — UPLOAD DATASET
              </div>
              <FileUpload onFile={handleFile} uploading={uploading} error={uploadError}
                uploadData={uploadData} onReset={handleReset}/>
            </div>

            {/* Config */}
            {uploadData && (
              <div className="card anim-fade-up" style={{ opacity:0, animationDelay:'0.08s' }}>
                <button onClick={() => setShowCfg(o => !o)} style={{
                  width:'100%', background:'none', border:'none', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  color:'var(--text2)', fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.07em',
                  fontFamily:'var(--font)'
                }}>
                  <span style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <Settings size={12}/> STEP 2 — CONFIGURE
                  </span>
                  <ChevronDown size={12} style={{ transform: showCfg?'rotate(180deg)':'none', transition:'0.2s' }}/>
                </button>

                {showCfg && (
                  <div className="anim-fade-up" style={{ marginTop:14, display:'flex', flexDirection:'column', gap:11, opacity:0 }}>
                    <div>
                      <label style={{ fontSize:'0.68rem', color:'var(--text3)', marginBottom:4, display:'block', fontWeight:700, letterSpacing:'0.05em' }}>
                        TARGET COLUMN
                      </label>
                      <select className="field-select" value={targetCol} onChange={e => setTargetCol(e.target.value)}>
                        {uploadData.columns.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:'0.68rem', color:'var(--text3)', marginBottom:4, display:'block', fontWeight:700, letterSpacing:'0.05em' }}>
                        DATE COLUMN
                      </label>
                      <select className="field-select" value={dateCol} onChange={e => setDateCol(e.target.value)}>
                        <option value="">Auto-detect</option>
                        {uploadData.columns.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:'0.68rem', color:'var(--text3)', marginBottom:4, display:'block', fontWeight:700, letterSpacing:'0.05em' }}>
                        TEST SPLIT — {Math.round(cfg.test_size*100)}%
                      </label>
                      <input type="range" min="0.1" max="0.4" step="0.05" value={cfg.test_size}
                        onChange={e => setCfg(c => ({...c, test_size:parseFloat(e.target.value)}))}
                        style={{ width:'100%', accentColor:'var(--accent)' }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:'0.68rem', color:'var(--text3)', marginBottom:4, display:'block', fontWeight:700, letterSpacing:'0.05em' }}>
                        CORRELATION THRESHOLD — {cfg.correlation_threshold}
                      </label>
                      <input type="range" min="0.8" max="0.99" step="0.01" value={cfg.correlation_threshold}
                        onChange={e => setCfg(c => ({...c, correlation_threshold:parseFloat(e.target.value)}))}
                        style={{ width:'100%', accentColor:'var(--accent)' }}/>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      {[
                        ['run_statistical','Statistical Distribution Tests'],
                        ['run_correlation','Feature Correlation Analysis'],
                        ['run_preprocessing','Preprocessing Audit'],
                      ].map(([k,label]) => (
                        <label key={k} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                          fontSize:'0.78rem', color:'var(--text2)' }}>
                          <input type="checkbox" checked={cfg[k]}
                            onChange={e => setCfg(c => ({...c,[k]:e.target.checked}))}
                            style={{ accentColor:'var(--accent)', width:14, height:14 }}/>
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Detect button */}
            {uploadData && (
              <button className="btn-primary ripple anim-fade-up"
                onClick={handleDetect} disabled={detecting}
                style={{ opacity:0, animationDelay:'0.12s', width:'100%', justifyContent:'center', padding:'13px' }}>
                {detecting
                  ? <><div className="spin" style={{ width:16,height:16,border:'2px solid rgba(255,255,255,0.25)',borderTopColor:'#fff',borderRadius:'50%' }}/>Running 6 Detectors…</>
                  : <><Play size={15}/>Run Leakage Detection</>}
              </button>
            )}

            {/* Detection stepper */}
            {showStepper && (
              <DetectionStepper active={detecting} onComplete={() => setStepperDone(true)} />
            )}

            {/* Progress bar */}
            {detecting && (
              <div className="anim-fade-in">
                <div className="progress-bar scanner">
                  <div className="progress-fill" style={{ width:`${progress}%` }}/>
                </div>
                <div style={{ fontSize:'0.68rem', color:'var(--text3)', textAlign:'center', marginTop:4 }}>
                  {progress < 100 ? `Scanning… ${Math.round(progress)}%` : 'Generating report…'}
                </div>
              </div>
            )}

            {detectError && (
              <div className="anim-fade-in" style={{ padding:'10px 14px', borderRadius:9,
                background:'rgba(255,61,61,0.08)', border:'1px solid rgba(255,61,61,0.2)',
                color:'var(--critical)', fontSize:'0.82rem' }}>
                {detectError}
              </div>
            )}

            {/* Dataset preview */}
            {uploadData?.sample_data?.length > 0 && !report && (
              <div className="card anim-fade-up" style={{ opacity:0, animationDelay:'0.16s', overflow:'hidden' }}>
                <div style={{ fontSize:'0.62rem', fontWeight:800, color:'var(--text3)', letterSpacing:'0.08em', marginBottom:8 }}>
                  PREVIEW (5 rows)
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.7rem' }}>
                    <thead><tr>
                      {Object.keys(uploadData.sample_data[0]).slice(0,6).map(c => (
                        <th key={c} style={{ padding:'5px 8px', color:'var(--text3)',
                          borderBottom:'1px solid var(--border)', textAlign:'left',
                          whiteSpace:'nowrap', maxWidth:80, fontWeight:700 }}>{c}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {uploadData.sample_data.map((row,i) => (
                        <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                          {Object.values(row).slice(0,6).map((v,j) => (
                            <td key={j} className="mono" style={{ padding:'4px 8px', color:'var(--text2)', whiteSpace:'nowrap' }}>
                              {String(v).slice(0,14)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ─── Right Panel ─────────────────────────────────────────── */}
          {report && (
            <div className="anim-fade-in">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
                <div className="tab-bar" style={{ flex:1, marginRight:8 }}>
                  {TABS.map(t => (
                    <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>
                      {t}{t==='Violations' ? ` (${report.violations.length})` : ''}
                    </button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {pastReports.length > 1 && (
                    <button className="btn-ghost" onClick={() => setShowCompare(true)}>
                      <GitCompare size={13}/>Compare
                    </button>
                  )}
                  <button className="btn-ghost" onClick={exportJSON}>
                    <Download size={13}/>JSON
                  </button>
                </div>
              </div>

              <div className="anim-slide-tab">
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
                      Build or paste your pipeline configuration to detect ordering violations,
                      global scaler anti-patterns, SMOTE leakage, and estimator ordering issues.
                    </p>
                    <PipelineAuditPanel />
                  </div>
                )}
                {tab === 'ML Insights' && (
                  <div className="card">
                    <div style={{ fontWeight:800, marginBottom:4 }}>Framework Knowledge Base</div>
                    <p style={{ fontSize:'0.78rem', color:'var(--text2)', marginBottom:16, lineHeight:1.5 }}>
                      Browse leakage patterns, safe practices, and production-safe code templates
                      for sklearn, XGBoost, LightGBM, CatBoost, Keras, PyTorch, MLflow, and HuggingFace.
                    </p>
                    <MLInsights />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
