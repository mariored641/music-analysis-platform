import { create } from 'zustand'
import type { NoteMap } from '../types/score'
import type { HarmonyItem } from '../services/xmlParser'
import type { ScoreGeometry } from '../score/geometry'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

interface WorkspaceState {
  pieceId: string | null
  xml: string | null
  noteMap: NoteMap | null
  xmlHarmonies: HarmonyItem[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  saveState: SaveState
  lastSaved: number | null
  /** Rendered score geometry (page units) — rebuilt after every render. */
  geometry: ScoreGeometry | null

  setPiece: (p: { pieceId: string; xml: string; noteMap: NoteMap; xmlHarmonies: HarmonyItem[] }) => void
  setStatus: (status: WorkspaceState['status'], error?: string | null) => void
  setSaveState: (s: SaveState, ts?: number) => void
  setGeometry: (g: ScoreGeometry | null) => void
  close: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  pieceId: null,
  xml: null,
  noteMap: null,
  xmlHarmonies: [],
  status: 'idle',
  error: null,
  saveState: 'saved',
  lastSaved: null,
  geometry: null,

  setPiece: ({ pieceId, xml, noteMap, xmlHarmonies }) =>
    set({ pieceId, xml, noteMap, xmlHarmonies, status: 'ready', error: null, saveState: 'saved', geometry: null }),
  setStatus: (status, error = null) => set({ status, error }),
  setSaveState: (saveState, ts) => set(ts ? { saveState, lastSaved: ts } : { saveState }),
  setGeometry: (geometry) => set({ geometry }),
  close: () => set({ pieceId: null, xml: null, noteMap: null, xmlHarmonies: [], status: 'idle', geometry: null }),
}))
