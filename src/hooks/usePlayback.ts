import { useEffect } from 'react'
import { usePlaybackStore } from '../store/playbackStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useSelectionStore } from '../store/selectionStore'
import type { NoteData, NoteMap } from '../types/score'

/**
 * Tone.js playback driven by the playback store.
 * Starts from the selection (note or bar), loops the selection when loop is on,
 * and publishes the sounding notes for the cursor.
 */
type ToneNS = typeof import('tone')

let Tone: ToneNS | null = null
let synth: any = null
let part: any = null
let endId: number | null = null

async function tone(): Promise<ToneNS> {
  if (!Tone) Tone = await import('tone')
  return Tone
}

const absQ = (nm: NoteMap, n: NoteData) => (nm.measures.get(n.measureNum)?.startQ ?? 0) + n.beat - 1

function buildEvents(nm: NoteMap, fromQ: number, toQ: number) {
  const notes = [...nm.notes.values()].filter(n => !n.grace && n.tied !== 'stop' && n.tied !== 'continue')
  // extend tied notes through their continuation
  const byPitchStaff = new Map<string, NoteData[]>()
  for (const n of nm.notes.values()) {
    const k = `${n.pitch}|${n.globalStaff}`
    const arr = byPitchStaff.get(k)
    if (arr) arr.push(n); else byPitchStaff.set(k, [n])
  }
  for (const arr of byPitchStaff.values()) arr.sort((a, b) => absQ(nm, a) - absQ(nm, b))

  const groups = new Map<number, { q: number; notes: Array<{ pitch: string; dur: number; id: string; measure: number }> }>()
  for (const n of notes) {
    const q = absQ(nm, n)
    if (q < fromQ - 1e-6 || q >= toQ - 1e-6) continue
    let dur = n.duration
    if (n.tied === 'start') {
      const chain = byPitchStaff.get(`${n.pitch}|${n.globalStaff}`)!
      let i = chain.indexOf(n) + 1
      while (chain[i] && (chain[i].tied === 'stop' || chain[i].tied === 'continue')) { dur += chain[i].duration; if (chain[i].tied === 'stop') break; i++ }
    }
    const key = Math.round(q * 1000)
    const g = groups.get(key) ?? { q, notes: [] }
    g.notes.push({ pitch: n.pitch.replace('##', 'x'), dur: Math.max(0.05, dur), id: n.id, measure: n.measureNum })
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => a.q - b.q)
}

function range(nm: NoteMap): { from: number; to: number; loopTo: number } {
  const total = Math.max(...[...nm.measures.values()].map(m => m.startQ + m.lengthQ), 0)
  const sel = useSelectionStore.getState().selection
  if (!sel) return { from: 0, to: total, loopTo: total }
  const mStart = nm.measures.get(sel.measureStart)
  const mEnd = nm.measures.get(sel.measureEnd)
  let from = mStart?.startQ ?? 0
  if (sel.kind === 'notes' && !sel.wholeMeasures && sel.noteIds.length) {
    from = Math.min(...sel.noteIds.map(id => nm.notes.get(id)).filter(Boolean).map(n => absQ(nm, n!)))
  }
  const loopTo = mEnd ? mEnd.startQ + mEnd.lengthQ : total
  return { from, to: total, loopTo }
}

async function stopAll() {
  const T = await tone()
  const tr = T.getTransport()
  tr.stop()
  tr.cancel()
  tr.loop = false
  if (endId !== null) { tr.clear(endId); endId = null }
  if (part) { part.dispose(); part = null }
}

async function start() {
  const nm = useWorkspaceStore.getState().noteMap
  const store = usePlaybackStore.getState()
  if (!nm) { store.stop(); return }
  const T = await tone()
  await T.start()
  await stopAll()
  if (!synth) {
    synth = new T.PolySynth(T.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.35, release: 0.6 },
      volume: -14,
    } as any).toDestination()
  }
  const { from, to, loopTo } = range(nm)
  const loop = store.loop
  const end = loop ? loopTo : to
  const events = buildEvents(nm, from, end)
  if (events.length === 0) { store.stop(); return }

  const tr = T.getTransport()
  const ppq = tr.PPQ
  const ticks = (q: number) => `${Math.max(0, Math.round(q * ppq))}i`
  tr.bpm.value = store.tempo
  tr.position = 0

  part = new T.Part((time: number, ev: (typeof events)[number]) => {
    for (const n of ev.notes) {
      try { synth.triggerAttackRelease(n.pitch, T.Time(ticks(n.dur)).toSeconds(), time, 0.7) } catch { /* unplayable pitch */ }
    }
    T.getDraw().schedule(() => usePlaybackStore.getState().setCursor(ev.notes[0].measure, ev.notes.map(n => n.id)), time)
  }, events.map(ev => [ticks(ev.q - from), ev] as [string, typeof ev]))
  part.start(0)

  if (loop) {
    tr.loop = true
    tr.loopStart = 0
    tr.loopEnd = ticks(end - from)
  } else {
    endId = tr.schedule(time => {
      T.getDraw().schedule(() => usePlaybackStore.getState().stop(), time)
    }, ticks(end - from + 0.5))
  }
  tr.start('+0.05')
}

export function usePlayback() {
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe(async (s, p) => {
      if (s.playSeq !== p.playSeq && s.isPlaying) { start(); return }
      if (!s.isPlaying && s.isPaused && p.isPlaying) { (await tone()).getTransport().pause(); return }
      if (s.isPlaying && !s.isPaused && p.isPaused) { (await tone()).getTransport().start(); return }
      if (!s.isPlaying && !s.isPaused && (p.isPlaying || p.isPaused)) { stopAll(); return }
      if (s.tempo !== p.tempo && Tone) Tone.getTransport().bpm.value = s.tempo
    })
    return () => { unsub(); stopAll().catch(() => {}) }
  }, [])
}
