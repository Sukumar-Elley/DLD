import { useRef, useState } from 'react'
import { Upload, CheckCircle, X, AlertCircle } from 'lucide-react'

const FMT = ['.csv','.xlsx','.xls','.json','.parquet']

export default function FileUpload({ onFile, uploading, error, uploadData, onReset }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef()

  const handle = (file) => {
    if (!file) return
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!FMT.includes(ext)) { alert(`Unsupported format. Use: ${FMT.join(', ')}`); return }
    onFile(file)
  }

  if (uploadData) return (
    <div className="anim-scale-in" style={{
      display:'flex', alignItems:'center', gap:12, padding:'12px',
      borderRadius:12, background:'rgba(0,230,118,0.06)',
      border:'1px solid rgba(0,230,118,0.2)'
    }}>
      <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
        background:'rgba(0,230,118,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <CheckCircle size={19} color="var(--low)" />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:800, fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {uploadData.filename}
        </div>
        <div style={{ fontSize:'0.74rem', color:'var(--text2)', marginTop:2 }}>
          {uploadData.total_rows?.toLocaleString()} rows · {uploadData.total_columns} cols ·{' '}
          {uploadData.numeric_columns?.length} numeric · {uploadData.categorical_columns?.length} categorical
        </div>
      </div>
      <button onClick={onReset} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:4 }}>
        <X size={15}/>
      </button>
    </div>
  )

  return (
    <div>
      <div
        className={`upload-zone${drag?' drag':''}`}
        style={{ padding:'2rem 1.25rem', textAlign:'center' }}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
        onClick={() => ref.current?.click()}
      >
        <input ref={ref} type="file" accept={FMT.join(',')} style={{ display:'none' }}
          onChange={e => handle(e.target.files[0])} />

        {uploading ? (
          <div>
            <div className="spin" style={{
              width:40, height:40, borderRadius:'50%',
              border:'3px solid var(--border)', borderTopColor:'var(--accent)',
              margin:'0 auto 12px'
            }}/>
            <p style={{ color:'var(--text2)', fontSize:'0.84rem' }}>Parsing dataset…</p>
          </div>
        ) : (
          <div>
            <div className="anim-float-slow" style={{
              width:54, height:54, borderRadius:14,
              background:'rgba(0,212,255,0.08)',
              border:'1px solid rgba(0,212,255,0.2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 12px', boxShadow:'0 0 20px rgba(0,212,255,0.1)'
            }}>
              <Upload size={22} color="var(--accent)"/>
            </div>
            <p style={{ fontWeight:800, marginBottom:5, fontSize:'0.92rem' }}>Drop your dataset here</p>
            <p style={{ color:'var(--text2)', fontSize:'0.76rem', marginBottom:12 }}>or click to browse files</p>
            <div style={{ display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
              {['CSV','XLSX','JSON','Parquet'].map(f => (
                <span key={f} className="chip" style={{ fontSize:'0.68rem' }}>{f}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && (
        <div style={{ marginTop:8, padding:'9px 13px', borderRadius:9,
          background:'rgba(255,61,61,0.07)', border:'1px solid rgba(255,61,61,0.2)',
          display:'flex', alignItems:'center', gap:7, color:'var(--critical)', fontSize:'0.8rem' }}>
          <AlertCircle size={14}/>{error}
        </div>
      )}
    </div>
  )
}
