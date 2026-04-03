/**
 * MAP Native Renderer — Glyph API
 * Delegates to leland.ts (Leland SMuFL font).
 */

export {
  LELAND_FONT,
  LELAND_TEXT_FONT,
  EDWIN_FONT,
  LELAND_DYNAMIC_P,
  LELAND_DYNAMIC_F,
  LELAND_DYNAMIC_M,
  LELAND_DYNAMIC_R,
  LELAND_DYNAMIC_S,
  LELAND_DYNAMIC_Z,
  LELAND_DYNAMIC_N,
  LELAND_G_CLEF,
  LELAND_F_CLEF,
  LELAND_C_CLEF,
  LELAND_NOTEHEAD_BLACK,
  LELAND_NOTEHEAD_HALF,
  LELAND_NOTEHEAD_WHOLE,
  LELAND_NOTEHEAD_DOUBLE_WHOLE,
  LELAND_SHARP,
  LELAND_FLAT,
  LELAND_NATURAL,
  LELAND_DOUBLE_SHARP,
  LELAND_DOUBLE_FLAT,
  LELAND_AUGMENTATION_DOT,
  LELAND_TIME_SIG,
  LELAND_TIME_SIG_COMMON,
  LELAND_TIME_SIG_CUT_COMMON,
  ENGRAVING,
  smuflFontSize,
  lelandAccidentalGlyph,
  lelandRestGlyph,
  lelandFlagGlyph,
  lelandTimeSigGlyph,
} from './leland'

// Legacy re-exports for any code still using the old API
export { smuflFontSize as clefFontSize }
export { smuflFontSize as accFontSize }
export { smuflFontSize as timeSigFontSize }
export { smuflFontSize as dynamFontSize }
export { lelandAccidentalGlyph as accidentalGlyph }
