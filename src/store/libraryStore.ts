import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LibraryPiece {
  id: string
  title: string
  composer: string
  fileName: string
  totalMeasures: number
  lastOpened: number
  dateAdded: number
  lastModified: number
  key?: string
  timeSignature?: string
  genre?: string
  year?: number
  notes?: string
  tagCount?: number
}

export type AppView = 'library' | 'analysis'

interface LibraryState {
  pieces: LibraryPiece[]
  activePieceId: string | null
  currentView: AppView

  addPiece: (piece: LibraryPiece) => void
  removePiece: (id: string) => void
  updatePiece: (id: string, patch: Partial<LibraryPiece>) => void
  setActive: (id: string | null) => void
  setView: (view: AppView) => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      pieces: [],
      activePieceId: null,
      currentView: 'library',

      addPiece: (piece) => set(s => {
        const i = s.pieces.findIndex(p => p.id === piece.id)
        if (i === -1) return { pieces: [piece, ...s.pieces] }
        const pieces = [...s.pieces]
        pieces[i] = { ...pieces[i], ...piece }
        return { pieces }
      }),
      removePiece: (id) => set(s => ({
        pieces: s.pieces.filter(p => p.id !== id),
        activePieceId: s.activePieceId === id ? null : s.activePieceId,
      })),
      updatePiece: (id, patch) => set(s => ({ pieces: s.pieces.map(p => p.id === id ? { ...p, ...patch } : p) })),
      setActive: (activePieceId) => set({ activePieceId }),
      setView: (currentView) => set({ currentView }),
    }),
    { name: 'map-library' },
  ),
)
