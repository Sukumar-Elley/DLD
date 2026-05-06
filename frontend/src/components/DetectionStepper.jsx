import { useEffect, useState } from 'react'
import { CheckCircle, Circle, Loader, AlertCircle } from 'lucide-react'

const DETECTORS = [
  { id: 'ttc',  label: 'Train-Test Contamination', icon: '🔄', time: 800  },
  { id: 'tl',   label: 'Target Leakage',           icon: '🎯', time: 1400 },
  { id: 'temp', label: 'Temporal Leakage',          icon: '📅', time: 1000 },
  { id: 'stat', label: 'Statistical Distribution',  icon: '📊', time: 1200 },
  { id: 'corr', label: 'Feature Correlation',        icon: '🔗', time: 900  },
  { id: 'prep', label: 'Preprocessing Audit',        icon: '⚙️', time: 700  },
]

export default function DetectionStepper({ active, onComplete }) {
  const [steps, setSteps] = useState(DETECTORS.map(d => ({ ...d, status: 'idle' })))
  const [currentIdx, setCurrentIdx] = useState(0)

  useEffect(() => {
    if (!active) {
      setSteps(DETECTORS.map(d => ({ ...d, status: 'idle' })))
      setCurrentIdx(0)
      return
    }

    let idx = 0
    const run = () => {
      if (idx >= DETECTORS.length) { onComplete?.(); return }
      setCurrentIdx(idx)
      setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'running' } : s))

      setTimeout(() => {
        setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'done' } : s))
        idx++
        run()
      }, DETECTORS[idx].time)
    }
    run()
  }, [active])

  if (!active && steps.every(s => s.status === 'idle')) return null

  return (
    <div className="card anim-scale-in" style={{ padding: '1rem', border: '1px solid rgba(0,212,255,0.2)', background: 'rgba(0,212,255,0.03)' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 10 }}>
        RUNNING DETECTION MODULES
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {steps.map((step, i) => (
          <div key={step.id} className={`detector-step ${step.status}`}
            style={{ animationDelay: `${i * 0.05}s` }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{step.icon}</span>
            <span style={{ flex: 1, fontSize: '0.8rem' }}>{step.label}</span>
            {step.status === 'idle' &&
              <Circle size={13} style={{ opacity: 0.3 }} />}
            {step.status === 'running' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>scanning</span>
                <div className="spin" style={{ width: 12, height: 12, border: '2px solid rgba(0,212,255,0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
              </div>
            )}
            {step.status === 'done' &&
              <CheckCircle size={13} color="var(--low)" style={{ animation: 'scaleIn 0.3s ease' }} />}
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div style={{ marginTop: 10 }}>
        <div className="progress-bar">
          <div className="progress-fill"
            style={{ width: `${(steps.filter(s => s.status === 'done').length / steps.length) * 100}%` }} />
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.68rem', color: 'var(--text3)', marginTop: 4 }}>
          {steps.filter(s => s.status === 'done').length} / {steps.length} modules
        </div>
      </div>
    </div>
  )
}
