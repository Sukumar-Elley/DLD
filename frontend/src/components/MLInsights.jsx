import { useState, useEffect } from 'react'
import { Code2, BookOpen, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react'
import FrameworkBadge from './FrameworkBadge'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const FRAMEWORKS = ['sklearn','xgboost','lightgbm','catboost','keras','pytorch','mlflow','huggingface']

export default function MLInsights() {
  const [selected, setSelected] = useState('sklearn')
  const [data, setData]         = useState(null)
  const [code, setCode]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [tab, setTab]           = useState('patterns')  // patterns | code | dangerous

  const load = async (fw) => {
    setSelected(fw); setLoading(true); setData(null); setCode(null)
    try {
      const [info, bp] = await Promise.all([
        fetch(`${API}/api/pipeline/frameworks/${fw}`).then(r=>r.json()),
        fetch(`${API}/api/pipeline/frameworks/${fw}/best-practice`).then(r=>r.json()),
      ])
      setData(info); setCode(bp)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load('sklearn') }, [])

  return (
    <div>
      {/* Framework selector */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:'0.62rem', fontWeight:800, color:'var(--text3)',
          letterSpacing:'0.08em', marginBottom:8 }}>SELECT FRAMEWORK</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {FRAMEWORKS.map(fw => (
            <div key={fw} onClick={() => load(fw)} style={{ cursor:'pointer' }}>
              <FrameworkBadge framework={fw} size={selected===fw?'lg':'sm'}/>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:'2rem', color:'var(--text3)' }}>
          <div className="spin" style={{ width:24,height:24,border:'2px solid var(--border)',
            borderTopColor:'var(--accent)',borderRadius:'50%',margin:'0 auto 8px' }}/>
          Loading framework knowledge…
        </div>
      )}

      {data && code && !loading && (
        <div className="anim-fade-in">
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12,
            padding:'10px 14px', borderRadius:10,
            background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.12)' }}>
            <FrameworkBadge framework={selected} size="lg"/>
            <div>
              <div style={{ fontWeight:800, fontSize:'0.9rem' }}>{data.framework}</div>
              <div className="mono" style={{ fontSize:'0.68rem', color:'var(--text3)' }}>
                {data.pipeline_type}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="tab-bar" style={{ marginBottom:12 }}>
            {[
              { key:'patterns',  label:'⚠️ Leakage Patterns' },
              { key:'safe',      label:'✅ Safe Patterns' },
              { key:'code',      label:'💻 Best Practice Code' },
              { key:'dangerous', label:'☠️ Dangerous Calls' },
            ].map(({key,label}) => (
              <button key={key} className={`tab-btn${tab===key?' active':''}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          <div className="anim-slide-tab" key={tab}>
            {/* Leakage patterns */}
            {tab==='patterns' && (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {data.detected_issues?.map((issue,i) => (
                  <div key={i} className="anim-fade-up" style={{ opacity:0, animationDelay:`${i*0.05}s`,
                    display:'flex', gap:10, padding:'9px 14px', borderRadius:9,
                    background:'rgba(255,61,61,0.05)', border:'1px solid rgba(255,61,61,0.15)' }}>
                    <AlertTriangle size={14} color="var(--critical)" style={{ flexShrink:0, marginTop:2 }}/>
                    <span style={{ fontSize:'0.8rem', color:'var(--text2)', lineHeight:1.55 }}>{issue}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Safe patterns */}
            {tab==='safe' && (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {data.best_practices?.map((p,i) => (
                  <div key={i} className="anim-fade-up" style={{ opacity:0, animationDelay:`${i*0.05}s`,
                    display:'flex', gap:10, padding:'9px 14px', borderRadius:9,
                    background:'rgba(0,230,118,0.05)', border:'1px solid rgba(0,230,118,0.15)' }}>
                    <CheckCircle size={14} color="var(--low)" style={{ flexShrink:0, marginTop:2 }}/>
                    <span style={{ fontSize:'0.8rem', color:'var(--text2)', lineHeight:1.55 }}>{p}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Best practice code */}
            {tab==='code' && code.best_practice_code && (
              <div>
                <div style={{ fontSize:'0.62rem', color:'var(--text3)', fontWeight:700,
                  letterSpacing:'0.07em', marginBottom:6 }}>
                  PRODUCTION-SAFE CODE TEMPLATE
                </div>
                <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)',
                  borderRadius:10, padding:'14px', overflow:'auto' }}>
                  <pre style={{ margin:0, fontFamily:'var(--mono)', fontSize:'0.75rem',
                    color:'var(--text)', lineHeight:1.65, whiteSpace:'pre-wrap' }}>
                    {code.best_practice_code}
                  </pre>
                </div>
              </div>
            )}

            {/* Dangerous calls */}
            {tab==='dangerous' && (
              <div>
                {code.dangerous_calls?.length > 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {code.dangerous_calls.map((call,i) => (
                      <div key={i} className="anim-fade-up" style={{ opacity:0, animationDelay:`${i*0.06}s`,
                        padding:'10px 14px', borderRadius:9,
                        background:'rgba(255,61,61,0.06)', border:'1px solid rgba(255,61,61,0.2)' }}>
                        <pre style={{ margin:0, fontFamily:'var(--mono)', fontSize:'0.74rem',
                          color:'var(--critical)', whiteSpace:'pre-wrap', lineHeight:1.5 }}>
                          {call}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color:'var(--text3)', fontSize:'0.82rem', padding:'1rem' }}>
                    No specific dangerous calls catalogued for this framework.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
