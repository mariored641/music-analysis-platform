import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser
import { loadFixtureXml } from './pipeline/harness'
import { extractScore } from '../src/renderer/xmlExtractor'

// Patch computeMeasureWidth to log calls
const LM = await import('../src/renderer/engine/layout/LayoutMeasure.js')
const origCMW = LM.computeMeasureWidth
let logCount = 0
;(LM as any).computeMeasureWidth = (firstNotePadPx: number, segmentWidths: number[], sp: number) => {
  const result = origCMW(firstNotePadPx, segmentWidths, sp)
  if (logCount < 10) {
    console.log(`computeMeasureWidth(pad=${firstNotePadPx.toFixed(2)}, segs=[${segmentWidths.map(w=>w.toFixed(2))}], sp=${sp}) = ${result.toFixed(2)}`)
    logCount++
  }
  return result
}

const xml = loadFixtureXml('01-noteheads')
const score = extractScore(xml)
const { orchestrateHorizontalLayout } = await import('../src/renderer/engine/LayoutOrchestrator.js')
orchestrateHorizontalLayout(score)
