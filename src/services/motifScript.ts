/**
 * motifScript.ts
 * Script 2 — Motif Finder
 *
 * Reads all user-created MotifAnnotations (no scriptId) and for each unique label
 * searches the entire piece for matching interval patterns.
 *
 * Seed: annotations with variantType === 'original' (or no variantType set).
 * If multiple originals exist for the same label, uses the first one by measure.
 *
 * Transformations searched: EXACT, INVERSION, RETROGRADE (default).
 * Threshold: 80% of intervals must match.
 */

import type { NoteMap, NoteData } from '../types/score'
import type { Annotation, MotifAnnotation } from '../types/annotation'

export const SCRIPT_ID = 'motifFinder'

export type MotifTransformation = 'EXACT' | 'INVERSION' | 'RETROGRADE' | 'AUGMENTATION' | 'DIMINUTION'

export interface MotifSearchOptions {
  threshold: number
  transformations: MotifTransformation[]
}

const DEFAULT_OPTIONS: MotifSearchOptions = {
  threshold: 0.8,
  transformations: ['EXACT', 'INVERSION', 'RETROGRADE'],
}

// ─── helpers ────────────────────────────────────────────────────────────────

function noteToMidi(note: NoteData): number {
  const PC: Record<string, number> = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }
  return note.octave * 12 + (PC[note.step] ?? 0) + (note.alter ?? 0)
}

function extractIntervals(notes: NoteData[]): number[] {
  const out: number[] = []
  for (let i = 0; i < notes.length - 1; i++) {
    out.push(noteToMidi(notes[i + 1]) - noteToMidi(notes[i]))
  }
  return out
}

function transformIntervals(intervals: number[], t: MotifTransformation): number[] {
  switch (t) {
    case 'EXACT':        return intervals
    case 'INVERSION':    return intervals.map(i => -i)
    case 'RETROGRADE':   return [...intervals].reverse()
    case 'AUGMENTATION': return intervals
    case 'DIMINUTION':   return intervals
  }
}

function calcMatchScore(a: number[], b: number[]): number {
  if (a.length === 0) return 0
  let matches = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) if (a[i] === b[i]) matches++
  return matches / a.length
}

function durationRatio(motifDurs: number[], windowDurs: number[], ratio: number): boolean {
  if (motifDurs.length !== windowDurs.length) return false
  return motifDurs.every((d, i) => Math.abs(windowDurs[i] / d - ratio) < 0.15)
}

// ─── main export ────────────────────────────────────────────────────────────

export function runMotifScript(
  noteMap: NoteMap,
  allAnnotations: Record<string, Annotation>,
  options: Partial<MotifSearchOptions> = {},
): { annotations: MotifAnnotation[]; error?: string; found: Record<string, number> } {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Find user-created motif annotations (no scriptId), treat as seeds
  const userMotifs = Object.values(allAnnotations).filter(
    (a): a is MotifAnnotation =>
      a.layer === 'motif' &&
      !(a as MotifAnnotation).scriptId &&
      !!(a as MotifAnnotation).noteIds?.length
  ) as MotifAnnotation[]

  if (userMotifs.length === 0) {
    return { annotations: [], error: 'NO_MOTIF_ANNOTATIONS', found: {} }
  }

  // Group by label, pick one seed per label (prefer variantType === 'original', then first by measure)
  const seedByLabel = new Map<string, MotifAnnotation>()
  for (const m of userMotifs) {
    const existing = seedByLabel.get(m.label)
    if (!existing) { seedByLabel.set(m.label, m); continue }
    // Prefer 'original', then earlier measure
    const existingIsOriginal = !existing.variantType || existing.variantType === 'original'
    const newIsOriginal = !m.variantType || m.variantType === 'original'
    if (!existingIsOriginal && newIsOriginal) { seedByLabel.set(m.label, m); continue }
    if (existingIsOriginal && !newIsOriginal) continue
    if (m.measureStart < existing.measureStart) seedByLabel.set(m.label, m)
  }

  // Build sorted note list (staff 1, no rests, no tied stops)
  const allNotes = Array.from(noteMap.notes.values())
    .filter(n => n.staff === 1 && n.step !== 'R' && n.tied !== 'stop' && n.tied !== 'continue')
    .sort((a, b) => a.measureNum - b.measureNum || a.beat - b.beat)

  const resultAnnotations: MotifAnnotation[] = []
  const found: Record<string, number> = {}
  const now = Date.now()

  for (const [label, seedAnn] of seedByLabel) {
    const seedNoteIds = seedAnn.noteIds ?? []
    // annotation.noteIds are noteMap IDs (translated at click time in ScoreView)
    const seedNotes = seedNoteIds
      .map(id => noteMap.notes.get(id))
      .filter((n): n is NoteData => !!n)
      .sort((a, b) => a.measureNum - b.measureNum || a.beat - b.beat)

    if (seedNotes.length < 2) continue

    const motifIntervals = extractIntervals(seedNotes)
    const motifDurations = seedNotes.map(n => n.duration)
    const motifLen = seedNotes.length
    const seedIdSet = new Set(seedNoteIds)

    let count = 0

    // Re-emit the seed itself as confirmed original
    resultAnnotations.push({
      ...seedAnn,
      id: `script-${SCRIPT_ID}-${label}-origin`,
      variantType: 'original',
      matchScore: 1,
      scriptId: SCRIPT_ID,
      createdAt: now,
    })

    // Sliding window
    for (let start = 0; start <= allNotes.length - motifLen; start++) {
      const window = allNotes.slice(start, start + motifLen)
      if (window.some(n => seedIdSet.has(n.id))) continue

      const windowIntervals = extractIntervals(window)
      const windowDurations = window.map(n => n.duration)

      for (const t of opts.transformations) {
        const transformed = transformIntervals(motifIntervals, t)
        const score = calcMatchScore(transformed, windowIntervals)

        if (t === 'AUGMENTATION' && !durationRatio(motifDurations, windowDurations, 2)) continue
        if (t === 'DIMINUTION'   && !durationRatio(motifDurations, windowDurations, 0.5)) continue

        if (score >= opts.threshold) {
          const variantType = ((): MotifAnnotation['variantType'] => {
            switch (t) {
              case 'EXACT':        return 'original'
              case 'INVERSION':    return 'inversion'
              case 'RETROGRADE':   return 'retrograde'
              case 'AUGMENTATION': return 'augmentation'
              case 'DIMINUTION':   return 'diminution'
            }
          })()

          resultAnnotations.push({
            id: `script-${SCRIPT_ID}-${label}-${start}-${t}`,
            layer: 'motif',
            label,
            measureStart: window[0].measureNum,
            measureEnd: window[window.length - 1].measureNum,
            noteIds: window.map(n => n.id),
            variantType,
            matchScore: Math.round(score * 100) / 100,
            scriptId: SCRIPT_ID,
            createdAt: now,
          })
          count++
          break // don't double-count same window
        }
      }
    }

    found[label] = count
  }

  return { annotations: resultAnnotations, found }
}
