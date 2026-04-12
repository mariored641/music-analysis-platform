import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser

import { loadFixtureXml } from './pipeline/harness'
import { extractScore } from '../src/renderer/xmlExtractor'
import { orchestrateHorizontalLayout } from '../src/renderer/engine/LayoutOrchestrator'

const fixtureId = process.argv[2] || '01-noteheads'
const xml = loadFixtureXml(fixtureId)
const extracted = extractScore(xml)
// Also trace incremental system building
import { computeSegmentWidths, computeMeasureWidth, computeDurationStretch } from '../src/renderer/engine/layout/LayoutMeasure'
import { collectSystemsIncremental } from '../src/renderer/engine/layout/LayoutSystem'

// Monkey-patch collectSystemsIncremental for debug
const origCollect = (await import('../src/renderer/engine/layout/LayoutSystem')).collectSystemsIncremental
const debugCollect = (...args: Parameters<typeof origCollect>) => {
  // Run original and capture result
  return origCollect(...args)
}

;(globalThis as any).__DEBUG_SYSTEM_BREAK = (fixtureId === '03-rests' || fixtureId === '07-time-signatures')
const hLayout = orchestrateHorizontalLayout(extracted)
;(globalThis as any).__DEBUG_SYSTEM_BREAK = false

// Manual trace of system building
if (fixtureId === '03-rests') {
  const sp = 24.8
  // Measure durations from the extracted data
  console.log('Extracted measures:', Object.keys(extracted))
  const measures = (extracted as any).measures || []
  for (const m of measures) {
    const notes = m.notes || []
    const durations = notes.map((n: any) => n.duration)
    console.log(`m${m.measureNum}: notes=${durations.length} durs=[${durations.join(',')}]`)
  }
}
console.log('Systems:', hLayout.systems.length)
for (const sys of hLayout.systems) {
  console.log('Sys', JSON.stringify(sys.measureNums), 'hdr:', sys.headerWidth.toFixed(1))
  for (const mNum of sys.measureNums) {
    const m = hLayout.measures.get(mNum)!
    console.log('  m' + mNum + ': w=' + m.width.toFixed(1) + ' minW=' + m.minWidth.toFixed(1) + ' segs=' + m.segments.length)
    for (const seg of m.segments) {
      console.log('    b=' + seg.beat + ' d=' + seg.duration + ' str=' + seg.stretch.toFixed(3) + ' w=' + seg.width.toFixed(1))
    }
  }
}
