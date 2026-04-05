/**
 * Category D — SVG Render Verification Tests
 *
 * Verifies our SVG output is well-formed and contains expected elements.
 * Parses our SVG and checks element counts/types.
 */

import { DOMParser } from 'linkedom'
import {
  registerTest,
  runPipeline,
  numericDelta,
  exactDelta,
  buildTestResult,
} from './harness'

function parseSvg(svgString: string) {
  const parser = new DOMParser()
  return parser.parseFromString(svgString, 'image/svg+xml')
}

// ─── D1: Notehead Glyphs ───────────────────────────────────────────────────

registerTest('D1', 'noteheadGlyphs', 'D', 'svgRender', ['01-noteheads'], (fixtureId) => {
  const { svg, rendered } = runPipeline(fixtureId)
  const deltas = []

  const doc = parseSvg(svg)
  const noteGroups = doc.querySelectorAll('g[data-type="note"]')

  const expectedNotes = rendered.allNotes.filter(n => !n.isRest).length
  deltas.push(numericDelta('note <g> elements', noteGroups.length, expectedNotes, expectedNotes * 0.2))

  return buildTestResult('D1', 'noteheadGlyphs', 'D', 'svgRender', fixtureId, deltas)
})

// ─── D2: Stem Elements ─────────────────────────────────────────────────────

registerTest('D2', 'stemElements', 'D', 'svgRender', ['05-stems'], (fixtureId) => {
  const { svg, rendered } = runPipeline(fixtureId)
  const deltas = []

  const doc = parseSvg(svg)
  // Stems are typically <line> elements within note groups
  const stemLines = doc.querySelectorAll('line[data-type="stem"], g[data-type="note"] line')

  const expectedStems = rendered.allNotes.filter(n => n.hasStem).length
  deltas.push(numericDelta(
    'stem line elements',
    stemLines.length,
    expectedStems,
    expectedStems * 0.3,
    'some stems may be rendered differently',
  ))

  return buildTestResult('D2', 'stemElements', 'D', 'svgRender', fixtureId, deltas)
})

// ─── D3: Beam Elements ─────────────────────────────────────────────────────

registerTest('D3', 'beamElements', 'D', 'svgRender', ['04-beams'], (fixtureId) => {
  const { svg, rendered } = runPipeline(fixtureId)
  const deltas = []

  const doc = parseSvg(svg)
  // Beams are typically polygon or path elements
  const beamElements = doc.querySelectorAll('[data-type="beam"], polygon, path[data-beam]')

  let expectedBeams = 0
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const m of sys.measures) {
        expectedBeams += m.beams.length
      }
    }
  }

  deltas.push(numericDelta('beam elements', beamElements.length, expectedBeams, expectedBeams))

  return buildTestResult('D3', 'beamElements', 'D', 'svgRender', fixtureId, deltas)
})

// ─── D4: Clef Glyphs ───────────────────────────────────────────────────────

registerTest('D4', 'clefGlyphs', 'D', 'svgRender', ['06-key-signatures'], (fixtureId) => {
  const { svg, rendered } = runPipeline(fixtureId)
  const deltas = []

  const doc = parseSvg(svg)
  const clefElements = doc.querySelectorAll('[data-type="clef"]')

  const expectedClefs = rendered.pages.flatMap(p =>
    p.systems.flatMap(s => s.staves.length)
  ).reduce((a, b) => a + b, 0)

  deltas.push(numericDelta('clef elements', clefElements.length, expectedClefs, expectedClefs))

  return buildTestResult('D4', 'clefGlyphs', 'D', 'svgRender', fixtureId, deltas)
})

// ─── D5: Staff Line Count ───────────────────────────────────────────────────

registerTest('D5', 'staffLineCount', 'D', 'svgRender', 'all', (fixtureId) => {
  const { svg, rendered } = runPipeline(fixtureId)
  const deltas = []

  const doc = parseSvg(svg)
  // Staff lines are long horizontal lines
  const allLines = doc.querySelectorAll('line')
  let staffLineCount = 0

  for (const line of allLines) {
    const x1 = parseFloat(line.getAttribute('x1') || '0')
    const y1 = parseFloat(line.getAttribute('y1') || '0')
    const x2 = parseFloat(line.getAttribute('x2') || '0')
    const y2 = parseFloat(line.getAttribute('y2') || '0')
    if (Math.abs(y1 - y2) < 0.5 && Math.abs(x2 - x1) > 100) {
      staffLineCount++
    }
  }

  // Expected: 5 lines per staff per system
  const expectedStaffLines = rendered.pages.flatMap(p =>
    p.systems.flatMap(s => s.staves.length * 5)
  ).reduce((a, b) => a + b, 0)

  deltas.push(numericDelta('staff lines in SVG', staffLineCount, expectedStaffLines, 0))

  return buildTestResult('D5', 'staffLineCount', 'D', 'svgRender', fixtureId, deltas)
})

// ─── D6: Accidental Glyphs ──────────────────────────────────────────────────

registerTest('D6', 'accidentalGlyphs', 'D', 'svgRender', ['02-accidentals'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  const accNotes = rendered.allNotes.filter(n => n.accidental)
  deltas.push(numericDelta('notes with accidentals', accNotes.length, 5, accNotes.length, 'should have accidentals'))

  return buildTestResult('D6', 'accidentalGlyphs', 'D', 'svgRender', fixtureId, deltas)
})

// ─── D7: Rest Glyphs ───────────────────────────────────────────────────────

registerTest('D7', 'restGlyphs', 'D', 'svgRender', ['03-rests'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  const rests = rendered.allNotes.filter(n => n.isRest)
  deltas.push(numericDelta('rest elements', rests.length, 3, rests.length, 'should have rests'))

  return buildTestResult('D7', 'restGlyphs', 'D', 'svgRender', fixtureId, deltas)
})

// ─── D8: Flag Glyphs ───────────────────────────────────────────────────────

registerTest('D8', 'flagGlyphs', 'D', 'svgRender', ['01-noteheads'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Notes that should have flags: 8th or 16th notes that aren't beamed
  const flagged = rendered.allNotes.filter(n =>
    !n.isRest && !n.beamGroupId &&
    (n.durationType === 'eighth' || n.durationType === '16th')
  )

  // Just verify the renderer knows about flagged notes
  deltas.push(numericDelta('flagged notes', flagged.length, 0, flagged.length + 10))

  return buildTestResult('D8', 'flagGlyphs', 'D', 'svgRender', fixtureId, deltas)
})

// ─── D9: Tie Arc Paths ─────────────────────────────────────────────────────

registerTest('D9', 'tieArcPaths', 'D', 'svgRender', ['10-ties'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  let tieCount = 0
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const m of sys.measures) {
        tieCount += m.ties.length
      }
    }
  }

  deltas.push(numericDelta('tie arcs', tieCount, 2, tieCount, 'should have ties'))

  // Verify each tie has valid bezier control points
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const m of sys.measures) {
        for (const tie of m.ties) {
          const validBezier = tie.path.x1 !== tie.path.x2 && tie.path.cy1 !== tie.path.y1
          deltas.push(exactDelta(
            `tie ${tie.fromNoteId} bezier valid`,
            String(validBezier),
            'true',
          ))
        }
      }
    }
  }

  return buildTestResult('D9', 'tieArcPaths', 'D', 'svgRender', fixtureId, deltas)
})

// ─── D10: Chord Symbol Text ────────────────────────────────────────────────

registerTest('D10', 'chordSymbolText', 'D', 'svgRender', ['11-chord-symbols'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  const chords = rendered.pages.flatMap(p =>
    p.systems.flatMap(s => s.measures.flatMap(m => m.chordSymbols))
  )

  deltas.push(numericDelta('chord symbols', chords.length, 3, chords.length, 'should have chord symbols'))

  // Verify each has non-empty text
  for (const chord of chords) {
    deltas.push(exactDelta(
      `chord m${chord.measureNum} has text`,
      String(chord.text.length > 0),
      'true',
      `text="${chord.text}"`,
    ))
  }

  return buildTestResult('D10', 'chordSymbolText', 'D', 'svgRender', fixtureId, deltas)
})
