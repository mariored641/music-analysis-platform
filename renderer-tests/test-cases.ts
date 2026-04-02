/**
 * MAP Renderer Test Cases
 *
 * Each test case:
 *   - Points to a MusicXML fixture in /public/renderer-tests/fixtures/
 *   - Has a human-readable checklist of what to verify visually
 *   - Maps to a screenshot file in renderer-tests/current/<id>.png
 *
 * Based on webmscore's vtest approach:
 *   score file → render → PNG → compare to reference PNG
 */

export interface CheckItem {
  /** Short description — shown in test harness UI */
  label: string
  /** Optional extended explanation */
  detail?: string
}

export interface TestCase {
  id: string
  title: string
  description: string
  fixtureFile: string   // relative to /public/ — fetched at runtime
  /** What to inspect visually */
  checklist: CheckItem[]
  /** Which renderer feature this primarily tests */
  category: 'layout' | 'notation' | 'symbols' | 'spacing' | 'integration'
}

export const TEST_CASES: TestCase[] = [
  {
    id: '01-noteheads',
    title: '01 — Noteheads',
    description: 'All duration types from whole to 16th. Tests notehead shape, fill, and flag rendering.',
    fixtureFile: 'renderer-tests/fixtures/01-noteheads.xml',
    category: 'notation',
    checklist: [
      { label: 'Whole note: open oval, no stem', detail: 'Should be a hollow ellipse with no stem attached' },
      { label: 'Half note: open oval with stem' },
      { label: 'Quarter note: filled oval with stem' },
      { label: 'Eighth: filled oval + stem + single flag (or beamed)' },
      { label: '16th: filled oval + stem + two flags (or beamed)' },
      { label: 'Noteheads are all the same size and shape across durations' },
      { label: 'Flags curve in the correct direction (always to the right of stem)' },
      { label: 'Beam slope matches contour of the melodic line (ascending/descending)' },
      { label: 'No overlap between noteheads in the beam groups' },
    ],
  },
  {
    id: '02-accidentals',
    title: '02 — Accidentals',
    description: 'Sharp, flat, natural, double-sharp, double-flat, courtesy accidentals, and vertical stacking in chords.',
    fixtureFile: 'renderer-tests/fixtures/02-accidentals.xml',
    category: 'notation',
    checklist: [
      { label: '♯ glyph: two vertical lines + two horizontal bars' },
      { label: '♭ glyph: vertical line + curved loop at bottom' },
      { label: '♮ glyph: box-like natural sign (two corner brackets)' },
      { label: '𝄪 double-sharp: X shape (four-pointed)' },
      { label: '𝄫 double-flat: two flat signs side by side' },
      { label: 'Courtesy (cautionary) accidentals appear in parentheses' },
      { label: 'Accidental is left of the notehead, not overlapping it' },
      { label: 'Accidentals in chords stack correctly (no collision)', detail: 'Multiple accidentals on the same beat must be offset horizontally' },
      { label: 'Spacing before accidental is consistent with spacing before plain note' },
    ],
  },
  {
    id: '03-rests',
    title: '03 — Rests',
    description: 'All rest durations: whole through 16th, plus mixed note+rest measures.',
    fixtureFile: 'renderer-tests/fixtures/03-rests.xml',
    category: 'notation',
    checklist: [
      { label: 'Whole rest: filled rectangle hanging from 4th staff line (from top)', detail: 'Whole rest hangs DOWN from the 2nd line from top' },
      { label: 'Half rest: filled rectangle sitting ON 3rd staff line (from top)', detail: 'Half rest sits UP on the middle line' },
      { label: 'Quarter rest: squiggly/Z-shaped glyph, vertically centered' },
      { label: 'Eighth rest: flag-like glyph' },
      { label: '16th rest: two-flag glyph' },
      { label: 'Rests are horizontally spaced like notes of the same duration' },
      { label: 'In mixed measure, note+rest rhythm is correct and readable' },
    ],
  },
  {
    id: '04-beams',
    title: '04 — Beams',
    description: 'Eighth and 16th beam groups: ascending run, descending run, mixed, broken beam.',
    fixtureFile: 'renderer-tests/fixtures/04-beams.xml',
    category: 'layout',
    checklist: [
      { label: 'Ascending run: beam slopes upward (left end lower, right end higher)' },
      { label: 'Descending run: beam slopes downward' },
      { label: 'Beam is a filled parallelogram (not just a line)' },
      { label: 'Beam thickness is consistent across all groups' },
      { label: '16th groups: secondary beam (closer to stems) is parallel to primary' },
      { label: 'Distance between primary and secondary beam is consistent (≈ 1 sp)' },
      { label: 'Broken beam (m.4): shorter secondary beam on partial groups is correct', detail: 'e.g. 8th+16th+16th: the two 16ths share a secondary beam, the 8th has none' },
      { label: 'Stem lengths are extended so all stems reach the beam' },
      { label: 'No gap between stem endpoint and beam' },
    ],
  },
  {
    id: '05-stems',
    title: '05 — Stems',
    description: 'Stem direction by staff position: notes below middle line → up; above → down.',
    fixtureFile: 'renderer-tests/fixtures/05-stems.xml',
    category: 'notation',
    checklist: [
      { label: 'Low notes (C4–F4): stems point UP from right side of notehead' },
      { label: 'High notes (G5–C6): stems point DOWN from left side of notehead' },
      { label: 'Stem length: standard ≈ 3.5 staff spaces', detail: 'Should reach roughly the middle line from any pitch' },
      { label: 'Stem is thin and straight, not too thick' },
      { label: 'Stem connects cleanly to notehead (no gap, no overdraw)' },
      { label: 'Alternating up/down stems (m.4): no note overlap' },
    ],
  },
  {
    id: '06-key-signatures',
    title: '06 — Key Signatures',
    description: 'C, G, D, A major (sharps) and F, Bb, Ab major (flats), each in its own measure.',
    fixtureFile: 'renderer-tests/fixtures/06-key-signatures.xml',
    category: 'symbols',
    checklist: [
      { label: 'C major (m.1): no accidentals after clef' },
      { label: 'G major (m.2): one sharp on F line' },
      { label: 'D major (m.3): two sharps (F, C) in correct positions' },
      { label: 'A major (m.4): three sharps (F, C, G) in correct order/positions' },
      { label: 'F major (m.5): one flat on B line' },
      { label: 'Bb major (m.6): two flats (B, E) in correct positions' },
      { label: 'Ab major (m.7): four flats (B, E, A, D) in correct positions' },
      { label: 'Key signature accidentals are the right size (same font-size as notation accidentals)' },
      { label: 'Spacing between key sig accidentals is consistent and not cramped' },
      { label: 'Key sig is clearly separated from the first note' },
    ],
  },
  {
    id: '07-time-signatures',
    title: '07 — Time Signatures',
    description: '4/4, 3/4, 2/4, 6/8, 5/4, 2/2 — each in a separate measure.',
    fixtureFile: 'renderer-tests/fixtures/07-time-signatures.xml',
    category: 'symbols',
    checklist: [
      { label: 'Time sig numerals are centered horizontally in the staff' },
      { label: 'Top digit (numerator) is in the upper half of the staff' },
      { label: 'Bottom digit (denominator) is in the lower half of the staff' },
      { label: 'Digits are the correct size (≈ 2 staff spaces tall each)' },
      { label: 'Changed time sig (m.2 onward): new time sig appears at left of measure' },
      { label: '6/8: the "6" and "8" are vertically aligned' },
      { label: 'Multi-digit numerals (no examples here but 12/8 etc.) should stack properly' },
    ],
  },
  {
    id: '08-ledger-lines',
    title: '08 — Ledger Lines',
    description: 'Notes above and below the staff requiring 1, 2, and 3 ledger lines.',
    fixtureFile: 'renderer-tests/fixtures/08-ledger-lines.xml',
    category: 'notation',
    checklist: [
      { label: 'C6 (1 ledger above): single line clearly above the staff' },
      { label: 'E6 (2 ledger): two lines above staff, evenly spaced' },
      { label: 'G6 (3 ledger): three lines above staff' },
      { label: 'B3 (1 ledger below): single line below staff' },
      { label: 'G3, E3, C3: 2 and 3 ledger lines below staff' },
      { label: 'Ledger line length: extends ≈ 1 notehead-width on each side of note' },
      { label: 'Ledger line is the same thickness as staff lines' },
      { label: 'Middle C (C4): ledger line exactly midway between bottom staff line and note' },
      { label: 'No ledger line is drawn at the wrong position (off by one)' },
    ],
  },
  {
    id: '09-tuplets',
    title: '09 — Tuplets',
    description: 'Triplet eighths, triplet quarters, and quintuplet 16ths.',
    fixtureFile: 'renderer-tests/fixtures/09-tuplets.xml',
    category: 'layout',
    checklist: [
      { label: 'Triplet number "3" appears above (or below) the group' },
      { label: 'Bracket: two horizontal lines with vertical hooks at the ends' },
      { label: 'Bracket is above the note group when stems point down, below when up' },
      { label: 'Bracket starts at first note, ends at last note of the group' },
      { label: 'Number "3" is horizontally centered over the group' },
      { label: 'Tuplet notes are evenly spaced within the group' },
      { label: 'Quintuplet: number "5" appears correctly' },
      { label: 'No bracket drawn when beam covers the group (beamed tuplets should show only the number)' },
    ],
  },
  {
    id: '10-ties',
    title: '10 — Ties',
    description: 'Ties within a measure, across a barline, and in chord (multiple simultaneous ties).',
    fixtureFile: 'renderer-tests/fixtures/10-ties.xml',
    category: 'notation',
    checklist: [
      { label: 'Tie is a smooth curved arc (bezier), not a sharp angle' },
      { label: 'Tie arc above note: opens downward (bowed up)' },
      { label: 'Tie arc below note: opens upward' },
      { label: 'Tie starts at right edge of first notehead, ends at left edge of second' },
      { label: 'Tie does not pass through note stems' },
      { label: 'Cross-barline tie: arc spans across the barline cleanly' },
      { label: 'Chord ties (m.4): three simultaneous arcs, properly spaced, no overlap' },
    ],
  },
  {
    id: '11-chord-symbols',
    title: '11 — Chord Symbols',
    description: 'Major, minor, dominant 7th, maj7, half-dim, diminished, and altered chords.',
    fixtureFile: 'renderer-tests/fixtures/11-chord-symbols.xml',
    category: 'symbols',
    checklist: [
      { label: 'Chord symbols appear above the staff' },
      { label: 'Root letter uses Edwin (serif) font, readable size' },
      { label: '♭ and ♯ are rendered as proper Unicode symbols (not "b" or "#")' },
      { label: 'Quality text (maj7, m7, dim, aug) follows the root without gap' },
      { label: 'Chord symbol is aligned to the beat it falls on' },
      { label: 'Adjacent chords do not overlap (sufficient horizontal spacing)' },
      { label: 'Altered chord (G7b9): alteration is readable' },
      { label: 'Half-diminished (ø) symbol renders if supported' },
    ],
  },
  {
    id: '12-barlines',
    title: '12 — Barlines',
    description: 'Regular, double, repeat-start, repeat-end, and final barlines.',
    fixtureFile: 'renderer-tests/fixtures/12-barlines.xml',
    category: 'symbols',
    checklist: [
      { label: 'Regular barline: single thin vertical line spanning full staff height' },
      { label: 'Double barline: two thin lines with small gap between them' },
      { label: 'Repeat-start: thick bar + thin bar + two dots (on 2nd and 4th spaces)' },
      { label: 'Repeat-end: two dots + thin bar + thick bar' },
      { label: 'Final barline: thin bar + thick bar (thick on right)' },
      { label: 'All barlines span exactly from top staff line to bottom staff line' },
      { label: 'Dot positions in repeat barlines are centered in the staff spaces' },
    ],
  },
  {
    id: '13-dots',
    title: '13 — Dotted Notes',
    description: 'Dotted half, dotted quarter, dotted eighth, and double-dotted quarter.',
    fixtureFile: 'renderer-tests/fixtures/13-dots.xml',
    category: 'notation',
    checklist: [
      { label: 'Augmentation dot appears to the right of the notehead' },
      { label: 'Dot is a filled circle (not hollow)' },
      { label: 'Dot is at note center y (if note is on a space) or offset up (if on a line)' },
      { label: 'Double-dotted: second dot follows first dot, slightly further right' },
      { label: 'Dots in beamed groups: dot position does not collide with beam' },
      { label: 'Dotted rhythm spacing: dotted quarter + eighth fills exactly 1 beat' },
    ],
  },
  {
    id: '14-chords',
    title: '14 — Multi-note Chords',
    description: 'Dyads, triads, seventh chords, and close-position intervals (2nds).',
    fixtureFile: 'renderer-tests/fixtures/14-chords.xml',
    category: 'layout',
    checklist: [
      { label: 'Dyads: two noteheads on same stem, correct vertical spacing' },
      { label: 'Triads: three noteheads stacked vertically, no overlap' },
      { label: 'Seventh chord (4 notes): all noteheads visible and distinct' },
      { label: 'Close 2nds: adjacent noteheads are offset horizontally (not overlapping)', detail: 'C and D together: one goes left, one goes right of stem, or one is offset' },
      { label: 'Stem is shared by all notes in chord' },
      { label: 'Stem length is extended when needed to reach outermost note' },
      { label: 'All accidentals in chord are staggered horizontally (no overlap)' },
    ],
  },
  {
    id: '15-mixed',
    title: '15 — Mixed Jazz Excerpt',
    description: 'Integration test: chord symbols, ties, beams, triplets, dotted rhythm, accidentals together.',
    fixtureFile: 'renderer-tests/fixtures/15-mixed.xml',
    category: 'integration',
    checklist: [
      { label: 'Chord symbols align to beats without overlapping notes' },
      { label: 'Tie in m.1→2 connects correctly across barline' },
      { label: 'Beam in m.1 (F–A eighth pair) slopes correctly' },
      { label: 'Triplets in m.3 show number "3" + beam (no separate bracket needed)' },
      { label: 'Dotted quarter + eighth in m.4 has correct proportional spacing' },
      { label: 'Flat accidental on Ab in m.4 is not repeated if in key signature' },
      { label: 'Overall line density looks like readable sheet music' },
      { label: 'System fills the page width (stretch is applied)' },
    ],
  },
]

/** Look up a test case by id — returns undefined if not found */
export function getTestCase(id: string): TestCase | undefined {
  return TEST_CASES.find(tc => tc.id === id)
}

/** Categories for filtering in the UI */
export const CATEGORIES = ['all', 'layout', 'notation', 'symbols', 'spacing', 'integration'] as const
export type Category = typeof CATEGORIES[number]
