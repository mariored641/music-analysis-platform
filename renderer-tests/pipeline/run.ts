#!/usr/bin/env tsx
/**
 * Pipeline Test Runner — Surgical Renderer Diagnostics
 *
 * Usage:
 *   npx tsx renderer-tests/pipeline/run.ts --all                 # all tests, all fixtures
 *   npx tsx renderer-tests/pipeline/run.ts --stage=B             # horizontal only
 *   npx tsx renderer-tests/pipeline/run.ts --stage=C --case=04   # vertical on beams
 *   npx tsx renderer-tests/pipeline/run.ts --stage=B --verbose   # with delta details
 *   npx tsx renderer-tests/pipeline/run.ts --gaps                # gap regression only
 *   npx tsx renderer-tests/pipeline/run.ts --case=01-noteheads   # single fixture, all stages
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// Polyfill DOMParser for Node.js
import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser

import {
  getRegisteredTests,
  getAvailableFixtures,
  hasReferenceData,
  clearCaches,
} from './harness'
import type { PipelineTestResult, TestStage, PipelineReport, FullReport } from './types'

// Import test registration modules (they self-register on import)
import './horizontal.test'
import './vertical.test'
import './extraction.test'
import './svgRender.test'
import './gaps.test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPORT_DIR = path.join(__dirname, '..', 'pipeline-results')

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const verbose = args.includes('--verbose') || args.includes('-v')
const runAll = args.includes('--all')
const gapsOnly = args.includes('--gaps')
const stageArg = args.find(a => a.startsWith('--stage='))?.split('=')[1]?.toUpperCase() as TestStage | undefined
const caseArg = args.find(a => a.startsWith('--case='))?.split('=')[1]

if (!runAll && !stageArg && !caseArg && !gapsOnly) {
  console.log('Usage:')
  console.log('  npx tsx renderer-tests/pipeline/run.ts --all')
  console.log('  npx tsx renderer-tests/pipeline/run.ts --stage=B              # A=extraction, B=horizontal, C=vertical, D=svg, E=gaps')
  console.log('  npx tsx renderer-tests/pipeline/run.ts --stage=B --case=01-noteheads')
  console.log('  npx tsx renderer-tests/pipeline/run.ts --gaps                 # gap regression only')
  console.log('  npx tsx renderer-tests/pipeline/run.ts --case=04-beams        # all stages for one fixture')
  console.log('  Add --verbose for detailed delta output')
  process.exit(0)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function colorize(text: string, code: number): string {
  return `\x1b[${code}m${text}\x1b[0m`
}

const green = (t: string) => colorize(t, 32)
const red = (t: string) => colorize(t, 31)
const yellow = (t: string) => colorize(t, 33)
const bold = (t: string) => colorize(t, 1)
const dim = (t: string) => colorize(t, 2)
const cyan = (t: string) => colorize(t, 36)

const STAGE_NAMES: Record<TestStage, string> = {
  A: 'Extraction',
  B: 'Horizontal Layout',
  C: 'Vertical Layout',
  D: 'SVG Render',
  E: 'Gap Regression',
}

// ─── Test Execution ──────────────────────────────────────────────────────────

function printResult(result: PipelineTestResult): void {
  const icon = result.passed ? green('  ✓') : red('  ✗')
  const tag = cyan(`[${result.testId}]`)
  const deltaInfo = result.maxDelta > 0 ? dim(` (max Δ ${result.maxDelta}px, avg ${result.avgDelta}px)`) : ''
  console.log(`${icon} ${tag} ${result.name}  ${result.passed ? dim(result.summary) : result.summary}${deltaInfo}`)

  if (verbose && !result.passed && result.deltas.length > 0) {
    const failed = result.deltas.filter(d => !d.withinTolerance)
    for (const d of failed.slice(0, 8)) {
      const sign = typeof d.actual === 'number' && typeof d.expected === 'number'
        ? (d.actual > d.expected ? '+' : '')
        : ''
      const diffStr = d.diff !== undefined ? ` (Δ ${sign}${d.diff}px)` : ''
      console.log(
        `      ${red('✗')} ${d.label}: actual=${d.actual}, ref=${d.expected}${diffStr}` +
        (d.detail ? dim(` — ${d.detail}`) : '')
      )
    }
    if (failed.length > 8) {
      console.log(dim(`      ... and ${failed.length - 8} more`))
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

fs.mkdirSync(REPORT_DIR, { recursive: true })

const effectiveStage = gapsOnly ? 'E' as TestStage : stageArg
const tests = getRegisteredTests(effectiveStage)

if (tests.length === 0) {
  console.error(red(`No tests registered for stage "${effectiveStage || 'all'}"`))
  process.exit(1)
}

// Determine which fixtures to run
let fixtureIds: string[]
if (caseArg) {
  // Single fixture
  if (!hasReferenceData(caseArg)) {
    // Some tests (Category A) don't need reference data
    fixtureIds = [caseArg]
  } else {
    fixtureIds = [caseArg]
  }
} else {
  fixtureIds = getAvailableFixtures()
}

if (fixtureIds.length === 0) {
  console.error(red('No reference data found. Run: npx tsx renderer-tests/scripts/extract-reference-data.ts'))
  process.exit(1)
}

console.log(bold(`\n=== Pipeline Tests ===`))
console.log(dim(`  Stage    : ${effectiveStage ? STAGE_NAMES[effectiveStage] : 'All'}`))
console.log(dim(`  Fixtures : ${fixtureIds.length}`))
console.log(dim(`  Tests    : ${tests.length} registered`))
console.log('')

const allResults: PipelineTestResult[] = []
const fixtureReports: PipelineReport[] = []

for (const fixtureId of fixtureIds) {
  console.log(bold(`  ${fixtureId}`))

  const fixtureResults: PipelineTestResult[] = []

  for (const test of tests) {
    // Check if this test applies to this fixture
    if (test.fixtures !== 'all' && !test.fixtures.includes(fixtureId)) {
      continue
    }

    try {
      const results = test.fn(fixtureId)
      const resultArray = Array.isArray(results) ? results : [results]
      for (const r of resultArray) {
        printResult(r)
        fixtureResults.push(r)
        allResults.push(r)
      }
    } catch (err) {
      const errResult: PipelineTestResult = {
        testId: test.testId,
        name: test.name,
        stage: test.stage,
        category: test.category,
        passed: false,
        fixtureId,
        summary: `ERROR: ${(err as Error).message}`,
        deltas: [],
        totalCompared: 0,
        exceededCount: 0,
        maxDelta: 0,
        avgDelta: 0,
      }
      printResult(errResult)
      fixtureResults.push(errResult)
      allResults.push(errResult)
    }
  }

  // Build fixture report
  const stageBreakdown: Record<TestStage, { total: number; passed: number }> = {
    A: { total: 0, passed: 0 }, B: { total: 0, passed: 0 },
    C: { total: 0, passed: 0 }, D: { total: 0, passed: 0 },
    E: { total: 0, passed: 0 },
  }
  for (const r of fixtureResults) {
    stageBreakdown[r.stage].total++
    if (r.passed) stageBreakdown[r.stage].passed++
  }

  fixtureReports.push({
    fixtureId,
    timestamp: new Date().toISOString(),
    results: fixtureResults,
    totalTests: fixtureResults.length,
    passed: fixtureResults.filter(r => r.passed).length,
    failed: fixtureResults.filter(r => !r.passed).length,
    stageBreakdown,
  })

  clearCaches() // free memory between fixtures
  console.log('')
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const totalTests = allResults.length
const totalPassed = allResults.filter(r => r.passed).length
const totalFailed = totalTests - totalPassed

const byStage: Record<TestStage, { total: number; passed: number }> = {
  A: { total: 0, passed: 0 }, B: { total: 0, passed: 0 },
  C: { total: 0, passed: 0 }, D: { total: 0, passed: 0 },
  E: { total: 0, passed: 0 },
}
for (const r of allResults) {
  byStage[r.stage].total++
  if (r.passed) byStage[r.stage].passed++
}

console.log(bold('=== Summary ==='))
console.log(`  Total: ${totalPassed}/${totalTests} passed`)

for (const [stage, counts] of Object.entries(byStage)) {
  if (counts.total === 0) continue
  const pct = counts.total > 0 ? Math.round(counts.passed / counts.total * 100) : 0
  const color = pct === 100 ? green : pct > 50 ? yellow : red
  console.log(`  ${STAGE_NAMES[stage as TestStage]}: ${color(`${counts.passed}/${counts.total}`)} (${pct}%)`)
}

// Top failing tests by delta
const failedResults = allResults
  .filter(r => !r.passed && r.maxDelta > 0)
  .sort((a, b) => b.maxDelta - a.maxDelta)
  .slice(0, 10)

if (failedResults.length > 0) {
  console.log('')
  console.log(bold('  Worst deltas:'))
  for (const r of failedResults) {
    console.log(`    ${red(`Δ ${r.maxDelta}px`)} ${cyan(`[${r.testId}]`)} ${r.name} on ${r.fixtureId}`)
  }
}

// Save report
const fullReport: FullReport = {
  timestamp: new Date().toISOString(),
  fixtures: fixtureReports,
  summary: {
    totalTests,
    passed: totalPassed,
    failed: totalFailed,
    byStage,
    worstDeltas: failedResults.map(r => ({
      testId: r.testId, fixtureId: r.fixtureId, maxDelta: r.maxDelta, name: r.name,
    })),
  },
}

const reportPath = path.join(REPORT_DIR, 'report.json')
fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2))
console.log(dim(`\n  Report: ${path.relative(process.cwd(), reportPath)}`))
console.log('')

process.exit(totalFailed > 0 ? 1 : 0)
