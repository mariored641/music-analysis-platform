/**
 * Debug script: compare our layout with reference for a specific fixture.
 */
import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser

import { readFileSync } from 'fs'
import { runPipeline, loadReferenceData } from './pipeline/harness.js'

const fixtureId = process.argv[2] || '05-stems'
const ref = loadReferenceData(fixtureId)
const { hLayout, rendered } = runPipeline(fixtureId)

console.log('=== OUR LAYOUT ===')
for (const sys of hLayout.systems) {
  console.log(`sys${sys.systemIndex}: x=${sys.x.toFixed(1)} w=${sys.width.toFixed(1)} hdr=${sys.headerWidth.toFixed(1)} measures=${JSON.stringify(sys.measureNums)}`)
}

console.log('\nOur measures:')
for (const [n, m] of [...hLayout.measures.entries()].sort((a, b) => a[0] - b[0])) {
  const segStrs = m.segments.map((s: any) => `b${s.beat}:${s.width.toFixed(1)}`).join(' ')
  console.log(`  m${n}: x=${m.x.toFixed(1)} w=${m.width.toFixed(1)} minW=${m.minWidth.toFixed(1)} segs=[${segStrs}]`)
}

console.log('\n=== REFERENCE ===')
console.log('Ref measures:')
for (const m of ref.measures) {
  console.log(`  m${m.id}: x=${m.x.toFixed(1)} sx=${m.sx.toFixed(1)}`)
}

// Compare per-measure widths
console.log('\n=== MEASURE WIDTH COMPARISON ===')
for (const refM of ref.measures) {
  const mNum = refM.id + 1
  const ourM = hLayout.measures.get(mNum)
  if (!ourM) { console.log(`  m${mNum}: MISSING`); continue }

  // For first measure, add header width
  const sys = hLayout.systems[ourM.systemIndex]
  const isFirst = sys.measureNums[0] === mNum
  const ourW = isFirst ? ourM.width + sys.headerWidth : ourM.width
  const diff = ourW - refM.sx
  console.log(`  m${mNum}: ours=${ourW.toFixed(1)} ref=${refM.sx.toFixed(1)} Δ=${diff.toFixed(1)}px`)
}

// Compare note positions
console.log('\n=== NOTE POSITION COMPARISON ===')
const notes = rendered.allNotes.filter((n: any) => !n.isRest && !n.isGrace).sort((a: any, b: any) => a.measureNum - b.measureNum || a.beat - b.beat)

// Group ref notes by measure (using x-ranges)
const refMeasureRanges = ref.measures.map((m: any) => ({ id: m.id + 1, x: m.x, x2: m.x + m.sx, y: m.y }))

for (const ourNote of notes.slice(0, 20)) {
  // Find matching ref note
  const refNotesInMeasure = ref.notes
    .filter((rn: any) => {
      const mr = refMeasureRanges.find(r => rn.x >= r.x - 5 && rn.x <= r.x2 + 5 && Math.abs(rn.y - r.y) < 200)
      return mr && mr.id === ourNote.measureNum
    })
    .sort((a: any, b: any) => a.x - b.x)

  const ourNotesInMeasure = notes.filter((n: any) => n.measureNum === ourNote.measureNum).sort((a: any, b: any) => a.beat - b.beat)
  const idx = ourNotesInMeasure.indexOf(ourNote)
  const refNote = refNotesInMeasure[idx]

  if (refNote) {
    console.log(`  ${ourNote.noteId}: x=${ourNote.x.toFixed(1)} ref=${refNote.x.toFixed(1)} Δ=${(ourNote.x - refNote.x).toFixed(1)}`)
  } else {
    console.log(`  ${ourNote.noteId}: x=${ourNote.x.toFixed(1)} ref=???`)
  }
}
