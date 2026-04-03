/**
 * MAP Native Renderer — engine/layout/LayoutBeams.ts
 * C++ source: src/engraving/layout/layoutbeams.cpp
 *             src/engraving/libmscore/beam.cpp
 *
 * Mirrors:
 *   LayoutBeams::createBeams()        — layoutbeams.cpp:277
 *   LayoutBeams::layoutNonCrossBeams() — layoutbeams.cpp:481
 *   Beam::layout2()                   — beam.cpp:1437
 *   Beam::computeDesiredSlant()       — beam.cpp:505
 *   Beam::getMaxSlope()               — beam.cpp:613
 *
 * Scope: given a list of beamed chords, compute beam geometry —
 * anchor points, slope, and secondary beam positions.
 */

import { Sid } from '../../style/StyleDef'

// ─────────────────────────────────────────────────────────────────────────────
// Constants (from styledef.cpp + beam.h)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Width of a beam stroke in spatium units.
 * C++: styledef.cpp:209 — { Sid::beamWidth, "beamWidth", PropertyValue(Spatium(0.5)) }
 */
export const BEAM_WIDTH_SP: number = Sid.beamWidth   // 0.5

/**
 * Minimum beam length (end-to-end) in spatium units.
 * C++: styledef.cpp:211 — { Sid::beamMinLen, "beamMinLen", PropertyValue(Spatium(1.1)) }
 */
export const BEAM_MIN_LEN_SP: number = Sid.beamMinLen   // 1.1

/**
 * Default beam inter-beam spacing, in quarter-spaces.
 * C++: beam.h:69  — int _beamSpacing { 3 };
 * C++: beam.cpp:1461 — _beamSpacing = score()->styleB(Sid::useWideBeams) ? 4 : 3;
 * With useWideBeams=false (default): spacing = 3 quarter-spaces = 0.75sp
 */
export const BEAM_SPACING_QS = 3   // quarter-spaces; 4 if Sid::useWideBeams

/**
 * _beamDist in pixels = (beamSpacing / 4.0) * spatium * mag
 * C++: beam.cpp:1462 — _beamDist = (_beamSpacing / 4.0) * spatium() * mag()
 */
export function beamDistPx(sp: number, mag = 1.0): number {
  return (BEAM_SPACING_QS / 4.0) * sp * mag
}

/**
 * Max slope table indexed by interval (in staff lines).
 * C++: beam.h:238 — static constexpr std::array _maxSlopes = { 0, 1, 2, 3, 4, 5, 6, 7 }
 * Usage: _maxSlopes[interval] — where interval = abs(startNote - endNote)
 */
export const MAX_SLOPES = [0, 1, 2, 3, 4, 5, 6, 7] as const

// ─────────────────────────────────────────────────────────────────────────────
// Beam geometry input/output types
// ─────────────────────────────────────────────────────────────────────────────

export interface BeamChord {
  /** X center of the stem tip (anchor) in pixels */
  stemTipX: number
  /** Y of the stem tip (anchor) in pixels — set BEFORE beam layout */
  stemTipY: number
  /** Staff line of the note used for slope: upNote.line (stem-up) or downNote.line (stem-down) */
  noteLine: number
  /** Number of beams on this chord (1=8th, 2=16th, 3=32nd, ...) */
  beamCount: number
  /** Stem direction */
  stemUp: boolean
}

export interface BeamGeometry {
  /** Y of the primary beam at the start chord's stem in pixels */
  startY: number
  /** Y of the primary beam at the end chord's stem in pixels */
  endY: number
  /** Slope in px/px (Δy/Δx), positive = ascending (in screen coords, positive = descending) */
  slope: number
  /** beam width in pixels */
  beamWidthPx: number
  /** distance between beam levels in pixels */
  beamDistPx: number
}

// ─────────────────────────────────────────────────────────────────────────────
// getMaxSlope — beam.cpp:613
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Max slope based on the horizontal distance between the first and last chords.
 *
 * C++: beam.cpp:613–640 — Beam::getMaxSlope()
 *   beamWidth = (endX - startX) / spatium
 *   if beamWidth < 3.0  → _maxSlopes[1]
 *   if beamWidth < 5.0  → _maxSlopes[2]
 *   if beamWidth < 7.5  → _maxSlopes[3]
 *   if beamWidth < 10.0 → _maxSlopes[4]
 *   if beamWidth < 15.0 → _maxSlopes[5]
 *   if beamWidth < 20.0 → _maxSlopes[6]
 *   else                → _maxSlopes[7]
 *
 * @param startX   x of first chord stem (pixels)
 * @param endX     x of last chord stem (pixels)
 * @param sp       spatium in pixels
 */
export function getMaxSlope(startX: number, endX: number, sp: number): number {
  const beamWidth = (endX - startX) / sp
  if (beamWidth < 3.0)  return MAX_SLOPES[1]
  if (beamWidth < 5.0)  return MAX_SLOPES[2]
  if (beamWidth < 7.5)  return MAX_SLOPES[3]
  if (beamWidth < 10.0) return MAX_SLOPES[4]
  if (beamWidth < 15.0) return MAX_SLOPES[5]
  if (beamWidth < 20.0) return MAX_SLOPES[6]
  return MAX_SLOPES[7]
}

// ─────────────────────────────────────────────────────────────────────────────
// computeBeamSlope — beam.cpp:505 (computeDesiredSlant)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the desired slope (in quarter-space units) for a beam.
 *
 * C++: beam.cpp:505–538 — Beam::computeDesiredSlant()
 *   1. If noSlope (flat beams forced) → 0
 *   2. If startNote == endNote → 0
 *   3. If slopeConstrained == 0 (extreme middle note) → 0
 *   4. If slopeConstrained == 1 (neighbor same height) → ±1
 *   5. Otherwise: min(getMaxSlope(), _maxSlopes[interval]) * sign
 *
 * Simplified (MAP): we implement steps 2 and 5 only.
 * Full slope-constraint logic (isSlopeConstrained) is not yet implemented.
 *
 * @param startLine  staff line of the note at beam start (0=top)
 * @param endLine    staff line of the note at beam end
 * @param startX     x of first chord (pixels) — for getMaxSlope
 * @param endX       x of last chord (pixels)
 * @param stemUp     true if beam is above notes
 * @param sp         spatium in pixels
 * @returns          slope in quarter-space units (positive = ascending in staff)
 */
export function computeBeamSlope(
  startLine: number,
  endLine: number,
  startX: number,
  endX: number,
  stemUp: boolean,
  sp: number,
): number {
  if (startLine === endLine) return 0

  const interval = Math.min(Math.abs(endLine - startLine), MAX_SLOPES.length - 1)
  const maxSlopeByDist = getMaxSlope(startX, endX, sp)
  const slant = Math.min(maxSlopeByDist, MAX_SLOPES[interval])
  // C++: beam.cpp:537 — return std::min(maxSlope, _maxSlopes[interval]) * (_up ? 1 : -1)
  // For stem-up beams: higher note (lower staff line) is "higher" → sign = -1 when endLine < startLine
  // For stem-down beams: lower note (higher staff line) is "lower" → sign = +1 when endLine > startLine
  const sign = stemUp
    ? (endLine < startLine ? 1 : -1)   // stem-up: ascending note → slant up (negative y delta in screen)
    : (endLine > startLine ? -1 : 1)   // stem-down: descending note → slant down (positive y delta)
  return slant * sign
}

// ─────────────────────────────────────────────────────────────────────────────
// layoutBeam — simplified Beam::layout2 for MAP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute beam anchor Y-positions given a list of beamed chords.
 *
 * C++: beam.cpp:1437–1589 — Beam::layout2()
 *
 * Simplified MAP version:
 *   1. Compute slope in quarter-spaces (via computeBeamSlope)
 *   2. Convert to pixels: slopePx = slantQS * (sp / 4) / (endX - startX)
 *   3. Set startY = dictator anchor, endY = startY + slopePx * (endX - startX)
 *   4. Return beam parameters for rendering
 *
 * C++: beam.cpp:1462–1463
 *   _beamDist  = (_beamSpacing / 4.0) * spatium() * mag()
 *   _beamWidth = point(score()->styleS(Sid::beamWidth)) * mag()
 *
 * @param chords   beamed chords in order (at least 2)
 * @param sp       spatium in pixels
 * @returns        BeamGeometry or null if fewer than 2 chords
 */
export function layoutBeam(chords: BeamChord[], sp: number): BeamGeometry | null {
  if (chords.length < 2) return null

  const first = chords[0]
  const last  = chords[chords.length - 1]
  const stemUp = first.stemUp

  // quarterSpace = sp/4 (all slope units in MuseScore are in quarter-spaces)
  const quarterSpace = sp / 4

  // Desired slant in quarter-spaces
  const slantQS = computeBeamSlope(
    first.noteLine, last.noteLine,
    first.stemTipX, last.stemTipX,
    stemUp, sp
  )

  // Convert: slant in pixels across the full beam width
  const dx = last.stemTipX - first.stemTipX
  const dyPx = slantQS * quarterSpace   // total y-change (in pixels) over the beam

  // Dictator anchor (start) = stem tip of first chord
  const startY = first.stemTipY

  // C++: beam.cpp:1580 — _slope = (_endAnchor.y() - _startAnchor.y()) / (_endAnchor.x() - _startAnchor.x())
  const slope = dx !== 0 ? dyPx / dx : 0

  return {
    startY,
    endY: startY + dyPx,
    slope,
    beamWidthPx: BEAM_WIDTH_SP * sp,
    beamDistPx: beamDistPx(sp),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// secondaryBeamY — beam.cpp:800
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Y position of a secondary beam at a given chord's x position.
 *
 * C++: beam.cpp:800
 *   verticalOffset = _beamDist * (level - extraBeamAdjust) * upValue
 *   startY -= verticalOffset * _grow1   (for uniform growth)
 *
 * MAP simplified (grow1 = grow2 = 1.0, extraBeamAdjust = 0):
 *   secondaryY = primaryY(x) - beamDist * level * upValue
 *
 * @param primaryY   Y of primary beam at this x (pixels)
 * @param level      beam level: 1 = 16th, 2 = 32nd, etc. (0 = primary)
 * @param stemUp     true = beams above note (stem goes up)
 * @param sp         spatium in pixels
 */
export function secondaryBeamY(
  primaryY: number,
  level: number,
  stemUp: boolean,
  sp: number,
): number {
  const upValue = stemUp ? -1 : 1   // C++: beam.cpp:778 — upValue = _up ? -1 : 1
  const dist = beamDistPx(sp)
  return primaryY - dist * level * upValue
}
