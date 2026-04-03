/**
 * MAP Native Renderer — engine/layout/LayoutChords.ts
 * C++ source: src/engraving/layout/layoutchords.cpp
 *
 * Mirrors:
 *   LayoutChords::layoutChords1()  — segment-level note cluster detection
 *   LayoutChords::layoutChords2()  — notehead x-offset for 2nd intervals
 *   LayoutChords::layoutChords3()  — accidental + dot placement
 *
 * Scope: given a set of notes at the same horizontal position (a "segment"),
 * compute their final x-offsets and accidental column positions.
 *
 * NOT YET IMPLEMENTED: full accidental stacking for chords spanning > 1 octave
 * (the zig-zag column algorithm in layoutchords.cpp:1036–1200+).
 * Current implementation handles the simple case: each accidental gets its own
 * column, placed right-to-left.
 */

import { Sid } from '../../style/StyleDef'
import { NOTEHEAD_RX_SP } from '../libmscore/Note'

// ─────────────────────────────────────────────────────────────────────────────
// Constants (from layoutchords.cpp + styledef.cpp)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accidental-to-note gap.
 * C++: layoutchords.cpp:1033 — pnd = style.styleMM(Sid::accidentalNoteDistance)
 * styledef.cpp:203 → Spatium(0.25)
 */
export const ACC_NOTE_DIST_SP: number = Sid.accidentalNoteDistance   // 0.25

/**
 * Accidental-to-accidental gap (vertical clearance between columns).
 * C++: layoutchords.cpp:1032 — pd = style.styleMM(Sid::accidentalDistance)
 * styledef.cpp:202 → Spatium(0.22)
 */
export const ACC_ACC_DIST_SP: number = Sid.accidentalDistance        // 0.22

/**
 * Spacing multiplier applied to minNoteDistance when computing note spacing.
 * C++: measure.cpp:4174 — static constexpr double spacingMultiplier = 1.2
 */
export const SPACING_MULTIPLIER = 1.2

/**
 * Minimum note-to-note distance.
 * C++: styledef.cpp:184 → { Sid::minNoteDistance, "minNoteDistance", PropertyValue(Spatium(0.5)) }
 */
export const MIN_NOTE_DIST_SP: number = Sid.minNoteDistance          // 0.5

// ─────────────────────────────────────────────────────────────────────────────
// Accidental input type (simplified view of what LayoutChords3 needs)
// ─────────────────────────────────────────────────────────────────────────────

export interface AccidentalInput {
  /** Staff-line position (0=top, 8=bottom, negative/above 8=ledger) */
  staffLine: number
  /** Width of this accidental glyph in sp */
  widthSp: number
  /** Height span: [topSp, bottomSp] relative to the note's y (in staff-spaces) */
  topSp: number
  bottomSp: number
}

export interface AccidentalXResult {
  /** X offset from notehead left edge (negative = to the left of the note) */
  xFromNoteSp: number
  /** Column index (0=closest to note, 1=one further left, etc.) */
  column: number
}

// ─────────────────────────────────────────────────────────────────────────────
// layoutChords3 — accidental column placement (simplified)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simplified accidental placement for chords.
 *
 * C++: layoutchords.cpp:804–1200+
 * Full algorithm: zig-zag column assignment based on octave pitch classes.
 * Simplified version (< 1 octave span): place each accidental in its own column,
 * greedily fitting into the rightmost column that has no vertical conflict.
 *
 * C++: layoutchords.cpp:1032–1033
 *   pd  = style.styleMM(Sid::accidentalDistance)     // col-to-col gap
 *   pnd = style.styleMM(Sid::accidentalNoteDistance) // note-to-acc gap
 *
 * Column x formula (C++ layoutchords.cpp ≈ line 1170+):
 *   x = -pnd - accWidth - (col * (maxAccWidth + pd))
 *   where: x is relative to the LEFT EDGE of the notehead (i.e., noteX - noteheadWidth)
 *
 * @param accs  Accidentals sorted top-to-bottom (ascending staff-line, i.e. lowest line number first)
 * @param sp    Spatium in pixels
 * @returns     Array of x-offsets from the notehead left edge (noteX - noteheadRx), in pixels
 */
export function layoutChords3Accidentals(
  accs: AccidentalInput[],
  sp: number,
): number[] {
  if (accs.length === 0) return []

  const pnd = ACC_NOTE_DIST_SP * sp   // note-to-accidental gap
  const pd  = ACC_ACC_DIST_SP * sp    // accidental-to-accidental gap

  // Each column tracks the vertical extent [top, bottom] of accidentals placed so far
  // (all values in pixels, relative to staff top)
  const columns: Array<{ top: number; bottom: number; width: number }> = []

  const result: number[] = new Array(accs.length).fill(0)

  for (let i = 0; i < accs.length; i++) {
    const acc = accs[i]
    const accWidthPx = acc.widthSp * sp
    const accTopPx   = acc.topSp  * sp
    const accBottomPx = acc.bottomSp * sp

    // Try to place in an existing column (rightmost first)
    let placed = false
    for (let col = 0; col < columns.length; col++) {
      const colEntry = columns[col]
      // Check vertical conflict: need pd gap between this acc and all others in this column
      if (accTopPx - colEntry.bottom >= pd && colEntry.top - accBottomPx >= pd
        || columns.length === 0) {
        // No conflict: place here
        colEntry.top    = Math.min(colEntry.top, accTopPx)
        colEntry.bottom = Math.max(colEntry.bottom, accBottomPx)
        colEntry.width  = Math.max(colEntry.width, accWidthPx)

        // x from left edge of notehead (negative = to the left)
        // column 0: directly left of note, column 1: further left, etc.
        let xOffset = -pnd - accWidthPx
        for (let c = 0; c < col; c++) {
          xOffset -= columns[c].width + pd
        }
        result[i] = xOffset
        placed = true
        break
      }
    }

    if (!placed) {
      // Create a new column further left
      const col = columns.length
      columns.push({ top: accTopPx, bottom: accBottomPx, width: accWidthPx })

      let xOffset = -pnd - accWidthPx
      for (let c = 0; c < col; c++) {
        xOffset -= columns[c].width + pd
      }
      result[i] = xOffset
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// layoutChords2 — notehead x-offset for second intervals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect whether a note in a chord needs to be mirrored (flipped to other side of stem).
 *
 * C++: layoutchords.cpp:534 — LayoutChords::layoutChords2()
 * Rule: when two notes are a second (1 staff-line) apart and both on the same stem,
 * the lower note (for stem-up) or upper note (for stem-down) must be displaced to
 * the other side of the stem.
 *
 * Returns: true if this note should be placed to the right of the stem (stem-up chord)
 * or to the left of the stem (stem-down chord).
 */
export function noteNeedsMirror(
  staffLine: number,
  adjacentLine: number,
  stemUp: boolean,
): boolean {
  const interval = Math.abs(staffLine - adjacentLine)
  if (interval !== 1) return false
  // C++: layoutchords.cpp - lower note of a 2nd interval is mirrored for stem-up
  return stemUp ? staffLine > adjacentLine : staffLine < adjacentLine
}

// ─────────────────────────────────────────────────────────────────────────────
// Dot position adjustment (part of layoutChords3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine dot y-adjustment for notes on a line.
 *
 * C++: layoutchords.cpp:957–987 — note->setDotY()
 * Rule: if the note is on a staff line (staffLine is even), the dot moves up into the space.
 * Exception: if an adjacent note (1 step away) claims the same space, dot moves down.
 *
 * Simplified (no multi-note conflict detection):
 *   - even staffLine (on a line) → shift up by 0.5sp
 *   - odd staffLine (in a space) → no shift
 */
export function dotYAdjust(staffLine: number, _sp: number): number {
  // C++: line & 1 == 0 means "on a line" → dot moves up
  return (staffLine % 2 === 0) ? -0.5 : 0  // in staff-spaces
}
