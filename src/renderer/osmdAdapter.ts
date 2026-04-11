/**
 * OSMD Adapter — wraps OpenSheetMusicDisplay for MAP
 *
 * Usage: renderWithOSMD(xmlString, containerDiv)
 * OSMD renders directly into the container (DOM-based, not string-based).
 *
 * buildOSMDElementMap() extracts coordinates from OSMD's GraphicSheet
 * to populate MAP's elementMap + toVrv/fromVrv ID maps.
 *
 * Note matching uses POSITIONAL matching (not ID/pitch matching) because:
 * - MAP's beat offsets (currentBeat starts at 1, backup can go negative) differ from OSMD's
 * - Both renderers produce exactly 643 non-rest notes for DONNALEE.XML in the same order
 */

import { OpenSheetMusicDisplay, IOSMDOptions } from 'opensheetmusicdisplay'
import type { NoteMap } from '../types/score'

// OSMD uses VexFlow internally — cast to access getNoteheadSVGs()
interface VFGraphicalNote {
  sourceNote: {
    isRest: () => boolean
  }
  getNoteheadSVGs: () => SVGElement[]
}

interface StaffEntry {
  graphicalVoiceEntries: Array<{
    notes: VFGraphicalNote[]
  }>
}

interface OSMDMeasure {
  staffEntries: StaffEntry[]
}

export interface NoteElement {
  id: string
  measureNum: number
  bbox: DOMRect
  staffBboxes: DOMRect[]
}

let osmdInstance: OpenSheetMusicDisplay | null = null

export function getOSMDInstance(): OpenSheetMusicDisplay | null {
  return osmdInstance
}

export async function renderWithOSMD(
  xml: string,
  container: HTMLDivElement,
): Promise<void> {
  // Clear previous content
  container.innerHTML = ''

  const options: IOSMDOptions = {
    backend: 'svg',
    drawTitle: false,
    drawSubtitle: false,
    drawComposer: false,
    drawCredits: false,
    drawPartNames: false,
    drawPartAbbreviations: false,
    drawMeasureNumbers: true,
    autoResize: false,
  }

  // Reuse instance if same container, otherwise create new
  if (!osmdInstance || (osmdInstance as any).Container !== container) {
    osmdInstance = new OpenSheetMusicDisplay(container, options)
  } else {
    osmdInstance.setOptions(options)
  }

  // zoom must be set on the instance (not via options)
  osmdInstance.zoom = 0.65

  await osmdInstance.load(xml)
  osmdInstance.render()
}

/**
 * Parse a noteMapId like "note-m3b-100-G5" → { measure: 3, beat: -100 }
 * Used for sorting MAP notes into score order.
 */
function parseNoteMapId(id: string): { measure: number; beat: number } {
  // Format: note-m{M}b{B}-{Step}{Octave}
  // B can be negative, e.g. "note-m3b-100-G5"
  const m = id.match(/^note-m(\d+)b(-?\d+)-/)
  if (!m) return { measure: 0, beat: 0 }
  return { measure: parseInt(m[1], 10), beat: parseInt(m[2], 10) }
}

/**
 * Build elementMap + toVrv/fromVrv from OSMD's GraphicSheet.
 *
 * Uses POSITIONAL matching: sorts MAP noteMap IDs by (measure, beat),
 * collects OSMD non-rest notes in GraphicSheet traversal order,
 * then zips them 1:1 by index. Both sets have identical note counts
 * (643 for DONNALEE.XML) because they render the same score.
 */
export function buildOSMDElementMap(
  container: Element,
  noteMap: NoteMap,
): {
  elementMap: Map<string, NoteElement>
  toVrv: Map<string, string>
  fromVrv: Map<string, string>
} {
  const elementMap = new Map<string, NoteElement>()
  const toVrv = new Map<string, string>()
  const fromVrv = new Map<string, string>()

  const containerRect = container.getBoundingClientRect()

  // ── 1. Build elementMap from SVG DOM (treble staff only) ─────────────────
  //
  // OSMD renders 2 × vf-measure per musical measure (treble + bass).
  // Treble stafflines have IDs ending in "-1" (e.g. "vexflow-renderer-1").
  // We filter to those to get exactly 100 measure entries for DONNALEE.XML.
  //
  const allMeasureEls = Array.from(container.querySelectorAll('g.vf-measure'))

  // Filter to treble staff: parent staffline ID ends with "-1"
  const trebleMeasureEls = allMeasureEls.filter(el => {
    const stafflineEl = el.parentElement
    if (!stafflineEl) return false
    const id = stafflineEl.id ?? ''
    return id.endsWith('-1')
  })

  // Fallback: if filtering yielded nothing (single-staff score), use all
  const measureEls = trebleMeasureEls.length > 0 ? trebleMeasureEls : allMeasureEls

  measureEls.forEach((el, index) => {
    const absBox = el.getBoundingClientRect()
    if (absBox.width === 0) return

    const bbox = new DOMRect(
      absBox.left - containerRect.left,
      absBox.top - containerRect.top,
      absBox.width,
      absBox.height,
    )

    // staffBboxes: use the measure bbox itself (OSMD doesn't expose separate staffline
    // bboxes per measure in the DOM — the .staffline wraps the whole system row)
    const staffBboxes = [bbox]

    const id = `measure-${index}`
    elementMap.set(id, { id, measureNum: index + 1, bbox, staffBboxes })
  })

  // ── 2. Build toVrv/fromVrv via POSITIONAL matching ───────────────────────
  if (!osmdInstance) {
    console.warn('buildOSMDElementMap: no OSMD instance')
    return { elementMap, toVrv, fromVrv }
  }

  const graphic = (osmdInstance as any).GraphicSheet
  if (!graphic?.MeasureList) {
    console.warn('buildOSMDElementMap: no GraphicSheet.MeasureList')
    return { elementMap, toVrv, fromVrv }
  }

  // ── 2a. Sorted MAP noteMap IDs ───────────────────────────────────────────
  const sortedMapIds = [...noteMap.notes.keys()].sort((a, b) => {
    const pa = parseNoteMapId(a)
    const pb = parseNoteMapId(b)
    if (pa.measure !== pb.measure) return pa.measure - pb.measure
    return pa.beat - pb.beat
  })

  // ── 2b. Collect OSMD non-rest notes in traversal order ──────────────────
  const measureList: OSMDMeasure[][] = graphic.MeasureList
  const osmdNotes: Array<{ svgEl: SVGElement }> = []

  for (let mi = 0; mi < measureList.length; mi++) {
    const measureRow = measureList[mi]
    if (!measureRow || measureRow.length === 0) continue

    // Staff 0 only (treble) — matches MAP's staff-1 filter in xmlParser
    const measure = measureRow[0]
    if (!measure?.staffEntries) continue

    for (const staffEntry of measure.staffEntries) {
      for (const gve of staffEntry.graphicalVoiceEntries) {
        for (const gNote of gve.notes as VFGraphicalNote[]) {
          if (gNote.sourceNote.isRest()) continue

          const noteheads = gNote.getNoteheadSVGs()
          if (!noteheads || noteheads.length === 0) continue

          const svgEl = noteheads[0]
          if (!(svgEl instanceof SVGElement)) continue

          osmdNotes.push({ svgEl })
        }
      }
    }
  }

  // ── 2c. Zip by position ──────────────────────────────────────────────────
  const minLen = Math.min(sortedMapIds.length, osmdNotes.length)

  for (let i = 0; i < minLen; i++) {
    const noteMapId = sortedMapIds[i]
    const { svgEl } = osmdNotes[i]

    // Stamp stable IDs on the SVG notehead element
    const svgId = `osmd-${i}`
    svgEl.id = svgId
    svgEl.setAttribute('data-notemap-id', noteMapId)
    svgEl.classList.add('note')

    toVrv.set(noteMapId, svgId)
    fromVrv.set(svgId, noteMapId)
  }

  console.log(
    `buildOSMDElementMap: ${elementMap.size} measures, ${minLen} notes matched` +
    (sortedMapIds.length !== osmdNotes.length
      ? ` (MAP=${sortedMapIds.length} OSMD=${osmdNotes.length} — mismatch!)`
      : ''),
  )

  return { elementMap, toVrv, fromVrv }
}
