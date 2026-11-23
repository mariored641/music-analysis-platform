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

/** Convert raw `{step, alter}` pairs (e.g. from the MusicXML parser) to spelled notes. */
export function spelledFromStepAlter(notes: Array<{ step: string; alter?: number }>): SpelledNote[] {
  const out: SpelledNote[] = []
  for (const n of notes) {
    const letter = LETTER_INDEX[n.step]
    if (letter !== undefined) out.push({ letter, alter: Math.round(n.alter ?? 0) })
  }
  return out
}

/** Chord-tone name of a template degree: R (root), 2…7 — from its letter steps above the root. */
const DEGREE_NAME = ['R', '2', '3', '4', '5', '6', '7']

/** "(omit5)", "(omitR,5)" — the chord tones that are missing from the notes; '' when none. */
function omitSuffix(missing: Array<[number, number]>): string {
  if (missing.length === 0) return ''
  return `(omit${missing.map(([, steps]) => DEGREE_NAME[steps]).join(',')})`
}

interface Match { name: string; score: number; rootPc: number }

/**
 * Score all matching chords for a set of written notes, sorted best-first.
 * `excludePc`: skip chords containing this pitch class (used for "chord over a foreign bass").
 */
function scoreAllMatches(notes: SpelledNote[], excludePc?: number): Match[] {
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

  const results: Match[] = []
  const seen = new Set<string>()
  let root = 0
  const push = (name: string, score: number) => {
    if (seen.has(name)) return
    seen.add(name)
    results.push({ name, score, rootPc: root })
  }

  for (const tpl of TEMPLATES) {
    for (root = 0; root < 12; root++) {
      const tplPcs = new Set(tpl.degrees.map(([iv]) => (root + iv) % 12))
      if (excludePc !== undefined && tplPcs.has(excludePc)) continue
      let matched = 0
      for (const pc of pcs) if (tplPcs.has(pc)) matched++
      if (matched < pcs.size) continue

      const isExact = tpl.degrees.length === pcs.size
      // "Em7(omit7)" is just Em: skip partial matches that another chord on this root matches exactly
      if (!isExact && TEMPLATES.some(t => t.degrees.length === pcs.size && t.degrees.every(([iv]) => pcs.has((root + iv) % 12)))) continue
      const base = isExact
        ? 1000 + tpl.degrees.length * 10
        : pcs.size * 10 - (tpl.degrees.length - pcs.size)
      // Chord tones the template expects but the notes don't have → spelled out: "Em7(omit5)"
      const omit = isExact ? '' : omitSuffix(tpl.degrees.filter(([iv]) => !pcs.has((root + iv) % 12)))

      // Name the root as written; if the root isn't in the selection, use the default name
      const rootNote = writtenRoot(root)
      if (!rootNote) {
        push(`${ROOT_NAMES[root]}${tpl.quality}${omit}`, base)
        continue
      }

      // Spelling fidelity: how many written notes sit exactly where this chord expects them
      let fidelity = 0
      for (const [iv, steps] of tpl.degrees) {
        if (writtenKeys.has(keyOf(expectedNote(rootNote, iv, steps)))) fidelity++
      }

      const score = base + fidelity
      push(`${spelledName(rootNote)}${tpl.quality}${omit}`, score)
      // Unusual written root → also offer the plain enharmonic name, right behind it
      if (isExotic(rootNote)) push(`${ROOT_NAMES[root]}${tpl.quality}${omit}`, score - 0.5)
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

/** A written note with its sounding height and staff — enough to know which note is the bass. */
interface Voiced { note: SpelledNote; height: number; staff: number }

function voicedFromIds(noteIds: string[], noteMap: NoteMap): Voiced[] {
  const out: Voiced[] = []
  for (const id of noteIds) {
    const n = noteMap.notes.get(id)
    const letter = n ? LETTER_INDEX[n.step] : undefined
    if (!n || letter === undefined) continue
    const alter = Math.round(n.alter ?? 0)
    out.push({ note: { letter, alter }, height: n.octave * 12 + NATURAL_PC[letter] + alter, staff: n.globalStaff })
  }
  return out
}

/**
 * Chord names for voiced notes, best first, with the bass taken into account:
 * - notes on more than one staff → the lowest note is the bass: an inversion is named
 *   with it ("C/E"), and the upper notes are also tried as a chord over it ("Em/C");
 * - one staff and no chord fits all the notes → the upper notes over the lowest one.
 */
function matchesWithBass(voiced: Voiced[]): string[] {
  if (voiced.length < 2) return []
  const notes = voiced.map(v => v.note)
  const bass = voiced.reduce((a, b) => (b.height < a.height ? b : a))
  const bassPc = pcOf(bass.note)
  const bassName = spelledName(bass.note)
  const multiStaff = new Set(voiced.map(v => v.staff)).size > 1
  const full = scoreAllMatches(notes)
  const out = full.map(m => ({ name: multiStaff && m.rootPc !== bassPc ? `${m.name}/${bassName}` : m.name, score: m.score }))
  if (multiStaff || full.length === 0) {
    const upper = notes.filter(n => pcOf(n) !== bassPc)
    // chords that don't contain the bass — those that do are inversions, already named above.
    // A bare interval over a bass is too ambiguous to name: needs ≥3 different upper notes.
    if (new Set(upper.map(pcOf)).size >= 3) for (const m of scoreAllMatches(upper, bassPc)) out.push({ name: `${m.name}/${bassName}`, score: m.score - 5 })
  }
  out.sort((a, b) => b.score - a.score)
  return [...new Set(out.map(m => m.name))]
}

/** Detect the chord name from an array of noteMap IDs. Returns the best match, or null. */
export function detectChord(noteIds: string[], noteMap: NoteMap): string | null {
  return matchesWithBass(voicedFromIds(noteIds, noteMap))[0] ?? null
}

/**
 * Detect ALL matching chord names from an array of noteMap IDs.
 * Best first — the notated spelling leads; plain enharmonic alternatives and slash chords follow.
 */
export function detectAllChords(noteIds: string[], noteMap: NoteMap): string[] {
  return matchesWithBass(voicedFromIds(noteIds, noteMap))
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

/** Chord tones a symbol marks as missing: "Em7(omit5)" → ["5"], "C7(omitR,5)" → ["R", "5"]. */
export function omittedTones(symbol: string): string[] {
  const m = /\(omit([^)]*)\)/.exec(symbol)
  return m ? m[1].split(',').map(t => t.trim()).filter(Boolean) : []
}

// ── Bringing existing chord symbols up to date (omit + bass) ──────────────────

const QUALITY_ALIASES: Record<string, string> = {
  M7: 'maj7', Maj7: 'maj7', ma7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', '^7': 'maj7',
  min: 'm', '-': 'm', min7: 'm7', '-7': 'm7', 'ø': 'm7b5', 'ø7': 'm7b5', 'm7♭5': 'm7b5', '-7b5': 'm7b5',
  '°': 'dim', o: 'dim', '°7': 'dim7', o7: 'dim7', '+': 'aug', '+7': 'aug7', '7#5': 'aug7', maj: '', M: '',
  mmaj7: 'mMaj7', mM7: 'mMaj7', 'm(maj7)': 'mMaj7', sus: 'sus4', '7sus': '7sus4',
}

/** A written note with its sounding height and staff. */
export interface SoundingNote { note: SpelledNote; height: number; staff: number }

/**
 * Re-annotate a chord symbol against the notes it covers — the harmony itself never changes:
 * - chord tones that no note in the chord's span plays → "(omitX)" (an old omit is replaced),
 *   unless fewer than two chord tones are played at all (an implied chord — left as it is);
 * - notes on more than one staff and the lowest note at the chord's start isn't the root →
 *   "/bass" (kept as written when the symbol already has a slash).
 * `span`: every note sounding while the chord lasts; `atStart`: the notes sounding when it begins.
 * Returns the updated symbol, or null when the quality isn't one the detector knows (e.g. "13").
 */
export function annotateChordSymbol(symbol: string, span: SoundingNote[], atStart: SoundingNote[]): string | null {
  const root = readNoteName(symbol)
  if (!root || span.length === 0) return null
  let rest = symbol.slice(root.length)
  let slash = ''
  const si = rest.lastIndexOf('/')
  if (si >= 0) {
    const bass = readNoteName(rest.slice(si + 1))
    if (bass && bass.length === rest.length - si - 1) { slash = rest.slice(si); rest = rest.slice(0, si) }
  }
  const quality = rest.replace(/\s*\(omit[^)]*\)\s*/g, '')
  const tpl = TEMPLATES.find(t => t.quality === (QUALITY_ALIASES[quality] ?? quality))
  if (!tpl) return null

  const rootPc = pcOf(root.note)
  const played = new Set(span.map(s => pcOf(s.note)))
  const missing = tpl.degrees.filter(([iv]) => !played.has((rootPc + iv) % 12))
  // fewer than two chord tones played = an implied chord, not one the notes spell: keep its omit as it was
  const omit = tpl.degrees.length - missing.length < 2 ? (/\(omit[^)]*\)/.exec(rest)?.[0] ?? '') : omitSuffix(missing)

  if (!slash && atStart.length > 0 && new Set(atStart.map(s => s.staff)).size > 1) {
    const bass = atStart.reduce((a, b) => (b.height < a.height ? b : a))
    if (pcOf(bass.note) !== rootPc) slash = `/${spelledName(bass.note)}`
  }
  return `${symbol.slice(0, root.length)}${quality}${omit}${slash}`
}

/** Sounding notes from noteMap entries (step/alter/octave/globalStaff). */
export function soundingFrom(notes: Array<{ step: string; alter?: number; octave: number; globalStaff: number }>): SoundingNote[] {
  const out: SoundingNote[] = []
  for (const n of notes) {
    const letter = LETTER_INDEX[n.step]
    if (letter === undefined) continue
    const alter = Math.round(n.alter ?? 0)
    out.push({ note: { letter, alter }, height: n.octave * 12 + NATURAL_PC[letter] + alter, staff: n.globalStaff })
  }
  return out
}
