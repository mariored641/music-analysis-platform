import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')

const id = process.argv[2] || '12-barlines'
const diffPath = path.join(__dirname, '..', 'diff', `${id}.diff.png`)
const buf = fs.readFileSync(diffPath)
const img = PNG.sync.read(buf)
const { data, width: w, height: h } = img

const TITLE_CUTOFF = 350

const xBuckets: number[] = Array(Math.ceil(w/50)).fill(0)
const yBuckets: number[] = Array(Math.ceil((h-TITLE_CUTOFF)/50)).fill(0)
let total = 0

for (let y = TITLE_CUTOFF; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 4
    const r = data[idx], g = data[idx+1], b = data[idx+2]
    const isDiff = (r===255&&g===0&&b===0)||(r===0&&g===255&&b===0)
    if (isDiff) {
      xBuckets[Math.floor(x/50)]++
      yBuckets[Math.floor((y-TITLE_CUTOFF)/50)]++
      total++
    }
  }
}

console.log(`\n${id} content diff analysis (y >= 350): ${total}px total`)
console.log('\nTop x-buckets (50px wide):')
const xTop = xBuckets.map((v,i) => ({x: i*50, v})).sort((a,b)=>b.v-a.v).slice(0,8)
for (const {x, v} of xTop) if (v>0) console.log(`  x=${x}-${x+49}: ${v}px`)

console.log('\nTop y-buckets (50px tall):')
const yTop = yBuckets.map((v,i) => ({y: i*50+TITLE_CUTOFF, v})).sort((a,b)=>b.v-a.v).slice(0,8)
for (const {y, v} of yTop) if (v>0) console.log(`  y=${y}-${y+49}: ${v}px`)
