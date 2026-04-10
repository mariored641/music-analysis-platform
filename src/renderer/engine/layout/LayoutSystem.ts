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
// C++: layoutsystem.cpp:496 → Segment::stretchSegmentsToWidth (segment.cpp:2785)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-segment spring for force-equilibrium justification.
 * C++: layoutsystem.cpp:507–519 — Spring struct
 */
export interface SegmentSpring {
  /** 1 / stretch factor (C++: springConst = 1 / s.stretch()) */
  springConst: number
  /** Current width of this segment in pixels */
  width: number
  /** Pre-tension = width * springConst */
  preTension: number
  /** Which measure this segment belongs to */
  measureNum: number
  /** Segment index within the measure */
  segIndex: number
}

/**
 * Distribute slack space across segments using the C++ spring-rod model.
 *
 * C++: Segment::stretchSegmentsToWidth(springs, rest)  — segment.cpp:2785
 *
 * Algorithm:
 *   1. Sort springs by preTension ascending
 *   2. Do-while loop: accumulate inverseSpringConst + widths, compute force
 *      - width starts as `rest`, then += each spring's existing width
 *      - force = width / inverseSpringConst
 *      - Stop when force < next spring's preTension
 *   3. Apply: if force > preTension → newWidth = force / springConst
 *      Otherwise keep original width
 *
 * @param springs  Per-segment springs with springConst, width, preTension
 * @param rest     Slack to distribute (targetWidth - curWidth)
 */
export function justifySystem(
  springs: SegmentSpring[],
  rest: number,
): void {
  if (springs.length === 0 || rest < 1e-9) return

  // 1. Sort by preTension ascending (C++: std::sort)
  const sorted = [...springs].sort((a, b) => a.preTension - b.preTension)

  // 2. Force-equilibrium do-while loop (C++: segment.cpp:2796-2802)
  //    width starts as rest (the slack), then accumulates each spring's existing width
  let inverseSpringConst = 0
  let width = rest    // C++: function parameter `width` = rest
  let force = 0
  let i = 0

  do {
    inverseSpringConst += 1.0 / sorted[i].springConst
    width += sorted[i].width
    force = width / inverseSpringConst
    i++
  } while (i < sorted.length && !(force < sorted[i].preTension))
  //        C++: !(force < spring.preTension) means loop while force >= preTension

  // 3. Apply force to each spring (C++: segment.cpp:2804-2809)
  //    Strict > (not >=) for preTension check
  for (const sp of springs) {
    if (force > sp.preTension) {
      sp.width = force / sp.springConst
    }
    // else: keep original width (spring didn't yield)
  }
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
const MIN_HORIZ_DIST_SP = 1.68 // = 1.18sp (noteHeadWidth) + 0.5sp (minNoteDistance) — no spacing multiplier

// ─────────────────────────────────────────────────────────────────────────────
// System collection (incremental greedy algorithm)
// C++: layoutsystem.cpp:109-245
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

    // C++: layoutsystem.cpp:123-138 — track min/max changes (with epsilon for float equality)
    if (curMinDur < minTicks - 1e-9) {
      prevMinTicks = minTicks
      minTicks = curMinDur
      minSysTicksChanged = true
    } else {
      minSysTicksChanged = false
    }
    if (curMaxDur > maxTicks + 1e-9) {
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

      // G-029: epsilon tolerance for float accumulation (0.01px ~ 1/2500 of page width)
      const doBreak = (curSysWidth + ww) > maxW + acceptanceRange + 0.01

      // DEBUG: system breaking decisions
      if ((globalThis as any).__DEBUG_SYSTEM_BREAK) {
        console.log(`  m${mNum}: ww=${ww.toFixed(1)} curSys=${curSysWidth.toFixed(1)} total=${(curSysWidth+ww).toFixed(1)} maxW=${maxW.toFixed(1)} accept=${acceptanceRange.toFixed(1)} min=${minTicks} max=${maxTicks} break=${doBreak}`)
      }

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
