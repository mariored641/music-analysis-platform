/**
 * Debug: trace collectSystemsIncremental decisions
 */
import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser

import { runPipeline } from './pipeline/harness.js'
import {
  computeSegmentWidths, computeMeasureWidth, computeDurationStretch,
} from '../src/renderer/engine/layout/LayoutMeasure.js'

const fixtureId = process.argv[2] || '03-rests'
const { hLayout } = runPipeline(fixtureId)
const spatium = hLayout.opts.spatium

const SQUEEZABILITY = 0.3
const MIN_HORIZ_DIST_SP = 1.2
const minHorizPx = MIN_HORIZ_DIST_SP * spatium
const minMeasureWidthPx = 8.0 * spatium

// Rebuild measure data
const allSegs = new Map<number, any[]>()
const allPads = new Map<number, number>()
const measMinDurs = new Map<number, number>()
const measMaxDurs = new Map<number, number>()

for (const [mNum, mData] of hLayout.measures) {
  allSegs.set(mNum, mData.segments)
  allPads.set(mNum, mData.firstNotePad)
  let minD = Infinity, maxD = 0
  for (const s of mData.segments) {
    if (s.durQb < minD) minD = s.durQb
    if (s.durQb > maxD) maxD = s.durQb
  }
  measMinDurs.set(mNum, minD)
  measMaxDurs.set(mNum, maxD)
}

// Simulate incremental collection with verbose output
const mNums = [...allSegs.keys()].sort((a, b) => a - b)
let currentSystem: number[] = []
let curSysWidth = hLayout.systems[0].headerWidth
let minTicks = Infinity, maxTicks = 0
let prevMinTicks = Infinity, prevMaxTicks = 0
const headerWidth = hLayout.systems[0].headerWidth
const usableWidth = hLayout.systems[0].width

console.log(`\n=== ${fixtureId} ===`)
console.log(`usableWidth=${usableWidth.toFixed(1)} headerWidth=${headerWidth.toFixed(1)} spatium=${spatium.toFixed(2)}`)

for (const mNum of mNums) {
  const curMinDur = measMinDurs.get(mNum)!
  const curMaxDur = measMaxDurs.get(mNum)!

  let minChanged = curMinDur < minTicks
  let maxChanged = curMaxDur > maxTicks

  if (minChanged) { prevMinTicks = minTicks; minTicks = curMinDur }
  if (maxChanged) { prevMaxTicks = maxTicks; maxTicks = curMaxDur }

  if ((minChanged || maxChanged) && currentSystem.length > 0) {
    let w = headerWidth
    for (const p of currentSystem) {
      const segs = allSegs.get(p)!
      const pad = allPads.get(p)!
      const segWs = computeSegmentWidths(segs, minTicks, spatium, maxTicks)
      w += computeMeasureWidth(pad, segWs, spatium)
    }
    curSysWidth = w
    console.log(`  [recompute after min/maxChanged] curSysWidth=${curSysWidth.toFixed(1)}`)
  }

  const segs = allSegs.get(mNum)!
  const pad = allPads.get(mNum)!
  const segWs = computeSegmentWidths(segs, minTicks, spatium, maxTicks)
  const ww = computeMeasureWidth(pad, segWs, spatium)

  if (currentSystem.length === 0) {
    currentSystem.push(mNum)
    curSysWidth += ww
    console.log(`m${mNum}: first in sys, w=${ww.toFixed(1)}, curSysWidth=${curSysWidth.toFixed(1)}, minTicks=${minTicks}, maxTicks=${maxTicks}`)
  } else {
    // Compute squeezable with candidate included
    const tentMeasures = [...currentSystem, mNum]
    let tentSq = 0
    for (const m of tentMeasures) {
      const s = allSegs.get(m)!
      const p = allPads.get(m)!
      const sw = computeSegmentWidths(s, minTicks, spatium, maxTicks)
      let mSq = sw.reduce((sum: number, w: number) => sum + Math.max(0, w - minHorizPx), 0)
      const mW = computeMeasureWidth(p, sw, spatium)
      mSq = Math.max(0, Math.min(mSq, mW - minMeasureWidthPx))
      tentSq += mSq
    }

    const acceptance = SQUEEZABILITY * tentSq
    const doBreak = (curSysWidth + ww) > usableWidth + acceptance

    console.log(`m${mNum}: w=${ww.toFixed(1)}, total=${(curSysWidth+ww).toFixed(1)} vs limit=${(usableWidth+acceptance).toFixed(1)} (usable=${usableWidth.toFixed(1)} + accept=${acceptance.toFixed(1)}, sq=${tentSq.toFixed(1)}), minD=${curMinDur} maxD=${curMaxDur}, sysMin=${minTicks} sysMax=${maxTicks} → ${doBreak ? 'BREAK' : 'fit'}`)

    if (doBreak) {
      if (minChanged) minTicks = prevMinTicks
      if (maxChanged) maxTicks = prevMaxTicks
      console.log(`  → system=[${currentSystem}], finalMin=${minTicks} finalMax=${maxTicks}`)

      currentSystem = [mNum]
      minTicks = curMinDur
      maxTicks = curMaxDur
      const newSegWs = computeSegmentWidths(segs, minTicks, spatium, maxTicks)
      curSysWidth = headerWidth + computeMeasureWidth(pad, newSegWs, spatium)
      console.log(`  new sys start m${mNum}: curSysWidth=${curSysWidth.toFixed(1)}`)
    } else {
      currentSystem.push(mNum)
      curSysWidth += ww
    }
  }
}
console.log(`  → final system=[${currentSystem}], min=${minTicks} max=${maxTicks}`)
