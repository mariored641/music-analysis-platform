import { useEffect, useRef } from 'react'
import { usePlaybackStore } from '../store/playbackStore'
import { useScoreStore } from '../store/scoreStore'

export function usePlayback() {
  const {
    isPlaying, isPaused,
    setPosition, stopPlayback,
    tempo, startMeasure,
    loopEnabled, loopStart, loopEnd,
  } = usePlaybackStore()
  const noteMap = useScoreStore(s => s.noteMap)

  const synthRef  = useRef<any>(null)
  const partRef   = useRef<any>(null)
  const toneRef   = useRef<any>(null)

  // Refs for values that should be captured once at play-start (not re-start on change)
  const startMeasureRef = useRef(startMeasure)
  const tempoRef        = useRef(tempo)
  const loopEnabledRef  = useRef(loopEnabled)
  const loopStartRef    = useRef(loopStart)
  const loopEndRef      = useRef(loopEnd)
  const noteMapRef      = useRef(noteMap)

  useEffect(() => { startMeasureRef.current = startMeasure }, [startMeasure])
  useEffect(() => { tempoRef.current = tempo }, [tempo])
  useEffect(() => { loopEnabledRef.current = loopEnabled }, [loopEnabled])
  useEffect(() => { loopStartRef.current = loopStart }, [loopStart])
  useEffect(() => { loopEndRef.current = loopEnd }, [loopEnd])
  useEffect(() => { noteMapRef.current = noteMap }, [noteMap])

  const getTone = async () => {
    if (toneRef.current) return toneRef.current
    const Tone = await import('tone')
    toneRef.current = Tone
    return Tone
  }

  // Live BPM update without restarting
  useEffect(() => {
    if (!toneRef.current || !isPlaying) return
    toneRef.current.getTransport().bpm.value = tempo
  }, [tempo, isPlaying])

  // Full stop — dispose part + synth, reset transport
  const doStop = async () => {
    const Tone = await getTone()
    if (partRef.current) {
      try { partRef.current.stop(0); partRef.current.dispose() } catch { /* ignore */ }
      partRef.current = null
    }
    if (synthRef.current) {
      try { synthRef.current.dispose() } catch { /* ignore */ }
      synthRef.current = null
    }
    try {
      Tone.getTransport().stop()
      Tone.getTransport().loop = false
      Tone.getTransport().position = 0
    } catch { /* ignore */ }
  }

  // Pause — keep part alive, just suspend transport
  const doPause = async () => {
    const Tone = await getTone()
    try { Tone.getTransport().pause() } catch { /* ignore */ }
  }

  useEffect(() => {
    // STOPPED
    if (!isPlaying && !isPaused) {
      doStop()
      return
    }

    // PAUSED
    if (!isPlaying && isPaused) {
      doPause()
      return
    }

    // PLAYING
    // If part already alive (resume from pause) — just restart transport
    if (partRef.current) {
      getTone().then(Tone => {
        try { Tone.getTransport().start() } catch { /* ignore */ }
      })
      return
    }

    // Fresh start
    const nm = noteMapRef.current
    if (!nm) { stopPlayback(); return }

    let cancelled = false

    const freshStart = async () => {
      const Tone = await getTone()
      if (cancelled) return

      await Tone.start()

      // Clean up previous if any
      if (synthRef.current) { try { synthRef.current.dispose() } catch { /* */ } synthRef.current = null }
      if (partRef.current)  { try { partRef.current.stop(0); partRef.current.dispose() } catch { /* */ } partRef.current = null }

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.3 },
        volume: -12,
      }).toDestination()
      synthRef.current = synth

      const beatsPerMeasure = 4
      const fromMeasure = startMeasureRef.current
      const events: Array<{ time: string; note: string; dur: string; measure: number; beat: number }> = []

      for (const [, measure] of nm.measures) {
        if (measure.num < fromMeasure) continue
        for (const note of measure.notes) {
          // Time offset so fromMeasure starts at t=0
          const totalBeats = (measure.num - fromMeasure) * beatsPerMeasure + (note.beat - 1)
          const bars        = Math.floor(totalBeats / beatsPerMeasure)
          const beatsInBar  = Math.floor(totalBeats % beatsPerMeasure)
          const sixteenths  = Math.round((totalBeats % 1) * 4)
          events.push({
            time: `${bars}:${beatsInBar}:${sixteenths}`,
            note: note.pitch,
            dur: durationToTone(note.type),
            measure: note.measureNum,
            beat: note.beat,
          })
        }
      }

      if (events.length === 0 || cancelled) { stopPlayback(); return }

      const transport = Tone.getTransport()
      transport.bpm.value = tempoRef.current || 120
      transport.stop()
      transport.position = 0
      transport.loop = false

      // Configure loop if enabled
      const doLoop = loopEnabledRef.current
      const ls = loopStartRef.current
      const le = loopEndRef.current
      if (doLoop && ls !== null && le !== null) {
        const lsBeats = (ls - fromMeasure) * beatsPerMeasure
        const leBeats = (le + 1 - fromMeasure) * beatsPerMeasure  // end of loopEnd measure
        if (lsBeats >= 0 && leBeats > lsBeats) {
          transport.loopStart = `${Math.floor(lsBeats / beatsPerMeasure)}:0:0`
          transport.loopEnd   = `${Math.floor(leBeats / beatsPerMeasure)}:0:0`
          transport.loop = true
        }
      }

      const part = new Tone.Part((time: number, event: any) => {
        try { synth.triggerAttackRelease(event.note, event.dur, time) } catch { /* skip */ }
        Tone.getDraw().schedule(() => {
          setPosition(event.measure, event.beat)
        }, time)
      }, events)

      part.start(0)
      partRef.current = part
      transport.start()

      // Auto-stop when piece ends (only if not looping)
      if (!doLoop) {
        const lastEvent = events[events.length - 1]
        const parts = lastEvent.time.split(':').map(Number)
        const lastBeats = (parts[0] || 0) * beatsPerMeasure + (parts[1] || 0) + (parts[2] || 0) / 4
        const stopAfterMs = lastBeats * (60000 / (tempoRef.current || 120)) + 2000
        setTimeout(() => {
          if (!cancelled) stopPlayback()
        }, stopAfterMs)
      }
    }

    freshStart()
    return () => { cancelled = true }

  }, [isPlaying, isPaused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => { doStop() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

function durationToTone(type: string): string {
  const map: Record<string, string> = {
    whole: '1n', half: '2n', quarter: '4n', eighth: '8n',
    '16th': '16n', '32nd': '32n', '64th': '64n',
    'half.': '2n.', 'quarter.': '4n.', 'eighth.': '8n.',
  }
  return map[type] || '4n'
}
