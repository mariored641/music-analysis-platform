/**
 * MAP Native Renderer — engine/layout/LayoutPage.ts
 * C++ source: src/engraving/layout/layoutpage.cpp
 *             src/engraving/layout/verticalgapdata.cpp
 *
 * Mirrors:
 *   LayoutPage::collectPage()      — layoutpage.cpp:103
 *   LayoutPage::layoutPage()       — layoutpage.cpp:361
 *   LayoutPage::distributeStaves() — layoutpage.cpp:508
 *   VerticalGapData (class)        — verticalgapdata.cpp
 *
 * Scope: vertical placement of systems on a page, and intra-system staff spacing.
 */

import { Sid } from '../../style/StyleDef'

// ─────────────────────────────────────────────────────────────────────────────
// Constants (from styledef.cpp)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Space from top of page to top of first staff.
 * C++: layoutpage.cpp:151 — distance = ctx.score()->styleMM(Sid::staffUpperBorder)
 * styledef.cpp:52 → Spatium(7.0)
 */
export const STAFF_UPPER_BORDER_SP: number = Sid.staffUpperBorder   // 7.0

/**
 * Space from bottom of last staff to bottom of page.
 * C++: layoutpage.cpp:107 — const double slb = ctx.score()->styleMM(Sid::staffLowerBorder)
 * styledef.cpp:53 → Spatium(7.0)
 */
export const STAFF_LOWER_BORDER_SP: number = Sid.staffLowerBorder   // 7.0

/**
 * Maximum allowed inter-system distance (bottom-of-system to top-of-next).
 * C++: layoutpage.cpp:419 — double maxDist = score->maxSystemDistance()
 * styledef.cpp:59 → Spatium(15.0)
 */
export const MAX_SYSTEM_DISTANCE_SP: number = Sid.maxSystemDistance   // 15.0

/**
 * Maximum spread for staves within a system during vertical justification.
 * C++: verticalgapdata.cpp:42 — _maxActualSpacing = style->styleMM(Sid::maxStaffSpread)
 * styledef.cpp:69 → Spatium(20.0)
 */
export const MAX_STAFF_SPREAD_SP: number = Sid.maxStaffSpread   // 20.0

/**
 * Maximum spread between systems during vertical justification.
 * C++: verticalgapdata.cpp:78 — _maxActualSpacing = style->styleMM(Sid::maxSystemSpread) / _factor
 * styledef.cpp:67 → Spatium(32.0)
 */
export const MAX_SYSTEM_SPREAD_SP: number = Sid.maxSystemSpread   // 32.0

/**
 * Distance growth factor between different bracket sections.
 * C++: verticalgapdata.cpp:76 — updateFactor(style->styleD(Sid::spreadSystem))
 * styledef.cpp:63 → 2.5
 */
export const SPREAD_SYSTEM: number = Sid.spreadSystem   // 2.5

/**
 * Minimum system distance (from bottom of one to top of next).
 * C++: layoutsystem.cpp — minDistance() computed per-system pair
 * styledef.cpp:58 → Spatium(8.5)
 */
export const MIN_SYSTEM_DISTANCE_SP: number = Sid.minSystemDistance   // 8.5

// ─────────────────────────────────────────────────────────────────────────────
// System placement types
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemLayout {
  /** System index (0-based) */
  index: number
  /** Minimum height of this system in pixels (staff lines + stems + staves) */
  minHeightPx: number
  /** Minimum distance from this system's bottom to the next system's top (in pixels) */
  minDistanceToNextPx: number
}

export interface SystemPlacement {
  /** System index (matching input) */
  index: number
  /** Y position of this system's top in pixels */
  yPx: number
}

// ─────────────────────────────────────────────────────────────────────────────
// collectSystems — collect systems onto pages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Greedily collect systems onto pages.
 *
 * C++: layoutpage.cpp:103–249 — LayoutPage::collectPage()
 *   - First system starts at y = page.tm() + staffUpperBorder
 *   - Each subsequent system placed at: prevY + prevHeight + minDistance
 *   - When adding next system would exceed pageHeight - staffLowerBorder: start new page
 *
 * @param systems      Systems in order with height and min-distance data
 * @param pageHeightPx Total page height in pixels
 * @param topMarginPx  Page top margin in pixels
 * @param sp           Spatium in pixels
 * @returns            Array of pages, each containing system indices
 */
export function collectPages(
  systems: SystemLayout[],
  pageHeightPx: number,
  topMarginPx: number,
  sp: number,
): number[][] {
  const pages: number[][] = []
  let currentPage: number[] = []
  const upperBorder = STAFF_UPPER_BORDER_SP * sp
  const lowerBorder = STAFF_LOWER_BORDER_SP * sp
  const usableHeight = pageHeightPx - topMarginPx - lowerBorder

  // Current y position within page (relative to top margin)
  let y = upperBorder

  for (const sys of systems) {
    if (currentPage.length === 0) {
      // First system on page: always place it
      currentPage.push(sys.index)
      y += sys.minHeightPx
    } else {
      const nextY = y + sys.minDistanceToNextPx + sys.minHeightPx
      if (nextY <= usableHeight) {
        // Fits on current page
        currentPage.push(sys.index)
        y += sys.minDistanceToNextPx + sys.minHeightPx
      } else {
        // Start a new page
        pages.push(currentPage)
        currentPage = [sys.index]
        y = upperBorder + sys.minHeightPx
      }
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage)
  }

  return pages
}

// ─────────────────────────────────────────────────────────────────────────────
// layoutPage — vertical justification of systems
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Distribute systems vertically on a page using the spring model.
 *
 * C++: layoutpage.cpp:361–476 — LayoutPage::layoutPage()
 *
 * Algorithm (simplified from C++):
 *   1. Compute restHeight = pageUsableHeight - totalSystemContent
 *   2. Sort system gaps by current distance (shortest first)
 *   3. Normalize gaps upward (fill to max allowed per maxSystemDistance)
 *   4. Distribute remaining rest equally, capped by maxSystemDistance
 *   5. Set final y positions
 *
 * C++: layoutpage.cpp:419 — double maxDist = score->maxSystemDistance()
 * C++: layoutpage.cpp:422 — sort by (distance - height), shortest first
 * C++: layoutpage.cpp:425–459 — normalize then distribute fill
 *
 * @param systems          Systems on this page (in order)
 * @param pageUsableHeight Page height minus margins (in pixels)
 * @param topMarginPx      Page top margin in pixels
 * @param sp               Spatium in pixels
 * @returns                Y positions for each system (pixels from page top + margin)
 */
export function layoutPageSystems(
  systems: SystemLayout[],
  pageUsableHeight: number,
  topMarginPx: number,
  sp: number,
): SystemPlacement[] {
  if (systems.length === 0) return []

  const upperBorder = STAFF_UPPER_BORDER_SP * sp
  const lowerBorder = STAFF_LOWER_BORDER_SP * sp
  const maxDist = MAX_SYSTEM_DISTANCE_SP * sp

  // Compute initial positions (packed)
  const placements: SystemPlacement[] = []
  let y = upperBorder
  for (const sys of systems) {
    placements.push({ index: sys.index, yPx: y })
    y += sys.minHeightPx
    if (placements.length < systems.length) {
      y += systems[placements.length].minDistanceToNextPx
    }
  }

  // Total height used by content
  const totalContent = y
  const restHeight = pageUsableHeight - lowerBorder - totalContent

  if (restHeight <= 0 || systems.length <= 1) {
    return placements
  }

  // Number of inter-system gaps
  const gaps = systems.length - 1

  // C++: layoutpage.cpp:375–388 — build list of systems (excluding last that are not vbox)
  // MAP: treat all systems the same (no vbox support yet)
  // Current gap distances (measured from bottom of sys[i] to top of sys[i+1])
  const gapDists: number[] = []
  for (let i = 0; i < gaps; i++) {
    gapDists.push(systems[i].minDistanceToNextPx)
  }

  // C++: layoutpage.cpp:422 — sort by distance (shortest first) for normalization
  const sortedIdx = gapDists
    .map((d, i) => ({ i, d }))
    .sort((a, b) => a.d - b.d)

  let remaining = restHeight
  const adjustments = new Array<number>(gaps).fill(0)

  // C++: layoutpage.cpp:424–449 — normalize upward pass
  for (let k = 1; k < sortedIdx.length; k++) {
    const curr = sortedIdx[k]
    const prev = sortedIdx[k - 1]
    const fill = curr.d - prev.d   // gap between this and previous shortest
    if (fill > 0) {
      const totalFill = fill * k   // fill all shorter gaps to match
      if (totalFill > remaining) {
        const partialFill = remaining / k
        for (let j = 0; j < k; j++) {
          adjustments[sortedIdx[j].i] += partialFill
        }
        remaining = 0
        break
      }
      for (let j = 0; j < k; j++) {
        adjustments[sortedIdx[j].i] += fill
      }
      remaining -= totalFill
    }
  }

  // C++: layoutpage.cpp:451–459 — distribute remaining rest equally
  if (remaining > 0) {
    const equalShare = remaining / gaps
    for (let i = 0; i < gaps; i++) {
      const cur = gapDists[i] + adjustments[i]
      const maxAdd = maxDist - cur
      adjustments[i] += Math.min(equalShare, Math.max(0, maxAdd))
    }
  }

  // Apply adjustments to y positions
  let offset = 0
  for (let i = 0; i < systems.length; i++) {
    placements[i] = { index: systems[i].index, yPx: upperBorder + offset }
    if (i < gaps) {
      offset += systems[i].minHeightPx + gapDists[i] + adjustments[i]
    }
  }

  return placements
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff spacing within a system
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute Y positions of staves within a system.
 *
 * C++: libmscore/system.cpp — System::layout2()
 * Staff spacing: staffDistance (different parts) or akkoladeDistance (same part).
 *
 * C++: styledef.cpp:55 — staffDistance = Spatium(6.5)
 * C++: styledef.cpp:57 — akkoladeDistance = Spatium(6.5)
 *
 * For MAP (single-part scores, no brackets):
 *   All staves use staffDistance.
 *
 * @param staffCount    Number of staves
 * @param staffHeightPx Height of a single staff (4 lines × lineSpacing) in pixels
 * @param sp            Spatium in pixels
 * @returns             Array of Y positions for each staff (from system top, in pixels)
 */
export function layoutStaves(
  staffCount: number,
  staffHeightPx: number,
  sp: number,
): number[] {
  // C++: styledef.cpp:55 — staffDistance = Spatium(6.5) = distance between bottom of staff N and top of staff N+1
  const staffDistPx = Sid.staffDistance * sp
  const positions: number[] = []
  let y = 0
  for (let i = 0; i < staffCount; i++) {
    positions.push(y)
    y += staffHeightPx + staffDistPx
  }
  return positions
}

/**
 * Total height of a system with N staves.
 * = (staffCount - 1) * (staffHeight + staffDistance) + staffHeight
 *
 * @param staffCount    Number of staves
 * @param staffHeightPx Single staff height in pixels
 * @param sp            Spatium in pixels
 */
export function systemHeight(
  staffCount: number,
  staffHeightPx: number,
  sp: number,
): number {
  if (staffCount <= 0) return 0
  const staffDistPx = Sid.staffDistance * sp
  return staffCount * staffHeightPx + (staffCount - 1) * staffDistPx
}
