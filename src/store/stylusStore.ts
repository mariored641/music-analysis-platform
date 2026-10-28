import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PenMode = 'select' | 'draw' | 'erase'

export interface PaletteEntry {
  id: string
  color: string
  width: number
  opacity: number
}

interface StylusState {
  palette: PaletteEntry[]
  activeId: string
  /** Mouse/touch pointer behavior. A real pen draws regardless (see penAlwaysDraws). */
  mode: PenMode
  penAlwaysDraws: boolean

  setActive: (id: string) => void
  setMode: (m: PenMode) => void
  addEntry: (color?: string) => string
  updateEntry: (id: string, patch: Partial<PaletteEntry>) => void
  removeEntry: (id: string) => void
  setPenAlwaysDraws: (v: boolean) => void
}

const DEFAULT_PALETTE: PaletteEntry[] = [
  { id: 'red', color: '#dc2626', width: 3, opacity: 0.85 },
  { id: 'blue', color: '#2563eb', width: 3, opacity: 0.85 },
  { id: 'green', color: '#16a34a', width: 3, opacity: 0.85 },
  { id: 'amber', color: '#f59e0b', width: 10, opacity: 0.35 },
]

export const useStylusStore = create<StylusState>()(
  persist(
    (set, get) => ({
      palette: DEFAULT_PALETTE,
      activeId: 'red',
      mode: 'select',
      penAlwaysDraws: true,

      setActive: (activeId) => set({ activeId }),
      setMode: (mode) => set({ mode }),
      addEntry: (color = '#7c3aed') => {
        const id = Math.random().toString(36).slice(2, 9)
        set(s => ({ palette: [...s.palette, { id, color, width: 3, opacity: 0.85 }], activeId: id }))
        return id
      },
      updateEntry: (id, patch) => set(s => ({ palette: s.palette.map(e => e.id === id ? { ...e, ...patch } : e) })),
      removeEntry: (id) => {
        const palette = get().palette.filter(e => e.id !== id)
        if (palette.length === 0) return
        set({ palette, activeId: get().activeId === id ? palette[0].id : get().activeId })
      },
      setPenAlwaysDraws: (penAlwaysDraws) => set({ penAlwaysDraws }),
    }),
    { name: 'map-stylus-v2', partialize: s => ({ palette: s.palette, activeId: s.activeId, penAlwaysDraws: s.penAlwaysDraws }) },
  ),
)

export function activeEntry(): PaletteEntry {
  const { palette, activeId } = useStylusStore.getState()
  return palette.find(e => e.id === activeId) ?? palette[0]
}
