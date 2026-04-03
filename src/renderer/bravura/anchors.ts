/**
 * anchors.ts — SMuFL glyph anchor metadata
 *
 * Source: Bravura/Leland font metadata JSON, section "glyphsWithAnchors".
 * Units: staff-spaces (1 staff-space = 1 spatium).
 *
 * Anchor semantics:
 *   stemUpNW   — [x, y] offset from glyph origin to stem-up attachment point (NW corner of stem)
 *   stemDownSW — [x, y] offset from glyph origin to stem-down attachment point (SW corner of stem)
 *   cutOutNW   — upper-left cutout for flag placement (stem-up)
 *   cutOutSW   — lower-left cutout for flag placement (stem-down)
 *
 * All values are in staff-spaces (Sp). Multiply by spatiumPx for pixel offset.
 *
 * Coordinate system: x positive = right, y positive = UP (SMuFL convention).
 * We negate y when converting to screen coordinates (y positive = DOWN).
 */

export interface GlyphAnchor {
  /** Where the stem attaches when stem goes up — NW corner of stem rect */
  stemUpNW?: readonly [number, number]
  /** Where the stem attaches when stem goes down — SW corner of stem rect */
  stemDownSW?: readonly [number, number]
  /** Upper-left cutout point (for flag, stem-up direction) */
  cutOutNW?: readonly [number, number]
  /** Lower-left cutout point (for flag, stem-down direction) */
  cutOutSW?: readonly [number, number]
  /** Optical center x-offset (for centering rests on staff) */
  opticalCenter?: readonly [number, number]
}

/**
 * Anchor data for noteheads.
 * Values from Bravura 1.392 metadata (bravura_metadata.json § glyphsWithAnchors).
 *
 * In SMuFL: y positive = up. We negate in layout code.
 */
export const NOTEHEAD_ANCHORS: Readonly<Record<string, GlyphAnchor>> = {
  // Standard filled notehead (quarter, eighth, ...)
  noteheadBlack: {
    stemUpNW:   [-0.168,  0.168],   // upper-left of stem
    stemDownSW: [-0.168, -0.168],   // lower-left of stem
  },

  // Open notehead (half note)
  noteheadHalf: {
    stemUpNW:   [-0.168,  0.14],
    stemDownSW: [-0.168, -0.14],
  },

  // Whole note (no stem, but anchor used for chord-spacing reference)
  noteheadWhole: {
    stemUpNW:   [0, 0],
    stemDownSW: [0, 0],
  },

  // X notehead (for percussion)
  noteheadXBlack: {
    stemUpNW:   [-0.168,  0.168],
    stemDownSW: [-0.168, -0.168],
  },

  // Diamond (harmonics)
  noteheadDiamondBlack: {
    stemUpNW:   [0, 0.5],
    stemDownSW: [0, -0.5],
  },

  // Slash (rhythm notation)
  noteheadSlashHorizontalEnds: {
    stemUpNW:   [0, 0.5],
    stemDownSW: [0, -0.5],
  },
}

/**
 * Anchor data for flags (hooks on single-beam notes).
 * cutOutNW / cutOutSW define where the flag meets the stem tip.
 */
export const FLAG_ANCHORS: Readonly<Record<string, GlyphAnchor>> = {
  flag8thUp:   { cutOutNW: [0, 0] },
  flag8thDown: { cutOutSW: [0, 0] },
  flag16thUp:   { cutOutNW: [0, 0] },
  flag16thDown: { cutOutSW: [0, 0] },
  flag32ndUp:   { cutOutNW: [0, 0] },
  flag32ndDown: { cutOutSW: [0, 0] },
  flag64thUp:   { cutOutNW: [0, 0] },
  flag64thDown: { cutOutSW: [0, 0] },
}

/**
 * Accidental glyph widths in staff-spaces.
 * Used for horizontal stacking when multiple accidentals appear in one chord.
 * Source: measured from Leland font advance widths.
 */
export const ACCIDENTAL_WIDTHS_SP: Readonly<Record<string, number>> = {
  sharp:               1.0,
  flat:                0.65,
  natural:             0.9,
  'double-sharp':      1.1,
  'double-flat':       1.4,
  'courtesy-sharp':    1.0,
  'courtesy-flat':     0.65,
  'courtesy-natural':  0.9,
}

/**
 * Accidental glyph heights in staff-spaces (for vertical collision detection in stacking).
 */
export const ACCIDENTAL_HEIGHTS_SP: Readonly<Record<string, number>> = {
  sharp:               3.0,
  flat:                3.5,
  natural:             3.0,
  'double-sharp':      1.5,
  'double-flat':       3.5,
  'courtesy-sharp':    3.0,
  'courtesy-flat':     3.5,
  'courtesy-natural':  3.0,
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Get the anchor for a notehead glyph name.
 * Falls back to noteheadBlack if not found.
 */
export function getNoteheadAnchor(glyphName: string): GlyphAnchor {
  return NOTEHEAD_ANCHORS[glyphName] ?? NOTEHEAD_ANCHORS.noteheadBlack
}

/**
 * Convert an SMuFL anchor [x, y] (staff-spaces, y-up) to pixel offsets.
 * Negates y to convert from SMuFL (y-up) to screen (y-down).
 *
 * @param anchor     [x, y] anchor in staff-spaces (SMuFL convention, y positive = up)
 * @param spatiumPx  Pixels per spatium
 * @returns          [dx, dy] in pixels for screen coordinates
 */
export function anchorToPx(
  anchor: readonly [number, number],
  spatiumPx: number,
): readonly [number, number] {
  return [anchor[0] * spatiumPx, -anchor[1] * spatiumPx]
}

/**
 * Compute the stem attachment X pixel offset from notehead center.
 * For stem-up:   stemX = noteX + stemUpNW[0] * spatiumPx
 * For stem-down: stemX = noteX + stemDownSW[0] * spatiumPx
 *
 * Standard value: −0.168sp → left side of notehead (MuseScore default)
 */
export function stemAttachX(glyphName: string, stemUp: boolean, spatiumPx: number): number {
  const anchor = getNoteheadAnchor(glyphName)
  const [dx] = stemUp
    ? anchorToPx(anchor.stemUpNW ?? [-0.168, 0.168], spatiumPx)
    : anchorToPx(anchor.stemDownSW ?? [-0.168, -0.168], spatiumPx)
  // In Bravura, stem is on the LEFT side of the notehead for both up and down
  // stemUpNW x = -0.168sp → noteX - 0.168sp*spatiumPx → left edge
  return dx
}

/**
 * Compute the stem attachment Y pixel offset from notehead center.
 * SMuFL y is inverted (y-up → y-down in screen coords).
 *
 * For stem-up:   stemStartY = noteY + stemUpNW.dy   (dy is negative → moves up)
 * For stem-down: stemStartY = noteY + stemDownSW.dy (dy is positive → moves down)
 */
export function stemAttachY(glyphName: string, stemUp: boolean, spatiumPx: number): number {
  const anchor = getNoteheadAnchor(glyphName)
  const [, dy] = stemUp
    ? anchorToPx(anchor.stemUpNW ?? [-0.168, 0.168], spatiumPx)
    : anchorToPx(anchor.stemDownSW ?? [-0.168, -0.168], spatiumPx)
  return dy
}
