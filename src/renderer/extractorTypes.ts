/**
 * MAP Native Renderer — Extractor Types
 * Stage 2: Pre-layout data extracted from MusicXML.
 *
 * These types represent the raw musical content BEFORE any geometry is calculated.
 * `xmlExtractor.ts` produces an `ExtractedScore` from a MusicXML string.
 * The layout engine (Stage 3/4) consumes `ExtractedScore` to produce `RenderedScore`.
 */

// ─────────────────────────────────────────────
// Top-level extracted score
// ─────────────────────────────────────────────

export interface ExtractedScore {
  metadata: ExtractedMetadata
  parts: ExtractedPart[]
  /** All measures in order (across all parts — for single-part scores this is the only part) */
  measures: ExtractedMeasure[]
}

export interface ExtractedMetadata {
  title: string
  composer: string
  /** Initial key: positive = sharps, negative = flats */
  fifths: number
  mode: 'major' | 'minor'
  beats: number          // time sig numerator
  beatType: number       // time sig denominator
  tempo?: number         // BPM from first <sound tempo="...">
  tempoText?: string     // e.g. "Allegro"
  measureCount: number
  /** Number of staves per system (1 = treble only, 2 = grand staff) */
  staffCount: number
}

export interface ExtractedPart {
  id: string
  name: string
  staffCount: number
}

// ─────────────────────────────────────────────
// Measure
// ─────────────────────────────────────────────

export interface ExtractedMeasure {
  /** 1-based measure number */
  num: number
  /** Divisions per quarter note (may change per measure) */
  divisions: number

  /** Key signature change (only present if it changes in this measure) */
  keyChange?: { fifths: number; mode: 'major' | 'minor' }
  /** Time signature change (only present if it changes in this measure) */
  timeChange?: { beats: number; beatType: number }
  /** Clef change per staff index (only present if changed) */
  clefChange?: Record<number, ClefSign>

  notes: ExtractedNote[]
  harmonies: ExtractedHarmony[]
  dynamics: ExtractedDynamic[]
  directions: ExtractedDirection[]

  /** Barline at the start of this measure (e.g. repeat-start) */
  barlineLeft?: ExtractedBarline
  /** Barline at the end of this measure */
  barlineRight?: ExtractedBarline

  /** Volta bracket starting at this measure */
  voltaStart?: ExtractedVolta
  voltaEnd?: boolean

  /** Rehearsal mark (A, B, C...) */
  rehearsalMark?: string
  /** Tempo text from <words> or <metronome> */
  tempoText?: string
  /** BPM from <sound tempo="..."> */
  tempo?: number
}

// ─────────────────────────────────────────────
// Note
// ─────────────────────────────────────────────

export interface ExtractedNote {
  /** noteMap ID — stable: "note-m{measureNum}b{Math.round(beat*100)}-{step}{octave}" */
  id: string

  measureNum: number
  /** Beat within measure, 1-based (e.g. beat 1 = 1.0, beat 2 = 2.0) */
  beat: number
  /** Duration in beats (quarter = 1.0 in 4/4) */
  duration: number
  /** Duration in raw XML divisions */
  durationDivisions: number

  /** 0-based staff index (0 = treble, 1 = bass) */
  staffIndex: number
  /** Voice 1–4 */
  voice: number

  /** true if this note shares an x-position with the previous note (chord member) */
  isChord: boolean
  /** true if this is a rest */
  isRest: boolean
  /** true if this is a grace note */
  isGrace: boolean

  // ── Pitch (undefined for rests) ──────────────────
  step?: string           // C D E F G A B
  octave?: number
  /** Semitone alteration: -1 = flat, 0 = natural, 1 = sharp, 2 = double-sharp, -2 = double-flat */
  alter?: number
  /** MIDI note number (undefined for rests) */
  midi?: number

  // ── Duration type ────────────────────────────────
  /** MusicXML type: "whole" | "half" | "quarter" | "eighth" | "16th" | "32nd" | "64th" */
  type: string
  dotCount: number        // 0, 1, or 2

  // ── Accidental ───────────────────────────────────
  /** Accidental explicitly written in MusicXML (may be courtesy/cautionary) */
  explicitAccidental?: AccidentalSign
  /** true if the explicit accidental is marked as cautionary/courtesy */
  isCourtesy?: boolean
  /** Computed by extractor: whether to display an accidental (see §4h algorithm) */
  showAccidental?: boolean
  /** The accidental sign to show (sharp/flat/natural/etc.) */
  accidentalToShow?: AccidentalSign

  // ── Beam ─────────────────────────────────────────
  beamStates?: BeamState[]   // one per beam level (primary, secondary, tertiary...)

  // ── Tie ──────────────────────────────────────────
  tieStart?: boolean
  tieStop?: boolean

  // ── Slur ─────────────────────────────────────────
  slurStart?: boolean
  slurStop?: boolean
  slurPlacement?: 'above' | 'below'

  // ── Tuplet ───────────────────────────────────────
  tupletStart?: boolean
  tupletStop?: boolean
  /** Actual notes in tuplet (e.g. 3 for triplet) */
  tupletActual?: number
  /** Normal notes the tuplet replaces (e.g. 2 for triplet) */
  tupletNormal?: number
  /** Shared ID linking all notes of the same tuplet group */
  tupletId?: string

  // ── Articulations ────────────────────────────────
  articulations?: ArticulationMark[]

  // ── Ornaments ────────────────────────────────────
  ornaments?: OrnamentMark[]

  // ── Fingering ────────────────────────────────────
  fingering?: string
}

export type AccidentalSign =
  | 'sharp'
  | 'flat'
  | 'natural'
  | 'double-sharp'
  | 'double-flat'

export type BeamValue = 'begin' | 'continue' | 'end' | 'forward hook' | 'backward hook'

export interface BeamState {
  /** Beam level: 1 = primary (eighth), 2 = secondary (16th), 3 = tertiary (32nd), 4 = 64th */
  level: number
  value: BeamValue
}

export type ArticulationMark =
  | 'staccato'
  | 'staccatissimo'
  | 'tenuto'
  | 'accent'
  | 'strong-accent'
  | 'stress'
  | 'unstress'
  | 'snap-pizzicato'
  | 'fermata'
  | 'fermata-square'

export type OrnamentMark =
  | 'trill-mark'
  | 'turn'
  | 'inverted-turn'
  | 'mordent'
  | 'inverted-mordent'
  | 'tremolo'
  | 'wavy-line'

// ─────────────────────────────────────────────
// Harmony (chord symbol)
// ─────────────────────────────────────────────

export interface ExtractedHarmony {
  measureNum: number
  /** Beat within measure, 1-based */
  beat: number
  /** Fraction 0.0–1.0 within measure (for melody-color lookup compatibility) */
  beatFraction: number
  rootStep: string        // C D E F G A B
  rootAlter: number       // -1 flat, 0 natural, 1 sharp
  kind: string            // MusicXML kind value: "major", "minor", "dominant", etc.
  kindText: string        // display text from kind/@text: "", "m", "7", "maj7", etc.
  /** Assembled display label: e.g. "Bb7", "Cmaj7" */
  label: string
  /** Bass note (for slash chords like C/E) */
  bassStep?: string
  bassAlter?: number
}

// ─────────────────────────────────────────────
// Dynamic marking
// ─────────────────────────────────────────────

export interface ExtractedDynamic {
  measureNum: number
  beat: number
  staffIndex: number
  placement: 'above' | 'below'
  /** "p" | "pp" | "ppp" | "f" | "ff" | "fff" | "mf" | "mp" | "sf" | "sfz" | "fz" | "rfz" */
  value: string
}

// ─────────────────────────────────────────────
// Direction (words, tempo, wedge/hairpin)
// ─────────────────────────────────────────────

export type DirectionType =
  | 'words'
  | 'metronome'
  | 'wedge-crescendo'
  | 'wedge-decrescendo'
  | 'wedge-stop'
  | 'dashes-start'
  | 'dashes-stop'
  | 'octave-shift-up'     // 8vb
  | 'octave-shift-down'   // 8va
  | 'octave-shift-stop'
  | 'segno'
  | 'coda'

export interface ExtractedDirection {
  measureNum: number
  beat: number
  staffIndex: number
  placement: 'above' | 'below'
  type: DirectionType
  text?: string
  /** For metronome: beat unit ("quarter" etc.) */
  metronomeUnit?: string
  /** For metronome: BPM */
  metronomeBpm?: number
  /** For wedge: identifies matching start/stop pair */
  wedgeNumber?: number
}

// ─────────────────────────────────────────────
// Barline
// ─────────────────────────────────────────────

export type BarlineStyle =
  | 'regular'
  | 'double'
  | 'final'
  | 'heavy-heavy'
  | 'repeat-start'
  | 'repeat-end'
  | 'repeat-both'
  | 'dashed'
  | 'dotted'
  | 'none'

export interface ExtractedBarline {
  style: BarlineStyle
  /** 'left' = start of measure, 'right' = end of measure */
  location: 'left' | 'right'
}

// ─────────────────────────────────────────────
// Volta bracket
// ─────────────────────────────────────────────

export interface ExtractedVolta {
  number: number
  text: string      // "1.", "2.", "1.-3."
  /** true if this bracket has no closing line on the right (e.g. 2nd ending) */
  openRight: boolean
}

// ─────────────────────────────────────────────
// Clef
// ─────────────────────────────────────────────

export type ClefSign = 'G' | 'F' | 'C' | 'percussion' | 'TAB'

export interface ExtractedClef {
  sign: ClefSign
  /** Line the clef sits on (G clef on line 2, F clef on line 4, etc.) */
  line: number
  /** Octave transposition: -1 = 8vb, 1 = 8va */
  octaveChange?: number
  staffIndex: number
}
