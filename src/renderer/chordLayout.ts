/**
 * chordLayout.ts — Chord-level layout algorithms
 *
 * Implements MuseScore's LayoutChords1/2/3:
 *   1. LayoutChords1: identify note clusters, decide notehead flip
 *   2. LayoutChords2: apply notehead x-offsets for up/down voices
 *   3. LayoutChords3: stack accidentals horizontally without collision
 *
 * Source: src/engraving/layout/layoutchords.cpp
 * All distances in staff-spaces (Sp), converted to px when needed.
 */

import type { Px } from './spatium'
import {
  NOTEHEAD_RX_SP,
  ACC_NOTE_GAP_SP,
  ACC_ACC_GAP_SP,
} from './atomicElements'

// ---------------------------------------------------------------------------
// Input types for chord layout
// ---------------------------------------------------------------------------

export interface ChordNote {
  /** Staff line (0 = top, increases downward) */
  staffLine: number
  /** Note center x before chord-layout adjustment */
  noteX: Px
  /** Stem direction for this note */
  stemUp: boolean
  /** Accidental type, if any */
  accidental?: string
  /** Output: x offset applied after layout */
  xOffset?: Px
  /** Output: accidental x offset column (0 = rightmost) */
  accidentalColumn?: number
}

// ---------------------------------------------------------------------------
// 2.1 — LayoutChords1: Notehead cluster detection
// ---------------------------------------------------------------------------

/**
 * Detect note clusters within a chord and assign x-offsets.
 *
 * A cluster occurs when two notes are adjacent (staffLine differs by ≤ 1),
 * meaning they share the same space/line or are an interval of a 2nd.
 *
 * MuseScore rule:
 * - Up-stem notes are on the LEFT of the stem (standard position)
 * - Down-stem notes are on the LEFT of the stem (standard position)
 * - When up-stem and down-stem notes overlap (cluster), one set is displaced:
 *   - Down-stem note moves RIGHT by one notehead width
 *
 * @param notes  All notes in the chord (sorted by staffLine ascending)
 * @param spatiumPx  Pixels per spatium
 */
export function layoutChords1(notes: ChordNote[], spatiumPx: Px): void {
  // Reset offsets
  for (const n of notes) n.xOffset = 0

  if (notes.length <= 1) return

  const nominalWidthPx = NOTEHEAD_RX_SP * 2 * spatiumPx  // full notehead width

  // Separate into up-stem and down-stem groups
  const upNotes   = notes.filter(n => n.stemUp).sort((a, b) => a.staffLine - b.staffLine)
  const downNotes = notes.filter(n => !n.stemUp).sort((a, b) => b.staffLine - a.staffLine)

  // --- Single voice: detect 2nd interval within same stem direction ---
  // Up-stem cluster: adjacent notes of interval ≤ 1 → flip higher note right
  detectAndFlipCluster(upNotes, nominalWidthPx, true)
  detectAndFlipCluster(downNotes, nominalWidthPx, false)

  // --- Two voices: detect cross-direction cluster ---
  // If up and down notes are within 1 staff-line of each other, shift down notes right
  if (upNotes.length > 0 && downNotes.length > 0) {
    const upBottom   = Math.max(...upNotes.map(n => n.staffLine))
    const downTop    = Math.min(...downNotes.map(n => n.staffLine))
    if (Math.abs(upBottom - downTop) <= 1) {
      // Shift all down-stem notes to the right by one notehead width
      for (const n of downNotes) {
        n.xOffset = (n.xOffset ?? 0) + nominalWidthPx
      }
    }
  }
}

/**
 * Within a single-direction group, flip notes that form a 2nd interval.
 * MuseScore: the upper note of a 2nd is pushed to the right of the stem.
 */
function detectAndFlipCluster(
  notes: ChordNote[],  // sorted by staffLine
  nominalWidthPx: Px,
  stemUp: boolean,
): void {
  if (notes.length < 2) return

  let flipNext = false
  for (let i = 0; i < notes.length - 1; i++) {
    const interval = Math.abs(notes[i + 1].staffLine - notes[i].staffLine)
    if (interval <= 1) {
      // These two notes form a unison or 2nd — flip the upper one
      if (stemUp) {
        // For up-stem: flip the higher note (lower staffLine = higher pitch) to the right
        if (!flipNext) {
          notes[i].xOffset = (notes[i].xOffset ?? 0) + nominalWidthPx
          flipNext = true
        } else {
          flipNext = false
        }
      } else {
        // For down-stem: flip the lower note (higher staffLine = lower pitch) to the right
        if (!flipNext) {
          notes[i + 1].xOffset = (notes[i + 1].xOffset ?? 0) + nominalWidthPx
          flipNext = true
        } else {
          flipNext = false
        }
      }
    } else {
      flipNext = false
    }
  }
}

// ---------------------------------------------------------------------------
// 2.3 — LayoutChords3: Accidental stacking
// ---------------------------------------------------------------------------

export interface AccidentalSlot {
  noteIndex: number
  staffLine: number
  accType: string
  top: number      // staffLine - accHeightSp/2 (top extent in staff-lines)
  bot: number      // staffLine + accHeightSp/2 (bottom extent in staff-lines)
  column: number   // 0 = rightmost, increases leftward
}

// Accidental heights in staff-spaces (for overlap detection)
const ACC_HEIGHTS_SP: Record<string, number> = {
  sharp:               2.8,
  flat:                3.2,
  natural:             2.8,
  'double-sharp':      1.4,
  'double-flat':       3.2,
  'courtesy-sharp':    2.8,
  'courtesy-flat':     3.2,
  'courtesy-natural':  2.8,
}

// Accidental widths in staff-spaces (for x computation)
const ACC_WIDTHS_SP: Record<string, number> = {
  sharp:               1.0,
  flat:                0.65,
  natural:             0.9,
  'double-sharp':      1.1,
  'double-flat':       1.4,
  'courtesy-sharp':    1.0,
  'courtesy-flat':     0.65,
  'courtesy-natural':  0.9,
}

/**
 * Compute accidental column assignments for all notes in a chord.
 *
 * Algorithm (MuseScore LayoutChords3):
 * 1. Sort notes with accidentals by staffLine (ascending = top to bottom)
 * 2. Assign each accidental to the rightmost column that doesn't overlap vertically
 * 3. Column 0 = closest to notehead, column N = furthest left
 *
 * @param notes  All notes in the chord (with accidental field set)
 * @returns      Array of AccidentalSlot, one per note that has an accidental
 */
export function layoutAccidentals(notes: ChordNote[]): AccidentalSlot[] {
  const notesWithAcc = notes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => !!n.accidental)
    .sort((a, b) => a.n.staffLine - b.n.staffLine)  // top to bottom

  if (notesWithAcc.length === 0) return []

  // columns[c] = list of already-placed accidentals in column c
  // Each entry tracks [top, bot] in staff-lines
  const columns: Array<Array<{ top: number; bot: number }>> = []

  const slots: AccidentalSlot[] = []

  for (const { n, i } of notesWithAcc) {
    const accType = n.accidental!
    const heightSp = ACC_HEIGHTS_SP[accType] ?? 2.8
    const top = n.staffLine - heightSp / 2
    const bot = n.staffLine + heightSp / 2

    // Find the rightmost column (smallest index) that fits
    let placed = false
    for (let col = 0; col < columns.length; col++) {
      const colItems = columns[col]
      const lastItem = colItems[colItems.length - 1]
      // Check if this accidental fits above the last one in this column
      // (we work top-to-bottom, so check no overlap)
      if (top >= lastItem.bot + ACC_ACC_GAP_SP) {
        colItems.push({ top, bot })
        slots.push({ noteIndex: i, staffLine: n.staffLine, accType, top, bot, column: col })
        n.accidentalColumn = col
        placed = true
        break
      }
    }

    if (!placed) {
      // Start a new column to the left
      const col = columns.length
      columns.push([{ top, bot }])
      slots.push({ noteIndex: i, staffLine: n.staffLine, accType, top, bot, column: col })
      n.accidentalColumn = col
    }
  }

  return slots
}

/**
 * Compute the final x position of an accidental given its column assignment.
 *
 * accX = noteX - noteheadRxPx - ACC_NOTE_GAP_SP*sp
 *        - sum of widths of columns to the right (0..column-1)
 *        - ACC_ACC_GAP_SP * column * sp
 *        - width of this column's accidental
 *
 * Simple version: each column has the same max width (largest accidental in the group).
 *
 * @param noteX       Center x of the note
 * @param column      Column assignment (0 = rightmost)
 * @param accType     Accidental type for this note
 * @param maxAccWidthSp  Width of the widest accidental in the chord (sp)
 * @param spatiumPx   Pixels per spatium
 */
export function accidentalXForColumn(
  noteX: Px,
  column: number,
  accType: string,
  maxAccWidthSp: number,
  spatiumPx: Px,
): Px {
  const accWidthSp  = ACC_WIDTHS_SP[accType] ?? 1.0
  const colStrideSp = maxAccWidthSp + ACC_ACC_GAP_SP

  // x = right edge of this accidental
  // right edge = noteX - noteheadRx - ACC_NOTE_GAP - (column * colStride)
  const rightEdge =
    noteX
    - NOTEHEAD_RX_SP * spatiumPx
    - ACC_NOTE_GAP_SP * spatiumPx
    - column * colStrideSp * spatiumPx

  // left edge = right edge - accWidth
  return rightEdge - accWidthSp * spatiumPx
}

/**
 * Compute maximum accidental width in staff-spaces for a set of accidental types.
 */
export function maxAccWidthSp(accTypes: string[]): number {
  return Math.max(0, ...accTypes.map(t => ACC_WIDTHS_SP[t] ?? 1.0))
}

// ---------------------------------------------------------------------------
// 2.4 — Chord BBox
// ---------------------------------------------------------------------------

export interface ChordBBox {
  left: Px
  right: Px
  top: Px
  bottom: Px
}

/**
 * Compute the bounding box of a complete chord including:
 * - All noteheads
 * - Stem
 * - Accidentals
 * - Augmentation dots
 * - Ledger lines
 */
export function computeChordBBox(params: {
  noteX: Px
  stemXPx: Px
  stemTopPx: Px
  stemBottomPx: Px
  spatiumPx: Px
  hasAccidentals: boolean
  accMinX?: Px
  dotsMaxX?: Px
}): ChordBBox {
  const { noteX, stemXPx, stemTopPx, stemBottomPx, spatiumPx } = params

  const noteheadLeft  = noteX - NOTEHEAD_RX_SP * spatiumPx
  const noteheadRight = noteX + NOTEHEAD_RX_SP * spatiumPx

  const left  = params.hasAccidentals && params.accMinX !== undefined
    ? Math.min(noteheadLeft, params.accMinX)
    : noteheadLeft

  const right = params.dotsMaxX !== undefined
    ? Math.max(noteheadRight, params.dotsMaxX)
    : noteheadRight

  const top    = Math.min(stemTopPx, stemBottomPx)  // stem extends above note
  const bottom = Math.max(stemTopPx, stemBottomPx)

  return { left, right, top, bottom }
}
