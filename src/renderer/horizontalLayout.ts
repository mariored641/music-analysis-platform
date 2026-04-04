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
  // A4: MuseScore defines as 8.27 × 11.69 inches (mscore/papersize.cpp)
  //   → width  = ceil(8.27  × 360) = ceil(2977.2) = 2978 px
  //   → height = ceil(11.69 × 360) = ceil(4208.4) = 4209 px
  // Margins: 15mm = 15/25.4 × 360 = 212.598... units
  // From MuseScore: src/engraving/libmscore/page.cpp:585-586
  //   double Page::tm() const { return style(Sid::pageOddTopMargin) * DPI; }
  //   = (15.0 / 25.4) * 360 = 212.5984...
  pageWidth:       2978,
  pageHeight:      4209,
  spatium:         24.8,   // 1 sp = 24.8 px (= 1.75mm at 360dpi) — MuseScore default
  marginTop:      212.6,   // From page.cpp: (15.0/25.4)*360 = 212.598 (not rounded 213)
  marginBottom:   212.6,
  marginLeft:     212.6,
  marginRight:    212.6,
  staffSpacingSp:   6.0,   // between staves in a grand staff
  systemSpacingSp:  9.5,   // empirically matches webmscore output (minSystemDistance=8.5 + page stretch ≈ +1sp)
}

// ─── Spacing constants (from RENDERER_ALGORITHMS.md §2.2) ───────────────────

/**
 * Minimum note space: noteHeadWidth + minNoteDistance (empirically calibrated to webmscore output)
 * C++ formula (measure.cpp:4174-4175): noteHeadWidth + 1.2 * minNoteDistance = 1.18 + 0.6 = 1.78sp
 * NOTE: 1.68 was empirically found to match webmscore output better than the theoretical 1.78.
 * The C++ formula also uses stretchCoeff, usrStretch, and empFactor which counterbalance each other.
 * Do NOT change without running pixel tests.
 */
const NOTE_BASE_WIDTH_SP   = 1.68  // sp — empirically calibrated (DO NOT change without testing)

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

/** G-clef glyph right edge in staff-spaces.
 * From Leland.otf (fonttools BoundsPen): gClef xMax = 2.560sp
 * C++: clef.cpp:217 → RectF r(symBbox(symId)); right() = glyph bbox right.
 * Our renderer (and webmscore reference) uses Leland → use Leland gClef.xMax.
 */
export const CLEF_GLYPH_WIDTH_SP    = 2.560

/** Gap from clef right edge to key-sig start (Sid::clefKeyDistance = 1.0sp) */
export const CLEF_KEY_DIST_SP       = 1.0

/** Gap from clef right edge to time-sig left edge when no key sig (Sid::clefTimesigDistance = 1.0sp) */
export const CLEF_TIMESIG_DIST_SP   = 1.0

/** Per-accidental stride in key signature.
 * From Leland.otf (fonttools): accidentalFlat.xMax = 0.812sp, accidentalSharp.xMax = 0.976sp.
 * Flat stride ≈ flat.xMax (no inter-accidental gap, consistent with Bravura where 0.904→0.9sp).
 * Using 0.812sp (flat) as the universal stride — sharps are slightly wider but keys are rarer.
 * TODO: differentiate flat vs sharp stride for exact keysig width.
 */
export const KEY_ACC_STRIDE_SP      = 0.812

/** Gap from key-sig right edge to time-sig left edge (Sid::keyTimesigDistance = 1.0sp) */
export const KEY_TIMESIG_DIST_SP    = 1.0

/** Time-signature digit glyph width in staff-spaces.
 * From Leland.otf (fonttools BoundsPen): timeSig4 xMax = 1.768sp
 * Used for header width calculation (no SYS_HDR_TIMESIG added) and time sig center in SVG.
 */
export const TIMESIG_GLYPH_WIDTH_SP = 1.768

/** Minimum gap from time-sig right edge to first note (Sid::systemHeaderTimeSigDistance = 2.0sp) */
export const SYS_HDR_TIMESIG_SP     = 2.0

/**
 * First-system indent in staff-spaces.
 * From MuseScore: src/engraving/style/styledef.cpp:449
 *   Sid::firstSystemIndentationValue = Spatium(5.0)
 * Applied to sysIdx === 0 only. Shifts system x right by 5sp, reducing usable width.
 */
export const FIRST_SYSTEM_INDENT_SP = 5.0

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
  /** Key signature (fifths) active at the start of this system */
  currentFifths:   number
  /** Time signature active at the start of this system */
  currentBeats:    number
  currentBeatType: number
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
  // Track running key/time state to compute firstNotePad and system headers
  const workData: MeasureWork[] = []

  // Pre-compute cumulative state at the START of each measure (before any change in that measure)
  // measureStartState[i] = { fifths, beats, beatType } at the start of measure i+1
  const measureStartState: Array<{ fifths: number; beats: number; beatType: number }> = []
  {
    let runFifths   = metadata.fifths
    let runBeats    = metadata.beats
    let runBeatType = metadata.beatType
    for (const m of extMeasures) {
      measureStartState.push({ fifths: runFifths, beats: runBeats, beatType: runBeatType })
      if (m.keyChange)  runFifths   = m.keyChange.fifths
      if (m.timeChange) { runBeats = m.timeChange.beats; runBeatType = m.timeChange.beatType }
    }
  }

  {
    for (let i = 0; i < extMeasures.length; i++) {
      const m = extMeasures[i]
      const state = measureStartState[i]
      // hasTimeChange: true if this measure introduces a new time signature
      // (i.e., the measure itself has a timeChange attribute AND it's not measure 1)
      const hasTimeChange = !!m.timeChange && i > 0
      workData.push(buildMeasureWork(m, state.beats, sp, state.fifths, hasTimeChange))
    }
  }

  // ── 2. Per-system header width helper ────────────────────────────────────
  // Layout order: barline | clefLeftMargin | gClef | (clefKeyDist | keySig | keyTimesigDist)
  //                        | clefTimesigDist | timeSig | systemHeaderTimeSigDist | firstNote
  function computeHeaderWidth(fifths: number): number {
    // C++: measure.cpp — system header width = clef + key + timeSig extents only.
    // The gap from timeSig right to the first note is handled by firstNotePad
    // (BAR_NOTE_DIST_SP), NOT by SYS_HDR_TIMESIG_SP here. Including both would
    // double-count and push notes ~2sp too far right.
    // Verified empirically: reference first note at 7.42sp from system start =
    //   (0.75 + 2.560 + 1.0 + 1.768) + 1.3 = 7.378sp ≈ 7.42sp ✓
    const hasFifths     = Math.abs(fifths) > 0
    const keySigWidthSp = Math.abs(fifths) * KEY_ACC_STRIDE_SP
    const gapAfterClef  = hasFifths
      ? CLEF_KEY_DIST_SP + keySigWidthSp + KEY_TIMESIG_DIST_SP
      : CLEF_TIMESIG_DIST_SP
    return (CLEF_LEFT_MARGIN_SP + CLEF_GLYPH_WIDTH_SP + gapAfterClef
      + TIMESIG_GLYPH_WIDTH_SP) * sp
    // Note: SYS_HDR_TIMESIG_SP is NOT added here — firstNotePad provides that gap.
  }

  // Use initial key for greedy break estimate (good enough)
  const headerWidth = computeHeaderWidth(metadata.fifths)

  // ── 3. Usable width ───────────────────────────────────────────────────────
  const usableWidth = opts.pageWidth - opts.marginLeft - opts.marginRight

  // First-system indent reduces available width for system 0 only.
  // From MuseScore: src/engraving/style/styledef.cpp:449
  //   Sid::firstSystemIndentationValue = Spatium(5.0)
  const firstSystemIndentPx  = FIRST_SYSTEM_INDENT_SP * sp
  const firstSystemUsableWidth = usableWidth - firstSystemIndentPx

  // ── 4. Initial stretch estimate using GLOBAL min duration (matches webmscore
  //    behaviour: all measures stretched as if they're in the same system with
  //    the shortest note in the score — gives realistic measure-width estimates
  //    for greedy break so that measures with long notes don't appear too narrow)
  const allMeasureNums = workData.map(md => md.num)
  applySystemStretch(allMeasureNums, workData, sp)

  // ── 5. Greedy system breaking ─────────────────────────────────────────────
  const systemGroups = greedyBreak(workData, usableWidth, headerWidth, firstSystemUsableWidth)

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

    // Compute the correct per-system headerWidth based on the key active at system start
    const firstMeasureIdx = mNums[0] - 1
    const sysState = measureStartState[firstMeasureIdx]
    const sysHeaderWidth = computeHeaderWidth(sysState.fifths)

    // From MuseScore: src/engraving/style/styledef.cpp:449
    //   Sid::firstSystemIndentationValue = Spatium(5.0)
    // System 0 starts further right, and its usable width is smaller.
    const isFirstSystem  = sysIdx === 0
    const sysX           = opts.marginLeft + (isFirstSystem ? firstSystemIndentPx : 0)
    const sysUsableWidth = isFirstSystem ? firstSystemUsableWidth : usableWidth

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

    // Stretch system → assign final widths + x-positions
    placeSystem(
      system, mNums, workData, extMeasures,
      sysUsableWidth, sysHeaderWidth, opts,
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
  hasTimeChange: boolean = false,
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
  // Budget room for inline key-signature and/or time-signature changes
  let firstNotePad: number
  if (measure.keyChange && hasTimeChange) {
    // Both key change and time change — key sig first, then time sig
    const newFifths  = measure.keyChange.fifths
    const cancels = prevFifths > 0
      ? Math.max(0, prevFifths - Math.max(0, newFifths))
      : Math.max(0, -prevFifths - Math.max(0, -newFifths))
    const totalAcc   = cancels + Math.abs(newFifths)
    firstNotePad = (BAR_NOTE_DIST_SP + totalAcc * KEY_ACC_STRIDE_SP + KEY_TIMESIG_DIST_SP
      + TIMESIG_GLYPH_WIDTH_SP + SYS_HDR_TIMESIG_SP) * sp
  } else if (measure.keyChange) {
    const newFifths  = measure.keyChange.fifths
    // Cancellation naturals: how many accidentals from the old key need to be shown as naturals
    const cancels = prevFifths > 0
      ? Math.max(0, prevFifths - Math.max(0, newFifths))   // removing some/all sharps
      : Math.max(0, -prevFifths - Math.max(0, -newFifths)) // removing some/all flats
    const totalAcc   = cancels + Math.abs(newFifths)
    firstNotePad = (BAR_NOTE_DIST_SP + totalAcc * KEY_ACC_STRIDE_SP + KEY_TIMESIG_DIST_SP) * sp
  } else if (hasTimeChange) {
    // Time signature change — budget for time sig glyph + gap to first note
    firstNotePad = (BAR_NOTE_DIST_SP + TIMESIG_GLYPH_WIDTH_SP + SYS_HDR_TIMESIG_SP) * sp
  } else {
    firstNotePad = (firstNoteHasAcc ? BAR_ACC_DIST_SP : BAR_NOTE_DIST_SP) * sp
  }

  // minWidth/rawWidth computed after applySystemStretch; use placeholder here
  return { num: measure.num, segments: segs, minWidth: 0, rawWidth: 0, firstNotePad, totalBaseNoteWidth: 0 }
}

/**
 * Phase 2: apply webmscore stretch formula globally across all measures in a system.
 * Mirrors Segment::computeDurationStretch() + Measure::computeWidth() in C++.
 *
 * C++ flow: collectSystem() passes minSysTicks/maxSysTicks to computeWidth(),
 * which calls computeDurationStretch(prevSeg, minTicks, maxTicks) per segment.
 */
function applySystemStretch(
  systemMNums: number[],
  workData: MeasureWork[],
  sp: number,
): void {
  // Find min duration across ALL segments in this system
  // C++: system->minSysTicks()
  let globalMinDuration = Infinity
  for (const mNum of systemMNums) {
    for (const seg of workData[mNum - 1].segments) {
      if (seg.duration < globalMinDuration) globalMinDuration = seg.duration
    }
  }
  if (!isFinite(globalMinDuration) || globalMinDuration <= 0) globalMinDuration = 0.125
  // Cap at quarter note: prevents over-stretching when minimum is a 32nd/64th note
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

/**
 * Compute duration stretch factor.
 * Mirrors Segment::computeDurationStretch() in segment.cpp:2812.
 *
 * C++ formula (simplified — empFactor & HACK omitted, makes things worse):
 *   double slope = score()->styleD(Sid::measureSpacing);  // 1.5
 *   double ratio = curTicks / minTicks;  (capped at 32)
 *   str = pow(slope, log2(ratio))
 *
 * NOTE: The full C++ implementation includes empFactor and a HACK for
 * scores with minTicks < 1/16 note. These were tested and made pixel
 * comparisons worse, likely because our unit system (quarter-note beats)
 * differs from C++ Ticks and other C++ factors compensate. Keeping simple.
 *
 * @param duration      Duration of this segment in quarter-note beats
 * @param minDuration   Minimum duration in the system (capped at 0.25 quarter-beats)
 */
function computeStretch(duration: number, minDuration: number): number {
  if (minDuration <= 0 || duration <= minDuration + 1e-9) return 1.0
  const ratio = Math.min(duration / minDuration, 32.0)
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
  workData:           MeasureWork[],
  usableWidth:        number,
  headerWidth:        number,
  firstSystemWidth:   number,   // usableWidth - firstSystemIndent (smaller for system 0)
): number[][] {
  const systems: number[][] = []
  let current: number[]    = []
  let currentWidth          = headerWidth

  for (const md of workData) {
    // Use rawWidth (actual spacing) for line-breaking — minWidth enforced later in placeSystem
    const mw = md.rawWidth
    // First system uses firstSystemWidth; subsequent systems use usableWidth
    const maxW = systems.length === 0 ? firstSystemWidth : usableWidth
    if (current.length > 0 && currentWidth + mw > maxW) {
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
  // MuseScore spring model: each ChordRest segment has the same preTension (= NOTE_BASE_WIDTH_SP),
  // so extra space is distributed proportionally to the NUMBER of segments, not their stretched width.
  // C++ ref: layoutsystem.cpp justifySystem() — springConst=1/stretch, preTension=width/stretch=base
  const totalSegments      = mNums.reduce((s, n) => s + workData[n - 1].segments.length, 0)

  // Slack to distribute (§2.5)
  const slack = usableWidth - headerWidth - totalMinWidth

  let measureX = system.x + headerWidth

  for (const measureNum of mNums) {
    const md  = workData[measureNum - 1]
    const ext = extMeasures[measureNum - 1]

    // Extra width for this measure, proportional to its ChordRest segment count (spring model)
    const extra = totalSegments > 0
      ? slack * (md.segments.length / totalSegments)
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
