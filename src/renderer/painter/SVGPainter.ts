/**
 * SVGPainter.ts — SVG implementation of the Painter interface
 *
 * Builds an SVG string element by element.
 * All coordinates arrive as pixels (conversion from Sp done before calling).
 *
 * Groups become <g> elements with data attributes for hit-testing:
 *   data-type="note"
 *   data-measure="4"
 *   data-staff="0"
 *   data-note-id="note-m4b300-E5"
 *   data-beat="3"
 *   data-voice="1"
 */

import type { Px } from '../spatium'
import type { ElementMetadata, Painter } from './Painter'

const DEFAULT_COLOR = '#1a1a1a'

export class SVGPainter implements Painter {
  private parts: string[] = []
  private width = 0
  private height = 0
  private groupDepth = 0

  // -------------------------------------------------------------------
  // Viewport
  // -------------------------------------------------------------------

  setViewport(width: Px, height: Px): void {
    this.width = width
    this.height = height
  }

  // -------------------------------------------------------------------
  // Groups
  // -------------------------------------------------------------------

  beginGroup(id: string, meta: ElementMetadata): void {
    const attrs: string[] = [`id="${escapeAttr(id)}"`]
    attrs.push(`data-type="${meta.type}"`)
    attrs.push(`data-measure="${meta.measureNum}"`)
    attrs.push(`data-staff="${meta.staffIndex}"`)
    if (meta.noteId)  attrs.push(`data-note-id="${escapeAttr(meta.noteId)}"`)
    if (meta.beat !== undefined) attrs.push(`data-beat="${meta.beat}"`)
    if (meta.voice !== undefined) attrs.push(`data-voice="${meta.voice}"`)

    this.parts.push(`<g ${attrs.join(' ')}>`)
    this.groupDepth++
  }

  endGroup(): void {
    this.parts.push('</g>')
    this.groupDepth--
  }

  // -------------------------------------------------------------------
  // Primitives
  // -------------------------------------------------------------------

  drawGlyph(x: Px, y: Px, codepoint: string, fontSize: Px, color?: string): void {
    const fill = color ?? DEFAULT_COLOR
    const cp = codepointToChar(codepoint)
    // text-anchor=start so x is the left edge of the glyph
    this.parts.push(
      `<text x="${r(x)}" y="${r(y)}" ` +
      `font-family="Leland" font-size="${r(fontSize)}" ` +
      `fill="${fill}" text-anchor="start" dominant-baseline="auto"` +
      `>${cp}</text>`
    )
  }

  drawLine(x1: Px, y1: Px, x2: Px, y2: Px, strokeWidth: Px, color?: string): void {
    const stroke = color ?? DEFAULT_COLOR
    this.parts.push(
      `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" ` +
      `stroke="${stroke}" stroke-width="${r(strokeWidth)}" stroke-linecap="round"/>`
    )
  }

  drawFilledPath(d: string, fill: string): void {
    this.parts.push(`<path d="${d}" fill="${fill}"/>`)
  }

  drawText(
    x: Px,
    y: Px,
    text: string,
    fontFamily: string,
    fontSize: Px,
    anchor: 'start' | 'middle' | 'end' = 'start',
    color?: string,
  ): void {
    const fill = color ?? DEFAULT_COLOR
    const escaped = escapeText(text)
    this.parts.push(
      `<text x="${r(x)}" y="${r(y)}" ` +
      `font-family="${escapeAttr(fontFamily)}" font-size="${r(fontSize)}" ` +
      `fill="${fill}" text-anchor="${anchor}"` +
      `>${escaped}</text>`
    )
  }

  // -------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------

  getOutput(): string {
    // Close any unclosed groups (safety net)
    while (this.groupDepth > 0) {
      this.parts.push('</g>')
      this.groupDepth--
    }

    const body = this.parts.join('\n')

    // Reset for next page
    this.parts = []
    this.groupDepth = 0

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${this.width}" height="${this.height}" ` +
      `viewBox="0 0 ${this.width} ${this.height}">\n` +
      body + '\n' +
      `</svg>`
    )
  }

  /**
   * Prepend font-face declarations to the SVG.
   * Call this before getOutput() on the first page only.
   */
  prependFontFaces(fontFaceCSS: string): void {
    this.parts.unshift(`<defs><style>${fontFaceCSS}</style></defs>`)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2 decimal places for compact SVG */
function r(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

/** Escape XML attribute value */
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Escape XML text content */
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Convert a codepoint to the actual Unicode character.
 * Accepts: "\uE0A4", "&#xE0A4;", "E0A4" (hex string), or already a char.
 */
function codepointToChar(cp: string): string {
  // Already a single char (or multi-char glyph sequence)
  if (!cp.startsWith('&#') && !cp.startsWith('\\u') && cp.length <= 2) return escapeText(cp)
  // &#xE0A4; form
  if (cp.startsWith('&#x') && cp.endsWith(';')) {
    const hex = cp.slice(3, -1)
    return String.fromCodePoint(parseInt(hex, 16))
  }
  // \uE0A4 form
  if (cp.startsWith('\\u')) {
    return String.fromCodePoint(parseInt(cp.slice(2), 16))
  }
  // Raw hex string "E0A4"
  if (/^[0-9A-Fa-f]{4,6}$/.test(cp)) {
    return String.fromCodePoint(parseInt(cp, 16))
  }
  return escapeText(cp)
}
