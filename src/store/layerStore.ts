import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LayerId } from '../types/annotation'

type LayerVisibility = Record<LayerId, boolean>

interface LayerState {
  visible: LayerVisibility
  toggle: (id: LayerId) => void
  setAll: (visible: boolean) => void
}

const defaults: LayerVisibility = {
  harmony:   true,
  melody:    true,
  form:      true,
  motif:     true,
  labels:    true,
  texture:   false,
  freehand:  true,
  noteColor: false,
}

export const useLayerStore = create<LayerState>()(
  persist(
    (set) => ({
      visible: defaults,
      toggle: (id) => set((s) => ({ visible: { ...s.visible, [id]: !s.visible[id] } })),
      setAll: (visible) => set((s) => ({
        visible: Object.fromEntries(Object.keys(s.visible).map(k => [k, visible])) as LayerVisibility
      })),
    }),
    { name: 'map-layer-visibility' }
  )
)
