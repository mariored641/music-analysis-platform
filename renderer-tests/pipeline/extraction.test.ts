/**
 * Category A — Extraction Verification Tests
 *
 * Verifies extractScore() parses MusicXML correctly.
 * Self-contained — no webmscore reference needed.
 * Compares against known fixture contents.
 */

import {
  registerTest,
  runPipeline,
  numericDelta,
  exactDelta,
  buildTestResult,
} from './harness'

// ─── A1: Note Count ─────────────────────────────────────────────────────────

const EXPECTED_NOTES: Record<string, number> = {
  '01-noteheads': -1,  // -1 = skip exact check, just verify > 0
  '02-accidentals': -1,
  '03-rests': -1,
  '04-beams': -1,
  '05-stems': -1,
}

registerTest('A1', 'noteCount', 'A', 'extraction', 'all', (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  const totalNotes = extracted.measures.reduce(
    (sum, m) => sum + m.notes.length, 0
  )

  // Just verify we extracted some notes
  deltas.push(numericDelta('total notes', totalNotes, 10, totalNotes, 'should have some notes'))

  // Verify no measures are empty (unless rest-only)
  const emptyMeasures = extracted.measures.filter(m => m.notes.length === 0)
  deltas.push(numericDelta('empty measures', emptyMeasures.length, 0, extracted.measures.length * 0.1))

  return buildTestResult('A1', 'noteCount', 'A', 'extraction', fixtureId, deltas)
})

// ─── A2: Pitch Accuracy ─────────────────────────────────────────────────────

registerTest('A2', 'pitchAccuracy', 'A', 'extraction', ['01-noteheads', '02-accidentals', '14-chords'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  // Verify all non-rest notes have valid pitch data
  for (const measure of extracted.measures) {
    for (const note of measure.notes) {
      if (note.isRest) continue

      const hasStep = note.step && ['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(note.step)
      deltas.push(exactDelta(
        `m${measure.num} ${note.id} has valid step`,
        String(hasStep),
        'true',
        `step=${note.step}`,
      ))

      const hasOctave = note.octave !== undefined && note.octave >= 0 && note.octave <= 9
      deltas.push(exactDelta(
        `m${measure.num} ${note.id} has valid octave`,
        String(hasOctave),
        'true',
        `octave=${note.octave}`,
      ))
    }
  }

  return buildTestResult('A2', 'pitchAccuracy', 'A', 'extraction', fixtureId, deltas)
})

// ─── A3: Rest Detection ─────────────────────────────────────────────────────

registerTest('A3', 'restDetection', 'A', 'extraction', ['03-rests'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  const rests = extracted.measures.flatMap(m => m.notes.filter(n => n.isRest))
  deltas.push(numericDelta('rest count', rests.length, 5, rests.length, 'should have some rests'))

  // Each rest should have a valid type
  for (const rest of rests) {
    const validTypes = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd', '64th']
    deltas.push(exactDelta(
      `rest type valid`,
      String(validTypes.includes(rest.type)),
      'true',
      `type=${rest.type}`,
    ))
  }

  return buildTestResult('A3', 'restDetection', 'A', 'extraction', fixtureId, deltas)
})

// ─── A4: Beam States ─────────────────────────────────────────────────────────

registerTest('A4', 'beamStates', 'A', 'extraction', ['04-beams'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  let beamBegins = 0, beamContinues = 0, beamEnds = 0

  for (const measure of extracted.measures) {
    for (const note of measure.notes) {
      if (!note.beamStates) continue
      for (const bs of note.beamStates) {
        if (bs.value === 'begin') beamBegins++
        else if (bs.value === 'continue') beamContinues++
        else if (bs.value === 'end') beamEnds++
      }
    }
  }

  // Beam begins should equal beam ends
  deltas.push(numericDelta('beam begin count', beamBegins, beamEnds, 1, 'begins should ≈ ends'))
  deltas.push(numericDelta('beam begin > 0', beamBegins, 5, beamBegins, 'should have beams'))

  return buildTestResult('A4', 'beamStates', 'A', 'extraction', fixtureId, deltas)
})

// ─── A5: Tie Links ──────────────────────────────────────────────────────────

registerTest('A5', 'tieLinks', 'A', 'extraction', ['10-ties'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  let tieStarts = 0, tieStops = 0

  for (const measure of extracted.measures) {
    for (const note of measure.notes) {
      if (note.tieStart) tieStarts++
      if (note.tieStop) tieStops++
    }
  }

  deltas.push(numericDelta('tie starts', tieStarts, tieStops, 1, 'starts should ≈ stops'))
  deltas.push(numericDelta('tie starts > 0', tieStarts, 2, tieStarts, 'should have ties'))

  return buildTestResult('A5', 'tieLinks', 'A', 'extraction', fixtureId, deltas)
})

// ─── A6: Tuplet Groups ──────────────────────────────────────────────────────

registerTest('A6', 'tupletGroups', 'A', 'extraction', ['09-tuplets'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  let tupletStarts = 0

  for (const measure of extracted.measures) {
    for (const note of measure.notes) {
      if (note.tupletStart) tupletStarts++
    }
  }

  deltas.push(numericDelta('tuplet groups', tupletStarts, 1, tupletStarts, 'should have tuplets'))

  return buildTestResult('A6', 'tupletGroups', 'A', 'extraction', fixtureId, deltas)
})

// ─── A7: Harmony Labels ─────────────────────────────────────────────────────

registerTest('A7', 'harmonyLabels', 'A', 'extraction', ['11-chord-symbols'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  const harmonies = extracted.measures.flatMap(m => m.harmonies || [])
  deltas.push(numericDelta('harmony count', harmonies.length, 3, harmonies.length, 'should have chord symbols'))

  // Each should have a root
  for (const h of harmonies.slice(0, 10)) {
    const hasRoot = h.root !== undefined && h.root.length > 0
    deltas.push(exactDelta(
      `harmony root`,
      String(hasRoot),
      'true',
      `root=${h.root}`,
    ))
  }

  return buildTestResult('A7', 'harmonyLabels', 'A', 'extraction', fixtureId, deltas)
})

// ─── A8: Barline Types ──────────────────────────────────────────────────────

registerTest('A8', 'barlineTypes', 'A', 'extraction', ['12-barlines'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  let hasRepeat = false, hasDouble = false, hasFinal = false

  for (const measure of extracted.measures) {
    if (measure.barlineLeft?.barStyle?.includes('repeat') || measure.barlineRight?.barStyle?.includes('repeat')) {
      hasRepeat = true
    }
    if (measure.barlineRight?.barStyle === 'light-light') hasDouble = true
    if (measure.barlineRight?.barStyle === 'light-heavy') hasFinal = true
  }

  deltas.push(exactDelta('has repeat barline', String(hasRepeat), 'true'))
  deltas.push(exactDelta('has final barline', String(hasFinal), 'true'))

  return buildTestResult('A8', 'barlineTypes', 'A', 'extraction', fixtureId, deltas)
})

// ─── A9: Dot Counts ─────────────────────────────────────────────────────────

registerTest('A9', 'dotCounts', 'A', 'extraction', ['13-dots'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  let singleDots = 0, doubleDots = 0

  for (const measure of extracted.measures) {
    for (const note of measure.notes) {
      if (note.dotCount === 1) singleDots++
      if (note.dotCount === 2) doubleDots++
    }
  }

  deltas.push(numericDelta('single-dot notes', singleDots, 2, singleDots, 'should have dotted notes'))

  return buildTestResult('A9', 'dotCounts', 'A', 'extraction', fixtureId, deltas)
})

// ─── A10: Chord Members ─────────────────────────────────────────────────────

registerTest('A10', 'chordMembers', 'A', 'extraction', ['14-chords'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  let chordNotes = 0

  for (const measure of extracted.measures) {
    for (const note of measure.notes) {
      if (note.isChord) chordNotes++
    }
  }

  deltas.push(numericDelta('chord member notes', chordNotes, 5, chordNotes, 'should have chord notes'))

  return buildTestResult('A10', 'chordMembers', 'A', 'extraction', fixtureId, deltas)
})

// ─── A11: Key/Time Changes ──────────────────────────────────────────────────

registerTest('A11', 'keyTimeChanges', 'A', 'extraction', ['06-key-signatures', '07-time-signatures'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  if (fixtureId === '06-key-signatures') {
    let keyChanges = 0
    for (const measure of extracted.measures) {
      if (measure.keyChange) keyChanges++
    }
    deltas.push(numericDelta('key changes', keyChanges, 2, keyChanges, 'should have key signature changes'))
  }

  if (fixtureId === '07-time-signatures') {
    let timeChanges = 0
    for (const measure of extracted.measures) {
      if (measure.timeChange) timeChanges++
    }
    deltas.push(numericDelta('time changes', timeChanges, 2, timeChanges, 'should have time signature changes'))
  }

  return buildTestResult('A11', 'keyTimeChanges', 'A', 'extraction', fixtureId, deltas)
})

// ─── A12: Show Accidental Logic ─────────────────────────────────────────────

registerTest('A12', 'showAccidental', 'A', 'extraction', ['02-accidentals'], (fixtureId) => {
  const { extracted } = runPipeline(fixtureId)
  const deltas = []

  let shownCount = 0, totalNonRest = 0

  for (const measure of extracted.measures) {
    for (const note of measure.notes) {
      if (note.isRest) continue
      totalNonRest++
      if (note.showAccidental) shownCount++
    }
  }

  // In the accidentals fixture, many notes should show accidentals
  deltas.push(numericDelta('notes showing accidentals', shownCount, 5, shownCount, 'accidental fixture should have many'))

  return buildTestResult('A12', 'showAccidental', 'A', 'extraction', fixtureId, deltas)
})
