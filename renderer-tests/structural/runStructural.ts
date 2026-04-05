#!/usr/bin/env tsx
/**
 * Structural Test Runner for MAP Native Renderer
 *
 * Usage:
 *   npx tsx renderer-tests/structural/runStructural.ts --all
 *   npx tsx renderer-tests/structural/runStructural.ts --case=01-noteheads
 *   npx tsx renderer-tests/structural/runStructural.ts --case=15-mixed --verbose
 *   npx tsx renderer-tests/structural/runStructural.ts --donnalee
 *
 * Runs structural tests on RenderedScore output (no browser, no screenshots).
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// Polyfill DOMParser for Node.js (renderer uses querySelector/querySelectorAll)
import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser

import { renderScore } from '../../src/renderer/index'
import { TEST_CASES } from '../test-cases'
import { runAllTests } from './structuralTests'
import type { StructuralReport, Violation } from './types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const REPORT_DIR = path.join(__dirname, '..', 'structural-results')

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const verbose = args.includes('--verbose') || args.includes('-v')
const runAll = args.includes('--all')
const donnaLee = args.includes('--donnalee')
const caseArg = args.find(a => a.startsWith('--case='))
const caseId = caseArg?.split('=')[1]

if (!runAll && !caseId && !donnaLee) {
  console.log('Usage:')
  console.log('  npx tsx renderer-tests/structural/runStructural.ts --all')
  console.log('  npx tsx renderer-tests/structural/runStructural.ts --case=01-noteheads')
  console.log('  npx tsx renderer-tests/structural/runStructural.ts --donnalee')
  console.log('  Add --verbose for detailed output')
  process.exit(0)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFixture(relativePath: string): string {
  const fullPath = path.join(PROJECT_ROOT, 'public', relativePath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Fixture not found: ${fullPath}`)
  }
  return fs.readFileSync(fullPath, 'utf-8')
}

function colorize(text: string, code: number): string {
  return `\x1b[${code}m${text}\x1b[0m`
}

const green = (t: string) => colorize(t, 32)
const red = (t: string) => colorize(t, 31)
const yellow = (t: string) => colorize(t, 33)
const bold = (t: string) => colorize(t, 1)
const dim = (t: string) => colorize(t, 2)

// ─── Render & Test ────────────────────────────────────────────────────────────

function runTestCase(id: string, xmlString: string): StructuralReport {
  const result = renderScore(xmlString)
  const score = result.renderedScore

  // Determine spatium from first staff
  const sp = score.pages[0]?.systems[0]?.staves[0]?.lineSpacing ?? 10

  const results = runAllTests(score, sp)
  const allViolations = results.flatMap(r => r.violations)
    .sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1))

  return {
    caseId: id,
    timestamp: new Date().toISOString(),
    spatiumPx: sp,
    totalTests: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
    allViolations,
  }
}

function printReport(report: StructuralReport): void {
  const { caseId, passed, failed, totalTests, spatiumPx, results, allViolations } = report
  const status = failed === 0 ? green('PASS') : red('FAIL')

  console.log('')
  console.log(bold(`  ${caseId}`) + dim(` (sp=${spatiumPx.toFixed(1)}px)`))

  for (const r of results) {
    const icon = r.passed ? green('  \u2713') : red('  \u2717')
    const detail = r.passed ? dim(` (${r.summary})`) : ` — ${r.summary}`
    console.log(`${icon} ${r.name}${detail}`)

    if (verbose && !r.passed) {
      for (const v of r.violations.slice(0, 5)) {
        const sev = v.severity === 'error' ? red('ERR') : yellow('WRN')
        console.log(`      ${sev} ${v.message}`)
      }
      if (r.violations.length > 5) {
        console.log(dim(`      ... and ${r.violations.length - 5} more`))
      }
    }
  }

  const errors = allViolations.filter(v => v.severity === 'error').length
  const warnings = allViolations.filter(v => v.severity === 'warning').length
  console.log(`  ${status} ${passed}/${totalTests} tests | ${errors} errors, ${warnings} warnings`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fs.mkdirSync(REPORT_DIR, { recursive: true })

const reports: StructuralReport[] = []

if (donnaLee) {
  // Run on DONNALEE.XML
  const xmlPath = path.join(PROJECT_ROOT, 'public', 'DONNALEE.XML')
  if (!fs.existsSync(xmlPath)) {
    console.error(red('DONNALEE.XML not found at ' + xmlPath))
    process.exit(1)
  }
  const xml = fs.readFileSync(xmlPath, 'utf-8')
  console.log(bold('\n=== Structural Tests: DONNALEE.XML ==='))
  const report = runTestCase('DONNALEE', xml)
  printReport(report)
  reports.push(report)
} else {
  const cases = runAll
    ? TEST_CASES
    : TEST_CASES.filter(tc => tc.id === caseId)

  if (cases.length === 0) {
    console.error(red(`No test case found with id "${caseId}"`))
    console.log('Available:', TEST_CASES.map(tc => tc.id).join(', '))
    process.exit(1)
  }

  console.log(bold(`\n=== Structural Tests: ${cases.length} case(s) ===`))

  for (const tc of cases) {
    try {
      const xml = loadFixture(tc.fixtureFile)
      const report = runTestCase(tc.id, xml)
      printReport(report)
      reports.push(report)
    } catch (err) {
      console.log(red(`  \u2717 ${tc.id}: ${(err as Error).message}`))
    }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('')
console.log(bold('=== Summary ==='))

const totalPassed = reports.reduce((s, r) => s + r.passed, 0)
const totalTests = reports.reduce((s, r) => s + r.totalTests, 0)
const totalErrors = reports.reduce((s, r) => s + r.allViolations.filter(v => v.severity === 'error').length, 0)
const totalWarnings = reports.reduce((s, r) => s + r.allViolations.filter(v => v.severity === 'warning').length, 0)
const casesFullPass = reports.filter(r => r.failed === 0).length

console.log(`  Cases: ${casesFullPass}/${reports.length} fully passing`)
console.log(`  Tests: ${totalPassed}/${totalTests} passing`)
console.log(`  Errors: ${totalErrors} | Warnings: ${totalWarnings}`)

// Top violations across all cases
const allV = reports.flatMap(r => r.allViolations)
if (allV.length > 0) {
  console.log('')
  console.log(bold('  Top violations:'))
  // Group by test name
  const byTest = new Map<string, Violation[]>()
  for (const v of allV) {
    if (!byTest.has(v.testName)) byTest.set(v.testName, [])
    byTest.get(v.testName)!.push(v)
  }
  const sorted = [...byTest.entries()].sort((a, b) => {
    const aErr = a[1].filter(v => v.severity === 'error').length
    const bErr = b[1].filter(v => v.severity === 'error').length
    return bErr - aErr || b[1].length - a[1].length
  })
  for (const [name, violations] of sorted.slice(0, 5)) {
    const errs = violations.filter(v => v.severity === 'error').length
    const wrns = violations.filter(v => v.severity === 'warning').length
    console.log(`    ${name}: ${errs} errors, ${wrns} warnings`)
  }
}

// Save JSON report
const jsonPath = path.join(REPORT_DIR, 'report.json')
fs.writeFileSync(jsonPath, JSON.stringify(reports, null, 2))
console.log(dim(`\n  Report saved to ${path.relative(PROJECT_ROOT, jsonPath)}`))
console.log('')
