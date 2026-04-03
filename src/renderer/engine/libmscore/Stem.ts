/**
 * MAP Native Renderer — engine/libmscore/Stem.ts
 * C++ source: src/engraving/libmscore/stem.cpp
 *             src/engraving/libmscore/chord.cpp (calcDefaultStemLength)
 *
 * Mirrors Stem::layout() and Chord::calcDefaultStemLength().
 */

import type { Px } from '../../spatium'
import { Sid } from '../../style/StyleDef'

// ─────────────────────────────────────────────────────────────────────────────
// Constants (from styledef.cpp)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default stem length in staff-spaces.
 * C++: styledef.cpp:177 — { Sid::stemLength, "stemLength", PropertyValue(3.5) }
 * C++: chord.cpp:1627 — defaultStemLength = score()->styleD(Sid::stemLength) * 4  (quarter-spaces)
 */
export const STEM_LENGTH_SP: number = Sid.stemLength           // 3.5

/**
 * Stem width (line thickness).
 * C++: styledef.cpp:175 — { Sid::stemWidth, "stemWidth", PropertyValue(0.10) }
 */
export const STEM_WIDTH_SP: number = Sid.stemWidth             // 0.10

// ─────────────────────────────────────────────────────────────────────────────
// Stem layout
// ─────────────────────────────────────────────────────────────────────────────

export interface StemLayout {
  /** X-center of the stem line */
  x: Px
  /** Y of the tip (farthest from the notehead) */
  yTip: Px
  /** Y of the base (at the notehead attach point) */
  yBase: Px
}

/**
 * Compute stem geometry for a chord.
 *
 * Simplified from Chord::calcDefaultStemLength() + Stem::layout():
 *
 * C++ chord.cpp:1627 — defaultStemLength = styleD(Sid::stemLength) * 4  [quarter-spaces]
 * C++ chord.cpp:1692 — finalStemLength = (chordHeight/4.0*spatium) + (stemLength/4.0*spatium)
 * C++ stem.cpp:74    — y2 = _up * (m_baseLength + m_userLength)  [relative to attach point]
 *
 * For MAP (single-note chord, no beam), chordHeight = 0, relativeMag = 1.0:
 *   finalStemLength = stemLength / 4.0 * spatium = 3.5 * spatium
 *
 * Extra length when flag present:
 * C++: chord.cpp:1487 — stemLengthBeamAddition() handles beam offsets.
 * Flags add ~0.5sp empirically (flag anchor y ≈ 0.5sp beyond stem tip).
 *
 * @param noteX      Center x of notehead
 * @param noteY      Center y of notehead (= yBase of stem attachment)
 * @param stemUp     True if stem points upward
 * @param sp         Spatium in pixels
 * @param hasFlag    Whether this note has a flag (no beam)
 * @param attachDx   X offset from note center to stem edge (from Bravura anchor)
 * @param attachDy   Y offset from note center to stem base (from Bravura anchor)
 */
export function layoutStem(
  noteX: Px,
  noteY: Px,
  stemUp: boolean,
  sp: Px,
  hasFlag: boolean,
  attachDx: number,
  attachDy: number,
): StemLayout {
  // C++: stem.cpp:108 — setPosY(note->ypos())
  //      stem.cpp:103–106 — y1 = note->stemUpSE().y() OR note->stemDownNW().y()
  const stemX = noteX + attachDx
  const yBase = noteY + attachDy

  // C++: chord.cpp:1627 — defaultStemLength = styleD(Sid::stemLength) * 4 quarter-spaces
  //      chord.cpp:1692 — finalStemLength = stemLength/4.0 * spatium (for single note, no chord spread)
  const baseLengthPx = STEM_LENGTH_SP * sp

  // Flags add a small extra: stem.cpp:112 — y2 += chord()->hook()->smuflAnchor().y()
  const extraPx = hasFlag ? 0.5 * sp : 0

  const totalLength = baseLengthPx + extraPx

  const yTip = stemUp
    ? yBase - totalLength   // up: tip is above base
    : yBase + totalLength   // down: tip is below base

  return { x: stemX, yTip, yBase }
}
