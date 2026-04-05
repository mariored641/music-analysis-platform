/**
 * Category B — Horizontal Layout Tests
 *
 * Compares our orchestrateHorizontalLayout() output against
 * webmscore measurePositions() / segmentPositions().
 *
 * These tests isolate horizontal spacing: measure widths, x-positions,
 * system breaks, segment widths, note x-positions.
 */

import {
  registerTest,
  loadReferenceData,
  runPipeline,
  numericDelta,
  exactDelta,
  buildTestResult,
} from './harness'

// ─── B1: Measure Widths ─────────────────────────────────────────────────────

// Helper: detect reference system groups from y-position jumps
function detectRefSystems(measures: { id: number; x: number; y: number; sx: number }[]): Map<number, number> {
  // Returns measureId → refSystemIndex
  const map = new Map<number, number>()
  let sysIdx = 0
  for (let i = 0; i < measures.length; i++) {
    if (i > 0 && Math.abs(measures[i].y - measures[i - 1].y) > 10) sysIdx++
    map.set(measures[i].id, sysIdx)
  }
  return map
}

// Helper: detect first measures of each ref system
function detectRefFirstMeasures(measures: { id: number; x: number; y: number; sx: number }[]): Set<number> {
  const set = new Set<number>()
  if (measures.length > 0) set.add(measures[0].id)
  for (let i = 1; i < measures.length; i++) {
    if (Math.abs(measures[i].y - measures[i - 1].y) > 10) set.add(measures[i].id)
  }
  return set
}

registerTest('B1', 'measureWidths', 'B', 'horizontal', 'all', (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { hLayout } = runPipeline(fixtureId)
  const deltas = []

  // Build set of first-measure-in-system numbers (our layout)
  const firstMeasureOfSystem = new Set<number>()
  for (const sys of hLayout.systems) {
    if (sys.measureNums.length > 0) firstMeasureOfSystem.add(sys.measureNums[0])
  }

  // Build map of refMeasureId → refSystemIndex for system alignment check
  const refSysMap = detectRefSystems(ref.measures)
  const refFirstMeasures = detectRefFirstMeasures(ref.measures)

  for (const refMeasure of ref.measures) {
    const measureNum = refMeasure.id + 1 // ref is 0-based, our layout is 1-based
    const ourMeasure = hLayout.measures.get(measureNum)

    if (!ourMeasure) {
      deltas.push(numericDelta(`measure ${measureNum}`, 0, refMeasure.sx, 3, 'missing in our layout'))
      continue
    }

    // Skip comparison if the measure is on a different system in our layout vs reference
    // (system break differences are tested separately in B3)
    const ourIsFirst = firstMeasureOfSystem.has(measureNum)
    const refIsFirst = refFirstMeasures.has(refMeasure.id)
    if (ourIsFirst !== refIsFirst) {
      // System break mismatch — skip this measure (B3 catches this)
      continue
    }

    // webmscore includes header width in the first measure of each system.
    // Our layout stores headerWidth separately → add it for comparison.
    let ourWidth = ourMeasure.width
    if (ourIsFirst) {
      const sys = hLayout.systems[ourMeasure.systemIndex]
      ourWidth += sys.headerWidth
    }

    deltas.push(numericDelta(
      `measure ${measureNum} width`,
      ourWidth,
      refMeasure.sx,
      3,
    ))
  }

  return buildTestResult('B1', 'measureWidths', 'B', 'horizontal', fixtureId, deltas)
})

// ─── B2: Measure X Positions ─────────────────────────────────────────────────

registerTest('B2', 'measureXPositions', 'B', 'horizontal', 'all', (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { hLayout } = runPipeline(fixtureId)
  const deltas = []

  const firstMeasureOfSystem = new Set<number>()
  for (const sys of hLayout.systems) {
    if (sys.measureNums.length > 0) firstMeasureOfSystem.add(sys.measureNums[0])
  }

  const refFirstMeasures = detectRefFirstMeasures(ref.measures)

  for (const refMeasure of ref.measures) {
    const measureNum = refMeasure.id + 1
    const ourMeasure = hLayout.measures.get(measureNum)

    if (!ourMeasure) {
      deltas.push(numericDelta(`measure ${measureNum}`, 0, refMeasure.x, 3, 'missing'))
      continue
    }

    // Skip if system break mismatch (tested by B3)
    const ourIsFirst = firstMeasureOfSystem.has(measureNum)
    const refIsFirst = refFirstMeasures.has(refMeasure.id)
    if (ourIsFirst !== refIsFirst) continue

    // For first-in-system: use system x (webmscore includes header in measure x)
    let ourX = ourMeasure.x
    if (ourIsFirst) {
      const sys = hLayout.systems[ourMeasure.systemIndex]
      ourX = sys.x
    }

    deltas.push(numericDelta(
      `measure ${measureNum} x`,
      ourX,
      refMeasure.x,
      3,
    ))
  }

  return buildTestResult('B2', 'measureXPositions', 'B', 'horizontal', fixtureId, deltas)
})

// ─── B3: System Breaks ───────────────────────────────────────────────────────

registerTest('B3', 'systemBreaks', 'B', 'horizontal', 'all', (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { hLayout } = runPipeline(fixtureId)
  const deltas = []

  // Determine system breaks from reference: where y-position jumps
  const refMeasures = [...ref.measures].sort((a, b) => a.id - b.id)
  const refSystemStarts: number[] = [0] // first measure always starts a system
  for (let i = 1; i < refMeasures.length; i++) {
    if (Math.abs(refMeasures[i].y - refMeasures[i - 1].y) > 5 ||
        refMeasures[i].x < refMeasures[i - 1].x) {
      refSystemStarts.push(i)
    }
  }

  // Our system breaks
  const ourSystemStarts: number[] = hLayout.systems.map(sys => {
    const firstMeasure = sys.measureNums[0]
    return firstMeasure - 1 // convert to 0-based
  })

  // Compare system count
  deltas.push(exactDelta(
    'system count',
    String(ourSystemStarts.length),
    String(refSystemStarts.length),
  ))

  // Compare which measures start each system
  const maxSystems = Math.max(ourSystemStarts.length, refSystemStarts.length)
  for (let i = 0; i < maxSystems; i++) {
    const ourStart = ourSystemStarts[i]
    const refStart = refSystemStarts[i]

    if (ourStart === undefined) {
      deltas.push(exactDelta(`system ${i + 1} start`, 'missing', String(refStart)))
    } else if (refStart === undefined) {
      deltas.push(exactDelta(`system ${i + 1} start`, String(ourStart), 'missing'))
    } else {
      deltas.push(exactDelta(
        `system ${i + 1} starts at measure`,
        String(ourStart + 1),
        String(refStart + 1),
      ))
    }
  }

  return buildTestResult('B3', 'systemBreaks', 'B', 'horizontal', fixtureId, deltas)
})

// ─── B4: Segment Widths ──────────────────────────────────────────────────────

const B4_FIXTURES = [
  '01-noteheads', '04-beams', '15-mixed',
  '02-accidentals', '03-rests', '05-stems',
]

registerTest('B4', 'segmentWidths', 'B', 'horizontal', B4_FIXTURES, (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { hLayout } = runPipeline(fixtureId)
  const deltas = []

  // Compare total segment count
  let ourSegCount = 0
  for (const [, m] of hLayout.measures) {
    ourSegCount += m.segments.length
  }

  deltas.push(numericDelta(
    'total segment count',
    ourSegCount,
    ref.segments.length,
    ref.segments.length * 0.2, // 20% tolerance on count (due to different granularity)
    'different segment granularity may cause count difference',
  ))

  // Compare segment widths within each measure by matching positions
  // This is approximate since webmscore segments may not map 1:1 to ours
  if (ref.segments.length > 0 && ourSegCount > 0) {
    const avgRefWidth = ref.segments.reduce((s, seg) => s + seg.sx, 0) / ref.segments.length
    const avgOurWidth = ourSegCount > 0
      ? [...hLayout.measures.values()].flatMap(m => m.segments).reduce((s, seg) => s + seg.width, 0) / ourSegCount
      : 0

    deltas.push(numericDelta(
      'avg segment width',
      avgOurWidth,
      avgRefWidth,
      5,
    ))
  }

  return buildTestResult('B4', 'segmentWidths', 'B', 'horizontal', fixtureId, deltas)
})

// ─── B5: Note X Positions ────────────────────────────────────────────────────

registerTest('B5', 'noteXPositions', 'B', 'horizontal', 'all', (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { hLayout, rendered } = runPipeline(fixtureId)
  const deltas = []

  // Assign reference notes to measures by matching x AND y against measure ranges.
  // Multi-system fixtures have measures on different systems with overlapping x-ranges,
  // so y-proximity is needed to disambiguate.
  const refMeasureRanges = ref.measures.map(m => ({
    id: m.id,
    x: m.x,
    x2: m.x + m.sx,
    y: m.y,
    sy: m.sy,
  }))

  // Group our notes by measureNum
  const ourNotesByMeasure = new Map<number, typeof rendered.allNotes>()
  for (const n of rendered.allNotes) {
    if (n.isRest || n.isGrace) continue
    const arr = ourNotesByMeasure.get(n.measureNum) || []
    arr.push(n)
    ourNotesByMeasure.set(n.measureNum, arr)
  }

  // Group ref notes by measure: match by (x within range) AND (y within system row)
  const refNotesByMeasure = new Map<number, typeof ref.notes>()
  for (const rn of ref.notes) {
    let bestM = -1
    let bestDist = Infinity
    for (const mr of refMeasureRanges) {
      const inX = rn.x >= mr.x - 5 && rn.x <= mr.x2 + 5
      // y-proximity: note should be within ~200px of measure y (staff area + some margin)
      const inY = Math.abs(rn.y - mr.y) < 200
      if (inX && inY) {
        bestM = mr.id + 1
        break
      }
      if (inY) {
        const dist = Math.abs(rn.x - mr.x)
        if (dist < bestDist) { bestDist = dist; bestM = mr.id + 1 }
      }
    }
    if (bestM > 0) {
      const arr = refNotesByMeasure.get(bestM) || []
      arr.push(rn)
      refNotesByMeasure.set(bestM, arr)
    }
  }

  // Build maps for system-break alignment: skip measures whose system differs
  const ourMeasureSysIdx = new Map<number, number>()
  for (const sys of hLayout.systems) {
    for (const mNum of sys.measureNums) {
      ourMeasureSysIdx.set(mNum, sys.systemIndex)
    }
  }
  const refSysMap = detectRefSystems(ref.measures)
  // Only compare measures on system 0 of both (or where system indices match)
  const refFirstMeasures2 = detectRefFirstMeasures(ref.measures)
  const firstMeasureOfSystem2 = new Set<number>()
  for (const sys of hLayout.systems) {
    if (sys.measureNums.length > 0) firstMeasureOfSystem2.add(sys.measureNums[0])
  }

  // Compare within each measure: sort by x, pair up
  const allMeasures = new Set([...ourNotesByMeasure.keys(), ...refNotesByMeasure.keys()])
  for (const mNum of [...allMeasures].sort((a, b) => a - b)) {
    // Skip if this measure's system assignment differs between our layout and reference
    const ourSys = ourMeasureSysIdx.get(mNum)
    const refSys = refSysMap.get(mNum - 1) // refSysMap uses 0-based ids
    const ourIsFirst = firstMeasureOfSystem2.has(mNum)
    const refIsFirst = refFirstMeasures2.has(mNum - 1)
    if (ourIsFirst !== refIsFirst) continue // system break mismatch

    const ours = (ourNotesByMeasure.get(mNum) || []).sort((a, b) => a.x - b.x)
    const refs = (refNotesByMeasure.get(mNum) || []).sort((a, b) => a.x - b.x)
    const count = Math.min(ours.length, refs.length)
    for (let i = 0; i < count; i++) {
      deltas.push(numericDelta(
        `m${mNum} note[${i}] x (${ours[i].noteId})`,
        ours[i].x,
        refs[i].x,
        4,
      ))
    }
  }

  if (deltas.length === 0) {
    deltas.push(exactDelta('no notes to compare', '0', '0'))
  }

  return buildTestResult('B5', 'noteXPositions', 'B', 'horizontal', fixtureId, deltas)
})

// ─── B6: Header Widths ──────────────────────────────────────────────────────

const B6_FIXTURES = ['06-key-signatures', '07-time-signatures', '01-noteheads', '15-mixed']

registerTest('B6', 'headerWidths', 'B', 'horizontal', B6_FIXTURES, (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { hLayout } = runPipeline(fixtureId)
  const deltas = []

  // Estimate reference header width: first measure x - system left margin
  // System left margin ≈ first staff line x1
  if (ref.measures.length > 0 && ref.staffLines.length > 0) {
    const firstMeasureX = ref.measures[0].x
    const systemLeft = Math.min(...ref.staffLines.map(sl => sl.x1))
    const refHeaderWidth = firstMeasureX - systemLeft

    const ourHeaderWidth = hLayout.systems[0]?.headerWidth ?? 0

    deltas.push(numericDelta(
      'system 1 header width',
      ourHeaderWidth,
      refHeaderWidth,
      4,
    ))
  }

  return buildTestResult('B6', 'headerWidths', 'B', 'horizontal', fixtureId, deltas)
})

// ─── B7: Justification — Total Width ─────────────────────────────────────────

registerTest('B7', 'justificationSlack', 'B', 'horizontal', 'all', (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { hLayout } = runPipeline(fixtureId)
  const deltas = []

  // For each system, check that total measure widths fill the system width
  for (const sys of hLayout.systems) {
    const measures = sys.measureNums
      .map(n => hLayout.measures.get(n))
      .filter(Boolean)

    if (measures.length === 0) continue

    const totalWidth = measures.reduce((s, m) => s + m!.width, 0) + sys.headerWidth
    const expectedWidth = sys.width

    deltas.push(numericDelta(
      `system ${sys.systemIndex + 1} fill`,
      totalWidth,
      expectedWidth,
      5,
      `${measures.length} measures`,
    ))
  }

  return buildTestResult('B7', 'justificationSlack', 'B', 'horizontal', fixtureId, deltas)
})
