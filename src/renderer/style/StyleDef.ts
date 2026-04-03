/**
 * StyleDef.ts — MuseScore Style Constants (Sid) with default values
 *
 * Source: src/engraving/style/styledef.cpp (WebMScore C++)
 * Units note:
 *   - Spatium(x) values are in staff-spaces (sp). Multiply by spatiumPx for pixels.
 *   - Page dimension values stored as inches (mm / INCH where INCH = 25.4).
 *   - DPI = 72 * 5 = 360 (MuseScore internal dots-per-inch)
 *   - Default spatium = 24.8 printer dots = 24.8 / (360/25.4) ≈ 1.75mm
 *
 * Workflow rule: Every constant here was read verbatim from styledef.cpp.
 * DO NOT change values without first verifying in the C++ source.
 */

// ─────────────────────────────────────────────
// MuseScore internal DPI constants
// (mscore.h: DPI = 72.0 * DPI_F where DPI_F = 5)
// ─────────────────────────────────────────────
const MUSESCORE_DPI = 360.0      // 72 * 5
const INCH_MM = 25.4             // 1 inch = 25.4 mm
const DPMM = MUSESCORE_DPI / INCH_MM  // dots per mm ≈ 14.173

/**
 * Convert a MuseScore internal page dimension (stored as mm/INCH = inches)
 * back to millimetres.
 */
export function sidInchToMm(inchValue: number): number {
  return inchValue * INCH_MM
}

/**
 * Convert a MuseScore internal page dimension to spatium units.
 * @param inchValue  raw value from styledef.cpp (e.g. 180.0/25.4 = 7.087)
 * @param spatiumPx  pixels per spatium for this rendering
 * @param screenDpi  screen DPI (default 96 for browser)
 */
export function sidInchToSp(inchValue: number, spatiumPx: number, screenDpi = 96): number {
  const px = inchValue * MUSESCORE_DPI  // printer px
  const screenPx = px * (screenDpi / MUSESCORE_DPI)
  return screenPx / spatiumPx
}

// ─────────────────────────────────────────────
// Sid — Style ID constants with default values (in spatium units unless noted)
//
// Source: styledef.cpp lines 40–650
// Convention: all Sp values are staff-spaces.
// ─────────────────────────────────────────────

export const Sid = {

  // ── Page geometry (stored as inches in C++: mm / 25.4) ──────────────────
  // pageWidth:               210.0 / INCH  (A4 = 8.268 inches)
  // pageHeight:              297.0 / INCH  (A4 = 11.693 inches)
  // pageEvenLeftMargin:      15.0 / INCH
  // pageOddLeftMargin:       15.0 / INCH
  // pageEvenTopMargin:       15.0 / INCH   (all margins = 15mm)
  // pageEvenBottomMargin:    15.0 / INCH
  // pageOddTopMargin:        15.0 / INCH
  // pageOddBottomMargin:     15.0 / INCH

  /** Printable width in mm (A4 minus 15mm margins each side = 180mm) */
  pagePrintableWidthMm: 180.0,        // styledef.cpp:43 — 180.0 / INCH → inches → ×25.4 = 180mm

  // ── Staff / System vertical spacing (Sp) ────────────────────────────────
  staffUpperBorder:       7.0,        // styledef.cpp:52  Spatium(7.0)
  staffLowerBorder:       7.0,        // styledef.cpp:53  Spatium(7.0)
  staffDistance:          6.5,        // styledef.cpp:55  Spatium(6.5) — between staves of different parts
  akkoladeDistance:       6.5,        // styledef.cpp:57  Spatium(6.5) — between staves of same part
  maxAkkoladeDistance:    6.5,        // styledef.cpp:70  Spatium(6.5) — max stretch inside curly bracket
  staffHeaderFooterPadding: 1.0,      // styledef.cpp:54  Spatium(1.0)
  minSystemDistance:      8.5,        // styledef.cpp:58  Spatium(8.5)
  maxSystemDistance:      15.0,       // styledef.cpp:59  Spatium(15.0)
  minVerticalDistance:    0.5,        // styledef.cpp:622 Spatium(0.5)
  maxSystemSpread:        32.0,       // styledef.cpp:67  Spatium(32.0)
  maxStaffSpread:         20.0,       // styledef.cpp:69  Spatium(20.0)
  spreadSystem:           2.5,        // styledef.cpp:63  raw factor — space growth factor between sections
  spreadSquareBracket:    1.2,        // styledef.cpp:64  raw factor — space factor for square bracket group
  spreadCurlyBracket:     1.1,        // styledef.cpp:65  raw factor — space factor for curly bracket group

  // ── Spatium (the base unit) ──────────────────────────────────────────────
  /** Default spatium in MuseScore printer pixels (360 DPI). 1sp = 24.8 / 360 inches ≈ 1.75mm */
  spatiumDefault:         24.8,       // styledef.cpp:624  raw printer dots (360 DPI)

  // ── System layout ────────────────────────────────────────────────────────
  lastSystemFillLimit:    0.3,        // styledef.cpp:228  ratio — don't justify last system if < 30% full
  instrumentNameOffset:   1.0,        // styledef.cpp:56   Spatium(1.0)
  enableIndentationOnFirstSystem: true, // styledef.cpp:447
  firstSystemIndentationValue: 5.0,  // styledef.cpp:449  Spatium(5.0)
  systemFrameDistance:    7.0,        // styledef.cpp:128  Spatium(7.0)
  frameSystemDistance:    7.0,        // styledef.cpp:129  Spatium(7.0)

  // ── Barlines ─────────────────────────────────────────────────────────────
  barWidth:               0.18,       // styledef.cpp:131  Spatium(0.18)
  repeatBarlineDotSeparation: 0.37,   // styledef.cpp:137  Spatium(0.37)

  // ── Staff lines ──────────────────────────────────────────────────────────
  staffLineWidth:         0.11,       // styledef.cpp:196  Spatium(0.11)
  ledgerLineWidth:        0.16,       // styledef.cpp:197  Spatium(0.16)  comment: was 0.1875
  /** ledgerLineLength = notehead width + this value (overhang on each side) */
  ledgerLineLength:       0.33,       // styledef.cpp:198  Spatium(0.33)

  // ── Note / Stem ──────────────────────────────────────────────────────────
  stemWidth:              0.10,       // styledef.cpp:175  Spatium(0.10)
  /** Default stem length in sp (used by Stem::layout()) */
  stemLength:             3.5,        // styledef.cpp:177  PropertyValue(3.5) — for quarter and shorter
  stemLengthSmall:        2.25,       // styledef.cpp:178  PropertyValue(2.25) — for grace notes

  // ── Note spacing ─────────────────────────────────────────────────────────
  minNoteDistance:        0.5,        // styledef.cpp:184  Spatium(0.5) — minimum between noteheads
  barNoteDistance:        1.3,        // styledef.cpp:185  Spatium(1.3) — barline to first note (was 1.2)
  noteBarDistance:        1.5,        // styledef.cpp:188  Spatium(1.5) — last note to barline
  measureSpacing:         1.5,        // styledef.cpp:189  raw multiplier (not Sp) — logarithmic stretch factor

  // ── Dots ─────────────────────────────────────────────────────────────────
  dotNoteDistance:        0.5,        // styledef.cpp:216  Spatium(0.5) — note to augmentation dot
  dotDotDistance:         0.65,       // styledef.cpp:218  Spatium(0.65) — dot to dot (double-dotted)
  dotMag:                 1.0,        // styledef.cpp:215  PropertyValue(1.0) — dot size multiplier

  // ── Accidentals ──────────────────────────────────────────────────────────
  accidentalDistance:     0.22,       // styledef.cpp:202  Spatium(0.22) — accidental to accidental
  accidentalNoteDistance: 0.25,       // styledef.cpp:203  Spatium(0.25) — accidental to notehead

  // ── Beams ─────────────────────────────────────────────────────────────────
  beamWidth:              0.5,        // styledef.cpp:209  Spatium(0.5)  (comment: was 0.48)
  beamMinLen:             1.1,        // styledef.cpp:211  Spatium(1.1)  — minimum beam length
  beamNoSlope:            false,      // styledef.cpp:212  — force flat beams
  useWideBeams:           false,      // styledef.cpp:210  — use 4-quarter-space beam spacing instead of 3

  // ── Grace / Small notes ──────────────────────────────────────────────────
  smallNoteMag:           0.7,        // styledef.cpp:399  PropertyValue(0.7) — cue/small note magnification
  graceNoteMag:           0.7,        // styledef.cpp:400  PropertyValue(0.7) — grace note magnification

  // ── Clef / Key / Time signature spacing ──────────────────────────────────
  clefBarlineDistance:    0.5,        // styledef.cpp:172  Spatium(0.5)
  timesigBarlineDistance: 0.5,        // styledef.cpp:173  Spatium(0.5)
  keysigAccidentalDistance: 0.3,      // styledef.cpp:206  Spatium(0.3)

} as const

export type SidKey = keyof typeof Sid

/**
 * Returns the printable width in spatium units for a given spatiumPx.
 * This is the C++ `targetSystemWidth = score()->styleD(Sid::pagePrintableWidth) * DPI`
 * translated to our unit system.
 *
 * @param spatiumPx  pixels per spatium for this rendering
 * @param screenDpi  screen DPI (default 96)
 */
export function getPagePrintableWidthSp(spatiumPx: number, screenDpi = 96): number {
  // pagePrintableWidthMm = 180mm
  // → printer px = 180 * (360/25.4) ≈ 2551.2
  // → screen px  = printerPx * (screenDpi / 360)
  // → sp         = screenPx / spatiumPx
  const printerPx = Sid.pagePrintableWidthMm * DPMM
  const screenPx = printerPx * (screenDpi / MUSESCORE_DPI)
  return screenPx / spatiumPx
}
