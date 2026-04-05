/**
 * Debug: measure system strides and Y-shifts across multiple reference images.
 * Run: npx tsx renderer-tests/scripts/debug-note-x.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)
const { PNG }   = require('pngjs')

const ROOT = path.join(__dirname, '..')
const SP   = 24.8

function readPng(p: string) {
  const buf = fs.readFileSync(p)
  return PNG.sync.read(buf) as { data: Buffer; width: number; height: number }
}

function getPixel(data: Buffer, x: number, y: number, w: number): number {
  const idx = (y * w + x) * 4
  return data[idx]  // Red channel (greyscale for black pixels)
}

/**
 * Find staff line start positions at a given x column.
 * Returns y-positions of the first pixel of each staff line.
 */
function findStaffLines(data: Buffer, w: number, x: number, yMin: number, yMax: number): number[] {
  const lines: number[] = []
  let inLine = false
  for (let y = yMin; y <= yMax; y++) {
    const dark = getPixel(data, x, y, w) < 100
    if (dark && !inLine) { lines.push(y); inLine = true }
    if (!dark) inLine = false
  }
  return lines
}

/**
 * For an image, find system Y positions by detecting staff line clusters.
 * Returns array of staffTop positions (top staff line of each system).
 */
function findSystems(data: Buffer, w: number, h: number): number[] {
  // Sample x=700 which should be in stable measure content
  const x = 700
  const allLines = findStaffLines(data, w, x, 300, h - 100)

  // Group into systems: staff lines within a system are spaced ~sp apart,
  // gaps between systems are much larger (>50px)
  const systemStarts: number[] = []
  if (allLines.length === 0) return []

  systemStarts.push(allLines[0])
  let prevLine = allLines[0]

  for (let i = 1; i < allLines.length; i++) {
    const gap = allLines[i] - prevLine
    if (gap > 3 * SP) {
      // Large gap = new system
      systemStarts.push(allLines[i])
    }
    prevLine = allLines[i]
  }

  return systemStarts
}

interface TestResult {
  id: string
  refSystems: number[]
  curSystems: number[]
  strides: { sys: number; refStride: number; curStride: number; diffPx: number }[]
}

const TEST_IDS = ['01-noteheads', '03-rests', '04-beams', '05-stems',
                  '06-key-signatures', '07-time-signatures', '09-tuplets',
                  '12-barlines', '13-dots', '15-mixed']

console.log('\n📐 System Y-Position Analysis\n')
console.log('─'.repeat(70))

for (const id of TEST_IDS) {
  const refPath = path.join(ROOT, `reference/${id}.png`)
  const curPath = path.join(ROOT, `current/${id}.png`)
  if (!fs.existsSync(refPath) || !fs.existsSync(curPath)) continue

  const ref = readPng(refPath)
  const cur = readPng(curPath)

  const refSys = findSystems(ref.data, ref.width, ref.height)
  const curSys = findSystems(cur.data, cur.width, cur.height)

  const strides: TestResult['strides'] = []
  for (let i = 1; i < Math.min(refSys.length, curSys.length, 4); i++) {
    const refStride = refSys[i] - refSys[0]
    const curStride = curSys[i] - curSys[0]
    strides.push({ sys: i, refStride, curStride, diffPx: curStride - refStride })
  }

  const refSp = refSys.length > 1 ? ((refSys[1] - refSys[0]) / SP).toFixed(2) : 'N/A'
  const curSp = curSys.length > 1 ? ((curSys[1] - curSys[0]) / SP).toFixed(2) : 'N/A'

  console.log(`\n${id}:`)
  console.log(`  ref sys tops: [${refSys.slice(0,4).join(', ')}]`)
  console.log(`  cur sys tops: [${curSys.slice(0,4).join(', ')}]`)
  if (strides.length > 0) {
    console.log(`  stride (sys0→sys1): ref=${strides[0].refStride}px (${refSp}sp)  cur=${strides[0].curStride}px (${curSp}sp)  diff=${strides[0].diffPx > 0 ? '+' : ''}${strides[0].diffPx}px`)
  }
  for (const s of strides.slice(1)) {
    const rSp = (s.refStride / SP).toFixed(2)
    const cSp = (s.curStride / SP).toFixed(2)
    console.log(`  sys0→sys${s.sys}: ref=${s.refStride}px (${rSp}sp)  cur=${s.curStride}px (${cSp}sp)  diff=${s.diffPx > 0 ? '+' : ''}${s.diffPx}px`)
  }
}

console.log('\n─'.repeat(70))
console.log(`\nCurrent: systemStride = (7+4+7+9.5)*24.8 = 682.0px = 27.50sp`)
console.log(`C++ min: systemStride = (7+4+7+8.5)*24.8 = 657.2px = 26.50sp`)
