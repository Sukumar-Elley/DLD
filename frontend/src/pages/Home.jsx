import { Link } from 'react-router-dom'
import { Shield, ArrowRight, Zap, Database, BarChart2, Activity, GitBranch, Clock, Play } from 'lucide-react'
import ParticleHero from '../components/ParticleHero'
import AnimatedCounter from '../components/AnimatedCounter'

const DETECTORS = [
  { icon: '🔄', title: 'Train-Test Contamination', desc: 'Wasserstein distance + KS test detect global scaler footprints and duplicate row contamination.', color: '#00d4ff' },
  { icon: '🎯', title: 'Target Leakage', desc: 'Random Forest importance, MI, ANOVA F-test, and perfect-predictor checks fused into one score.', color: '#7b61ff' },
  { icon: '📅', title: 'Temporal Leakage', desc: 'Spearman rank vs time axis, monotonic trend detection, look-ahead patterns, rolling window audit.', color: '#00ff94' },
  { icon: '📊', title: 'Statistical Distribution', desc: 'KS two-sample, chi-square, and Mann-Whitney U detect distributional contamination between splits.', color: '#ffd700' },
  { icon: '🔗', title: 'Feature Correlation', desc: 'Pairwise Pearson matrix, surrogate pair detection, target-proxy identification, cluster analysis.', color: '#ff8c00' },
  { icon: '⚙️', title: 'Preprocessing Audit', desc: 'StandardScaler, MinMaxScaler, SMOTE-before-split, and LabelEncoder anti-pattern detection.', color: '#ff6b6b' },
]

const STATS = [
  { value: 6, suffix: '', label: 'Detector Modules' },
  { value: 15, suffix: '+', label: 'Detection Algorithms' },
  { value: 4, suffix: '', label: 'File Formats' },
  { value: 99, suffix: '%', label: 'Automated' },
]

export default function Home() {
  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 1.5rem 4rem' }}>

      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', textAlign: 'center', padding: '5rem 1rem 4rem',
        overflow: 'hidden', borderRadius: '0 0 24px 24px',
      }}
        className="grid-bg">
        <ParticleHero />

        {/* Badge */}
        <div className="anim-fade-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 16px',
            borderRadius: 20, marginBottom: '1.5rem',
            background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)',
            fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, position: 'relative', zIndex: 1
          }}>
            <div className="pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
            AI-Powered ML Pipeline Auditing
          </div>
        </div>

        {/* Headline */}
        <h1 className="anim-fade-up" style={{
          animationDelay: '0.2s', opacity: 0,
          fontSize: 'clamp(2.2rem,5.5vw,3.8rem)', fontWeight: 800, lineHeight: 1.1,
          marginBottom: '1.25rem', position: 'relative', zIndex: 1, letterSpacing: '-0.03em'
        }}>
          Stop Leakage Before It<br />
          <span style={{ color: '#2BB5D4' }}>Destroys Your Model</span>
        </h1>

        <p className="anim-fade-up" style={{
          animationDelay: '0.3s', opacity: 0,
          fontSize: '1.05rem', color: 'var(--text2)', maxWidth: 560, margin: '0 auto 2.5rem',
          lineHeight: 1.7, position: 'relative', zIndex: 1
        }}>
          6 advanced detection modules — statistical tests, ML-based signals,
          and structural audits — finding every class of leakage before a single model trains.
        </p>

        <div className="anim-fade-up" style={{
          animationDelay: '0.4s', opacity: 0, display: 'flex',
          gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1
        }}>
          <Link to="/analysis" className="btn-primary ripple" style={{ textDecoration: 'none', fontSize: '0.95rem', padding: '13px 28px' }}>
            <Zap size={16} />Analyze Dataset<ArrowRight size={15} />
          </Link>
          <Link to="/history" className="btn-ghost" style={{ textDecoration: 'none', padding: '13px 22px' }}>
            <Clock size={14} />View History
          </Link>
        </div>
      </div>

      {/* ─── Animated Stats ───────────────────────────────────────── */}
      <div className="stat-grid stagger" style={{ margin: '2.5rem 0' }}>
        {STATS.map(({ value, suffix, label }) => (
          <div key={label} className="stat-card card-glow card-lift anim-fade-up" style={{ opacity: 0 }}>
            <div className="stat-val grad">
              <AnimatedCounter value={value} suffix={suffix} duration={1200} />
            </div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ─── Detector grid ────────────────────────────────────────── */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{
          fontSize: '1.3rem', fontWeight: 800, textAlign: 'center',
          marginBottom: '1.75rem', letterSpacing: '-0.02em'
        }}>
          6 Advanced Detection Modules
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
          {DETECTORS.map(({ icon, title, desc, color }, i) => (
            <div key={title} className="card card-lift anim-fade-up"
              style={{
                opacity: 0, animationDelay: `${i * 0.07}s`, borderLeft: `3px solid ${color}20`,
                cursor: 'default', transition: 'all 0.25s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderLeftColor = color
                e.currentTarget.style.boxShadow = `0 0 24px ${color}15, -6px 0 20px ${color}18`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderLeftColor = color + '20'
                e.currentTarget.style.boxShadow = ''
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>{icon}</span>
                <h3 style={{ fontWeight: 800, fontSize: '0.88rem', color }}>{title}</h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── How it works ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, textAlign: 'center', marginBottom: '1.75rem', letterSpacing: '-0.02em' }}>
          How It Works
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          {[
            { step: '01', title: 'Upload', desc: 'Drop any CSV, Excel, JSON, or Parquet file. Target + date columns auto-inferred.' },
            { step: '02', title: 'Configure', desc: 'Choose detectors, set correlation thresholds, adjust test split.' },
            { step: '03', title: 'Detect', desc: '6 modules scan in sequence. Each reports violations + statistical evidence.' },
            { step: '04', title: 'Remediate', desc: 'Per-violation plain-language fixes, export JSON report, compare runs.' },
          ].map(({ step, title, desc }, i) => (
            <div key={step} className="card anim-fade-up" style={{ opacity: 0, animationDelay: `${i * 0.07}s`, textAlign: 'center' }}>
              <div className="mono" style={{
                fontSize: '2.5rem', fontWeight: 800,
                color: 'rgba(0,212,255,0.12)', marginBottom: 10
              }}>{step}</div>
              <h3 style={{ fontWeight: 800, marginBottom: 6, fontSize: '0.95rem' }}>{title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Feature chips ────────────────────────────────────────── */}
      <div className="card" style={{
        marginBottom: '2.5rem', padding: '1.5rem',
        background: 'linear-gradient(135deg,rgba(0,212,255,0.03),rgba(123,97,255,0.03))',
        border: '1px solid rgba(0,212,255,0.12)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {[
            [Database, 'CSV · Excel · JSON · Parquet'],
            [BarChart2, 'Interactive Heatmap'],
            [Activity, 'Per-Feature Profiler'],
            [GitBranch, 'JSON Export'],
            [Shield, 'CRITICAL→LOW Scoring'],
            [Clock, 'Session History'],
            [GitBranch, 'Compare Reports'],
            [Zap, 'Plain-English Explain'],
          ].map(([Icon, text], i) => (
            <div key={i} className="chip hover-lift" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
              <Icon size={12} style={{ color: 'var(--accent)' }} />{text}
            </div>
          ))}
        </div>
      </div>

      {/* ─── CTA ──────────────────────────────────────────────────── */}
      <div className="card" style={{
        textAlign: 'center', padding: '2.5rem',
        background: 'linear-gradient(135deg,rgba(0,212,255,0.05),rgba(123,97,255,0.05))',
        border: '1px solid rgba(0,212,255,0.15)'
      }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Audit your pipeline in under 30 seconds
        </h3>
        <p style={{ color: 'var(--text2)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
          Upload a dataset. 6 detectors run automatically. Full report generated instantly.
        </p>
        <Link to="/analysis" className="btn-primary ripple" style={{ textDecoration: 'none', fontSize: '0.95rem' }}>
          <Play size={15} />Start Analysis<ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
