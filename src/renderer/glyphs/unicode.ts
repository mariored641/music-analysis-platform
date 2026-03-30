/**
 * MAP Native Renderer — Unicode Glyphs (Stage 5, Phase A)
 *
 * First-pass glyph set using Unicode music symbols + SVG primitives.
 * Fast, zero-dependency, works in all browsers.
 *
 * Phase B (Stage 8): replace with Bravura SVG paths for professional quality.
 */

// ─── Unicode music code points ────────────────────────────────────────────────
// U+1D100 range requires surrogate pairs in JS strings:

/** 𝄞 Treble (G) clef */
export const GLYPH_TREBLE_CLEF = '\u{1D11E}'

/** 𝄢 Bass (F) clef */
export const GLYPH_BASS_CLEF = '\u{1D122}'

/** 𝄪 Double sharp */
export const GLYPH_DOUBLE_SHARP = '\u{1D12A}'

/** 𝄫 Double flat */
export const GLYPH_DOUBLE_FLAT = '\u{1D12B}'

/** ♯ Sharp */
export const GLYPH_SHARP = '\u266F'

/** ♭ Flat */
export const GLYPH_FLAT = '\u266D'

/** ♮ Natural */
export const GLYPH_NATURAL = '\u266E'

/** 𝅗 Half notehead (open) */
export const GLYPH_HALF_HEAD = '\u{1D157}'

/** ‿ Tie / slur arc suggestion (we use SVG path directly) */

// ─── Glyph font sizes ─────────────────────────────────────────────────────────

/** Font-size for clef symbols (px). Scaled to lineSpacing. */
export function clefFontSize(lineSpacing: number): number {
  return lineSpacing * 4.8
}

/** Font-size for accidentals */
export function accFontSize(lineSpacing: number): number {
  return lineSpacing * 2.4
}

/** Font-size for time signature digits */
export function timeSigFontSize(lineSpacing: number): number {
  return lineSpacing * 1.6
}

/** Font-size for dynamics (p, f, mf…) */
export function dynamFontSize(lineSpacing: number): number {
  return lineSpacing * 2.2
}
