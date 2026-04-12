export type LayerId = 'harmony' | 'melody' | 'form' | 'motif' | 'labels' | 'texture' | 'freehand' | 'noteColor' | 'svgColor'

export type SelectionType = 'note' | 'notes'

// Base for all annotations
interface BaseAnnotation {
  id: string
  layer: LayerId
  measureStart: number
  measureEnd?: number
  noteIds?: string[]
  createdAt: number
  visualOffset?: { x: number; y: number }  // drag-to-reposition
  scriptId?: string  // set when created/updated by a script
}

export interface HarmonyAnnotation extends BaseAnnotation {
  layer: 'harmony'
  chordSymbol?: string
  scaleDegree?: string
  function?: 'T' | 'S' | 'D'
  cadenceType?: 'PAC' | 'IAC' | 'HC' | 'PC' | 'DC'
  modulation?: string
  tonicization?: string
  pedalDegree?: string
}

export interface MelodyAnnotation extends BaseAnnotation {
  layer: 'melody'
  noteFunction?: 'CT' | 'PT' | 'NT' | 'SUS' | 'ANT' | 'APP' | 'ESC' | 'PED'
  chromaticism?: 'diatonic' | 'chromatic' | 'outside'
  melodicRole?: 'peak-local' | 'peak-global' | 'low-local' | 'low-global'
}

export interface FormAnnotation extends BaseAnnotation {
  layer: 'form'
  highLevel?: string
  midLevel?: string
  lowLevel?: string
  closure?: 'open' | 'closed' | 'half-closed'
}

export interface MotifAnnotation extends BaseAnnotation {
  layer: 'motif'
  label: string
  variantType?: 'original' | 'inversion' | 'retrograde' | 'augmentation' | 'diminution' | 'sequence' | 'fragmentation' | 'combination'
  crossRef?: string
  matchScore?: number
  scriptId?: string
}

export interface LabelAnnotation extends BaseAnnotation {
  layer: 'labels'
  text: string
}

export interface TextureAnnotation extends BaseAnnotation {
  layer: 'texture'
  textureType?: 'homophony' | 'polyphony' | 'monophony'
  counterpoint?: 'strict' | 'free' | 'imitative'
  dominantVoice?: string
}

export interface FreehandAnnotation extends BaseAnnotation {
  layer: 'freehand'
  path: string // SVG path data
  color: string
  strokeWidth: number
  opacity?: number
  linkedLayer?: string
}

export interface NoteColorAnnotation extends BaseAnnotation {
  layer: 'noteColor'
  colorType: 'CHORD_TONE' | 'PASSING_TONE' | 'NEIGHBOR_TONE'
  scriptId?: string
}

export interface OpenQuestion extends BaseAnnotation {
  layer: 'labels'
  isQuestion: true
  text: string
}

// Identifies a non-note SVG element by structural position (stable across re-renders)
export interface SvgColorAnnotation extends BaseAnnotation {
  layer: 'svgColor'
  color: string
  svgClass: string      // Verovio element class: 'dynam' | 'artic' | 'hairpin' | 'tempo' | ...
  positionIndex: number // index among elements of same class within measureStart
}

export type Annotation =
  | HarmonyAnnotation
  | MelodyAnnotation
  | FormAnnotation
  | MotifAnnotation
  | LabelAnnotation
  | TextureAnnotation
  | FreehandAnnotation
  | NoteColorAnnotation
  | SvgColorAnnotation
