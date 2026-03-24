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
  /**
   * noteMapId → verovioSvgId  (ephemeral, rebuilt after each render)
   * Used ONLY as a rendering translation layer — never stored in annotations.
   */
  toVrv: Map<string, string>

  setXml: (xml: string, fileName: string) => void
  setNoteMap: (noteMap: NoteMap) => void
  setDirty: (dirty: boolean) => void
  setSaving: (saving: boolean) => void
  setLastSaved: (ts: number) => void
  setToVrv: (toVrv: Map<string, string>) => void
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
  toVrv: new Map(),

  setXml: (xml, fileName) => set({ xmlString: xml, fileName, isDirty: false }),
  setNoteMap: (noteMap) => set({ noteMap, metadata: noteMap.metadata }),
  setDirty: (isDirty) => set({ isDirty }),
  setSaving: (isSaving) => set({ isSaving }),
  setLastSaved: (lastSaved) => set({ lastSaved, isSaving: false, isDirty: false }),
  setToVrv: (toVrv) => set({ toVrv }),
  clearScore: () => set({ xmlString: null, noteMap: null, metadata: null, fileName: null, isDirty: false, toVrv: new Map() }),
}))
