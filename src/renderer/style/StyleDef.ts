/**
 * StyleDef.ts — MuseScore Style System (Sid)
 *
 * Source: src/engraving/style/styledef.cpp (WebMScore C++)
 * Units note:
 *   - SPATIUM values are in staff-spaces (sp). Multiply by spatiumPx for pixels.
 *   - Page dimension values stored as inches (mm / INCH where INCH = 25.4).
 *   - DPI = 72 * 5 = 360 (MuseScore internal dots-per-inch)
 *   - Default spatium = 24.8 printer dots = 24.8 / (360/25.4) ≈ 1.75mm
 *
 * Architecture:
 *   ScoreStyle — per-score configurable style with typed accessors
 *   Sid — backward-compatible proxy to defaultStyle singleton
 *
 * Workflow rule: Every constant here was read verbatim from styledef.cpp.
 * DO NOT change values without first verifying in the C++ source.
 */

// ─────────────────────────────────────────────
// MuseScore internal DPI constants
// ─────────────────────────────────────────────
const MUSESCORE_DPI = 360.0      // 72 * 5
const INCH_MM = 25.4
const DPMM = MUSESCORE_DPI / INCH_MM  // dots per mm ≈ 14.173

// ─────────────────────────────────────────────
// Sid value types
// ─────────────────────────────────────────────
export enum SidType {
  DOUBLE = 'double',
  BOOL = 'bool',
  STRING = 'string',
  SPATIUM = 'spatium',  // stored in staff-spaces, precomputeValues() converts to px
}

interface SidDef {
  type: SidType
  defaultValue: number | boolean | string
}

// ─────────────────────────────────────────────
// All Sid definitions with C++ default values
// Source: styledef.cpp lines 40–650
// ─────────────────────────────────────────────
const SID_DEFS: Record<string, SidDef> = {

  // ── Page geometry (stored as inches in C++: mm / 25.4) ──
  pageWidth:                    { type: SidType.DOUBLE, defaultValue: 210.0 / INCH_MM },
  pageHeight:                   { type: SidType.DOUBLE, defaultValue: 297.0 / INCH_MM },
  pagePrintableWidthMm:         { type: SidType.DOUBLE, defaultValue: 180.0 },
  pageEvenLeftMargin:           { type: SidType.DOUBLE, defaultValue: 15.0 / INCH_MM },
  pageOddLeftMargin:            { type: SidType.DOUBLE, defaultValue: 15.0 / INCH_MM },
  pageEvenTopMargin:            { type: SidType.DOUBLE, defaultValue: 15.0 / INCH_MM },
  pageEvenBottomMargin:         { type: SidType.DOUBLE, defaultValue: 15.0 / INCH_MM },
  pageOddTopMargin:             { type: SidType.DOUBLE, defaultValue: 15.0 / INCH_MM },
  pageOddBottomMargin:          { type: SidType.DOUBLE, defaultValue: 15.0 / INCH_MM },
  pageTwosided:                 { type: SidType.BOOL, defaultValue: true },

  // ── Staff / System vertical spacing (Sp) ──
  staffUpperBorder:             { type: SidType.SPATIUM, defaultValue: 7.0 },
  staffLowerBorder:             { type: SidType.SPATIUM, defaultValue: 7.0 },
  staffDistance:                 { type: SidType.SPATIUM, defaultValue: 6.5 },
  akkoladeDistance:              { type: SidType.SPATIUM, defaultValue: 6.5 },
  maxAkkoladeDistance:           { type: SidType.SPATIUM, defaultValue: 6.5 },
  staffHeaderFooterPadding:     { type: SidType.SPATIUM, defaultValue: 1.0 },
  minSystemDistance:             { type: SidType.SPATIUM, defaultValue: 8.5 },
  maxSystemDistance:             { type: SidType.SPATIUM, defaultValue: 15.0 },
  minVerticalDistance:           { type: SidType.SPATIUM, defaultValue: 0.5 },
  maxSystemSpread:               { type: SidType.SPATIUM, defaultValue: 32.0 },
  maxStaffSpread:                { type: SidType.SPATIUM, defaultValue: 20.0 },
  spreadSystem:                  { type: SidType.DOUBLE, defaultValue: 2.5 },
  spreadSquareBracket:           { type: SidType.DOUBLE, defaultValue: 1.2 },
  spreadCurlyBracket:            { type: SidType.DOUBLE, defaultValue: 1.1 },

  // ── Spatium (the base unit) ──
  spatiumDefault:               { type: SidType.DOUBLE, defaultValue: 24.8 },

  // ── System layout ──
  lastSystemFillLimit:           { type: SidType.DOUBLE, defaultValue: 0.3 },
  instrumentNameOffset:          { type: SidType.SPATIUM, defaultValue: 1.0 },
  enableIndentationOnFirstSystem: { type: SidType.BOOL, defaultValue: true },
  firstSystemIndentationValue:   { type: SidType.SPATIUM, defaultValue: 5.0 },
  systemFrameDistance:           { type: SidType.SPATIUM, defaultValue: 7.0 },
  frameSystemDistance:           { type: SidType.SPATIUM, defaultValue: 7.0 },
  systemHeaderDistance:          { type: SidType.SPATIUM, defaultValue: 2.5 },
  systemHeaderTimeSigDistance:   { type: SidType.SPATIUM, defaultValue: 2.0 },

  // ── Barlines ──
  barWidth:                      { type: SidType.SPATIUM, defaultValue: 0.18 },
  doubleBarWidth:                { type: SidType.SPATIUM, defaultValue: 0.18 },
  endBarWidth:                   { type: SidType.SPATIUM, defaultValue: 0.55 },
  doubleBarDistance:              { type: SidType.SPATIUM, defaultValue: 0.37 },
  endBarDistance:                 { type: SidType.SPATIUM, defaultValue: 0.37 },
  repeatBarlineDotSeparation:    { type: SidType.SPATIUM, defaultValue: 0.37 },
  startBarlineSingle:            { type: SidType.BOOL, defaultValue: false },
  startBarlineMultiple:          { type: SidType.BOOL, defaultValue: true },

  // ── Staff lines ──
  staffLineWidth:                { type: SidType.SPATIUM, defaultValue: 0.11 },
  ledgerLineWidth:               { type: SidType.SPATIUM, defaultValue: 0.16 },
  ledgerLineLength:              { type: SidType.SPATIUM, defaultValue: 0.33 },

  // ── Note / Stem ──
  stemWidth:                     { type: SidType.SPATIUM, defaultValue: 0.10 },
  stemLength:                    { type: SidType.DOUBLE, defaultValue: 3.5 },
  stemLengthSmall:               { type: SidType.DOUBLE, defaultValue: 2.25 },

  // ── Note spacing ──
  minNoteDistance:                { type: SidType.SPATIUM, defaultValue: 0.5 },
  barNoteDistance:                { type: SidType.SPATIUM, defaultValue: 1.3 },
  barAccidentalDistance:          { type: SidType.SPATIUM, defaultValue: 0.65 },
  noteBarDistance:                { type: SidType.SPATIUM, defaultValue: 1.5 },
  measureSpacing:                 { type: SidType.DOUBLE, defaultValue: 1.5 },
  minMeasureWidth:               { type: SidType.SPATIUM, defaultValue: 8.0 },
  minMMRestWidth:                { type: SidType.SPATIUM, defaultValue: 4.0 },

  // ── Dots ──
  dotNoteDistance:                { type: SidType.SPATIUM, defaultValue: 0.5 },
  dotDotDistance:                 { type: SidType.SPATIUM, defaultValue: 0.65 },
  dotMag:                         { type: SidType.DOUBLE, defaultValue: 1.0 },

  // ── Accidentals ──
  accidentalDistance:             { type: SidType.SPATIUM, defaultValue: 0.22 },
  accidentalNoteDistance:         { type: SidType.SPATIUM, defaultValue: 0.25 },

  // ── Beams ──
  beamWidth:                     { type: SidType.SPATIUM, defaultValue: 0.5 },
  beamMinLen:                    { type: SidType.SPATIUM, defaultValue: 1.1 },
  beamNoSlope:                   { type: SidType.BOOL, defaultValue: false },
  useWideBeams:                  { type: SidType.BOOL, defaultValue: false },

  // ── Grace / Small notes ──
  smallNoteMag:                  { type: SidType.DOUBLE, defaultValue: 0.7 },
  graceNoteMag:                  { type: SidType.DOUBLE, defaultValue: 0.7 },

  // ── Clef / Key / Time signature spacing ──
  clefBarlineDistance:            { type: SidType.SPATIUM, defaultValue: 0.5 },
  timesigBarlineDistance:         { type: SidType.SPATIUM, defaultValue: 0.5 },
  keysigAccidentalDistance:       { type: SidType.SPATIUM, defaultValue: 0.3 },
  clefKeyDistance:                { type: SidType.SPATIUM, defaultValue: 1.0 },
  clefTimesigDistance:            { type: SidType.SPATIUM, defaultValue: 1.0 },
  keyTimesigDistance:             { type: SidType.SPATIUM, defaultValue: 1.0 },
  keyBarlineDistance:             { type: SidType.SPATIUM, defaultValue: 1.0 },
  clefKeyRightMargin:            { type: SidType.SPATIUM, defaultValue: 0.8 },
  systemTrailerRightMargin:      { type: SidType.SPATIUM, defaultValue: 0.5 },
  headerSlurTieDistance:         { type: SidType.SPATIUM, defaultValue: 1.0 },
  genClef:                        { type: SidType.BOOL, defaultValue: true },
  genKeysig:                      { type: SidType.BOOL, defaultValue: true },
  genTimesig:                     { type: SidType.BOOL, defaultValue: true },

  // ── Multi-measure rest ──
  minEmptyMeasures:              { type: SidType.DOUBLE, defaultValue: 2 },
  multiMeasureRestMargin:        { type: SidType.SPATIUM, defaultValue: 1.2 },
  createMultiMeasureRests:       { type: SidType.BOOL, defaultValue: false },

  // ── Chord layout ──
  maxChordShiftAbove:            { type: SidType.SPATIUM, defaultValue: 0.0 },
  maxChordShiftBelow:            { type: SidType.SPATIUM, defaultValue: 0.0 },
  maxFretShiftAbove:             { type: SidType.SPATIUM, defaultValue: 0.0 },
  maxFretShiftBelow:             { type: SidType.SPATIUM, defaultValue: 0.0 },

  // ── Autoplace ──
  autoplaceVerticalAlignRange:   { type: SidType.DOUBLE, defaultValue: 0 },

  // ── Slur / Tie ──
  slurEndWidth:                  { type: SidType.SPATIUM, defaultValue: 0.07 },
  slurMidWidth:                  { type: SidType.SPATIUM, defaultValue: 0.21 },
  slurDottedWidth:               { type: SidType.SPATIUM, defaultValue: 0.10 },
  slurMinDistance:               { type: SidType.SPATIUM, defaultValue: 0.5 },
  tieEndWidth:                   { type: SidType.SPATIUM, defaultValue: 0.07 },
  tieMidWidth:                   { type: SidType.SPATIUM, defaultValue: 0.21 },
  tieMinDistance:                { type: SidType.SPATIUM, defaultValue: 0.5 },

  // ── Hairpin / Dynamic ──
  hairpinLineWidth:              { type: SidType.SPATIUM, defaultValue: 0.12 },
  hairpinHeight:                 { type: SidType.SPATIUM, defaultValue: 1.2 },
  hairpinContHeight:             { type: SidType.SPATIUM, defaultValue: 0.5 },
  hairpinPlacement:              { type: SidType.DOUBLE, defaultValue: 1 },  // 1 = below
  dynamicsMinDistance:           { type: SidType.SPATIUM, defaultValue: 0.5 },
  dynamicsPlacement:             { type: SidType.DOUBLE, defaultValue: 1 },  // 1 = below

  // ── Tuplet ──
  tupletBracketWidth:            { type: SidType.SPATIUM, defaultValue: 0.1 },
  tupletDirection:               { type: SidType.DOUBLE, defaultValue: 0 },  // 0 = auto
  tupletNumberType:              { type: SidType.DOUBLE, defaultValue: 0 },  // 0 = show number
  tupletBracketType:             { type: SidType.DOUBLE, defaultValue: 0 },  // 0 = auto

  // ── Articulation ──
  articulationMinDistance:       { type: SidType.SPATIUM, defaultValue: 0.5 },

  // ── Ottava ──
  ottavaLineWidth:               { type: SidType.SPATIUM, defaultValue: 0.11 },
  ottavaPlacement:               { type: SidType.DOUBLE, defaultValue: 0 },  // 0 = above

  // ── Lyrics ──
  lyricsMinTopDistance:          { type: SidType.SPATIUM, defaultValue: 1.0 },
  lyricsMinBottomDistance:       { type: SidType.SPATIUM, defaultValue: 2.0 },
  lyricsLineHeight:              { type: SidType.DOUBLE, defaultValue: 1.0 },
  lyricsPlacement:               { type: SidType.DOUBLE, defaultValue: 1 },  // 1 = below

  // ── Figured bass ──
  figuredBassLineHeight:         { type: SidType.DOUBLE, defaultValue: 1.0 },

  // ── TAB ──
  tabMinimumFretDistance:        { type: SidType.SPATIUM, defaultValue: 0.5 },

  // ── Bracket / Brace ──
  bracketWidth:                  { type: SidType.SPATIUM, defaultValue: 0.44 },
  bracketDistance:               { type: SidType.SPATIUM, defaultValue: 0.5 },

  // ── Rest vertical offset ──
  restOffset:                    { type: SidType.DOUBLE, defaultValue: 0 },
}

// ─────────────────────────────────────────────
// ScoreStyle class — per-score configurable style
// ─────────────────────────────────────────────

export class ScoreStyle {
  private values: Map<string, number | boolean | string>
  private precomputed: Map<string, number> | null = null
  private _spatiumPx: number = 0

  constructor() {
    this.values = new Map()
    for (const [key, def] of Object.entries(SID_DEFS)) {
      this.values.set(key, def.defaultValue)
    }
  }

  /** Get any style value by key */
  style(key: string): number | boolean | string {
    const v = this.values.get(key)
    if (v === undefined) throw new Error(`ScoreStyle: unknown Sid '${key}'`)
    return v
  }

  /** Get numeric style value (throws if not found) */
  styleD(key: string): number {
    const v = this.style(key)
    return v as number
  }

  /** Get boolean style value */
  styleB(key: string): boolean {
    const v = this.style(key)
    return v as boolean
  }

  /** Get string style value */
  styleS(key: string): string {
    const v = this.style(key)
    return v as string
  }

  /** Override a value for this score */
  set(key: string, value: number | boolean | string): void {
    if (!SID_DEFS[key]) throw new Error(`ScoreStyle: unknown Sid '${key}'`)
    this.values.set(key, value)
  }

  /** Reset one key to default */
  resetToDefault(key: string): void {
    const def = SID_DEFS[key]
    if (!def) throw new Error(`ScoreStyle: unknown Sid '${key}'`)
    this.values.set(key, def.defaultValue)
  }

  /** Convert SPATIUM-typed Sids to pixels and cache */
  precomputeValues(spatiumPx: number): void {
    this._spatiumPx = spatiumPx
    this.precomputed = new Map()
    for (const [key, def] of Object.entries(SID_DEFS)) {
      if (def.type === SidType.SPATIUM) {
        const sp = this.values.get(key) as number
        this.precomputed.set(key, sp * spatiumPx)
      }
    }
  }

  /** Get precomputed pixel value for SPATIUM-type Sids */
  stylePx(key: string): number {
    if (!this.precomputed) throw new Error('ScoreStyle: call precomputeValues() first')
    const px = this.precomputed.get(key)
    if (px === undefined) throw new Error(`ScoreStyle: '${key}' is not a SPATIUM-type Sid`)
    return px
  }

  /** Override Sids from font engraving defaults */
  loadEngravingDefaults(fontName: string): void {
    const defaults = FONT_ENGRAVING_DEFAULTS[fontName]
    if (!defaults) return
    for (const [sidKey, value] of Object.entries(defaults)) {
      if (this.values.has(sidKey)) {
        this.values.set(sidKey, value)
      }
    }
    if (this._spatiumPx > 0) {
      this.precomputeValues(this._spatiumPx)
    }
  }

  /** Number of defined Sid keys */
  get sidCount(): number {
    return this.values.size
  }

  /** Check if a key exists */
  has(key: string): boolean {
    return this.values.has(key)
  }
}

// ─────────────────────────────────────────────
// Font engraving defaults
// Source: leland.ts ENGRAVING const
// ─────────────────────────────────────────────

const FONT_ENGRAVING_DEFAULTS: Record<string, Record<string, number>> = {
  Leland: {
    staffLineWidth:             0.11,
    stemWidth:                  0.10,
    beamWidth:                  0.50,
    ledgerLineWidth:            0.16,
    ledgerLineLength:           0.35,
    barWidth:                   0.18,
    endBarWidth:                0.55,
    doubleBarWidth:             0.18,
    doubleBarDistance:           0.37,
    endBarDistance:              0.37,
    repeatBarlineDotSeparation: 0.37,
    slurEndWidth:               0.07,
    slurMidWidth:               0.21,
    tieEndWidth:                0.07,
    tieMidWidth:                0.21,
    tupletBracketWidth:         0.10,
  },
}

// ─────────────────────────────────────────────
// Default singleton
// ─────────────────────────────────────────────

export const defaultStyle = new ScoreStyle()

// ─────────────────────────────────────────────
// Backward-compatible Sid proxy
// Existing code: Sid.staffDistance → defaultStyle.style('staffDistance')
// ─────────────────────────────────────────────

export const Sid: Record<string, any> = new Proxy({} as Record<string, any>, {
  get(_target, prop: string | symbol) {
    if (typeof prop === 'symbol') return undefined
    if (prop === 'toString' || prop === 'valueOf' || prop === 'toJSON') return undefined
    if (!defaultStyle.has(prop)) return undefined
    return defaultStyle.style(prop)
  },
})

export type SidKey = string

// ─────────────────────────────────────────────
// Exported Sid metadata (for testing / introspection)
// ─────────────────────────────────────────────

export function getSidDefs(): Record<string, SidDef> {
  return SID_DEFS
}

export { SidType as SidValueType }

// ─────────────────────────────────────────────
// Utility functions (backward compat)
// ─────────────────────────────────────────────

export function sidInchToMm(inchValue: number): number {
  return inchValue * INCH_MM
}

export function sidInchToSp(inchValue: number, spatiumPx: number, screenDpi = 96): number {
  const px = inchValue * MUSESCORE_DPI
  const screenPx = px * (screenDpi / MUSESCORE_DPI)
  return screenPx / spatiumPx
}

export function getPagePrintableWidthSp(spatiumPx: number, screenDpi = 96): number {
  const printerPx = (defaultStyle.styleD('pagePrintableWidthMm')) * DPMM
  const screenPx = printerPx * (screenDpi / MUSESCORE_DPI)
  return screenPx / spatiumPx
}
