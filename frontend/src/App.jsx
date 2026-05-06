import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Analysis from './pages/Analysis'
import History from './pages/History'
import ReportPage from './pages/ReportPage'

export default function App() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Navbar />
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/analysis"    element={<Analysis />} />
        <Route path="/history"     element={<History />} />
        <Route path="/report/:reportId" element={<ReportPage />} />
      </Routes>
    </div>
  )
}
