/**
 * MAP Native Renderer — Type Definitions
 * Stage 1: Core Architecture + Data Model
 *
 * These are the OUTPUT types of the Layout Engine → input to the SVG Renderer.
 * All coordinates are in pixels, relative to the SVG root.
 */

// ─────────────────────────────────────────────
// Top-level output
// ─────────────────────────────────────────────

export interface RenderedScore {
  pages: RenderedPage[]
  metadata: ScoreRenderMetadata
  /** All notes across all pages — for fast lookup by noteId */
  allNotes: RenderedNote[]
  /** elementMap equivalent — key: "measure-N" (0-based N), value: bbox */
  elementMap: Map<string, DOMRectLike>
}

export interface ScoreRenderMetadata {
  title: string
  composer: string
  keySignature: string
  timeSignature: string
  tempo?: number
  measureCount: number
  pageCount: number
}

export interface DOMRectLike {
  x: number
  y: number
  width: number
  height: number
  top: number
  left: number
  right: number
  bottom: number
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export interface RenderedPage {
  pageIndex: number   // 0-based
  width: number
  height: number
  systems: RenderedSystem[]
}

// ─────────────────────────────────────────────
// System (one horizontal row of staves)
// ─────────────────────────────────────────────

export interface RenderedSystem {
  systemIndex: number   // 0-based within the score
  pageIndex: number
  x: number             // left edge (after margin)
  y: number             // top of first staff
  width: number         // usable width (after margins)
  staves: RenderedStaff[]
  measures: RenderedMeasure[]
  /** Width consumed by clef + key sig + time sig at start of system */
  headerWidth: number
}

// ─────────────────────────────────────────────
// Staff (one set of 5 lines within a system)
// ─────────────────────────────────────────────

export interface RenderedStaff {
  staffIndex: number      // 0 = treble, 1 = bass, etc.
  y: number               // top of staff (first of 5 lines)
  lineSpacing: number     // px between adjacent lines (spatium = sp)
  height: number          // = 4 * lineSpacing
  clef: ClefType
  /** Y positions of the 5 staff lines, top to bottom */
  lineYs: [number, number, number, number, number]
}

export type ClefType = 'treble' | 'bass' | 'alto' | 'tenor' | 'percussion'

// ─────────────────────────────────────────────
// Measure
// ─────────────────────────────────────────────

export interface RenderedMeasure {
  measureNum: number      // 1-based (matches noteMap IDs)
  staffIndex: number
  x: number               // left edge (after barline)
  width: number           // from this barline to next
  y: number               // top of staff (same as RenderedStaff.y for this staff)
  systemIndex: number
  notes: RenderedNote[]
  chordSymbols: RenderedChordSymbol[]
  beams: RenderedBeam[]
  barlines: RenderedBarline[]
  ties: RenderedTie[]
  slurs: RenderedSlur[]
  dynamics: RenderedDynamic[]
  articulations: RenderedArticulation[]
  ornaments: RenderedOrnament[]
  tuplets: RenderedTuplet[]
  /** Key signature displayed at start of this measure (only if changed) */
  keySignatureChange?: RenderedKeySignature
  /** Time signature displayed (only at first measure or on change) */
  timeSignatureDisplay?: RenderedTimeSignature
  /** Clef displayed (only at first measure or on change) */
  clefDisplay?: RenderedClefSymbol
  /** Repeat / volta info */
  volta?: RenderedVolta
  repeatStart: boolean
  repeatEnd: boolean
  /** Rehearsal mark (A, B, C...) */
  rehearsalMark?: string
  /** Tempo marking text (e.g. "Allegro ♩=120") */
  tempoText?: string
}

// ─────────────────────────────────────────────
// Note
// ─────────────────────────────────────────────

export interface RenderedNote {
  /** Stable noteMap ID — e.g. "note-m4b300-E5". Also the SVG element id. */
  noteId: string
  measureNum: number        // 1-based
  beat: number              // beat within measure (1.0, 1.5, 2.0, ...)
  staffIndex: number
  voice: number             // 1–4

  // ── Geometry ────────────────────────────────
  x: number                 // center of notehead
  y: number                 // center of notehead
  /** Bounding box of the entire note group (head + stem + accidental + dots) */
  bbox: DOMRectLike

  // ── Staff position ───────────────────────────
  /** 0 = top staff line, increases downward; fractions = spaces between lines */
  staffLine: number

  // ── Visual properties ────────────────────────
  noteheadType: NoteheadType
  /** Original MusicXML duration type — 'whole'|'half'|'quarter'|'eighth'|'16th'|'32nd'|'64th' */
  durationType: string
  stemUp: boolean
  hasStem: boolean          // whole notes have no stem
  stemX: number
  stemYTop: number
  stemYBottom: number

  accidental?: AccidentalType
  accidentalX?: number      // left edge of accidental glyph

  dotted: boolean
  doubleDotted: boolean
  dotX?: number             // x of first dot center
  dot2X?: number            // x of second dot (if double-dotted)

  // ── Ledger lines ─────────────────────────────
  ledgerLines: RenderedLedgerLine[]

  // ── Rest ─────────────────────────────────────
  isRest: boolean

  // ── Grace note ───────────────────────────────
  isGrace: boolean
  graceScale?: number       // 0.65 typical

  // ── Beam / tie / slur membership ─────────────
  beamGroupId?: string      // references RenderedBeam.groupId
  tieStart?: boolean
  tieEnd?: boolean
  slurStart?: boolean
  slurEnd?: boolean

  // ── Tuplet membership ────────────────────────
  tupletId?: string
}

export type NoteheadType =
  | 'whole'
  | 'half'
  | 'quarter'     // filled ellipse (quarter, eighth, 16th, ...)
  | 'x'           // percussion
  | 'diamond'     // harmonic
  | 'triangle'
  | 'slash'

export type AccidentalType =
  | 'sharp'
  | 'flat'
  | 'natural'
  | 'double-sharp'
  | 'double-flat'
  | 'courtesy-sharp'
  | 'courtesy-flat'
  | 'courtesy-natural'

export interface RenderedLedgerLine {
  y: number
  x1: number    // left edge (notehead center - notehead width/2 - ledgerPad)
  x2: number    // right edge
}

// ─────────────────────────────────────────────
// Chord symbol (e.g. "Bb7", "Cmaj7")
// ─────────────────────────────────────────────

export interface RenderedChordSymbol {
  measureNum: number
  beat: number
  x: number
  y: number       // baseline of text
  text: string    // display text (may include Unicode ♭ ♯)
  svgId: string   // e.g. "chord-m4b300"
}

// ─────────────────────────────────────────────
// Beam group
// ─────────────────────────────────────────────

export interface RenderedBeam {
  groupId: string
  noteIds: string[]   // noteMap IDs in order
  stemUp: boolean
  levels: number      // 1 = eighth, 2 = 16th, 3 = 32nd, 4 = 64th
  /**
   * One entry per beam level.
   * level[0] = primary beam (connects all notes), level[1] = secondary, etc.
   * Each entry may have multiple segments if the beam is broken (e.g. 16th sub-groups).
   */
  segments: BeamSegment[][]
}

export interface BeamSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

// ─────────────────────────────────────────────
// Barline
// ─────────────────────────────────────────────

export interface RenderedBarline {
  x: number
  yTop: number
  yBottom: number
  type: BarlineType
}

export type BarlineType =
  | 'regular'
  | 'double'
  | 'final'           // thin + thick
  | 'heavy-heavy'
  | 'repeat-start'    // thick + thin + dots
  | 'repeat-end'      // dots + thin + thick
  | 'repeat-both'     // dots + thin + thick + thin + dots
  | 'dashed'
  | 'dotted'
  | 'none'

// ─────────────────────────────────────────────
// Tie
// ─────────────────────────────────────────────

export interface RenderedTie {
  fromNoteId: string
  toNoteId: string
  /** Bezier control points: M x1,y1 C cx1,cy1 cx2,cy2 x2,y2 */
  path: BezierArc
  above: boolean    // tie arc above (stem down) or below (stem up) the note
  crossSystem: boolean
  /** When crossSystem: two half-arcs instead of one full arc */
  halfArcs?: [BezierArc, BezierArc]
}

// ─────────────────────────────────────────────
// Slur
// ─────────────────────────────────────────────

export interface RenderedSlur {
  fromNoteId: string
  toNoteId: string
  path: BezierArc
  above: boolean
  crossSystem: boolean
  halfArcs?: [BezierArc, BezierArc]
}

export interface BezierArc {
  x1: number
  y1: number
  cx1: number
  cy1: number
  cx2: number
  cy2: number
  x2: number
  y2: number
}

// ─────────────────────────────────────────────
// Key Signature
// ─────────────────────────────────────────────

export interface RenderedKeySignature {
  /** Positive = sharps, negative = flats (e.g. 2 = D major) */
  fifths: number
  x: number
  staffIndex: number
  /** Individual accidental symbols with their positions */
  accidentals: Array<{ x: number; y: number; type: 'sharp' | 'flat' | 'natural' }>
}

// ─────────────────────────────────────────────
// Time Signature
// ─────────────────────────────────────────────

export interface RenderedTimeSignature {
  beats: number         // numerator (e.g. 4)
  beatType: number      // denominator (e.g. 4)
  x: number
  staffIndex: number
  /** y of numerator digit baseline */
  yNumerator: number
  /** y of denominator digit baseline */
  yDenominator: number
}

// ─────────────────────────────────────────────
// Clef symbol
// ─────────────────────────────────────────────

export interface RenderedClefSymbol {
  clef: ClefType
  x: number
  y: number             // anchor point (varies by clef)
  staffIndex: number
  isChange: boolean     // mid-score change = smaller size
}

// ─────────────────────────────────────────────
// Dynamic marking (p, f, mf, ff, ...)
// ─────────────────────────────────────────────

export interface RenderedDynamic {
  measureNum: number
  beat: number
  text: string          // "p" | "f" | "mf" | "ff" | "sfz" | ...
  x: number
  y: number
  svgId: string         // "dynam-m4b100"
  placement: 'above' | 'below'
}

// ─────────────────────────────────────────────
// Articulation
// ─────────────────────────────────────────────

export interface RenderedArticulation {
  noteId: string
  type: ArticulationType
  x: number
  y: number
  svgId: string
}

export type ArticulationType =
  | 'staccato'
  | 'staccatissimo'
  | 'tenuto'
  | 'accent'       // >
  | 'strong-accent' // ^
  | 'stress'
  | 'unstress'
  | 'snap-pizzicato'

// ─────────────────────────────────────────────
// Ornament (trill, turn, mordent, ...)
// ─────────────────────────────────────────────

export interface RenderedOrnament {
  noteId: string
  type: OrnamentType
  x: number
  y: number
  svgId: string
}

export type OrnamentType =
  | 'trill'
  | 'trill-extension'
  | 'turn'
  | 'mordent'
  | 'inverted-mordent'
  | 'tremolo'
  | 'wavy-line'
  | 'fermata'
  | 'fermata-square'

// ─────────────────────────────────────────────
// Hairpin (crescendo / decrescendo)
// ─────────────────────────────────────────────

export interface RenderedHairpin {
  svgId: string
  type: 'crescendo' | 'decrescendo'
  x1: number
  x2: number
  y: number           // center y of hairpin
  openingHeight: number  // half-height at the wide end (px)
  placement: 'above' | 'below'
}

// ─────────────────────────────────────────────
// Tuplet
// ─────────────────────────────────────────────

export interface RenderedTuplet {
  tupletId: string
  noteIds: string[]
  number: number          // e.g. 3 for triplet, 5 for quintuplet
  /** Bracket geometry */
  bracket?: TupletBracket
  /** Center x of the number text */
  numberX: number
  numberY: number
  above: boolean
}

export interface TupletBracket {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Has hook at both ends going toward the staff */
  hookHeight: number
}

// ─────────────────────────────────────────────
// Volta bracket (1st/2nd ending)
// ─────────────────────────────────────────────

export interface RenderedVolta {
  number: number      // 1, 2, 3, ...
  text: string        // "1.", "2.", "1.-3."
  x1: number
  x2: number
  y: number
  openRight: boolean  // 2nd ending bracket has no closing line on right
}

// ─────────────────────────────────────────────
// Render options (input to the renderer)
// ─────────────────────────────────────────────

export interface RenderOptions {
  /** Page width in px (default: 794 = A4 portrait @96dpi) */
  pageWidth?: number
  /** Page height in px (default: 1123 = A4 portrait @96dpi) */
  pageHeight?: number
  /** Spatium / lineSpacing in px (default: 10) */
  spatium?: number
  /** Page margins in px (default: 48) */
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
  /** Spacing between staves within a system, in sp (default: 6.0) */
  staffSpacingSp?: number
  /** Spacing between systems, in sp (default: 8.0) */
  systemSpacingSp?: number
}

// ─────────────────────────────────────────────
// Public API output (from renderScore)
// ─────────────────────────────────────────────

export interface RenderResult {
  /** Full SVG markup — set as innerHTML of the score container */
  svg: string
  /** All rendered notes (for overlays, scripts, click detection) */
  notes: RenderedNote[]
  /** elementMap: "measure-N" (0-based N) → bbox — drop-in for existing MAP code */
  elementMap: Map<string, DOMRectLike>
  /** Rendered score structure (for advanced consumers) */
  renderedScore: RenderedScore
}
