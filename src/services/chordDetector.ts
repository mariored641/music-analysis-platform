/**
 * chordDetector.ts
 * Detects chord names from a set of notes.
 *
 * Spelling-aware: the chord root is named the way the notes are written, so
 * B#–D##–F## is suggested as "B#" (not "C"). Rootless/ambiguous cases fall back
 * to the jazz convention (flat names: Eb, Bb, Ab, Db, Gb; F# is the only sharp).
 * When the notated root is exotic (B#, E#, Cb, Fb or a double accidental) the
 * plain enharmonic name is offered right after it — see `simplifyChordSymbol`
 * for converting existing symbols.
 */

import type { NoteMap } from '../types/score'

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11]
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }
const ROOT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

/** A written pitch name without octave: letter index (C=0…B=6) + alteration (−2…+2). */
export interface SpelledNote { letter: number; alter: number }

interface Template {
  quality: string
  /** [semitones above root, letter steps above root's letter] */
  degrees: Array<[number, number]>
}

// Ordered: 7th chords first (preferred for exact matches with 4 notes)
const TEMPLATES: Template[] = [
  { quality: 'maj7',  degrees: [[0, 0], [4, 2], [7, 4], [11, 6]] },
  { quality: '7',     degrees: [[0, 0], [4, 2], [7, 4], [10, 6]] },
  { quality: 'm7',    degrees: [[0, 0], [3, 2], [7, 4], [10, 6]] },
  { quality: 'm7b5',  degrees: [[0, 0], [3, 2], [6, 4], [10, 6]] },
  { quality: 'dim7',  degrees: [[0, 0], [3, 2], [6, 4], [9, 6]] },
  { quality: 'mMaj7', degrees: [[0, 0], [3, 2], [7, 4], [11, 6]] },
  { quality: 'aug7',  degrees: [[0, 0], [4, 2], [8, 4], [10, 6]] },
  { quality: '7sus4', degrees: [[0, 0], [5, 3], [7, 4], [10, 6]] },
  { quality: '7sus2', degrees: [[0, 0], [2, 1], [7, 4], [10, 6]] },
  { quality: '6',     degrees: [[0, 0], [4, 2], [7, 4], [9, 5]] },
  { quality: 'm6',    degrees: [[0, 0], [3, 2], [7, 4], [9, 5]] },
  { quality: 'add4',  degrees: [[0, 0], [4, 2], [5, 3], [7, 4]] },
  { quality: '',      degrees: [[0, 0], [4, 2], [7, 4]] },   // major triad
  { quality: 'm',     degrees: [[0, 0], [3, 2], [7, 4]] },
  { quality: 'dim',   degrees: [[0, 0], [3, 2], [6, 4]] },
  { quality: 'aug',   degrees: [[0, 0], [4, 2], [8, 4]] },
  { quality: 'sus4',  degrees: [[0, 0], [5, 3], [7, 4]] },
  { quality: 'sus2',  degrees: [[0, 0], [2, 1], [7, 4]] },
]

const pcOf = (n: SpelledNote) => (((NATURAL_PC[n.letter] + n.alter) % 12) + 12) % 12
const keyOf = (n: SpelledNote) => n.letter * 20 + n.alter + 10

function accidental(alter: number): string | null {
  switch (alter) {
    case 0: return ''
    case 1: return '#'
    case 2: return '##'
    case -1: return 'b'
    case -2: return 'bb'
    default: return null
  }
}

/** Name of a spelled pitch ("B#", "Ebb"); falls back to the flat-convention name beyond ±2. */
function spelledName(n: SpelledNote): string {
  const acc = accidental(n.alter)
  return acc === null ? ROOT_NAMES[pcOf(n)] : `${LETTERS[n.letter]}${acc}`
}

/** B#, E#, Cb, Fb and anything with a double accidental. */
function isExotic(n: SpelledNote): boolean {
  if (Math.abs(n.alter) >= 2) return true
  return (n.alter === 1 && (n.letter === 2 || n.letter === 6)) || (n.alter === -1 && (n.letter === 0 || n.letter === 3))
}

/** Expected written pitch for a chord degree above a spelled root. */
function expectedNote(root: SpelledNote, interval: number, steps: number): SpelledNote {
  const letter = (root.letter + steps) % 7
  const target = (pcOf(root) + interval) % 12
  const alter = ((((target - NATURAL_PC[letter]) % 12) + 18) % 12) - 6
  return { letter, alter }
}

/** Spelled notes of a noteMap selection. */
function spelledFromIds(noteIds: string[], noteMap: NoteMap): SpelledNote[] {
  const out: SpelledNote[] = []
  for (const id of noteIds) {
    const note = noteMap.notes.get(id)
    if (!note) continue
    const letter = LETTER_INDEX[note.step]
    if (letter === undefined) continue
    out.push({ letter, alter: Math.round(note.alter ?? 0) })
  }
  return out
}

/** Convert raw `{step, alter}` pairs (e.g. from the MusicXML parser) to spelled notes. */
export function spelledFromStepAlter(notes: Array<{ step: string; alter?: number }>): SpelledNote[] {
  const out: SpelledNote[] = []
  for (const n of notes) {
    const letter = LETTER_INDEX[n.step]
    if (letter !== undefined) out.push({ letter, alter: Math.round(n.alter ?? 0) })
  }
  return out
}

/** Score all matching chords for a set of written notes, sorted best-first. */
function scoreAllMatches(notes: SpelledNote[]): { name: string; score: number }[] {
  const pcs = new Set(notes.map(pcOf))
  if (pcs.size < 2) return []

  // How each pitch class is written, most frequent spelling first
  const spellingsByPc = new Map<number, Map<number, { note: SpelledNote; count: number }>>()
  for (const n of notes) {
    const pc = pcOf(n)
    const byKey = spellingsByPc.get(pc) ?? new Map()
    const e = byKey.get(keyOf(n))
    if (e) e.count++; else byKey.set(keyOf(n), { note: n, count: 1 })
    spellingsByPc.set(pc, byKey)
  }
  const writtenRoot = (pc: number): SpelledNote | null => {
    const byKey = spellingsByPc.get(pc)
    if (!byKey) return null
    return [...byKey.values()].sort((a, b) => b.count - a.count)[0].note
  }
  const writtenKeys = new Set(notes.map(keyOf))

  const results: { name: string; score: number }[] = []
  const seen = new Set<string>()
  const push = (name: string, score: number) => {
    if (seen.has(name)) return
    seen.add(name)
    results.push({ name, score })
  }

  for (const tpl of TEMPLATES) {
    for (let root = 0; root < 12; root++) {
      const tplPcs = new Set(tpl.degrees.map(([iv]) => (root + iv) % 12))
      let matched = 0
      for (const pc of pcs) if (tplPcs.has(pc)) matched++
      if (matched < pcs.size) continue

      const isExact = tpl.degrees.length === pcs.size
      const base = isExact
        ? 1000 + tpl.degrees.length * 10
        : pcs.size * 10 - (tpl.degrees.length - pcs.size)

      // Name the root as written; if the root isn't in the selection, use the default name
      const rootNote = writtenRoot(root)
      if (!rootNote) {
        push(`${ROOT_NAMES[root]}${tpl.quality}`, base)
        continue
      }

      // Spelling fidelity: how many written notes sit exactly where this chord expects them
      let fidelity = 0
      for (const [iv, steps] of tpl.degrees) {
        if (writtenKeys.has(keyOf(expectedNote(rootNote, iv, steps)))) fidelity++
      }

      const score = base + fidelity
      push(`${spelledName(rootNote)}${tpl.quality}`, score)
      // Unusual written root → also offer the plain enharmonic name, right behind it
      if (isExotic(rootNote)) push(`${ROOT_NAMES[root]}${tpl.quality}`, score - 0.5)
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

/**
 * Detect the chord from written notes; the root is spelled as notated.
 * Returns e.g. "Cm7", "B#", "Bbmaj7", or null if no match.
 */
export function detectChordFromSpelled(notes: SpelledNote[]): string | null {
  const matches = scoreAllMatches(notes)
  return matches.length > 0 ? matches[0].name : null
}

/** Detect the chord name from an array of noteMap IDs. Returns the best match, or null. */
export function detectChord(noteIds: string[], noteMap: NoteMap): string | null {
  if (noteIds.length < 2) return null
  return detectChordFromSpelled(spelledFromIds(noteIds, noteMap))
}

/**
 * Detect ALL matching chord names from an array of noteMap IDs.
 * Best first — the notated spelling leads; plain enharmonic alternatives follow.
 */
export function detectAllChords(noteIds: string[], noteMap: NoteMap): string[] {
  if (noteIds.length < 2) return []
  return scoreAllMatches(spelledFromIds(noteIds, noteMap)).map(m => m.name)
}

// ── Converting existing chord symbols ──────────────────────────────────────────

/** Read a note name ("B#", "D♭", "F##", "E𝄫") at the start of `s`. */
function readNoteName(s: string): { note: SpelledNote; length: number } | null {
  const m = /^([A-Ga-g])(##|♯♯|𝄪|bb(?![59])|♭♭|𝄫|#|♯|b|♭)?/u.exec(s)
  if (!m) return null
  const acc = m[2] ?? ''
  const alter = acc === '' ? 0
    : /^(##|♯♯|𝄪)$/u.test(acc) ? 2
    : /^(#|♯)$/u.test(acc) ? 1
    : /^(bb|♭♭|𝄫)$/u.test(acc) ? -2
    : -1
  return { note: { letter: LETTER_INDEX[m[1].toUpperCase()], alter }, length: m[0].length }
}

function simplifyNote(n: SpelledNote): string {
  return isExotic(n) ? ROOT_NAMES[pcOf(n)] : spelledName(n)
}

/** Rewrite the root (and slash bass) of a chord symbol; `fix` returns the new name, or null to keep it. */
function mapChordNotes(symbol: string, fix: (n: SpelledNote) => string | null): string {
  const root = readNoteName(symbol)
  if (!root) return symbol
  let rest = symbol.slice(root.length)
  const slash = rest.lastIndexOf('/')
  if (slash >= 0) {
    const bass = readNoteName(rest.slice(slash + 1))
    if (bass && bass.length === rest.length - slash - 1) {
      rest = `${rest.slice(0, slash)}/${fix(bass.note) ?? rest.slice(slash + 1)}`
    }
  }
  return `${fix(root.note) ?? symbol.slice(0, root.length)}${rest}`
}

/**
 * Plain enharmonic spelling of a chord symbol: B#→C, E#→F, Cb→B, Fb→E, D##→E, Ebb→D…
 * Normal names (Bb, F#, Gb…) are left as they are; the quality is untouched,
 * and a slash bass ("B#/D##") is simplified too.
 */
export function simplifyChordSymbol(symbol: string): string {
  return mapChordNotes(symbol, n => (isExotic(n) ? ROOT_NAMES[pcOf(n)] : null))
}

/**
 * The reverse: respell the root / bass as the notes are written. "C" over B#–D##–F##
 * becomes "B#". Only same-pitch respellings — the harmony never changes — and only when
 * the symbol's own spelling is not among the written notes but another spelling of that
 * pitch is. Anything not found in `written` is left alone.
 */
export function respellChordSymbol(symbol: string, written: SpelledNote[]): string {
  return mapChordNotes(symbol, n => {
    const same = written.filter(w => pcOf(w) === pcOf(n))
    if (same.length === 0 || same.some(w => keyOf(w) === keyOf(n))) return null
    const counts = new Map<number, { note: SpelledNote; count: number }>()
    for (const w of same) {
      const e = counts.get(keyOf(w))
      if (e) e.count++; else counts.set(keyOf(w), { note: w, count: 1 })
    }
    return spelledName([...counts.values()].sort((x, y) => y.count - x.count)[0].note)
  })
}
