/**
 * chordDetector.ts
 * Detects chord name from a set of noteMap IDs using pitch-class matching.
 * Jazz convention: flat names preferred (Eb, Bb, Ab, Db, Gb).
 */

import type { NoteMap } from '../types/score'

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ROOT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

interface Template {
  size: number
  intervals: Set<number>
  quality: string
}

// Ordered: 7th chords first (preferred for exact matches with 4 notes)
const TEMPLATES: Template[] = [
  { size: 4, intervals: new Set([0, 4, 7, 11]), quality: 'maj7' },
  { size: 4, intervals: new Set([0, 4, 7, 10]), quality: '7' },
  { size: 4, intervals: new Set([0, 3, 7, 10]), quality: 'm7' },
  { size: 4, intervals: new Set([0, 3, 6, 10]), quality: 'm7b5' },
  { size: 4, intervals: new Set([0, 3, 6, 9]),  quality: 'dim7' },
  { size: 4, intervals: new Set([0, 3, 7, 11]), quality: 'mMaj7' },
  { size: 4, intervals: new Set([0, 4, 8, 10]), quality: 'aug7' },
  { size: 4, intervals: new Set([0, 5, 7, 10]), quality: '7sus4' },
  { size: 4, intervals: new Set([0, 2, 7, 10]), quality: '7sus2' },
  { size: 4, intervals: new Set([0, 4, 7, 9]),  quality: '6' },
  { size: 4, intervals: new Set([0, 3, 7, 9]),  quality: 'm6' },
  { size: 4, intervals: new Set([0, 4, 5, 7]),  quality: 'add4' },
  { size: 3, intervals: new Set([0, 4, 7]),     quality: '' },      // major triad
  { size: 3, intervals: new Set([0, 3, 7]),     quality: 'm' },
  { size: 3, intervals: new Set([0, 3, 6]),     quality: 'dim' },
  { size: 3, intervals: new Set([0, 4, 8]),     quality: 'aug' },
  { size: 3, intervals: new Set([0, 5, 7]),     quality: 'sus4' },
  { size: 3, intervals: new Set([0, 2, 7]),     quality: 'sus2' },
]

/** Extract pitch classes from noteMap IDs */
function extractPcs(noteIds: string[], noteMap: NoteMap): Set<number> {
  const pcs = new Set<number>()
  for (const id of noteIds) {
    const note = noteMap.notes.get(id)
    if (!note) continue
    const pc = ((NOTE_PC[note.step] ?? 0) + Math.round(note.alter ?? 0) + 12) % 12
    pcs.add(pc)
  }
  return pcs
}

/** Score all matching chords for a set of pitch classes, sorted best-first. */
function scoreAllMatches(pcs: Set<number>): { name: string; score: number }[] {
  if (pcs.size < 2) return []

  const results: { name: string; score: number }[] = []
  const seen = new Set<string>()

  for (const tpl of TEMPLATES) {
    for (let root = 0; root < 12; root++) {
      const tplPcs = new Set([...tpl.intervals].map(iv => (root + iv) % 12))

      let matched = 0
      for (const pc of pcs) {
        if (tplPcs.has(pc)) matched++
      }
      if (matched < pcs.size) continue

      const isExact = tpl.size === pcs.size
      const score = isExact
        ? 1000 + tpl.size * 10
        : pcs.size * 10 - (tpl.size - pcs.size)

      const name = `${ROOT_NAMES[root]}${tpl.quality}`
      if (!seen.has(name)) {
        seen.add(name)
        results.push({ name, score })
      }
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

/**
 * Detect chord name from a set of pitch classes (0–11).
 * Returns e.g. "Cm7", "F7", "Bbmaj7", or null if no match.
 */
export function detectChordFromPcs(pcs: Set<number>): string | null {
  const matches = scoreAllMatches(pcs)
  return matches.length > 0 ? matches[0].name : null
}

/**
 * Detect chord name from an array of noteMap IDs.
 * Returns the best match, or null.
 */
export function detectChord(noteIds: string[], noteMap: NoteMap): string | null {
  if (noteIds.length < 2) return null
  return detectChordFromPcs(extractPcs(noteIds, noteMap))
}

/**
 * Detect ALL matching chord names from an array of noteMap IDs.
 * Returns sorted by score (best first). Useful for showing alternatives.
 */
export function detectAllChords(noteIds: string[], noteMap: NoteMap): string[] {
  if (noteIds.length < 2) return []
  return scoreAllMatches(extractPcs(noteIds, noteMap)).map(m => m.name)
}
