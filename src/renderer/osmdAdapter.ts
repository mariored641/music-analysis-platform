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
    Pitch: { fundamentalNote: number; octave: number }  // fundamentalNote: 0=C..6=B (NoteEnum)
    ParentStaff: { Id: number }                          // 1-based staff number
    SourceMeasure: { measureListIndex: number }          // 0-based measure index
    ParentStaffEntry: { Timestamp: { RealValue: number } }  // whole notes from measure start
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
 * Parse a noteMapId like "note-m3b-100-G5" or "note-m3b100-C3-s2"
 * → { measure: 3, beat: -100, staff: 1 } or { measure: 3, beat: 100, staff: 2 }
 */
function parseNoteMapId(id: string): { measure: number; beat: number; staff: number } {
  const m = id.match(/^note-m(\d+)b(-?\d+)-/)
  if (!m) return { measure: 0, beat: 0, staff: 1 }
  const staffMatch = id.match(/-s(\d+)$/)
  return {
    measure: parseInt(m[1], 10),
    beat: parseInt(m[2], 10),
    staff: staffMatch ? parseInt(staffMatch[1], 10) : 1,
  }
}

// OSMD NoteEnum → step letter (C=0, D=1, E=2, F=3, G=4, A=5, B=6)
const STEP_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
// OSMD internal octave + OctaveXmlDiff = XML octave (middle C: OSMD oct 1, XML oct 4)
const OCTAVE_XML_DIFF = 3

/**
 * Reverse-lookup: find a clicked SVG notehead in OSMD's GraphicSheet.
 * Returns musical info needed to construct a noteMap ID, or null if not found.
 */
export function locateNoteheadInOSMD(
  svgEl: SVGElement,
): { measureNum: number; beat: number; step: string; octave: number; staff: number } | null {
  if (!osmdInstance) return null

  const graphic = (osmdInstance as any).GraphicSheet
  if (!graphic?.MeasureList) return null

  const measureList: OSMDMeasure[][] = graphic.MeasureList

  for (const measureRow of measureList) {
    if (!measureRow) continue
    for (const measure of measureRow) {
      if (!measure?.staffEntries) continue
      for (const staffEntry of measure.staffEntries) {
        for (const gve of staffEntry.graphicalVoiceEntries) {
          for (const gNote of gve.notes as VFGraphicalNote[]) {
            if (gNote.sourceNote.isRest()) continue
            const heads = gNote.getNoteheadSVGs()
            if (!heads || heads.length === 0) continue
            for (let i = 0; i < heads.length; i++) {
              if (!(heads[i] instanceof SVGElement)) continue
              if (heads[i] === svgEl) {
                const src = gNote.sourceNote
                const stepIdx = src.Pitch.fundamentalNote
                const step = STEP_LETTERS[stepIdx] ?? 'C'
                const octave = src.Pitch.octave + OCTAVE_XML_DIFF
                const measureNum = src.SourceMeasure.measureListIndex + 1  // 0→1-based
                const beat = 1 + (src.ParentStaffEntry.Timestamp.RealValue * 4)  // whole notes→quarter, 1-based
                const staff = src.ParentStaff.Id
                return { measureNum, beat, step, octave, staff }
              }
            }
          }
        }
      }
    }
  }
  return null
}

/**
 * Construct a noteMap ID from OSMD musical info.
 * Format matches xmlParser.ts: note-m{N}b{beat*100}-{Step}{Oct}[-s{staff}]
 */
export function buildNoteMapIdFromOSMD(
  info: { measureNum: number; beat: number; step: string; octave: number; staff: number },
): string {
  const beatEncoded = Math.round(info.beat * 100)
  if (info.staff === 1) {
    return `note-m${info.measureNum}b${beatEncoded}-${info.step}${info.octave}`
  }
  return `note-m${info.measureNum}b${beatEncoded}-${info.step}${info.octave}-s${info.staff}`
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

  // ── 1. Build elementMap from SVG DOM (both staves) ───────────────────────
  //
  // OSMD renders 2 × vf-measure per musical measure (treble + bass).
  // Treble stafflines have IDs ending in "-1", bass in "-2".
  // We pair them by index to produce one elementMap entry per musical measure
  // with staffBboxes = [trebleBbox, bassBbox].
  //
  const allMeasureEls = Array.from(container.querySelectorAll('g.vf-measure'))

  const trebleMeasureEls: Element[] = []
  const bassMeasureEls: Element[] = []
  for (const el of allMeasureEls) {
    const parentId = el.parentElement?.id ?? ''
    if (parentId.endsWith('-1')) trebleMeasureEls.push(el)
    else if (parentId.endsWith('-2')) bassMeasureEls.push(el)
  }

  // Single-staff fallback: no staffline IDs or no bass → use all measures as treble-only
  const hasBassStaff = bassMeasureEls.length > 0
  const effectiveTreble = trebleMeasureEls.length > 0 ? trebleMeasureEls : allMeasureEls
  const measureCount = effectiveTreble.length

  for (let index = 0; index < measureCount; index++) {
    const trebleEl = effectiveTreble[index]
    const trebleBox = trebleEl.getBoundingClientRect()
    if (trebleBox.width === 0) continue

    const tBbox = new DOMRect(
      trebleBox.left - containerRect.left,
      trebleBox.top - containerRect.top,
      trebleBox.width,
      trebleBox.height,
    )

    const staffBboxes: DOMRect[] = [tBbox]

    if (hasBassStaff && index < bassMeasureEls.length) {
      const bassBox = bassMeasureEls[index].getBoundingClientRect()
      if (bassBox.width > 0) {
        const bBbox = new DOMRect(
          bassBox.left - containerRect.left,
          bassBox.top - containerRect.top,
          bassBox.width,
          bassBox.height,
        )
        staffBboxes.push(bBbox)
      }
    }

    // Union bbox encompassing all staves
    const allLeft = Math.min(...staffBboxes.map(b => b.left))
    const allTop = Math.min(...staffBboxes.map(b => b.top))
    const allRight = Math.max(...staffBboxes.map(b => b.right))
    const allBottom = Math.max(...staffBboxes.map(b => b.bottom))
    const bbox = new DOMRect(allLeft, allTop, allRight - allLeft, allBottom - allTop)

    const id = `measure-${index}`
    elementMap.set(id, { id, measureNum: index + 1, bbox, staffBboxes })
  }

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

  // ── 2a. Sorted MAP noteMap IDs (by measure, then staff, then beat) ────
  const sortedMapIds = [...noteMap.notes.keys()].sort((a, b) => {
    const pa = parseNoteMapId(a)
    const pb = parseNoteMapId(b)
    if (pa.measure !== pb.measure) return pa.measure - pb.measure
    if (pa.staff !== pb.staff) return pa.staff - pb.staff
    return pa.beat - pb.beat
  })

  // ── 2b. Collect OSMD non-rest notes — treble first, then bass per measure
  //
  // Deduplication: some OSMD score situations (unison notes across voices,
  // cross-staff notation, Sibelius multi-voice exports) cause the same
  // SVG notehead element to appear multiple times in the GraphicSheet
  // traversal. We deduplicate by element reference so each visible notehead
  // is matched exactly once.
  const measureList: OSMDMeasure[][] = graphic.MeasureList
  const osmdNotes: Array<{ svgEl: SVGElement }> = []
  const seenSvgEls = new Set<SVGElement>()

  /** Collect non-rest noteheads from a single OSMD staff measure */
  function collectStaffNotes(measure: OSMDMeasure | undefined) {
    if (!measure?.staffEntries) return
    for (const staffEntry of measure.staffEntries) {
      for (const gve of staffEntry.graphicalVoiceEntries) {
        // For chord notes, getNoteheadSVGs() returns ALL noteheads of the chord for each note.
        // Use the note's index within the gve (chord) to select the correct notehead.
        // Example: 4-note chord — note[0]→heads[0], note[1]→heads[1], etc.
        for (let ni = 0; ni < gve.notes.length; ni++) {
          const gNote = gve.notes[ni] as VFGraphicalNote
          if (gNote.sourceNote.isRest()) continue
          const noteheads = gNote.getNoteheadSVGs()
          if (!noteheads || noteheads.length === 0) continue
          const svgEl = noteheads[Math.min(ni, noteheads.length - 1)]
          if (!(svgEl instanceof SVGElement)) continue
          if (seenSvgEls.has(svgEl)) continue   // deduplicate true duplicates (cross-staff, unisons across voices)
          seenSvgEls.add(svgEl)
          osmdNotes.push({ svgEl })
        }
      }
    }
  }

  for (let mi = 0; mi < measureList.length; mi++) {
    const measureRow = measureList[mi]
    if (!measureRow || measureRow.length === 0) continue
    // Staff 0 (treble) first, then staff 1 (bass) — matching noteMap sort order
    collectStaffNotes(measureRow[0])
    if (measureRow.length > 1) collectStaffNotes(measureRow[1])
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
