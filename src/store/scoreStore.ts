import { create } from 'zustand'
import type { NoteMap, ScoreMetadata } from '../types/score'

interface ScoreState {
  xmlString: string | null
  noteMap: NoteMap | null
  metadata: ScoreMetadata | null
  fileName: string | null
  isDirty: boolean
  isSaving: boolean
  lastSaved: number | null

  setXml: (xml: string, fileName: string) => void
  setNoteMap: (noteMap: NoteMap) => void
  setDirty: (dirty: boolean) => void
  setSaving: (saving: boolean) => void
  setLastSaved: (ts: number) => void
  clearScore: () => void
}

export const useScoreStore = create<ScoreState>((set) => ({
  xmlString: null,
  noteMap: null,
  metadata: null,
  fileName: null,
  isDirty: false,
  isSaving: false,
  lastSaved: null,

  setXml: (xml, fileName) => set({ xmlString: xml, fileName, isDirty: false }),
  setNoteMap: (noteMap) => set({ noteMap, metadata: noteMap.metadata }),
  setDirty: (isDirty) => set({ isDirty }),
  setSaving: (isSaving) => set({ isSaving }),
  setLastSaved: (lastSaved) => set({ lastSaved, isSaving: false, isDirty: false }),
  clearScore: () => set({ xmlString: null, noteMap: null, metadata: null, fileName: null, isDirty: false }),
}))
