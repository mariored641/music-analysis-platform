import { create } from 'zustand'

export interface ResearchLink {
  type: 'measures' | 'notes'
  measureStart: number
  measureEnd?: number
  noteIds?: string[]
  label: string  // display text, e.g. "m.5–8"
}

export interface ResearchNote {
  id: string
  text: string
  links: ResearchLink[]
}

interface ResearchState {
  notes: ResearchNote[]
  addNote: () => void
  updateNote: (id: string, text: string) => void
  addLink: (noteId: string, link: ResearchLink) => void
  removeLink: (noteId: string, linkIndex: number) => void
  removeNote: (id: string) => void
  loadNotes: (notes: ResearchNote[]) => void
  clearAll: () => void
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const useResearchStore = create<ResearchState>((set) => ({
  notes: [],

  addNote: () => set(state => ({
    notes: [...state.notes, { id: makeId(), text: '', links: [] }]
  })),

  updateNote: (id, text) => set(state => ({
    notes: state.notes.map(n => n.id === id ? { ...n, text } : n)
  })),

  addLink: (noteId, link) => set(state => ({
    notes: state.notes.map(n =>
      n.id === noteId ? { ...n, links: [...n.links, link] } : n
    )
  })),

  removeLink: (noteId, linkIndex) => set(state => ({
    notes: state.notes.map(n =>
      n.id === noteId
        ? { ...n, links: n.links.filter((_, i) => i !== linkIndex) }
        : n
    )
  })),

  removeNote: (id) => set(state => ({
    notes: state.notes.filter(n => n.id !== id)
  })),

  loadNotes: (notes) => set({ notes }),

  clearAll: () => set({ notes: [] }),
}))
