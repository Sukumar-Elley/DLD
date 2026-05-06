import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 600000,
  maxContentLength: 500 * 1024 * 1024,
  maxBodyLength: 500 * 1024 * 1024,
})

// ── Upload ──────────────────────────────────────────────────────
export const uploadDataset = async (file) => {
  const fd = new FormData()
  fd.append('file', file)
  const r = await API.post('/api/upload/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return r.data
}

// ── Detection ───────────────────────────────────────────────────
export const runDetection    = async (body)        => (await API.post('/api/detect/', body)).data
export const getReport       = async (id)          => (await API.get(`/api/detect/reports/${id}`)).data
export const listReports     = async ()            => (await API.get('/api/detect/reports')).data
export const deleteReport    = async (id)          => (await API.delete(`/api/detect/reports/${id}`)).data

// ── Analytics ───────────────────────────────────────────────────
export const getAnalytics    = async (id)          => (await API.get(`/api/analytics/${id}`)).data
export const getCorrelations = async (id, min=0.3) => (await API.get(`/api/analytics/${id}/correlations?min_corr=${min}`)).data
export const getProfiles     = async (id)          => (await API.get(`/api/analytics/${id}/feature-profiles`)).data

// ── Report ──────────────────────────────────────────────────────
export const getViolations      = async (id, sev) => (await API.get(`/api/report/${id}/violations${sev ? `?severity=${sev}` : ''}`)).data
export const getRecommendations = async (id)      => (await API.get(`/api/report/${id}/recommendations`)).data

// ── Compare (NEW) ────────────────────────────────────────────────
export const compareReports  = async (idA, idB)   => (await API.get(`/api/compare/${idA}/${idB}`)).data
export const violationsDiff  = async (idA, idB)   => (await API.get(`/api/compare/${idA}/${idB}/violations-diff`)).data

// ── Explain (NEW) ────────────────────────────────────────────────
export const explainReport   = async (id)         => (await API.get(`/api/explain/${id}`)).data
export const explainFeature  = async (id, feat)   => (await API.get(`/api/explain/${id}/${encodeURIComponent(feat)}`)).data

// ── Health ──────────────────────────────────────────────────────
export const healthCheck     = async ()           => (await API.get('/health')).data

export default API

// ── Pipeline (NEW) ───────────────────────────────────────────────
export const auditPipeline       = async (config, fw='sklearn') =>
  (await API.post('/api/pipeline/audit', { pipeline_config: config, framework: fw })).data
export const listPipelineAudits  = async ()       => (await API.get('/api/pipeline/audits')).data
export const getPipelineAudit    = async (id)     => (await API.get(`/api/pipeline/audits/${id}`)).data
export const getFrameworks       = async ()       => (await API.get('/api/pipeline/frameworks')).data
export const getFrameworkInfo    = async (fw)     => (await API.get(`/api/pipeline/frameworks/${fw}`)).data
export const getFrameworkCode    = async (fw)     => (await API.get(`/api/pipeline/frameworks/${fw}/best-practice`)).data
export const validatePipelineSteps = async (steps) =>
  (await API.post('/api/pipeline/validate-steps', steps)).data
