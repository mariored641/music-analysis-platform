/**
 * Pipeline Test Harness — Generic Comparison Engine
 *
 * Loads reference JSON, runs our renderer pipeline on fixtures,
 * and computes numeric deltas at each pipeline stage.
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

import type {
  ReferenceData,
  PipelineTestResult,
  Delta,
  ToleranceConfig,
  DEFAULT_TOLERANCES,
  TestStage,
  TestCategory,
} from './types'

// Re-export types for test files
export type {
  ReferenceData,
  PipelineTestResult,
  Delta,
  ToleranceConfig,
  TestStage,
  TestCategory,
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const REF_DATA_DIR = path.join(__dirname, '..', 'reference-data')
const FIXTURES_DIR = path.join(PROJECT_ROOT, 'public', 'renderer-tests', 'fixtures')

// ─── Reference Data Loading ──────────────────────────────────────────────────

const refCache = new Map<string, ReferenceData>()

export function loadReferenceData(fixtureId: string): ReferenceData {
  if (refCache.has(fixtureId)) return refCache.get(fixtureId)!

  const refPath = path.join(REF_DATA_DIR, `${fixtureId}.ref.json`)
  if (!fs.existsSync(refPath)) {
    throw new Error(
      `Reference data not found for "${fixtureId}". ` +
      `Run: npx tsx renderer-tests/scripts/extract-reference-data.ts --id=${fixtureId}`
    )
  }
  const data: ReferenceData = JSON.parse(fs.readFileSync(refPath, 'utf-8'))
  refCache.set(fixtureId, data)
  return data
}

export function hasReferenceData(fixtureId: string): boolean {
  return fs.existsSync(path.join(REF_DATA_DIR, `${fixtureId}.ref.json`))
}

// ─── Fixture Loading ─────────────────────────────────────────────────────────

const fixtureCache = new Map<string, string>()

export function loadFixtureXml(fixtureId: string): string {
  if (fixtureCache.has(fixtureId)) return fixtureCache.get(fixtureId)!

  const xmlPath = path.join(FIXTURES_DIR, `${fixtureId}.xml`)
  if (!fs.existsSync(xmlPath)) {
    throw new Error(`Fixture XML not found: ${xmlPath}`)
  }
  const xml = fs.readFileSync(xmlPath, 'utf-8')
  fixtureCache.set(fixtureId, xml)
  return xml
}

// ─── Delta Computation Helpers ───────────────────────────────────────────────

/** Compare two numbers with tolerance. Returns a Delta. */
export function numericDelta(
  label: string,
  actual: number,
  expected: number,
  tolerance: number,
  detail?: string,
): Delta {
  const diff = Math.abs(actual - expected)
  return {
    label,
    actual: Math.round(actual * 10) / 10,
    expected: Math.round(expected * 10) / 10,
    diff: Math.round(diff * 10) / 10,
    withinTolerance: diff <= tolerance,
    detail,
  }
}

/** Compare two booleans or strings exactly. */
export function exactDelta(
  label: string,
  actual: string | boolean,
  expected: string | boolean,
  detail?: string,
): Delta {
  return {
    label,
    actual,
    expected,
    withinTolerance: actual === expected,
    detail,
  }
}

// ─── Test Result Builder ─────────────────────────────────────────────────────

export function buildTestResult(
  testId: string,
  name: string,
  stage: TestStage,
  category: TestCategory,
  fixtureId: string,
  deltas: Delta[],
): PipelineTestResult {
  const exceeded = deltas.filter(d => !d.withinTolerance)
  const numericDeltas = deltas.filter(d => typeof d.diff === 'number')
  const maxDelta = numericDeltas.length > 0
    ? Math.max(...numericDeltas.map(d => d.diff!))
    : 0
  const avgDelta = numericDeltas.length > 0
    ? numericDeltas.reduce((s, d) => s + d.diff!, 0) / numericDeltas.length
    : 0

  const passed = exceeded.length === 0

  let summary: string
  if (passed) {
    summary = `${deltas.length} compared, all within tolerance`
    if (maxDelta > 0) summary += ` (max Δ ${maxDelta.toFixed(1)}px)`
  } else {
    summary = `${exceeded.length}/${deltas.length} exceed tolerance (max Δ ${maxDelta.toFixed(1)}px)`
  }

  return {
    testId,
    name,
    stage,
    category,
    passed,
    fixtureId,
    summary,
    deltas,
    totalCompared: deltas.length,
    exceededCount: exceeded.length,
    maxDelta: Math.round(maxDelta * 10) / 10,
    avgDelta: Math.round(avgDelta * 10) / 10,
  }
}

// ─── Renderer Pipeline Runner ────────────────────────────────────────────────

import { extractScore } from '../../src/renderer/index'
import { orchestrateHorizontalLayout } from '../../src/renderer/engine/LayoutOrchestrator'
import { computeVerticalLayout } from '../../src/renderer/verticalLayout'
import { renderToSVG } from '../../src/renderer/svgRenderer'
import type { ExtractedScore } from '../../src/renderer/extractorTypes'
import type { HorizontalLayout } from '../../src/renderer/horizontalLayout'
import type { RenderedScore, RenderOptions } from '../../src/renderer/types'

export interface PipelineStages {
  extracted: ExtractedScore
  hLayout: HorizontalLayout
  rendered: RenderedScore
  svg: string
}

const pipelineCache = new Map<string, PipelineStages>()

/**
 * Run the full renderer pipeline on a fixture, caching results.
 * Returns intermediate results at each stage for targeted testing.
 */
export function runPipeline(fixtureId: string, options?: RenderOptions): PipelineStages {
  const cacheKey = fixtureId + JSON.stringify(options || {})
  if (pipelineCache.has(cacheKey)) return pipelineCache.get(cacheKey)!

  const xml = loadFixtureXml(fixtureId)
  const extracted = extractScore(xml)
  const hLayout = orchestrateHorizontalLayout(extracted, options)
  const rendered = computeVerticalLayout(extracted, hLayout, options)
  const svg = renderToSVG(rendered, options)

  const stages: PipelineStages = { extracted, hLayout, rendered, svg }
  pipelineCache.set(cacheKey, stages)
  return stages
}

/** Clear all caches (useful between test runs with different options) */
export function clearCaches(): void {
  refCache.clear()
  fixtureCache.clear()
  pipelineCache.clear()
}

// ─── Test Registration ───────────────────────────────────────────────────────

export type TestFn = (fixtureId: string) => PipelineTestResult | PipelineTestResult[]

interface RegisteredTest {
  testId: string
  name: string
  stage: TestStage
  category: TestCategory
  /** Which fixtures this test applies to. 'all' = all 15. */
  fixtures: string[] | 'all'
  fn: TestFn
}

const registeredTests: RegisteredTest[] = []

/** Register a pipeline test. */
export function registerTest(
  testId: string,
  name: string,
  stage: TestStage,
  category: TestCategory,
  fixtures: string[] | 'all',
  fn: TestFn,
): void {
  registeredTests.push({ testId, name, stage, category, fixtures, fn })
}

/** Get all registered tests, optionally filtered by stage. */
export function getRegisteredTests(stage?: TestStage): RegisteredTest[] {
  if (stage) return registeredTests.filter(t => t.stage === stage)
  return [...registeredTests]
}

/** Get available fixture IDs (those with reference data). */
export function getAvailableFixtures(): string[] {
  const files = fs.readdirSync(REF_DATA_DIR).filter(f => f.endsWith('.ref.json'))
  return files.map(f => f.replace('.ref.json', ''))
}
