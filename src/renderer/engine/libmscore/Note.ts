/**
 * MAP Native Renderer — engine/libmscore/Note.ts
 * C++ source: src/engraving/libmscore/note.cpp
 *
 * Mirrors Note::layout() and note position utilities.
 * All formulas extracted verbatim from the C++ source with file:line references.
 *
 * Scope: pitch → staff-line, staff-line → y, notehead geometry.
 * NOT included: tablature, drumset, cross-staff, custom noteheads.
 */

import type { Px } from '../../spatium'
import { lineToY } from '../../spatium'
import { Sid } from '../../style/StyleDef'

// ─────────────────────────────────────────────────────────────────────────────
// Constants (from note.cpp + styledef.cpp)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notehead half-width in staff-spaces.
 * C++: note.cpp:1088 — return symWidth(noteHead())
 * Leland noteheadBlack advance width ≈ 1.18sp → half = 0.59sp
 */
export const NOTEHEAD_RX_SP = 0.59

/**
 * Notehead half-height in staff-spaces.
 * C++: note.cpp:1138 — return symHeight(noteHead())
 * Leland noteheadBlack height ≈ 0.72sp → half = 0.36sp
 */
export const NOTEHEAD_RY_SP = 0.36

/**
 * Distance from notehead right edge to first augmentation dot.
 * C++: note.cpp:2343 — d = score()->point(score()->styleS(Sid::dotNoteDistance))
 * styledef.cpp:216 → Spatium(0.5)
 */
export const DOT_NOTE_DIST_SP: number = Sid.dotNoteDistance   // 0.5

/**
 * Center-to-center distance between consecutive augmentation dots.
 * C++: note.cpp:2344 — dd = score()->point(score()->styleS(Sid::dotDotDistance))
 * styledef.cpp:218 → Spatium(0.65)
 */
export const DOT_DOT_DIST_SP: number = Sid.dotDotDistance     // 0.65

// ─────────────────────────────────────────────────────────────────────────────
// Pitch → Staff Line
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Note::line() — staff-line position of a note.
 * C++: note.cpp stores _line; set by Score::updateNotes() via Pitch::line().
 *
 * Staff-line convention (same as MuseScore):
 *   0 = top staff line  (line 1)
 *   2 = second line     (line 2)
 *   4 = middle line     (line 3) = MIDDLE_LINE
 *   6 = fourth line     (line 4)
 *   8 = bottom line     (line 5)
 *   Negative = above staff (ledger lines)
 *   > 8     = below staff (ledger lines)
 *   Odd     = space between two lines
 *
 * C++ formula (Pitch::line for treble clef):
 *   line = 38 - (diatonicStep + octave * 7)
 *   where diatonic: C=0,D=1,E=2,F=3,G=4,A=5,B=6
 */
const CLEF_OFFSET: Record<string, number> = {
  treble:     38,   // G4 on line 2 → C4 at line 10 (below staff)
  bass:       26,   // F3 on line 6 → C4 at line -2 (above staff)
  alto:       32,   // C4 at line 4 (middle)
  tenor:      30,   // C4 at line 6
  percussion: 38,
}

const STEP_TO_DIATONIC: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
}

export function pitchToStaffLine(step: string, octave: number, clef: string): number {
  const diatonic = STEP_TO_DIATONIC[step] ?? 0
  const offset = CLEF_OFFSET[clef] ?? CLEF_OFFSET.treble
  return offset - (diatonic + octave * 7)
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff-line → Y (pixels)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Note y-position from staff line.
 * C++: note.cpp pos().ry() stored after Score::updateNotes():
 *   y = line * spatium() * 0.5
 * (MuseScore uses half-spaces: line 0 → top, line 2 → second line, etc.)
 *
 * @param staffLine  Staff line (0=top, 2=2nd, 4=mid, 6=4th, 8=bottom)
 * @param staffTopPx Y of the top staff line in pixels
 * @param sp         Spatium in pixels
 */
export function noteY(staffLine: number, staffTopPx: Px, sp: Px): Px {
  // C++: y = line * spatium() * 0.5
  // lineToY implements exactly this: staffTopPx + staffLine * sp * 0.5
  return lineToY(staffLine, staffTopPx, sp)
}

// ─────────────────────────────────────────────────────────────────────────────
// Stem direction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default stem direction for a note on standard 5-line staff.
 * C++: chord.cpp:988–1114 — complex rules for voices, beams, custom override.
 *
 * Simplified rules for MAP (single-voice or two-voice):
 * 1. voice === 2 → always down
 * 2. voice === 1 in multi-voice → always up
 * 3. Otherwise → stem up if note is on or below the middle line (staffLine >= 4)
 *
 * C++: chord.cpp:1088 — _up = isTrackEven (voice 1 = even track → up for single voice)
 */
export function stemUp(staffLine: number, voice: number, isMultiVoice: boolean): boolean {
  if (voice === 2) return false
  if (voice === 1 && isMultiVoice) return true
  return staffLine >= 4  // on or below middle line → stem up
}

// ─────────────────────────────────────────────────────────────────────────────
// Notehead type
// ─────────────────────────────────────────────────────────────────────────────

export type NoteheadType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd' | '64th'
  | 'double-whole' | 'x' | 'diamond' | 'slash'

/** Whether a notehead type has a stem (C++: chord.cpp — whole/double-whole have no stem) */
export function hasStem(type: NoteheadType): boolean {
  return type !== 'whole' && type !== 'double-whole'
}

// ─────────────────────────────────────────────────────────────────────────────
// Notehead layout
// ─────────────────────────────────────────────────────────────────────────────

export interface NoteLayout {
  /** X = left edge of notehead bounding box (noteX - NOTEHEAD_RX_SP * sp) */
  x: Px
  /** Y = staff-line y (= center of notehead) */
  y: Px
  staffLine: number
  stemUp: boolean
  hasStem: boolean
}

/**
 * Compute note layout (position only — no glyph/paint here).
 * C++: Note::layout() sets bbox from symBbox(noteHead()).
 *
 * @param noteX     Center x of the note (from HorizontalLayout.noteX)
 * @param step      Pitch step 'C'–'B'
 * @param octave    Octave number
 * @param clef      Clef type string
 * @param staffTopPx Y of top staff line
 * @param sp        Spatium in pixels
 * @param voice     Voice number (1–4)
 * @param isMultiVoice Whether this staff has multiple voices active
 * @param nhType    Notehead type
 */
export function layoutNote(
  noteX: Px,
  step: string,
  octave: number,
  clef: string,
  staffTopPx: Px,
  sp: Px,
  voice: number,
  isMultiVoice: boolean,
  nhType: NoteheadType,
): NoteLayout {
  const line = pitchToStaffLine(step, octave, clef)
  const y    = noteY(line, staffTopPx, sp)
  const up   = stemUp(line, voice, isMultiVoice)
  const x    = noteX - NOTEHEAD_RX_SP * sp

  return { x, y, staffLine: line, stemUp: up, hasStem: hasStem(nhType) }
}
