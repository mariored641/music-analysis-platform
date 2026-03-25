export interface AnalysisJson {
  metadata: {
    title: string
    composer: string
    key: string
    time_signature: string
    tempo: string
    total_measures: number
  }
  source_markings: {
    dynamics: SourceMarking[]
    articulations: SourceMarking[]
    ornaments: SourceMarking[]
    tempo_markings: SourceMarking[]
    repeat_signs: SourceMarking[]
    fingerings: SourceMarking[]
    technical_indications: SourceMarking[]
  }
  analysis: {
    formal_structure: FormalEntry[]
    harmony: HarmonyEntry[]
    melody: MelodyEntry[]
    motifs: MotifEntry[]
    labels: LabelEntry[]
    open_questions: QuestionEntry[]
    freehand_notes: FreehandEntry[]
  }
  research_notes: ResearchNoteEntry[]
  color_palette: PaletteEntryExport[]
}

export interface SourceMarking {
  measure: number
  beat?: number
  value: string
  noteId?: string
}

export interface FormalEntry {
  id: string
  measure_start: number
  measure_end: number
  high_level?: string
  mid_level?: string
  low_level?: string
  closure?: string
}

export interface HarmonyEntry {
  id: string
  measure: number
  chord_symbol?: string
  scale_degree?: string
  function?: string
  cadence_type?: string
  modulation?: string
}

export interface MelodyEntry {
  id: string
  measure: number
  note_id: string
  note_function?: string
  chromaticism?: string
  melodic_role?: string
}

export interface MotifEntry {
  id: string
  label: string
  measure_start: number
  measure_end: number
  note_ids: string[]
  variant_type?: string
  cross_ref?: string
}

export interface LabelEntry {
  id: string
  measure: number
  note_ids?: string[]
  text: string
  is_question?: boolean
}

export interface QuestionEntry {
  id: string
  measure: number
  text: string
}

export interface FreehandEntry {
  id: string
  measure: number
  path: string
  color: string
  strokeWidth: number
  opacity: number
  linkedLayer?: string
}

export interface ResearchNoteEntry {
  id: string
  text: string
  links: Array<{
    type: 'measures' | 'notes'
    measureStart: number
    measureEnd?: number
    noteIds?: string[]
    label: string
  }>
}

export interface PaletteEntryExport {
  id: string
  color: string
  width: number
  opacity: number
  linkedLayer?: string
  label?: string
}
