import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Annotation } from '../types/annotation'

interface AnnotationState {
  annotations: Record<string, Annotation>
  undoStack: Record<string, Annotation>[]
  redoStack: Record<string, Annotation>[]
  labelHistory: string[]  // for autocomplete

  addAnnotation: (annotation: Annotation) => void
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void
  removeAnnotation: (id: string) => void
  undo: () => void
  redo: () => void
  clearAll: () => void
  loadAnnotations: (annotations: Record<string, Annotation>) => void
  addToLabelHistory: (label: string) => void
}

const MAX_UNDO = 50

export const useAnnotationStore = create<AnnotationState>()(
  immer((set) => ({
    annotations: {},
    undoStack: [],
    redoStack: [],
    labelHistory: [],

    addAnnotation: (annotation) => set((state) => {
      state.undoStack.push({ ...state.annotations })
      if (state.undoStack.length > MAX_UNDO) state.undoStack.shift()
      state.redoStack = []
      state.annotations[annotation.id] = annotation
    }),

    updateAnnotation: (id, patch) => set((state) => {
      if (!state.annotations[id]) return
      state.undoStack.push({ ...state.annotations })
      if (state.undoStack.length > MAX_UNDO) state.undoStack.shift()
      state.redoStack = []
      Object.assign(state.annotations[id], patch)
    }),

    removeAnnotation: (id) => set((state) => {
      if (!state.annotations[id]) return
      state.undoStack.push({ ...state.annotations })
      if (state.undoStack.length > MAX_UNDO) state.undoStack.shift()
      state.redoStack = []
      delete state.annotations[id]
    }),

    undo: () => set((state) => {
      const prev = state.undoStack.pop()
      if (!prev) return
      state.redoStack.push({ ...state.annotations })
      state.annotations = prev
    }),

    redo: () => set((state) => {
      const next = state.redoStack.pop()
      if (!next) return
      state.undoStack.push({ ...state.annotations })
      state.annotations = next
    }),

    clearAll: () => set((state) => {
      state.undoStack.push({ ...state.annotations })
      state.annotations = {}
      state.redoStack = []
    }),

    loadAnnotations: (annotations) => set((state) => {
      state.annotations = annotations
      state.undoStack = []
      state.redoStack = []
    }),

    addToLabelHistory: (label) => set((state) => {
      const idx = state.labelHistory.indexOf(label)
      if (idx !== -1) state.labelHistory.splice(idx, 1)
      state.labelHistory.unshift(label)
      if (state.labelHistory.length > 50) state.labelHistory.pop()
    }),
  }))
)
