import { useEffect } from 'react'
import { useAnnotationStore } from '../store/annotationStore'
import { useResearchStore } from '../store/researchStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { flushSave, isApplyingLoad, refreshFromFolder, scheduleSave } from '../services/pieceService'

/**
 * Save ~1s after any change to annotations or research notes; flush on leave.
 * When the window regains focus, pick up edits made in the sync folder.
 */
export function useAutoSave() {
  useEffect(() => {
    const onChange = () => { if (useWorkspaceStore.getState().pieceId && !isApplyingLoad()) scheduleSave() }
    const u1 = useAnnotationStore.subscribe((s, p) => { if (s.annotations !== p.annotations) onChange() })
    const u2 = useResearchStore.subscribe((s, p) => { if (s.notes !== p.notes) onChange() })
    const flush = () => { flushSave() }
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    const onFocus = () => {
      const id = useWorkspaceStore.getState().pieceId
      if (id && useWorkspaceStore.getState().saveState === 'saved') refreshFromFolder(id)
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => { u1(); u2(); window.removeEventListener('focus', onFocus); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onVis) }
  }, [])
}
