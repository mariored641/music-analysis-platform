import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LAYERS } from '../constants/layers'
import type { LayerId } from '../types/annotation'

type LayerVisibility = Record<LayerId, boolean>

interface LayerState {
  visible: LayerVisibility
  legendColors: Record<string, string>  // key: "layerId:itemIndex"
  toggle: (id: LayerId) => void
  setVisible: (id: LayerId, value: boolean) => void
  setAll: (visible: boolean) => void
  setLegendColor: (layerId: LayerId, itemIndex: number, color: string) => void
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
  svgColor:  true,
}

export const useLayerStore = create<LayerState>()(
  persist(
    (set) => ({
      visible: defaults,
      legendColors: {},

      toggle: (id) => set((s) => ({ visible: { ...s.visible, [id]: !s.visible[id] } })),
      setVisible: (id, value) => set((s) => ({ visible: { ...s.visible, [id]: value } })),
      setAll: (visible) => set((s) => ({
        visible: Object.fromEntries(Object.keys(s.visible).map(k => [k, visible])) as LayerVisibility,
      })),
      setLegendColor: (layerId, itemIndex, color) => set((s) => ({
        legendColors: { ...s.legendColors, [`${layerId}:${itemIndex}`]: color },
      })),
    }),
    { name: 'map-layer-visibility' }
  )
)

/**
 * Returns the effective NOTE_COLORS map, overriding defaults with any user-defined
 * legend colors for the noteColor layer items that have a colorKey.
 */
export function getEffectiveNoteColors(legendColors: Record<string, string>): Record<string, string> {
  const noteColorLayer = LAYERS.find(l => l.id === 'noteColor')
  const result: Record<string, string> = {
    CHORD_TONE:    '#3b82f6',
    PASSING_TONE:  '#a855f7',
    NEIGHBOR_TONE: '#22c55e',
  }
  noteColorLayer?.legend?.forEach((item, i) => {
    if (item.colorKey) {
      const custom = legendColors[`noteColor:${i}`]
      if (custom) result[item.colorKey] = custom
    }
  })
  return result
}
