import { create } from 'zustand'
import type { LayerId } from '../types/annotation'

interface AnnotationBrowserState {
  browsingLayer: LayerId | null
  checkedIds: Set<string>

  setBrowsingLayer: (id: LayerId | null) => void
  toggleChecked: (id: string) => void
  checkAll: (ids: string[]) => void
  uncheckAll: () => void
}

export const useAnnotationBrowserStore = create<AnnotationBrowserState>()((set) => ({
  browsingLayer: null,
  checkedIds: new Set(),

  setBrowsingLayer: (id) => set((state) => ({
    browsingLayer: state.browsingLayer === id ? null : id,
    checkedIds: new Set(),
  })),

  toggleChecked: (id) => set((state) => {
    const next = new Set(state.checkedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { checkedIds: next }
  }),

  checkAll: (ids) => set({ checkedIds: new Set(ids) }),

  uncheckAll: () => set({ checkedIds: new Set() }),
}))
