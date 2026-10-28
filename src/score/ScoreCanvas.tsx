import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useAnnotationStore } from '../store/annotationStore'
import { useSelectionStore } from '../store/selectionStore'
import { useLayerStore } from '../store/layerStore'
import { usePlaybackStore } from '../store/playbackStore'
import { useStylusStore, activeEntry } from '../store/stylusStore'
import { useUiStore } from '../store/uiStore'
import { PAGE_WIDTH, buildGeometry, renderScore } from './engine'
import { registry, resolveElement } from './registry'
import { paintElements, paintNotes } from './paint'
import { rectContains, rectsIntersect, type NoteBox, type Rect } from './geometry'
import { AnnotationLayer } from './AnnotationLayer'
import { PlaybackLayer, SelectionLayer, StrokeLayer, strokePoints } from './OverlayLayers'
import { distToPolyline, strokePath } from './shapes'
import { clickMeasure, clickNote, selectMeasures, selectNotes, selectSystemOf } from './selectionOps'
import { isVisible, newId } from '../services/annotationQueries'
import { melodyColor } from '../constants/layers'
import type { Annotation, ColorAnnotation, FreehandAnnotation, MelodyAnnotation } from '../types/annotation'
import { QuickTagBar } from '../components/workspace/QuickTagBar'
import { saveThumbnail } from './thumbnail'
import { useHe } from '../i18n'
import './score.css'

const SELECT_COLOR = '#e8590c'
const PLAY_COLOR = '#0ea5e9'

type Gesture =
  | { kind: 'pending'; x: number; y: number; cx: number; cy: number; target: EventTarget | null; shift: boolean; ctrl: boolean }
  | { kind: 'lasso'; x: number; y: number; ctrl: boolean }
  | { kind: 'draw'; points: number[] }
  | { kind: 'erase' }

export function ScoreCanvas() {
  const he = useHe()
  const xml = useWorkspaceStore(s => s.xml)
  const noteMap = useWorkspaceStore(s => s.noteMap)
  const geometry = useWorkspaceStore(s => s.geometry)
  const annotations = useAnnotationStore(s => s.annotations)
  const selection = useSelectionStore(s => s.selection)
  const selectedId = useSelectionStore(s => s.selectedAnnotationId)
  const scrollTo = useSelectionStore(s => s.scrollTo)
  const visible = useLayerStore(s => s.visible)
  const colors = useLayerStore(s => s.colors)
  const playMeasure = usePlaybackStore(s => s.currentMeasure)
  const playNotes = usePlaybackStore(s => s.currentNoteIds)
  const isPlaying = usePlaybackStore(s => s.isPlaying)
  const penMode = useStylusStore(s => s.mode)
  const zoom = useUiStore(s => s.zoom)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<SVGPathElement>(null)
  const lassoRef = useRef<SVGRectElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const [busy, setBusy] = useState<'rendering' | 'error' | null>(null)
  const [gestureActive, setGestureActive] = useState(false)
  const [fit, setFit] = useState(1)
  const scale = zoom === 0 ? fit : zoom
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  // ── Fit-to-width ──
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setFit(Math.max(0.45, Math.min(1.8, (el.clientWidth - 40) / PAGE_WIDTH))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Render ──
  useEffect(() => {
    const host = hostRef.current
    if (!xml || !noteMap || !host) return
    let cancelled = false
    setBusy('rendering')
    useWorkspaceStore.getState().setGeometry(null)
    renderScore(xml, host)
      .then(() => new Promise(r => requestAnimationFrame(r)))
      .then(() => {
        if (cancelled) return
        const res = buildGeometry(host, noteMap, scaleRef.current)
        const origin = host.getBoundingClientRect()
        registry.noteEls = res.noteEls
        registry.colorables = res.colorables
        registry.colorableRects = res.colorables.map(el => {
          const r = el.getBoundingClientRect()
          const s = scaleRef.current
          return { x: (r.left - origin.left) / s, y: (r.top - origin.top) / s, w: r.width / s, h: r.height / s }
        })
        useWorkspaceStore.getState().setGeometry(res.geometry)
        setBusy(null)
        const pid = useWorkspaceStore.getState().pieceId
        if (pid && res.geometry.systems[0]) saveThumbnail(pid, host, res.geometry.systems[0])
      })
      .catch(e => {
        console.error('render failed', e)
        if (!cancelled) setBusy('error')
      })
    return () => { cancelled = true }
  }, [xml, noteMap])

  const visibleAnns = useMemo(() => Object.values(annotations).filter(a => isVisible(a, visible)), [annotations, visible])
  const strokes = useMemo(() => visibleAnns.filter((a): a is FreehandAnnotation => a.layer === 'freehand'), [visibleAnns])
  const shapes = useMemo(() => visibleAnns.filter(a => a.layer !== 'freehand' && a.layer !== 'melody' && a.layer !== 'color'), [visibleAnns])

  // ── Paint noteheads + elements ──
  useEffect(() => {
    if (!geometry) return
    const noteColors = new Map<string, string>()
    const ordered = [...visibleAnns].sort((a, b) => (a.scriptId ? 0 : 1) - (b.scriptId ? 0 : 1))
    for (const a of ordered) {
      if (a.layer === 'melody' && (a as MelodyAnnotation).noteFunction) {
        const c = melodyColor((a as MelodyAnnotation).noteFunction!, colors)
        a.noteIds?.forEach(id => noteColors.set(id, c))
      }
    }
    const elementColors = new Map<number, string>()
    for (const a of ordered) {
      if (a.layer !== 'color') continue
      const c = a as ColorAnnotation
      if (c.element) {
        const idx = resolveElement(c.element)
        if (idx >= 0) elementColors.set(idx, c.color)
      } else c.noteIds?.forEach(id => noteColors.set(id, c.color))
    }
    if (selection?.kind === 'notes') selection.noteIds.forEach(id => noteColors.set(id, SELECT_COLOR))
    playNotes.forEach(id => noteColors.set(id, PLAY_COLOR))
    paintNotes(registry.noteEls, noteColors)
    paintElements(registry.colorables, elementColors)
  }, [geometry, visibleAnns, colors, selection, playNotes])

  // ── Scroll requests (links, keyboard navigation) ──
  const scrollToY = useCallback((y0: number, y1: number, center = false) => {
    const el = scrollRef.current
    if (!el) return
    const s = scaleRef.current
    const top = y0 * s, bottom = y1 * s
    if (center || top < el.scrollTop + 20 || bottom > el.scrollTop + el.clientHeight - 20) {
      el.scrollTo({ top: Math.max(0, top - el.clientHeight * 0.3), behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    if (!scrollTo || !geometry) return
    const n = scrollTo.noteId ? geometry.notes.get(scrollTo.noteId) : undefined
    const m = geometry.measures[scrollTo.measure - 1]
    const sys = m ? geometry.systems[m.system] : undefined
    if (n) scrollToY(n.y - 60, n.y + 60)
    else if (sys) scrollToY(sys.y - 60, sys.y + sys.h + 60)
  }, [scrollTo, geometry, scrollToY])

  useEffect(() => {
    if (!isPlaying || !playMeasure || !geometry) return
    const sys = geometry.systems[geometry.measures[playMeasure - 1]?.system ?? -1]
    if (sys) scrollToY(sys.y - 50, sys.y + sys.h + 70)
  }, [isPlaying, playMeasure, geometry, scrollToY])

  // ── Pointer interaction ──
  const toPage = (e: { clientX: number; clientY: number }) => {
    const r = pageRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scaleRef.current, y: (e.clientY - r.top) / scaleRef.current }
  }

  const noteAt = (x: number, y: number): NoteBox | null => {
    const g = useWorkspaceStore.getState().geometry
    if (!g) return null
    let best: NoteBox | null = null, bestD = Infinity
    for (const n of g.notes.values()) {
      if (!rectContains(n, x, y, 3)) continue
      const d = Math.hypot(n.cx - x, n.cy - y)
      if (d < bestD) { bestD = d; best = n }
    }
    return best
  }

  const measureAt = (x: number, y: number): number | null => {
    const g = useWorkspaceStore.getState().geometry
    if (!g) return null
    for (const m of g.measures) {
      if (!m) continue
      if (m.staves.some(s => rectContains(s, x, y, 0) || (x >= s.x && x <= s.x + s.w && y >= s.y - 14 && y <= s.y + s.h + 14))) return m.num
    }
    return null
  }

  const elementAt = (target: EventTarget | null): number => {
    if (!(target instanceof Element) || !hostRef.current?.contains(target)) return -1
    const set = registry.colorables
    for (let el: Element | null = target; el && el !== hostRef.current; el = el.parentElement) {
      const i = set.indexOf(el)
      if (i >= 0) return i
    }
    return -1
  }

  const wantsDraw = (e: React.PointerEvent) => {
    const { mode, penAlwaysDraws } = useStylusStore.getState()
    if (mode === 'erase' || (e.pointerType === 'pen' && (e.buttons & 32))) return 'erase'
    if (mode === 'draw' || (e.pointerType === 'pen' && penAlwaysDraws)) return 'draw'
    return null
  }

  const eraseAt = (x: number, y: number) => {
    const { annotations: all } = useAnnotationStore.getState()
    const vis = useLayerStore.getState().visible
    for (const a of Object.values(all)) {
      if (a.layer !== 'freehand' || !isVisible(a, vis)) continue
      if (distToPolyline(x, y, strokePoints(a)) < Math.max(7, a.strokeWidth / 2 + 4)) useAnnotationStore.getState().removeAnnotation(a.id)
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geometry) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const p = toPage(e)
    const draw = wantsDraw(e)
    if (draw) {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      setGestureActive(true)
      if (draw === 'erase') { gestureRef.current = { kind: 'erase' }; eraseAt(p.x, p.y); return }
      gestureRef.current = { kind: 'draw', points: [p.x, p.y] }
      const entry = activeEntry()
      const live = liveRef.current
      if (live) {
        live.setAttribute('stroke', entry.color)
        live.setAttribute('stroke-width', String(entry.width))
        live.setAttribute('stroke-opacity', String(entry.opacity))
        live.setAttribute('d', `M${p.x} ${p.y}`)
        live.style.display = ''
      }
      return
    }
    if (e.pointerType === 'touch') return // let touch scroll; taps arrive as click
    gestureRef.current = { kind: 'pending', x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, target: e.target, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gst = gestureRef.current
    if (!gst) return
    const p = toPage(e)
    if (gst.kind === 'draw') {
      const pts = gst.points
      const lx = pts[pts.length - 2], ly = pts[pts.length - 1]
      if (Math.hypot(p.x - lx, p.y - ly) < 1.5) return
      pts.push(p.x, p.y)
      liveRef.current?.setAttribute('d', strokePath(pts))
      return
    }
    if (gst.kind === 'erase') { eraseAt(p.x, p.y); return }
    if (gst.kind === 'pending') {
      if (Math.hypot(e.clientX - gst.cx, e.clientY - gst.cy) < 6) return
      gestureRef.current = { kind: 'lasso', x: gst.x, y: gst.y, ctrl: gst.ctrl }
      e.currentTarget.setPointerCapture(e.pointerId)
      setGestureActive(true)
    }
    const g2 = gestureRef.current
    if (g2?.kind === 'lasso' && lassoRef.current) {
      const r = lassoRef.current
      r.setAttribute('x', String(Math.min(g2.x, p.x)))
      r.setAttribute('y', String(Math.min(g2.y, p.y)))
      r.setAttribute('width', String(Math.abs(p.x - g2.x)))
      r.setAttribute('height', String(Math.abs(p.y - g2.y)))
      r.style.display = ''
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const gst = gestureRef.current
    gestureRef.current = null
    setGestureActive(false)
    if (!gst) return
    const p = toPage(e)
    const g = useWorkspaceStore.getState().geometry
    if (!g) return

    if (gst.kind === 'draw') {
      if (liveRef.current) liveRef.current.style.display = 'none'
      commitStroke(gst.points)
      return
    }
    if (gst.kind === 'erase') return
    if (gst.kind === 'lasso') {
      if (lassoRef.current) lassoRef.current.style.display = 'none'
      const rect: Rect = { x: Math.min(gst.x, p.x), y: Math.min(gst.y, p.y), w: Math.abs(p.x - gst.x), h: Math.abs(p.y - gst.y) }
      const hits = [...g.notes.values()].filter(n => rectsIntersect(n, rect)).map(n => n.id)
      const sel = useSelectionStore.getState().selection
      if (gst.ctrl && sel?.kind === 'notes') selectNotes([...sel.noteIds, ...hits])
      else if (hits.length) selectNotes(hits)
      else useSelectionStore.getState().clear()
      return
    }
    // plain click
    const mods = { shift: gst.shift, ctrl: gst.ctrl }
    const note = noteAt(gst.x, gst.y)
    if (note) { clickNote(note.id, mods); return }
    const el = elementAt(gst.target)
    if (el >= 0) {
      const r = registry.colorableRects[el]
      const m = measureAt(r.x + r.w / 2, r.y + r.h / 2) ?? nearestMeasure(r.x, r.y)
      useSelectionStore.getState().setSelection({
        kind: 'element', element: { index: el, tag: registry.colorables[el].tagName, x: r.x, y: r.y }, measureStart: m, measureEnd: m,
      })
      return
    }
    const m = measureAt(gst.x, gst.y)
    if (m) { clickMeasure(m, mods); return }
    useSelectionStore.getState().clear()
  }

  const onPointerCancel = () => {
    gestureRef.current = null
    setGestureActive(false)
    if (liveRef.current) liveRef.current.style.display = 'none'
    if (lassoRef.current) lassoRef.current.style.display = 'none'
  }

  // Touch taps (pointerdown for touch is ignored so the page can scroll)
  const onClick = (e: React.MouseEvent) => {
    if ((e.nativeEvent as PointerEvent).pointerType !== 'touch') return
    const p = toPage(e)
    const note = noteAt(p.x, p.y)
    if (note) { clickNote(note.id, {}); return }
    const m = measureAt(p.x, p.y)
    if (m) clickMeasure(m, {}); else useSelectionStore.getState().clear()
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (useStylusStore.getState().mode !== 'select') return
    const p = toPage(e)
    const note = noteAt(p.x, p.y)
    const m = note?.measure ?? measureAt(p.x, p.y)
    if (!m) return
    if (note) selectMeasures(m, m)
    else selectSystemOf(m)
  }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const p = toPage(e)
    const sel = useSelectionStore.getState().selection
    const note = noteAt(p.x, p.y)
    if (note && !(sel?.kind === 'notes' && sel.noteIds.includes(note.id))) clickNote(note.id, {})
    else if (!note && !sel) {
      const m = measureAt(p.x, p.y)
      if (m) clickMeasure(m, {})
    }
    if (useSelectionStore.getState().selection) useSelectionStore.getState().openQuick(null, { x: e.clientX, y: e.clientY })
  }

  const nearestMeasure = (x: number, y: number) => {
    const g = useWorkspaceStore.getState().geometry!
    let best = 1, bestD = Infinity
    for (const m of g.measures) {
      if (!m) continue
      const dx = Math.max(m.x - x, 0, x - (m.x + m.w)), dy = Math.max(m.y - y, 0, y - (m.y + m.h))
      const d = dx + dy * 2
      if (d < bestD) { bestD = d; best = m.num }
    }
    return best
  }

  const commitStroke = (points: number[]) => {
    if (points.length < 4) return
    const entry = activeEntry()
    const same = Object.values(useAnnotationStore.getState().annotations)
      .find((a): a is FreehandAnnotation => a.layer === 'freehand' && a.color.toLowerCase() === entry.color.toLowerCase())
    const rounded = points.map(v => Math.round(v * 10) / 10)
    const ys = rounded.filter((_, i) => i % 2 === 1)
    const xs = rounded.filter((_, i) => i % 2 === 0)
    const m = nearestMeasure((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2)
    const ann: FreehandAnnotation = {
      id: newId('stroke'),
      layer: 'freehand',
      measureStart: m,
      createdAt: Date.now(),
      path: strokePath(rounded),
      points: rounded,
      color: entry.color,
      strokeWidth: entry.width,
      opacity: entry.opacity,
      linkedLayer: same?.linkedLayer,
      label: same?.label,
    }
    useAnnotationStore.getState().addAnnotation(ann)
  }

  const drawing = penMode !== 'select'

  return (
    <div className="score-scroll" ref={scrollRef}>
      {busy === 'rendering' && <div className="score-status">{he ? 'מרנדר פרטיטורה…' : 'Rendering score…'}</div>}
      {busy === 'error' && <div className="score-status error">{he ? 'הרינדור נכשל' : 'Rendering failed'}</div>}
      <div className="score-sizer" style={{ width: PAGE_WIDTH * scale, height: (geometry?.height ?? 600) * scale + 80 }}>
        <div
          ref={pageRef}
          className={`score-page${drawing ? ` mode-${penMode}` : ''}`}
          style={{ transform: `scale(${scale})`, width: PAGE_WIDTH }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
        >
          <div className="osmd-host" ref={hostRef} />
          {geometry && (
            <svg className="score-overlay" width={PAGE_WIDTH} height={geometry.height} viewBox={`0 0 ${PAGE_WIDTH} ${geometry.height}`}>
              <PlaybackLayer g={geometry} measure={isPlaying || usePlaybackStore.getState().isPaused ? playMeasure : null} />
              <SelectionLayer g={geometry} selection={selection} />
              <AnnotationLayer geometry={geometry} annotations={shapes as Annotation[]} colors={colors} selectedId={selectedId} scale={scale} he={he} />
              <StrokeLayer strokes={strokes} />
              <path ref={liveRef} className="live-stroke" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'none' }} />
              <rect ref={lassoRef} className="lasso" style={{ display: 'none' }} />
            </svg>
          )}
        </div>
        {geometry && <QuickTagBar scale={scale} hidden={gestureActive || drawing || isPlaying} />}
      </div>
    </div>
  )
}
