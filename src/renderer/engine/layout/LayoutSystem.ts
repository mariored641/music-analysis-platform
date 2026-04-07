/**
 * MAP Native Renderer — engine/layout/LayoutSystem.ts
 * C++ source: src/engraving/layout/layoutsystem.cpp
 *             src/engraving/libmscore/system.cpp
 *
 * Mirrors:
 *   LayoutSystem::collectSystem()   — layoutsystem.cpp:62
 *   LayoutSystem::justifySystem()   — layoutsystem.cpp:496
 *
 * Scope: greedy measure collection into systems, and spring-model justification.
 */

import { Sid } from '../../style/StyleDef'
import {
  computeSegmentWidths as computeSegmentWidthsLocal,
  computeMeasureWidth as computeMeasureWidthLocal,
  type MeasureSegment,
} from './LayoutMeasure'

// ─────────────────────────────────────────────────────────────────────────────
// Constants (from styledef.cpp)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimum fill ratio for the last system.
 * C++: layoutsystem.cpp:430
 *   if ((curSysWidth / targetSystemWidth) < score->styleD(Sid::lastSystemFillLimit))
 *     → skip justification
 * styledef.cpp:228 → 0.3 (do not stretch if system is < 30% full)
 */
export const LAST_SYSTEM_FILL_LIMIT: number = Sid.lastSystemFillLimit   // 0.3

/**
 * Printable page width (used as target system width).
 * C++: layoutsystem.cpp:90
 *   double targetSystemWidth = score->styleD(Sid::pagePrintableWidth) * DPI;
 * styledef.cpp:43 → 180.0mm
 */
export const PAGE_PRINTABLE_WIDTH_MM: number = Sid.pagePrintableWidthMm  // 180.0

// ─────────────────────────────────────────────────────────────────────────────
// System spring model (justifySystem)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spring model segment input.
 * C++: layoutsystem.cpp:507–519 — Spring struct
 */
export interface SystemSpring {
  /** Stretch factor of this segment (from computeDurationStretch) */
  stretch: number
  /** Current width of this segment in pixels */
  currentWidth: number
}

/**
 * Distribute slack space across segments using the spring model.
 *
 * C++: layoutsystem.cpp:496–531 — justifySystem()
 *
 *   rest = targetWidth - curWidth
 *   for each chord-rest segment:
 *     springConst = 1 / stretch
 *     preTension  = width * springConst
 *   → distribute rest proportionally to (1 / springConst) = stretch
 *     (segments with higher stretch get more extra space)
 *
 * C++: Segment::stretchSegmentsToWidth(springs, rest)
 *   → each segment's new width = currentWidth + rest * (stretch / totalStretch)
 *
 * MAP note: this is the slack distribution from horizontalLayout.ts placeSystem().
 * The formula used in placeSystem is:
 *   extra = slack * (md.totalBaseNoteWidth / totalNoteContent)
 * which is equivalent to distributing proportionally to "note content" (stretch × count).
 *
 * @param springs     Segments to stretch
 * @param targetWidth Total target width of the system (usable width minus header)
 * @param curWidth    Current total width of all measure content
 * @returns           New widths for each spring segment
 */
export function justifySystem(
  springs: SystemSpring[],
  targetWidth: number,
  curWidth: number,
): number[] {
  const rest = targetWidth - curWidth
  if (rest <= 0 || springs.length === 0) {
    return springs.map(s => s.currentWidth)
  }

  // C++: springConst = 1 / stretch; preTension = width * springConst
  // Distribution: each segment gets rest * (stretch / totalStretch)
  // Equivalent to distributing proportionally to stretch.
  const totalStretch = springs.reduce((s, sp) => s + sp.stretch, 0)
  if (totalStretch <= 0) {
    const even = rest / springs.length
    return springs.map(s => s.currentWidth + even)
  }

  return springs.map(sp => {
    const extra = rest * (sp.stretch / totalStretch)
    return sp.currentWidth + extra
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// System collection (greedy algorithm)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Squeeze tolerance factor.
 * C++: layoutsystem.cpp:98 — squeezability = 0.3
 * A system can overflow targetWidth by up to squeezability × squeezableSpace
 * before a line break is forced.
 * Also used as pre-stretch factor: preStretch = 1 - SQUEEZABILITY = 0.7
 * when system overflows before justification.
 * C++: layoutsystem.cpp:416
 */
export const SQUEEZABILITY = 0.3

/**
 * Absolute minimum note horizontal distance (no stretch).
 * C++: measure.cpp:4259 — minHorizontalDistance = noteHeadWidth + minNoteDistance
 *   = 1.18sp + 0.5sp = 1.68sp
 * Used to compute per-segment squeezable space = minStretchedWidth - minHorizDist.
 */
const MIN_HORIZ_DIST_SP = 1.68

/**
 * Greedy system breaking.
 *
 * C++: layoutsystem.cpp:62–470 — collectSystem()
 * Algorithm: add measures one by one; when adding the next measure would exceed
 * targetWidth + acceptanceRange, start a new system.
 *
 * C++: layoutsystem.cpp:428–431
 *   if last system AND curSysWidth/targetWidth < lastSystemFillLimit → do NOT justify
 *
 * C++: layoutsystem.cpp:96–100 — squeeze tolerance
 *   acceptanceRange = squeezability * system->squeezableSpace()
 *   doBreak = measures.size() > 1 && (curSysWidth + ww > targetSystemWidth + acceptanceRange)
 *
 * @param measureWidths       Minimum widths of each measure in pixels (1-based index)
 * @param headerWidth         Width of system header (clef + key + time sig) in pixels
 * @param usableWidth         Target system width (page width - margins) in pixels
 * @param firstSystemWidth    Optional smaller width for system 0 (first-system indent)
 * @param measureSqueezable   Optional per-measure squeezable space in pixels (for acceptance range)
 * @returns                   Array of measure-number arrays, one per system
 */
export function collectSystems(
  measureWidths:      Map<number, number>,
  headerWidth:        number,
  usableWidth:        number,
  firstSystemWidth?:  number,
  measureSqueezable?: Map<number, number>,
): number[][] {
  const systems: number[][] = []
  let currentSystem: number[] = []
  let currentWidth = headerWidth
  let currentSqueezable = 0   // total squeezable px in current system

  const mNums = [...measureWidths.keys()].sort((a, b) => a - b)

  for (const mNum of mNums) {
    const mw          = measureWidths.get(mNum) ?? 0
    const mSqueezable = measureSqueezable?.get(mNum) ?? 0
    // First system uses firstSystemWidth (if provided); subsequent use usableWidth
    const maxW = (systems.length === 0 && firstSystemWidth !== undefined)
      ? firstSystemWidth
      : usableWidth

    if (currentSystem.length === 0) {
      // First measure of system: always include
      currentSystem.push(mNum)
      currentWidth      += mw
      currentSqueezable += mSqueezable
    } else {
      // C++: acceptanceRange computed including the candidate measure (tentative add)
      const tentativeSqueezable = currentSqueezable + mSqueezable
      const acceptanceRange     = SQUEEZABILITY * tentativeSqueezable

      if (currentWidth + mw <= maxW + acceptanceRange) {
        // Fits (possibly with squeeze): add to current system
        currentSystem.push(mNum)
        currentWidth      += mw
        currentSqueezable += mSqueezable
      } else {
        // Doesn't fit even with squeeze: start new system
        systems.push(currentSystem)
        currentSystem     = [mNum]
        currentWidth      = headerWidth + mw
        currentSqueezable = mSqueezable
      }
    }
  }

  if (currentSystem.length > 0) {
    systems.push(currentSystem)
  }

  return systems
}

/**
 * Compute total squeezable space for a set of segment widths.
 * C++: measure.cpp — squeezableSpace = minStretchedWidth - minHorizontalDist
 *
 * @param segmentWidths  Per-segment widths in pixels (from computeSegmentWidths)
 * @param sp             Spatium in pixels
 * @returns              Total squeezable pixels for this measure
 */
export function computeMeasureSqueezable(segmentWidths: number[], sp: number): number {
  const minHorizPx = MIN_HORIZ_DIST_SP * sp
  return segmentWidths.reduce((sum, w) => sum + Math.max(0, w - minHorizPx), 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Incremental system collection (C++: layoutsystem.cpp:109-245)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of incremental system collection.
 * Returns per-system min/max durations alongside the system groups.
 */
export interface IncrementalSystemResult {
  /** Array of measure-number arrays, one per system */
  systemGroups: number[][]
  /** Per-system final minDur in quarter-beat units */
  systemMinDurs: number[]
  /** Per-system final maxDur in quarter-beat units */
  systemMaxDurs: number[]
}

/**
 * Incremental greedy system breaking with min/max duration tracking.
 *
 * C++: layoutsystem.cpp:109-245 — collectSystem()
 *
 * When a new measure is added to the system, if it changes the system's
 * minTicks or maxTicks, ALL previous measures are recomputed with the new
 * values. This is essential because computeDurationStretch depends on
 * both min and max durations (empFactor, HACK, maxRatio cap).
 *
 * @param allSegments      Per-measure segments (beat positions + durations)
 * @param firstNotePads    Per-measure first-note padding in pixels
 * @param measureMinDurs   Shortest note per measure (in qb)
 * @param measureMaxDurs   Longest note per measure (in qb)
 * @param headerWidth      Width of system header in pixels
 * @param usableWidth      Target system width (page width - margins) in pixels
 * @param sp               Spatium in pixels
 * @param firstSystemWidth Optional smaller width for system 0 (first-system indent)
 */
export function collectSystemsIncremental(
  allSegments:     Map<number, MeasureSegment[]>,
  firstNotePads:   Map<number, number>,
  measureMinDurs:  Map<number, number>,
  measureMaxDurs:  Map<number, number>,
  headerWidth:     number,
  usableWidth:     number,
  sp:              number,
  firstSystemWidth?: number,
): IncrementalSystemResult {
  const systemGroups: number[][] = []
  const systemMinDurs: number[] = []
  const systemMaxDurs: number[] = []

  let currentSystem: number[] = []
  let curSysWidth = headerWidth
  let minTicks = Infinity
  let maxTicks = 0
  let prevMinTicks = Infinity
  let prevMaxTicks = 0
  let minSysTicksChanged = false
  let maxSysTicksChanged = false

  const mNums = [...allSegments.keys()].sort((a, b) => a - b)

  /** Recompute total system width from scratch with current min/max */
  const recomputeSystemWidth = (): number => {
    let w = headerWidth
    for (const mNum of currentSystem) {
      const segs = allSegments.get(mNum) ?? []
      const pad  = firstNotePads.get(mNum) ?? 0
      const segWs = computeSegmentWidthsLocal(segs, minTicks, sp, maxTicks)
      w += computeMeasureWidthLocal(pad, segWs, sp)
    }
    return w
  }

  for (const mNum of mNums) {
    const curMinDur = measureMinDurs.get(mNum) ?? Infinity
    const curMaxDur = measureMaxDurs.get(mNum) ?? 0

    // C++: layoutsystem.cpp:123-138 — track min/max changes
    if (curMinDur < minTicks) {
      prevMinTicks = minTicks
      minTicks = curMinDur
      minSysTicksChanged = true
    } else {
      minSysTicksChanged = false
    }
    if (curMaxDur > maxTicks) {
      prevMaxTicks = maxTicks
      maxTicks = curMaxDur
      maxSysTicksChanged = true
    } else {
      maxSysTicksChanged = false
    }

    // C++: layoutsystem.cpp:139-152 — recompute all prior measures if min/max changed
    if ((minSysTicksChanged || maxSysTicksChanged) && currentSystem.length > 0) {
      curSysWidth = recomputeSystemWidth()
    }

    // Compute current measure width with system min/max
    const segs = allSegments.get(mNum) ?? []
    const pad  = firstNotePads.get(mNum) ?? 0
    const segWs = computeSegmentWidthsLocal(segs, minTicks, sp, maxTicks)
    const ww = computeMeasureWidthLocal(pad, segWs, sp)

    // First system uses firstSystemWidth (if provided)
    const maxW = (systemGroups.length === 0 && firstSystemWidth !== undefined)
      ? firstSystemWidth
      : usableWidth

    if (currentSystem.length === 0) {
      // First measure always included
      currentSystem.push(mNum)
      curSysWidth += ww
    } else {
      // C++: layoutsystem.cpp:202-203 — acceptance range check
      // Note: in C++ the current measure is already appended to the system
      // when squeezableSpace is computed, so it includes the candidate.
      const tentativeSqueezable = computeSystemSqueezableIncremental(
        [...currentSystem, mNum], allSegments, firstNotePads, minTicks, maxTicks, sp,
      )
      const acceptanceRange = SQUEEZABILITY * tentativeSqueezable

      const doBreak = (curSysWidth + ww) > maxW + acceptanceRange

      if (doBreak) {
        // C++: layoutsystem.cpp:228-243 — restore min/max if last measure caused change
        if (minSysTicksChanged) minTicks = prevMinTicks
        if (maxSysTicksChanged) maxTicks = prevMaxTicks

        // Recompute with restored values
        if (minSysTicksChanged || maxSysTicksChanged) {
          curSysWidth = recomputeSystemWidth()
        }

        // Finalize current system
        systemGroups.push(currentSystem)
        systemMinDurs.push(minTicks)
        systemMaxDurs.push(maxTicks)

        // Start new system with this measure
        currentSystem = [mNum]
        minTicks = curMinDur
        maxTicks = curMaxDur
        const newSegWs = computeSegmentWidthsLocal(segs, minTicks, sp, maxTicks)
        curSysWidth = headerWidth + computeMeasureWidthLocal(pad, newSegWs, sp)
      } else {
        currentSystem.push(mNum)
        curSysWidth += ww
      }
    }
  }

  // Final system
  if (currentSystem.length > 0) {
    systemGroups.push(currentSystem)
    systemMinDurs.push(minTicks)
    systemMaxDurs.push(maxTicks)
  }

  return { systemGroups, systemMinDurs, systemMaxDurs }
}

/** Compute total squeezable space for a list of measures with given min/max dur */
function computeSystemSqueezableIncremental(
  mNums: number[],
  allSegments: Map<number, MeasureSegment[]>,
  firstNotePads: Map<number, number>,
  minDur: number,
  maxDur: number,
  sp: number,
): number {
  const minHorizPx = MIN_HORIZ_DIST_SP * sp
  // C++: measure.cpp:4307 — final clamp: max(0, min(squeezable, measureWidth - minMeasureWidth))
  const minMeasureWidthPx = 8.0 * sp   // Sid::minMeasureWidth = Spatium(8.0)
  let total = 0
  for (const mNum of mNums) {
    const segs = allSegments.get(mNum) ?? []
    const pad  = firstNotePads.get(mNum) ?? 0
    const segWs = computeSegmentWidthsLocal(segs, minDur, sp, maxDur)
    // Per-segment squeezable (C++: measure.cpp:4220)
    let mSqueezable = segWs.reduce((sum, w) => sum + Math.max(0, w - minHorizPx), 0)
    // C++: measure.cpp:4307 — clamp to measureWidth - minMeasureWidth
    const mWidth = computeMeasureWidthLocal(pad, segWs, sp)
    mSqueezable = Math.max(0, Math.min(mSqueezable, mWidth - minMeasureWidthPx))
    total += mSqueezable
  }
  return total
}

// ─────────────────────────────────────────────────────────────────────────────
// Last system fill check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether the last system should be justified (stretched to full width).
 *
 * C++: layoutsystem.cpp:428–431:
 *   if (!(isLastSystem && score->styleB(Sid::lastSystemFillLimit)
 *         && curSysWidth / targetSystemWidth < score->styleD(Sid::lastSystemFillLimit)))
 *     justifySystem(...)
 *
 * @param curWidth    Current content width of the last system
 * @param targetWidth Full usable system width
 */
export function shouldJustifyLastSystem(curWidth: number, targetWidth: number): boolean {
  if (targetWidth <= 0) return false
  return (curWidth / targetWidth) >= LAST_SYSTEM_FILL_LIMIT
}
