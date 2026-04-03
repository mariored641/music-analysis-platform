/**
 * Painter.ts — Abstract Painter interface
 *
 * Separates layout logic from physical drawing.
 * The layout engine calls Painter methods with pixel coordinates.
 * SVGPainter implements this for SVG output.
 * Future: CanvasPainter, WebGLPainter, PDFPainter without changing layout code.
 */

import type { Px } from '../spatium'

// ---------------------------------------------------------------------------
// ElementMetadata — connects graphic elements to musical data
// ---------------------------------------------------------------------------

export type ElementType =
  | 'note'
  | 'rest'
  | 'measure'
  | 'barline'
  | 'clef'
  | 'keysig'
  | 'timesig'
  | 'beam'
  | 'tie'
  | 'slur'
  | 'dynamic'
  | 'hairpin'
  | 'chord-symbol'
  | 'tuplet'
  | 'articulation'
  | 'ledger'
  | 'staff'
  | 'system'
  | 'page'
  | 'title'
  | 'tempo'
  | 'rehearsal'
  | 'volta'
  | 'grace-note'

export interface ElementMetadata {
  /** Element type for hit-testing and annotation overlay dispatch */
  type: ElementType

  /** 1-based measure number */
  measureNum: number

  /** 0-based staff index */
  staffIndex: number

  /**
   * Fractional beat within measure (1.0 = beat 1).
   * Used for chord lookup and annotation placement.
   */
  beat?: number

  /**
   * Stable noteMap ID, e.g. "note-m4b300-E5".
   * Always set for notes and rests.
   * Used by annotation system and selection store.
   */
  noteId?: string

  /** 1-based voice number */
  voice?: number
}

// ---------------------------------------------------------------------------
// Painter interface
// ---------------------------------------------------------------------------

export interface Painter {
  /**
   * Draw an SMuFL glyph (Unicode character from a music font).
   * @param x         Left edge of glyph bounding box in pixels
   * @param y         Baseline of glyph in pixels
   * @param codepoint Unicode codepoint string, e.g. "\uE0A4" or "&#xE0A4;"
   * @param fontSize  Font size in pixels (SMuFL convention: 4 × spatium)
   * @param color     Fill color, default '#1a1a1a'
   */
  drawGlyph(
    x: Px,
    y: Px,
    codepoint: string,
    fontSize: Px,
    color?: string,
  ): void

  /**
   * Draw a straight line.
   * @param x1, y1    Start point in pixels
   * @param x2, y2    End point in pixels
   * @param strokeWidth  Line width in pixels
   * @param color     Stroke color, default '#1a1a1a'
   */
  drawLine(
    x1: Px,
    y1: Px,
    x2: Px,
    y2: Px,
    strokeWidth: Px,
    color?: string,
  ): void

  /**
   * Draw a filled path (for beams, ties, slurs, note flags).
   * @param d     SVG path data string
   * @param fill  Fill color
   */
  drawFilledPath(d: string, fill: string): void

  /**
   * Draw text (titles, lyrics, measure numbers, dynamics).
   * @param x          X position in pixels
   * @param y          Baseline Y position in pixels
   * @param text       Text content
   * @param fontFamily CSS font-family string
   * @param fontSize   Font size in pixels
   * @param anchor     Text alignment: 'start' | 'middle' | 'end' (default 'start')
   * @param color      Text color, default '#1a1a1a'
   */
  drawText(
    x: Px,
    y: Px,
    text: string,
    fontFamily: string,
    fontSize: Px,
    anchor?: 'start' | 'middle' | 'end',
    color?: string,
  ): void

  /**
   * Begin a named group with musical metadata.
   * All subsequent draw calls belong to this group until endGroup().
   * Groups nest. Used for hit-testing and annotation overlay.
   *
   * @param id    Unique ID for this element (e.g. noteId, "measure-5", "beam-3")
   * @param meta  Musical metadata for the group
   */
  beginGroup(id: string, meta: ElementMetadata): void

  /** Close the current group. */
  endGroup(): void

  /**
   * Set the viewport dimensions for the current page.
   * Must be called once per page before any draw calls.
   */
  setViewport(width: Px, height: Px): void

  /**
   * Finalize and return the complete output for the current page.
   * For SVGPainter: returns an SVG string.
   * Resets internal state for the next page.
   */
  getOutput(): string
}
