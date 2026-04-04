/**
 * MAP Native Renderer — engine/LayoutOrchestrator.ts
 * C++ source: src/engraving/layout/layoutsystem.cpp (collectSystem, justifySystem)
 *             src/engraving/libmscore/measure.cpp    (computeWidth, shortestChordRest)
 *             src/engraving/layout/layoutmeasure.cpp
 *
 * Orchestrates the full horizontal layout pipeline using engine building blocks:
 *   1. buildMeasureSegments()   — collect beat positions from notes
 *   2. computeSegmentWidths()   — LayoutMeasure: C++ measure.cpp:4174 (noteHeadWidth + minDist × stretch)
 *   3. computeMeasureWidth()    — LayoutMeasure: C++ measure.cpp:4165 (pad + noteArea + trailing)
 *   4. collectSystems()         — LayoutSystem:  C++ layoutsystem.cpp:62 (greedy break)
 *   5. justifySystem()          — LayoutSystem:  C++ layoutsystem.cpp:496 (spring model)
 *   6. placeNoteX()             — note x-coords from justified segment widths
 *
 * Replaces the monolithic computeHorizontalLayout() in horizontalLayout.ts.
 * Output type is identical (HorizontalLayout) for drop-in compatibility.
 */

import type { ExtractedScore, ExtractedMeasure } from '../extractorTypes'
import type { RenderOptions } from '../types'

// Type-only imports from horizontalLayout — interface definitions, NOT computation logic
import type {
  HorizontalLayout, HLayoutSystem, HLayoutPage, HLayoutMeasure, HLayoutSegment,
} from '../horizontalLayout'
import {
  DEFAULT_RENDER_OPTIONS,
  // System header constants (re-exported from horizontalLayout for compatibility)
  CLEF_LEFT_MARGIN_SP, CLEF_GLYPH_WIDTH_SP, CLEF_KEY_DIST_SP, CLEF_TIMESIG_DIST_SP,
  KEY_ACC_STRIDE_SP, KEY_TIMESIG_DIST_SP, TIMESIG_GLYPH_WIDTH_SP, SYS_HDR_TIMESIG_SP,
  BAR_NOTE_DIST_SP,
  FIRST_SYSTEM_INDENT_SP,
} from '../horizontalLayout'

// Engine computation functions
import {
  computeSegmentWidths, computeMeasureWidth, computeDurationStretch,
  NOTE_BAR_DIST_SP,
  type MeasureSegment,
} from './layout/LayoutMeasure'
import {
  collectSystems, justifySystem, shouldJustifyLastSystem, computeMeasureSqueezable,
  type SystemSpring,
} from './layout/LayoutSystem'

// ─── C++ constants not yet exported from engine ──────────────────────────────

/**
 * Distance from barline to first note when that note carries an accidental.
 * C++: score.cpp / measure.cpp — accidental symbol placed before note,
 * reducing the barline→note gap to accommodate the accidental glyph.
 * Value: 0.65sp (matches webmscore SVG output at default spatium).
 */
const BAR_ACC_DIST_SP = 0.65   // sp

// ─── State types ─────────────────────────────────────────────────────────────

interface MeasureState {
  fifths:   number
  beats:    number
  beatType: number
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Orchestrate the full horizontal layout using engine building blocks.
 *
 * C++ entry: Score::doLayout() → LayoutSystem::collectSystem() → justifySystem()
 *
 * @param score         Parsed MusicXML → ExtractedScore
 * @param renderOptions Optional render options (page size, spatium, margins…)
 * @returns             HorizontalLayout — identical interface to computeHorizontalLayout()
 */
export function orchestrateHorizontalLayout(
  score: ExtractedScore,
  renderOptions?: RenderOptions,
): HorizontalLayout {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...renderOptions } as Required<RenderOptions>
  const sp = opts.spatium

  const { measures: extMeasures, metadata } = score

  // ── 1. Pre-compute key/time state at the start of each measure ───────────
  const measureStartState = computeMeasureStates(extMeasures, metadata)

  // ── 2. Build MeasureSegments and firstNotePads ───────────────────────────
  const allSegments:    Map<number, MeasureSegment[]> = new Map()
  const firstNotePads:  Map<number, number>           = new Map()

  for (let i = 0; i < extMeasures.length; i++) {
    const m     = extMeasures[i]
    const state = measureStartState[i]
    const hasTimeChange = !!m.timeChange && i > 0

    allSegments.set(m.num, buildMeasureSegments(m, state.beats))
    firstNotePads.set(m.num, computeFirstNotePad(m, state, hasTimeChange, sp))
  }

  // ── 3. Global min duration (for greedy break estimate) ───────────────────
  // C++: layoutsystem.cpp:201 — minSysTicks computed across all measures first
  const globalMinDur = clampMinDur(findGlobalMinDur(allSegments))

  // ── 4. Measure widths (global stretch) for greedy system breaking ────────
  const globalMeasureWidths:  Map<number, number> = new Map()
  const globalMeasureSqueeze: Map<number, number> = new Map()
  for (const [mNum, segs] of allSegments) {
    const pad   = firstNotePads.get(mNum) ?? 0
    const segWs = computeSegmentWidths(segs, globalMinDur, sp)
    globalMeasureWidths.set(mNum, computeMeasureWidth(pad, segWs, sp))
    globalMeasureSqueeze.set(mNum, computeMeasureSqueezable(segWs, sp))
  }

  // ── 5. System header for greedy break ────────────────────────────────────
  const headerWidth = computeHeaderWidth(metadata.fifths, sp)
  const usableWidth = opts.pageWidth - opts.marginLeft - opts.marginRight

  // First-system indent — shifts system 0 right by 5sp, reducing its usable width.
  // From MuseScore: src/engraving/style/styledef.cpp:449
  //   Sid::firstSystemIndentationValue = Spatium(5.0)
  const firstSysIndentPx    = FIRST_SYSTEM_INDENT_SP * sp
  const firstSysUsableWidth = usableWidth - firstSysIndentPx

  // ── 6. Greedy system breaking ─────────────────────────────────────────────
  // C++: LayoutSystem::collectSystem() — layoutsystem.cpp:62
  // Pass firstSysUsableWidth so system 0 gets fewer measures than later systems.
  const systemGroups = collectSystems(globalMeasureWidths, headerWidth, usableWidth, firstSysUsableWidth, globalMeasureSqueeze)

  // ── 7. Page geometry ──────────────────────────────────────────────────────
  const sysH          = (4 + opts.systemSpacingSp) * sp
  const usablePageH   = opts.pageHeight - opts.marginTop - opts.marginBottom
  const maxSysPerPage = Math.max(1, Math.floor(usablePageH / sysH))

  // ── 8. Per-system justification and note placement ───────────────────────
  const systems:    HLayoutSystem[]             = []
  const pages:      HLayoutPage[]               = []
  const measureMap: Map<number, HLayoutMeasure> = new Map()
  const noteXMap:   Map<string, number>         = new Map()

  let pageIdx        = 0
  let pageSysIndices: number[] = []

  for (let sysIdx = 0; sysIdx < systemGroups.length; sysIdx++) {
    const mNums = systemGroups[sysIdx]

    // Page break?
    if (sysIdx > 0 && pageSysIndices.length >= maxSysPerPage) {
      pages.push({ pageIndex: pageIdx, systemIndices: pageSysIndices })
      pageIdx++
      pageSysIndices = []
    }

    // Per-system min duration (tighter estimate → better spacing)
    // C++: layoutsystem.cpp:201 — minSysTicks per system
    const sysMinDur = clampMinDur(findSystemMinDur(mNums, allSegments))

    // Re-compute segment widths with per-system min duration
    const sysSegWidths: Map<number, number[]> = new Map()
    const sysMeasureWidths: Map<number, number> = new Map()

    for (const mNum of mNums) {
      const segs   = allSegments.get(mNum) ?? []
      const pad    = firstNotePads.get(mNum) ?? 0
      const segWs  = computeSegmentWidths(segs, sysMinDur, sp)
      sysSegWidths.set(mNum, segWs)
      sysMeasureWidths.set(mNum, computeMeasureWidth(pad, segWs, sp))
    }

    // Per-system header (key active at system start)
    const firstMeasureIdx = mNums[0] - 1
    const sysState        = measureStartState[firstMeasureIdx]
    const sysHeaderWidth  = computeHeaderWidth(sysState.fifths, sp)

    // ── Spring model justification (C++: layoutsystem.cpp:496) ──────────────
    // Springs: one per measure.  stretch ∝ note content (= noteArea itself).
    // First system has smaller usable width (due to first-system indent).
    const isFirstSystem  = sysIdx === 0
    const sysUsableWidth = isFirstSystem ? firstSysUsableWidth : usableWidth
    const sysX           = opts.marginLeft + (isFirstSystem ? firstSysIndentPx : 0)

    const totalMeasureWidth = mNums.reduce((s, mn) => s + (sysMeasureWidths.get(mn) ?? 0), 0)
    const targetWidth       = sysUsableWidth - sysHeaderWidth

    const springs: SystemSpring[] = mNums.map(mNum => {
      const segs   = allSegments.get(mNum) ?? []
      const segWs  = sysSegWidths.get(mNum) ?? []
      // Note area = sum of stretched segment widths (proxy for "note content")
      const noteArea = segWs.reduce((s, w) => s + w, 0)
      return {
        stretch:      noteArea,    // proportional to note content
        currentWidth: sysMeasureWidths.get(mNum) ?? 0,
      }
    })

    const isLastSystem = sysIdx === systemGroups.length - 1
    let finalMeasureWidths: number[]

    if (!isLastSystem || shouldJustifyLastSystem(totalMeasureWidth + sysHeaderWidth, usableWidth)) {
      // C++: layoutsystem.cpp:496 — justifySystem()
      finalMeasureWidths = justifySystem(springs, targetWidth, totalMeasureWidth)
    } else {
      // Last system: don't stretch if it's < 30% full
      finalMeasureWidths = springs.map(s => s.currentWidth)
    }

    // Build HLayoutSystem record
    // From MuseScore: src/engraving/style/styledef.cpp:449
    //   Sid::firstSystemIndentationValue = Spatium(5.0)
    // System 0: x shifted right by 5sp, width reduced by 5sp.
    const system: HLayoutSystem = {
      systemIndex:     sysIdx,
      pageIndex:       pageIdx,
      measureNums:     mNums,
      x:               sysX,
      y:               0,
      width:           sysUsableWidth,
      headerWidth:     sysHeaderWidth,
      currentFifths:   sysState.fifths,
      currentBeats:    sysState.beats,
      currentBeatType: sysState.beatType,
    }
    systems.push(system)
    pageSysIndices.push(sysIdx)

    // Place measures and notes — start from system.x (accounts for first-system indent)
    let measureX = sysX + sysHeaderWidth

    for (let mi = 0; mi < mNums.length; mi++) {
      const mNum  = mNums[mi]
      const m     = extMeasures[mNum - 1]
      const pad   = firstNotePads.get(mNum) ?? 0
      const segs  = allSegments.get(mNum) ?? []
      const segWs = sysSegWidths.get(mNum) ?? []
      const minMW = sysMeasureWidths.get(mNum) ?? 0
      const finalW = finalMeasureWidths[mi]

      // Distribute the justified measure width into note area
      const rawNoteArea    = segWs.reduce((s, w) => s + w, 0)
      const trailingPx     = NOTE_BAR_DIST_SP * sp
      const targetNoteArea = finalW - pad - trailingPx
      const noteScale      = rawNoteArea > 0 ? targetNoteArea / rawNoteArea : 1

      // Build HLayoutSegments with page-relative x positions
      const segments: HLayoutSegment[] = []
      let segX = measureX + pad

      for (let si = 0; si < segs.length; si++) {
        const scaledW = (segWs[si] ?? 0) * noteScale
        segments.push({
          beat:     segs[si].beat,
          duration: segs[si].durationQb,
          stretch:  computeDurationStretch(segs[si].durationQb, sysMinDur),
          x:        segX,
          width:    scaledW,
        })
        segX += scaledW
      }

      measureMap.set(mNum, {
        measureNum:  mNum,
        systemIndex: sysIdx,
        x:           measureX,
        width:       finalW,
        minWidth:    minMW,
        segments,
      })

      // Map each note to the x of its nearest beat segment
      const beatToX = new Map<number, number>()
      for (const seg of segments) beatToX.set(snapBeat(seg.beat), seg.x)

      for (const note of m.notes) {
        if (note.isGrace) continue
        const snapped  = snapBeat(note.beat)
        let bestX      = segments[0]?.x ?? measureX + pad
        let bestDiff   = Infinity
        for (const [segBeat, x] of beatToX) {
          const d = Math.abs(segBeat - snapped)
          if (d < bestDiff) { bestDiff = d; bestX = x }
        }
        noteXMap.set(note.id, bestX)
      }

      measureX += finalW
    }
  }

  if (pageSysIndices.length > 0) {
    pages.push({ pageIndex: pageIdx, systemIndices: pageSysIndices })
  }

  return { opts, systems, pages, measures: measureMap, noteX: noteXMap }
}

// ─── Helper: measure states ───────────────────────────────────────────────────

function computeMeasureStates(
  extMeasures: ExtractedMeasure[],
  metadata: { fifths: number; beats: number; beatType: number },
): MeasureState[] {
  const states: MeasureState[] = []
  let runFifths   = metadata.fifths
  let runBeats    = metadata.beats
  let runBeatType = metadata.beatType
  for (const m of extMeasures) {
    states.push({ fifths: runFifths, beats: runBeats, beatType: runBeatType })
    if (m.keyChange)  runFifths   = m.keyChange.fifths
    if (m.timeChange) { runBeats = m.timeChange.beats; runBeatType = m.timeChange.beatType }
  }
  return states
}

// ─── Helper: build MeasureSegments from notes ────────────────────────────────

/**
 * Collect unique beat positions from non-grace notes and map them to durations.
 * C++: Measure::shortestChordRest() — measure.cpp:4679, iterates ChordRest segments.
 */
function buildMeasureSegments(m: ExtractedMeasure, beatsPerMeasure: number): MeasureSegment[] {
  const beatSet = new Set<number>()
  for (const n of m.notes) {
    if (!n.isGrace && n.duration > 0) {
      beatSet.add(snapBeat(n.beat))
    }
  }

  let sortedBeats = [...beatSet].sort((a, b) => a - b)
  if (sortedBeats.length === 0) sortedBeats = [1]   // empty measure: whole rest

  const measureEndBeat = 1 + beatsPerMeasure

  return sortedBeats.map((beat, i) => {
    const nextBeat    = i + 1 < sortedBeats.length ? sortedBeats[i + 1] : measureEndBeat
    const durationQb  = nextBeat - beat
    return { beat, durationQb }
  })
}

// ─── Helper: first note padding ──────────────────────────────────────────────

/**
 * Space from barline to first notehead x in a measure.
 * Larger when key/time change occurs (accommodates the change glyphs).
 * C++: Measure::computeWidth() — measure.cpp:4165 — headerWidth per segment.
 */
function computeFirstNotePad(
  m: ExtractedMeasure,
  state: MeasureState,
  hasTimeChange: boolean,
  sp: number,
): number {
  if (m.keyChange && hasTimeChange) {
    const newFifths = m.keyChange.fifths
    const cancels   = state.fifths > 0
      ? Math.max(0, state.fifths - Math.max(0, newFifths))
      : Math.max(0, -state.fifths - Math.max(0, -newFifths))
    const totalAcc  = cancels + Math.abs(newFifths)
    return (BAR_NOTE_DIST_SP + totalAcc * KEY_ACC_STRIDE_SP + KEY_TIMESIG_DIST_SP
      + TIMESIG_GLYPH_WIDTH_SP + SYS_HDR_TIMESIG_SP) * sp
  }
  if (m.keyChange) {
    const newFifths = m.keyChange.fifths
    const cancels   = state.fifths > 0
      ? Math.max(0, state.fifths - Math.max(0, newFifths))
      : Math.max(0, -state.fifths - Math.max(0, -newFifths))
    const totalAcc  = cancels + Math.abs(newFifths)
    return (BAR_NOTE_DIST_SP + totalAcc * KEY_ACC_STRIDE_SP + KEY_TIMESIG_DIST_SP) * sp
  }
  if (hasTimeChange) {
    return (BAR_NOTE_DIST_SP + TIMESIG_GLYPH_WIDTH_SP + SYS_HDR_TIMESIG_SP) * sp
  }

  // Check if first note has accidental
  const sortedBeats = [...new Set(
    m.notes.filter(n => !n.isGrace && n.duration > 0).map(n => snapBeat(n.beat))
  )].sort((a, b) => a - b)

  const firstBeat = sortedBeats[0] ?? 1
  const firstNoteHasAcc = m.notes.some(
    n => !n.isGrace && n.duration > 0
      && Math.abs(snapBeat(n.beat) - firstBeat) < 0.01
      && n.showAccidental,
  )

  return (firstNoteHasAcc ? BAR_ACC_DIST_SP : BAR_NOTE_DIST_SP) * sp
}

// ─── Helper: system header width ─────────────────────────────────────────────

/**
 * Width of the system header (clef + optional key sig + time sig).
 * C++: System::layout() — system.cpp — computes header element positions.
 */
function computeHeaderWidth(fifths: number, sp: number): number {
  // C++: System::layout() ends the header at the right edge of the time signature glyph.
  // The gap from timeSig right to first note = SYS_HDR_TIMESIG_SP (2.0sp) is handled
  // by firstNotePad of the FIRST measure, NOT added to the header width.
  // Including SYS_HDR_TIMESIG_SP here would double-count it and push all notes 2sp too far right.
  // Verified: reference first note at sysX + (6.078sp) + (1.3sp barNoteDistance) ≈ measureX + BAR_NOTE_DIST.
  // From horizontalLayout.ts — same fix applied there.
  const hasFifths    = Math.abs(fifths) > 0
  const keySigWidthSp = Math.abs(fifths) * KEY_ACC_STRIDE_SP
  const gapAfterClef  = hasFifths
    ? CLEF_KEY_DIST_SP + keySigWidthSp + KEY_TIMESIG_DIST_SP
    : CLEF_TIMESIG_DIST_SP
  return (CLEF_LEFT_MARGIN_SP + CLEF_GLYPH_WIDTH_SP + gapAfterClef
    + TIMESIG_GLYPH_WIDTH_SP) * sp
  // NOTE: SYS_HDR_TIMESIG_SP is NOT added here. firstNotePad of the first measure provides this gap.
}

// ─── Helper: min duration ────────────────────────────────────────────────────

function findGlobalMinDur(allSegments: Map<number, MeasureSegment[]>): number {
  let min = Infinity
  for (const [, segs] of allSegments) {
    for (const seg of segs) {
      if (seg.durationQb > 0 && seg.durationQb < min) min = seg.durationQb
    }
  }
  return min
}

function findSystemMinDur(mNums: number[], allSegments: Map<number, MeasureSegment[]>): number {
  let min = Infinity
  for (const mNum of mNums) {
    const segs = allSegments.get(mNum) ?? []
    for (const seg of segs) {
      if (seg.durationQb > 0 && seg.durationQb < min) min = seg.durationQb
    }
  }
  return min
}

/**
 * Cap minimum duration at 0.25 quarter-beats (quarter note).
 * C++: measure.cpp:4196 — longNoteThreshold check
 * Prevents extreme stretching when score contains very short notes.
 */
function clampMinDur(minDur: number): number {
  if (!isFinite(minDur) || minDur <= 0) return 0.125
  return Math.min(minDur, 0.25)
}

// ─── Helper: beat snapping ───────────────────────────────────────────────────

/** Round beat to 3 decimal places to eliminate floating-point noise. */
function snapBeat(beat: number): number {
  return Math.round(beat * 1000) / 1000
}
