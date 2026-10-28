export interface NoteData {
  id: string        // stable noteMap ID — see xmlParser.ts for the format
  pitch: string     // e.g. "Bb4"
  step: string      // e.g. "B"
  octave: number
  alter?: number    // -1, 0, 1 …
  duration: number  // in quarter notes (0 for grace notes)
  type: string      // "quarter", "eighth", …
  measureNum: number  // 1-based measure INDEX in document order
  beat: number        // 1-based position in quarter notes from measure start
  voice: number
  staff: number       // staff within its part (1-based)
  part: number        // part index (0-based)
  globalStaff: number // staff index across all parts (1-based)
  tied?: 'start' | 'stop' | 'continue'
  grace?: boolean
  fingering?: string
}

export interface MeasureData {
  num: number          // 1-based index
  label: string        // printed measure number (the XML "number" attribute)
  notes: NoteData[]
  timeSignature: { beats: number; beatType: number }  // effective (carried forward)
  keySignature: { fifths: number; mode: string }      // effective (carried forward)
  startQ: number       // absolute start in quarter notes from the beginning of the piece
  lengthQ: number      // nominal length in quarter notes
  tempo?: number
}

export interface ScoreMetadata {
  title: string
  composer: string
  key: string
  timeSignature: string
  tempo: string
  totalMeasures: number
  parts: number
}

export interface NoteMap {
  measures: Map<number, MeasureData>
  notes: Map<string, NoteData>
  metadata: ScoreMetadata
}
