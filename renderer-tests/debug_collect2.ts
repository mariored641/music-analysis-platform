import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser
import { runPipeline } from './pipeline/harness.js'
import {
  computeSegmentWidths, computeMeasureWidth, computeDurationStretch,
  type MeasureSegment,
} from '../src/renderer/engine/layout/LayoutMeasure.js'
import { computeHeaderWidth, buildMeasureSegments, computeFirstNotePad } from '../src/renderer/engine/LayoutOrchestrator.js'

const fixtureId = process.argv[2] || '03-rests'
const { hLayout, extracted } = runPipeline(fixtureId)

const sp = hLayout.opts.spatium
const SQUEEZABILITY = 0.3
const MIN_HORIZ_DIST_SP = 1.2
const minHorizPx = MIN_HORIZ_DIST_SP * sp
const minMeasureWidthPx = 8.0 * sp

const headerWidth = hLayout.systems[0].headerWidth
const usableWidth = hLayout.systems[0].width + headerWidth  // systems[0].width is usable minus header? no...

// Actually look at how the orchestrator computes usableWidth
const opts = hLayout.opts
const realUsableWidth = opts.pageWidth - opts.marginLeft - opts.marginRight
const firstSysIndent = 5.0 * sp
const firstSysUsable = realUsableWidth - firstSysIndent

console.log(`=== ${fixtureId} ===`)
console.log(`sp=${sp.toFixed(2)} pageWidth=${opts.pageWidth} margins=${opts.marginLeft}+${opts.marginRight}`)
console.log(`realUsableWidth=${realUsableWidth.toFixed(1)} firstSysUsable=${firstSysUsable.toFixed(1)}`)
console.log(`headerWidth=${headerWidth.toFixed(1)} sys0.width=${hLayout.systems[0].width.toFixed(1)}`)

// Build raw segments like the orchestrator does
const measureStartState: any[] = []
const score = extracted
const extMeasures = score.measures

// Compute measure start states
let curFifths = score.metadata.fifths
let curBeats = score.metadata.beats
let curBeatType = score.metadata.beatType
for (let i = 0; i < extMeasures.length; i++) {
  measureStartState.push({ fifths: curFifths, beats: curBeats, beatType: curBeatType })
  const m = extMeasures[i]
  if (m.keyChange) curFifths = m.keyChange.fifths
  if (m.timeChange) { curBeats = m.timeChange.beats; curBeatType = m.timeChange.beatType }
}

const allSegments = new Map<number, MeasureSegment[]>()
const firstNotePads = new Map<number, number>()
const measureMinDurs = new Map<number, number>()
const measureMaxDurs = new Map<number, number>()

for (let i = 0; i < extMeasures.length; i++) {
  const m = extMeasures[i]
  const state = measureStartState[i]
  const hasTimeChange = !!m.timeChange && i > 0
  allSegments.set(m.num, buildMeasureSegments(m, state.beats))
  firstNotePads.set(m.num, computeFirstNotePad(m, state, hasTimeChange, sp))
}

for (const [mNum, segs] of allSegments) {
  let minD = Infinity, maxD = 0
  for (const seg of segs) {
    if (seg.durationQb > 0) {
      if (seg.durationQb < minD) minD = seg.durationQb
      if (seg.durationQb > maxD) maxD = seg.durationQb
    }
  }
  if (!isFinite(minD)) minD = 1.0
  if (maxD <= 0) maxD = 1.0
  measureMinDurs.set(mNum, minD)
  measureMaxDurs.set(mNum, maxD)
  console.log(`  m${mNum}: segs=${segs.length} minD=${minD} maxD=${maxD}`)
}

// Simulate incremental system building
console.log('\n--- Incremental system building ---')
const mNums = [...allSegments.keys()].sort((a, b) => a - b)
let currentSystem: number[] = []
let curSysWidth = headerWidth
let minTicks = Infinity, maxTicks = 0
let prevMinTicks = Infinity, prevMaxTicks = 0

const recomputeWidth = () => {
  let w = headerWidth
  for (const mNum of currentSystem) {
    const segs = allSegments.get(mNum)!
    const pad = firstNotePads.get(mNum)!
    const segWs = computeSegmentWidths(segs, minTicks, sp, maxTicks)
    w += computeMeasureWidth(pad, segWs, sp)
  }
  return w
}

for (const mNum of mNums) {
  const curMinDur = measureMinDurs.get(mNum)!
  const curMaxDur = measureMaxDurs.get(mNum)!

  let minChanged = curMinDur < minTicks
  let maxChanged = curMaxDur > maxTicks

  if (minChanged) { prevMinTicks = minTicks; minTicks = curMinDur }
  if (maxChanged) { prevMaxTicks = maxTicks; maxTicks = curMaxDur }

  if ((minChanged || maxChanged) && currentSystem.length > 0) {
    curSysWidth = recomputeWidth()
  }

  const segs = allSegments.get(mNum)!
  const pad = firstNotePads.get(mNum)!
  const segWs = computeSegmentWidths(segs, minTicks, sp, maxTicks)
  const ww = computeMeasureWidth(pad, segWs, sp)

  // First system indent
  const sysIdx = 0 // during collection we don't know final sysIdx; this simulates sys0
  const maxW = currentSystem.length === 0 || sysIdx === 0 ? firstSysUsable : realUsableWidth

  if (currentSystem.length === 0) {
    currentSystem.push(mNum)
    curSysWidth += ww
    console.log(`m${mNum}: first, w=${ww.toFixed(1)}, curSys=${curSysWidth.toFixed(1)}, maxW=${maxW.toFixed(1)}, min=${minTicks} max=${maxTicks}`)
  } else {
    // Compute squeezable
    const tentMeasures = [...currentSystem, mNum]
    let tentSq = 0
    for (const m of tentMeasures) {
      const s = allSegments.get(m)!
      const p = firstNotePads.get(m)!
      const sw = computeSegmentWidths(s, minTicks, sp, maxTicks)
      let mSq = sw.reduce((sum, w) => sum + Math.max(0, w - minHorizPx), 0)
      const mW = computeMeasureWidth(p, sw, sp)
      mSq = Math.max(0, Math.min(mSq, mW - minMeasureWidthPx))
      tentSq += mSq
    }

    const acceptance = SQUEEZABILITY * tentSq
    const doBreak = (curSysWidth + ww) > maxW + acceptance

    console.log(`m${mNum}: w=${ww.toFixed(1)}, total=${(curSysWidth+ww).toFixed(1)} vs limit=${(maxW+acceptance).toFixed(1)} (maxW=${maxW.toFixed(1)} accept=${acceptance.toFixed(1)}) min=${minTicks} max=${maxTicks} → ${doBreak ? 'BREAK' : 'fit'}`)

    if (doBreak) {
      if (minChanged) minTicks = prevMinTicks
      if (maxChanged) maxTicks = prevMaxTicks
      console.log(`  → sys=[${currentSystem}]`)
      currentSystem = [mNum]
      minTicks = curMinDur
      maxTicks = curMaxDur
      const newSegWs = computeSegmentWidths(segs, minTicks, sp, maxTicks)
      curSysWidth = headerWidth + computeMeasureWidth(pad, newSegWs, sp)
    } else {
      currentSystem.push(mNum)
      curSysWidth += ww
    }
  }
}
console.log(`  → final sys=[${currentSystem}]`)
