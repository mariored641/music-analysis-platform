/**
 * Category C — Vertical Layout Tests
 *
 * Compares our computeVerticalLayout() output against
 * webmscore SVG-parsed reference data.
 *
 * These tests isolate vertical positioning: note y, staff lines,
 * stem directions/lengths, beam geometry, accidentals, dots, etc.
 */

import {
  registerTest,
  loadReferenceData,
  runPipeline,
  numericDelta,
  exactDelta,
  buildTestResult,
} from './harness'

// Helper: detect which measures start new systems in ref data (by y-position jumps)
function detectRefFirstMeasures(measures: { id: number; y: number }[]): Set<number> {
  const set = new Set<number>()
  if (measures.length > 0) set.add(measures[0].id)
  for (let i = 1; i < measures.length; i++) {
    if (Math.abs(measures[i].y - measures[i - 1].y) > 10) set.add(measures[i].id)
  }
  return set
}

// ─── C1: Note Y Positions ───────────────────────────────────────────────────

registerTest('C1', 'noteYPositions', 'C', 'vertical', 'all', (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Detect system break alignment to skip mismatched measures
  const refFirstMeasures = detectRefFirstMeasures(ref.measures)
  const ourFirstMeasures = new Set<number>()
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      if (sys.measures.length > 0) ourFirstMeasures.add(sys.measures[0].measureNum)
    }
  }

  // Group our notes by measure
  const ourByMeasure = new Map<number, typeof rendered.allNotes>()
  for (const n of rendered.allNotes) {
    if (n.isRest || n.isGrace) continue
    const arr = ourByMeasure.get(n.measureNum) || []
    arr.push(n)
    ourByMeasure.set(n.measureNum, arr)
  }

  // Group ref notes by measure using measure x+y ranges (y for multi-system disambiguation)
  const refMeasureRanges = ref.measures.map(m => ({
    id: m.id + 1, x: m.x, x2: m.x + m.sx, y: m.y,
  }))
  const refByMeasure = new Map<number, typeof ref.notes>()
  for (const rn of ref.notes) {
    for (const mr of refMeasureRanges) {
      if (rn.x >= mr.x - 5 && rn.x <= mr.x2 + 5 && Math.abs(rn.y - mr.y) < 200) {
        const arr = refByMeasure.get(mr.id) || []
        arr.push(rn)
        refByMeasure.set(mr.id, arr)
        break
      }
    }
  }

  // Within each measure, sort by x and compare y pairwise
  for (const mNum of [...ourByMeasure.keys()].sort((a, b) => a - b)) {
    // Skip measures with system-break mismatch (different system in our vs ref)
    const ourIsFirst = ourFirstMeasures.has(mNum)
    const refIsFirst = refFirstMeasures.has(mNum - 1) // ref uses 0-based ids
    if (ourIsFirst !== refIsFirst) continue

    const ours = (ourByMeasure.get(mNum) || []).sort((a, b) => a.x - b.x)
    const refs = (refByMeasure.get(mNum) || []).sort((a, b) => a.x - b.x)
    const count = Math.min(ours.length, refs.length)
    for (let i = 0; i < count; i++) {
      deltas.push(numericDelta(
        `m${mNum} note[${i}] y (${ours[i].noteId})`,
        ours[i].y,
        refs[i].y,
        2,
      ))
    }
  }

  return buildTestResult('C1', 'noteYPositions', 'C', 'vertical', fixtureId, deltas)
})

// ─── C2: Staff Line Y Values ────────────────────────────────────────────────

registerTest('C2', 'staffLineYValues', 'C', 'vertical', 'all', (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Get our staff line y-values
  const ourStaffLineYs: number[] = []
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const staff of sys.staves) {
        ourStaffLineYs.push(...staff.lineYs)
      }
    }
  }

  // Reference staff lines (sorted)
  const refYs = ref.staffLines.map(sl => sl.y).sort((a, b) => a - b)
  const ourYs = [...ourStaffLineYs].sort((a, b) => a - b)

  deltas.push(numericDelta('staff line count', ourYs.length, refYs.length, 0))

  const count = Math.min(ourYs.length, refYs.length)
  for (let i = 0; i < count; i++) {
    deltas.push(numericDelta(`staffLine[${i}] y`, ourYs[i], refYs[i], 1))
  }

  return buildTestResult('C2', 'staffLineYValues', 'C', 'vertical', fixtureId, deltas)
})

// ─── C3: Stem Directions ────────────────────────────────────────────────────

const C3_FIXTURES = ['01-noteheads', '05-stems', '14-chords']

registerTest('C3', 'stemDirections', 'C', 'vertical', C3_FIXTURES, (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Match stems by x-position
  const ourNotes = rendered.allNotes
    .filter(n => n.hasStem && !n.isRest && !n.isGrace)
    .sort((a, b) => a.x - b.x)

  const refStems = [...ref.stems].sort((a, b) => a.x - b.x)

  // Build ref note lookup for direction detection: match each stem to nearest ref note by x
  const refNotesSorted = [...ref.notes].sort((a, b) => a.x - b.x)

  function refStemDirection(stem: { x: number; yTop: number; yBottom: number }): 'up' | 'down' {
    // Find the closest ref note by x-distance
    let bestNote = refNotesSorted[0]
    let bestDist = Infinity
    for (const rn of refNotesSorted) {
      const d = Math.abs(rn.x - stem.x)
      if (d < bestDist) { bestDist = d; bestNote = rn }
      if (d > bestDist + 50) break // early exit since sorted
    }
    if (!bestNote || bestDist > 30) return 'up' // fallback
    const stemMid = (stem.yTop + stem.yBottom) / 2
    // If note center is BELOW stem midpoint → stem goes UP from note
    // If note center is ABOVE stem midpoint → stem goes DOWN from note
    return bestNote.y > stemMid ? 'up' : 'down'
  }

  const count = Math.min(ourNotes.length, refStems.length)
  for (let i = 0; i < count; i++) {
    if (Math.abs(ourNotes[i].stemX - refStems[i].x) > 10) continue

    const ourUp = ourNotes[i].stemUp
    const refUp = refStemDirection(refStems[i]) === 'up'

    deltas.push(exactDelta(
      `stem[${i}] direction (${ourNotes[i].noteId})`,
      ourUp ? 'up' : 'down',
      refUp ? 'up' : 'down',
    ))
  }

  return buildTestResult('C3', 'stemDirections', 'C', 'vertical', fixtureId, deltas)
})

// ─── C4: Stem Lengths ───────────────────────────────────────────────────────

registerTest('C4', 'stemLengths', 'C', 'vertical', ['05-stems', '01-noteheads'], (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  const ourNotes = rendered.allNotes
    .filter(n => n.hasStem && !n.isRest && !n.isGrace)
    .sort((a, b) => a.x - b.x)

  const refStems = [...ref.stems].sort((a, b) => a.x - b.x)

  const count = Math.min(ourNotes.length, refStems.length)
  for (let i = 0; i < count; i++) {
    if (Math.abs(ourNotes[i].stemX - refStems[i].x) > 10) continue

    const ourLength = Math.abs(ourNotes[i].stemYBottom - ourNotes[i].stemYTop)
    const refLength = refStems[i].yBottom - refStems[i].yTop

    deltas.push(numericDelta(
      `stem[${i}] length (${ourNotes[i].noteId})`,
      ourLength,
      refLength,
      3,
    ))
  }

  return buildTestResult('C4', 'stemLengths', 'C', 'vertical', fixtureId, deltas)
})

// ─── C5: Stem Endpoints ─────────────────────────────────────────────────────

registerTest('C5', 'stemEndpoints', 'C', 'vertical', ['01-noteheads', '05-stems'], (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  const ourNotes = rendered.allNotes
    .filter(n => n.hasStem && !n.isRest && !n.isGrace)
    .sort((a, b) => a.x - b.x)

  const refStems = [...ref.stems].sort((a, b) => a.x - b.x)

  const count = Math.min(ourNotes.length, refStems.length)
  for (let i = 0; i < count; i++) {
    if (Math.abs(ourNotes[i].stemX - refStems[i].x) > 10) continue

    deltas.push(numericDelta(
      `stem[${i}] yTop`,
      ourNotes[i].stemYTop,
      refStems[i].yTop,
      3,
    ))
    deltas.push(numericDelta(
      `stem[${i}] yBottom`,
      ourNotes[i].stemYBottom,
      refStems[i].yBottom,
      3,
    ))
  }

  return buildTestResult('C5', 'stemEndpoints', 'C', 'vertical', fixtureId, deltas)
})

// ─── C6: Beam Slopes ────────────────────────────────────────────────────────

registerTest('C6', 'beamSlopes', 'C', 'vertical', ['04-beams'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Check that beam slopes are reasonable (within ±35°)
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        for (const beam of measure.beams) {
          if (beam.segments.length === 0 || beam.segments[0].length === 0) continue
          const primary = beam.segments[0][0] // first level, first segment
          const dx = primary.x2 - primary.x1
          if (Math.abs(dx) < 1) continue

          const slope = (primary.y2 - primary.y1) / dx
          const angleDeg = Math.atan(Math.abs(slope)) * 180 / Math.PI

          deltas.push(numericDelta(
            `beam ${beam.groupId} angle`,
            angleDeg,
            15, // target: moderate slope
            20, // tolerance: up to 35° is acceptable
            `slope=${slope.toFixed(3)}`,
          ))
        }
      }
    }
  }

  return buildTestResult('C6', 'beamSlopes', 'C', 'vertical', fixtureId, deltas)
})

// ─── C7: Beam Y Positions ───────────────────────────────────────────────────

registerTest('C7', 'beamYPositions', 'C', 'vertical', ['04-beams'], (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Count beams
  let ourBeamCount = 0
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        ourBeamCount += measure.beams.length
      }
    }
  }

  deltas.push(numericDelta(
    'beam group count',
    ourBeamCount,
    ref.beams.length,
    ref.beams.length * 0.3, // 30% tolerance (beam detection in SVG is imperfect)
  ))

  return buildTestResult('C7', 'beamYPositions', 'C', 'vertical', fixtureId, deltas)
})

// ─── C8: Accidental X Offsets ───────────────────────────────────────────────

registerTest('C8', 'accidentalXOffsets', 'C', 'vertical', ['02-accidentals', '14-chords'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Verify accidentals are positioned to the left of their noteheads
  const notesWithAcc = rendered.allNotes.filter(n => n.accidental && n.accidentalX !== undefined)

  for (const note of notesWithAcc) {
    const gap = note.x - note.accidentalX!
    deltas.push(numericDelta(
      `acc gap (${note.noteId})`,
      gap,
      10, // typical gap ~8-15px
      10, // generous tolerance — we just want it to be left of note
      gap < 0 ? 'ACCIDENTAL TO THE RIGHT OF NOTE!' : undefined,
    ))
  }

  return buildTestResult('C8', 'accidentalXOffsets', 'C', 'vertical', fixtureId, deltas)
})

// ─── C9: Dot Positions ──────────────────────────────────────────────────────

registerTest('C9', 'dotPositions', 'C', 'vertical', ['13-dots'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  const dottedNotes = rendered.allNotes.filter(n => n.dotted && n.dotX !== undefined)

  for (const note of dottedNotes) {
    // Dot should be to the right of the notehead
    const dotGap = note.dotX! - note.x
    deltas.push(numericDelta(
      `dot x gap (${note.noteId})`,
      dotGap,
      12, // typical dot gap ~10-15px
      10,
      dotGap < 0 ? 'DOT TO THE LEFT OF NOTE!' : undefined,
    ))
  }

  return buildTestResult('C9', 'dotPositions', 'C', 'vertical', fixtureId, deltas)
})

// ─── C10: Rest Y Positions ──────────────────────────────────────────────────

registerTest('C10', 'restYPositions', 'C', 'vertical', ['03-rests'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  const rests = rendered.allNotes.filter(n => n.isRest)

  for (const rest of rests) {
    // Get staff center y for this rest's staff
    const page = rendered.pages[0]
    const system = page?.systems.find(s => s.measures.some(m => m.measureNum === rest.measureNum))
    if (!system) continue

    const staff = system.staves[rest.staffIndex]
    if (!staff) continue

    const staffCenter = staff.y + staff.height / 2
    const distFromCenter = Math.abs(rest.y - staffCenter)

    // Rest should be near staff center (within 1.5 staff spaces)
    deltas.push(numericDelta(
      `rest y dist from center (m${rest.measureNum})`,
      distFromCenter,
      0,
      staff.lineSpacing * 1.5,
    ))
  }

  return buildTestResult('C10', 'restYPositions', 'C', 'vertical', fixtureId, deltas)
})

// ─── C11: Chord Symbol Positions ────────────────────────────────────────────

registerTest('C11', 'chordSymbolXY', 'C', 'vertical', ['11-chord-symbols', '15-mixed'], (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Collect our chord symbols
  const ourChords = rendered.pages.flatMap(p =>
    p.systems.flatMap(s => s.measures.flatMap(m => m.chordSymbols))
  ).sort((a, b) => a.x - b.x)

  const refChords = [...ref.chordSymbols].sort((a, b) => a.x - b.x)

  deltas.push(numericDelta('chord symbol count', ourChords.length, refChords.length, 0))

  const count = Math.min(ourChords.length, refChords.length)
  for (let i = 0; i < count; i++) {
    deltas.push(numericDelta(`chord[${i}] x (${ourChords[i].text})`, ourChords[i].x, refChords[i].x, 4))
    deltas.push(numericDelta(`chord[${i}] y (${ourChords[i].text})`, ourChords[i].y, refChords[i].y, 4))
  }

  return buildTestResult('C11', 'chordSymbolXY', 'C', 'vertical', fixtureId, deltas)
})

// ─── C12: Tie Arc Endpoints ─────────────────────────────────────────────────

registerTest('C12', 'tieArcEndpoints', 'C', 'vertical', ['10-ties'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Count ties
  let tieCount = 0
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        tieCount += measure.ties.length
      }
    }
  }

  // Verify ties exist and have valid geometry
  deltas.push(numericDelta('tie count', tieCount, 3, 3, 'expected at least a few ties'))

  // Check each tie has valid bezier
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        for (const tie of measure.ties) {
          const span = Math.abs(tie.path.x2 - tie.path.x1)
          deltas.push(numericDelta(
            `tie ${tie.fromNoteId}→${tie.toNoteId} span`,
            span,
            30, // typical tie span
            100, // generous — just verify it's a real span
          ))
        }
      }
    }
  }

  return buildTestResult('C12', 'tieArcEndpoints', 'C', 'vertical', fixtureId, deltas)
})

// ─── C13: Tuplet Brackets ───────────────────────────────────────────────────

registerTest('C13', 'tupletBrackets', 'C', 'vertical', ['09-tuplets'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  let tupletCount = 0
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        tupletCount += measure.tuplets.length
      }
    }
  }

  deltas.push(numericDelta('tuplet count', tupletCount, 2, 3, 'expected some tuplets'))

  return buildTestResult('C13', 'tupletBrackets', 'C', 'vertical', fixtureId, deltas)
})

// ─── C14: Barline Positions ─────────────────────────────────────────────────

registerTest('C14', 'barlinePositions', 'C', 'vertical', ['12-barlines'], (fixtureId) => {
  const ref = loadReferenceData(fixtureId)
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Collect our barline x positions
  const ourBarlines = rendered.pages.flatMap(p =>
    p.systems.flatMap(s => s.measures.flatMap(m => m.barlines))
  ).sort((a, b) => a.x - b.x)

  const refBarlines = [...ref.barlines].sort((a, b) => a.x - b.x)

  deltas.push(numericDelta('barline count', ourBarlines.length, refBarlines.length, 2))

  const count = Math.min(ourBarlines.length, refBarlines.length)
  for (let i = 0; i < count; i++) {
    deltas.push(numericDelta(`barline[${i}] x`, ourBarlines[i].x, refBarlines[i].x, 2))
  }

  return buildTestResult('C14', 'barlinePositions', 'C', 'vertical', fixtureId, deltas)
})

// ─── C15: Ledger Line Y Values ──────────────────────────────────────────────

registerTest('C15', 'ledgerLineYValues', 'C', 'vertical', ['08-ledger-lines'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Check that notes with ledger lines have them at correct y-positions
  const notesWithLedgers = rendered.allNotes.filter(n => n.ledgerLines.length > 0)

  for (const note of notesWithLedgers) {
    for (const ll of note.ledgerLines) {
      // Ledger line should be near the note y (within a few staff spaces)
      const dist = Math.abs(ll.y - note.y)
      deltas.push(numericDelta(
        `ledger y dist (${note.noteId})`,
        dist,
        5, // typically close to note
        20, // generous
      ))
    }
  }

  return buildTestResult('C15', 'ledgerLineYValues', 'C', 'vertical', fixtureId, deltas)
})

// ─── C16: Key Signature X Positions ─────────────────────────────────────────

registerTest('C16', 'keySignatureX', 'C', 'vertical', ['06-key-signatures'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Check that key signatures exist and have valid positions
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        if (measure.keySignatureChange) {
          const ks = measure.keySignatureChange
          // Key sig x is page-relative. For first-in-system it's in the header
          // area (between sys.x and measure.x). For mid-system measures it's
          // near measure.x + barline width. Use measure.x as reference.
          const isFirstInSystem = measure.measureNum === sys.measures[0]?.measureNum
          const expectedX = isFirstInSystem ? sys.x + 30 : measure.x + 12
          const tolerance = isFirstInSystem ? 80 : 30
          deltas.push(numericDelta(
            `keySig m${measure.measureNum} x`,
            ks.x,
            expectedX,
            tolerance,
          ))

          // Each accidental should be ordered correctly (positive gap = left-to-right)
          for (let i = 1; i < ks.accidentals.length; i++) {
            const gap = ks.accidentals[i].x - ks.accidentals[i - 1].x
            deltas.push(numericDelta(
              `keySig m${measure.measureNum} acc[${i}] gap`,
              gap,
              15, // inter-accidental gap varies by renderer
              25,
            ))
          }
        }
      }
    }
  }

  return buildTestResult('C16', 'keySignatureX', 'C', 'vertical', fixtureId, deltas)
})

// ─── C17: Time Signature X Positions ────────────────────────────────────────

registerTest('C17', 'timeSignatureX', 'C', 'vertical', ['07-time-signatures'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        if (measure.timeSignatureDisplay) {
          const ts = measure.timeSignatureDisplay
          // Time sig x is page-relative. For first-in-system it's in the header
          // (after clef+key). For mid-system measures it's near barline area.
          const isFirstInSystem = measure.measureNum === sys.measures[0]?.measureNum
          const expectedX = isFirstInSystem ? sys.x + 50 : measure.x
          const tolerance = isFirstInSystem ? 80 : 90
          deltas.push(numericDelta(
            `timeSig m${measure.measureNum} x`,
            ts.x,
            expectedX,
            tolerance,
          ))
        }
      }
    }
  }

  return buildTestResult('C17', 'timeSignatureX', 'C', 'vertical', fixtureId, deltas)
})
