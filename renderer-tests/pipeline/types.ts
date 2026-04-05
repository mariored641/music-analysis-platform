/**
 * Pipeline Test Types — Surgical Renderer Diagnostics
 *
 * Types for numeric comparison of our renderer pipeline output
 * against webmscore reference data.
 */

// ─── Test Result Types ───────────────────────────────────────────────────────

export type TestStage = 'A' | 'B' | 'C' | 'D' | 'E'
export type TestCategory = 'extraction' | 'horizontal' | 'vertical' | 'svgRender' | 'gaps'

export interface PipelineTestResult {
  /** Test ID, e.g. "B1", "C3" */
  testId: string
  /** Test name, e.g. "measureWidths", "stemLengths" */
  name: string
  /** Which pipeline stage this tests */
  stage: TestStage
  /** Category for grouping */
  category: TestCategory
  /** Pass/fail */
  passed: boolean
  /** Fixture this ran on */
  fixtureId: string
  /** Human-readable summary */
  summary: string
  /** Detailed deltas (only populated in verbose mode) */
  deltas: Delta[]
  /** How many elements were compared */
  totalCompared: number
  /** How many exceeded tolerance */
  exceededCount: number
  /** Maximum absolute delta found */
  maxDelta: number
  /** Average absolute delta */
  avgDelta: number
}

export interface Delta {
  /** What element this delta is about, e.g. "measure 4" or "note-m7b100-C5" */
  label: string
  /** Our value */
  actual: number | string | boolean
  /** Reference value */
  expected: number | string | boolean
  /** Absolute difference (for numeric) */
  diff?: number
  /** Within tolerance? */
  withinTolerance: boolean
  /** Extra context */
  detail?: string
}

// ─── Tolerance Config ────────────────────────────────────────────────────────

export interface ToleranceConfig {
  /** Default tolerance in pixels for position comparisons */
  positionPx: number
  /** Default tolerance in pixels for size comparisons */
  sizePx: number
  /** Tolerance in degrees for angle comparisons */
  angleDeg: number
  /** Per-test overrides */
  overrides?: Record<string, number>
}

export const DEFAULT_TOLERANCES: ToleranceConfig = {
  positionPx: 3,
  sizePx: 3,
  angleDeg: 2,
}

// ─── Reference Data Types ────────────────────────────────────────────────────

export interface ReferenceData {
  id: string
  timestamp: string
  pageSize: { width: number; height: number }
  measures: RefPositionElement[]
  segments: RefPositionElement[]
  staffLines: RefStaffLine[]
  notes: RefNote[]
  stems: RefStem[]
  beams: RefBeam[]
  chordSymbols: RefChordSymbol[]
  barlines: RefBarline[]
}

export interface RefPositionElement {
  id: number
  x: number
  y: number
  sx: number  // width
  sy: number  // height
  page: number
}

export interface RefStaffLine {
  y: number
  x1: number
  x2: number
}

export interface RefNote {
  x: number
  y: number
  glyph: string
  measure: number
}

export interface RefStem {
  x: number
  yTop: number
  yBottom: number
}

export interface RefBeam {
  points: string
}

export interface RefChordSymbol {
  x: number
  y: number
  text: string
}

export interface RefBarline {
  x: number
  yTop: number
  yBottom: number
}

// ─── Report Types ────────────────────────────────────────────────────────────

export interface PipelineReport {
  fixtureId: string
  timestamp: string
  results: PipelineTestResult[]
  totalTests: number
  passed: number
  failed: number
  stageBreakdown: Record<TestStage, { total: number; passed: number }>
}

export interface FullReport {
  timestamp: string
  fixtures: PipelineReport[]
  summary: {
    totalTests: number
    passed: number
    failed: number
    byStage: Record<TestStage, { total: number; passed: number }>
    worstDeltas: Array<{ testId: string; fixtureId: string; maxDelta: number; name: string }>
  }
}
