import { create } from 'zustand'

interface PlaybackState {
  isPlaying: boolean
  isPaused: boolean    // true = transport suspended, part still alive
  currentBeat: number
  currentMeasure: number
  tempo: number
  startMeasure: number  // measure to begin from when pressing play
  loopEnabled: boolean
  loopStart: number | null
  loopEnd: number | null

  // Core actions
  setPlaying: (playing: boolean) => void    // backward compat (stop-on-false)
  pausePlayback: () => void
  resumePlayback: () => void
  stopPlayback: () => void
  setPosition: (measure: number, beat: number) => void
  setTempo: (bpm: number) => void
  setStartMeasure: (m: number) => void
  setLoop: (start: number, end: number) => void
  clearLoop: () => void
  reset: () => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  isPaused: false,
  currentBeat: 0,
  currentMeasure: 1,
  tempo: 120,
  startMeasure: 1,
  loopEnabled: false,
  loopStart: null,
  loopEnd: null,

  // Start playing (clears isPaused)
  setPlaying: (isPlaying) => set(isPlaying
    ? { isPlaying: true, isPaused: false }
    : { isPlaying: false, isPaused: false }
  ),
  pausePlayback: () => set({ isPlaying: false, isPaused: true }),
  resumePlayback: () => set({ isPlaying: true, isPaused: false }),
  stopPlayback: () => set({ isPlaying: false, isPaused: false, currentMeasure: 1, currentBeat: 0 }),
  setPosition: (currentMeasure, currentBeat) => set({ currentMeasure, currentBeat }),
  setTempo: (tempo) => set({ tempo }),
  setStartMeasure: (startMeasure) => set({ startMeasure }),
  setLoop: (loopStart, loopEnd) => set({ loopEnabled: true, loopStart, loopEnd }),
  clearLoop: () => set({ loopEnabled: false, loopStart: null, loopEnd: null }),
  reset: () => set({ isPlaying: false, isPaused: false, currentBeat: 0, currentMeasure: 1 }),
}))
