import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LibraryPiece {
  id: string
  title: string
  composer: string
  fileName: string
  totalMeasures: number
  lastOpened: number
  key?: string
  timeSignature?: string
}

interface LibraryState {
  pieces: LibraryPiece[]
  activePieceId: string | null

  addPiece: (piece: LibraryPiece) => void
  removePiece: (id: string) => void
  setActive: (id: string | null) => void
  updatePiece: (id: string, patch: Partial<LibraryPiece>) => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      pieces: [],
      activePieceId: null,

      addPiece: (piece) => set((s) => {
        const existing = s.pieces.findIndex(p => p.id === piece.id)
        if (existing !== -1) {
          const updated = [...s.pieces]
          updated[existing] = piece
          return { pieces: updated }
        }
        return { pieces: [piece, ...s.pieces] }
      }),

      removePiece: (id) => set((s) => ({
        pieces: s.pieces.filter(p => p.id !== id),
        activePieceId: s.activePieceId === id ? null : s.activePieceId,
      })),

      setActive: (activePieceId) => set({ activePieceId }),

      updatePiece: (id, patch) => set((s) => ({
        pieces: s.pieces.map(p => p.id === id ? { ...p, ...patch } : p)
      })),
    }),
    { name: 'map-library' }
  )
)
