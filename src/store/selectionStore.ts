import { create } from 'zustand'
import type { ElementRef } from '../types/annotation'

export interface NoteSelection {
  kind: 'notes'
  noteIds: string[]       // noteMap IDs, in score order
  measureStart: number
  measureEnd: number
  anchorId?: string       // fixed end for Shift-extension
  focusId?: string        // moving end
  wholeMeasures?: boolean // selected by clicking a measure / system
  anchorMeasure?: number  // for whole-measure extension
  focusMeasure?: number
}

export interface ElementSelection {
  kind: 'element'
  element: ElementRef
  measureStart: number
  measureEnd: number
}

export type Selection = NoteSelection | ElementSelection

export type QuickSection = 'harmony' | 'melody' | 'motif' | 'form' | 'labels' | 'questions' | 'color' | null

interface SelectionState {
  selection: Selection | null
  selectedAnnotationId: string | null
  /** QuickTagBar section currently expanded (null = collapsed) */
  quickSection: QuickSection
  /** Client position for the quick bar when opened from a right-click */
  quickAt: { x: number; y: number } | null
  /** Measure the score view should scroll to (consumed by ScoreCanvas) */
  scrollTo: { measure: number; noteId?: string; seq: number } | null

  setSelection: (s: Selection | null) => void
  clear: () => void
  selectAnnotation: (id: string | null) => void
  openQuick: (section: QuickSection, at?: { x: number; y: number } | null) => void
  requestScroll: (measure: number, noteId?: string) => void
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selection: null,
  selectedAnnotationId: null,
  quickSection: null,
  quickAt: null,
  scrollTo: null,

  setSelection: (selection) => set({ selection, selectedAnnotationId: null, quickAt: null, ...(selection ? {} : { quickSection: null }) }),
  clear: () => set({ selection: null, selectedAnnotationId: null, quickSection: null, quickAt: null }),
  selectAnnotation: (selectedAnnotationId) => set({ selectedAnnotationId }),
  openQuick: (quickSection, quickAt = null) => set({ quickSection, quickAt }),
  requestScroll: (measure, noteId) => set(s => ({ scrollTo: { measure, noteId, seq: (s.scrollTo?.seq ?? 0) + 1 } })),
}))
