/**
 * Structural Test Types
 *
 * Result types for SVG structural tests that verify musical readability
 * rather than pixel-perfect rendering.
 */

export interface Violation {
  /** Which test found this */
  testName: string
  /** Human-readable description */
  message: string
  /** Severity: error = unreadable, warning = suboptimal */
  severity: 'error' | 'warning'
  /** Location info */
  location?: {
    measureNum?: number
    noteId?: string
    noteId2?: string
  }
  /** Measured value (for spacing/range tests) */
  measured?: number
  /** Expected range or threshold */
  expected?: string
}

export interface TestResult {
  name: string
  passed: boolean
  violations: Violation[]
  /** Summary stat (e.g. "0 collisions", "3 violations") */
  summary: string
}

export interface StructuralReport {
  caseId: string
  timestamp: string
  spatiumPx: number
  totalTests: number
  passed: number
  failed: number
  results: TestResult[]
  /** All violations sorted by severity */
  allViolations: Violation[]
}
