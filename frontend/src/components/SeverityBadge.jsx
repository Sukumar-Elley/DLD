export default function SeverityBadge({ severity, score, size = 'sm' }) {
  const cls = { CRITICAL:'badge-critical', HIGH:'badge-high', MEDIUM:'badge-medium', LOW:'badge-low' }
  const pad = size==='lg' ? '5px 14px' : '3px 9px'
  const fs  = size==='lg' ? '0.76rem'  : '0.66rem'
  return (
    <span className={`badge ${cls[severity]||'badge-low'}`}
      style={{ padding:pad, fontSize:fs }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:'currentColor',
        flexShrink:0, animation: severity==='CRITICAL'?'pulse 1.5s ease-in-out infinite':'none' }}/>
      {severity}
      {score !== undefined && (
        <span style={{ opacity:0.65, fontWeight:500, marginLeft:3 }}>{(score*100).toFixed(0)}%</span>
      )}
    </span>
  )
}
