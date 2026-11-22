import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { builtInPieces, getBuiltInPiece } from '../data/builtInLibrary'

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
  collection?: string
  source?: { label: string; url: string }
}

export type AppView = 'library' | 'analysis'
export type LibraryViewMode = 'pieces' | 'collections'

interface LibraryState {
  pieces: LibraryPiece[]
  activePieceId: string | null
  currentView: AppView
  viewMode: LibraryViewMode
  activeCollectionId: string | null

  addPiece: (piece: LibraryPiece) => void
  removePiece: (id: string) => void
  updatePiece: (id: string, patch: Partial<LibraryPiece>) => void
  setActive: (id: string | null) => void
  setView: (view: AppView) => void
  setCollectionView: (mode: LibraryViewMode, collection?: string) => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      pieces: builtInPieces,
      activePieceId: null,
      currentView: 'library',
      viewMode: 'collections',
      activeCollectionId: null,

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
      setCollectionView: (viewMode, collection) => set({ viewMode, activeCollectionId: collection ?? null }),
    }),
    {
      name: 'map-library',
      merge: (persisted, current) => {
        const saved = persisted as Partial<LibraryState> | undefined
        const pieces = saved?.pieces ?? []
        const savedById = new Map(pieces.map(piece => [piece.id, piece]))
        return {
          ...current,
          ...saved,
          pieces: [
            ...pieces.filter(piece => !getBuiltInPiece(piece.id)),
            ...builtInPieces.map(piece => ({
              ...piece,
              ...savedById.get(piece.id),
              collection: piece.collection,
              source: piece.source,
            })),
          ],
        }
      },
    },
  ),
)
