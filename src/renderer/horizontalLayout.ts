/**
 * MAP Native Renderer — Stage 3: Horizontal Layout Engine
 *
 * Computes horizontal geometry for all measures:
 *   - Note spacing (logarithmic stretch formula, MuseScore §2.1)
 *   - Measure minimum widths
 *   - Greedy system breaking (§2.4)
 *   - System width normalisation / slack distribution (§2.5)
 *   - Note x-positions (page-relative, centre of notehead)
 *
 * Input:  ExtractedScore  (from xmlExtractor.ts)
 * Output: HorizontalLayout  (consumed by verticalLayout.ts in Stage 4)
 *
 * No y-coordinates are computed here.  All y fields are set to 0 and
 * will be filled in by verticalLayout.ts.
 */

import type { ExtractedScore, ExtractedMeasure } from './extractorTypes'
import type { RenderOptions } from './types'

// ─── Default options ────────────────────────────────────────────────────────

export const DEFAULT_RENDER_OPTIONS: Required<RenderOptions> = {
  // webmscore/MuseScore internal units: DPI=360, SPATIUM20=25.0 (5pt reference)
  // Default staff space = 1.75mm → 1.75 × (360/25.4) = 24.8 units/sp
  // A4: 210mm × 297mm = 2976 × 4209 at 360dpi
  // Margins: 15mm = 15/25.4 × 360 = 213 units
  pageWidth:       2976,
  pageHeight:      4209,
  spatium:         24.8,   // 1 sp = 24.8 px (= 1.75mm at 360dpi) — MuseScore default
  marginTop:        213,   // 15mm at 360dpi
  marginBottom:     213,
  marginLeft:       213,
  marginRight:      213,
  staffSpacingSp:   6.0,   // between staves in a grand staff
  systemSpacingSp:  9.5,   // empirically matches webmscore output (minSystemDistance=8.5 + page stretch ≈ +1sp)
}

// ─── Spacing constants (from RENDERER_ALGORITHMS.md §2.2) ───────────────────

/** Minimum segment width = noteheadWidth (~1.18sp) + minNoteDistance (0.5sp per webmscore styledef) */
const NOTE_BASE_WIDTH_SP   = 1.68  // sp; matches webmscore: noteheadBlack≈1.18sp + minNoteDistance=0.5sp

/** Distance from barline to first note (no accidental) */
export const BAR_NOTE_DIST_SP     = 1.3

/** Distance from barline to first note (with accidental) */
const BAR_ACC_DIST_SP      = 0.65

/** Trailing space at end of measure (before next barline) — webmscore noteBarDistance=1.5 */
const TRAILING_SP          = 1.5

/** Minimum measure width — small floor to not constrain normal measures */
const MIN_MEASURE_WIDTH_SP = 2.0

// ─── System header constants (webmscore styledef.cpp values) ─────────────────

/** Padding from opening barline to clef left edge (Sid::clefLeftMargin = 0.75sp) */
export const CLEF_LEFT_MARGIN_SP    = 0.75

/** G-clef glyph right edge in staff-spaces (symBbox(gClef).right ≈ 1.028sp in Bravura/Leland) */
export const CLEF_GLYPH_WIDTH_SP    = 1.0

/** Gap from clef right edge to key-sig start (Sid::clefKeyDistance = 1.0sp) */
export const CLEF_KEY_DIST_SP       = 1.0

/** Gap from clef right edge to time-sig left edge when no key sig (Sid::clefTimesigDistance = 1.0sp) */
export const CLEF_TIMESIG_DIST_SP   = 1.0

/** Per-accidental stride in key signature (symWidth + Sid::keysigAccidentalDistance ≈ 0.56+0.3=0.86 sharp / 0.64+0.3=0.94 flat; avg 0.9sp) */
export const KEY_ACC_STRIDE_SP      = 0.9

/** Gap from key-sig right edge to time-sig left edge (Sid::keyTimesigDistance = 1.0sp) */
export const KEY_TIMESIG_DIST_SP    = 1.0

/** Time-signature digit glyph width in staff-spaces (SMuFL timeSig4 bbox width ≈ 1.18sp) */
export const TIMESIG_GLYPH_WIDTH_SP = 1.18

/** Minimum gap from time-sig right edge to first note (Sid::systemHeaderTimeSigDistance = 2.0sp) */
export const SYS_HDR_TIMESIG_SP     = 2.0

// ─────────────────────────────────────────────────────────────────────────────
// Public output types
// ─────────────────────────────────────────────────────────────────────────────

export interface HorizontalLayout {
  opts:     Required<RenderOptions>
  systems:  HLayoutSystem[]
  pages:    HLayoutPage[]
  /** 1-based measureNum → layout data */
  measures: Map<number, HLayoutMeasure>
  /** noteId → x (page-relative centre of notehead) */
  noteX:    Map<string, number>
}

export interface HLayoutPage {
  pageIndex:     number
  systemIndices: number[]
}

export interface HLayoutSystem {
  systemIndex:  number
  pageIndex:    number
  /** 1-based measure numbers in this system, in order */
  measureNums:  number[]
  x:            number   // marginLeft
  y:            number   // 0; filled by verticalLayout
  width:        number   // usable content width (after margins)
  headerWidth:  number   // clef + key + time + gap
}

export interface HLayoutMeasure {
  measureNum:  number
  systemIndex: number
  x:           number   // page-relative left edge (after barline)
  width:       number   // final assigned width
  minWidth:    number   // minimum computed width (before slack distribution)
  segments:    HLayoutSegment[]
}

export interface HLayoutSegment {
  beat:     number   // 1-based beat position
  duration: number   // in beats
  stretch:  number   // stretch factor (≥ 1.0)
  x:        number   // page-relative notehead x
  width:    number   // final segment width in px
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal working types
// ─────────────────────────────────────────────────────────────────────────────

interface MeasureWork {
  num:                number
  segments:           SegWork[]
  minWidth:           number   // max(rawWidth, MIN_MEASURE_WIDTH_SP) — enforced after line break
  rawWidth:           number   // actual note spacing width (used for greedy line-breaking)
  firstNotePad:       number   // px
  totalBaseNoteWidth: number   // sum of segment baseWidths (= "note content" measure)
}

interface SegWork {
  beat:      number
  duration:  number   // in beats
  stretch:   number   // ≥ 1.0
  baseWidth: number   // px (NOTE_BASE_WIDTH_SP * stretch * sp)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export function computeHorizontalLayout(
  score: ExtractedScore,
  renderOptions?: RenderOptions,
): HorizontalLayout {
  const opts: Required<RenderOptions> = { ...DEFAULT_RENDER_OPTIONS, ...renderOptions }
  const sp = opts.spatium

  const { measures: extMeasures, metadata } = score

  // ── 1. Measure work data ──────────────────────────────────────────────────
  // Track running key (fifths) to compute cancellation-natural count for key changes
  const workData: MeasureWork[] = []
  let runningFifths = metadata.fifths
  for (const m of extMeasures) {
    const prevFifths = runningFifths
    if (m.keyChange) runningFifths = m.keyChange.fifths
    workData.push(buildMeasureWork(m, metadata.beats, sp, prevFifths))
  }

  // ── 2. System header width — based on webmscore segment spacings ─────────
  // Layout order: barline | clefLeftMargin | gClef | (clefKeyDist | keySig | keyTimesigDist)
  //                        | clefTimesigDist | timeSig | systemHeaderTimeSigDist | firstNote
  const hasFifths      = Math.abs(metadata.fifths) > 0
  const keySigWidthSp  = Math.abs(metadata.fifths) * KEY_ACC_STRIDE_SP
  const gapAfterClef   = hasFifths
    ? CLEF_KEY_DIST_SP + keySigWidthSp + KEY_TIMESIG_DIST_SP
    : CLEF_TIMESIG_DIST_SP
  const headerWidth    = (CLEF_LEFT_MARGIN_SP + CLEF_GLYPH_WIDTH_SP
    + gapAfterClef
    + TIMESIG_GLYPH_WIDTH_SP + SYS_HDR_TIMESIG_SP) * sp

  // ── 3. Usable width ───────────────────────────────────────────────────────
  const usableWidth = opts.pageWidth - opts.marginLeft - opts.marginRight

  // ── 4. Initial stretch estimate using GLOBAL min duration (matches webmscore
  //    behaviour: all measures stretched as if they're in the same system with
  //    the shortest note in the score — gives realistic measure-width estimates
  //    for greedy break so that measures with long notes don't appear too narrow)
  const allMeasureNums = workData.map(md => md.num)
  applySystemStretch(allMeasureNums, workData, sp)

  // ── 5. Greedy system breaking ─────────────────────────────────────────────
  const systemGroups = greedyBreak(workData, usableWidth, headerWidth)

  // ── 5. Rough page height estimate (for page breaking) ─────────────────────
  //  single-staff system: staffHeight (4 sp) + systemSpacing
  const sysH = (4 + opts.systemSpacingSp) * sp
  const usablePageH = opts.pageHeight - opts.marginTop - opts.marginBottom
  const maxSysPerPage = Math.max(1, Math.floor(usablePageH / sysH))

  // ── 6. Assign pages, systems, and note x-positions ───────────────────────
  const systems:      HLayoutSystem[]                = []
  const pages:        HLayoutPage[]                  = []
  const measureMap:   Map<number, HLayoutMeasure>    = new Map()
  const noteXMap:     Map<string, number>            = new Map()

  let pageIdx        = 0
  let pageSysIndices: number[] = []

  systemGroups.forEach((mNums, sysIdx) => {
    // Page break?
    if (sysIdx > 0 && pageSysIndices.length >= maxSysPerPage) {
      pages.push({ pageIndex: pageIdx, systemIndices: pageSysIndices })
      pageIdx++
      pageSysIndices = []
    }

    // Re-apply stretch using only measures in THIS system (true global-per-system)
    applySystemStretch(mNums, workData, sp)

    const system: HLayoutSystem = {
      systemIndex: sysIdx,
      pageIndex:   pageIdx,
      measureNums: mNums,
      x:           opts.marginLeft,
      y:           0,
      width:       usableWidth,
      headerWidth,
    }
    systems.push(system)
    pageSysIndices.push(sysIdx)

    // Stretch system → assign final widths + x-positions
    placeSystem(
      system, mNums, workData, extMeasures,
      usableWidth, headerWidth, opts,
      measureMap, noteXMap,
    )
  })

  if (pageSysIndices.length > 0) {
    pages.push({ pageIndex: pageIdx, systemIndices: pageSysIndices })
  }

  return { opts, systems, pages, measures: measureMap, noteX: noteXMap }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build measure work data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 1: collect segments (durations) without computing stretch/width.
 * Stretch is computed globally per-system in applySystemStretch().
 */
function buildMeasureWork(
  measure: ExtractedMeasure,
  beatsPerMeasure: number,
  sp: number,
  prevFifths: number = 0,
): MeasureWork {
  const notes = measure.notes

  // Collect unique beat positions from non-grace, non-zero-duration notes
  const beatSet = new Set<number>()
  for (const n of notes) {
    if (!n.isGrace && n.duration > 0) {
      beatSet.add(snapBeat(n.beat))
    }
  }

  let sortedBeats = [...beatSet].sort((a, b) => a - b)

  // Empty measure (e.g. whole rest): one segment spanning the whole measure
  if (sortedBeats.length === 0) {
    sortedBeats = [1]
  }

  const measureEndBeat = 1 + beatsPerMeasure

  // Build raw segments — stretch/baseWidth are placeholder, computed in applySystemStretch
  const segs: SegWork[] = sortedBeats.map((beat, i) => {
    const nextBeat = i + 1 < sortedBeats.length ? sortedBeats[i + 1] : measureEndBeat
    const duration = nextBeat - beat
    return { beat, duration, stretch: 1.0, baseWidth: 0 }
  })

  // Does the first note in this measure carry an accidental?
  const firstBeat = sortedBeats[0]
  const firstNoteHasAcc = notes.some(
    n => !n.isGrace && n.duration > 0 && Math.abs(snapBeat(n.beat) - firstBeat) < 0.01
      && n.showAccidental,
  )

  // firstNotePad: space from barline to first notehead x
  // If the measure has an inline key-signature change, budget room for it
  let firstNotePad: number
  if (measure.keyChange) {
    const newFifths  = measure.keyChange.fifths
    // Cancellation naturals: how many accidentals from the old key need to be shown as naturals
    const cancels = prevFifths > 0
      ? Math.max(0, prevFifths - Math.max(0, newFifths))   // removing some/all sharps
      : Math.max(0, -prevFifths - Math.max(0, -newFifths)) // removing some/all flats
    const totalAcc   = cancels + Math.abs(newFifths)
    firstNotePad = (BAR_NOTE_DIST_SP + totalAcc * KEY_ACC_STRIDE_SP + KEY_TIMESIG_DIST_SP) * sp
  } else {
    firstNotePad = (firstNoteHasAcc ? BAR_ACC_DIST_SP : BAR_NOTE_DIST_SP) * sp
  }

  // minWidth/rawWidth computed after applySystemStretch; use placeholder here
  return { num: measure.num, segments: segs, minWidth: 0, rawWidth: 0, firstNotePad, totalBaseNoteWidth: 0 }
}

/**
 * Phase 2: apply webmscore stretch formula (pow(1.5, log2(ratio))) globally
 * across all measures in a system, using the system's overall minimum duration.
 */
function applySystemStretch(
  systemMNums: number[],
  workData: MeasureWork[],
  sp: number,
): void {
  // Find minimum duration across ALL segments in this system
  let globalMinDuration = Infinity
  for (const mNum of systemMNums) {
    for (const seg of workData[mNum - 1].segments) {
      if (seg.duration < globalMinDuration) globalMinDuration = seg.duration
    }
  }
  if (!isFinite(globalMinDuration) || globalMinDuration <= 0) globalMinDuration = 1
  // webmscore uses 1/16 note (0.25 beats) as the minimum reference unit for stretch,
  // regardless of what notes actually appear in the score (e.g. all-quarter scores).
  // This ensures quarter notes always get stretch ≥ pow(1.5, log2(4)) = 2.25×.
  globalMinDuration = Math.min(globalMinDuration, 0.25)

  for (const mNum of systemMNums) {
    const md = workData[mNum - 1]
    for (const seg of md.segments) {
      seg.stretch   = computeStretch(seg.duration, globalMinDuration)
      seg.baseWidth = seg.stretch * NOTE_BASE_WIDTH_SP * sp
    }
    md.totalBaseNoteWidth = md.segments.reduce((s, seg) => s + seg.baseWidth, 0)
    md.rawWidth = md.firstNotePad + md.totalBaseNoteWidth + TRAILING_SP * sp
    md.minWidth = Math.max(md.rawWidth, MIN_MEASURE_WIDTH_SP * sp)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stretch formula  (webmscore/MuseScore: pow(slope, log2(ratio)), slope=1.5)
// ─────────────────────────────────────────────────────────────────────────────

const MEASURE_SPACING_SLOPE = 1.5  // Sid::measureSpacing default in webmscore

function computeStretch(duration: number, minDuration: number): number {
  if (minDuration <= 0 || duration <= minDuration + 1e-9) return 1.0
  const ratio = Math.min(duration / minDuration, 32.0)  // cap at 32 like webmscore
  return Math.pow(MEASURE_SPACING_SLOPE, Math.log2(ratio))
}

/** Snap beat to 3 decimal places to avoid float noise */
function snapBeat(beat: number): number {
  return Math.round(beat * 1000) / 1000
}

// ─────────────────────────────────────────────────────────────────────────────
// Greedy system breaking  (RENDERER_ALGORITHMS.md §2.4)
// ─────────────────────────────────────────────────────────────────────────────

function greedyBreak(
  workData: MeasureWork[],
  usableWidth: number,
  headerWidth: number,
): number[][] {
  const systems: number[][] = []
  let current: number[]    = []
  let currentWidth          = headerWidth

  for (const md of workData) {
    // Use rawWidth (actual spacing) for line-breaking — minWidth enforced later in placeSystem
    const mw = md.rawWidth
    if (current.length > 0 && currentWidth + mw > usableWidth) {
      // Close the current system, start a new one
      systems.push(current)
      current      = [md.num]
      currentWidth = headerWidth + mw
    } else {
      current.push(md.num)
      currentWidth += mw
    }
  }

  if (current.length > 0) systems.push(current)
  return systems
}

// ─────────────────────────────────────────────────────────────────────────────
// Place all notes within a system (slack distribution + x-coordinates)
// ─────────────────────────────────────────────────────────────────────────────

function placeSystem(
  system:       HLayoutSystem,
  mNums:        number[],
  workData:     MeasureWork[],
  extMeasures:  ExtractedMeasure[],
  usableWidth:  number,
  headerWidth:  number,
  opts:         Required<RenderOptions>,
  measureMap:   Map<number, HLayoutMeasure>,
  noteXMap:     Map<string, number>,
): void {
  const sp = opts.spatium

  // Total minimum note content across this system's measures
  const totalMinWidth      = mNums.reduce((s, n) => s + workData[n - 1].minWidth, 0)
  const totalNoteContent   = mNums.reduce((s, n) => s + workData[n - 1].totalBaseNoteWidth, 0)

  // Slack to distribute (§2.5)
  const slack = usableWidth - headerWidth - totalMinWidth

  let measureX = opts.marginLeft + headerWidth

  for (const measureNum of mNums) {
    const md  = workData[measureNum - 1]
    const ext = extMeasures[measureNum - 1]

    // Extra width for this measure, proportional to its note content
    const extra = totalNoteContent > 0
      ? slack * (md.totalBaseNoteWidth / totalNoteContent)
      : slack / mNums.length

    // Scale segments proportionally so that their sum fills the extra note area
    const finalNoteArea = md.totalBaseNoteWidth + extra
    const noteScale     = md.totalBaseNoteWidth > 0
      ? finalNoteArea / md.totalBaseNoteWidth
      : 1

    // Build final segments with page-relative x-coordinates
    const segments: HLayoutSegment[] = []
    let segX = measureX + md.firstNotePad
    for (const raw of md.segments) {
      const finalW = raw.baseWidth * noteScale
      segments.push({
        beat:     raw.beat,
        duration: raw.duration,
        stretch:  raw.stretch,
        x:        segX,
        width:    finalW,
      })
      segX += finalW
    }

    const finalMeasureWidth = md.firstNotePad + finalNoteArea + TRAILING_SP * sp

    measureMap.set(measureNum, {
      measureNum,
      systemIndex: system.systemIndex,
      x:        measureX,
      width:    finalMeasureWidth,
      minWidth: md.minWidth,
      segments,
    })

    // Map notes to their segment's x (nearest beat)
    const beatToX = new Map<number, number>()
    for (const seg of segments) beatToX.set(seg.beat, seg.x)

    for (const note of ext.notes) {
      if (note.isGrace) continue
      const snapped = snapBeat(note.beat)
      let bestX   = segments[0]?.x ?? measureX + md.firstNotePad
      let bestDiff = Infinity
      for (const [segBeat, x] of beatToX) {
        const d = Math.abs(segBeat - snapped)
        if (d < bestDiff) { bestDiff = d; bestX = x }
      }
      noteXMap.set(note.id, bestX)
    }

    measureX += finalMeasureWidth
  }
}
