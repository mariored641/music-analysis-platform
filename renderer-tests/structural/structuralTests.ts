/**
 * Structural Tests for MAP Native Renderer
 *
 * These tests operate on RenderedScore data structures (not pixels).
 * They verify musical readability: no collisions, proper spacing, correct geometry.
 *
 * Each test function returns a TestResult with pass/fail + violations.
 */

import type {
  RenderedScore, RenderedNote, RenderedMeasure,
  RenderedBeam, RenderedBarline, RenderedChordSymbol,
  DOMRectLike,
} from '../../src/renderer/types'
import type { TestResult, Violation } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rectsOverlap(a: DOMRectLike, b: DOMRectLike, tolerance = 0): boolean {
  return (
    a.left < b.right - tolerance &&
    a.right > b.left + tolerance &&
    a.top < b.bottom - tolerance &&
    a.bottom > b.top + tolerance
  )
}

function rectArea(r: DOMRectLike): number {
  return r.width * r.height
}

/** Get all notes (non-rest) across all measures in the score */
function getAllNotes(score: RenderedScore): RenderedNote[] {
  return score.allNotes.filter(n => !n.isRest && !n.isGrace)
}

/** Get all measures across all pages/systems */
function getAllMeasures(score: RenderedScore): RenderedMeasure[] {
  const measures: RenderedMeasure[] = []
  for (const page of score.pages) {
    for (const sys of page.systems) {
      measures.push(...sys.measures)
    }
  }
  return measures
}

/** Approximate notehead bbox from note center (when bbox not available) */
function noteheadBbox(n: RenderedNote, sp: number): DOMRectLike {
  const hw = 0.59 * sp   // NOTEHEAD_RX_SP
  const hh = 0.5 * sp    // half-height
  const x = n.x - hw
  const y = n.y - hh
  const w = hw * 2
  const h = hh * 2
  return { x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h }
}

/** Approximate accidental bbox */
function accidentalBbox(n: RenderedNote, sp: number): DOMRectLike | null {
  if (!n.accidental || n.accidentalX == null) return null
  const widths: Record<string, number> = {
    'sharp': 1.0, 'flat': 0.65, 'natural': 0.9,
    'double-sharp': 1.1, 'double-flat': 1.4,
    'courtesy-sharp': 1.0, 'courtesy-flat': 0.65, 'courtesy-natural': 0.9,
  }
  const w = (widths[n.accidental] ?? 1.0) * sp
  const h = 3.0 * sp  // approximate height
  const x = n.accidentalX
  const y = n.y - h / 2
  return { x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h }
}

// ─── Collision Tests ──────────────────────────────────────────────────────────

/**
 * Test: No overlapping noteheads within the same staff and measure.
 * Chord notes on the same beat are expected to be close but should not fully overlap
 * unless they're at the same pitch (unison).
 */
export function noNoteOverlaps(score: RenderedScore, sp: number): TestResult {
  const violations: Violation[] = []
  const measures = getAllMeasures(score)

  for (const m of measures) {
    const notes = m.notes.filter(n => !n.isRest && !n.isGrace)
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const a = notes[i], b = notes[j]
        // Skip notes at the same beat (chord members)
        if (Math.abs(a.beat - b.beat) < 0.01) continue
        // Check notehead overlap
        const bboxA = noteheadBbox(a, sp)
        const bboxB = noteheadBbox(b, sp)
        if (rectsOverlap(bboxA, bboxB, sp * 0.1)) {
          violations.push({
            testName: 'noNoteOverlaps',
            message: `Notes overlap: ${a.noteId} and ${b.noteId} in m.${m.measureNum}`,
            severity: 'error',
            location: { measureNum: m.measureNum, noteId: a.noteId, noteId2: b.noteId },
          })
        }
      }
    }
  }

  return {
    name: 'noNoteOverlaps',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? '0 collisions' : `${violations.length} collisions`,
  }
}

/**
 * Test: No overlapping accidentals (with each other or with noteheads of different beats).
 */
export function noAccidentalOverlaps(score: RenderedScore, sp: number): TestResult {
  const violations: Violation[] = []
  const measures = getAllMeasures(score)

  for (const m of measures) {
    const notes = m.notes.filter(n => !n.isRest && !n.isGrace)
    const accNotes = notes.filter(n => n.accidental && n.accidentalX != null)

    // Check accidental vs accidental
    for (let i = 0; i < accNotes.length; i++) {
      for (let j = i + 1; j < accNotes.length; j++) {
        const a = accNotes[i], b = accNotes[j]
        const bboxA = accidentalBbox(a, sp)
        const bboxB = accidentalBbox(b, sp)
        if (bboxA && bboxB && rectsOverlap(bboxA, bboxB, sp * 0.05)) {
          violations.push({
            testName: 'noAccidentalOverlaps',
            message: `Accidentals overlap: ${a.noteId} (${a.accidental}) and ${b.noteId} (${b.accidental}) in m.${m.measureNum}`,
            severity: 'error',
            location: { measureNum: m.measureNum, noteId: a.noteId, noteId2: b.noteId },
          })
        }
      }
    }

    // Check accidental vs notehead of different-beat notes
    for (const accNote of accNotes) {
      const accBox = accidentalBbox(accNote, sp)
      if (!accBox) continue
      for (const other of notes) {
        if (other.noteId === accNote.noteId) continue
        if (Math.abs(other.beat - accNote.beat) < 0.01) continue // same chord
        const headBox = noteheadBbox(other, sp)
        if (rectsOverlap(accBox, headBox, sp * 0.05)) {
          violations.push({
            testName: 'noAccidentalOverlaps',
            message: `Accidental of ${accNote.noteId} overlaps notehead of ${other.noteId} in m.${m.measureNum}`,
            severity: 'error',
            location: { measureNum: m.measureNum, noteId: accNote.noteId, noteId2: other.noteId },
          })
        }
      }
    }
  }

  return {
    name: 'noAccidentalOverlaps',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? '0 collisions' : `${violations.length} collisions`,
  }
}

/**
 * Test: Chord symbols don't overlap with each other.
 */
export function noChordSymbolOverlaps(score: RenderedScore, sp: number): TestResult {
  const violations: Violation[] = []
  const measures = getAllMeasures(score)

  // Collect all chord symbols with approximate bboxes
  const allChords: Array<{ cs: RenderedChordSymbol; bbox: DOMRectLike; mNum: number }> = []
  for (const m of measures) {
    for (const cs of m.chordSymbols) {
      // Approximate bbox: ~0.6sp per character width, 1.5sp height
      const charW = 0.6 * sp
      const w = cs.text.length * charW
      const h = 1.5 * sp
      const bbox: DOMRectLike = {
        x: cs.x, y: cs.y - h, width: w, height: h,
        top: cs.y - h, left: cs.x, right: cs.x + w, bottom: cs.y,
      }
      allChords.push({ cs, bbox, mNum: m.measureNum })
    }
  }

  for (let i = 0; i < allChords.length; i++) {
    for (let j = i + 1; j < allChords.length; j++) {
      const a = allChords[i], b = allChords[j]
      if (rectsOverlap(a.bbox, b.bbox, sp * 0.1)) {
        violations.push({
          testName: 'noChordSymbolOverlaps',
          message: `Chord symbols overlap: "${a.cs.text}" (m.${a.mNum}) and "${b.cs.text}" (m.${b.mNum})`,
          severity: 'warning',
          location: { measureNum: a.mNum },
        })
      }
    }
  }

  return {
    name: 'noChordSymbolOverlaps',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? '0 collisions' : `${violations.length} collisions`,
  }
}

/**
 * Test: Barlines don't overlap with adjacent notes.
 */
export function noBarlineNoteOverlaps(score: RenderedScore, sp: number): TestResult {
  const violations: Violation[] = []
  const measures = getAllMeasures(score)
  const minGap = sp * 0.3  // minimum gap between barline and nearest note

  for (const m of measures) {
    const notes = m.notes.filter(n => !n.isRest && !n.isGrace)
    for (const bar of m.barlines) {
      for (const n of notes) {
        const headBox = noteheadBbox(n, sp)
        const dist = Math.min(Math.abs(headBox.left - bar.x), Math.abs(headBox.right - bar.x))
        if (dist < minGap) {
          violations.push({
            testName: 'noBarlineNoteOverlaps',
            message: `Note ${n.noteId} too close to barline (${dist.toFixed(1)}px < ${minGap.toFixed(1)}px min) in m.${m.measureNum}`,
            severity: 'warning',
            location: { measureNum: m.measureNum, noteId: n.noteId },
            measured: dist,
            expected: `>= ${minGap.toFixed(1)}px`,
          })
        }
      }
    }
  }

  return {
    name: 'noBarlineNoteOverlaps',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? '0 issues' : `${violations.length} too-close notes`,
  }
}

// ─── Spacing Tests ────────────────────────────────────────────────────────────

/**
 * Test: Minimum horizontal spacing between consecutive noteheads.
 */
export function minimumNoteSpacing(score: RenderedScore, sp: number, minSp = 0.8): TestResult {
  const violations: Violation[] = []
  const measures = getAllMeasures(score)
  const minPx = minSp * sp

  for (const m of measures) {
    const notes = m.notes
      .filter(n => !n.isRest && !n.isGrace)
      .sort((a, b) => a.beat - b.beat || a.x - b.x)

    // Group by beat
    const beats = new Map<number, RenderedNote[]>()
    for (const n of notes) {
      const key = Math.round(n.beat * 100)
      if (!beats.has(key)) beats.set(key, [])
      beats.get(key)!.push(n)
    }

    const sortedBeats = [...beats.keys()].sort((a, b) => a - b)
    for (let i = 0; i < sortedBeats.length - 1; i++) {
      const currNotes = beats.get(sortedBeats[i])!
      const nextNotes = beats.get(sortedBeats[i + 1])!
      // Use rightmost x of current beat, leftmost x of next beat
      const currMaxX = Math.max(...currNotes.map(n => n.x))
      const nextMinX = Math.min(...nextNotes.map(n => n.x))
      const gap = nextMinX - currMaxX
      if (gap < minPx) {
        violations.push({
          testName: 'minimumNoteSpacing',
          message: `Notes too close in m.${m.measureNum}: beat ${(sortedBeats[i] / 100).toFixed(2)} → ${(sortedBeats[i + 1] / 100).toFixed(2)}, gap=${(gap / sp).toFixed(2)}sp (min ${minSp}sp)`,
          severity: gap < 0 ? 'error' : 'warning',
          location: { measureNum: m.measureNum },
          measured: gap / sp,
          expected: `>= ${minSp}sp`,
        })
      }
    }
  }

  return {
    name: 'minimumNoteSpacing',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? 'all gaps OK' : `${violations.length} violations`,
  }
}

/**
 * Test: Stem lengths are in a reasonable range.
 * MuseScore default: 3.5sp, range typically 2.5-4.5sp for non-beamed notes.
 */
export function stemLengthRange(
  score: RenderedScore, sp: number,
  minSp = 2.0, maxSp = 5.5,
): TestResult {
  const violations: Violation[] = []
  const measures = getAllMeasures(score)

  for (const m of measures) {
    const stemNotes = m.notes.filter(n => !n.isRest && !n.isGrace && n.hasStem && !n.beamGroupId)
    const allNotes = m.notes.filter(n => !n.isRest && !n.isGrace)

    // Identify chord groups (notes at the same beat sharing a stem)
    const beatGroups = new Map<number, typeof stemNotes>()
    for (const n of stemNotes) {
      const key = Math.round(n.beat * 100)
      if (!beatGroups.has(key)) beatGroups.set(key, [])
      beatGroups.get(key)!.push(n)
    }

    // Also collect ALL notes per beat for span calculation (chord members without hasStem)
    const allBeatNotes = new Map<number, typeof allNotes>()
    for (const n of allNotes) {
      const key = Math.round(n.beat * 100)
      if (!allBeatNotes.has(key)) allBeatNotes.set(key, [])
      allBeatNotes.get(key)!.push(n)
    }

    for (const [beatKey, group] of beatGroups.entries()) {
      // Use ALL notes at this beat for span calculation (not just stem-bearers)
      const chordNotes = allBeatNotes.get(beatKey) ?? group
      const ys = chordNotes.map(n => n.staffLine)
      const span = Math.max(...ys) - Math.min(...ys)
      let effectiveMax = span > 7 ? 8.5 : maxSp  // 7 staff-lines ~ 1 octave

      for (const n of group) {
        // Notes far from the staff center (staffLine 4) need longer stems
        // to reach the staff. Allow extra 0.5sp per staff-line beyond the staff.
        const distFromCenter = Math.abs(n.staffLine - 4)
        const noteEffMax = distFromCenter > 4
          ? effectiveMax + (distFromCenter - 4) * 0.5
          : effectiveMax

        const stemLen = Math.abs(n.stemYTop - n.stemYBottom) / sp
        if (stemLen < minSp || stemLen > noteEffMax) {
          violations.push({
            testName: 'stemLengthRange',
            message: `Stem ${stemLen.toFixed(2)}sp on ${n.noteId} in m.${m.measureNum} (range: ${minSp}-${noteEffMax.toFixed(1)}sp)`,
            severity: stemLen < minSp * 0.7 || stemLen > noteEffMax * 1.3 ? 'error' : 'warning',
            location: { measureNum: m.measureNum, noteId: n.noteId },
            measured: stemLen,
            expected: `${minSp}-${noteEffMax.toFixed(1)}sp`,
          })
        }
      }
    }
  }

  return {
    name: 'stemLengthRange',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? 'all stems OK' : `${violations.length} out-of-range`,
  }
}

/**
 * Test: Beam slopes are not too steep.
 * Max reasonable slope ~ 30 degrees for standard notation.
 */
export function beamAngleRange(score: RenderedScore, sp: number, maxDeg = 35): TestResult {
  const violations: Violation[] = []
  const measures = getAllMeasures(score)

  for (const m of measures) {
    for (const beam of m.beams) {
      if (beam.segments.length === 0 || beam.segments[0].length === 0) continue
      const seg = beam.segments[0][0]  // primary beam, first segment
      const dx = seg.x2 - seg.x1
      const dy = seg.y2 - seg.y1
      if (Math.abs(dx) < 1) continue  // degenerate
      const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI)
      if (angle > maxDeg) {
        violations.push({
          testName: 'beamAngleRange',
          message: `Beam too steep: ${angle.toFixed(1)}° (max ${maxDeg}°) in m.${m.measureNum}, beam ${beam.groupId}`,
          severity: 'warning',
          location: { measureNum: m.measureNum },
          measured: angle,
          expected: `<= ${maxDeg}°`,
        })
      }
    }
  }

  return {
    name: 'beamAngleRange',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? 'all beams OK' : `${violations.length} too steep`,
  }
}

/**
 * Test: Spacing evenness within each measure.
 * Computes coefficient of variation of note gaps within a measure.
 * High CV = uneven spacing = poor readability.
 */
export function evenSpacingScore(score: RenderedScore, sp: number, maxCV = 0.6): TestResult {
  const violations: Violation[] = []
  const measures = getAllMeasures(score)

  for (const m of measures) {
    const notes = m.notes
      .filter(n => !n.isRest && !n.isGrace)
      .sort((a, b) => a.x - b.x)

    if (notes.length < 3) continue  // need at least 3 notes for meaningful CV

    // Group by unique x positions (chords share x)
    const xs = [...new Set(notes.map(n => Math.round(n.x)))]
    if (xs.length < 3) continue

    xs.sort((a, b) => a - b)
    const gaps: number[] = []
    for (let i = 1; i < xs.length; i++) {
      gaps.push(xs[i] - xs[i - 1])
    }

    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length
    const stddev = Math.sqrt(variance)
    const cv = mean > 0 ? stddev / mean : 0

    if (cv > maxCV) {
      violations.push({
        testName: 'evenSpacingScore',
        message: `Uneven spacing in m.${m.measureNum}: CV=${cv.toFixed(2)} (max ${maxCV}), gaps=[${gaps.map(g => (g / sp).toFixed(1)).join(', ')}]sp`,
        severity: cv > maxCV * 1.5 ? 'error' : 'warning',
        location: { measureNum: m.measureNum },
        measured: cv,
        expected: `CV <= ${maxCV}`,
      })
    }
  }

  return {
    name: 'evenSpacingScore',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0
      ? 'spacing even'
      : `${violations.length} uneven measures`,
  }
}

// ─── Structural Integrity Tests ───────────────────────────────────────────────

/**
 * Test: Every non-rest note has a notehead (non-zero bbox).
 */
export function allNotesHaveHeads(score: RenderedScore, sp: number): TestResult {
  const violations: Violation[] = []
  const notes = getAllNotes(score)

  for (const n of notes) {
    if (n.bbox.width < sp * 0.3 || n.bbox.height < sp * 0.3) {
      violations.push({
        testName: 'allNotesHaveHeads',
        message: `Note ${n.noteId} has tiny bbox: ${n.bbox.width.toFixed(1)}x${n.bbox.height.toFixed(1)}px`,
        severity: 'error',
        location: { measureNum: n.measureNum, noteId: n.noteId },
      })
    }
  }

  return {
    name: 'allNotesHaveHeads',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? 'all notes have heads' : `${violations.length} missing/tiny`,
  }
}

/**
 * Test: Stems connect to noteheads.
 * The stem endpoint (top or bottom depending on direction) should be within
 * a reasonable distance of the notehead center.
 */
export function stemsConnectedToNotes(score: RenderedScore, sp: number): TestResult {
  const violations: Violation[] = []
  const notes = getAllNotes(score)

  for (const n of notes) {
    if (!n.hasStem) continue
    // Stem attaches to the RIGHT edge of notehead (stem-up) or LEFT edge (stem-down)
    // noteheadWidth ~ 1.18sp (2 * NOTEHEAD_RX_SP=0.59), so stem can be up to ~1.2sp from center
    const noteheadW = 0.59 * 2 * sp
    const xDist = Math.abs(n.stemX - n.x)
    if (xDist > noteheadW + sp * 0.3) {
      violations.push({
        testName: 'stemsConnectedToNotes',
        message: `Stem X too far from notehead center: ${n.noteId}, stemX=${n.stemX.toFixed(1)}, noteX=${n.x.toFixed(1)}, dist=${(xDist / sp).toFixed(2)}sp`,
        severity: 'error',
        location: { measureNum: n.measureNum, noteId: n.noteId },
        measured: xDist / sp,
        expected: `<= ${((noteheadW + sp * 0.3) / sp).toFixed(2)}sp`,
      })
    }

    // The stem near-note endpoint should be close to the notehead y
    const stemNearY = n.stemUp ? n.stemYBottom : n.stemYTop
    const yDist = Math.abs(stemNearY - n.y)
    if (yDist > sp * 1.0) {
      violations.push({
        testName: 'stemsConnectedToNotes',
        message: `Stem Y disconnected from notehead: ${n.noteId}, stemY=${stemNearY.toFixed(1)}, noteY=${n.y.toFixed(1)}, gap=${(yDist / sp).toFixed(2)}sp`,
        severity: 'error',
        location: { measureNum: n.measureNum, noteId: n.noteId },
        measured: yDist / sp,
        expected: '<= 1.0sp',
      })
    }
  }

  return {
    name: 'stemsConnectedToNotes',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? 'all stems connected' : `${violations.length} disconnected`,
  }
}

/**
 * Test: All notes in a beam group have the same stem direction.
 */
export function beamGroupConsistency(score: RenderedScore, _sp: number): TestResult {
  const violations: Violation[] = []
  const measures = getAllMeasures(score)

  for (const m of measures) {
    for (const beam of m.beams) {
      const beamNotes = m.notes.filter(n => n.beamGroupId === beam.groupId)
      if (beamNotes.length < 2) continue

      const dirs = new Set(beamNotes.map(n => n.stemUp))
      if (dirs.size > 1) {
        violations.push({
          testName: 'beamGroupConsistency',
          message: `Mixed stem directions in beam ${beam.groupId} (m.${m.measureNum}): ${beamNotes.map(n => `${n.noteId}=${n.stemUp ? 'up' : 'down'}`).join(', ')}`,
          severity: 'error',
          location: { measureNum: m.measureNum },
        })
      }
    }
  }

  return {
    name: 'beamGroupConsistency',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? 'all beams consistent' : `${violations.length} inconsistent`,
  }
}

/**
 * Test: Chord symbols are positioned above the staff, not inside or below.
 */
export function chordSymbolPlacement(score: RenderedScore, sp: number): TestResult {
  const violations: Violation[] = []

  for (const page of score.pages) {
    for (const sys of page.systems) {
      if (sys.staves.length === 0) continue
      const topStaff = sys.staves[0]
      const staffTop = topStaff.y

      for (const m of sys.measures) {
        for (const cs of m.chordSymbols) {
          // Chord symbol baseline should be above the staff top line
          // Allow a small tolerance (0.5sp) for symbols that sit right on the top line
          if (cs.y > staffTop + sp * 0.5) {
            violations.push({
              testName: 'chordSymbolPlacement',
              message: `Chord "${cs.text}" in m.${m.measureNum} below staff top (y=${cs.y.toFixed(1)}, staffTop=${staffTop.toFixed(1)})`,
              severity: 'warning',
              location: { measureNum: m.measureNum },
              measured: (cs.y - staffTop) / sp,
              expected: '<= 0.5sp below staff top',
            })
          }
        }
      }
    }
  }

  return {
    name: 'chordSymbolPlacement',
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0 ? 'all chords above staff' : `${violations.length} misplaced`,
  }
}

// ─── Run All Tests ────────────────────────────────────────────────────────────

/** All available structural tests */
export const ALL_TESTS = [
  // Collision tests
  noNoteOverlaps,
  noAccidentalOverlaps,
  noChordSymbolOverlaps,
  noBarlineNoteOverlaps,
  // Spacing tests
  minimumNoteSpacing,
  stemLengthRange,
  beamAngleRange,
  evenSpacingScore,
  // Structural integrity
  allNotesHaveHeads,
  stemsConnectedToNotes,
  beamGroupConsistency,
  chordSymbolPlacement,
]

export function runAllTests(score: RenderedScore, spatiumPx: number): TestResult[] {
  return ALL_TESTS.map(test => test(score, spatiumPx))
}
