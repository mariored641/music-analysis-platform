import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'

export type DrawMode = 'off' | 'draw' | 'erase'

export interface PaletteEntry {
  id: string
  color: string
  width: number
  opacity: number
  linkedLayer?: string
  label?: string
}

interface StylusState {
  activeColorId: string | null
  palette: PaletteEntry[]
  drawMode: DrawMode
  setActiveColor: (id: string | null) => void
  setDrawMode: (mode: DrawMode) => void
  addPaletteEntry: () => void
  updatePaletteEntry: (id: string, changes: Partial<PaletteEntry>) => void
  removePaletteEntry: (id: string) => void
}

const DEFAULT_PALETTE: PaletteEntry[] = [
  { id: 'default-red',    color: '#ef4444', width: 3, opacity: 0.8 },
  { id: 'default-blue',   color: '#3b82f6', width: 3, opacity: 0.8 },
  { id: 'default-green',  color: '#22c55e', width: 3, opacity: 0.8 },
  { id: 'default-yellow', color: '#f59e0b', width: 3, opacity: 0.8 },
  { id: 'default-purple', color: '#a855f7', width: 3, opacity: 0.8 },
]

export const useStylusStore = create<StylusState>()(
  persist(
    (set) => ({
      activeColorId: 'default-red',
      palette: DEFAULT_PALETTE,
      drawMode: 'off' as DrawMode,

      setActiveColor: (id) => set({ activeColorId: id }),
      setDrawMode: (mode) => set({ drawMode: mode }),

      addPaletteEntry: () => set((s) => ({
        palette: [...s.palette, { id: uuid(), color: '#ffffff', width: 3, opacity: 0.8 }],
      })),

      updatePaletteEntry: (id, changes) => set((s) => ({
        palette: s.palette.map(e => e.id === id ? { ...e, ...changes } : e),
      })),

      removePaletteEntry: (id) => set((s) => ({
        palette: s.palette.filter(e => e.id !== id),
        activeColorId: s.activeColorId === id ? (s.palette[0]?.id ?? null) : s.activeColorId,
      })),
    }),
    { name: 'map-stylus-palette' }
  )
)
