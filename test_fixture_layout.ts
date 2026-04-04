import { JSDOM } from 'jsdom'
;(globalThis as any).DOMParser = new JSDOM().window.DOMParser

import { extractScore } from './src/renderer/xmlExtractor'
import { computeHorizontalLayout } from './src/renderer/horizontalLayout'
import { readFileSync } from 'fs'

const xml = readFileSync('renderer-tests/fixtures/12-barlines.xml', 'utf8')
const score = extractScore(xml)
console.log('metadata:', JSON.stringify(score.metadata))
console.log('\nMeasures:')
score.measures.forEach(m => {
  console.log(`M${m.num}: keyChange=${JSON.stringify(m.keyChange)} timeChange=${JSON.stringify(m.timeChange)} barlineLeft=${JSON.stringify(m.barlineLeft)} barlineRight=${JSON.stringify(m.barlineRight)}`)
  console.log(`  notes: ${m.notes.map(n => `beat=${n.beat} dur=${n.duration}`).join(', ')}`)
})

const layout = computeHorizontalLayout(score)
const sys = layout.systems[0]
console.log('\n=== Layout ===')
console.log('sysX:', sys.x.toFixed(2), 'headerWidth:', sys.headerWidth.toFixed(2))
for (let i = 1; i <= 5; i++) {
  const m = layout.measures.get(i)!
  const firstNotePad = m.segments[0] ? m.segments[0].x - m.x : '?'
  console.log(`M${i}: x=${m.x.toFixed(2)} w=${m.width.toFixed(2)} firstNotePad=${typeof firstNotePad === 'number' ? firstNotePad.toFixed(2) : firstNotePad} noteX=${m.segments[0]?.x.toFixed(2)} end=${(m.x+m.width).toFixed(2)}`)
}
