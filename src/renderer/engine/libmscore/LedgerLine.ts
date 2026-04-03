/**
 * MAP Native Renderer — engine/libmscore/LedgerLine.ts
 * C++ source: src/engraving/libmscore/ledgerline.cpp
 *             src/engraving/libmscore/chord.cpp (addLedgerLines)
 *
 * Mirrors LedgerLine::layout() and Chord::addLedgerLines().
 */

import type { Px } from '../../spatium'
import { lineToY } from '../../spatium'
import { Sid } from '../../style/StyleDef'
import { NOTEHEAD_RX_SP } from './Note'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extra length of ledger line on each side of the notehead.
 * C++: chord.cpp:851 — double extraLen = score()->styleMM(Sid::ledgerLineLength) * mag
 * styledef.cpp:198 → Spatium(0.33) [read as mm but treated as sp in the formula context]
 *
 * NOTE: In MuseScore, ledgerLineLength is stored as Spatium(0.33) but accessed via styleMM().
 * styleMM() multiplies the Spatium value by spatium(). So extraLen = 0.33 * spatium.
 * This is the OVERHANG on each side — total ledger line width = noteheadWidth + 2 * extraLen.
 */
export const LEDGER_OVERRUN_SP: number = Sid.ledgerLineLength   // 0.33

/**
 * Ledger line thickness.
 * C++: ledgerline.cpp:82 — setLineWidth(score()->styleMM(Sid::ledgerLineWidth) * chord()->mag())
 * styledef.cpp:200 → Spatium(0.16)
 */
export const LEDGER_LINE_WIDTH_SP = 0.16   // Sid::ledgerLineWidth, styledef.cpp:200

// ─────────────────────────────────────────────────────────────────────────────
// Ledger line layout
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerLineLayout {
  x1: Px
  x2: Px
  y: Px
  staffLine: number
}

/**
 * Compute ledger line positions for a note outside the staff.
 *
 * C++: chord.cpp:845–968 — Chord::addLedgerLines()
 *   lineBelow = (st->lines(tick) - 1) * 2  [= 8 for 5-line staff]
 *   needsLedger: downLine + stepOffset > lineBelow+1  OR  upLine + stepOffset < -1
 *   extraLen = styleMM(Sid::ledgerLineLength) * mag  [overhang each side]
 *   hw = note->headWidth()  [= 2 * NOTEHEAD_RX_SP * sp]
 *   x1 = noteX - hw/2 - extraLen
 *   x2 = x1 + hw + 2 * extraLen  [= noteX - hw/2 - extraLen + hw + 2*extraLen = noteX + hw/2 + extraLen]
 *
 * Ledger lines are drawn at even staff-line numbers only (l = l & ~1 rounds down to even).
 *
 * @param noteX      Center x of notehead
 * @param staffLine  Staff line of the note (0=top line, 8=bottom line)
 * @param staffTopPx Y of top staff line
 * @param sp         Spatium in pixels
 */
export function layoutLedgerLines(
  noteX: Px,
  staffLine: number,
  staffTopPx: Px,
  sp: Px,
): LedgerLineLayout[] {
  // C++: chord.cpp:896 — hw = std::max(hw, note->headWidth())
  //      ledger extends from (noteX - hw/2 - extraLen) to (noteX + hw/2 + extraLen)
  const halfW = (NOTEHEAD_RX_SP + LEDGER_OVERRUN_SP) * sp
  const x1 = noteX - halfW
  const x2 = noteX + halfW

  const lines: LedgerLineLayout[] = []

  if (staffLine < 0) {
    // Above staff: even lines from -2 down to staffLine (rounded to even)
    // C++: chord.cpp:887–889 — if (l < 0) l = (l + 1) & ~1
    const lowestLedger = (staffLine + 1) & ~1  // round toward 0
    for (let sl = -2; sl >= lowestLedger; sl -= 2) {
      lines.push({ x1, x2, y: lineToY(sl, staffTopPx, sp), staffLine: sl })
    }
  } else if (staffLine > 8) {
    // Below staff: even lines from 10 up to staffLine (rounded to even)
    // C++: chord.cpp:890–891 — if (l >= 0) l = l & ~1
    const highestLedger = staffLine & ~1  // round toward 0
    for (let sl = 10; sl <= highestLedger; sl += 2) {
      lines.push({ x1, x2, y: lineToY(sl, staffTopPx, sp), staffLine: sl })
    }
  }

  return lines
}
