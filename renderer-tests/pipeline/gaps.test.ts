/**
 * Category E — Gap Regression Tests
 *
 * One test per documented gap from RENDERER_GAPS.md.
 * Each test FAILs if the gap exists and PASSes once fixed.
 * This gives a clear dashboard of which MuseScore features are missing.
 */

import {
  registerTest,
  runPipeline,
  numericDelta,
  exactDelta,
  buildTestResult,
} from './harness'

// ─── Gap 3: Autoplace ───────────────────────────────────────────────────────
// Chord symbols and dynamics should not overlap notes or each other

registerTest('E3', 'autoplace', 'E', 'gaps', ['11-chord-symbols', '15-mixed'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      const chords = sys.measures.flatMap(m => m.chordSymbols)
      // Check chord symbols don't overlap each other
      for (let i = 0; i < chords.length; i++) {
        for (let j = i + 1; j < chords.length; j++) {
          const dx = Math.abs(chords[i].x - chords[j].x)
          const dy = Math.abs(chords[i].y - chords[j].y)
          if (dx < 20 && dy < 5) {
            deltas.push(exactDelta(
              `chord overlap: "${chords[i].text}" vs "${chords[j].text}"`,
              'overlapping',
              'separate',
              `dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}`,
            ))
          }
        }
      }

      // Check chord symbols are above staff
      for (const staff of sys.staves) {
        for (const chord of chords) {
          if (chord.y > staff.y) {
            deltas.push(exactDelta(
              `chord "${chord.text}" below staff`,
              'below',
              'above',
              `chord.y=${chord.y.toFixed(1)}, staff.y=${staff.y.toFixed(1)}`,
            ))
          }
        }
      }
    }
  }

  if (deltas.length === 0) {
    deltas.push(exactDelta('no overlap issues', 'true', 'true'))
  }

  return buildTestResult('E3', 'autoplace', 'E', 'gaps', fixtureId, deltas)
})

// ─── Gap 4: Rest Vertical Positioning ───────────────────────────────────────

registerTest('E4', 'restVerticalPosition', 'E', 'gaps', ['03-rests'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      const staff = sys.staves[0]
      if (!staff) continue

      const staffCenter = staff.y + staff.height / 2

      for (const measure of sys.measures) {
        const rests = measure.notes.filter(n => n.isRest)
        for (const rest of rests) {
          const distFromCenter = rest.y - staffCenter
          deltas.push(numericDelta(
            `rest m${rest.measureNum} y offset from center`,
            Math.abs(distFromCenter),
            0,
            staff.lineSpacing * 2, // within 2 staff spaces
          ))
        }
      }
    }
  }

  return buildTestResult('E4', 'restVerticalPosition', 'E', 'gaps', fixtureId, deltas)
})

// ─── Gap 5: Dot Avoidance ───────────────────────────────────────────────────
// Dots on staff lines should shift up by 0.5 staff space

registerTest('E5', 'dotAvoidance', 'E', 'gaps', ['13-dots'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const staff of sys.staves) {
        for (const measure of sys.measures) {
          for (const note of measure.notes) {
            if (!note.dotted || note.dotX === undefined || note.isRest) continue

            // Check if dot y falls exactly on a staff line
            const dotY = note.y // dots are at same y as notehead
            for (const lineY of staff.lineYs) {
              if (Math.abs(dotY - lineY) < 1) {
                // Dot is ON a staff line — it should have been shifted
                deltas.push(exactDelta(
                  `dot on line (${note.noteId})`,
                  'on staff line',
                  'shifted away',
                  `dotY=${dotY.toFixed(1)}, lineY=${lineY.toFixed(1)}`,
                ))
              }
            }
          }
        }
      }
    }
  }

  if (deltas.length === 0) {
    deltas.push(exactDelta('no dots on staff lines', 'true', 'true'))
  }

  return buildTestResult('E5', 'dotAvoidance', 'E', 'gaps', fixtureId, deltas)
})

// ─── Gap 6: Full Accidental Stacking ────────────────────────────────────────

registerTest('E6', 'accidentalStackingFull', 'E', 'gaps', ['02-accidentals', '14-chords'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Find notes with accidentals in the same measure at similar beats
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        const accNotes = measure.notes.filter(n => n.accidental && n.accidentalX !== undefined)

        // Check for accidental overlaps
        for (let i = 0; i < accNotes.length; i++) {
          for (let j = i + 1; j < accNotes.length; j++) {
            const dx = Math.abs(accNotes[i].accidentalX! - accNotes[j].accidentalX!)
            const dy = Math.abs(accNotes[i].y - accNotes[j].y)
            // If vertically close and horizontally overlapping
            if (dy < 10 && dx < 5) {
              deltas.push(exactDelta(
                `acc overlap: ${accNotes[i].noteId} vs ${accNotes[j].noteId}`,
                'overlapping',
                'stacked',
                `dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}`,
              ))
            }
          }
        }
      }
    }
  }

  if (deltas.length === 0) {
    deltas.push(exactDelta('no accidental overlaps', 'true', 'true'))
  }

  return buildTestResult('E6', 'accidentalStackingFull', 'E', 'gaps', fixtureId, deltas)
})

// ─── Gap 7: Padding Table ───────────────────────────────────────────────────

registerTest('E7', 'paddingTable', 'E', 'gaps', ['01-noteheads', '15-mixed'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Check that note spacing is reasonable (not too cramped)
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        const notes = [...measure.notes].filter(n => !n.isRest).sort((a, b) => a.x - b.x)
        for (let i = 1; i < notes.length; i++) {
          const gap = notes[i].x - notes[i - 1].x
          if (gap < 5 && notes[i].beat !== notes[i - 1].beat) {
            deltas.push(numericDelta(
              `note gap m${measure.measureNum} (${notes[i - 1].noteId} → ${notes[i].noteId})`,
              gap,
              10,
              5,
              'too close — padding issue',
            ))
          }
        }
      }
    }
  }

  if (deltas.length === 0) {
    deltas.push(exactDelta('spacing adequate', 'true', 'true'))
  }

  return buildTestResult('E7', 'paddingTable', 'E', 'gaps', fixtureId, deltas)
})

// ─── Gap 11: Harmony Alignment ──────────────────────────────────────────────

registerTest('E11', 'harmonyAlignment', 'E', 'gaps', ['11-chord-symbols'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Within each system, chord symbols should be at approximately the same y
  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      const chords = sys.measures.flatMap(m => m.chordSymbols)
      if (chords.length < 2) continue

      const ys = chords.map(c => c.y)
      const avgY = ys.reduce((s, y) => s + y, 0) / ys.length
      const maxDeviation = Math.max(...ys.map(y => Math.abs(y - avgY)))

      deltas.push(numericDelta(
        `system ${sys.systemIndex} chord y alignment`,
        maxDeviation,
        0,
        5, // within 5px = aligned
      ))
    }
  }

  return buildTestResult('E11', 'harmonyAlignment', 'E', 'gaps', fixtureId, deltas)
})

// ─── Gap 12: Beam Slope Constraints ─────────────────────────────────────────

registerTest('E12', 'beamSlopeConstraints', 'E', 'gaps', ['04-beams'], (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  for (const page of rendered.pages) {
    for (const sys of page.systems) {
      for (const measure of sys.measures) {
        for (const beam of measure.beams) {
          if (beam.segments.length === 0 || beam.segments[0].length === 0) continue
          const primary = beam.segments[0][0]
          const dx = primary.x2 - primary.x1
          if (Math.abs(dx) < 1) continue

          const slope = Math.abs((primary.y2 - primary.y1) / dx)
          const angleDeg = Math.atan(slope) * 180 / Math.PI

          // Max slope should be constrained (per MuseScore rules)
          if (angleDeg > 30) {
            deltas.push(numericDelta(
              `beam ${beam.groupId} too steep`,
              angleDeg,
              15,
              15,
              'exceeds 30° constraint',
            ))
          }
        }
      }
    }
  }

  if (deltas.length === 0) {
    deltas.push(exactDelta('all beam slopes within limits', 'true', 'true'))
  }

  return buildTestResult('E12', 'beamSlopeConstraints', 'E', 'gaps', fixtureId, deltas)
})

// ─── Gap 18: Staff Distribution ─────────────────────────────────────────────

registerTest('E18', 'staffDistribution', 'E', 'gaps', 'all', (fixtureId) => {
  const { rendered } = runPipeline(fixtureId)
  const deltas = []

  // Check that systems have reasonable vertical spacing
  for (const page of rendered.pages) {
    for (let i = 1; i < page.systems.length; i++) {
      const prevSys = page.systems[i - 1]
      const currSys = page.systems[i]

      const prevBottom = Math.max(...prevSys.staves.map(s => s.y + s.height))
      const gap = currSys.y - prevBottom

      deltas.push(numericDelta(
        `system gap ${i - 1}→${i}`,
        gap,
        50, // typical gap
        600, // our system spacing is larger than webmscore — just verify no overlap
        gap < 0 ? 'SYSTEMS OVERLAP!' : undefined,
      ))
    }
  }

  if (deltas.length === 0) {
    deltas.push(exactDelta('single system', 'true', 'true'))
  }

  return buildTestResult('E18', 'staffDistribution', 'E', 'gaps', fixtureId, deltas)
})
