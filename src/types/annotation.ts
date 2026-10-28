/**
 * Annotation model. Every annotation references notes by noteMap ID (never by
 * rendered SVG IDs) and measures by 1-based measure index.
 *
 * 'questions' is a visibility-only layer: open questions are stored as
 * `labels` annotations with `isQuestion: true` (backward compatible).
 */
export type AnnotationLayer =
  | 'harmony' | 'melody' | 'motif' | 'form' | 'texture' | 'labels' | 'color' | 'freehand'

export type LayerId = AnnotationLayer | 'questions'

interface BaseAnnotation {
  id: string
  layer: AnnotationLayer
  measureStart: number
  measureEnd?: number
  noteIds?: string[]
  createdAt: number
  visualOffset?: { x: number; y: number }  // drag-to-reposition, in page units
  scriptId?: string                        // set when created by a script
}

export type HarmonicFunction = 'T' | 'S' | 'D'
export type CadenceType = 'PAC' | 'IAC' | 'HC' | 'PC' | 'DC'

export interface HarmonyAnnotation extends BaseAnnotation {
  layer: 'harmony'
  chordSymbol?: string
  scaleDegree?: string
  function?: HarmonicFunction
  cadenceType?: CadenceType
  modulation?: string
  xmlChord?: boolean   // chord symbol already printed by the score (only the numeral is drawn)
}

export type NoteFunction = 'CT' | 'PT' | 'NT' | 'SUS' | 'ANT' | 'APP' | 'ESC' | 'PED'

export interface MelodyAnnotation extends BaseAnnotation {
  layer: 'melody'
  noteFunction?: NoteFunction
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

export type MotifVariant =
  | 'original' | 'inversion' | 'retrograde' | 'augmentation' | 'diminution'
  | 'sequence' | 'fragmentation' | 'combination'

export interface MotifAnnotation extends BaseAnnotation {
  layer: 'motif'
  label: string
  variantType?: MotifVariant
  crossRef?: string
  matchScore?: number
}

export interface LabelAnnotation extends BaseAnnotation {
  layer: 'labels'
  text: string
  isQuestion?: boolean
}

export interface TextureAnnotation extends BaseAnnotation {
  layer: 'texture'
  textureType?: 'homophony' | 'polyphony' | 'monophony'
  counterpoint?: 'strict' | 'free' | 'imitative'
  dominantVoice?: string
}

export interface FreehandAnnotation extends BaseAnnotation {
  layer: 'freehand'
  path: string            // SVG path data, page units
  points?: number[]       // flat [x0,y0,x1,y1,…] in page units (for erasing)
  color: string
  strokeWidth: number
  opacity?: number
  linkedLayer?: LayerId
  label?: string
}

/** A rendered score element (chord symbol text, dynamic, articulation, tie…) */
export interface ElementRef {
  index: number   // index among colorable elements in render order
  tag: string     // svg tag name, for verification
  x: number       // page-unit position, for verification / re-lookup
  y: number
}

export interface ColorAnnotation extends BaseAnnotation {
  layer: 'color'
  color: string
  element?: ElementRef   // set → colors a score element; unset → colors noteIds
}

export type Annotation =
  | HarmonyAnnotation
  | MelodyAnnotation
  | FormAnnotation
  | MotifAnnotation
  | LabelAnnotation
  | TextureAnnotation
  | FreehandAnnotation
  | ColorAnnotation
