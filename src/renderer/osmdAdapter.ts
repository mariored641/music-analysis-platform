/**
 * OSMD Adapter — wraps OpenSheetMusicDisplay for MAP
 *
 * Usage: renderWithOSMD(xmlString, containerDiv)
 * OSMD renders directly into the container (DOM-based, not string-based).
 *
 * buildOSMDElementMap() extracts coordinates from OSMD's GraphicSheet
 * to populate MAP's elementMap + toVrv/fromVrv ID maps.
 *
 * Note matching uses PITCH-BASED matching: each OSMD notehead is matched
 * to the noteMap entry with the same (measure, step, octave, staff) and
 * closest beat value. This is robust against chord ordering differences
 * and count mismatches between OSMD and xmlParser.
 */

import { OpenSheetMusicDisplay, IOSMDOptions } from 'opensheetmusicdisplay'
import type { NoteMap } from '../types/score'

// OSMD uses VexFlow internally — cast to access getNoteheadSVGs()
interface VFGraphicalNote {
  sourceNote: {
    isRest: () => boolean
    Pitch: { fundamentalNote: number; octave: number }  // fundamentalNote: chromatic (C=0,D=2,E=4,F=5,G=7,A=9,B=11)
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

// OSMD NoteEnum → step letter. Values are chromatic semitone offsets from C:
// C=0, D=2, E=4, F=5, G=7, A=9, B=11 (NOT sequential 0–6)
const NOTE_ENUM_TO_STEP: Record<number, string> = {
  0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B',
}
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
                const step = NOTE_ENUM_TO_STEP[stepIdx] ?? 'C'
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
 * Uses PITCH-BASED matching: for each OSMD notehead, extracts musical info
 * (measure, step, octave, staff, beat) from sourceNote and looks up the
 * corresponding noteMap ID. When multiple noteMap entries share the same
 * pitch key (same note repeated in same measure), picks the closest beat.
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

  // ── 2. Build toVrv/fromVrv via PITCH-BASED matching ──────────────────────
  if (!osmdInstance) {
    console.warn('buildOSMDElementMap: no OSMD instance')
    return { elementMap, toVrv, fromVrv }
  }

  const graphic = (osmdInstance as any).GraphicSheet
  if (!graphic?.MeasureList) {
    console.warn('buildOSMDElementMap: no GraphicSheet.MeasureList')
    return { elementMap, toVrv, fromVrv }
  }

  // ── 2a. Build pitch index from noteMap ────────────────────────────────
  // Key: "m{measure}-{step}{octave}" (staff-agnostic — OSMD staff IDs don't
  // reliably match XML <staff> numbers, so we match by pitch+measure only
  // and use beat proximity to disambiguate repeated pitches)
  const pitchIndex = new Map<string, string[]>()
  for (const [id, note] of noteMap.notes) {
    const key = `m${note.measureNum}-${note.step}${note.octave}`
    const arr = pitchIndex.get(key)
    if (arr) arr.push(id)
    else pitchIndex.set(key, [id])
  }

  // ── 2b. Collect OSMD non-rest notes with musical info ───────────────────
  const measureList: OSMDMeasure[][] = graphic.MeasureList
  interface OSMDNoteInfo {
    svgEl: SVGElement
    measureNum: number
    step: string
    octave: number
    staff: number
    beat: number   // 1-based quarter-note position
  }
  const osmdNotes: OSMDNoteInfo[] = []
  const seenSvgEls = new Set<SVGElement>()

  /** Collect non-rest noteheads with sourceNote info from a single OSMD staff measure */
  function collectStaffNotes(measure: OSMDMeasure | undefined) {
    if (!measure?.staffEntries) return
    for (const staffEntry of measure.staffEntries) {
      for (const gve of staffEntry.graphicalVoiceEntries) {
        for (let ni = 0; ni < gve.notes.length; ni++) {
          const gNote = gve.notes[ni] as VFGraphicalNote
          if (gNote.sourceNote.isRest()) continue
          const noteheads = gNote.getNoteheadSVGs()
          if (!noteheads || noteheads.length === 0) continue
          const svgEl = noteheads[Math.min(ni, noteheads.length - 1)]
          if (!(svgEl instanceof SVGElement)) continue
          if (seenSvgEls.has(svgEl)) continue
          seenSvgEls.add(svgEl)

          const src = gNote.sourceNote
          const stepIdx = src.Pitch.fundamentalNote
          osmdNotes.push({
            svgEl,
            measureNum: src.SourceMeasure.measureListIndex + 1,
            step: NOTE_ENUM_TO_STEP[stepIdx] ?? 'C',
            octave: src.Pitch.octave + OCTAVE_XML_DIFF,
            staff: src.ParentStaff.Id,
            beat: 1 + (src.ParentStaffEntry.Timestamp.RealValue * 4),
          })
        }
      }
    }
  }

  for (let mi = 0; mi < measureList.length; mi++) {
    const measureRow = measureList[mi]
    if (!measureRow || measureRow.length === 0) continue
    collectStaffNotes(measureRow[0])
    if (measureRow.length > 1) collectStaffNotes(measureRow[1])
  }

  // ── 2c. Match by pitch key + closest beat ───────────────────────────────
  const usedNoteMapIds = new Set<string>()
  let matched = 0
  let unmatched = 0

  for (let i = 0; i < osmdNotes.length; i++) {
    const info = osmdNotes[i]
    const pitchKey = `m${info.measureNum}-${info.step}${info.octave}`

    const candidates = pitchIndex.get(pitchKey)
    if (!candidates || candidates.length === 0) {
      unmatched++
      continue
    }

    // Pick the candidate with closest beat, preferring same-staff matches.
    // Staff penalty ensures that when a pitch exists on both staves,
    // we match treble→treble and bass→bass first. Cross-staff matches
    // are still possible when OSMD staff IDs don't match XML <staff>.
    const osBeat = Math.round(info.beat * 100)
    const STAFF_PENALTY = 10000  // large enough to always prefer same-staff
    let bestId: string | null = null
    let bestScore = Infinity
    for (const id of candidates) {
      if (usedNoteMapIds.has(id)) continue
      const parsed = parseNoteMapId(id)
      const beatDist = Math.abs(parsed.beat - osBeat)
      // Check if noteMap staff matches OSMD staff
      const noteStaff = parsed.staff
      const staffMismatch = noteStaff !== info.staff ? STAFF_PENALTY : 0
      const score = beatDist + staffMismatch
      if (score < bestScore) {
        bestScore = score
        bestId = id
      }
    }

    if (!bestId) {
      unmatched++
      continue
    }

    usedNoteMapIds.add(bestId)

    const svgId = `osmd-${i}`
    info.svgEl.id = svgId
    info.svgEl.setAttribute('data-notemap-id', bestId)
    info.svgEl.classList.add('note')

    toVrv.set(bestId, svgId)
    fromVrv.set(svgId, bestId)
    matched++
  }

  // ── 2d. Merge co-located noteheads ──────────────────────────────────────
  // When two voices share the same pitch at the same position, OSMD renders
  // separate SVG noteheads at the same pixel. Only the topmost is clickable.
  // Redirect the bottom one's toVrv to the top element so selection highlight
  // always appears on the visible element.
  const positionMap = new Map<string, { svgId: string; noteMapId: string; idx: number }[]>()
  for (let i = 0; i < osmdNotes.length; i++) {
    const info = osmdNotes[i]
    const svgId = info.svgEl.id
    if (!svgId) continue
    const bbox = info.svgEl.getBoundingClientRect()
    // Round to 3px grid for grouping — catches near-overlaps from cross-staff notation
    const posKey = `${Math.round(bbox.left / 3) * 3},${Math.round(bbox.top / 3) * 3}`
    if (!positionMap.has(posKey)) positionMap.set(posKey, [])
    const noteMapId = info.svgEl.getAttribute('data-notemap-id')
    if (noteMapId) positionMap.get(posKey)!.push({ svgId, noteMapId, idx: i })
  }
  let colocated = 0
  for (const [, group] of positionMap) {
    if (group.length < 2) continue
    // The last element in the group is rendered on top (later in DOM = higher z-order)
    const topEntry = group[group.length - 1]
    for (let g = 0; g < group.length - 1; g++) {
      const bottom = group[g]
      // Redirect bottom's toVrv to the top element
      toVrv.set(bottom.noteMapId, topEntry.svgId)
      colocated++
    }
  }

  console.log(
    `buildOSMDElementMap: ${elementMap.size} measures, ${matched} notes matched` +
    (unmatched > 0 ? ` (${unmatched} OSMD notes unmatched)` : '') +
    (colocated > 0 ? ` (${colocated} co-located redirected)` : ''),
  )

  return { elementMap, toVrv, fromVrv }
}
