const FW_META = {
  sklearn:      { label:'scikit-learn', color:'#f7931e', bg:'rgba(247,147,30,0.1)',   icon:'⚙️' },
  xgboost:      { label:'XGBoost',      color:'#00bfa5', bg:'rgba(0,191,165,0.1)',    icon:'🌲' },
  lightgbm:     { label:'LightGBM',     color:'#26a69a', bg:'rgba(38,166,154,0.1)',   icon:'💡' },
  catboost:     { label:'CatBoost',     color:'#ff6d00', bg:'rgba(255,109,0,0.1)',    icon:'🐱' },
  keras:        { label:'Keras/TF',     color:'#ff0000', bg:'rgba(255,0,0,0.08)',     icon:'🧠' },
  pytorch:      { label:'PyTorch',      color:'#ee4c2c', bg:'rgba(238,76,44,0.1)',    icon:'🔥' },
  mlflow:       { label:'MLflow',       color:'#0194e2', bg:'rgba(1,148,226,0.1)',    icon:'🔬' },
  huggingface:  { label:'🤗 HuggingFace', color:'#ffcc00', bg:'rgba(255,204,0,0.1)', icon:'🤗' },
}

export default function FrameworkBadge({ framework, size = 'sm', onClick }) {
  const fw  = framework?.toLowerCase().replace(/[^a-z]/g,'') || 'sklearn'
  const meta = FW_META[fw] || { label: framework, color:'var(--accent)', bg:'var(--glow)', icon:'🔧' }
  const pad  = size === 'lg' ? '7px 16px' : '4px 11px'
  const fs   = size === 'lg' ? '0.82rem'  : '0.71rem'

  return (
    <span onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:pad, borderRadius:20, fontSize:fs, fontWeight:700,
      color: meta.color, background: meta.bg,
      border:`1px solid ${meta.color}40`,
      cursor: onClick ? 'pointer' : 'default',
      transition:'all 0.2s',
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.background = meta.bg.replace('0.1','0.18'))}
    onMouseLeave={e => onClick && (e.currentTarget.style.background = meta.bg)}>
      <span style={{ fontSize: size==='lg' ? '1rem' : '0.85rem' }}>{meta.icon}</span>
      {meta.label}
    </span>
  )
}
