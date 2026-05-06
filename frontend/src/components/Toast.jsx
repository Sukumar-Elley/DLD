import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((msg, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => remove(id), duration)
  }, [])

  const remove = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const ICONS = { success: CheckCircle, error: XCircle, info: Info }

  return (
    <ToastCtx.Provider value={{ success: m => add(m,'success'), error: m => add(m,'error'), info: m => add(m,'info') }}>
      {children}
      <div className="toast-container">
        {toasts.map(({ id, msg, type }) => {
          const Icon = ICONS[type] || Info
          return (
            <div key={id} className={`toast toast-${type}`}>
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{msg}</span>
              <button onClick={() => remove(id)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', padding: 2 }}>
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
