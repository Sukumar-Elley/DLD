import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Lightbulb } from 'lucide-react'
import RiskGauge from './RiskGauge'
import AnimatedCounter from './AnimatedCounter'

const SEV_COLORS = { CRITICAL:'#ff3d3d', HIGH:'#ff8c00', MEDIUM:'#ffd700', LOW:'#00e676' }
const TYPE_COLORS = ['#00d4ff','#7b61ff','#00ff94','#ff8c00','#a78bfa','#fb923c']

const TT = ({ active, payload }) => active && payload?.length ? (
  <div style={{ background:'var(--card2)', border:'1px solid var(--border2)', borderRadius:9, padding:'8px 12px', fontSize:'0.76rem' }}>
    <p style={{ color:'var(--text)', fontWeight:700 }}>{payload[0].name}</p>
    <p style={{ color:'var(--text2)' }}>Count: <span style={{ color:'var(--accent)' }}>{payload[0].value}</span></p>
  </div>
) : null

export default function ReportViewer({ report }) {
  if (!report) return null
  const { summary, violations, recommendations } = report

  const pieData = Object.entries(SEV_COLORS)
    .map(([k,c]) => ({ name:k, value: summary[`${k.toLowerCase()}_count`]||0, color:c }))
    .filter(d => d.value > 0)

  const typeData = Object.entries(summary.leakage_type_breakdown || {})
    .map(([name, count], i) => ({
      name: name.replace(' Leakage','').replace('Train-Test ','TTC ').replace('Statistical ','Stat. ').slice(0,14),
      count, fill: TYPE_COLORS[i % TYPE_COLORS.length]
    }))

  const HC = { CRITICAL:'var(--critical)', COMPROMISED:'var(--high)', AT_RISK:'var(--medium)', HEALTHY:'var(--low)' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Risk header */}
      <div className="card anim-scale-in" style={{
        display:'flex', alignItems:'center', gap:20, flexWrap:'wrap',
        background:'linear-gradient(135deg,rgba(0,212,255,0.04),rgba(123,97,255,0.04))',
        border:'1px solid rgba(0,212,255,0.12)'
      }}>
        <RiskGauge score={summary.overall_risk_score} health={summary.pipeline_health} size={140}/>

        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ fontSize:'0.65rem', color:'var(--text3)', fontWeight:700, letterSpacing:'0.08em', marginBottom:4 }}>
            PIPELINE STATUS
          </div>
          <div style={{ fontSize:'1.5rem', fontWeight:800, color: HC[summary.pipeline_health], marginBottom:6, letterSpacing:'-0.02em' }}>
            {summary.pipeline_health}
          </div>
          <div style={{ fontSize:'0.8rem', color:'var(--text2)', marginBottom:8 }}>
            <AnimatedCounter value={summary.total_violations} duration={600}/> violation{summary.total_violations!==1?'s':''} detected ·{' '}
            <AnimatedCounter value={summary.detection_duration_ms} duration={800} suffix="ms"/> scan time
          </div>

          {/* Severity breakdown bar */}
          <div style={{ display:'flex', height:6, borderRadius:3, overflow:'hidden', gap:1 }}>
            {pieData.map(d => (
              <div key={d.name} style={{
                flex: d.value, background: d.color,
                transition:'flex 0.8s cubic-bezier(0.16,1,0.3,1)',
                boxShadow:`0 0 8px ${d.color}44`
              }}/>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:6 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.7rem' }}>
                <div style={{ width:6, height:6, borderRadius:2, background:d.color }}/>
                <span style={{ color:'var(--text2)' }}>{d.name}: <strong style={{ color:'var(--text)' }}>{d.value}</strong></span>
              </div>
            ))}
          </div>

          {summary.most_affected_features?.length > 0 && (
            <div style={{ marginTop:8, display:'flex', gap:4, flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.68rem', color:'var(--text3)' }}>Most affected:</span>
              {summary.most_affected_features.slice(0,4).map(f => (
                <span key={f} className="chip" style={{ fontSize:'0.62rem', color:'var(--critical)' }}>{f}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts row */}
      {(pieData.length > 0 || typeData.length > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {pieData.length > 0 && (
            <div className="card anim-fade-up" style={{ opacity:0, animationDelay:'0.1s' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--text3)', letterSpacing:'0.07em', marginBottom:8 }}>
                BY SEVERITY
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={26}>
                    {pieData.map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<TT/>}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {typeData.length > 0 && (
            <div className="card anim-fade-up" style={{ opacity:0, animationDelay:'0.15s' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--text3)', letterSpacing:'0.07em', marginBottom:8 }}>
                BY LEAKAGE TYPE
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={typeData} margin={{ top:0, right:5, bottom:30, left:-22 }}>
                  <XAxis dataKey="name" tick={{ fontSize:8, fill:'var(--text3)' }} angle={-30} textAnchor="end"/>
                  <YAxis tick={{ fontSize:8, fill:'var(--text3)' }} allowDecimals={false}/>
                  <Tooltip content={<TT/>}/>
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {typeData.map((e,i) => <Cell key={i} fill={e.fill}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Dataset info */}
      <div className="card anim-fade-up" style={{ opacity:0, animationDelay:'0.2s' }}>
        <div style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--text3)', letterSpacing:'0.07em', marginBottom:10 }}>
          DATASET INFO
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10 }}>
          {[
            ['Rows',      report.total_rows?.toLocaleString()],
            ['Features',  report.total_features],
            ['Target',    report.target_column || 'Auto'],
            ['Report ID', report.report_id?.slice(0,8)+'…'],
            ['Created',   new Date(report.created_at).toLocaleTimeString()],
            ['Scan (ms)', report.summary.detection_duration_ms],
          ].map(([l,v]) => (
            <div key={l}>
              <div style={{ fontSize:'0.62rem', color:'var(--text3)', marginBottom:2, fontWeight:700, letterSpacing:'0.05em' }}>{l}</div>
              <div className="mono" style={{ fontSize:'0.82rem' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="card anim-fade-up" style={{ opacity:0, animationDelay:'0.25s' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <Lightbulb size={15} color="var(--accent)"/>
          <span style={{ fontWeight:800, fontSize:'0.88rem' }}>Recommendations</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {recommendations.map((r,i) => (
            <div key={i} className="anim-fade-up" style={{
              padding:'9px 14px', borderRadius:9, opacity:0,
              animationDelay:`${0.3 + i*0.05}s`,
              background:'var(--bg2)', border:'1px solid var(--border)',
              fontSize:'0.8rem', color:'var(--text2)', lineHeight:1.6
            }}>{r}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
