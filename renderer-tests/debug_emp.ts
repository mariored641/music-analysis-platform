/**
 * Debug: trace empFactor and incremental system building
 */
import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser

import { runPipeline } from './pipeline/harness.js'
import { computeDurationStretch, computeSegmentWidths } from '../src/renderer/engine/layout/LayoutMeasure.js'

const fixtureId = process.argv[2] || '01-noteheads'
const { hLayout } = runPipeline(fixtureId)

console.log('Systems:')
for (const sys of hLayout.systems) {
  console.log(`  sys${sys.systemIndex}: measures=${JSON.stringify(sys.measureNums)}`)
}

console.log('\nMeasures:')
for (const [n, m] of [...hLayout.measures.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  m${n}: w=${m.width.toFixed(1)} minW=${m.minWidth.toFixed(1)} segs=${m.segments.length}`)
}

// Test empFactor at various minDur values
console.log('\nempFactor test (dur, minDur, maxDur=4.0):')
for (const minDur of [0.25, 0.5, 1.0, 2.0, 4.0]) {
  for (const dur of [0.25, 0.5, 1.0, 2.0, 4.0]) {
    if (dur < minDur) continue
    const stretch = computeDurationStretch(dur, minDur, 4.0)
    console.log(`  dur=${dur} minDur=${minDur} → stretch=${stretch.toFixed(3)}`)
  }
}

// m1 (whole=4qb) segment width at various system minDurs
console.log('\nm1 segment width (whole=4qb) at various minDurs:')
const sp = 24.8
for (const minDur of [0.25, 0.5, 1.0, 2.0, 4.0]) {
  const segWs = computeSegmentWidths([{ beat: 1, durationQb: 4.0 }], minDur, sp, 4.0)
  console.log(`  minDur=${minDur} → segW=${segWs[0].toFixed(1)}px (${(segWs[0]/sp).toFixed(2)}sp)`)
}
