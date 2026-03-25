import type { Annotation, HarmonyAnnotation, MelodyAnnotation, FormAnnotation, MotifAnnotation, LabelAnnotation, TextureAnnotation, FreehandAnnotation } from '../types/annotation'
import type { AnalysisJson } from '../types/analysis'
import type { ScoreMetadata } from '../types/score'
import type { ResearchNote } from '../store/researchStore'
import type { PaletteEntry } from '../store/stylusStore'
import { extractSourceMarkings } from './xmlParser'

export function exportToAnalysisJson(
  xmlString: string,
  metadata: ScoreMetadata,
  annotations: Record<string, Annotation>,
  researchNotes: ResearchNote[] = [],
  palette: PaletteEntry[] = [],
): AnalysisJson {
  const sourceMarkings = extractSourceMarkings(xmlString)
  const annotationList = Object.values(annotations)

  const harmonyAnnotations = annotationList.filter((a): a is HarmonyAnnotation => a.layer === 'harmony')
  const melodyAnnotations = annotationList.filter((a): a is MelodyAnnotation => a.layer === 'melody')
  const formAnnotations = annotationList.filter((a): a is FormAnnotation => a.layer === 'form')
  const motifAnnotations = annotationList.filter((a): a is MotifAnnotation => a.layer === 'motif')
  const labelAnnotations = annotationList.filter((a): a is LabelAnnotation => a.layer === 'labels')
  const freehandAnnotations = annotationList.filter((a): a is FreehandAnnotation => a.layer === 'freehand')

  return {
    metadata: {
      title: metadata.title,
      composer: metadata.composer,
      key: metadata.key,
      time_signature: metadata.timeSignature,
      tempo: metadata.tempo,
      total_measures: metadata.totalMeasures,
    },
    source_markings: {
      dynamics: sourceMarkings.dynamics.map(d => ({ measure: d.measure, value: d.value })),
      articulations: sourceMarkings.articulations.map(a => ({ measure: a.measure, noteId: a.noteId, value: a.value })),
      ornaments: sourceMarkings.ornaments.map(o => ({ measure: o.measure, noteId: o.noteId, value: o.value })),
      tempo_markings: sourceMarkings.tempoMarkings.map(t => ({ measure: t.measure, value: t.value })),
      repeat_signs: [],
      fingerings: sourceMarkings.fingerings.map(f => ({ measure: f.measure, value: f.value })),
      technical_indications: [],
    },
    analysis: {
      formal_structure: formAnnotations.map(a => ({
        id: a.id,
        measure_start: a.measureStart,
        measure_end: a.measureEnd ?? a.measureStart,
        high_level: a.highLevel,
        mid_level: a.midLevel,
        low_level: a.lowLevel,
        closure: a.closure,
      })),
      harmony: harmonyAnnotations.map(a => ({
        id: a.id,
        measure: a.measureStart,
        chord_symbol: a.chordSymbol,
        scale_degree: a.scaleDegree,
        function: a.function,
        cadence_type: a.cadenceType,
        modulation: a.modulation,
      })),
      melody: melodyAnnotations.map(a => ({
        id: a.id,
        measure: a.measureStart,
        note_id: a.noteIds?.[0] || '',
        note_function: a.noteFunction,
        chromaticism: a.chromaticism,
        melodic_role: a.melodicRole,
      })),
      motifs: motifAnnotations.map(a => ({
        id: a.id,
        label: a.label,
        measure_start: a.measureStart,
        measure_end: a.measureEnd ?? a.measureStart,
        note_ids: a.noteIds || [],
        variant_type: a.variantType,
        cross_ref: a.crossRef,
      })),
      labels: labelAnnotations.map(a => ({
        id: a.id,
        measure: a.measureStart,
        note_ids: a.noteIds,
        text: a.text,
      })),
      open_questions: labelAnnotations
        .filter(a => (a as any).isQuestion)
        .map(a => ({
          id: a.id,
          measure: a.measureStart,
          text: a.text,
        })),
      freehand_notes: freehandAnnotations.map(a => ({
        id: a.id,
        measure: a.measureStart,
        path: a.path,
        color: a.color,
        strokeWidth: a.strokeWidth,
        opacity: a.opacity ?? 1,
        linkedLayer: a.linkedLayer,
      })),
    },
    research_notes: researchNotes.map(n => ({
      id: n.id,
      text: n.text,
      links: n.links.map(l => ({
        type: l.type,
        measureStart: l.measureStart,
        measureEnd: l.measureEnd,
        noteIds: l.noteIds,
        label: l.label,
      })),
    })),
    color_palette: palette.map(p => ({
      id: p.id,
      color: p.color,
      width: p.width,
      opacity: p.opacity,
      linkedLayer: p.linkedLayer,
      label: p.label,
    })),
  }
}

export function downloadJson(data: AnalysisJson, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.replace(/\.xml$/, '.analysis.json')
  a.click()
  URL.revokeObjectURL(url)
}
