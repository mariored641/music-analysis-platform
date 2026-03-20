import { create } from 'zustand'

interface PlaybackState {
  isPlaying: boolean
  currentBeat: number
  currentMeasure: number
  tempo: number

  setPlaying: (playing: boolean) => void
  setPosition: (measure: number, beat: number) => void
  setTempo: (bpm: number) => void
  reset: () => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  currentBeat: 0,
  currentMeasure: 1,
  tempo: 120,

  setPlaying: (isPlaying) => set({ isPlaying }),
  setPosition: (currentMeasure, currentBeat) => set({ currentMeasure, currentBeat }),
  setTempo: (tempo) => set({ tempo }),
  reset: () => set({ isPlaying: false, currentBeat: 0, currentMeasure: 1 }),
}))
