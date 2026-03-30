/**
 * MAP Native Renderer — Leland SMuFL Glyphs
 *
 * All codepoints from the SMuFL standard (smufl.org), as implemented in
 * the Leland font (MuseScore's default notation font).
 *
 * Usage: place a <text> element with font-family="Leland" and font-size = 4 * spatium.
 * The SMuFL convention: 1 staff space = font-size / 4.
 * The notehead baseline is the vertical center of the notehead (by SMuFL design).
 *
 * Vertical anchor convention for <text y="...">:
 *   - Noteheads: y = noteCenterY  (baseline = center of notehead)
 *   - Clefs, rests, accidentals: see per-function comments
 */

// ─── Noteheads ────────────────────────────────────────────────────────────────
export const LELAND_NOTEHEAD_WHOLE        = '\uE0A2'
export const LELAND_NOTEHEAD_HALF         = '\uE0A3'
export const LELAND_NOTEHEAD_BLACK        = '\uE0A4'
export const LELAND_NOTEHEAD_DOUBLE_WHOLE = '\uE0A0'

// ─── Clefs ────────────────────────────────────────────────────────────────────
/** G clef — anchor: 2nd line from bottom (G4 line). y = staffTop + 3*sp */
export const LELAND_G_CLEF    = '\uE050'
/** F clef — anchor: 4th line from bottom (F3 line). y = staffTop + sp */
export const LELAND_F_CLEF    = '\uE062'
/** Alto/Tenor C clef — anchor: middle line */
export const LELAND_C_CLEF    = '\uE05C'

// ─── Accidentals ──────────────────────────────────────────────────────────────
export const LELAND_SHARP          = '\uE262'
export const LELAND_FLAT           = '\uE260'
export const LELAND_NATURAL        = '\uE261'
export const LELAND_DOUBLE_SHARP   = '\uE263'
export const LELAND_DOUBLE_FLAT    = '\uE264'

// ─── Rests ────────────────────────────────────────────────────────────────────
/** Whole rest — hangs below 2nd line from top. y = staffTop + sp */
export const LELAND_REST_WHOLE    = '\uE4E3'
/** Half rest — sits on middle line. y = staffTop + 2*sp */
export const LELAND_REST_HALF     = '\uE4E4'
export const LELAND_REST_QUARTER  = '\uE4E5'
export const LELAND_REST_EIGHTH   = '\uE4E6'
export const LELAND_REST_16TH     = '\uE4E7'
export const LELAND_REST_32ND     = '\uE4E8'
export const LELAND_REST_64TH     = '\uE4E9'

// ─── Flags ────────────────────────────────────────────────────────────────────
/** 8th flag, stem up — attach at stem top */
export const LELAND_FLAG_8TH_UP   = '\uE240'
/** 8th flag, stem down — attach at stem bottom */
export const LELAND_FLAG_8TH_DOWN = '\uE241'
export const LELAND_FLAG_16TH_UP  = '\uE242'
export const LELAND_FLAG_16TH_DOWN = '\uE243'
export const LELAND_FLAG_32ND_UP  = '\uE244'
export const LELAND_FLAG_32ND_DOWN = '\uE245'

// ─── Augmentation dot ─────────────────────────────────────────────────────────
export const LELAND_AUGMENTATION_DOT = '\uE1E7'

// ─── Time signatures ──────────────────────────────────────────────────────────
/** Digits 0–9 for time signatures */
export const LELAND_TIME_SIG: Record<number, string> = {
  0: '\uE080', 1: '\uE081', 2: '\uE082', 3: '\uE083', 4: '\uE084',
  5: '\uE085', 6: '\uE086', 7: '\uE087', 8: '\uE088', 9: '\uE089',
}
export const LELAND_TIME_SIG_COMMON     = '\uE08A'
export const LELAND_TIME_SIG_CUT_COMMON = '\uE08B'

// ─── Font family string ───────────────────────────────────────────────────────
export const LELAND_FONT    = 'Leland, Bravura, serif'
export const EDWIN_FONT     = '"Edwin", "Edwin-Roman", Georgia, "Times New Roman", serif'

// ─── Font size formula ────────────────────────────────────────────────────────
/**
 * Standard SMuFL font size: 4 staff-spaces = 1 em.
 * All notation glyphs use this size.
 */
export function smuflFontSize(spatium: number): number {
  return spatium * 4
}

// ─── Accidental glyph lookup ──────────────────────────────────────────────────
export function lelandAccidentalGlyph(type: string): string {
  switch (type) {
    case 'sharp':            return LELAND_SHARP
    case 'flat':             return LELAND_FLAT
    case 'natural':          return LELAND_NATURAL
    case 'double-sharp':     return LELAND_DOUBLE_SHARP
    case 'double-flat':      return LELAND_DOUBLE_FLAT
    case 'courtesy-sharp':   return LELAND_SHARP
    case 'courtesy-flat':    return LELAND_FLAT
    case 'courtesy-natural': return LELAND_NATURAL
    default:                 return ''
  }
}

// ─── Engraving defaults from Leland metadata.json ────────────────────────────
/**
 * All values in staff-spaces (multiply by spatium to get pixels).
 * Source: webmscore/fonts/leland/leland_metadata.json → engravingDefaults
 */
export const ENGRAVING = {
  staffLineThickness:     0.11,
  stemThickness:          0.10,
  beamThickness:          0.50,
  beamSpacing:            0.25,
  legerLineThickness:     0.16,
  legerLineExtension:     0.35,
  thinBarlineThickness:   0.18,
  thickBarlineThickness:  0.55,
  barlineSeparation:      0.37,
  slurEndpointThickness:  0.07,
  slurMidpointThickness:  0.21,
  tieEndpointThickness:   0.07,
  tieMidpointThickness:   0.21,
  tupletBracketThickness: 0.10,
  repeatBarlineDotSep:    0.37,
} as const

/** Convert staff-spaces to pixels */
export function sp(staffSpaces: number, spatium: number): number {
  return staffSpaces * spatium
}

// ─── Time signature glyph from number string ─────────────────────────────────
export function lelandTimeSigGlyph(num: number): string {
  return String(num).split('').map(d => LELAND_TIME_SIG[Number(d)] ?? d).join('')
}

// ─── Rest glyph lookup ────────────────────────────────────────────────────────
export function lelandRestGlyph(noteheadType: string): string {
  switch (noteheadType) {
    case 'whole':   return LELAND_REST_WHOLE
    case 'half':    return LELAND_REST_HALF
    case 'quarter': return LELAND_REST_QUARTER
    case 'eighth':  return LELAND_REST_EIGHTH
    case '16th':    return LELAND_REST_16TH
    case '32nd':    return LELAND_REST_32ND
    case '64th':    return LELAND_REST_64TH
    default:        return LELAND_REST_QUARTER
  }
}

// ─── Flag glyph lookup ────────────────────────────────────────────────────────
export function lelandFlagGlyph(noteheadType: string, stemUp: boolean): string | null {
  switch (noteheadType) {
    case 'eighth': return stemUp ? LELAND_FLAG_8TH_UP : LELAND_FLAG_8TH_DOWN
    case '16th':   return stemUp ? LELAND_FLAG_16TH_UP : LELAND_FLAG_16TH_DOWN
    case '32nd':   return stemUp ? LELAND_FLAG_32ND_UP : LELAND_FLAG_32ND_DOWN
    default:       return null
  }
}
