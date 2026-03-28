/**
 * romanNumeralScript.ts
 *
 * Two modes — chosen automatically:
 *
 * Mode A (Jazz / chord symbols present):
 *   Reads existing HarmonyAnnotations that have chordSymbol, computes
 *   scaleDegree (Roman numeral) + harmonic function for each.
 *   Returns mode: 'update' → ScriptPanel calls updateAnnotation() in-place.
 *
 * Mode B (Classical / no chord symbols):
 *   Parses ALL staves from raw MusicXML, chordifies by beat, detects chord
 *   at each unique beat position across all staves, creates new HarmonyAnnotation
 *   objects with chordSymbol + scaleDegree + scriptId.
 *   Returns mode: 'create' → ScriptPanel calls addAnnotation().
 */

import { detectChordFromPcs } from './chordDetector'
import { parseAllStavesNotes, parseHarmonies } from './xmlParser'
import type { HarmonyAnnotation } from '../types/annotation'
import type { NoteMap } from '../types/score'

export const SCRIPT_ID = 'romanNumerals'

// ── Music theory constants ─────────────────────────────────────────────────────

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

const DEGREE_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10] // natural minor

// Chromatic scale degree names from tonic (flat convention for chromatic tones)
const CHROMATIC_DEGREE = [
  'I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII',
]

// ── Key parsing ────────────────────────────────────────────────────────────────

function parseKeyString(keyStr: string): { pc: number; mode: 'major' | 'minor' } {
  // Format from fifthsToKey(): "Bb major", "a minor", "F# major", etc.
  const parts = keyStr.trim().split(' ')
  const rootStr = parts[0]
  const mode = parts[1]?.toLowerCase() === 'minor' ? 'minor' : 'major'

  const letter = rootStr[0].toUpperCase()
  let pc = NOTE_PC[letter] ?? 0

  for (let i = 1; i < rootStr.length; i++) {
    if (rootStr[i] === '♭' || rootStr[i] === 'b') pc = (pc - 1 + 12) % 12
    else if (rootStr[i] === '♯' || rootStr[i] === '#') pc = (pc + 1) % 12
  }

  return { pc, mode }
}

// ── Chord name parsing ─────────────────────────────────────────────────────────

function normalizeQuality(q: string): string {
  if (!q) return ''
  // Capital-M major-7 check before lowercasing
  if (/^M7$|^M$/.test(q) || /^(maj7|ma7|Maj7|Δ)/.test(q)) return 'maj7'
  const n = q.toLowerCase()
  if (/m7b5|ø7|half/.test(n)) return 'm7b5'
  if (/dim7|°7|o7/.test(n)) return 'dim7'
  if (/^(dim|°|o)/.test(n)) return 'dim'
  if (/^(aug|\+)/.test(n)) return n.includes('7') ? 'aug7' : 'aug'
  if (/m(maj7|maj|Δ|\(maj)/.test(n)) return 'mMaj7'
  if (/^(m7|min7|-7)/.test(n)) return 'm7'
  if (/^(m|min|-)/.test(n)) return 'm'
  if (/^(7|dom)/.test(n)) return '7'
  if (/^sus4/.test(n)) return 'sus4'
  if (/^sus2/.test(n)) return 'sus2'
  if (/^(9|11|13)/.test(n)) return '7' // extended dominant → treat as 7
  return '' // default: major triad
}

function parseChordForRN(chordName: string): { rootPc: number; quality: string } | null {
  if (!chordName) return null
  const letter = chordName[0].toUpperCase()
  if (!(letter in NOTE_PC)) return null

  let rootPc = NOTE_PC[letter]
  let i = 1

  // Double-flat before single-flat
  if (chordName[i] === '𝄫' || (chordName[i] === 'b' && chordName[i + 1] === 'b')) {
    rootPc = (rootPc - 2 + 12) % 12; i += 2
  } else if (chordName[i] === '♭' || chordName[i] === 'b') {
    rootPc = (rootPc - 1 + 12) % 12; i++
  } else if (chordName[i] === '♯' || chordName[i] === '#') {
    rootPc = (rootPc + 1) % 12; i++
  }

  return { rootPc, quality: normalizeQuality(chordName.slice(i)) }
}

// ── Roman numeral computation ──────────────────────────────────────────────────

function isMinorQuality(q: string): boolean {
  return ['m', 'm7', 'dim', 'dim7', 'm7b5', 'mMaj7'].includes(q)
}

function qualitySuffix(q: string): string {
  const map: Record<string, string> = {
    '': '', 'm': '', 'dim': '°', 'aug': '+', 'aug7': '+7',
    'maj7': 'M7', '7': '7', 'm7': '7', 'm7b5': 'ø7', 'dim7': '°7',
    'sus4': 'sus4', 'sus2': 'sus2', 'mMaj7': 'M7',
  }
  return map[q] ?? ''
}

function computeRN(
  rootPc: number,
  quality: string,
  keyPc: number,
  mode: 'major' | 'minor',
): string {
  const scaleIntervals = mode === 'major' ? MAJOR_SCALE : MINOR_SCALE
  const scalePcs = scaleIntervals.map(iv => (keyPc + iv) % 12)

  // 1) Secondary dominant: root is a P5 below a diatonic degree (V/X or V7/X)
  if (quality === '7' || quality === '') {
    for (let i = 0; i < 7; i++) {
      if ((rootPc + 7) % 12 === scalePcs[i]) {
        return (quality === '7' ? 'V7' : 'V') + '/' + DEGREE_ROMAN[i]
      }
    }
  }

  // 2) Secondary leading-tone chord (viiø7/X or vii°7/X)
  if (quality === 'm7b5' || quality === 'dim7') {
    for (let i = 0; i < 7; i++) {
      if ((rootPc + 11) % 12 === scalePcs[i]) {
        return 'vii' + qualitySuffix(quality) + '/' + DEGREE_ROMAN[i]
      }
    }
  }

  // 3) Diatonic degree
  const diatonicIndex = scalePcs.indexOf(rootPc)
  if (diatonicIndex >= 0) {
    const roman = DEGREE_ROMAN[diatonicIndex]
    const minQ = isMinorQuality(quality)
    return (minQ ? roman.toLowerCase() : roman) + qualitySuffix(quality)
  }

  // 4) Chromatic (non-diatonic, non-secondary)
  const interval = (rootPc - keyPc + 12) % 12
  const degree = CHROMATIC_DEGREE[interval]
  const minQ = isMinorQuality(quality)
  // Lowercase the uppercase part of degree label (e.g. "bIII" → "biii")
  const rnBase = minQ ? degree.replace(/[A-Z]+/, s => s.toLowerCase()) : degree
  return rnBase + qualitySuffix(quality)
}

function computeFunction(rn: string): 'T' | 'S' | 'D' | undefined {
  const base = rn.split('/')[0].replace(/[°øM+].*|[0-9].*/, '').toLowerCase()
  if (['i', 'iii', 'vi'].includes(base)) return 'T'
  if (['v', 'vii', 'bvii'].includes(base) || rn.startsWith('V/') || rn.startsWith('V7/')) return 'D'
  if (['ii', 'iv', 'bii'].includes(base)) return 'S'
  return undefined
}

// ── Mode A: update existing harmony annotations ────────────────────────────────

function fromHarmonyAnnotations(
  harmonyAnns: HarmonyAnnotation[],
  keyPc: number,
  mode: 'major' | 'minor',
): RomanNumeralResult {
  const withSymbols = harmonyAnns.filter(a => a.chordSymbol)
  if (withSymbols.length === 0) {
    return { mode: 'update', annotations: [], count: 0, error: 'NO_CHORD_SYMBOLS' }
  }

  const updated: HarmonyAnnotation[] = []

  for (const ann of withSymbols) {
    const parsed = parseChordForRN(ann.chordSymbol!)
    if (!parsed) continue

    const rn = computeRN(parsed.rootPc, parsed.quality, keyPc, mode)
    const fn = computeFunction(rn)
    updated.push({ ...ann, scaleDegree: rn, function: fn, scriptId: SCRIPT_ID })
  }

  return { mode: 'update', annotations: updated, count: updated.length }
}

// ── Mode A-XML: from <harmony> elements embedded in the MusicXML ─────────────
// Used for lead sheets and jazz charts where chord symbols are in the XML
// but the user hasn't manually created HarmonyAnnotations in the store yet.

function fromXmlHarmonies(
  xmlString: string,
  keyPc: number,
  mode: 'major' | 'minor',
): RomanNumeralResult {
  const items = parseHarmonies(xmlString)
  if (items.length === 0) return { mode: 'create', annotations: [], count: 0, error: 'NO_HARMONIES' }

  const result: HarmonyAnnotation[] = []

  for (const item of items) {
    const parsed = parseChordForRN(item.label)
    if (!parsed) continue

    const rn = computeRN(parsed.rootPc, parsed.quality, keyPc, mode)
    const fn = computeFunction(rn)

    result.push({
      id: `rn-xml-m${item.measureNum}bf${Math.round(item.beatFraction * 1000)}`,
      layer: 'harmony',
      measureStart: item.measureNum,
      chordSymbol: item.label,
      scaleDegree: rn,
      function: fn,
      createdAt: Date.now(),
      scriptId: SCRIPT_ID,
    })
  }

  return { mode: 'create', annotations: result, count: result.length }
}

// ── Mode B: auto-chordify from raw MusicXML ────────────────────────────────────

function fromChordify(
  xmlString: string,
  keyPc: number,
  mode: 'major' | 'minor',
): RomanNumeralResult {
  const allNotes = parseAllStavesNotes(xmlString)
  if (allNotes.length === 0) {
    return { mode: 'create', annotations: [], count: 0, error: 'NO_NOTES' }
  }

  const result: HarmonyAnnotation[] = []

  // Group by measure
  const byMeasure = new Map<number, typeof allNotes>()
  for (const n of allNotes) {
    if (!byMeasure.has(n.measureNum)) byMeasure.set(n.measureNum, [])
    byMeasure.get(n.measureNum)!.push(n)
  }

  byMeasure.forEach((notes, measureNum) => {
    // Unique beat positions within this measure, sorted
    const beatSet = new Set(notes.map(n => Math.round(n.beat * 1000) / 1000))
    const beats = [...beatSet].sort((a, b) => a - b)

    let lastChordName = ''

    for (const beat of beats) {
      // Collect pitch classes from ALL staves at this exact beat
      const pcs = new Set<number>()
      for (const n of notes) {
        if (Math.abs(n.beat - beat) > 0.005) continue
        const basePc = NOTE_PC[n.step] ?? 0
        pcs.add(((basePc + Math.round(n.alter)) + 12) % 12)
      }

      if (pcs.size < 2) continue

      const chordName = detectChordFromPcs(pcs)
      if (!chordName || chordName === lastChordName) continue
      lastChordName = chordName

      const parsed = parseChordForRN(chordName)
      if (!parsed) continue

      const rn = computeRN(parsed.rootPc, parsed.quality, keyPc, mode)
      const fn = computeFunction(rn)

      result.push({
        id: `rn-m${measureNum}b${Math.round(beat * 100)}`,
        layer: 'harmony',
        measureStart: measureNum,
        chordSymbol: chordName,
        scaleDegree: rn,
        function: fn,
        createdAt: Date.now(),
        scriptId: SCRIPT_ID,
      })
    }
  })

  return { mode: 'create', annotations: result, count: result.length }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface RomanNumeralResult {
  /** 'update' → patch existing annotations; 'create' → add new ones */
  mode: 'update' | 'create'
  annotations: HarmonyAnnotation[]
  count: number
  error?: string
}

export function runRomanNumeralScript(
  noteMap: NoteMap,
  harmonyAnns: HarmonyAnnotation[],
  xmlString: string,
): RomanNumeralResult {
  const { pc: keyPc, mode } = parseKeyString(noteMap.metadata.key)

  // Mode A: user has manually created harmony annotations with chord symbols → update in-place
  const hasStoreChordSymbols = harmonyAnns.some(a => a.chordSymbol)
  if (hasStoreChordSymbols) {
    return fromHarmonyAnnotations(harmonyAnns, keyPc, mode)
  }

  // Mode A-XML: the MusicXML file contains <harmony> chord symbols (jazz lead sheets)
  // → create new annotations from the embedded XML chord symbols
  const xmlHarmonies = parseHarmonies(xmlString)
  if (xmlHarmonies.length > 0) {
    return fromXmlHarmonies(xmlString, keyPc, mode)
  }

  // Mode B: no chord symbols anywhere → chordify all staves (classical piano)
  return fromChordify(xmlString, keyPc, mode)
}
