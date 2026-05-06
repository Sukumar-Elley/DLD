import { useState } from 'react'
import { Play, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import FrameworkBadge from './FrameworkBadge'
import PipelineVisualizer from './PipelineVisualizer'
import { useToast } from './Toast'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const COMMON_STEPS = {
  sklearn: [
    { name:'imputer',   class:'SimpleImputer',      params:{ strategy:'median' } },
    { name:'scaler',    class:'StandardScaler',      params:{} },
    { name:'encoder',   class:'OneHotEncoder',       params:{ handle_unknown:'ignore' } },
    { name:'selector',  class:'SelectKBest',         params:{ k:10 } },
    { name:'model',     class:'RandomForestClassifier', params:{ n_estimators:100 } },
  ],
  xgboost: [
    { name:'imputer',   class:'SimpleImputer',       params:{ strategy:'median' } },
    { name:'scaler',    class:'StandardScaler',       params:{} },
    { name:'model',     class:'XGBClassifier',        params:{ n_estimators:200, early_stopping_rounds:50 } },
  ],
  lightgbm: [
    { name:'imputer',   class:'SimpleImputer',       params:{ strategy:'median' } },
    { name:'model',     class:'LGBMClassifier',       params:{ n_estimators:200 } },
  ],
  imblearn: [
    { name:'imputer',   class:'SimpleImputer',       params:{ strategy:'median' } },
    { name:'scaler',    class:'StandardScaler',       params:{} },
    { name:'smote',     class:'SMOTE',               params:{ random_state:42 } },
    { name:'model',     class:'RandomForestClassifier', params:{} },
  ],
}

const FRAMEWORKS = ['sklearn','xgboost','lightgbm','catboost','keras','pytorch','mlflow','imblearn']

export default function PipelineAuditPanel() {
  const toast = useToast()
  const [framework, setFramework] = useState('sklearn')
  const [steps, setSteps]         = useState(COMMON_STEPS.sklearn)
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [jsonMode, setJsonMode]   = useState(false)
  const [jsonText, setJsonText]   = useState('')

  const audit = async () => {
    setLoading(true)
    try {
      let config
      if (jsonMode) {
        config = JSON.parse(jsonText)
      } else {
        config = { steps: steps.map(s => [s.name, { class: s.class, ...s.params }]) }
      }
      const r = await fetch(`${API}/api/pipeline/audit`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ pipeline_config: config, framework })
      })
      const data = await r.json()
      setResult(data)
      if (data.overall_risk === 'SAFE')     toast.success('Pipeline structure is SAFE ✅')
      else if (data.overall_risk === 'LEAKY')  toast.error(`Pipeline is LEAKY — ${data.violations.length} violations found`)
      else                                     toast.info(`Pipeline AT_RISK — ${data.violations.length} issue(s) found`)
    } catch(e) {
      toast.error('Audit failed: ' + e.message)
    } finally { setLoading(false) }
  }

  const loadTemplate = (fw) => {
    setFramework(fw)
    const tmpl = COMMON_STEPS[fw] || COMMON_STEPS.sklearn
    setSteps([...tmpl])
    setResult(null)
    toast.info(`Loaded ${fw} template`)
  }

  const addStep = () => setSteps(s => [...s, { name:`step_${s.length}`, class:'', params:{} }])
  const removeStep = i => setSteps(s => s.filter((_,j) => j!==i))
  const moveStep = (i, dir) => {
    const arr = [...steps]
    const j = i + dir
    if (j<0 || j>=arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setSteps(arr)
  }
  const updateStep = (i, field, val) => {
    const arr = [...steps]
    arr[i] = { ...arr[i], [field]: val }
    setSteps(arr)
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap:16 }}>

      {/* Left: Builder */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

        {/* Framework selector */}
        <div className="card">
          <div style={{ fontSize:'0.62rem', fontWeight:800, color:'var(--text3)',
            letterSpacing:'0.08em', marginBottom:8 }}>FRAMEWORK</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
            {FRAMEWORKS.map(fw => (
              <div key={fw} onClick={() => setFramework(fw)} style={{ cursor:'pointer',
                opacity: framework===fw ? 1 : 0.6, transition:'opacity 0.2s' }}>
                <FrameworkBadge framework={fw} size={framework===fw?'lg':'sm'}/>
              </div>
            ))}
          </div>

          {/* Template buttons */}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.68rem', color:'var(--text3)', alignSelf:'center' }}>Templates:</span>
            {Object.keys(COMMON_STEPS).map(fw => (
              <button key={fw} className="btn-ghost" style={{ padding:'3px 10px', fontSize:'0.7rem' }}
                onClick={() => loadTemplate(fw)}>
                {fw}
              </button>
            ))}
          </div>
        </div>

        {/* Input mode toggle */}
        <div className="card">
          <div style={{ display:'flex', gap:6, marginBottom:10 }}>
            <button className={`tab-btn${!jsonMode?' active':''}`}
              onClick={() => setJsonMode(false)} style={{ fontSize:'0.75rem', padding:'5px 12px' }}>
              Visual Builder
            </button>
            <button className={`tab-btn${jsonMode?' active':''}`}
              onClick={() => setJsonMode(true)} style={{ fontSize:'0.75rem', padding:'5px 12px' }}>
              JSON / Paste Config
            </button>
          </div>

          {jsonMode ? (
            <div>
              <div style={{ fontSize:'0.68rem', color:'var(--text3)', marginBottom:5, fontWeight:600 }}>
                Paste your pipeline config (sklearn, mlflow, keras, or any supported format)
              </div>
              <textarea
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                rows={10}
                placeholder={`{\n  "steps": [\n    ["scaler", {"class": "StandardScaler"}],\n    ["model", {"class": "RandomForestClassifier"}]\n  ]\n}`}
                style={{ width:'100%', background:'var(--bg2)', border:'1px solid var(--border2)',
                  borderRadius:9, padding:'10px', color:'var(--text)', fontFamily:'var(--mono)',
                  fontSize:'0.74rem', resize:'vertical', outline:'none', lineHeight:1.6 }}
              />
            </div>
          ) : (
            <div>
              <div style={{ fontSize:'0.68rem', fontWeight:800, color:'var(--text3)',
                letterSpacing:'0.08em', marginBottom:8 }}>
                PIPELINE STEPS (drag to reorder)
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {steps.map((step, i) => (
                  <div key={i} className="anim-fade-up" style={{ opacity:0,
                    display:'flex', gap:6, alignItems:'center',
                    padding:'8px 10px', borderRadius:9,
                    background:'var(--bg2)', border:'1px solid var(--border)' }}>
                    <span className="mono" style={{ fontSize:'0.65rem', color:'var(--text3)', width:20,
                      textAlign:'center', flexShrink:0 }}>{i+1}</span>
                    <input value={step.name} onChange={e => updateStep(i,'name',e.target.value)}
                      placeholder="step name"
                      style={{ flex:1, background:'var(--card)', border:'1px solid var(--border2)',
                        borderRadius:7, padding:'5px 8px', color:'var(--text)',
                        fontFamily:'var(--font)', fontSize:'0.75rem', outline:'none' }}/>
                    <input value={step.class} onChange={e => updateStep(i,'class',e.target.value)}
                      placeholder="ClassName"
                      style={{ flex:2, background:'var(--card)', border:'1px solid var(--border2)',
                        borderRadius:7, padding:'5px 8px', color:'var(--accent)',
                        fontFamily:'var(--mono)', fontSize:'0.74rem', outline:'none' }}/>
                    <button onClick={() => moveStep(i,-1)} className="btn-ghost"
                      style={{ padding:'4px 6px' }}><ArrowUp size={11}/></button>
                    <button onClick={() => moveStep(i,1)} className="btn-ghost"
                      style={{ padding:'4px 6px' }}><ArrowDown size={11}/></button>
                    <button onClick={() => removeStep(i)} className="btn-ghost"
                      style={{ padding:'4px 6px', color:'var(--critical)' }}><Trash2 size={11}/></button>
                  </div>
                ))}
              </div>
              <button className="btn-ghost" onClick={addStep}
                style={{ marginTop:8, width:'100%', justifyContent:'center', fontSize:'0.78rem' }}>
                <Plus size={13}/>Add Step
              </button>
            </div>
          )}
        </div>

        <button className="btn-primary ripple" onClick={audit} disabled={loading}
          style={{ width:'100%', justifyContent:'center' }}>
          {loading
            ? <><div className="spin" style={{ width:14,height:14,border:'2px solid rgba(255,255,255,0.2)',borderTopColor:'#fff',borderRadius:'50%' }}/>Auditing Pipeline…</>
            : <><Play size={14}/>Audit Pipeline</>}
        </button>
      </div>

      {/* Right: Results */}
      {result && (
        <div className="anim-scale-in">
          <PipelineVisualizer auditResult={result}/>
        </div>
      )}
    </div>
  )
}
