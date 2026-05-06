import { useState, useMemo, useEffect } from 'react'
import { Search, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import SeverityBadge from './SeverityBadge'
import AnimatedCounter from './AnimatedCounter'

const SEV_ORDER = { CRITICAL:4, HIGH:3, MEDIUM:2, LOW:1 }

export default function FeatureExplorer({ profiles = [], violations = [] }) {
  const [search, setSearch]     = useState('')
  const [sortKey, setSortKey]   = useState('violation_count')
  const [sortDir, setSortDir]   = useState(-1)
  const [sevFilter, setSevFilter] = useState('ALL')
  const [animated, setAnimated]   = useState(false)

  useEffect(() => { const t = setTimeout(() => setAnimated(true), 80); return () => clearTimeout(t) }, [profiles])

  const rows = useMemo(() => {
    let r = profiles.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (sevFilter === 'ALL' || p.max_severity === sevFilter || (sevFilter === 'NONE' && !p.max_severity))
    )
    r.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey]
      if (sortKey === 'max_severity') { va = SEV_ORDER[va]||0; vb = SEV_ORDER[vb]||0 }
      if (va == null) va = sortDir > 0 ? -Infinity : Infinity
      if (vb == null) vb = sortDir > 0 ? -Infinity : Infinity
      return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir
    })
    return r
  }, [profiles, search, sortKey, sortDir, sevFilter])

  const toggle = k => { if (sortKey===k) setSortDir(d=>-d); else { setSortKey(k); setSortDir(-1) } }
  const SI = ({ k }) => sortKey===k ? (sortDir>0 ? <ArrowUp size={10}/> : <ArrowDown size={10}/>) : null

  const COLS = [
    { key:'name',          label:'Feature',   w:'24%' },
    { key:'dtype',         label:'Type',      w:'9%'  },
    { key:'null_ratio',    label:'Null %',    w:'9%'  },
    { key:'unique_ratio',  label:'Unique %',  w:'9%'  },
    { key:'mean',          label:'Mean',      w:'11%' },
    { key:'std',           label:'Std',       w:'10%' },
    { key:'violation_count',label:'Violations',w:'10%'},
    { key:'max_severity',  label:'Severity',  w:'13%' },
  ]

  const sevCounts = { ALL:profiles.length }
  profiles.forEach(p => {
    const k = p.max_severity || 'NONE'
    sevCounts[k] = (sevCounts[k]||0)+1
  })

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { label:'Total', val:profiles.length, color:'var(--text)' },
          { label:'With Violations', val:profiles.filter(p=>p.violation_count>0).length, color:'var(--high)' },
          { label:'Critical', val:profiles.filter(p=>p.max_severity==='CRITICAL').length, color:'var(--critical)' },
          { label:'Avg Nulls', val:`${(profiles.reduce((s,p)=>s+p.null_ratio,0)/Math.max(profiles.length,1)*100).toFixed(1)}%`, color:'var(--text2)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{
            padding:'6px 14px', borderRadius:9, background:'var(--bg2)',
            border:'1px solid var(--border)', fontSize:'0.74rem',
          }}>
            <span style={{ color:'var(--text3)' }}>{label}: </span>
            <span style={{ color, fontWeight:700 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:180 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)' }}/>
          <input className="field-input" placeholder="Search features…" style={{ paddingLeft:30 }}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="field-select" style={{ width:'auto' }}
          value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
          <option value="ALL">All Severities ({sevCounts.ALL})</option>
          {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
            <option key={s} value={s}>{s} ({sevCounts[s]||0})</option>
          ))}
          <option value="NONE">No Violations ({sevCounts.NONE||0})</option>
        </select>
        <span style={{ fontSize:'0.72rem', color:'var(--text3)', padding:'0 4px', alignSelf:'center' }}>
          {rows.length} / {profiles.length}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX:'auto', borderRadius:10, border:'1px solid var(--border)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.75rem' }}>
          <thead>
            <tr style={{ background:'var(--bg2)' }}>
              {COLS.map(c => (
                <th key={c.key} onClick={() => toggle(c.key)} style={{
                  padding:'9px 11px', textAlign:'left', cursor:'pointer',
                  color:'var(--text3)', fontWeight:800, letterSpacing:'0.05em', fontSize:'0.65rem',
                  borderBottom:'1px solid var(--border)', width:c.w, whiteSpace:'nowrap',
                  userSelect:'none', transition:'color 0.15s',
                }} onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'}
                   onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
                  <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                    {c.label} <SI k={c.key}/>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={COLS.length} style={{ textAlign:'center', padding:'2.5rem', color:'var(--text3)' }}>
                No features match filters.
              </td></tr>
            ) : rows.map((p, i) => {
              const hasViol = p.violation_count > 0
              return (
                <tr key={p.name}
                  className="anim-fade-up"
                  style={{
                    opacity:0, animationDelay:`${i*0.025}s`,
                    background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                    borderBottom:'1px solid var(--border)',
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(0,212,255,0.04)'}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'transparent':'rgba(255,255,255,0.012)'}>

                  <td style={{ padding:'7px 11px', fontWeight:hasViol?800:500,
                    color:hasViol?'var(--text)':'var(--text2)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      {hasViol && <AlertTriangle size={10} color="var(--high)" style={{ flexShrink:0 }}/>}
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:150 }}
                        title={p.name}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding:'7px 11px' }}>
                    <span className="chip mono" style={{ fontSize:'0.6rem' }}>{p.dtype}</span>
                  </td>
                  <td style={{ padding:'7px 11px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ color: p.null_ratio>0.1?'var(--high)':p.null_ratio>0?'var(--medium)':'var(--text3)' }}>
                        {(p.null_ratio*100).toFixed(1)}%
                      </span>
                      {p.null_ratio > 0.1 && (
                        <div style={{ flex:1, height:3, borderRadius:2, background:'var(--border)',
                          maxWidth:30, overflow:'hidden' }}>
                          <div style={{ height:'100%', background:'var(--high)',
                            width: animated ? `${p.null_ratio*100}%` : '0%',
                            transition:`width 0.6s ease ${i*0.02}s` }}/>
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding:'7px 11px', color:'var(--text2)' }}>
                    {(p.unique_ratio*100).toFixed(1)}%
                  </td>
                  <td className="mono" style={{ padding:'7px 11px', color:'var(--text2)' }}>
                    {p.mean != null ? p.mean.toFixed(3) : '—'}
                  </td>
                  <td className="mono" style={{ padding:'7px 11px', color:'var(--text2)' }}>
                    {p.std != null ? p.std.toFixed(3) : '—'}
                  </td>
                  <td style={{ padding:'7px 11px', textAlign:'center' }}>
                    {p.violation_count > 0
                      ? <span style={{ fontWeight:800,
                          color: p.violation_count>=3?'var(--critical)':p.violation_count>=2?'var(--high)':'var(--medium)' }}>
                          {p.violation_count}
                        </span>
                      : <span style={{ color:'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{ padding:'7px 11px' }}>
                    {p.max_severity
                      ? <SeverityBadge severity={p.max_severity}/>
                      : <span style={{ color:'var(--text3)', fontSize:'0.68rem' }}>clean</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
