import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LayerId } from '../types/annotation'

export type Visibility = Record<LayerId, boolean>

const DEFAULT_VISIBLE: Visibility = {
  harmony: true, melody: true, motif: true, form: true, texture: true,
  labels: true, questions: true, color: true, freehand: true,
}

interface LayerState {
  visible: Visibility
  /** Visibility before entering solo mode (null = not soloing) */
  soloPrev: Visibility | null
  soloLayer: LayerId | null
  /** User color overrides: "melody:CT", "motif:A", "form:B", "harmony:chord" … */
  colors: Record<string, string>

  toggle: (id: LayerId) => void
  setVisible: (id: LayerId, v: boolean) => void
  solo: (id: LayerId) => void
  showAll: () => void
  setColor: (key: string, color: string | null) => void
}

export const useLayerStore = create<LayerState>()(
  persist(
    (set, get) => ({
      visible: DEFAULT_VISIBLE,
      soloPrev: null,
      soloLayer: null,
      colors: {},

      toggle: (id) => set(s => ({ visible: { ...s.visible, [id]: !s.visible[id] }, soloLayer: null, soloPrev: null })),
      setVisible: (id, v) => set(s => ({ visible: { ...s.visible, [id]: v } })),
      solo: (id) => {
        const { soloLayer, soloPrev, visible } = get()
        if (soloLayer === id && soloPrev) { set({ visible: soloPrev, soloPrev: null, soloLayer: null }); return }
        const only = Object.fromEntries(Object.keys(DEFAULT_VISIBLE).map(k => [k, k === id])) as Visibility
        set({ visible: only, soloPrev: soloPrev ?? visible, soloLayer: id })
      },
      showAll: () => set({ visible: { ...DEFAULT_VISIBLE }, soloPrev: null, soloLayer: null }),
      setColor: (key, color) => set(s => {
        const colors = { ...s.colors }
        if (color) colors[key] = color; else delete colors[key]
        return { colors }
      }),
    }),
    {
      name: 'map-layers-v2',
      merge: (persisted, current) => {
        const p = persisted as Partial<LayerState>
        return { ...current, ...p, visible: { ...DEFAULT_VISIBLE, ...(p.visible ?? {}) } }
      },
    },
  ),
)
