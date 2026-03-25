import { useEffect, useRef } from 'react'
import { useAnnotationStore } from '../store/annotationStore'
import { useScoreStore } from '../store/scoreStore'
import { useResearchStore } from '../store/researchStore'
import { saveFile } from '../services/storageService'
import { exportToAnalysisJson } from '../services/jsonExporter'

const DEBOUNCE_MS = 1500

export function useAutoSave() {
  const annotations = useAnnotationStore(s => s.annotations)
  const researchNotes = useResearchStore(s => s.notes)
  const { xmlString, metadata, fileName, setDirty, setSaving, setLastSaved } = useScoreStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!xmlString || !metadata || !fileName) return

    setDirty(true)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await saveFile(fileName, xmlString, annotations, researchNotes)
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
  }, [annotations, researchNotes, xmlString, metadata, fileName])
}
