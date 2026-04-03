/**
 * spatium.ts — Spatium unit system
 *
 * All layout engine coordinates are in Spatium units (Sp).
 * "Spatium" = the distance between two adjacent staff lines.
 * Conversion to pixels happens only at paint time: px = sp * spatiumPx
 *
 * MuseScore default: 1 spatium = 1.75mm at 96dpi ≈ 6.6px
 * Our renderer default (360dpi): 1 spatium = 24.8px
 */

/** Staff-space units (spatium). Used in layout calculations. */
export type Sp = number

/** Pixel units. Used in final output / painting. */
export type Px = number

/** Default spatium in mm (MuseScore standard) */
export const DEFAULT_SPATIUM_MM = 1.75

/**
 * Convert spatium units to pixels.
 * @param sp      Value in spatium units
 * @param spatiumPx  Pixels per spatium for this rendering
 */
export function spToPx(sp: Sp, spatiumPx: Px): Px {
  return sp * spatiumPx
}

/**
 * Convert pixels to spatium units.
 * @param px      Value in pixels
 * @param spatiumPx  Pixels per spatium for this rendering
 */
export function pxToSp(px: Px, spatiumPx: Px): Sp {
  return px / spatiumPx
}

/**
 * Convert a staff line number to a Y pixel coordinate.
 *
 * Staff lines are numbered from 0 (top line) downward.
 * Lines:  0, 2, 4, 6, 8  (the 5 staff lines)
 * Spaces: 1, 3, 5, 7     (between lines)
 * Ledger above:  -2, -4, ...
 * Ledger below:  10, 12, ...
 *
 * @param staffLine   Staff line number (0 = top line, increases downward)
 * @param staffTopPx  Y-coordinate of the top staff line in pixels
 * @param spatiumPx   Pixels per spatium
 */
export function lineToY(staffLine: number, staffTopPx: Px, spatiumPx: Px): Px {
  return staffTopPx + staffLine * spatiumPx * 0.5
}

/**
 * The height of a 5-line staff in spatium units.
 * (4 intervals between 5 lines × 1sp each)
 */
export const STAFF_HEIGHT_SP: Sp = 4.0

/**
 * The middle staff line number (B4 in treble clef).
 * Notes on or above this line get stem-up, below get stem-down.
 */
export const MIDDLE_LINE = 4
