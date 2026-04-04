/**
 * atomicElements.ts — Layout and paint functions for atomic music elements
 *
 * Each element has two functions:
 *   layout*()  — computes geometry in pixels (spatium already applied)
 *   paint*()   — calls Painter methods with computed geometry + metadata
 *
 * All SP constants are defined here in staff-spaces.
 * Multiply by spatiumPx to get pixels.
 *
 * Coordinate system: y increases downward (screen coordinates).
 */

import type { Px } from './spatium'
import { lineToY, MIDDLE_LINE } from './spatium'
import type { Painter, ElementMetadata } from './painter/Painter'
import {
  LELAND_NOTEHEAD_BLACK, LELAND_NOTEHEAD_HALF, LELAND_NOTEHEAD_WHOLE,
  LELAND_NOTEHEAD_DOUBLE_WHOLE,
  LELAND_FLAG_8TH_UP, LELAND_FLAG_8TH_DOWN,
  LELAND_FLAG_16TH_UP, LELAND_FLAG_16TH_DOWN,
  LELAND_FLAG_32ND_UP, LELAND_FLAG_32ND_DOWN,
  LELAND_AUGMENTATION_DOT,
  LELAND_SHARP, LELAND_FLAT, LELAND_NATURAL,
  LELAND_DOUBLE_SHARP, LELAND_DOUBLE_FLAT,
  LELAND_REST_WHOLE, LELAND_REST_HALF,
  LELAND_REST_QUARTER, LELAND_REST_EIGHTH,
  LELAND_REST_16TH, LELAND_REST_32ND, LELAND_REST_64TH,
  LELAND_FONT,
  ENGRAVING,
  smuflFontSize,
} from './glyphs/leland'
import { stemAttachX, stemAttachY } from './bravura/anchors'

// ---------------------------------------------------------------------------
// Ink color
// ---------------------------------------------------------------------------

export const INK = '#1a1a1a'

// ---------------------------------------------------------------------------
// SP constants — all in staff-spaces
// ---------------------------------------------------------------------------

/** Standard stem length (not part of a beam) */
export const STEM_LENGTH_SP = 3.5

/** Extra stem length for flags on short notes (added when note has flag) */
export const STEM_FLAG_EXTRA_SP = 0.5

/** Notehead half-width in staff-spaces (from SMuFL advance width ÷ 2) */
export const NOTEHEAD_RX_SP = 0.59   // ~1.18sp total width / 2

/** Notehead half-height in staff-spaces */
export const NOTEHEAD_RY_SP = 0.36

/**
 * Distance from notehead right edge to first augmentation dot.
 * C++: note.cpp layout2() → d = score()->point(score()->styleS(Sid::dotNoteDistance))
 * styledef.cpp:216 → Spatium(0.5)
 */
export const DOT_NOTE_GAP_SP = 0.5    // Sid::dotNoteDistance

/**
 * Center-to-center distance between consecutive augmentation dots.
 * C++: note.cpp layout2() → dd = score()->point(score()->styleS(Sid::dotDotDistance))
 * styledef.cpp:218 → Spatium(0.65)
 */
export const DOT_DOT_DIST_SP = 0.65  // Sid::dotDotDistance (replaces DOT_WIDTH_SP + DOT_DOT_GAP_SP)

/**
 * Ledger line extension past notehead edge on each side.
 * C++: styledef.cpp:198 → ledgerLineLength = Spatium(0.33)
 * Comment: "notehead width + this value"
 */
export const LEDGER_OVERRUN_SP = 0.33   // Sid::ledgerLineLength

/**
 * Distance from notehead left edge to accidental right edge.
 * C++: layoutchords.cpp:1033 → Sid::accidentalNoteDistance
 * styledef.cpp:203 → Spatium(0.25)
 */
export const ACC_NOTE_GAP_SP = 0.25    // Sid::accidentalNoteDistance

/**
 * Gap between two accidentals in the same chord column.
 * C++: layoutchords.cpp:1032 → Sid::accidentalDistance
 * styledef.cpp:202 → Spatium(0.22)
 */
export const ACC_ACC_GAP_SP = 0.22     // Sid::accidentalDistance

// ---------------------------------------------------------------------------
// Pitch → Staff Line
// ---------------------------------------------------------------------------

/**
 * CLEF_OFFSET[clef] = the staff-line value of middle C (C4) for each clef.
 * staffLine = CLEF_OFFSET - (diatonic + octave * 7)
 * staffLine 0 = top line, increases downward.
 *
 * Treble: G4 is on staff-line 2 (3rd line from top), so C4 = staffLine 10.
 * Bass:   F3 is on staff-line 2 (3rd line from top), so C4 = staffLine -2.
 */
const CLEF_OFFSET: Record<string, number> = {
  treble:     38,   // CLEF_OFFSET = 38 → C4 at line 10 (below staff)
  bass:       26,   // C4 at line -2 (above staff)
  alto:       32,   // C4 at line 4 (middle)
  tenor:      30,   // C4 at line 6
  percussion: 38,
}

const STEP_TO_DIATONIC: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6
}

/**
 * Convert a pitch (step + octave) to a staff line number for a given clef.
 * Returns a number where 0 = top staff line, 2 = 2nd line, 4 = middle, etc.
 * Odd numbers are spaces. Negative numbers are above staff (ledger lines).
 * Numbers > 8 are below staff (ledger lines).
 *
 * @param step    Pitch step: 'C'|'D'|'E'|'F'|'G'|'A'|'B'
 * @param octave  Octave number (4 = middle octave)
 * @param clef    Clef type string
 */
export function pitchToStaffLine(step: string, octave: number, clef: string): number {
  const diatonic = STEP_TO_DIATONIC[step] ?? 0
  const offset = CLEF_OFFSET[clef] ?? CLEF_OFFSET.treble
  return offset - (diatonic + octave * 7)
}

// ---------------------------------------------------------------------------
// 1.2 — Stem direction
// ---------------------------------------------------------------------------

/**
 * Compute the stem direction for a note.
 *
 * Rules (MuseScore order):
 * 1. If voice 2 → always stem down
 * 2. If voice 1 in a multi-voice context → always stem up
 * 3. Otherwise → stem up if note is on or above middle line (staffLine ≤ MIDDLE_LINE)
 *
 * @param staffLine     Staff line of the note (0 = top, 4 = middle)
 * @param voice         Voice number (1–4)
 * @param isMultiVoice  Whether this staff has multiple voices
 */
export function computeStemUp(
  staffLine: number,
  voice: number,
  isMultiVoice: boolean,
): boolean {
  if (voice === 2) return false
  if (voice === 1 && isMultiVoice) return true
  return staffLine >= MIDDLE_LINE  // on or below middle → stem up
}

// ---------------------------------------------------------------------------
// 1.1 — Notehead
// ---------------------------------------------------------------------------

export type NoteheadType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd' | '64th'
  | 'double-whole' | 'x' | 'diamond' | 'slash'

/** Returns the glyph codepoint for a notehead based on duration type */
export function noteheadGlyph(type: NoteheadType): string {
  switch (type) {
    case 'double-whole': return LELAND_NOTEHEAD_DOUBLE_WHOLE
    case 'whole':        return LELAND_NOTEHEAD_WHOLE
    case 'half':         return LELAND_NOTEHEAD_HALF
    default:             return LELAND_NOTEHEAD_BLACK
  }
}

/** Whether a notehead type has a stem */
export function hasStem(type: NoteheadType): boolean {
  return type !== 'whole' && type !== 'double-whole'
}

export interface NoteheadLayout {
  x: Px         // left edge of glyph bounding box
  y: Px         // baseline (= vertical center of notehead in Leland)
  glyph: string
  fontSize: Px
}

/**
 * Compute notehead layout given note position.
 * @param noteX      Center x of the notehead column in pixels
 * @param staffLine  Staff line of this note
 * @param staffTopPx Y of the top staff line in pixels
 * @param spatiumPx  Pixels per spatium
 * @param type       Notehead type
 */
export function layoutNotehead(
  noteX: Px,
  staffLine: number,
  staffTopPx: Px,
  spatiumPx: Px,
  type: NoteheadType,
): NoteheadLayout {
  const glyph    = noteheadGlyph(type)
  const fontSize = smuflFontSize(spatiumPx)
  const y        = lineToY(staffLine, staffTopPx, spatiumPx)
  // In Leland, glyphs are positioned with text-anchor=start.
  // Notehead center x = noteX, so glyph left edge = noteX - notehead_rx
  const x = noteX - NOTEHEAD_RX_SP * spatiumPx
  return { x, y, glyph, fontSize }
}

/**
 * Paint a notehead using the Painter.
 */
export function paintNotehead(
  painter: Painter,
  layout: NoteheadLayout,
  meta: ElementMetadata,
): void {
  painter.beginGroup(meta.noteId ?? `notehead-m${meta.measureNum}`, meta)
  painter.drawGlyph(layout.x, layout.y, layout.glyph, layout.fontSize, INK)
  painter.endGroup()
}

// ---------------------------------------------------------------------------
// 1.2 — Stem
// ---------------------------------------------------------------------------

export interface StemLayout {
  x: Px       // x of the stem center
  yTop: Px    // top of the stem
  yBottom: Px // bottom of the stem
}

/**
 * Compute stem geometry for a single note.
 * Uses Bravura anchor metadata to find exact attachment point.
 *
 * @param noteX      Center x of notehead
 * @param noteY      Center y of notehead (= staff line y)
 * @param stemUp     True if stem goes up
 * @param spatiumPx  Pixels per spatium
 * @param noteheadType  Notehead type (affects which glyph anchor to use)
 * @param hasFlag    Whether this note has a flag (slightly longer stem)
 */
export function layoutStem(
  noteX: Px,
  noteY: Px,
  stemUp: boolean,
  spatiumPx: Px,
  noteheadType: NoteheadType,
  hasFlag = false,
): StemLayout {
  const glyphName = noteheadType === 'half' ? 'noteheadHalf' : 'noteheadBlack'

  // stemAttachX returns offset from LEFT EDGE of notehead.
  // In atomicElements, noteX is the CENTER → convert to left edge first.
  const noteLeftEdge = noteX - NOTEHEAD_RX_SP * spatiumPx
  const attachDx = stemAttachX(glyphName, stemUp, spatiumPx)
  const attachDy = stemAttachY(glyphName, stemUp, spatiumPx)

  const stemX = noteLeftEdge + attachDx

  // Stem length
  const extraSp = hasFlag ? STEM_FLAG_EXTRA_SP : 0
  const stemLenPx = (STEM_LENGTH_SP + extraSp) * spatiumPx

  const stemThickHalf = (ENGRAVING.stemThickness * spatiumPx) / 2

  let yTop: Px
  let yBottom: Px

  if (stemUp) {
    // Stem starts at notehead top-left, goes up
    const stemStartY = noteY + attachDy
    yBottom = stemStartY
    yTop    = stemStartY - stemLenPx
  } else {
    // Stem starts at notehead bottom-left, goes down
    const stemStartY = noteY + attachDy
    yTop    = stemStartY
    yBottom = stemStartY + stemLenPx
  }

  return {
    x: stemX + stemThickHalf,  // center of stem line
    yTop,
    yBottom,
  }
}

/** Paint a stem */
export function paintStem(
  painter: Painter,
  layout: StemLayout,
  spatiumPx: Px,
  meta: ElementMetadata,
): void {
  const w = ENGRAVING.stemThickness * spatiumPx
  painter.drawLine(layout.x, layout.yTop, layout.x, layout.yBottom, w, INK)
}

// ---------------------------------------------------------------------------
// 1.3 — Flag (Hook)
// ---------------------------------------------------------------------------

export interface FlagLayout {
  x: Px
  y: Px
  glyph: string
  fontSize: Px
}

/** Returns flag glyph and count for a notehead type, or null if no flag */
export function flagInfo(type: NoteheadType, stemUp: boolean): { glyph: string } | null {
  switch (type) {
    case 'eighth': return { glyph: stemUp ? LELAND_FLAG_8TH_UP : LELAND_FLAG_8TH_DOWN }
    case '16th':   return { glyph: stemUp ? LELAND_FLAG_16TH_UP : LELAND_FLAG_16TH_DOWN }
    case '32nd':   return { glyph: stemUp ? LELAND_FLAG_32ND_UP : LELAND_FLAG_32ND_DOWN }
    default:       return null
  }
}

/**
 * Compute flag layout given stem tip.
 * The flag is placed at the stem tip — glyph baseline = stem tip y.
 */
export function layoutFlag(stem: StemLayout, stemUp: boolean, spatiumPx: Px, type: NoteheadType): FlagLayout | null {
  const info = flagInfo(type, stemUp)
  if (!info) return null
  return {
    x: stem.x - (ENGRAVING.stemThickness * spatiumPx) / 2,
    y: stemUp ? stem.yTop : stem.yBottom,
    glyph: info.glyph,
    fontSize: smuflFontSize(spatiumPx),
  }
}

/** Paint a flag */
export function paintFlag(
  painter: Painter,
  layout: FlagLayout,
  meta: ElementMetadata,
): void {
  painter.drawGlyph(layout.x, layout.y, layout.glyph, layout.fontSize, INK)
}

// ---------------------------------------------------------------------------
// 1.4 — Rest
// ---------------------------------------------------------------------------

export interface RestLayout {
  x: Px
  y: Px
  glyph: string
  fontSize: Px
}

/**
 * Staff line positions for rests (in staff-lines).
 * Y = staffTop + staffLine * 0.5 * spatiumPx
 */
const REST_STAFF_LINES: Record<string, number> = {
  'whole':   1,    // Whole rest hangs below 2nd line from top (staffLine = 2, offset -1)
  'half':    3,    // Half rest sits on 3rd line (staffLine = 2, placed at staffLine 3 for visual)
  'quarter': 4,    // Quarter and shorter: center of staff
  'eighth':  4,
  '16th':    4,
  '32nd':    4,
  '64th':    4,
}

/**
 * Compute rest position.
 *
 * @param staffTopPx  Y of top staff line
 * @param spatiumPx   Pixels per spatium
 * @param type        Rest duration type
 * @param voice       Voice number (voice 2 rests lower)
 * @param isMultiVoice  Multi-voice context
 * @param noteX       X position of the rest in the measure
 */
export function layoutRest(
  noteX: Px,
  staffTopPx: Px,
  spatiumPx: Px,
  type: NoteheadType,
  voice = 1,
  isMultiVoice = false,
): RestLayout {
  let staffLine = REST_STAFF_LINES[type] ?? 4

  // Multi-voice adjustment
  if (isMultiVoice) {
    if (voice === 2) staffLine += 2  // shift down
    else if (voice === 1) staffLine -= 2  // shift up
  }

  const glyph = restGlyph(type)
  const fontSize = smuflFontSize(spatiumPx)
  const y = lineToY(staffLine, staffTopPx, spatiumPx)
  // Rest x: centered on notehead column
  const x = noteX - NOTEHEAD_RX_SP * spatiumPx * 0.5

  return { x, y, glyph, fontSize }
}

function restGlyph(type: NoteheadType): string {
  switch (type) {
    case 'whole':   return LELAND_REST_WHOLE
    case 'half':    return LELAND_REST_HALF
    case 'eighth':  return LELAND_REST_EIGHTH
    case '16th':    return LELAND_REST_16TH
    case '32nd':    return LELAND_REST_32ND
    case '64th':    return LELAND_REST_64TH
    default:        return LELAND_REST_QUARTER
  }
}

/** Paint a rest */
export function paintRest(
  painter: Painter,
  layout: RestLayout,
  meta: ElementMetadata,
): void {
  painter.beginGroup(meta.noteId ?? `rest-m${meta.measureNum}`, meta)
  painter.drawGlyph(layout.x, layout.y, layout.glyph, layout.fontSize, INK)
  painter.endGroup()
}

// ---------------------------------------------------------------------------
// 1.5 — Accidental
// ---------------------------------------------------------------------------

export interface AccidentalLayout {
  x: Px
  y: Px
  glyph: string
  fontSize: Px
  widthPx: Px
  /** 0 = rightmost column, 1 = one column left, etc. Set by accidental stacking */
  xColumnOffset: number
}

/**
 * Compute base accidental position (without stacking offset).
 * Stacking offset is applied later by the chord layout algorithm.
 *
 * @param noteX      Center x of the note
 * @param noteY      Center y of the note
 * @param accType    Accidental type string
 * @param spatiumPx  Pixels per spatium
 */
export function layoutAccidental(
  noteX: Px,
  noteY: Px,
  accType: string,
  spatiumPx: Px,
): AccidentalLayout {
  const glyph = accidentalGlyph(accType)
  const fontSize = smuflFontSize(spatiumPx)

  // Width of this accidental in pixels
  const widthSp = accidentalWidthSp(accType)
  const widthPx = widthSp * spatiumPx

  // Default x: immediately left of notehead, no stacking
  const x = noteX - NOTEHEAD_RX_SP * spatiumPx - ACC_NOTE_GAP_SP * spatiumPx - widthPx

  return { x, y: noteY, glyph, fontSize, widthPx, xColumnOffset: 0 }
}

function accidentalGlyph(type: string): string {
  switch (type) {
    case 'sharp':            return LELAND_SHARP
    case 'flat':             return LELAND_FLAT
    case 'natural':          return LELAND_NATURAL
    case 'double-sharp':     return LELAND_DOUBLE_SHARP
    case 'double-flat':      return LELAND_DOUBLE_FLAT
    case 'courtesy-sharp':   return LELAND_SHARP
    case 'courtesy-flat':    return LELAND_FLAT
    case 'courtesy-natural': return LELAND_NATURAL
    default:                 return ''
  }
}

function accidentalWidthSp(type: string): number {
  const WIDTHS: Record<string, number> = {
    sharp: 1.0, flat: 0.65, natural: 0.9,
    'double-sharp': 1.1, 'double-flat': 1.4,
    'courtesy-sharp': 1.0, 'courtesy-flat': 0.65, 'courtesy-natural': 0.9,
  }
  return WIDTHS[type] ?? 1.0
}

/** Paint an accidental */
export function paintAccidental(
  painter: Painter,
  layout: AccidentalLayout,
  meta: ElementMetadata,
): void {
  if (!layout.glyph) return
  painter.drawGlyph(layout.x, layout.y, layout.glyph, layout.fontSize, INK)
}

// ---------------------------------------------------------------------------
// 1.6 — Augmentation Dots
// ---------------------------------------------------------------------------

export interface DotLayout {
  x: Px
  y: Px
  fontSize: Px
}

/**
 * Compute augmentation dot position(s).
 *
 * Rule: if note is on a staff line (staffLine is even), shift dot up by 0.5sp
 * so it lands in the space above the line.
 *
 * @param noteX      Center x of notehead
 * @param noteY      Center y of notehead
 * @param staffLine  Staff line number (0=top, even=line, odd=space)
 * @param spatiumPx  Pixels per spatium
 * @param count      Number of dots (1 or 2)
 */
export function layoutDots(
  noteX: Px,
  noteY: Px,
  staffLine: number,
  spatiumPx: Px,
  count: 1 | 2,
): DotLayout[] {
  // Vertical adjustment: note on a line → shift up into space
  const dotYAdjust = (staffLine % 2 === 0) ? -0.5 * spatiumPx : 0
  const dotY = noteY + dotYAdjust

  const fontSize = smuflFontSize(spatiumPx)
  // C++: note.cpp layout2() — xx = dotPosX + d; each subsequent dot += dd
  // dotPosX ≈ noteX + noteheadRx; d = dotNoteDistance; dd = dotDotDistance
  const dot1X = noteX + NOTEHEAD_RX_SP * spatiumPx + DOT_NOTE_GAP_SP * spatiumPx

  const result: DotLayout[] = [{ x: dot1X, y: dotY, fontSize }]

  if (count >= 2) {
    // C++: xx += dd where dd = styleMM(Sid::dotDotDistance) = 0.65sp
    const dot2X = dot1X + DOT_DOT_DIST_SP * spatiumPx
    result.push({ x: dot2X, y: dotY, fontSize })
  }

  return result
}

/** Paint augmentation dots */
export function paintDots(
  painter: Painter,
  dots: DotLayout[],
  _meta: ElementMetadata,
): void {
  for (const dot of dots) {
    painter.drawGlyph(dot.x, dot.y, LELAND_AUGMENTATION_DOT, dot.fontSize, INK)
  }
}

// ---------------------------------------------------------------------------
// 1.7 — Ledger Lines
// ---------------------------------------------------------------------------

export interface LedgerLineLayout {
  x1: Px
  x2: Px
  y: Px
  staffLine: number
}

/**
 * Compute ledger line positions for a note that is above or below the staff.
 *
 * @param noteX      Center x of notehead
 * @param staffLine  Staff line of the note
 * @param staffTopPx Y of top staff line
 * @param spatiumPx  Pixels per spatium
 */
export function layoutLedgerLines(
  noteX: Px,
  staffLine: number,
  staffTopPx: Px,
  spatiumPx: Px,
): LedgerLineLayout[] {
  const halfW = (NOTEHEAD_RX_SP + LEDGER_OVERRUN_SP) * spatiumPx
  const x1 = noteX - halfW
  const x2 = noteX + halfW

  const lines: LedgerLineLayout[] = []

  if (staffLine < 0) {
    // Above staff: draw ledger lines at -2, -4, -6, ... down to staffLine
    for (let sl = -2; sl >= staffLine; sl -= 2) {
      const y = lineToY(sl, staffTopPx, spatiumPx)
      lines.push({ x1, x2, y, staffLine: sl })
    }
  } else if (staffLine > 8) {
    // Below staff: draw ledger lines at 10, 12, 14, ... up to staffLine
    for (let sl = 10; sl <= staffLine; sl += 2) {
      const y = lineToY(sl, staffTopPx, spatiumPx)
      lines.push({ x1, x2, y, staffLine: sl })
    }
  }

  return lines
}

/** Paint ledger lines */
export function paintLedgerLines(
  painter: Painter,
  lines: LedgerLineLayout[],
  spatiumPx: Px,
  _meta: ElementMetadata,
): void {
  const w = ENGRAVING.legerLineThickness * spatiumPx
  for (const line of lines) {
    painter.drawLine(line.x1, line.y, line.x2, line.y, w, INK)
  }
}

// ---------------------------------------------------------------------------
// 1.7b — Staff Lines
// ---------------------------------------------------------------------------

/**
 * Paint the 5 staff lines for a staff.
 * @param staffTopPx  Y of top staff line
 * @param x1          Left edge of staff
 * @param x2          Right edge of staff
 * @param spatiumPx   Pixels per spatium
 */
export function paintStaffLines(
  painter: Painter,
  staffTopPx: Px,
  x1: Px,
  x2: Px,
  spatiumPx: Px,
  measureNum: number,
  staffIndex: number,
): void {
  const w = ENGRAVING.staffLineThickness * spatiumPx
  for (let i = 0; i < 5; i++) {
    const y = staffTopPx + i * spatiumPx
    painter.drawLine(x1, y, x2, y, w, INK)
  }
}
