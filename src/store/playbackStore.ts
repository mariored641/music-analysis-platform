import { create } from 'zustand'

interface PlaybackState {
  isPlaying: boolean
  isPaused: boolean
  tempo: number
  loop: boolean
  currentMeasure: number | null
  currentNoteIds: string[]
  /** Increments on every play request so the engine knows to rebuild */
  playSeq: number

  play: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  setTempo: (bpm: number) => void
  setLoop: (v: boolean) => void
  setCursor: (measure: number | null, noteIds: string[]) => void
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  isPlaying: false,
  isPaused: false,
  tempo: 120,
  loop: false,
  currentMeasure: null,
  currentNoteIds: [],
  playSeq: 0,

  play: () => set(s => ({ isPlaying: true, isPaused: false, playSeq: s.playSeq + 1 })),
  pause: () => set({ isPlaying: false, isPaused: true }),
  resume: () => set({ isPlaying: true, isPaused: false }),
  stop: () => set({ isPlaying: false, isPaused: false, currentMeasure: null, currentNoteIds: [] }),
  setTempo: (tempo) => set({ tempo: Math.max(20, Math.min(400, Math.round(tempo))) }),
  setLoop: (loop) => set({ loop }),
  setCursor: (currentMeasure, currentNoteIds) => set({ currentMeasure, currentNoteIds }),
}))
