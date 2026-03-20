import { useEffect, useRef } from 'react'
import { usePlaybackStore } from '../store/playbackStore'
import { useScoreStore } from '../store/scoreStore'

// Minimal Tone.js playback — synthesizes notes from the parsed NoteMap
export function usePlayback() {
  const { isPlaying, setPlaying, setPosition, tempo, currentMeasure } = usePlaybackStore()
  const noteMap = useScoreStore(s => s.noteMap)
  const synthRef = useRef<any>(null)
  const partRef = useRef<any>(null)
  const toneRef = useRef<any>(null)

  // Initialize Tone.js lazily
  const getTone = async () => {
    if (toneRef.current) return toneRef.current
    const Tone = await import('tone')
    toneRef.current = Tone
    return Tone
  }

  const stop = async () => {
    const Tone = await getTone()
    if (partRef.current) { partRef.current.stop(); partRef.current.dispose(); partRef.current = null }
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    setPlaying(false)
    setPosition(1, 0)
  }

  useEffect(() => {
    if (!isPlaying) {
      stop()
      return
    }
    if (!noteMap) { setPlaying(false); return }

    let cancelled = false

    const start = async () => {
      const Tone = await getTone()
      if (cancelled) return

      await Tone.start()

      // Dispose previous
      if (synthRef.current) { synthRef.current.dispose(); synthRef.current = null }
      if (partRef.current) { partRef.current.dispose(); partRef.current = null }

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.3 },
        volume: -12,
      }).toDestination()
      synthRef.current = synth

      // Build note events from NoteMap
      const events: Array<{ time: string; note: string; dur: string; measure: number; beat: number }> = []
      const beatsPerMeasure = 4 // default; TODO: read from time sig

      for (const [, measure] of noteMap.measures) {
        if (measure.num < currentMeasure) continue
        for (const note of measure.notes) {
          const beatOffset = (measure.num - 1) * beatsPerMeasure + (note.beat - 1)
          const timeInBars = beatOffset / beatsPerMeasure
          events.push({
            time: `${Math.floor(timeInBars)}:${Math.floor(beatOffset % beatsPerMeasure)}:0`,
            note: note.pitch,
            dur: durationToTone(note.type),
            measure: note.measureNum,
            beat: note.beat,
          })
        }
      }

      if (events.length === 0) { setPlaying(false); return }

      Tone.getTransport().bpm.value = tempo || 120

      const part = new Tone.Part((time: number, event: any) => {
        try {
          synth.triggerAttackRelease(event.note, event.dur, time)
        } catch { /* skip unparseable notes */ }
        // Update position display
        Tone.getDraw().schedule(() => {
          setPosition(event.measure, event.beat)
        }, time)
      }, events)

      part.start(0)
      partRef.current = part

      Tone.getTransport().start()

      // Auto-stop when transport finishes
      const lastEvent = events[events.length - 1]
      const lastBarNum = parseFloat(lastEvent.time) // bar index
      const totalBars = lastBarNum + 1
      const stopAfterMs = totalBars * beatsPerMeasure * (60000 / (tempo || 120)) + 2000
      setTimeout(() => {
        if (!cancelled) stop()
      }, stopAfterMs)
    }

    start()

    return () => {
      cancelled = true
    }
  }, [isPlaying])

  useEffect(() => {
    return () => { stop() }
  }, [])
}

function durationToTone(type: string): string {
  const map: Record<string, string> = {
    whole: '1n', half: '2n', quarter: '4n', eighth: '8n',
    '16th': '16n', '32nd': '32n', '64th': '64n',
    'half.': '2n.', 'quarter.': '4n.', 'eighth.': '8n.',
  }
  return map[type] || '4n'
}
