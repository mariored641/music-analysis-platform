import { useEffect } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { useScoreStore } from '../store/scoreStore'
import { useAnnotationStore } from '../store/annotationStore'
import { useResearchStore } from '../store/researchStore'
import { loadFile, saveFile } from '../services/storageService'
import { readSyncFile } from '../services/syncService'
import { parseMusicXml } from '../services/xmlParser'

// On app startup, restore the last active piece from IndexedDB (+ sync folder if newer)
export function useRestoreSession() {
  useEffect(() => {
    const activePieceId = useLibraryStore.getState().activePieceId
    if (!activePieceId) return

    // Already loaded in this session? Skip.
    if (useScoreStore.getState().xmlString) return

    loadFile(activePieceId).then(async saved => {
      if (!saved) return

      let annotations = saved.annotations
      let researchNotes = saved.researchNotes ?? []

      // Check sync folder for a newer version
      const syncData = await readSyncFile(activePieceId)
      if (syncData) {
        const syncTs = new Date(syncData.savedAt).getTime()
        if (syncTs > saved.savedAt) {
          annotations = syncData.annotations
          researchNotes = syncData.researchNotes
          await saveFile(activePieceId, saved.xml, annotations, researchNotes)
        }
      }

      const noteMap = parseMusicXml(saved.xml)
      useScoreStore.getState().setXml(saved.xml, saved.id)
      useScoreStore.getState().setNoteMap(noteMap)
      useAnnotationStore.getState().loadAnnotations(annotations)
      useResearchStore.getState().loadNotes(researchNotes)
    }).catch(console.error)
  }, [])
}
