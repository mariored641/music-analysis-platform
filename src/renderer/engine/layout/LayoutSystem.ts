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
 * Greedy system breaking.
 *
 * C++: layoutsystem.cpp:62–470 — collectSystem()
 * Algorithm: add measures one by one; when adding the next measure would exceed
 * targetWidth, start a new system.
 *
 * C++: layoutsystem.cpp:428–431
 *   if last system AND curSysWidth/targetWidth < lastSystemFillLimit → do NOT justify
 *
 * @param measureWidths     Minimum widths of each measure in pixels (1-based index)
 * @param headerWidth       Width of system header (clef + key + time sig) in pixels
 * @param usableWidth       Target system width (page width - margins) in pixels
 * @returns                 Array of measure-number arrays, one per system
 */
export function collectSystems(
  measureWidths: Map<number, number>,
  headerWidth: number,
  usableWidth: number,
): number[][] {
  const systems: number[][] = []
  let currentSystem: number[] = []
  let currentWidth = headerWidth

  const mNums = [...measureWidths.keys()].sort((a, b) => a - b)

  for (const mNum of mNums) {
    const mw = measureWidths.get(mNum) ?? 0

    if (currentSystem.length === 0) {
      // First measure of system: always include
      currentSystem.push(mNum)
      currentWidth += mw
    } else if (currentWidth + mw <= usableWidth) {
      // Fits: add to current system
      currentSystem.push(mNum)
      currentWidth += mw
    } else {
      // Doesn't fit: start new system
      systems.push(currentSystem)
      currentSystem = [mNum]
      currentWidth = headerWidth + mw
    }
  }

  if (currentSystem.length > 0) {
    systems.push(currentSystem)
  }

  return systems
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
