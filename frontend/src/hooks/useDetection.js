import { useState, useCallback } from 'react'
import { uploadDataset, runDetection } from '../services/api'

export function useDetection() {
  const [uploadData, setUploadData]   = useState(null)
  const [report, setReport]           = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [detecting, setDetecting]     = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [detectError, setDetectError] = useState(null)
  const [progress, setProgress]       = useState(0)

  const upload = useCallback(async (file) => {
    setUploading(true); setUploadError(null); setProgress(10)
    try {
      const data = await uploadDataset(file)
      setUploadData(data); setProgress(100)
      return data
    } catch (e) {
      setUploadError(e.response?.data?.detail || 'Upload failed')
      return null
    } finally { setUploading(false) }
  }, [])

  const detect = useCallback(async (config) => {
    setDetecting(true); setDetectError(null); setProgress(20)
    const timer = setInterval(() => setProgress(p => Math.min(p + 8, 88)), 400)
    try {
      const data = await runDetection(config)
      setReport(data); setProgress(100); clearInterval(timer)
      return data
    } catch (e) {
      setDetectError(e.response?.data?.detail || 'Detection failed')
      clearInterval(timer); setProgress(0)
      return null
    } finally { setDetecting(false) }
  }, [])

  const reset = useCallback(() => {
    setUploadData(null); setReport(null)
    setUploadError(null); setDetectError(null); setProgress(0)
  }, [])

  return { uploadData, report, uploading, detecting, uploadError, detectError, progress, upload, detect, reset, setUploadData }
}
