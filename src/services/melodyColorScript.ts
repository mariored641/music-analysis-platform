/**
 * melodyColorScript.ts
 * Script 1 — Melody Role Coloring (writes melody annotations: CT / PT / NT)
 *
 * Classification:
 *   CHORD_TONE    — note's PC is in the active chord
 *   PASSING_TONE  — run of non-chord tones between two chord tones,
 *                   moving in one consistent direction, each step ≤2 semitones
 *   NEIGHBOR_TONE — single non-chord tone with the exact same chord tone (same MIDI)
 *                   immediately before and after it
 *   (everything else — no annotation, stays black)
 *
 * Chromatic notes are treated identically to diatonic non-chord tones.
 */

import { parseChordSymbol, noteNameToPc } from './chordParser'
import { parseHarmonies } from './xmlParser'
import type { NoteMap, NoteData } from '../types/score'
import type { HarmonyAnnotation, MelodyAnnotation, NoteFunction } from '../types/annotation'

export const SCRIPT_ID = 'melodyColor'

function noteToMidi(note: NoteData): number {
  return note.octave * 12 + (note.alter ?? 0) + noteNameToPc(note.step)
}

interface ChordEvent {
  measureNum: number
  beatFraction: number
  pitchClasses: Set<number>
}

function buildChordTimeline(
  xmlString: string | null,
  harmonyAnnotations: HarmonyAnnotation[],
  noteMap: NoteMap,
): ChordEvent[] {
  const events: ChordEvent[] = []

  if (xmlString) {
    const items = parseHarmonies(xmlString)
    for (const item of items) {
      const pcs = parseChordSymbol(item.label)
      if (!pcs) continue
      events.push({ measureNum: item.measureNum, beatFraction: item.beatFraction, pitchClasses: pcs })
    }
  }

  for (const ann of harmonyAnnotations) {
    if (!ann.chordSymbol) continue
    const pcs = parseChordSymbol(ann.chordSymbol)
    if (!pcs) continue
    // User chords start at their anchor note (the chord's "real" position)
    const anchor = ann.noteIds?.[0] ? noteMap.notes.get(ann.noteIds[0]) : undefined
    const lengthQ = noteMap.measures.get(ann.measureStart)?.lengthQ ?? 4
    const beatFraction = anchor ? (anchor.beat - 1) / lengthQ : 0
    events.push({ measureNum: anchor?.measureNum ?? ann.measureStart, beatFraction, pitchClasses: pcs })
  }

  events.sort((a, b) => a.measureNum - b.measureNum || a.beatFraction - b.beatFraction)
  return events
}

function getActivePcs(
  measureNum: number,
  beatFraction: number,
  timeline: ChordEvent[],
): Set<number> | null {
  let best: ChordEvent | null = null
  for (const ev of timeline) {
    if (ev.measureNum < measureNum) { best = ev; continue }
    if (ev.measureNum === measureNum && ev.beatFraction <= beatFraction) { best = ev; continue }
    break
  }
  return best ? best.pitchClasses : null
}

export function runMelodyColorScript(
  noteMap: NoteMap,
  harmonyAnnotations: HarmonyAnnotation[],
  xmlString: string | null = null,
): { annotations: MelodyAnnotation[]; error?: string; count?: number } {
  const timeline = buildChordTimeline(xmlString, harmonyAnnotations, noteMap)

  if (timeline.length === 0) {
    return { annotations: [], error: 'NO_HARMONY' }
  }

  // Staff-1 notes only, no rests, no tied continuations
  const sortedNotes = Array.from(noteMap.notes.values())
    .filter(n => n.part === 0 && n.staff === 1 && !n.grace && n.tied !== 'stop' && n.tied !== 'continue')
    .sort((a, b) => a.measureNum - b.measureNum || a.beat - b.beat)

  // Pre-compute active chord PCs and chord-tone flag for each note
  const activePcsArr: (Set<number> | null)[] = sortedNotes.map(note => {
    const lengthQ = noteMap.measures.get(note.measureNum)?.lengthQ ?? 4
    const beatFraction = (note.beat - 1) / lengthQ
    return getActivePcs(note.measureNum, beatFraction, timeline)
  })

  const isChordToneArr: boolean[] = sortedNotes.map((note, i) => {
    const pcs = activePcsArr[i]
    if (!pcs) return false
    const pc = ((noteToMidi(note) % 12) + 12) % 12
    return pcs.has(pc)
  })

  const colorTypes: (string | null)[] = new Array(sortedNotes.length).fill(null)

  // Pass 1 — chord tones
  for (let i = 0; i < sortedNotes.length; i++) {
    if (isChordToneArr[i]) colorTypes[i] = 'CHORD_TONE'
  }

  // Pass 2 — passing tones: runs of consecutive non-chord tones bounded by chord tones
  //   on both sides, moving in one direction, each consecutive step ≤2 semitones
  let i = 0
  while (i < sortedNotes.length) {
    if (isChordToneArr[i]) { i++; continue }

    const runStart = i
    while (i < sortedNotes.length && !isChordToneArr[i]) i++
    const runEnd = i - 1  // inclusive

    // Need chord tones on both sides
    if (runStart === 0 || !isChordToneArr[runStart - 1]) continue
    if (runEnd >= sortedNotes.length - 1 || !isChordToneArr[runEnd + 1]) continue

    const prevMidi = noteToMidi(sortedNotes[runStart - 1])
    const nextMidi = noteToMidi(sortedNotes[runEnd + 1])
    const runMidis = sortedNotes.slice(runStart, runEnd + 1).map(n => noteToMidi(n))
    const fullSeq = [prevMidi, ...runMidis, nextMidi]

    let ascending = true
    let descending = true
    let stepWise = true

    for (let j = 1; j < fullSeq.length; j++) {
      const diff = fullSeq[j] - fullSeq[j - 1]
      if (diff <= 0) ascending = false
      if (diff >= 0) descending = false
      if (Math.abs(diff) > 2) { stepWise = false; break }
    }

    if (stepWise && (ascending || descending)) {
      for (let k = runStart; k <= runEnd; k++) {
        colorTypes[k] = 'PASSING_TONE'
      }
    }
  }

  // Pass 3 — neighbor tones: unclassified note whose immediate prev and next are
  //   both chord tones with the exact same MIDI pitch
  for (let i = 1; i < sortedNotes.length - 1; i++) {
    if (colorTypes[i] !== null) continue
    if (!isChordToneArr[i - 1] || !isChordToneArr[i + 1]) continue
    if (noteToMidi(sortedNotes[i - 1]) === noteToMidi(sortedNotes[i + 1])) {
      colorTypes[i] = 'NEIGHBOR_TONE'
    }
  }

  // Build annotations (only classified notes)
  const FN: Record<string, NoteFunction> = { CHORD_TONE: 'CT', PASSING_TONE: 'PT', NEIGHBOR_TONE: 'NT' }
  const annotations: MelodyAnnotation[] = []
  for (let i = 0; i < sortedNotes.length; i++) {
    const ct = colorTypes[i]
    if (!ct) continue
    const note = sortedNotes[i]
    annotations.push({
      id: `script-${SCRIPT_ID}-${note.id}`,
      layer: 'melody',
      measureStart: note.measureNum,
      noteIds: [note.id],
      noteFunction: FN[ct],
      scriptId: SCRIPT_ID,
      createdAt: Date.now(),
    })
  }

  return { annotations, count: annotations.length }
}
