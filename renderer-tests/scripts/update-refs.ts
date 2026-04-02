/**
 * MAP Renderer — Update Reference Images
 *
 * Copies renderer-tests/current/*.png → renderer-tests/reference/*.png
 *
 * Use this after:
 *   1. Running `npm run test:r:capture` to generate new screenshots
 *   2. Visually inspecting them and approving the output
 *   3. Ready to commit the new references
 *
 * Options:
 *   --all        : update all test cases (default: only those with changes or missing refs)
 *   --id=XX      : update only one specific test case (e.g. --id=01-noteheads)
 *
 * Run: npx tsx renderer-tests/scripts/update-refs.ts
 *      npx tsx renderer-tests/scripts/update-refs.ts --all
 *      npx tsx renderer-tests/scripts/update-refs.ts --id=02-accidentals
 */

import * as fs   from 'fs'
import * as path from 'path'
import { TEST_CASES } from '../test-cases'

const ROOT    = path.join(__dirname, '..')
const REF_DIR = path.join(ROOT, 'reference')
const CUR_DIR = path.join(ROOT, 'current')

fs.mkdirSync(REF_DIR, { recursive: true })

const args    = process.argv.slice(2)
const updateAll = args.includes('--all')
const idArg   = args.find(a => a.startsWith('--id='))?.slice(5)

const cases = idArg
  ? TEST_CASES.filter(tc => tc.id === idArg)
  : TEST_CASES

if (cases.length === 0) {
  console.error(`No test case found with id: ${idArg}`)
  process.exit(1)
}

console.log('\n📸 MAP Renderer — Update Reference Images\n')

let updated = 0
let skipped = 0
let missing = 0

for (const tc of cases) {
  const curPath = path.join(CUR_DIR, `${tc.id}.png`)
  const refPath = path.join(REF_DIR, `${tc.id}.png`)

  if (!fs.existsSync(curPath)) {
    console.log(`  ⬜ MISSING  ${tc.id}  (no current PNG — run capture first)`)
    missing++
    continue
  }

  const refExists = fs.existsSync(refPath)

  // Skip if ref exists and --all not specified (only update new/changed)
  // Actually always copy if running this script — the point is to approve
  if (!updateAll && refExists) {
    // Check if files differ (simple size check)
    const curStat = fs.statSync(curPath)
    const refStat = fs.statSync(refPath)
    if (curStat.size === refStat.size) {
      console.log(`  ⏭ SKIP     ${tc.id}  (same size, likely unchanged)`)
      skipped++
      continue
    }
  }

  fs.copyFileSync(curPath, refPath)
  const status = refExists ? 'UPDATED' : 'CREATED'
  console.log(`  ✅ ${status}  ${tc.id}`)
  updated++
}

console.log('')
console.log('─'.repeat(40))
console.log(`  Updated : ${updated}`)
console.log(`  Skipped : ${skipped}`)
console.log(`  Missing : ${missing}`)
console.log('─'.repeat(40))
console.log('')

if (updated > 0) {
  console.log('  Reference images updated.')
  console.log('  Remember to: git add renderer-tests/reference/ && git commit')
  console.log('')
}
