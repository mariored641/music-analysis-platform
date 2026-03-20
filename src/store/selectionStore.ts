import { create } from 'zustand'
import type { SelectionType } from '../types/annotation'

export interface Selection {
  type: SelectionType
  measureStart: number
  measureEnd: number
  noteIds: string[]        // verovio element IDs
  anchorMeasure?: number   // for shift+click range
  notePitch?: string       // e.g. "G4" from Verovio getElementAttr
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  tab?: string
}

interface SelectionState {
  selection: Selection | null
  contextMenu: ContextMenuState
  highlightedMeasure: number | null  // for playback

  setSelection: (sel: Selection | null) => void
  clearSelection: () => void
  showContextMenu: (x: number, y: number, tab?: string) => void
  hideContextMenu: () => void
  setHighlightedMeasure: (m: number | null) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: null,
  contextMenu: { visible: false, x: 0, y: 0 },
  highlightedMeasure: null,

  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: null }),
  showContextMenu: (x, y, tab) => set({ contextMenu: { visible: true, x, y, tab } }),
  hideContextMenu: () => set({ contextMenu: { visible: false, x: 0, y: 0 } }),
  setHighlightedMeasure: (highlightedMeasure) => set({ highlightedMeasure }),
}))
