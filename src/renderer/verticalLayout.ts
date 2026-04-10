/**
 * MAP Native Renderer — Stage 4: Vertical Layout Engine
 *
 * Computes vertical geometry for all notes and symbols:
 *   - System / staff y-positions (stacking from top margin)
 *   - Note staff-line numbers and y-coordinates (clef-offset formula, §4b)
 *   - Stem directions (voice-override + middle-line heuristic, §4c/4d)
 *   - Ledger lines (§4e)
 *   - Beam geometry — primary + secondary/tertiary segments (§4f)
 *   - Barline y-extents
 *   - Chord-symbol y-positions
 *   - Key / time signature / clef positions
 *   - Tie arcs (simple bezier, no cross-system for now)
 *
 * Input:  ExtractedScore + HorizontalLayout
 * Output: RenderedScore  (all coordinates in SVG pixels)
 */

import type {
  ExtractedScore,
  ExtractedMeasure,
  ExtractedNote,
} from './extractorTypes'
import {
  layoutAccidentals,
  accidentalXForColumn,
  maxAccWidthSp,
  type ChordNote,
} from './chordLayout'
import type { HorizontalLayout, HLayoutMeasure } from './horizontalLayout'
import {
  DEFAULT_RENDER_OPTIONS,
  CLEF_LEFT_MARGIN_SP,
  CLEF_GLYPH_WIDTH_SP,
  CLEF_KEY_DIST_SP,
  CLEF_TIMESIG_DIST_SP,
  KEY_ACC_STRIDE_SP,
  KEY_SHARP_STRIDE_SP, KEY_FLAT_STRIDE_SP,
  keySigWidthSp as keySigWidthSpLocal,
  KEY_TIMESIG_DIST_SP,
  TIMESIG_GLYPH_WIDTH_SP,
  BAR_NOTE_DIST_SP,
} from './horizontalLayout'
import type {
  RenderedScore,
  RenderedPage,
  RenderedSystem,
  RenderedStaff,
  RenderedMeasure,
  RenderedNote,
  RenderedBeam,
  BeamSegment,
  RenderedBarline,
  RenderedChordSymbol,
  RenderedTie,
  RenderedTuplet,
  RenderedLedgerLine,
  RenderedKeySignature,
  RenderedTimeSignature,
  RenderedClefSymbol,
  DOMRectLike,
  ClefType,
  NoteheadType,
  AccidentalType,
  RenderOptions,
} from './types'
import { Skyline } from './engine/libmscore/Skyline'
import { Shape } from './engine/libmscore/Shape'

// ─── Pitch → staff-line constants ────────────────────────────────────────────

const STEP_TO_DIATONIC: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
}

/**
 * Clef anchor offsets (RENDERER_ALGORITHMS.md §21 / NATIVE_RENDERER_PLAN.md §4b).
 * staffLine = clefOffset − (diatonicStep + octave × 7)
 * Line 0 = top staff line, increases downward.
 * Lines 0,2,4,6,8 are the 5 staff lines; odd = spaces.
 */
const CLEF_OFFSET: Record<string, number> = {
  treble:     38,   // F5=0, E4=8, middle C (C4)=10 (ledger below)
  bass:       26,   // A3=0, G2=8, middle C (C4)=-2 (ledger above)
  alto:       32,   // G4=0 … (C4=4 = middle line)
  tenor:      30,
  percussion: 38,
}

function pitchToStaffLine(step: string, octave: number, clef: ClefType): number {
  const diatonic = STEP_TO_DIATONIC[step] ?? 0
  return (CLEF_OFFSET[clef] ?? 38) - (diatonic + octave * 7)
}

// ─── Key-signature accidental staff-line positions ───────────────────────────

// Treble: sharps on F5(0), C5(3), G5(-1), D5(2), A4(5), E5(1), B4(4)
const TREBLE_SHARP_LINES = [0, 3, -1, 2, 5, 1, 4]
// Treble: flats on B4(4), E5(1), A4(5), D5(2), G5(-1)... wait actually:
// Flats in treble: Bb4(4), Eb5(1), Ab4(5), Db5(2), Gb4(6), Cb5(3), Fb4(7)
const TREBLE_FLAT_LINES  = [4, 1, 5, 2, 6, 3, 7]
// Bass clef:
const BASS_SHARP_LINES   = [2, 5,  1, 4, 7, 3, 6]
const BASS_FLAT_LINES    = [6, 3, 7, 4, 8, 5, 9]

function getKeySigLines(fifths: number, clef: ClefType): number[] {
  if (fifths === 0) return []
  const count = Math.abs(fifths)
  const isSharp = fifths > 0
  if (clef === 'bass') {
    return (isSharp ? BASS_SHARP_LINES : BASS_FLAT_LINES).slice(0, count)
  }
  return (isSharp ? TREBLE_SHARP_LINES : TREBLE_FLAT_LINES).slice(0, count)
}

// ─── Accidental width by type (× sp) ─────────────────────────────────────────

const ACCIDENTAL_WIDTH_SP: Record<string, number> = {
  'sharp':           1.0,
  'flat':            1.2,
  'natural':         0.9,
  'double-sharp':    1.1,
  'double-flat':     1.4,
  'courtesy-sharp':  1.4,
  'courtesy-flat':   1.6,
  'courtesy-natural':1.3,
}

// ─── Notehead type from MusicXML duration type ───────────────────────────────

function noteheadFromType(type: string): NoteheadType {
  if (type === 'whole')  return 'whole'
  if (type === 'half')   return 'half'
  return 'quarter'  // covers eighth, 16th, 32nd, 64th
}

// ─── Chord grouping: fix stem direction & span for multi-note chords ─────────
// C++ chord.cpp:1119-1136 — computeAutoStemDirection (pair-wise outer→inner)

function computeAutoStemDirection(staffLines: number[]): boolean {
  // Returns true for stem-up.
  // staffLines: 0 = top line, 4 = middle, 8 = bottom.
  // Distance from middle: staffLine - 4 (positive = below = stem up).
  const distances = staffLines.map(sl => sl - 4) // >0 means below middle
  // Sort distances by absolute value descending (outermost first)
  // But C++ uses left/right pointers on sorted-by-pitch array.
  // Notes are sorted by staffLine ascending (highest pitch first = lowest staffLine).
  distances.sort((a, b) => a - b) // ascending: most negative (highest) first
  let left = 0
  let right = distances.length - 1
  while (left <= right) {
    const net = distances[left] + distances[right]
    if (net === 0) { left++; right--; continue }
    // net > 0 means lower notes dominate → stem up
    return net > 0
  }
  return true // symmetric → default up
}

function fixChordGrouping(
  noteList: RenderedNote[],
  extNotes: ExtractedNote[],
  stemLength: number,
  noteheadRy: number,
  noteheadWidth: number,
  sp: number,
): void {
  // Group notes by beat+voice (chord members share the same beat)
  const groups = new Map<string, number[]>() // key → indices in noteList
  for (let i = 0; i < noteList.length; i++) {
    const rn = noteList[i]
    if (rn.isRest) continue
    const key = `${rn.beat.toFixed(4)}_v${rn.voice}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(i)
  }

  for (const indices of groups.values()) {
    if (indices.length <= 1) continue // single note, no chord grouping needed

    // Determine shared stem direction (C++ computeAutoStemDirection)
    const staffLines = indices.map(i => noteList[i].staffLine)
    const stemUp = computeAutoStemDirection(staffLines)

    // Find outermost notes
    const sortedByLine = [...indices].sort((a, b) => noteList[a].staffLine - noteList[b].staffLine)
    const topIdx = sortedByLine[0]           // highest pitch (lowest staffLine)
    const bottomIdx = sortedByLine[sortedByLine.length - 1] // lowest pitch

    const topNote = noteList[topIdx]
    const bottomNote = noteList[bottomIdx]

    // Stem x position (same for all chord members)
    const stemLWCorr = (0.10 / 2) * sp
    const stemX = stemUp
      ? bottomNote.x + noteheadWidth - stemLWCorr  // up: stem on right of lowest note
      : topNote.x + stemLWCorr                     // down: stem on left of highest note

    // Stem y span: from the note opposite the stem direction to beyond the other side
    // C++ chord.cpp: stem starts at the note opposite the stem tip
    // chordHeight (in quarter-spaces) + default stem length
    const chordHeightQS = (bottomNote.staffLine - topNote.staffLine) * 2
    const finalStemLen = (chordHeightQS / 4.0 * sp) + stemLength

    let stemYTop: number, stemYBot: number
    if (stemUp) {
      // Stem goes up from bottomNote
      stemYBot = bottomNote.y + noteheadRy
      stemYTop = bottomNote.y + noteheadRy - finalStemLen
    } else {
      // Stem goes down from topNote
      stemYTop = topNote.y - noteheadRy
      stemYBot = topNote.y - noteheadRy + finalStemLen
    }

    // Apply to all chord members — only ONE renders the shared stem
    const stemOwnerIdx = stemUp ? bottomIdx : topIdx // stem attaches to opposite-side note
    for (const idx of indices) {
      const rn = noteList[idx]
      rn.stemUp = stemUp
      rn.stemX = stemX
      rn.stemYTop = stemYTop
      rn.stemYBottom = stemYBot
      // Only one note in the chord renders the stem line
      if (idx !== stemOwnerIdx) rn.hasStem = false
    }

    // Handle 2nd intervals (notehead flip) — simplified version
    // Sort notes by staffLine for cluster detection
    for (let j = 0; j < sortedByLine.length - 1; j++) {
      const a = noteList[sortedByLine[j]]
      const b = noteList[sortedByLine[j + 1]]
      const interval = b.staffLine - a.staffLine
      if (interval <= 1) {
        // Adjacent notes (unison or 2nd) — flip one notehead to the other side of stem
        if (stemUp) {
          // Up-stem: flip the HIGHER note (a) to the RIGHT of the stem
          a.x = a.x + noteheadWidth
        } else {
          // Down-stem: flip the LOWER note (b) to the LEFT of the stem
          b.x = b.x - noteheadWidth
        }
      }
    }

    // Accidental stacking for chord members (layoutChords3)
    const chordNotes: ChordNote[] = indices.map(i => ({
      staffLine: noteList[i].staffLine,
      noteX: noteList[i].x,
      stemUp: noteList[i].stemUp,
      accidental: noteList[i].accidental,
    }))
    const hasAccidentals = chordNotes.some(cn => !!cn.accidental)
    if (hasAccidentals) {
      const slots = layoutAccidentals(chordNotes)
      if (slots.length > 0) {
        const accTypes = slots.map(s => s.accType)
        const maxW = maxAccWidthSp(accTypes)
        for (const slot of slots) {
          const rn = noteList[indices[slot.noteIndex]]
          rn.accidentalX = accidentalXForColumn(rn.x, slot.column, slot.accType, maxW, sp)
        }
      }
    }
  }
}

// ─── AccidentalType from AccidentalSign ──────────────────────────────────────

function accidentalTypeFrom(sign: string): AccidentalType {
  const map: Record<string, AccidentalType> = {
    'sharp':        'sharp',
    'flat':         'flat',
    'natural':      'natural',
    'double-sharp': 'double-sharp',
    'double-flat':  'double-flat',
  }
  return map[sign] ?? 'natural'
}

// ─── Beam-group ID assignment ─────────────────────────────────────────────────

/**
 * Returns a map from noteId → beamGroupId for all notes in a measure.
 * Works on notes already sorted by beat order.
 */
function assignBeamGroupIds(notes: ExtractedNote[]): Map<string, string> {
  const map = new Map<string, string>()
  let currentGroupId: string | null = null

  for (const note of notes) {
    if (note.isRest || note.isGrace || !note.beamStates?.length) continue
    const primary = note.beamStates.find(b => b.level === 1)
    if (!primary) continue

    if (primary.value === 'begin') {
      currentGroupId = `beam-m${note.measureNum}b${Math.round(note.beat * 100)}`
    }
    if (currentGroupId) map.set(note.id, currentGroupId)
    if (primary.value === 'end') currentGroupId = null
  }

  return map
}

// ─── Ledger lines ─────────────────────────────────────────────────────────────

function computeLedgerLines(
  staffLine: number,
  noteX: number,
  noteheadWidth: number,
  halfSp: number,
  staffTop: number,
): RenderedLedgerLine[] {
  const lines: RenderedLedgerLine[] = []
  const ledgerPad = 0.33 * halfSp * 2  // Sid::ledgerLineLength = 0.33sp (chord.cpp:851)
  // noteX = left edge; chord.cpp:912: x = note->pos().x() + bboxXShift (≈left edge)
  // chord.cpp:913: minX = x - extraLen; chord.cpp:923: maxX = x + hw + extraLen
  const x1 = noteX - ledgerPad
  const x2 = noteX + noteheadWidth + ledgerPad

  if (staffLine < 0) {
    // Above staff: need ledger lines at 0, -2, -4, ... down to nearest even ≤ staffLine
    const top = Math.floor(staffLine / 2) * 2   // e.g. staffLine=-3 → top=-4
    for (let sl = 0; sl >= top && sl > staffLine - 1; sl -= 2) {
      // sl is -2, -4, ... but we actually need lines down from 0 going up:
      // ledger lines are at even staffLines BELOW 0 going negative
      // We need ledger lines at -2, -4 up to the note
    }
    // Corrected: ledger lines at staffLine = -2, -4, ... going up, stopping at note's sl
    // Note is at staffLine (negative). Need lines at all even sl from -2 down to ceil(staffLine/2)*2
    const lowestNeeded = (staffLine % 2 === 0) ? staffLine : staffLine + 1
    for (let sl = -2; sl >= lowestNeeded; sl -= 2) {
      lines.push({ y: staffTop + sl * halfSp, x1, x2 })
    }
  } else if (staffLine > 8) {
    // Below staff: ledger lines at 10, 12, ... up to note's staffLine
    const highestNeeded = (staffLine % 2 === 0) ? staffLine : staffLine - 1
    for (let sl = 10; sl <= highestNeeded; sl += 2) {
      lines.push({ y: staffTop + sl * halfSp, x1, x2 })
    }
  }

  return lines
}

// ─── Beam geometry ────────────────────────────────────────────────────────────

function buildBeams(
  renderedNotes: RenderedNote[],
  extNotes: ExtractedNote[],
  beamThickness: number,
  beamGap: number,
  sp: number,
): RenderedBeam[] {
  // Index rendered notes by noteId
  const rNoteMap = new Map<string, RenderedNote>()
  for (const n of renderedNotes) rNoteMap.set(n.noteId, n)

  // Index extracted notes by noteId
  const eNoteMap = new Map<string, ExtractedNote>()
  for (const n of extNotes) eNoteMap.set(n.id, n)

  // Group rendered notes by beam group
  const groups = new Map<string, RenderedNote[]>()
  for (const n of renderedNotes) {
    if (!n.beamGroupId) continue
    if (!groups.has(n.beamGroupId)) groups.set(n.beamGroupId, [])
    groups.get(n.beamGroupId)!.push(n)
  }

  const beams: RenderedBeam[] = []

  for (const [groupId, gNotes] of groups) {
    if (gNotes.length < 2) continue
    gNotes.sort((a, b) => a.x - b.x)

    // Determine group stem direction by average staff-line position.
    // avgStaffLine >= 4 means the group is at/below the middle line → stems up.
    const avgStaffLine = gNotes.reduce((sum, n) => sum + n.staffLine, 0) / gNotes.length
    const stemUp = avgStaffLine >= 4

    // Normalize every note in the group to the group's stem direction.
    // Notes whose individual stemUp disagrees would produce stems that pass
    // through the notehead ("double legs") — fix stemX and the non-beam endpoint.
    for (const rn of gNotes) {
      if (rn.stemUp !== stemUp) {
        const rx = Math.abs(rn.stemX - rn.x)
        rn.stemX = stemUp ? rn.x + rx : rn.x - rx
        if (stemUp) {
          // Was down-stem: stemYTop = y, stemYBottom = y + stemLen
          rn.stemYTop    = 2 * rn.y - rn.stemYBottom  // → y - stemLen
          rn.stemYBottom = rn.y
        } else {
          // Was up-stem: stemYTop = y - stemLen, stemYBottom = y
          rn.stemYBottom = 2 * rn.y - rn.stemYTop     // → y + stemLen
          rn.stemYTop    = rn.y
        }
        rn.stemUp = stemUp
      }
    }

    const first  = gNotes[0]
    const last   = gNotes[gNotes.length - 1]

    // Stem tips
    const y1raw = stemUp ? first.stemYTop  : first.stemYBottom
    const y2raw = stemUp ? last.stemYTop   : last.stemYBottom
    const dx    = last.x - first.x || 1

    // MuseScore beam anchor: beam center = stemTip offset by beamWidth/2 toward notehead
    // beam.cpp:724: anchorY = noteY + stemLength*upValue - beamWidth/2*upValue
    //   up-stem (upValue=-1): anchorY = stemTip + beamWidth/2
    //   down-stem (upValue=+1): anchorY = stemTip - beamWidth/2
    const bw2      = beamThickness / 2  // 0.25sp
    const y1anchor = y1raw + (stemUp ?  bw2 : -bw2)
    const y2anchor = y2raw + (stemUp ?  bw2 : -bw2)

    // MuseScore slope algorithm — beam.cpp computeDesiredSlant() + getMaxSlope()
    // _maxSlopes = {0,1,2,3,4,5,6,7}: max QS (sp/4) per half-space interval — beam.h
    const startLine   = first.staffLine
    const endLine     = last.staffLine
    const interval    = Math.abs(startLine - endLine)
    const beamWidthSp = dx / sp
    const maxSlopeFromWidth = (   // beam.cpp getMaxSlope()
      beamWidthSp < 3.0  ? 1 :
      beamWidthSp < 5.0  ? 2 :
      beamWidthSp < 7.5  ? 3 :
      beamWidthSp < 10.0 ? 4 :
      beamWidthSp < 15.0 ? 5 :
      beamWidthSp < 20.0 ? 6 : 7
    )

    // isSlopeConstrained: any middle note more extreme than both endpoints → flat
    // beam.cpp:540 isSlopeConstrained()
    let forceFlat = (interval === 0)
    if (!forceFlat && gNotes.length > 2) {
      const midNotes = gNotes.slice(1, -1)
      if (stemUp) {
        const higherEnd = Math.min(startLine, endLine)
        if (midNotes.some(n => n.staffLine < higherEnd)) forceFlat = true
      } else {
        const lowerEnd = Math.max(startLine, endLine)
        if (midNotes.some(n => n.staffLine > lowerEnd)) forceFlat = true
      }
    }

    let y1: number, y2: number
    if (forceFlat) {
      // Flat beam: more extreme anchor dictates both ends
      // beam.cpp:1532: dictator = min(pointer, dictator) for up-stem
      const flatY = stemUp ? Math.min(y1anchor, y2anchor) : Math.max(y1anchor, y2anchor)
      y1 = flatY
      y2 = flatY
    } else {
      const BEAM_MAX_SLOPES = [0, 1, 2, 3, 4, 5, 6, 7] as const
      const slopeQS = Math.min(maxSlopeFromWidth, BEAM_MAX_SLOPES[Math.min(interval, 7)])
      const rise    = slopeQS * sp / 4  // QS → pixels, always positive

      // Dictator = note most extreme in stem direction (determines beam Y)
      // Up-stem: smaller staffLine = higher on staff = dictator; down-stem: larger staffLine
      const startIsDictator = stemUp ? (startLine <= endLine) : (startLine >= endLine)
      if (startIsDictator) {
        y1 = y1anchor
        y2 = y1anchor + (stemUp ? rise : -rise)
      } else {
        y2 = y2anchor
        y1 = y2anchor + (stemUp ? rise : -rise)
      }
    }

    // beamY(x) = linear interpolation from y1 (first.x) to y2 (last.x)
    const beamY = (x: number) => y1 + (y2 - y1) * (x - first.x) / dx

    // Primary beam: level 1 — connects all notes
    const allSegments: BeamSegment[][] = [[
      { x1: first.stemX, y1: beamY(first.stemX), x2: last.stemX, y2: beamY(last.stemX) },
    ]]

    // Secondary / tertiary beams
    const maxLevels = getMaxBeamLevel(gNotes, eNoteMap)
    for (let level = 2; level <= maxLevels; level++) {
      const levelOffset = (level - 1) * (beamThickness + beamGap)
      const dir = stemUp ? 1 : -1  // inward toward noteheads
      const segs = buildSubBeams(gNotes, eNoteMap, level, beamY, levelOffset * dir, sp)
      if (segs.length) allSegments.push(segs)
    }

    // ── Minimum stem length enforcement ──────────────────────────
    // C++ beam.cpp:1192 — minStemLengths[] = {11,13,15,18,21,24,27,30} in quarter-spaces
    // Indexed by beam count - 1. Shift entire beam away if any note too close.
    const MIN_STEM_QS = [11, 13, 15, 18, 21, 24, 27, 30]
    const minStemPx = (MIN_STEM_QS[Math.min(maxLevels, 8) - 1] ?? 11) * sp / 4

    let beamShift = 0
    for (const rn of gNotes) {
      const beamAtNote = beamY(rn.stemX)
      const noteEdge = stemUp ? (rn.y + (sp * 0.168)) : (rn.y - (sp * 0.168)) // noteheadRy
      const currentStem = Math.abs(beamAtNote - noteEdge)
      if (currentStem < minStemPx) {
        const deficit = minStemPx - currentStem
        beamShift = Math.max(beamShift, deficit)
      }
    }

    if (beamShift > 0) {
      const dir = stemUp ? -1 : 1 // shift beam away from noteheads
      y1 += dir * beamShift
      y2 += dir * beamShift
    }

    // Recompute beamY after shift
    const beamYFinal = (x: number) => y1 + (y2 - y1) * (x - first.x) / dx

    // Recompute segments with adjusted beam position
    allSegments[0] = [
      { x1: first.stemX, y1: beamYFinal(first.stemX), x2: last.stemX, y2: beamYFinal(last.stemX) },
    ]
    for (let level = 2; level <= maxLevels; level++) {
      const levelOffset = (level - 1) * (beamThickness + beamGap)
      const dir = stemUp ? 1 : -1
      allSegments[level - 1] = buildSubBeams(gNotes, eNoteMap, level, beamYFinal, levelOffset * dir, sp)
    }

    // Adjust stem tips for all beamed notes to sit on the primary beam
    for (const rn of gNotes) {
      const beamMid = beamYFinal(rn.stemX)
      if (stemUp) {
        rn.stemYTop = beamMid
      } else {
        rn.stemYBottom = beamMid
      }
    }

    beams.push({
      groupId,
      noteIds: gNotes.map(n => n.noteId),
      stemUp,
      levels: maxLevels,
      segments: allSegments,
    })
  }

  return beams
}

function getMaxBeamLevel(
  gNotes: RenderedNote[],
  eNoteMap: Map<string, ExtractedNote>,
): number {
  let max = 1
  for (const n of gNotes) {
    const en = eNoteMap.get(n.noteId)
    if (!en?.beamStates) continue
    for (const bs of en.beamStates) {
      if (bs.level > max) max = bs.level
    }
  }
  return max
}

function buildSubBeams(
  gNotes: RenderedNote[],
  eNoteMap: Map<string, ExtractedNote>,
  level: number,
  beamY: (x: number) => number,
  extraOffset: number,  // positive = downward for stemUp
  sp: number,
): BeamSegment[] {
  const segs: BeamSegment[] = []
  let subStart: RenderedNote | null = null

  const beamYLevel = (x: number) => beamY(x) + extraOffset

  for (const rn of gNotes) {
    const en = eNoteMap.get(rn.noteId)
    const bs = en?.beamStates?.find(b => b.level === level)

    if (!bs) {
      if (subStart) {
        // Close unclosed sub-group
        segs.push({
          x1: subStart.stemX, y1: beamYLevel(subStart.stemX),
          x2: rn.stemX,       y2: beamYLevel(rn.stemX),
        })
      }
      subStart = null
      continue
    }

    if (bs.value === 'forward hook') {
      const hookW = sp * 1.1  // Sid::beamMinLen = 1.1sp (beam.cpp:949, styledef.cpp:211)
      segs.push({ x1: rn.stemX, y1: beamYLevel(rn.stemX), x2: rn.stemX + hookW, y2: beamYLevel(rn.stemX + hookW) })
      continue
    }
    if (bs.value === 'backward hook') {
      const hookW = sp * 1.1  // Sid::beamMinLen = 1.1sp (beam.cpp:949, styledef.cpp:211)
      segs.push({ x1: rn.stemX - hookW, y1: beamYLevel(rn.stemX - hookW), x2: rn.stemX, y2: beamYLevel(rn.stemX) })
      continue
    }
    if (bs.value === 'begin') {
      subStart = rn
    } else if (bs.value === 'continue' && subStart) {
      // just extend
    } else if (bs.value === 'end') {
      const start = subStart ?? rn
      segs.push({
        x1: start.stemX, y1: beamYLevel(start.stemX),
        x2: rn.stemX,    y2: beamYLevel(rn.stemX),
      })
      subStart = null
    }
  }

  return segs
}

// ─── Tie arc helper ──────────────────────────────────────────────────────────

function makeTieArc(
  ax: number, ay: number,
  bx: number, by: number,
  above: boolean,
  noteheadWidth: number,
  noteheadRy: number,
  sp: number,
): import('./types').BezierArc {
  const tieGap = sp * 0.1                        // gap from notehead edge to arc endpoint
  // noteX = left edge; tie starts from right edge of note A, ends at left edge of note B
  const x1 = ax + noteheadWidth + tieGap
  const x2 = bx - tieGap
  // C++ tie.cpp:975 — noteHeadOffset = 0.185sp from notehead top/bottom
  const yOff = above ? -(sp * 0.185) : (sp * 0.185)
  const y1 = ay + yOff
  const y2 = by + yOff
  // C++ tie.cpp:299-302 — shoulderH = tieWidthInSp * 0.4 * 0.38, clamped [0.4sp, 1.3sp]
  const tieWidthInSp = Math.max(x2 - x1, sp) / sp
  const h      = Math.min(sp * 1.3, Math.max(sp * 0.4, tieWidthInSp * 0.4 * 0.38 * sp))
  const arcH   = above ? -h : h
  // C++ tie.cpp:306-307 — shoulderW = 0.6 → control points at 20% and 80% of width
  const w = x2 - x1
  const cx1off = (w - w * 0.6) * 0.5   // C++: bezier1X = (c - c * shoulderW) * .5
  return { x1, y1, cx1: x1 + cx1off, cy1: y1 + arcH, cx2: x2 - cx1off, cy2: y2 + arcH, x2, y2 }
}

// ─── Ties (in-measure bezier arcs) ───────────────────────────────────────────

function buildTies(
  renderedNotes: RenderedNote[],
  noteheadWidth: number,
  noteheadRy: number,
  sp: number,
): RenderedTie[] {
  const ties: RenderedTie[] = []

  for (let i = 0; i < renderedNotes.length; i++) {
    const a = renderedNotes[i]
    if (!a.tieStart) continue

    // Find the next note with tieEnd that has the same pitch (staffLine)
    for (let j = i + 1; j < renderedNotes.length; j++) {
      const b = renderedNotes[j]
      if (b.tieEnd && b.staffLine === a.staffLine) {
        const above = !a.stemUp
        ties.push({
          fromNoteId:  a.noteId,
          toNoteId:    b.noteId,
          above,
          crossSystem: false,
          path: makeTieArc(a.x, a.y, b.x, b.y, above, noteheadWidth, noteheadRy, sp),
        })
        break
      }
    }
  }

  return ties
}

// ─── Cross-barline ties ───────────────────────────────────────────────────────

function buildCrossBarlineTies(
  curr: RenderedMeasure,
  next: RenderedMeasure,
  noteheadWidth: number,
  noteheadRy: number,
  sp: number,
): RenderedTie[] {
  const result: RenderedTie[] = []
  // IDs already resolved in-measure
  const alreadyTied = new Set(curr.ties.map(t => t.fromNoteId))

  for (const a of curr.notes) {
    if (!a.tieStart || alreadyTied.has(a.noteId)) continue
    // Match: first note in next measure with tieEnd at same staffLine
    const b = next.notes.find(n => n.tieEnd && n.staffLine === a.staffLine)
    if (!b) continue

    const above = !a.stemUp
    const crossSystem = curr.systemIndex !== next.systemIndex

    if (crossSystem) {
      // Split into two half-arcs: one trailing off the right of system 1,
      // one starting from the left of system 2.
      const rightEdge = curr.x + curr.width  // right edge of current measure
      const leftEdge  = next.x               // left edge of next measure
      const halfArc1 = makeTieArc(a.x, a.y, rightEdge, a.y, above, noteheadWidth, noteheadRy, sp)
      const halfArc2 = makeTieArc(leftEdge - noteheadWidth, b.y, b.x, b.y, above, noteheadWidth, noteheadRy, sp)
      result.push({
        fromNoteId:  a.noteId,
        toNoteId:    b.noteId,
        above,
        crossSystem,
        path: halfArc1,  // fallback: first half-arc
        halfArcs: [halfArc1, halfArc2],
      })
    } else {
      result.push({
        fromNoteId:  a.noteId,
        toNoteId:    b.noteId,
        above,
        crossSystem,
        path: makeTieArc(a.x, a.y, b.x, b.y, above, noteheadWidth, noteheadRy, sp),
      })
    }
  }

  return result
}

// ─── Barlines ─────────────────────────────────────────────────────────────────

function buildBarlines(
  extMeasure: ExtractedMeasure,
  hMeasure: HLayoutMeasure,
  staffTop: number,
  staffHeight: number,
  isLastMeasure: boolean,
  nextHasLeftBarline: boolean = false,
): RenderedBarline[] {
  const barlines: RenderedBarline[] = []
  const yTop    = staffTop
  const yBottom = staffTop + staffHeight

  // Left barline (start of measure) — only when explicitly set in MusicXML.
  // Do NOT draw a default 'regular' left barline: MuseScore draws the opening barline
  // only for special types (repeat-start, etc.). Normal measure left edges have no barline glyph.
  // C++: measure.cpp — barlineLeft is only set when <barline location="left"> is present.
  if (extMeasure.barlineLeft) {
    const leftStyle = extMeasure.barlineLeft.style
    if (leftStyle !== 'none') {
      barlines.push({ x: hMeasure.x, yTop, yBottom, type: leftStyle as RenderedBarline['type'] })
    }
  }

  // Right barline (end of measure).
  // C++: when the next measure has an explicit left barline (e.g. repeat-start), MuseScore
  // suppresses the current measure's right barline — only the stronger one is drawn.
  if (!nextHasLeftBarline) {
    const rightStyle = extMeasure.barlineRight?.style ?? 'regular'
    const rightX = hMeasure.x + hMeasure.width
    const effectiveRight = (isLastMeasure && rightStyle === 'regular') ? 'final' : rightStyle
    barlines.push({ x: rightX, yTop, yBottom, type: effectiveRight as RenderedBarline['type'] })
  }

  return barlines
}

// ─── Key signature layout ─────────────────────────────────────────────────────

function buildKeySignature(
  fifths: number,
  clef: ClefType,
  x: number,
  staffTop: number,
  halfSp: number,
  prevFifths: number = 0,
): RenderedKeySignature {
  const sp = halfSp * 2
  const KEY_NATURAL_STRIDE_SP = 0.956   // natural width 0.556 + keysigNaturalDistance 0.4
  const CROSS_TYPE_GAP_SP     = 0.6     // doubled gap when switching natural→sharp/flat
  const accs: Array<{ x: number; y: number; type: 'sharp' | 'flat' | 'natural' }> = []
  let xOff = 0

  // Cancellation naturals (only for inline key changes, not system header)
  if (prevFifths !== 0) {
    const cancels = prevFifths > 0
      ? Math.max(0, prevFifths - Math.max(0, fifths))
      : Math.max(0, -prevFifths - Math.max(0, -fifths))
    if (cancels > 0) {
      const oldLines = getKeySigLines(prevFifths, clef)
      // Cancellation naturals shown in reverse order (removing last-added accidentals first)
      for (let i = 0; i < cancels; i++) {
        const sl = oldLines[Math.abs(prevFifths) - 1 - i]
        accs.push({ x: x + xOff, y: staffTop + sl * halfSp, type: 'natural' })
        // Last natural: use cross-type gap if followed by new sharps/flats, else natural stride
        // C++: addLayout() x = prevXPos + prevWidth + gap
        //   natural→sharp/flat: stride = naturalWidth(0.556sp) + crossTypeGap(0.6sp) = 1.156sp
        //   natural→natural:    stride = naturalWidth(0.556sp) + keysigNaturalDist(0.4sp) = 0.956sp
        const KEY_NATURAL_WIDTH_SP = 0.556
        const isLastNatural = i === cancels - 1
        const stride = (isLastNatural && Math.abs(fifths) > 0)
          ? (KEY_NATURAL_WIDTH_SP + CROSS_TYPE_GAP_SP) * sp    // naturalWidth + 0.6sp gap
          : KEY_NATURAL_STRIDE_SP * sp
        xOff += stride
      }
    }
  }

  // New key accidentals
  const lines = getKeySigLines(fifths, clef)
  const accType = fifths > 0 ? 'sharp' : 'flat'
  const newStride = (fifths > 0 ? KEY_SHARP_STRIDE_SP : KEY_FLAT_STRIDE_SP) * sp
  for (const sl of lines) {
    accs.push({ x: x + xOff, y: staffTop + sl * halfSp, type: accType as 'sharp' | 'flat' })
    xOff += newStride
  }

  return { fifths, x, staffIndex: 0, accidentals: accs }
}

// ─── Helper: DOMRectLike ──────────────────────────────────────────────────────

function makeDOMRect(x: number, y: number, width: number, height: number): DOMRectLike {
  return { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export function computeVerticalLayout(
  score: ExtractedScore,
  hLayout: HorizontalLayout,
  renderOptions?: RenderOptions,
): RenderedScore {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...renderOptions }
  const sp          = opts.spatium       // 10 px
  const lineSpacing = sp                 // distance between adjacent staff lines
  const halfSp      = lineSpacing / 2   // 5 px — one diatonic step

  const staffHeight   = 4 * lineSpacing   // 40 px
  // Leland font metadata (fonts/leland/leland_metadata.json):
  //   noteheadBlack.cutOutNE   = [1.184, 0.42]     (bbox right ≈ 1.18sp, same as Bravura)
  //   noteheadBlack.stemUpSE   = [1.3,   +0.16]    (stem attach x; +Y = up in SMuFL)
  //   noteheadBlack.stemDownNW = [0,     -0.168]    (stem attach x=0; -Y = down in SMuFL)
  // chord.cpp:stemPosX: up=noteHeadWidth()=symWidth(bbox.width), down=0.0
  // Leland: stemUpSE.x = 1.3sp = actual right edge; cutOutNE.x=1.184sp is the stem cut-out notch
  const noteheadWidth   = sp * 1.3         // Leland glyph bbox right ≈ stemUpSE.x = 1.3sp
  const noteheadRx      = noteheadWidth / 2 // half-width (0.65sp) for tie geometry
  const noteheadRy      = sp * 0.168        // half-height offset for stem attach + bbox/tie
  const stemLength    = sp * 3.5          // standard un-beamed stem
  const beamThickness = sp * 0.5          // beam rectangle height
  const beamGap       = sp * 0.25         // gap between beam levels
  const dotOffsetX    = sp * 0.5    // Sid::dotNoteDistance = 0.5sp (styledef.cpp:216)
  const dotGlyphW     = sp * 0.24   // approximate Leland augmentation dot glyph width
  const accidentalW   = sp * 0.8          // approximate glyph width for spacing
  const accidentalGap = sp * 0.3

  // Determine clef from metadata (single-staff scores: treble)
  // TODO: extend for grand staff
  const clef: ClefType = 'treble'

  // ── System y-positions ───────────────────────────────────────────────────
  // staffUpperBorder (webmscore Sid::staffUpperBorder = 7sp): space above staff lines
  // for chord symbols, slurs, dynamics etc. — also keeps systems off the margin/title
  const staffUpperBorder = sp * 7.0
  // staffLowerBorder (webmscore Sid::staffLowerBorder = 7sp): space below staff lines
  const staffLowerBorder = sp * 7.0

  // systemStride: staffTop-to-staffTop distance =
  //   staffUpperBorder + staffHeight + staffLowerBorder + minSystemDistance
  // (matches webmscore: 7 + 4 + 7 + 8.5 = 26.5sp)
  const systemSpacingPx = opts.systemSpacingSp * sp
  const systemStride    = staffUpperBorder + staffHeight + staffLowerBorder + systemSpacingPx

  // Title height: extra vertical space reserved on the first page for score title.
  // Measured empirically from webmscore reference images: title frame ≈ 10sp
  const titleHeight = score.metadata.title ? sp * 10.0 : 0

  // Compute absolute systemY (top of staff lines) for each system
  const { systems: hSystems, pages: hPages } = hLayout
  const systemY: number[] = []
  {
    let currentPageIdx = -1
    let currentPageY  = 0
    let sysOnPage     = 0

    for (const hSys of hSystems) {
      if (hSys.pageIndex !== currentPageIdx) {
        // New page
        currentPageIdx = hSys.pageIndex
        const titleOffset = hSys.pageIndex === 0 ? titleHeight : 0
        currentPageY   = hSys.pageIndex * opts.pageHeight + opts.marginTop + staffUpperBorder + titleOffset
        sysOnPage      = 0
      }
      systemY.push(currentPageY + sysOnPage * systemStride)
      sysOnPage++
    }
  }

  // ── Build rendered objects ───────────────────────────────────────────────

  // Precompute prevFifths for each measure (key state before the measure's own key change)
  const prevFifthsPerMeasure = new Map<number, number>()
  {
    let runningFifths = score.metadata.fifths
    for (const m of score.measures) {
      prevFifthsPerMeasure.set(m.num, runningFifths)
      if (m.keyChange) runningFifths = m.keyChange.fifths
    }
  }

  const allRenderedNotes: RenderedNote[] = []
  const elementMap = new Map<string, DOMRectLike>()

  // BUG 1: Use only staff indices that actually have notes, not metadata.staffCount
  // (DONNALEE.XML reports staffCount=2 due to <staves>2</staves> but has only one active staff)
  const activeStaffIndices = new Set(
    score.measures.flatMap(m => m.notes.filter(n => !n.isRest).map(n => n.staffIndex))
  )
  const effectiveStaffCount = Math.max(1, activeStaffIndices.size)

  const renderedSystems: RenderedSystem[] = hSystems.map((hSys, sysIdx) => {
    const staffTop = systemY[sysIdx]

    // ── Staves for this system ────────────────────────────────────────────
    const staves: RenderedStaff[] = []
    for (let si = 0; si < effectiveStaffCount; si++) {
      const sy = staffTop + si * (staffHeight + opts.staffSpacingSp * sp)
      staves.push({
        staffIndex: si,
        y: sy,
        lineSpacing,
        height: staffHeight,
        clef,
        lineYs: [sy, sy + sp, sy + 2 * sp, sy + 3 * sp, sy + 4 * sp],
      })
    }

    const primaryStaffTop = staves[0].y

    // ── Measures ─────────────────────────────────────────────────────────
    const measures: RenderedMeasure[] = hSys.measureNums.map(measureNum => {
      const hMeasure  = hLayout.measures.get(measureNum)!
      const extMeasure = score.measures[measureNum - 1]!
      const isFirstInSys = hSys.measureNums[0] === measureNum
      const isLastMeasure = measureNum === score.metadata.measureCount

      // ── Pre-pass: beam group IDs ────────────────────────────────────
      const beamGroupIds = assignBeamGroupIds(extMeasure.notes)

      // ── Notes ───────────────────────────────────────────────────────
      // Determine if this measure has multiple voices
      const hasVoice2 = extMeasure.notes.some(n => n.voice === 2)

      const noteList: RenderedNote[] = []

      for (const en of extMeasure.notes) {
        if (en.isGrace) continue  // grace notes: skip for now

        const noteX = hLayout.noteX.get(en.id) ?? hMeasure.x + 20

        // ── Staff line & y ─────────────────────────────────────────
        let staffLine = 4   // default: middle (B4 in treble)
        let noteY     = primaryStaffTop + 4 * halfSp

        if (!en.isRest && en.step && en.octave !== undefined) {
          staffLine = pitchToStaffLine(en.step, en.octave, clef)
          noteY     = primaryStaffTop + staffLine * halfSp
        } else if (en.isRest) {
          // Rest vertical position by voice
          staffLine = (hasVoice2 && en.voice === 2) ? 6 : 2
          noteY     = primaryStaffTop + staffLine * halfSp
        }

        // ── Stem direction ─────────────────────────────────────────
        let stemUp: boolean
        if (hasVoice2) {
          stemUp = en.voice === 1   // voice 1 always up, voice 2 always down
        } else {
          stemUp = staffLine >= 4   // at/below middle → stem up
        }

        // ── Notehead type ──────────────────────────────────────────
        const nhType  = noteheadFromType(en.type)
        const hasStem = nhType !== 'whole'

        // ── Stem positions ─────────────────────────────────────────
        // From MuseScore: src/engraving/libmscore/chord.cpp:496
        //   stemPosX() = _up ? noteHeadWidth() : 0.0
        // From MuseScore: src/engraving/libmscore/stem.cpp:120-122
        //   lineWidthCorrection = lineWidthMag() * 0.5  (= Sid::stemWidth/2 = 0.05sp)
        //   lineX = _up * lineWidthCorrection            (_up = -1 for up, +1 for down)
        //   → up:   line center = noteHeadWidth - lineWidthCorr = 1.18 - 0.05 = 1.13sp
        //   → down: line center = 0 + lineWidthCorr            = 0.05sp
        // Bravura: stemUpSE=[1.18, -0.168] → attach below center; stemDownNW=[0, 0.168] → above center
        // (C++ sign convention: negative=above, positive=below staff line)
        const stemLWCorr = (0.10 / 2) * sp   // stem.cpp:120 — Sid::stemWidth=0.10sp, lineWidthMag()*0.5
        const stemX      = stemUp ? noteX + noteheadWidth - stemLWCorr : noteX + stemLWCorr
        const stemAttach = noteheadRy   // 0.168sp — distance from notehead center to stem attach edge
        // C++ stem.cpp:103-106: y1 = note->stemUpSE().y() [stem-up] or note->stemDownNW().y() [stem-down]
        //   stemUpSE.y = -0.168sp in SMuFL = ABOVE center (MuseScore y-down: negative = up)
        //   stemDownNW.y = +0.168sp in SMuFL = BELOW center (MuseScore y-down: positive = down)
        // C++ stem.cpp:74: y2 = _up * (baseLength) where _up = -1 for stem-up, +1 for stem-down
        //   stem-up tip:  noteY - stemLength (3.5sp above note center)
        //   stem-down tip: noteY + stemLength (3.5sp below note center)
        // Visible stem from base to tip:
        //   stem-up:   base = noteY - stemAttach,  tip = noteY - stemLength
        //   stem-down: base = noteY + stemAttach,  tip = noteY + stemLength
        const stemYTop   = stemUp ? noteY - stemLength  : noteY + stemAttach
        const stemYBot   = stemUp ? noteY - stemAttach  : noteY + stemLength

        // ── Accidental ─────────────────────────────────────────────
        let accidental: AccidentalType | undefined
        let accidentalX: number | undefined
        if (en.showAccidental && en.accidentalToShow) {
          accidental  = accidentalTypeFrom(en.accidentalToShow)
          const accW  = (ACCIDENTAL_WIDTH_SP[accidental] ?? 1.0) * sp
          const accGap = sp * 0.2
          // noteX = left edge; accidental goes to the left of it (chord.cpp note pos = left edge)
          accidentalX = noteX - accGap - accW
          // Clamp: never left of measure start
          accidentalX = Math.max(hMeasure.x + 2, accidentalX)
        }

        // ── Dots ───────────────────────────────────────────────────
        const dotted       = en.dotCount >= 1
        const doubleDotted = en.dotCount >= 2
        // If note is on a line, shift dot up to adjacent space
        const dotY  = staffLine % 2 === 0 ? noteY - halfSp : noteY
        // chord.cpp:2414: setDotPosX(headWidth) → dot starts at RIGHT edge + dotNoteDistance
        const dotX  = dotted       ? noteX + noteheadWidth + dotOffsetX                        : undefined
        const dot2X = doubleDotted ? noteX + noteheadWidth + dotOffsetX + dotGlyphW + sp * 0.25 : undefined

        // ── Ledger lines ───────────────────────────────────────────
        const ledgerLines = computeLedgerLines(
          staffLine, noteX, noteheadWidth, halfSp, primaryStaffTop,
        )

        // ── Bounding box ───────────────────────────────────────────
        const bboxLeft   = (accidentalX ?? noteX) - 2
        const bboxTop    = hasStem ? (stemUp ? stemYTop   : noteY - noteheadRy) : noteY - noteheadRy
        const bboxBottom = hasStem ? (stemUp ? noteY + noteheadRy : stemYBot)   : noteY + noteheadRy
        const bboxRight  = noteX + noteheadWidth + (dotted
          ? dotOffsetX + dotGlyphW + (doubleDotted ? sp * 0.25 + dotGlyphW : 0) + 4
          : 2)

        noteList.push({
          noteId:      en.id,
          measureNum:  en.measureNum,
          beat:        en.beat,
          staffIndex:  en.staffIndex,
          voice:       en.voice,
          x:           noteX + noteheadRx,   // center of notehead (noteheadRx = 0.65sp)
          y:           noteY,
          bbox:        makeDOMRect(bboxLeft, bboxTop, bboxRight - bboxLeft, bboxBottom - bboxTop),
          staffLine,
          noteheadType: nhType,
          durationType: en.type,
          stemUp,
          hasStem,
          stemX,
          stemYTop,
          stemYBottom: stemYBot,
          accidental,
          accidentalX,
          dotted,
          doubleDotted,
          dotX,
          dot2X,
          ledgerLines,
          isRest:      en.isRest,
          isGrace:     false,
          beamGroupId: beamGroupIds.get(en.id),
          tieStart:    en.tieStart,
          tieEnd:      en.tieStop,
          slurStart:   en.slurStart,
          slurEnd:     en.slurStop,
        })
      }

      // ── Chord grouping: fix stem direction & span for multi-note chords ──
      fixChordGrouping(noteList, extMeasure.notes, stemLength, noteheadRy, noteheadWidth, sp)

      allRenderedNotes.push(...noteList)

      // ── Beams ───────────────────────────────────────────────────
      const beams = buildBeams(noteList, extMeasure.notes, beamThickness, beamGap, sp)

      // ── Chord symbols (Skyline-aware placement) ─────────────────
      // Build skyline of note shapes in this measure for collision detection
      const measureSkyline = new Skyline()
      const noteShape = new Shape()
      for (const rn of noteList) {
        if (rn.isRest) continue
        // Add notehead bbox
        const nhw = noteheadWidth * 0.5
        const nhh = halfSp
        noteShape.add({ x: rn.x - nhw, y: rn.y - nhh, width: nhw * 2, height: nhh * 2 })
        // Add stem extent
        if (rn.hasStem) {
          const stemTop = Math.min(rn.stemYTop, rn.stemYBottom)
          const stemBot = Math.max(rn.stemYTop, rn.stemYBottom)
          noteShape.add({ x: rn.stemX - 0.5, y: stemTop, width: 1, height: stemBot - stemTop })
        }
        // Add accidental
        if (rn.accidental && rn.accidentalX != null) {
          const accW = 1.0 * sp
          const accH = 2.5 * sp
          noteShape.add({ x: rn.accidentalX, y: rn.y - accH / 2, width: accW, height: accH })
        }
      }
      measureSkyline.addShape(noteShape)

      // Base chord symbol y: above staff, with skyline adjustment if notes extend higher
      const baseChordY = primaryStaffTop - sp * 2.2
      // Minimum gap between chord symbol bottom and nearest note
      const chordGap = sp * 0.8
      // Chord symbol approximate height
      const chordHeight = sp * 1.5

      const chordSymbols: RenderedChordSymbol[] = extMeasure.harmonies.map(h => ({
        measureNum: h.measureNum,
        beat:       h.beat,
        x:          hLayout.noteX.get(`note-m${h.measureNum}b${Math.round(h.beat * 100)}-stub`)
                    ?? (hMeasure.x + hMeasure.width * ((h.beat - 1) / score.metadata.beats)),
        y:          baseChordY,
        text:       h.label,
        svgId:      `chord-m${h.measureNum}b${Math.round(h.beat * 100)}`,
      }))

      // Better x for chord symbols: from horizontal layout beat map
      const beatToX = new Map<number, number>()
      for (const seg of hLayout.measures.get(measureNum)!.segments) {
        beatToX.set(Math.round(seg.beat * 100), seg.x)
      }
      for (const cs of chordSymbols) {
        const beatKey = Math.round(cs.beat * 100)
        const x = beatToX.get(beatKey)
        if (x !== undefined) cs.x = x
      }

      // Skyline collision adjustment: push chord symbols up if they collide with notes
      for (const cs of chordSymbols) {
        const csWidth = cs.text.length * sp * 0.6
        const csShape = new Shape({
          x: cs.x, y: cs.y - chordHeight, width: csWidth, height: chordHeight,
        })
        // Check collision with note skyline
        const dist = noteShape.minVerticalDistance(csShape)
        if (dist > -chordGap) {
          // Collision: push chord symbol up by the overlap amount + gap
          cs.y -= (dist + chordGap)
        }
      }

      // Align chord symbols to consistent row within the system (lowest y wins)
      // This prevents chord symbols from jumping up/down between measures
      if (chordSymbols.length > 0) {
        const systemChordY = Math.min(...chordSymbols.map(cs => cs.y))
        for (const cs of chordSymbols) cs.y = systemChordY
      }

      // ── Barlines ───────────────────────────────────────────────
      // Suppress right barline when the next measure has an explicit left barline
      // (e.g. repeat-start). C++: MuseScore resolves conflicting barlines at same tick.
      const nextExtMeasure = score.measures[measureNum]
      const nextHasLeftBarline = !!nextExtMeasure?.barlineLeft
      const barlines = buildBarlines(
        extMeasure, hMeasure, primaryStaffTop, staffHeight, isLastMeasure, nextHasLeftBarline,
      )

      // ── Ties ───────────────────────────────────────────────────
      const ties = buildTies(noteList, noteheadWidth, noteheadRy, sp)

      // ── Tuplets ─────────────────────────────────────────────────
      const extNoteMap = new Map(extMeasure.notes.map(n => [n.id, n]))
      const tupletGroups = new Map<string, RenderedNote[]>()
      for (const rn of noteList) {
        const en = extNoteMap.get(rn.noteId)
        if (en?.tupletId) {
          if (!tupletGroups.has(en.tupletId)) tupletGroups.set(en.tupletId, [])
          tupletGroups.get(en.tupletId)!.push(rn)
        }
      }
      const tuplets: RenderedTuplet[] = []
      for (const [tid, tnotes] of tupletGroups) {
        if (tnotes.length < 2) continue
        tnotes.sort((a, b) => a.x - b.x)
        const first = tnotes[0]
        const last  = tnotes[tnotes.length - 1]
        const en    = extNoteMap.get(first.noteId)
        const num   = en?.tupletActual ?? 3
        // C++ tuplet.cpp:232-249 — weighted voting: auto stems ±1, manual ±1000, bias +1
        // We only have auto stems here, so this simplifies to majority + tie-break UP
        let up = 1
        for (const tn of tnotes) up += tn.stemUp ? 1 : -1
        const above = up > 0

        const bracketY = above
          ? Math.min(...tnotes.map(n => n.stemYTop))    - sp * 1.2
          : Math.max(...tnotes.map(n => n.stemYBottom)) + sp * 0.8

        tuplets.push({
          tupletId: tid,
          noteIds:  tnotes.map(n => n.noteId),
          number:   num,
          numberX:  (first.x + last.x) / 2,
          numberY:  bracketY,
          above,
          bracket: {
            x1: first.x - sp * 0.5, y1: bracketY,
            x2: last.x  + sp * 0.5, y2: bracketY,
            hookHeight: sp * 0.8,
          },
        })
      }

      // ── elementMap entry ───────────────────────────────────────
      elementMap.set(
        `measure-${measureNum - 1}`,
        makeDOMRect(hMeasure.x, primaryStaffTop, hMeasure.width, staffHeight),
      )

      // ── Header elements (first measure of each system) ─────────
      // Use per-system current key/time (not the initial metadata) for system 2+
      const clefX = hSys.x + CLEF_LEFT_MARGIN_SP * sp
      const fifths = hSys.currentFifths
      const keySigX = clefX + CLEF_GLYPH_WIDTH_SP * sp + CLEF_KEY_DIST_SP * sp
      const timeSigLeftEdge = fifths !== 0
        ? keySigX + keySigWidthSpLocal(fifths) * sp + KEY_TIMESIG_DIST_SP * sp
        : clefX + CLEF_GLYPH_WIDTH_SP * sp + CLEF_TIMESIG_DIST_SP * sp
      // timeSig is rendered with text-anchor="middle", so pass center x
      const timeSigCenterX = timeSigLeftEdge + TIMESIG_GLYPH_WIDTH_SP / 2 * sp

      // Inline time signature change: placed at barline + BAR_NOTE_DIST, center-aligned
      // (only when not the first measure of a system — system header already shows time sig)
      let inlineTimeSig: RenderedTimeSignature | undefined
      if (!isFirstInSys && extMeasure.timeChange) {
        const inlineTimeSigX = hMeasure.x + BAR_NOTE_DIST_SP * sp + TIMESIG_GLYPH_WIDTH_SP / 2 * sp
        inlineTimeSig = {
          beats:        extMeasure.timeChange.beats,
          beatType:     extMeasure.timeChange.beatType,
          x:            inlineTimeSigX,
          staffIndex:   0,
          yNumerator:   primaryStaffTop + lineSpacing,
          yDenominator: primaryStaffTop + 3 * lineSpacing,
        }
      }

      return {
        measureNum,
        staffIndex: 0,
        x:          hMeasure.x,
        width:      hMeasure.width,
        y:          primaryStaffTop,
        systemIndex: sysIdx,
        notes:       noteList,
        chordSymbols,
        beams,
        barlines,
        ties,
        slurs:        [],
        dynamics:     [],
        articulations: [],
        ornaments:    [],
        tuplets,
        repeatStart:  extMeasure.barlineLeft?.style === 'repeat-start',
        repeatEnd:    extMeasure.barlineRight?.style === 'repeat-end',
        clefDisplay: isFirstInSys ? {
          clef,
          x:          clefX,
          y:          primaryStaffTop,  // renderClef adds 3*sp to get G-line anchor
          staffIndex: 0,
          isChange:   false,
        } as RenderedClefSymbol : undefined,
        keySignatureChange: isFirstInSys
          ? buildKeySignature(fifths, clef, keySigX, primaryStaffTop, halfSp)
          : extMeasure.keyChange
            ? buildKeySignature(
                extMeasure.keyChange.fifths, clef,
                hMeasure.x + 0.5 * sp,  // C++: Sid::keysigLeftMargin = 0.5sp from barline left
                primaryStaffTop, halfSp,
                prevFifthsPerMeasure.get(measureNum) ?? fifths,
              )
            : undefined,
        timeSignatureDisplay: isFirstInSys ? {
          beats:        hSys.currentBeats,
          beatType:     hSys.currentBeatType,
          x:            timeSigCenterX,
          staffIndex:   0,
          yNumerator:   primaryStaffTop + lineSpacing,
          yDenominator: primaryStaffTop + 3 * lineSpacing,
        } as RenderedTimeSignature : inlineTimeSig,
      } as RenderedMeasure
    })

    return {
      systemIndex: sysIdx,
      pageIndex:   hSys.pageIndex,
      x:           hSys.x,
      y:           primaryStaffTop,
      width:       hSys.width,
      staves,
      measures,
      headerWidth: hSys.headerWidth,
    } as RenderedSystem
  })

  // ── Cross-barline ties ──────────────────────────────────────────────────
  {
    const allMeasures = renderedSystems
      .flatMap(sys => sys.measures)
      .sort((a, b) => a.measureNum - b.measureNum)
    for (let i = 0; i < allMeasures.length - 1; i++) {
      const crossTies = buildCrossBarlineTies(
        allMeasures[i], allMeasures[i + 1], noteheadWidth, noteheadRy, sp,
      )
      allMeasures[i].ties.push(...crossTies)
    }
  }

  // ── Group systems into pages ─────────────────────────────────────────────
  const renderedPages: RenderedPage[] = hPages.map(hp => ({
    pageIndex: hp.pageIndex,
    width:     opts.pageWidth,
    height:    opts.pageHeight,
    systems:   hp.systemIndices.map(si => renderedSystems[si]),
  }))

  // ── Assemble RenderedScore ───────────────────────────────────────────────
  return {
    pages: renderedPages,
    metadata: {
      title:         score.metadata.title,
      composer:      score.metadata.composer,
      keySignature:  `${score.metadata.fifths}`,
      timeSignature: `${score.metadata.beats}/${score.metadata.beatType}`,
      tempo:         score.metadata.tempo,
      measureCount:  score.metadata.measureCount,
      pageCount:     renderedPages.length,
    },
    allNotes:   allRenderedNotes,
    elementMap,
  }
}
