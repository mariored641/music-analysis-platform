import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Toast { id: number; text: string; tone?: 'info' | 'success' | 'error'; action?: { label: string; run: () => void } }

interface UiState {
  rightTab: 'inspect' | 'notes'
  leftOpen: boolean
  rightOpen: boolean
  scriptsOpen: boolean
  helpOpen: boolean
  zoom: number            // 0 = fit to width
  toasts: Toast[]

  setRightTab: (t: UiState['rightTab']) => void
  toggleLeft: () => void
  toggleRight: () => void
  setScriptsOpen: (v: boolean) => void
  setHelpOpen: (v: boolean) => void
  setZoom: (z: number) => void
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void
  dismiss: (id: number) => void
}

let toastSeq = 0

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      rightTab: 'inspect',
      leftOpen: true,
      rightOpen: true,
      scriptsOpen: false,
      helpOpen: false,
      zoom: 0,
      toasts: [],

      setRightTab: (rightTab) => set({ rightTab, rightOpen: true }),
      toggleLeft: () => set(s => ({ leftOpen: !s.leftOpen })),
      toggleRight: () => set(s => ({ rightOpen: !s.rightOpen })),
      setScriptsOpen: (scriptsOpen) => set({ scriptsOpen }),
      setHelpOpen: (helpOpen) => set({ helpOpen }),
      setZoom: (zoom) => set({ zoom: zoom === 0 ? 0 : Math.max(0.4, Math.min(2.5, zoom)) }),
      toast: (text, tone = 'info', action) => {
        const id = ++toastSeq
        set(s => ({ toasts: [...s.toasts.slice(-3), { id, text, tone, action }] }))
        setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), action ? 6000 : 3200)
      },
      dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
    }),
    { name: 'map-ui', partialize: s => ({ rightTab: s.rightTab, leftOpen: s.leftOpen, rightOpen: s.rightOpen, zoom: s.zoom }) },
  ),
)
