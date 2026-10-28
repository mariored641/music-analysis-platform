/**
 * `.analysis.json` — the file Claude Code (and scripts) read and write.
 *
 * Round-trip fields: piece, annotations (raw, as stored), researchNotes.
 * `summary` is derived, human-readable, and ignored on import.
 */
import type { Annotation } from '../types/annotation'
import type { NoteMap } from '../types/score'
import type { LibraryPiece } from '../store/libraryStore'
import type { ResearchNote } from '../store/researchStore'
import { extractSourceMarkings } from './xmlParser'
import { migrateAnnotations } from './migrate'

export interface AnalysisFile {
  format: 'map-analysis'
  version: '2.0'
  savedAt: string
  piece: Partial<LibraryPiece> & { id: string }
  annotations: Annotation[]
  researchNotes: ResearchNote[]
  summary?: unknown
}

export function buildAnalysisFile(
  piece: LibraryPiece | { id: string },
  annotations: Record<string, Annotation>,
  researchNotes: ResearchNote[],
  noteMap: NoteMap | null,
  xml: string | null,
  savedAt = Date.now(),
): AnalysisFile {
  const list = Object.values(annotations).sort((a, b) => a.measureStart - b.measureStart || a.createdAt - b.createdAt)
  return {
    format: 'map-analysis',
    version: '2.0',
    savedAt: new Date(savedAt).toISOString(),
    piece,
    annotations: list,
    researchNotes,
    summary: buildSummary(list, noteMap, xml),
  }
}

function buildSummary(list: Annotation[], noteMap: NoteMap | null, xml: string | null) {
  const pos = (a: Annotation) => {
    const n = a.noteIds?.[0] ? noteMap?.notes.get(a.noteIds[0]) : undefined
    return { measure: n?.measureNum ?? a.measureStart, beat: n?.beat, pitch: n?.pitch }
  }
  const pitches = (a: Annotation) => (a.noteIds ?? []).map(id => noteMap?.notes.get(id)?.pitch ?? id)
  const src = xml ? extractSourceMarkings(xml) : null
  return {
    harmony: list.filter(a => a.layer === 'harmony').map(a => a.layer === 'harmony' && ({
      ...pos(a), chord: a.chordSymbol, degree: a.scaleDegree, function: a.function, cadence: a.cadenceType, modulation: a.modulation, script: a.scriptId,
    })),
    melody: list.filter(a => a.layer === 'melody').map(a => a.layer === 'melody' && ({ ...pos(a), function: a.noteFunction, script: a.scriptId })),
    motifs: list.filter(a => a.layer === 'motif').map(a => a.layer === 'motif' && ({
      label: a.label, variant: a.variantType, measures: [a.measureStart, a.measureEnd ?? a.measureStart], notes: pitches(a), score: a.matchScore, script: a.scriptId,
    })),
    form: list.filter(a => a.layer === 'form').map(a => a.layer === 'form' && ({
      measures: [a.measureStart, a.measureEnd ?? a.measureStart], section: a.midLevel, large: a.highLevel, phrase: a.lowLevel, closure: a.closure,
    })),
    texture: list.filter(a => a.layer === 'texture').map(a => a.layer === 'texture' && ({ measures: [a.measureStart, a.measureEnd ?? a.measureStart], texture: a.textureType })),
    labels: list.filter(a => a.layer === 'labels' && !a.isQuestion).map(a => a.layer === 'labels' && ({ measures: [a.measureStart, a.measureEnd ?? a.measureStart], text: a.text, notes: pitches(a) })),
    questions: list.filter(a => a.layer === 'labels' && a.isQuestion).map(a => a.layer === 'labels' && ({ measures: [a.measureStart, a.measureEnd ?? a.measureStart], text: a.text })),
    drawings: list.filter(a => a.layer === 'freehand').length,
    sourceMarkings: src,
  }
}

/** Parse an analysis file (v2 or the old v1 sync format). Returns null if unrecognized. */
export function parseAnalysisFile(text: string): { savedAt: number; annotations: Record<string, Annotation>; researchNotes: ResearchNote[]; piece?: Partial<LibraryPiece> } | null {
  try {
    const data = JSON.parse(text)
    if (!data || typeof data !== 'object' || !data.annotations) return null
    return {
      savedAt: data.savedAt ? new Date(data.savedAt).getTime() : 0,
      annotations: migrateAnnotations(data.annotations),
      researchNotes: Array.isArray(data.researchNotes) ? data.researchNotes : [],
      piece: data.piece,
    }
  } catch {
    return null
  }
}

export function downloadText(text: string, fileName: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function baseName(fileName: string) {
  return fileName.replace(/\.(musicxml|xml|mxl)$/i, '')
}
