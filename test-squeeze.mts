import { collectSystems, computeMeasureSqueezable } from './src/renderer/engine/layout/LayoutSystem.ts'
import { computeSegmentWidths, computeMeasureWidth } from './src/renderer/engine/layout/LayoutMeasure.ts'

const sp = 24.8
const minDur = 0.25

function makeSegs(durationQb: number, count: number) {
  return Array.from({length: count}, (_: unknown, i: number) => ({ beat: 1 + i * durationQb, durationQb }))
}

const msData = [
  { num: 1, segs: makeSegs(4, 1) },
  { num: 2, segs: makeSegs(2, 2) },
  { num: 3, segs: makeSegs(1, 4) },
  { num: 4, segs: makeSegs(0.5, 8) },
  { num: 5, segs: makeSegs(0.25, 16) },
]

const measureWidths = new Map<number, number>()
const squeezable = new Map<number, number>()

for (const { num, segs } of msData) {
  const pad = 1.3 * sp
  const segWs = computeSegmentWidths(segs, minDur, sp)
  const mw = computeMeasureWidth(pad, segWs, sp)
  const sq = computeMeasureSqueezable(segWs, sp)
  measureWidths.set(num, mw)
  squeezable.set(num, sq)
  console.log('M' + num + ': width=' + mw.toFixed(1) + 'px, squeezable=' + sq.toFixed(1) + 'px')
}

const headerWidth = 150.6
const usableWidth = 2552.8
const firstSysWidth = 2552.8 - 5*24.8

console.log('\nusableWidth:', usableWidth, 'firstSysWidth:', firstSysWidth)

const noSqueeze = collectSystems(measureWidths, headerWidth, usableWidth, firstSysWidth)
const withSqueeze = collectSystems(measureWidths, headerWidth, usableWidth, firstSysWidth, squeezable)

console.log('Without squeeze:', JSON.stringify(noSqueeze))
console.log('With squeeze:', JSON.stringify(withSqueeze))
