/**
 * MAP Native Renderer — SVG Renderer (Leland SMuFL edition)
 *
 * Converts a RenderedScore (from verticalLayout.ts) into an SVG string.
 * All musical symbols are rendered using the Leland SMuFL font.
 * Line thicknesses use Leland's engravingDefaults (staff-space units).
 *
 * Key design:
 *  - Every <g class="note"> gets id = noteMapId (stable, not ephemeral)
 *  - Font: Leland.woff2 (notation) + Edwin-Roman.woff2 (text/chords)
 *  - SVG contains inline @font-face so it renders correctly without external CSS
 *  - All glyph sizes: font-size = 4 * spatium (SMuFL convention)
 *  - Notehead y anchor = note center (SMuFL baseline = notehead center)
 */

import type {
  RenderedScore,
  RenderedPage,
  RenderedSystem,
  RenderedMeasure,
  RenderedNote,
  RenderedBeam,
  RenderedBarline,
  RenderedChordSymbol,
  RenderedTie,
  RenderedTuplet,
  RenderedKeySignature,
  RenderedTimeSignature,
  RenderedClefSymbol,
  RenderOptions,
} from './types'
import {
  LELAND_FONT,
  EDWIN_FONT,
  LELAND_G_CLEF,
  LELAND_F_CLEF,
  LELAND_C_CLEF,
  LELAND_NOTEHEAD_BLACK,
  LELAND_NOTEHEAD_HALF,
  LELAND_NOTEHEAD_WHOLE,
  LELAND_SHARP,
  LELAND_FLAT,
  LELAND_TIME_SIG,
  ENGRAVING,
  smuflFontSize,
  lelandAccidentalGlyph,
  lelandRestGlyph,
  lelandFlagGlyph,
  lelandTimeSigGlyph,
} from './glyphs/leland'
import { DEFAULT_RENDER_OPTIONS } from './horizontalLayout'

// ─── Colors ──────────────────────────────────────────────────────────────────
const INK = '#1a1a1a'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function n(x: number, d = 1): string { return x.toFixed(d) }

// ─── @font-face defs for self-contained SVG ───────────────────────────────────
function renderFontDefs(): string {
  return `<defs>
<style>
@font-face {
  font-family: 'Leland';
  src: url('/fonts/Leland.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'Bravura';
  src: url('/fonts/Bravura.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'Edwin';
  src: url('/fonts/Edwin-Roman.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'Edwin';
  src: url('/fonts/Edwin-Italic.woff2') format('woff2');
  font-weight: normal;
  font-style: italic;
}
</style>
</defs>`
}

// ─── Staff lines ──────────────────────────────────────────────────────────────
function renderStaffLines(system: RenderedSystem, sp: number): string {
  const lw = Math.max(1, ENGRAVING.staffLineThickness * sp)
  const parts: string[] = []
  for (const staff of system.staves) {
    for (let i = 0; i < 5; i++) {
      const y = staff.lineYs[i]
      parts.push(`<line x1="${n(system.x)}" y1="${n(y)}" x2="${n(system.x + system.width)}" y2="${n(y)}" stroke="${INK}" stroke-width="${n(lw, 2)}"/>`)
    }
  }
  return parts.join('\n')
}

// ─── Clef ─────────────────────────────────────────────────────────────────────
function renderClef(clef: RenderedClefSymbol, sp: number): string {
  const fs = smuflFontSize(sp)
  // Anchor positions (SMuFL convention, in staff-spaces from staff top):
  //   G clef: anchor at G line = staffTop + 3*sp (3rd line from top, 2nd from bottom)
  //   F clef: anchor at F line = staffTop + sp   (2nd line from top, 4th from bottom)
  //   C clef: anchor at middle line = staffTop + 2*sp
  const staffTop = clef.y  // clef.y = staffTop
  let glyph: string
  let yAnchor: number

  if (clef.clef === 'treble') {
    glyph   = LELAND_G_CLEF
    // SMuFL: gClef anchor is on the G line = 3rd line from top = staffTop + 3*sp (wait - depends on convention)
    // In Leland, the gClef glyph's baseline sits on the G line (2nd line from bottom = staffTop + 3*sp)
    yAnchor = staffTop + sp * 3
  } else if (clef.clef === 'bass') {
    glyph   = LELAND_F_CLEF
    // F clef anchor: 2nd line from top (4th from bottom) = staffTop + sp
    yAnchor = staffTop + sp * 1
  } else {
    glyph   = LELAND_C_CLEF
    yAnchor = staffTop + sp * 2
  }

  return `<text x="${n(clef.x)}" y="${n(yAnchor)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}" class="map-clef">${glyph}</text>`
}

// ─── Key signature ────────────────────────────────────────────────────────────
function renderKeySig(ks: RenderedKeySignature, sp: number): string {
  if (ks.fifths === 0) return ''
  const glyph = ks.fifths > 0 ? LELAND_SHARP : LELAND_FLAT
  const fs    = smuflFontSize(sp)
  // Accidental anchor: SMuFL baseline = center of accidental glyph
  // The layout computes acc.y as the note-center y for each accidental position
  return ks.accidentals.map(acc =>
    `<text x="${n(acc.x)}" y="${n(acc.y)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${glyph}</text>`
  ).join('\n')
}

// ─── Time signature ───────────────────────────────────────────────────────────
function renderTimeSig(ts: RenderedTimeSignature, sp: number): string {
  const fs  = smuflFontSize(sp)
  const cx  = ts.x
  // SMuFL time sig digits: each digit occupies 2 staff spaces
  // Top digit center at staff space 1 (staffTop + sp), bottom at space 3 (staffTop + 3*sp)
  // ts.yNumerator / ts.yDenominator are already computed by layout as note-center y's
  const topGlyph = lelandTimeSigGlyph(ts.beats)
  const botGlyph = lelandTimeSigGlyph(ts.beatType)
  return [
    `<text x="${n(cx)}" y="${n(ts.yNumerator)}" text-anchor="middle" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${topGlyph}</text>`,
    `<text x="${n(cx)}" y="${n(ts.yDenominator)}" text-anchor="middle" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${botGlyph}</text>`,
  ].join('\n')
}

// ─── Barline ──────────────────────────────────────────────────────────────────
function renderBarline(bl: RenderedBarline, sp: number): string {
  const thin  = Math.max(1, ENGRAVING.thinBarlineThickness  * sp)
  const thick = ENGRAVING.thickBarlineThickness * sp
  const dotR  = sp * 0.25
  const parts: string[] = []
  const { x, yTop, yBottom, type } = bl

  switch (type) {
    case 'regular':
      parts.push(`<line x1="${n(x)}" y1="${n(yTop)}" x2="${n(x)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(thin, 2)}"/>`)
      break

    case 'double': {
      const sep = ENGRAVING.barlineSeparation * sp
      parts.push(`<line x1="${n(x)}"       y1="${n(yTop)}" x2="${n(x)}"       y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(thin, 2)}"/>`)
      parts.push(`<line x1="${n(x + sep)}" y1="${n(yTop)}" x2="${n(x + sep)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(thin, 2)}"/>`)
      break
    }

    case 'final': {
      const gap = ENGRAVING.barlineSeparation * sp
      parts.push(`<line x1="${n(x - gap - thick / 2)}" y1="${n(yTop)}" x2="${n(x - gap - thick / 2)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(thin, 2)}"/>`)
      parts.push(`<rect x="${n(x - thick)}" y="${n(yTop)}" width="${n(thick)}" height="${n(yBottom - yTop)}" fill="${INK}"/>`)
      break
    }

    case 'repeat-start': {
      const gap = ENGRAVING.repeatBarlineDotSep * sp
      parts.push(`<rect x="${n(x)}" y="${n(yTop)}" width="${n(thick)}" height="${n(yBottom - yTop)}" fill="${INK}"/>`)
      parts.push(`<line x1="${n(x + thick + gap)}" y1="${n(yTop)}" x2="${n(x + thick + gap)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(thin, 2)}"/>`)
      const mid = (yTop + yBottom) / 2
      parts.push(`<circle cx="${n(x + thick + gap + sp * 0.75)}" cy="${n(mid - sp * 0.5)}" r="${n(dotR)}" fill="${INK}"/>`)
      parts.push(`<circle cx="${n(x + thick + gap + sp * 0.75)}" cy="${n(mid + sp * 0.5)}" r="${n(dotR)}" fill="${INK}"/>`)
      break
    }

    case 'repeat-end': {
      const gap = ENGRAVING.repeatBarlineDotSep * sp
      parts.push(`<rect x="${n(x - thick)}" y="${n(yTop)}" width="${n(thick)}" height="${n(yBottom - yTop)}" fill="${INK}"/>`)
      parts.push(`<line x1="${n(x - thick - gap)}" y1="${n(yTop)}" x2="${n(x - thick - gap)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(thin, 2)}"/>`)
      const mid = (yTop + yBottom) / 2
      parts.push(`<circle cx="${n(x - thick - gap - sp * 0.75)}" cy="${n(mid - sp * 0.5)}" r="${n(dotR)}" fill="${INK}"/>`)
      parts.push(`<circle cx="${n(x - thick - gap - sp * 0.75)}" cy="${n(mid + sp * 0.5)}" r="${n(dotR)}" fill="${INK}"/>`)
      break
    }

    default:
      parts.push(`<line x1="${n(x)}" y1="${n(yTop)}" x2="${n(x)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(thin, 2)}"/>`)
  }

  return parts.join('\n')
}

// ─── Rest ─────────────────────────────────────────────────────────────────────
function renderRest(rn: RenderedNote, sp: number): string {
  const fs       = smuflFontSize(sp)
  const halfSp   = sp / 2
  const staffTop = rn.y - rn.staffLine * halfSp
  let inner = ''

  if (rn.noteheadType === 'whole') {
    // Whole rest: rect hangs below 2nd line from top (staffTop + sp)
    // Using SMuFL glyph instead: anchor at staffTop + sp (the line it hangs from)
    inner = `<text x="${n(rn.x)}" y="${n(staffTop + sp)}" text-anchor="middle" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${lelandRestGlyph('whole')}</text>`
  } else if (rn.noteheadType === 'half') {
    // Half rest: rect sits on middle line (staffTop + 2*sp)
    inner = `<text x="${n(rn.x)}" y="${n(staffTop + sp * 2)}" text-anchor="middle" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${lelandRestGlyph('half')}</text>`
  } else {
    // Quarter and shorter: anchor at center of staff
    inner = `<text x="${n(rn.x)}" y="${n(staffTop + sp * 2)}" text-anchor="middle" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${lelandRestGlyph(rn.noteheadType)}</text>`
  }

  return `<g class="rest" id="${esc(rn.noteId)}" data-measure="${rn.measureNum}" data-beat="${rn.beat.toFixed(2)}">\n${inner}\n</g>`
}

// ─── Note ─────────────────────────────────────────────────────────────────────
function renderNote(rn: RenderedNote, sp: number): string {
  if (rn.isRest) return renderRest(rn, sp)

  const fs   = smuflFontSize(sp)
  const parts: string[] = []

  // Ledger lines (drawn first, behind note)
  const lw = ENGRAVING.legerLineThickness * sp
  for (const ll of rn.ledgerLines) {
    parts.push(`<line class="ledger-line" x1="${n(ll.x1)}" y1="${n(ll.y)}" x2="${n(ll.x2)}" y2="${n(ll.y)}" stroke="${INK}" stroke-width="${n(lw, 2)}"/>`)
  }

  // Stem
  if (rn.hasStem) {
    const sw = ENGRAVING.stemThickness * sp
    // Stem x: for stem-up, right side of notehead; stem-down, left side
    // stemX is computed by verticalLayout using the notehead width
    parts.push(`<g class="stem"><line x1="${n(rn.stemX)}" y1="${n(rn.stemYTop)}" x2="${n(rn.stemX)}" y2="${n(rn.stemYBottom)}" stroke="${INK}" stroke-width="${n(sw, 2)}"/></g>`)
  }

  // Notehead — SMuFL glyph, baseline = notehead center (SMuFL design)
  let noteheadGlyph: string
  if (rn.noteheadType === 'whole')       noteheadGlyph = LELAND_NOTEHEAD_WHOLE
  else if (rn.noteheadType === 'half')   noteheadGlyph = LELAND_NOTEHEAD_HALF
  else                                   noteheadGlyph = LELAND_NOTEHEAD_BLACK

  // x: notehead left edge (SMuFL glyphs start at left, use text-anchor="start")
  // center correction: notehead is ~1.3sp wide, so left edge = center - 0.65sp
  const nhLeft = rn.x - sp * 0.65
  parts.push(
    `<g class="notehead">` +
    `<text x="${n(nhLeft)}" y="${n(rn.y)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${noteheadGlyph}</text>` +
    `</g>`
  )

  // Accidental
  if (rn.accidental && rn.accidentalX !== undefined) {
    const glyph = lelandAccidentalGlyph(rn.accidental)
    if (glyph) {
      parts.push(
        `<g class="accid">` +
        `<text x="${n(rn.accidentalX)}" y="${n(rn.y)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${glyph}</text>` +
        `</g>`
      )
    }
  }

  // Flag (only if not in a beam group)
  if (rn.hasStem && !rn.beamGroupId) {
    const flagGlyph = lelandFlagGlyph(rn.noteheadType, rn.stemUp ?? true)
    if (flagGlyph) {
      // Flag attaches at stem end (top for stem-up, bottom for stem-down)
      const flagY = rn.stemUp ? rn.stemYTop : rn.stemYBottom
      parts.push(
        `<g class="flag">` +
        `<text x="${n(rn.stemX)}" y="${n(flagY)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${flagGlyph}</text>` +
        `</g>`
      )
    }
  }

  // Augmentation dot
  if (rn.dotted && rn.dotX !== undefined) {
    const halfSp = sp / 2
    // If note is on a line (even staffLine), move dot to space above
    const dotY = rn.staffLine % 2 === 0 ? rn.y - halfSp : rn.y
    const dotR = ENGRAVING.legerLineThickness * sp * 1.2  // small filled circle
    parts.push(`<circle class="dots" cx="${n(rn.dotX)}" cy="${n(dotY)}" r="${n(dotR * 2.5)}" fill="${INK}"/>`)
    if (rn.doubleDotted && rn.dot2X !== undefined) {
      parts.push(`<circle class="dots" cx="${n(rn.dot2X)}" cy="${n(dotY)}" r="${n(dotR * 2.5)}" fill="${INK}"/>`)
    }
  }

  return [
    `<g class="note" id="${esc(rn.noteId)}" data-measure="${rn.measureNum}" data-beat="${rn.beat.toFixed(2)}" data-voice="${rn.voice}">`,
    ...parts,
    `</g>`,
  ].join('\n')
}

// ─── Beam ─────────────────────────────────────────────────────────────────────
function renderBeam(beam: RenderedBeam, sp: number): string {
  const beamH = ENGRAVING.beamThickness * sp
  const parts: string[] = []

  for (const levelSegs of beam.segments) {
    for (const seg of levelSegs) {
      const dx  = seg.x2 - seg.x1
      const dy  = seg.y2 - seg.y1
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const nx  = -dy / len
      const ny  =  dx / len
      const half = beamH / 2
      const p1x = seg.x1 + nx * half; const p1y = seg.y1 + ny * half
      const p2x = seg.x2 + nx * half; const p2y = seg.y2 + ny * half
      const p3x = seg.x2 - nx * half; const p3y = seg.y2 - ny * half
      const p4x = seg.x1 - nx * half; const p4y = seg.y1 - ny * half
      parts.push(`<polygon class="beam" points="${n(p1x)},${n(p1y)} ${n(p2x)},${n(p2y)} ${n(p3x)},${n(p3y)} ${n(p4x)},${n(p4y)}" fill="${INK}"/>`)
    }
  }

  return parts.join('\n')
}

// ─── Chord symbol ─────────────────────────────────────────────────────────────
function renderChordSymbol(cs: RenderedChordSymbol, sp: number): string {
  const fs = sp * 1.4  // slightly larger than a space — editorial-size text
  return `<text id="${esc(cs.svgId)}" class="harmony" x="${n(cs.x)}" y="${n(cs.y)}" font-family="${EDWIN_FONT}" font-size="${n(fs)}" fill="${INK}" data-measure="${cs.measureNum}" data-beat="${cs.beat.toFixed(2)}">${esc(cs.text)}</text>`
}

// ─── Tuplet ───────────────────────────────────────────────────────────────────
function renderTuplet(t: RenderedTuplet, sp: number): string {
  const parts: string[] = []
  const bw = ENGRAVING.tupletBracketThickness * sp
  if (t.bracket) {
    const { x1, y1, x2, hookHeight } = t.bracket
    const dir  = t.above ? -1 : 1
    const gapW = sp * 1.8
    const mid  = (x1 + x2) / 2
    parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(mid - gapW / 2)}" y2="${n(y1)}" stroke="${INK}" stroke-width="${n(bw, 2)}"/>`)
    parts.push(`<line x1="${n(mid + gapW / 2)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y1)}" stroke="${INK}" stroke-width="${n(bw, 2)}"/>`)
    parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x1)}" y2="${n(y1 + dir * hookHeight)}" stroke="${INK}" stroke-width="${n(bw, 2)}"/>`)
    parts.push(`<line x1="${n(x2)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y1 + dir * hookHeight)}" stroke="${INK}" stroke-width="${n(bw, 2)}"/>`)
  }
  const numY = t.above ? t.numberY - sp * 0.2 : t.numberY + sp * 0.55
  parts.push(`<text x="${n(t.numberX)}" y="${n(numY)}" text-anchor="middle" font-family="${EDWIN_FONT}" font-size="${n(sp * 1.3)}" font-style="italic" fill="${INK}">${t.number}</text>`)
  return parts.join('\n')
}

// ─── Tie / Slur ───────────────────────────────────────────────────────────────
function renderTie(tie: RenderedTie, sp: number): string {
  const { path } = tie
  const sw = ENGRAVING.tieEndpointThickness * sp + ENGRAVING.tieMidpointThickness * sp  // avg ~0.14sp
  const d  = `M ${n(path.x1)},${n(path.y1)} C ${n(path.cx1)},${n(path.cy1)} ${n(path.cx2)},${n(path.cy2)} ${n(path.x2)},${n(path.y2)}`
  return `<path class="tie" d="${d}" fill="none" stroke="${INK}" stroke-width="${n(Math.max(1, sw), 2)}"/>`
}

// ─── Measure ──────────────────────────────────────────────────────────────────
function renderMeasure(measure: RenderedMeasure, sp: number): string {
  const parts: string[] = [`<g class="measure" data-measure="${measure.measureNum}">`]

  if (measure.clefDisplay)          parts.push(renderClef(measure.clefDisplay, sp))
  if (measure.keySignatureChange)   parts.push(renderKeySig(measure.keySignatureChange, sp))
  if (measure.timeSignatureDisplay) parts.push(renderTimeSig(measure.timeSignatureDisplay, sp))

  for (const bl  of measure.barlines)     parts.push(renderBarline(bl, sp))
  for (const cs  of measure.chordSymbols) parts.push(renderChordSymbol(cs, sp))
  for (const tie of measure.ties)         parts.push(renderTie(tie, sp))
  for (const tup of measure.tuplets)      parts.push(renderTuplet(tup, sp))
  for (const bm  of measure.beams)        parts.push(renderBeam(bm, sp))
  for (const nt  of measure.notes)        parts.push(renderNote(nt, sp))

  parts.push(`</g>`)
  return parts.join('\n')
}

// ─── System ───────────────────────────────────────────────────────────────────
function renderSystem(system: RenderedSystem, sp: number): string {
  const parts: string[] = [`<g class="system" data-system="${system.systemIndex}">`]
  parts.push(renderStaffLines(system, sp))
  for (const measure of system.measures) parts.push(renderMeasure(measure, sp))
  parts.push(`</g>`)
  return parts.join('\n')
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function renderPage(page: RenderedPage, sp: number): string {
  const parts: string[] = [`<g class="page" data-page="${page.pageIndex}">`]
  parts.push(`<rect x="0" y="${n(page.pageIndex * page.height)}" width="${n(page.width)}" height="${n(page.height)}" fill="white"/>`)
  for (const system of page.systems) parts.push(renderSystem(system, sp))
  parts.push(`</g>`)
  return parts.join('\n')
}

// ─── Main entry ───────────────────────────────────────────────────────────────
export function renderToSVG(
  renderedScore: RenderedScore,
  renderOptions?: RenderOptions,
): string {
  const opts        = { ...DEFAULT_RENDER_OPTIONS, ...renderOptions }
  const sp          = opts.spatium
  const totalHeight = renderedScore.pages.length * opts.pageHeight
  const width       = opts.pageWidth

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" class="map-score" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" style="background:white;">`,
    renderFontDefs(),
    `<!-- MAP Native Renderer — ${esc(renderedScore.metadata.title)} -->`,
    `<g class="score-content">`,
  ]

  for (const page of renderedScore.pages) parts.push(renderPage(page, sp))

  parts.push(`</g>`)
  parts.push(`</svg>`)

  return parts.join('\n')
}
