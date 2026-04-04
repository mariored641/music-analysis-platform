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
 */
const SQUEEZABILITY = 0.3

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
