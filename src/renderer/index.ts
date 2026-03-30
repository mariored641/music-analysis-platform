/**
 * MAP Native Renderer — Public API
 *
 * renderScore(xmlString, options?) → RenderResult
 *
 * Pipeline:
 *   MusicXML string
 *     → extractScore()         (xmlExtractor.ts)    — parse to ExtractedScore
 *     → computeHorizontalLayout() (horizontalLayout.ts) — measure widths, note x
 *     → computeVerticalLayout()   (verticalLayout.ts)   — note y, stems, beams → RenderedScore
 *     → renderToSVG()             (svgRenderer.ts)      — RenderedScore → SVG string
 *
 * Output: { svg, notes, elementMap, renderedScore }
 *   - svg         : SVG string — set as innerHTML of score container
 *   - notes       : RenderedNote[] — geometry for every note (x, y, bbox, noteId)
 *   - elementMap  : Map<"measure-N", DOMRectLike> — drop-in for existing MAP code
 *   - renderedScore : full structure for advanced consumers
 */

import { extractScore }               from './xmlExtractor'
import { computeHorizontalLayout }    from './horizontalLayout'
import { computeVerticalLayout }      from './verticalLayout'
import { renderToSVG }                from './svgRenderer'
import type { RenderOptions, RenderResult } from './types'

export { extractScore }
export { computeHorizontalLayout }
export { computeVerticalLayout }
export { renderToSVG }
export type { RenderOptions, RenderResult }

/**
 * Full render pipeline.
 * @param xmlString  Raw MusicXML string
 * @param options    Optional render options (page size, spatium, margins…)
 * @returns          RenderResult with svg, notes, elementMap, renderedScore
 */
export function renderScore(
  xmlString: string,
  options?: RenderOptions,
): RenderResult {
  const extracted      = extractScore(xmlString)
  const hLayout        = computeHorizontalLayout(extracted, options)
  const renderedScore  = computeVerticalLayout(extracted, hLayout, options)
  const svg            = renderToSVG(renderedScore, options)

  return {
    svg,
    notes:        renderedScore.allNotes,
    elementMap:   renderedScore.elementMap,
    renderedScore,
  }
}
