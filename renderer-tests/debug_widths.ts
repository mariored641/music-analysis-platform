/**
 * Debug: compare our measure widths with reference per system
 */
import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser

import { runPipeline } from './pipeline/harness.js'
import { loadReferenceData } from './pipeline/harness.js'

const fixtureId = process.argv[2] || '02-accidentals'
const { hLayout } = runPipeline(fixtureId)
const ref = loadReferenceData(fixtureId)

console.log(`\n=== ${fixtureId} ===`)
console.log(`Systems: ${hLayout.systems.length} (ours) vs ${ref.measures?.systems?.length ?? '?'} (ref)`)

// Get reference measure data
const refMeasures = ref.measures?.measures ?? []

for (const sys of hLayout.systems) {
  const sysIdx = sys.systemIndex
  console.log(`\nSystem ${sysIdx}: measures=${JSON.stringify(sys.measureNums)}`)

  let totalOurs = 0
  let totalRef = 0

  for (const mNum of sys.measureNums) {
    const m = hLayout.measures.get(mNum)
    if (!m) continue

    const refM = refMeasures.find((r: any) => r.measureNum === mNum)
    const refW = refM?.width ?? -1
    const delta = refW >= 0 ? (m.width - refW).toFixed(1) : '?'
    const sign = refW >= 0 && m.width > refW ? '+' : ''

    totalOurs += m.width
    if (refW >= 0) totalRef += refW

    console.log(`  m${mNum}: ours=${m.width.toFixed(1)}px ref=${refW >= 0 ? refW.toFixed(1) : '?'}px  Δ=${sign}${delta}px  segs=${m.segments.length}`)
  }

  console.log(`  TOTAL: ours=${totalOurs.toFixed(1)} ref=${totalRef.toFixed(1)} Δ=${(totalOurs-totalRef).toFixed(1)} header=${sys.headerWidth.toFixed(1)} sysW=${sys.width.toFixed(1)}`)
}

// Show minDur info
const allSegs = new Map<number, any[]>()
for (const [mNum, m] of hLayout.measures) {
  allSegs.set(mNum, m.segments)
}
let globalMin = Infinity
for (const [, segs] of allSegs) {
  for (const s of segs) {
    if (s.duration > 0 && s.duration < globalMin) globalMin = s.duration
  }
}
console.log(`\nglobalMinDur: ${globalMin}qb (clamped: ${Math.min(globalMin, 0.25)})`)
