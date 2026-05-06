import { createContext, useContext, useState, useCallback } from 'react'

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ls_history') || '[]') } catch { return [] }
  })
  const [currentReport, setCurrentReport] = useState(null)

  const addToHistory = useCallback((entry) => {
    setHistory(prev => {
      const next = [entry, ...prev.filter(h => h.report_id !== entry.report_id)].slice(0, 20)
      try { sessionStorage.setItem('ls_history', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    try { sessionStorage.removeItem('ls_history') } catch {}
  }, [])

  return (
    <AppCtx.Provider value={{ history, addToHistory, clearHistory, currentReport, setCurrentReport }}>
      {children}
    </AppCtx.Provider>
  )
}

export const useApp = () => useContext(AppCtx)
