/**
 * MAP Renderer — Generate Reference PNGs via webmscore (MuseScore WASM)
 *
 * Renders each MusicXML fixture through webmscore (the same engine as MuseScore)
 * and saves the output as renderer-tests/reference/<id>.png
 *
 * These PNGs are the GROUND TRUTH — our native renderer should match them.
 *
 * Run: npx tsx renderer-tests/scripts/generate-refs-webmscore.ts
 *      npx tsx renderer-tests/scripts/generate-refs-webmscore.ts --id=02-accidentals
 */

import * as fs   from 'fs'
import * as path from 'path'
import { createRequire } from 'module'

// Node.js 21+ makes globalThis.navigator a read-only getter.
// webmscore.nodejs.cjs tries to assign it — patch first.
if (typeof globalThis.navigator === 'undefined' || Object.getOwnPropertyDescriptor(globalThis, 'navigator')?.get) {
  Object.defineProperty(globalThis, 'navigator', {
    value: (globalThis as Record<string, unknown>).navigator ?? {},
    writable: true,
    configurable: true,
  })
}

// webmscore uses CJS for Node.js
const require = createRequire(import.meta.url)
const WebMscore = require('webmscore')

import { TEST_CASES } from '../test-cases.js'

// Windows-safe __dirname equivalent
const __filename = new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const __dirname  = path.dirname(__filename)

const ROOT        = path.resolve(__dirname, '..')
const FIXTURES    = path.resolve(ROOT, '..', 'public', 'renderer-tests', 'fixtures')
const REF_DIR     = path.join(ROOT, 'reference')

fs.mkdirSync(REF_DIR, { recursive: true })

// Parse CLI args
const args    = process.argv.slice(2)
const idArg   = args.find(a => a.startsWith('--id='))?.slice(5)
const cases   = idArg ? TEST_CASES.filter(tc => tc.id === idArg) : TEST_CASES

if (cases.length === 0) {
  console.error(`No test case found with id: ${idArg}`)
  process.exit(1)
}

console.log('\n🎼 Generating reference PNGs via webmscore\n')
console.log(`  Fixtures : ${FIXTURES}`)
console.log(`  Output   : ${REF_DIR}`)
console.log(`  Cases    : ${cases.length}\n`)

// Wait for webmscore WASM to be ready
await new Promise<void>(resolve => WebMscore.ready.then(resolve))
console.log(`  webmscore ready (version: ${await WebMscore.version()})\n`)

let ok = 0, fail = 0

for (const tc of cases) {
  // fixtureFile is e.g. "renderer-tests/fixtures/01-noteheads.xml"
  // public/ is the root for browser fetches, so the real path is:
  const xmlPath = path.join(FIXTURES, path.basename(tc.fixtureFile))
  const outPath = path.join(REF_DIR, `${tc.id}.png`)

  if (!fs.existsSync(xmlPath)) {
    console.log(`  ⬜ SKIP    ${tc.id}  (fixture not found: ${xmlPath})`)
    fail++
    continue
  }

  try {
    const xmlData = new Uint8Array(fs.readFileSync(xmlPath))
    const score   = await WebMscore.load('xml', xmlData, [])

    const npages = await score.npages()

    // We always render page 0 (all our fixtures fit on one page)
    const pngBuf = await score.savePng(0)
    fs.writeFileSync(outPath, Buffer.from(pngBuf))

    await score.destroy()

    const stat = fs.statSync(outPath)
    console.log(`  ✅ ${tc.id}  (${npages} page${npages > 1 ? 's' : ''}, page-0 → ${(stat.size / 1024).toFixed(0)} KB)`)
    ok++
  } catch (e) {
    console.error(`  ❌ ${tc.id}  ERROR: ${e}`)
    fail++
  }
}

console.log('')
console.log('─'.repeat(50))
console.log(`  Generated : ${ok}`)
console.log(`  Failed    : ${fail}`)
console.log('─'.repeat(50))
console.log('')

if (ok > 0) {
  console.log(`  Reference PNGs saved to: ${REF_DIR}`)
  console.log('  Open them to verify, then run: npm run test:r:capture')
  console.log('')
}

process.exit(fail > 0 ? 1 : 0)
