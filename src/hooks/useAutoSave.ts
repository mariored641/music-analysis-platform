import { useEffect, useRef } from 'react'
import { useAnnotationStore } from '../store/annotationStore'
import { useScoreStore } from '../store/scoreStore'
import { saveFile } from '../services/storageService'
import { exportToAnalysisJson } from '../services/jsonExporter'

const DEBOUNCE_MS = 1500

export function useAutoSave() {
  const annotations = useAnnotationStore(s => s.annotations)
  const { xmlString, metadata, fileName, setDirty, setSaving, setLastSaved } = useScoreStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!xmlString || !metadata || !fileName) return

    setDirty(true)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await saveFile(fileName, xmlString, annotations)
        // Also export analysis JSON to IndexedDB (for download on request)
        exportToAnalysisJson(xmlString, metadata, annotations)
        setLastSaved(Date.now())
      } catch (e) {
        console.error('Auto-save failed:', e)
        setSaving(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [annotations, xmlString, metadata, fileName])
}
