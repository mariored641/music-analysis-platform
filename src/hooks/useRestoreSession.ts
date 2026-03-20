import { useEffect } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { useScoreStore } from '../store/scoreStore'
import { useAnnotationStore } from '../store/annotationStore'
import { loadFile } from '../services/storageService'
import { parseMusicXml } from '../services/xmlParser'

// On app startup, restore the last active piece from IndexedDB
export function useRestoreSession() {
  useEffect(() => {
    const activePieceId = useLibraryStore.getState().activePieceId
    if (!activePieceId) return

    // Already loaded in this session? Skip.
    if (useScoreStore.getState().xmlString) return

    loadFile(activePieceId).then(saved => {
      if (!saved) return
      const noteMap = parseMusicXml(saved.xml)
      useScoreStore.getState().setXml(saved.xml, saved.id)
      useScoreStore.getState().setNoteMap(noteMap)
      useAnnotationStore.getState().loadAnnotations(saved.annotations)
    }).catch(console.error)
  }, [])
}
