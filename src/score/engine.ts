/**
 * Score engine — renders MusicXML into a fixed-width page and maps the result
 * to page-unit geometry + noteMap IDs.
 *
 * OSMD (default): measure groups `g.vf-measure` carry their measure-list index
 * as id; each OSMD GraphicalNote has exactly one notehead and knows its
 * measure, timestamp, pitch and global staff — so mapping to noteMap IDs is
 * exact (closest beat breaks the rare ties).
 *
 * `?renderer=native` switches to MAP's own renderer (in development).
 */
import type { NoteMap } from '../types/score'
import type { MeasureBox, NoteBox, Rect, ScoreGeometry, SystemBox } from './geometry'

export const PAGE_WIDTH = 1000
const OSMD_ZOOM = 0.72

export const useNative = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('renderer') === 'native'

export interface RenderResult {
  geometry: ScoreGeometry
  noteEls: Map<string, Element>   // noteId → notehead element
  colorables: Element[]           // score elements that can be selected & colored
}

let osmd: any = null
let osmdHost: HTMLElement | null = null

let chain: Promise<void> = Promise.resolve()

/** Render into `host`. Calls are serialized so overlapping renders never interleave. */
export function renderScore(xml: string, host: HTMLDivElement): Promise<void> {
  const run = chain.then(() => doRender(xml, host))
  chain = run.catch(() => {})
  return run
}

async function doRender(xml: string, host: HTMLDivElement): Promise<void> {
  host.innerHTML = ''
  host.style.width = `${PAGE_WIDTH}px`
  if (useNative) {
    const { renderScore: renderNative } = await import('../renderer/index')
    host.innerHTML = renderNative(xml).svg
    return
  }
  const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
  if (!osmd || osmdHost !== host) {
    osmd = new OpenSheetMusicDisplay(host, {
      backend: 'svg',
      autoResize: false,
      drawTitle: false,
      drawSubtitle: false,
      drawComposer: false,
      drawLyricist: false,
      drawCredits: false,
      drawPartNames: false,
      drawPartAbbreviations: false,
      drawMeasureNumbers: true,
    })
    osmdHost = host
    const rules = osmd.EngravingRules
    // Room above/below systems for chord symbols, numerals and form bars
    rules.MinSkyBottomDistBetweenSystems = 9
    rules.MinimumDistanceBetweenSystems = 9
    rules.PageTopMargin = 6
  }
  osmd.zoom = OSMD_ZOOM
  await osmd.load(xml)
  osmd.render()
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const STEP_OF: Record<number, string> = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' }
const pitchNum = (src: any) => (src.Pitch?.octave ?? 0) * 12 + (src.Pitch?.fundamentalNote ?? 0) + (src.Pitch?.AccidentalHalfTones ?? 0)

function relRect(el: Element, origin: DOMRect, scale: number): Rect {
  const r = el.getBoundingClientRect()
  return { x: (r.left - origin.left) / scale, y: (r.top - origin.top) / scale, w: r.width / scale, h: r.height / scale }
}

function union(rs: Rect[]): Rect {
  const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y))
  const x1 = Math.max(...rs.map(r => r.x + r.w)), y1 = Math.max(...rs.map(r => r.y + r.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Build geometry. `scale` is the CSS scale currently applied to the page. */
export function buildGeometry(host: HTMLDivElement, noteMap: NoteMap, scale: number): RenderResult {
  const origin = host.getBoundingClientRect()
  const svg = host.querySelector('svg')
  const width = PAGE_WIDTH
  const height = svg ? svg.getBoundingClientRect().height / scale : 0
  return useNative
    ? buildNative(host, noteMap, origin, scale, width, height)
    : buildOsmd(host, noteMap, origin, scale, width, height)
}

function buildOsmd(host: HTMLDivElement, noteMap: NoteMap, origin: DOMRect, scale: number, width: number, height: number): RenderResult {
  // ── Measures: one rect per staff, from the staff-line paths ──
  // DOM staff lines appear in the same order as OSMD's systems → staff lines, and each
  // contains its measures in order; OSMD tells us each measure's list index.
  const staffRects = new Map<number, Rect[]>()   // measure index (1-based) → staff rects
  const osmdLines: any[] = (osmd?.GraphicSheet?.MusicPages ?? []).flatMap((pg: any) => pg.MusicSystems.flatMap((sy: any) => sy.StaffLines))
  const lines = Array.from(host.querySelectorAll('g.staffline'))
  lines.forEach((line, k) => {
    const gms = Array.from(line.children).filter(c => c.classList.contains('vf-measure'))
    gms.forEach((gm, j) => {
      const src = osmdLines[k]?.Measures?.[j]?.parentSourceMeasure
      const idx = src ? src.measureListIndex : NaN
      if (Number.isNaN(idx)) return
      const paths = Array.from(gm.children).filter(c => c.tagName === 'path').map(p => relRect(p, origin, scale))
      const flat = paths.filter(r => r.h < 3 && r.w > 4)   // horizontal staff lines
      const rect = flat.length ? union(flat) : relRect(gm, origin, scale)
      const arr = staffRects.get(idx + 1)
      if (arr) arr.push(rect); else staffRects.set(idx + 1, [rect])
    })
  })
  const { measures, systems } = assembleMeasures(staffRects)

  // ── Notes: OSMD graphical notes → noteMap IDs ──
  const byKey = new Map<string, string[]>()
  for (const n of noteMap.notes.values()) {
    const k = `${n.measureNum}|${n.globalStaff}|${n.step}${n.octave}`
    const arr = byKey.get(k)
    if (arr) arr.push(n.id); else byKey.set(k, [n.id])
  }
  const used = new Set<string>()
  const notes = new Map<string, NoteBox>()
  const noteEls = new Map<string, Element>()
  const pending: Array<{ el: Element; key: string; beat: number; measure: number; staff: number }> = []
  const list: any[][] = osmd?.GraphicSheet?.MeasureList ?? []
  for (const row of list) {
    for (const gm of row ?? []) {
      for (const se of gm?.staffEntries ?? []) {
        for (const gve of se.graphicalVoiceEntries ?? []) {
          const gns = (gve.notes ?? []).filter((gn: any) => gn.sourceNote && !gn.sourceNote.isRest?.())
          // In a chord every GraphicalNote may report all heads of the stem; pair them by pitch
          // (lowest pitch ↔ lowest head on the page).
          const heads: Element[] = gns[0]?.getNoteheadSVGs?.() ?? []
          const shared = gns.length > 1 && heads.length === gns.length && gns.every((gn: any) => (gn.getNoteheadSVGs?.() ?? []).length === heads.length)
          const byPitch = [...gns].sort((a: any, b: any) => pitchNum(a.sourceNote) - pitchNum(b.sourceNote))
          const headsLowToHigh = shared ? [...heads].sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top) : []
          for (const gn of gns) {
            const src = gn.sourceNote
            const el = shared ? headsLowToHigh[byPitch.indexOf(gn)] : gn.getNoteheadSVGs?.()?.[0]
            if (!el) continue
            const measure = src.SourceMeasure.measureListIndex + 1
            const staff = (src.ParentStaff.idInMusicSheet ?? src.ParentStaff.Id - 1) + 1
            const step = STEP_OF[src.Pitch.fundamentalNote] ?? 'C'
            const octave = src.Pitch.octave + 3
            const beat = 1 + src.ParentVoiceEntry.Timestamp.RealValue * 4
            pending.push({ el, key: `${measure}|${staff}|${step}${octave}`, beat, measure, staff })
          }
        }
      }
    }
  }
  // Progressively looser matching: exact → nearest beat → any staff (cross-staff
  // notation) → any octave (8va lines are reported differently by OSMD).
  const keyAnyStaff = (k: string) => k.replace(/^(\d+)\|\d+\|/, '$1|*|')
  const keyAnyOct = (k: string) => keyAnyStaff(k).replace(/\d+$/, '')
  const indexBy = (fn: (k: string) => string) => {
    const m = new Map<string, string[]>()
    for (const n of noteMap.notes.values()) {
      const k = fn(`${n.measureNum}|${n.globalStaff}|${n.step}${n.octave}`)
      const arr = m.get(k)
      if (arr) arr.push(n.id); else m.set(k, [n.id])
    }
    return m
  }
  const levels: Array<{ index: Map<string, string[]>; key: (k: string) => string; maxD: number }> = [
    { index: byKey, key: k => k, maxD: 0.01 },
    { index: byKey, key: k => k, maxD: 1 },
    { index: indexBy(keyAnyStaff), key: keyAnyStaff, maxD: 0.5 },
    { index: indexBy(keyAnyOct), key: keyAnyOct, maxD: 0.26 },
  ]
  pending.sort((a, b) => a.measure - b.measure || a.beat - b.beat)
  for (const lvl of levels) {
    for (const p of pending) {
      if (p.el.hasAttribute('data-note-id')) continue
      const cands = lvl.index.get(lvl.key(p.key))
      if (!cands) continue
      let best: string | null = null, bestD = Infinity
      for (const id of cands) {
        if (used.has(id)) continue
        const d = Math.abs(noteMap.notes.get(id)!.beat - p.beat)
        if (d < bestD) { bestD = d; best = id }
      }
      if (!best || bestD > lvl.maxD) continue
      used.add(best)
      p.el.setAttribute('data-note-id', best)
      noteEls.set(best, p.el)
      const r = relRect(p.el, origin, scale)
      notes.set(best, { ...r, id: best, cx: r.x + r.w / 2, cy: r.y + r.h / 2, measure: p.measure, staff: p.staff, system: measures[p.measure - 1]?.system ?? 0 })
    }
  }

  // Selectable / colorable score elements: chord symbols & words, dynamics, wedges,
  // accidentals & articulations, ties & slurs, clefs, key & time signatures
  const colorables = Array.from(host.querySelectorAll(
    'g.staffline > g.vf-text, g.staffline > path, g.staffline > text, svg > path, svg > text, g.vf-stavetie, g.vf-curve, g.vf-modifiers > *, g.vf-clef, g.vf-keysignature, g.vf-timesignature',
  ))


  return { geometry: finish(width, height, measures, systems, notes, noteMap), noteEls, colorables: dedupe(colorables) }
}

function dedupe(els: Element[]): Element[] {
  const set = new Set(els)
  // drop elements nested inside another colorable (keep the outermost unit)
  return els.filter(el => {
    for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false
    return true
  })
}

function buildNative(host: HTMLDivElement, noteMap: NoteMap, origin: DOMRect, scale: number, width: number, height: number): RenderResult {
  const staffRects = new Map<number, Rect[]>()
  Array.from(host.querySelectorAll('g.measure')).forEach((el, i) => staffRects.set(i + 1, [relRect(el, origin, scale)]))
  const { measures, systems } = assembleMeasures(staffRects)
  const notes = new Map<string, NoteBox>()
  const noteEls = new Map<string, Element>()
  host.querySelectorAll('g.note[id]').forEach(el => {
    const n = noteMap.notes.get(el.id)
    if (!n) return
    const head = el.querySelector('.notehead') ?? el
    head.setAttribute('data-note-id', n.id)
    noteEls.set(n.id, head)
    const r = relRect(head, origin, scale)
    notes.set(n.id, { ...r, id: n.id, cx: r.x + r.w / 2, cy: r.y + r.h / 2, measure: n.measureNum, staff: n.globalStaff, system: measures[n.measureNum - 1]?.system ?? 0 })
  })
  return { geometry: finish(width, height, measures, systems, notes, noteMap), noteEls, colorables: [] }
}

function assembleMeasures(staffRects: Map<number, Rect[]>) {
  const nums = [...staffRects.keys()].sort((a, b) => a - b)
  const measures: MeasureBox[] = []
  const systems: SystemBox[] = []
  for (const num of nums) {
    const staves = staffRects.get(num)!.sort((a, b) => a.y - b.y)
    const box = union(staves)
    let sys = systems[systems.length - 1]
    const prev = measures[measures.length - 1]
    // new system when the measure starts left of the previous one or moves down
    if (!sys || !prev || box.x < prev.x - 1 || Math.abs(box.y - prev.y) > 4) {
      sys = { index: systems.length, first: num, last: num, ...box }
      systems.push(sys)
    } else {
      const u = union([sys, box])
      Object.assign(sys, { x: u.x, y: u.y, w: u.w, h: u.h, last: num })
    }
    measures[num - 1] = { ...box, num, staves, system: sys.index }
  }
  return { measures, systems }
}

function finish(width: number, height: number, measures: MeasureBox[], systems: SystemBox[], notes: Map<string, NoteBox>, noteMap: NoteMap): ScoreGeometry {
  const order = [...notes.values()]
    .map(b => ({ b, n: noteMap.notes.get(b.id)! }))
    .sort((p, q) => p.n.measureNum - q.n.measureNum || p.n.beat - q.n.beat || p.n.globalStaff - q.n.globalStaff || p.b.cy - q.b.cy)
    .map(p => p.b.id)
  return { width, height, measures, systems, notes, order }
}
