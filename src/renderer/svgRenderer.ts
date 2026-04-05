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
  LELAND_NATURAL,
  LELAND_TIME_SIG,
  LELAND_AUGMENTATION_DOT,
  LELAND_REPEAT_DOT,
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
@font-face {
  font-family: 'LelandText';
  src: url('/fonts/LelandText.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
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
  if (ks.accidentals.length === 0) return ''
  const fs = smuflFontSize(sp)
  // Accidental anchor: SMuFL baseline = center of accidental glyph
  // The layout computes acc.y as the note-center y for each accidental position
  return ks.accidentals.map(acc => {
    const glyph = acc.type === 'sharp' ? LELAND_SHARP
                : acc.type === 'flat'  ? LELAND_FLAT
                : LELAND_NATURAL
    return `<text x="${n(acc.x)}" y="${n(acc.y)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${glyph}</text>`
  }).join('\n')
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
/**
 * Render a barline element.
 *
 * Coordinate convention (matching C++):
 *   bl.x = LEFT EDGE of the barline element (= element origin in MuseScore local coords).
 *   All drawing is to the RIGHT of bl.x, using the exact formulas from barline.cpp::draw().
 *
 * Style constants (from styledef.cpp lines 131-137 — verbatim):
 *   Sid::barWidth                    = Spatium(0.18)  → lw  (thin line)
 *   Sid::endBarWidth                 = Spatium(0.55)  → lw2 (thick line)
 *   Sid::endBarDistance              = Spatium(0.37)  → eDist
 *   Sid::doubleBarDistance           = Spatium(0.37)  → dDist
 *   Sid::repeatBarlineDotSeparation  = Spatium(0.37)  → dotSep
 */
function renderBarline(bl: RenderedBarline, sp: number): string {
  // From MuseScore: src/engraving/style/styledef.cpp lines 131-137
  const lw     = 0.18 * sp   // Sid::barWidth (thin barline pen width)
  const lw2    = 0.55 * sp   // Sid::endBarWidth (thick barline pen width)
  const eDist  = 0.37 * sp   // Sid::endBarDistance (inner gap between thin+thick)
  const dDist  = 0.37 * sp   // Sid::doubleBarDistance (inner gap between double lines)
  const dotSep = 0.37 * sp   // Sid::repeatBarlineDotSeparation
  const dotR   = sp * 0.25   // symBbox(repeatDot).width() ≈ 0.5sp → radius ≈ 0.25sp
  const fs     = smuflFontSize(sp)  // SMuFL font size for glyph elements
  const parts: string[] = []
  const { x: ox, yTop, yBottom, type } = bl
  const mid = (yTop + yBottom) / 2

  switch (type) {
    case 'regular': {
      // From MuseScore: src/engraving/libmscore/barline.cpp:587-591 — BarLineType::NORMAL
      //   lw = styleMM(Sid::barWidth)
      //   x = lw * .5;  drawLine(x, y1, x, y2)
      const cx = ox + lw / 2
      parts.push(`<line x1="${n(cx)}" y1="${n(yTop)}" x2="${n(cx)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw, 2)}"/>`)
      break
    }

    case 'double': {
      // From MuseScore: src/engraving/libmscore/barline.cpp:621-628 — BarLineType::DOUBLE
      //   lw  = styleMM(Sid::doubleBarWidth) = 0.18sp
      //   x   = lw * .5                                    → first center = 0.09sp
      //   x  += (lw*.5) + doubleBarDistance + (lw*.5)      → second center += 0.55sp → 0.64sp
      const cx1 = ox + lw / 2
      const cx2 = cx1 + lw / 2 + dDist + lw / 2  // = ox + lw + dDist + lw/2
      parts.push(`<line x1="${n(cx1)}" y1="${n(yTop)}" x2="${n(cx1)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw, 2)}"/>`)
      parts.push(`<line x1="${n(cx2)}" y1="${n(yTop)}" x2="${n(cx2)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw, 2)}"/>`)
      break
    }

    case 'final': {
      // From MuseScore: src/engraving/libmscore/barline.cpp:608-618 — BarLineType::END
      //
      // C++ draws LEFT-to-RIGHT from element origin (left edge):
      //   x = lw * .5                                → thin center = 0.09sp from origin
      //   x += (lw*.5 + endBarDistance + lw2*.5)     → thick center = 0.825sp from origin
      //   total barline width = lw + eDist + lw2 = 1.10sp
      //
      // In our system bl.x = measure right edge ≈ RIGHT EDGE of the barline.
      // Inverting: origin = bl.x - (lw + eDist + lw2)
      //   → thin center  = bl.x - (lw + eDist + lw2) + lw/2  = bl.x - lw2 - eDist - lw/2
      //                   = bl.x - 0.55 - 0.37 - 0.09 = bl.x - 1.01sp
      //   → thick center = bl.x - (lw + eDist + lw2) + (lw + eDist + lw2/2) = bl.x - lw2/2
      //                   = bl.x - 0.275sp
      const cxThin  = ox - lw2 - eDist - lw / 2   // bl.x - 1.01sp
      const cxThick = ox - lw2 / 2                // bl.x - 0.275sp
      parts.push(`<line x1="${n(cxThin)}"  y1="${n(yTop)}" x2="${n(cxThin)}"  y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw, 2)}"/>`)
      parts.push(`<line x1="${n(cxThick)}" y1="${n(yTop)}" x2="${n(cxThick)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw2, 2)}"/>`)
      break
    }

    case 'repeat-start': {
      // From MuseScore: src/engraving/libmscore/barline.cpp:661-678 — BarLineType::START_REPEAT
      //
      // COORDINATE CONVENTION (mirrored from END_REPEAT):
      //   bl.x = RIGHT EDGE of barline = measure content start (= hMeasure.x).
      //   The barline draws LEFTWARD into the previous measure's trailing space.
      //   Structure right→left: [note] ← barNoteDistance ← [dots] ← dotSep ← [thin] ← eDist ← [thick]
      //
      // C++ draws rightward from left-edge origin. We invert:
      //   cxThick = ox - dotW - dotSep - lw - eDist - lw2/2
      //   cxThin  = ox - dotW - dotSep - lw/2
      //   dotLeft = ox - dotW
      //
      // dotW = symBbox(repeatDot).width() ≈ 0.5sp (same as END_REPEAT)
      const dotW    = dotR * 2                              // ≈ 0.5sp
      const dotLeft = ox - dotW
      const cxThin  = ox - dotW - dotSep - lw / 2
      const cxThick = ox - dotW - dotSep - lw - eDist - lw2 / 2
      parts.push(`<line x1="${n(cxThick)}" y1="${n(yTop)}" x2="${n(cxThick)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw2, 2)}"/>`)
      parts.push(`<line x1="${n(cxThin)}"  y1="${n(yTop)}" x2="${n(cxThin)}"  y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw, 2)}"/>`)
      parts.push(`<text x="${n(dotLeft)}" y="${n(mid - sp * 0.5)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${LELAND_REPEAT_DOT}</text>`)
      parts.push(`<text x="${n(dotLeft)}" y="${n(mid + sp * 0.5)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${LELAND_REPEAT_DOT}</text>`)
      break
    }

    case 'repeat-end': {
      // From MuseScore: src/engraving/libmscore/barline.cpp:681-700 — BarLineType::END_REPEAT
      // bl.x = RIGHT EDGE of barline (end of measure) → invert C++ formula (mirror of final)
      //
      // C++ from origin (left edge), rightward:
      //   dots at x=0 (left edge), dot advances x += symBbox(repeatDot).width() ≈ dotW=0.5sp
      //   thin at dotW + dotSep + lw/2, thick at dotW + dotSep + lw + eDist + lw2/2
      //   total = dotW + dotSep + lw + eDist + lw2  (≈ 0.5 + 0.37 + 0.18 + 0.37 + 0.55 = 1.97sp)
      // Inverted (right edge = bl.x):
      //   thick center = bl.x - lw2/2                           = bl.x - 0.275sp
      //   thin center  = bl.x - lw2 - eDist - lw/2              = bl.x - 1.01sp
      //   dot left     = bl.x - lw2 - eDist - lw - dotSep - dotW = bl.x - 1.97sp
      const dotW    = dotR * 2                              // symBbox(repeatDot).width() ≈ 0.5sp
      const cxThick = ox - lw2 / 2
      const cxThin  = ox - lw2 - eDist - lw / 2
      const dotLeft = ox - lw2 - eDist - lw - dotSep - dotW  // glyph left edge
      parts.push(`<text x="${n(dotLeft)}" y="${n(mid - sp * 0.5)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${LELAND_REPEAT_DOT}</text>`)
      parts.push(`<text x="${n(dotLeft)}" y="${n(mid + sp * 0.5)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${LELAND_REPEAT_DOT}</text>`)
      parts.push(`<line x1="${n(cxThin)}"  y1="${n(yTop)}" x2="${n(cxThin)}"  y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw, 2)}"/>`)
      parts.push(`<line x1="${n(cxThick)}" y1="${n(yTop)}" x2="${n(cxThick)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw2, 2)}"/>`)
      const _ = dotW  // suppress unused warning
      break
    }

    default:
      parts.push(`<line x1="${n(ox + lw / 2)}" y1="${n(yTop)}" x2="${n(ox + lw / 2)}" y2="${n(yBottom)}" stroke="${INK}" stroke-width="${n(lw, 2)}"/>`)
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
    inner = `<text x="${n(rn.x)}" y="${n(staffTop + sp * 2)}" text-anchor="middle" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${lelandRestGlyph(rn.durationType)}</text>`
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

  // x: notehead left edge — rn.x IS the left edge (chord.cpp: note->pos().x() = left edge)
  // Bravura: stemDownNW.x=0 (left edge), stemUpSE.x=1.18sp (visual right edge)
  const nhLeft = rn.x
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
    const flagGlyph = lelandFlagGlyph(rn.durationType, rn.stemUp ?? true)
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

  // Augmentation dot — Leland SMuFL glyph (baseline = dot center, same as noteheads)
  if (rn.dotted && rn.dotX !== undefined) {
    const halfSp = sp / 2
    // If note is on a staff line (even staffLine), shift dot up to the space above
    const dotY = rn.staffLine % 2 === 0 ? rn.y - halfSp : rn.y
    const fs = smuflFontSize(sp)
    parts.push(`<text class="dots" x="${n(rn.dotX)}" y="${n(dotY)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${LELAND_AUGMENTATION_DOT}</text>`)
    if (rn.doubleDotted && rn.dot2X !== undefined) {
      parts.push(`<text class="dots" x="${n(rn.dot2X)}" y="${n(dotY)}" font-family="${LELAND_FONT}" font-size="${n(fs)}" fill="${INK}">${LELAND_AUGMENTATION_DOT}</text>`)
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
    const dir  = t.above ? 1 : -1
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
/**
 * Renders a tie as a filled lune (two bezier arcs forming a closed sickle shape).
 * Outer arc: the visible arc curving away from the note.
 * Inner arc: same control x-positions, slightly less curvature — creates
 * the tapered endpoints and thicker midpoint characteristic of engraved ties.
 */
function renderTieArc(path: import('./types').BezierArc, above: boolean, sp: number): string {
  const { x1, y1, cx1, cy1, cx2, cy2, x2, y2 } = path
  const midT = ENGRAVING.tieMidpointThickness * sp
  const signInward = above ? 1 : -1
  const cy1i = cy1 + signInward * midT
  const cy2i = cy2 + signInward * midT
  const d = [
    `M ${n(x1)},${n(y1)}`,
    `C ${n(cx1)},${n(cy1)} ${n(cx2)},${n(cy2)} ${n(x2)},${n(y2)}`,
    `C ${n(cx2)},${n(cy2i)} ${n(cx1)},${n(cy1i)} ${n(x1)},${n(y1)}`,
    'Z',
  ].join(' ')
  return `<path class="tie" d="${d}" fill="${INK}" stroke="none"/>`
}

function renderTie(tie: RenderedTie, sp: number): string {
  // Cross-system ties: render two separate half-arcs
  if (tie.crossSystem && tie.halfArcs) {
    return tie.halfArcs.map(arc => renderTieArc(arc, tie.above, sp)).join('\n')
  }
  return renderTieArc(tie.path, tie.above, sp)
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

// ─── Title ────────────────────────────────────────────────────────────────────
function renderTitle(title: string, pageWidth: number, marginTop: number, sp: number): string {
  if (!title) return ''
  const cx = pageWidth / 2
  // Title sits in the title frame: staffUpperBorder(7sp) + title frame top pad(~2sp) from marginTop
  // This places the title baseline at about marginTop + 9sp
  // webmscore title: 22pt Edwin at 360dpi = 110px. Baseline at marginTop + ~83px (title bbox top=marginTop, height=81px)
  const fontSize = Math.round(22 * (360 / 72))  // 22pt at 360dpi = 110px
  const y = marginTop + 83
  return `<text x="${n(cx)}" y="${n(y)}" text-anchor="middle" font-family="Edwin, 'Times New Roman', serif" font-size="${fontSize}" fill="${INK}" class="score-title">${esc(title)}</text>`
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function renderPage(page: RenderedPage, sp: number, title: string, pageWidth: number, marginTop: number): string {
  const parts: string[] = [`<g class="page" data-page="${page.pageIndex}">`]
  parts.push(`<rect x="0" y="${n(page.pageIndex * page.height)}" width="${n(page.width)}" height="${n(page.height)}" fill="white"/>`)
  if (page.pageIndex === 0 && title) parts.push(renderTitle(title, pageWidth, marginTop, sp))

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
  const title       = renderedScore.metadata.title

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" class="map-score" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" direction="ltr" style="background:white;">`,
    renderFontDefs(),
    `<!-- MAP Native Renderer — ${esc(title)} -->`,
    `<g class="score-content">`,
  ]

  for (const page of renderedScore.pages) parts.push(renderPage(page, sp, title, width, opts.marginTop))

  parts.push(`</g>`)
  parts.push(`</svg>`)

  return parts.join('\n')
}
