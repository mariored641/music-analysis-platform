export interface NoteData {
  id: string        // Verovio element ID
  pitch: string     // e.g. "G4"
  step: string      // e.g. "G"
  octave: number
  alter?: number    // -1, 0, 1
  duration: number  // in quarter notes
  type: string      // "quarter", "eighth", etc.
  measureNum: number
  beat: number
  voice: number
  staff: number
  tied?: 'start' | 'stop' | 'continue'
  fingering?: string
}

export interface MeasureData {
  num: number
  notes: NoteData[]
  timeSignature?: { beats: number; beatType: number }
  keySignature?: { fifths: number; mode: string }
  tempo?: number
  tempoText?: string
}

export interface ScoreMetadata {
  title: string
  composer: string
  key: string
  timeSignature: string
  tempo: string
  totalMeasures: number
}

export interface NoteMap {
  measures: Map<number, MeasureData>
  notes: Map<string, NoteData>    // verovioId → NoteData
  metadata: ScoreMetadata
}

export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

export interface VerovioElement {
  verovioId: string
  measureNum: number
  noteId?: string
  bbox: BBox
}
