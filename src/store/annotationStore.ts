import { create } from 'zustand'
import type { Annotation } from '../types/annotation'

type Record_ = Record<string, Annotation>

interface AnnotationState {
  annotations: Record_
  undoStack: Record_[]
  redoStack: Record_[]

  addAnnotation: (a: Annotation) => void
  addAnnotations: (list: Annotation[]) => void
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void
  updateAnnotations: (ids: string[], patch: Partial<Annotation>) => void
  removeAnnotation: (id: string) => void
  removeAnnotations: (ids: string[]) => void
  /** Apply several changes as a single undo step. */
  transact: (fn: (draft: Record_) => void) => void
  undo: () => void
  redo: () => void
  loadAnnotations: (a: Record_) => void
}

const MAX_UNDO = 100

export const useAnnotationStore = create<AnnotationState>()((set, get) => {
  /** Commit a new annotations record, pushing the previous one on the undo stack. */
  const commit = (next: Record_) => {
    const { annotations, undoStack } = get()
    if (next === annotations) return
    set({ annotations: next, undoStack: [...undoStack.slice(-MAX_UNDO + 1), annotations], redoStack: [] })
  }

  return {
    annotations: {},
    undoStack: [],
    redoStack: [],

    addAnnotation: (a) => commit({ ...get().annotations, [a.id]: a }),

    addAnnotations: (list) => {
      if (list.length === 0) return
      const next = { ...get().annotations }
      for (const a of list) next[a.id] = a
      commit(next)
    },

    updateAnnotation: (id, patch) => {
      const cur = get().annotations[id]
      if (!cur) return
      commit({ ...get().annotations, [id]: { ...cur, ...patch } as Annotation })
    },

    updateAnnotations: (ids, patch) => {
      const next = { ...get().annotations }
      let changed = false
      for (const id of ids) if (next[id]) { next[id] = { ...next[id], ...patch } as Annotation; changed = true }
      if (changed) commit(next)
    },

    removeAnnotation: (id) => {
      if (!get().annotations[id]) return
      const next = { ...get().annotations }
      delete next[id]
      commit(next)
    },

    removeAnnotations: (ids) => {
      const next = { ...get().annotations }
      let changed = false
      for (const id of ids) if (next[id]) { delete next[id]; changed = true }
      if (changed) commit(next)
    },

    transact: (fn) => {
      const next = { ...get().annotations }
      fn(next)
      commit(next)
    },

    undo: () => {
      const { undoStack, redoStack, annotations } = get()
      const prev = undoStack[undoStack.length - 1]
      if (!prev) return
      set({ annotations: prev, undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, annotations] })
    },

    redo: () => {
      const { undoStack, redoStack, annotations } = get()
      const next = redoStack[redoStack.length - 1]
      if (!next) return
      set({ annotations: next, redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, annotations] })
    },

    loadAnnotations: (annotations) => set({ annotations, undoStack: [], redoStack: [] }),
  }
})

// ── Free-text label history (autocomplete), shared across pieces ────────────
const HISTORY_KEY = 'map-label-history'

export function getLabelHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

export function pushLabelHistory(label: string) {
  const list = getLabelHistory().filter(l => l !== label)
  list.unshift(label)
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 80))) } catch { /* storage full */ }
}
