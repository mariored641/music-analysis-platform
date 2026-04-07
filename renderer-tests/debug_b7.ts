import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser
import { runPipeline } from './pipeline/harness.js'

const fixtureId = process.argv[2] || '01-noteheads'
const { hLayout } = runPipeline(fixtureId)

for (const sys of hLayout.systems) {
  const measures = sys.measureNums.map(n => hLayout.measures.get(n)!).filter(Boolean)
  const totalWidth = measures.reduce((s, m) => s + m.width, 0) + sys.headerWidth
  const expected = sys.width
  console.log(`sys${sys.systemIndex}: total=${totalWidth.toFixed(1)} expected=${expected.toFixed(1)} delta=${(totalWidth - expected).toFixed(1)}`)
  console.log(`  measureWidths: [${measures.map(m => m.width.toFixed(1))}]`)
  console.log(`  headerWidth: ${sys.headerWidth.toFixed(1)} sysWidth: ${sys.width.toFixed(1)}`)
}
