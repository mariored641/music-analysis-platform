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
  focusId: string | null
  addNote: (after?: string | null, link?: ResearchLink) => string
  updateNote: (id: string, text: string) => void
  addLink: (noteId: string, link: ResearchLink) => void
  removeLink: (noteId: string, index: number) => void
  removeNote: (id: string) => void
  loadNotes: (notes: ResearchNote[]) => void
  setFocus: (id: string | null) => void
}

const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const useResearchStore = create<ResearchState>()((set, get) => ({
  notes: [],
  focusId: null,

  addNote: (after = null, link) => {
    const id = makeId()
    const note: ResearchNote = { id, text: '', links: link ? [link] : [] }
    const notes = [...get().notes]
    const i = after ? notes.findIndex(n => n.id === after) : -1
    if (i >= 0) notes.splice(i + 1, 0, note); else notes.push(note)
    set({ notes, focusId: id })
    return id
  },
  updateNote: (id, text) => set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, text } : n) })),
  addLink: (noteId, link) => set(s => ({ notes: s.notes.map(n => n.id === noteId ? { ...n, links: [...n.links, link] } : n) })),
  removeLink: (noteId, index) => set(s => ({ notes: s.notes.map(n => n.id === noteId ? { ...n, links: n.links.filter((_, i) => i !== index) } : n) })),
  removeNote: (id) => set(s => ({ notes: s.notes.filter(n => n.id !== id) })),
  loadNotes: (notes) => set({ notes, focusId: null }),
  setFocus: (focusId) => set({ focusId }),
}))
