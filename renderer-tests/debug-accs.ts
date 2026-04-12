import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser
import { loadFixtureXml } from './pipeline/harness'
import { extractScore } from '../src/renderer/xmlExtractor'

for (const id of ['01-noteheads', '03-rests']) {
  const xml = loadFixtureXml(id)
  const { measures } = extractScore(xml)
  console.log(`\n=== ${id} ===`)
  for (const m of measures.slice(0, 6)) {
    const accs = m.notes.filter((n:any) => n.showAccidental && !n.isGrace && n.duration > 0).length
    const notes = m.notes.filter((n:any) => !n.isGrace && n.duration > 0).length
    const durs = [...new Set(m.notes.filter((n:any)=>!n.isGrace&&n.duration>0).map((n:any)=>n.duration.toFixed(2)))]
    console.log(`m${m.num}: notes=${notes} accs=${accs} durs=[${durs.join(',')}]`)
  }
}
