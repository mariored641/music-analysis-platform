/**
 * MAP Native Renderer — engine/layout/LayoutMeasure.ts
 * C++ source: src/engraving/libmscore/measure.cpp
 *             src/engraving/layout/layoutmeasure.cpp
 *
 * Mirrors:
 *   Measure::computeWidth()        — measure.cpp:4165
 *   Measure::shortestChordRest()   — measure.cpp:4679
 *   Segment::computeDurationStretch() — segment.cpp:2812
 *
 * Scope: given a list of note durations (segments) in a measure, compute
 * segment widths and total measure width.
 */

import { Sid } from '../../style/StyleDef'

// ─────────────────────────────────────────────────────────────────────────────
// Constants (from styledef.cpp + measure.cpp)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Note spacing multiplier.
 * C++: measure.cpp:4174 — static constexpr double spacingMultiplier = 1.2
 * Used as: minNoteSpace = noteHeadWidth + spacingMultiplier * minNoteDistance
 */
/** Same constant as LayoutChords, re-declared here for self-documentation */
const SPACING_MULTIPLIER = 1.2

/**
 * Minimum note-to-note distance in staff-spaces.
 * C++: styledef.cpp:184 — Spatium(0.5)
 */
const MIN_NOTE_DIST_SP: number = Sid.minNoteDistance   // 0.5

/**
 * Measure spacing slope (for the logarithmic duration stretch formula).
 * C++: styledef.cpp:189 — { Sid::measureSpacing, "measureSpacing", PropertyValue(1.5) }
 * C++: measure.cpp:3708 — stretch = userStretch() * score()->styleD(Sid::measureSpacing)
 */
export const MEASURE_SPACING_SLOPE: number = Sid.measureSpacing  // 1.5

/**
 * Distance from barline to first note (no accidental, no key/time sig change).
 * C++: styledef.cpp:185 — { Sid::barNoteDistance, "barNoteDistance", PropertyValue(Spatium(1.3)) }
 */
export const BAR_NOTE_DIST_SP: number = Sid.barNoteDistance   // 1.3

/**
 * Trailing space after last note to barline.
 * C++: styledef.cpp:186 — { Sid::noteBarDistance, "noteBarDistance", PropertyValue(Spatium(1.5)) }
 */
export const NOTE_BAR_DIST_SP = 1.5    // Sid::noteBarDistance, styledef.cpp:186

// ─────────────────────────────────────────────────────────────────────────────
// Duration stretch formula
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute duration stretch factor for a segment.
 *
 * C++: segment.cpp:2812 — Segment::computeDurationStretch()
 *
 * Full C++ formula including HACK, maxRatio cap, and empFactor.
 * MAP uses quarter-beat durations (1.0 = quarter note) NOT Ticks.
 * The longNoteThreshold = 0.0625 in Ticks (1/16 of a whole note) = 0.25 in quarter-beats.
 *
 * @param durationQb    Duration of this segment in quarter-beat units
 * @param minDurationQb Minimum duration across all segments in the system
 * @param maxDurationQb Maximum duration across all segments in the system
 */
export function computeDurationStretch(
  durationQb: number,
  minDurationQb: number,
  maxDurationQb: number = minDurationQb,
): number {
  if (minDurationQb <= 0) return 1.0

  let dMin = minDurationQb
  const dMax = maxDurationQb

  // C++: segment.cpp:2832-2834 — HACK: double minTicks when range >= 2 and min < sixteenth
  const longNoteThreshold = 0.25   // sixteenth note in quarter-beat units
  if (dMax / dMin >= 2.0 && dMin < longNoteThreshold) {
    dMin *= 2.0
  }

  // C++: ratio = curTicks / minTicks
  let ratio = durationQb / dMin
  if (ratio <= 1.0 + 1e-9) ratio = 1.0

  // C++: segment.cpp:2839-2842 — cap ratio for extreme ranges
  const maxRatio = 32.0
  const maxSysRatio = dMax / dMin
  if (maxSysRatio > maxRatio) {
    const A = (dMin * (maxRatio - 1)) / (dMax - dMin)
    const B = (dMax - maxRatio * dMin) / (dMax - dMin)
    ratio = A * ratio + B
  }

  // C++: str = pow(slope, log2(ratio))
  let str = ratio <= 1.0 ? 1.0 : Math.pow(MEASURE_SPACING_SLOPE, Math.log2(ratio))

  // C++: segment.cpp:2847-2848 — empFactor: widen when all notes are long
  if (dMin > longNoteThreshold) {
    const empFactor = 0.6
    str *= (1 - empFactor + empFactor * Math.sqrt(dMin / longNoteThreshold))
  }

  return str
}

// ─────────────────────────────────────────────────────────────────────────────
// Measure minimum width
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Measure segment input for width computation.
 */
export interface MeasureSegment {
  /** Beat position (1-based, e.g. beat 1.0, 2.0) */
  beat: number
  /** Duration in quarter-beat units */
  durationQb: number
  /** Whether any note at this beat has a visible accidental */
  hasAccidental?: boolean
}

/**
 * Compute segment widths for a measure.
 *
 * C++: measure.cpp:4174–4221 — the core of computeWidth():
 *   minNoteSpace = noteHeadWidth + spacingMultiplier * minNoteDistance
 *   w = max(w, minNoteSpace * durStretch * usrStretch * stretchCoeff)
 *
 * For MAP:
 *   - usrStretch = 1.0 (no user override)
 *   - stretchCoeff = 1.0 (handled by system justification)
 *   - noteHeadWidth ≈ 1.18sp (= 2 * NOTEHEAD_RX_SP)
 *
 * @param segments     List of segments in this measure
 * @param minSysDurQb  System-wide minimum duration (denominator for stretch)
 * @param sp           Spatium in pixels
 * @param maxSysDurQb  System-wide maximum duration (for HACK + maxRatio cap)
 * @returns            Array of widths in pixels, one per segment
 */
export function computeSegmentWidths(
  segments: MeasureSegment[],
  minSysDurQb: number,
  sp: number,
  maxSysDurQb: number = minSysDurQb,
): number[] {
  const noteHeadWidthSp = 1.18  // 2 * NOTEHEAD_RX_SP
  // C++: measure.cpp:4175
  const minNoteSpaceSp = noteHeadWidthSp + SPACING_MULTIPLIER * MIN_NOTE_DIST_SP

  // C++: accidental adds to shape's left extent → increases minHorizontalDistance
  // from previous segment. Approximate as additional padding.
  // Leland accidental width ≈ 0.45sp, plus clearance ≈ 0.25sp → ~0.7sp total
  const accidentalPaddingSp = 0.7

  return segments.map(seg => {
    const stretch = computeDurationStretch(seg.durationQb, minSysDurQb, maxSysDurQb)
    // C++: measure.cpp:4219 — minStretchedWidth = minNoteSpace * durStretch * usrStretch * stretchCoeff
    let minWidthSp = minNoteSpaceSp * stretch
    if (seg.hasAccidental) {
      minWidthSp += accidentalPaddingSp
    }
    return minWidthSp * sp
  })
}

/**
 * Compute the total minimum width of a measure.
 *
 * C++: measure.cpp:4165–4362 — computeWidth() iterates segments,
 * accumulating widths. The final measure width = sum of segment widths + trailing space.
 *
 * @param firstNotePadPx  Space from barline to first note (accounts for key/time changes)
 * @param segmentWidths   Widths of each note-duration segment in pixels
 * @param sp              Spatium in pixels
 */
export function computeMeasureWidth(
  firstNotePadPx: number,
  segmentWidths: number[],
  sp: number,
): number {
  const totalNoteArea = segmentWidths.reduce((s, w) => s + w, 0)
  // C++: trailing space = noteBarDistance (≈ 1.5sp)
  const trailingSp = NOTE_BAR_DIST_SP * sp
  return firstNotePadPx + totalNoteArea + trailingSp
}
