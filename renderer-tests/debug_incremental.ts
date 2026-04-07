/**
 * Debug: trace incremental system building
 */
import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser

import { runPipeline } from './pipeline/harness.js'
import {
  computeSegmentWidths, computeMeasureWidth, computeDurationStretch,
} from '../src/renderer/engine/layout/LayoutMeasure.js'

const fixtureId = process.argv[2] || '01-noteheads'
const { hLayout } = runPipeline(fixtureId)

console.log(`\n=== ${fixtureId} ===`)
console.log('Systems:', hLayout.systems.map(s => `sys${s.systemIndex}:${JSON.stringify(s.measureNums)}`).join(' | '))

for (const sys of hLayout.systems) {
  let total = 0
  for (const mn of sys.measureNums) {
    const m = hLayout.measures.get(mn)!
    total += m.width
    console.log(`  m${mn}: w=${m.width.toFixed(1)} minW=${m.minWidth.toFixed(1)} segs=${m.segments.length}`)
  }
  console.log(`  SYS${sys.systemIndex} total=${total.toFixed(1)} header=${sys.headerWidth.toFixed(1)} sysW=${sys.width.toFixed(1)}`)
}

// Test empFactor values
console.log('\nempFactor sanity check:')
for (const [min, max] of [[4,4], [0.5,4], [0.25,4], [1,4], [2,4]]) {
  const s = computeDurationStretch(4.0, min, max)
  console.log(`  whole(4qb) min=${min} max=${max} → stretch=${s.toFixed(3)}`)
}
