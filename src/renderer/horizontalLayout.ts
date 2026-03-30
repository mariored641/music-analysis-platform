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
  pageWidth:        794,   // A4 portrait @ 96 dpi
  pageHeight:      1123,
  spatium:           10,   // 1 sp = 10 px
  marginTop:         48,
  marginBottom:      48,
  marginLeft:        48,
  marginRight:       48,
  staffSpacingSp:   6.0,   // between staves in a grand staff
  systemSpacingSp:  8.0,   // between systems
}

// ─── Spacing constants (from RENDERER_ALGORITHMS.md §2.2) ───────────────────

/** Notehead width multiplier — base unit for the stretch formula */
const NOTE_BASE_WIDTH_SP   = 1.2   // sp; empirically chosen for readable results

/** Distance from barline to first note (no accidental) */
const BAR_NOTE_DIST_SP     = 1.3

/** Distance from barline to first note (with accidental) */
const BAR_ACC_DIST_SP      = 0.65

/** Trailing space at end of measure (before next barline) */
const TRAILING_SP          = 0.5

/** Minimum measure width */
const MIN_MEASURE_WIDTH_SP = 5.0

/** Clef symbol width */
const CLEF_WIDTH_PX        = 32

/** Width per key-signature accidental */
const KEY_ACC_WIDTH_PX     = 7

/** Time-signature width */
const TIME_SIG_WIDTH_PX    = 24

/** Gap between time sig and first note */
const HEADER_GAP_PX        = 8

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
  minWidth:           number   // firstNotePad + sum(baseWidths) + trailing
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
  const workData: MeasureWork[] = extMeasures.map(m =>
    buildMeasureWork(m, metadata.beats, sp),
  )

  // ── 2. System header width (clef + key + time + gap) ──────────────────────
  const headerWidth = CLEF_WIDTH_PX
    + Math.abs(metadata.fifths) * KEY_ACC_WIDTH_PX
    + TIME_SIG_WIDTH_PX
    + HEADER_GAP_PX

  // ── 3. Usable width ───────────────────────────────────────────────────────
  const usableWidth = opts.pageWidth - opts.marginLeft - opts.marginRight

  // ── 4. Greedy system breaking ─────────────────────────────────────────────
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

function buildMeasureWork(
  measure: ExtractedMeasure,
  beatsPerMeasure: number,
  sp: number,
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

  // Build raw segments
  const segs: SegWork[] = sortedBeats.map((beat, i) => {
    const nextBeat  = i + 1 < sortedBeats.length ? sortedBeats[i + 1] : measureEndBeat
    const duration  = nextBeat - beat
    return { beat, duration, stretch: 1.0, baseWidth: 0 }
  })

  // Compute stretch values
  const minDuration = segs.reduce((m, s) => Math.min(m, s.duration), Infinity)
  for (const seg of segs) {
    seg.stretch    = computeStretch(seg.duration, minDuration)
    seg.baseWidth  = seg.stretch * NOTE_BASE_WIDTH_SP * sp
  }

  const totalBaseNoteWidth = segs.reduce((s, seg) => s + seg.baseWidth, 0)

  // Does the first note in this measure carry an accidental?
  const firstBeat = sortedBeats[0]
  const firstNoteHasAcc = notes.some(
    n => !n.isGrace && n.duration > 0 && Math.abs(snapBeat(n.beat) - firstBeat) < 0.01
      && n.showAccidental,
  )
  const firstNotePad = (firstNoteHasAcc ? BAR_ACC_DIST_SP : BAR_NOTE_DIST_SP) * sp

  const rawWidth  = firstNotePad + totalBaseNoteWidth + TRAILING_SP * sp
  const minWidth  = Math.max(rawWidth, MIN_MEASURE_WIDTH_SP * sp)

  return { num: measure.num, segments: segs, minWidth, firstNotePad, totalBaseNoteWidth }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stretch formula  (MuseScore §2.1)
// ─────────────────────────────────────────────────────────────────────────────

function computeStretch(duration: number, minDuration: number): number {
  if (minDuration <= 0 || duration <= minDuration + 1e-9) return 1.0
  return 1.0 + 0.865617 * Math.log2(duration / minDuration)
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
    const mw = md.minWidth
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
