import { Link, useLocation } from 'react-router-dom'
import { Shield, Activity, History, GitCompare } from 'lucide-react'

export default function Navbar() {
  const { pathname } = useLocation()

  const links = [
    { to: '/',         icon: Shield,     label: 'Home' },
    { to: '/analysis', icon: Activity,   label: 'Analyze' },
    { to: '/history',  icon: History,    label: 'History' },
  ]

  return (
    <nav style={{
      background: 'rgba(3,7,15,0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ maxWidth:1300, margin:'0 auto', padding:'0 1.5rem',
        display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>

        {/* Logo */}
        <Link to="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:34, height:34, borderRadius:9,
            background:'linear-gradient(135deg,#00d4ff,#7b61ff)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 0 20px rgba(0,212,255,0.35)',
            animation:'pulseGlow 3s ease-in-out infinite',
          }}>
            <Shield size={17} color="#fff" />
          </div>
          <span style={{ fontSize:'1rem', fontWeight:800, color:'var(--text)', letterSpacing:'-0.02em' }}>
            Leak<span style={{ color:'var(--accent)' }}>Shield</span>
            <span className="mono" style={{ fontSize:'0.6rem', color:'var(--text3)', marginLeft:4 }}>v2</span>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display:'flex', gap:2 }}>
          {links.map(({ to, icon: Icon, label }) => {
            const active = pathname === to
            return (
              <Link key={to} to={to} style={{
                textDecoration:'none', display:'flex', alignItems:'center', gap:6,
                padding:'6px 14px', borderRadius:9, fontSize:'0.82rem', fontWeight:700,
                color: active ? 'var(--accent)' : 'var(--text2)',
                background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                border: `1px solid ${active ? 'rgba(0,212,255,0.2)' : 'transparent'}`,
                transition:'all 0.2s',
              }}>
                <Icon size={13} />{label}
              </Link>
            )
          })}
        </div>

        {/* Badge */}
        <div className="chip" style={{ color:'var(--accent)', borderColor:'rgba(0,212,255,0.2)', gap:6 }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--accent)' }}
            className="pulse" />
          6 Detectors Active
        </div>
      </div>
    </nav>
  )
}
