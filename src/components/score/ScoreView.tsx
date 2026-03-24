import { useRef, useEffect, useState, useCallback } from 'react'
import { useScoreStore } from '../../store/scoreStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useLayerStore } from '../../store/layerStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useTranslation } from 'react-i18next'
import { parseMusicXml, parseHarmonies, type HarmonyItem } from '../../services/xmlParser'
import { prepareMusicXML } from '../../services/xmlSanitizer'
import { saveFile, loadFile } from '../../services/storageService'
import { AnnotationOverlay } from './AnnotationOverlay'
import { HarmonyOverlay } from './HarmonyOverlay'
import { FormalStrip } from './FormalStrip'
import { FreehandCanvas } from './FreehandCanvas'
import { SelectionOverlay } from './SelectionOverlay'
import { ContextMenu } from '../menus/ContextMenu'
import './ScoreView.css'

// ── Verovio worker ────────────────────────────────────────────────────────────
// Rendering runs off the main thread via verovio.worker.ts

import VrvWorker from '../../workers/verovio.worker?worker'

let _worker: Worker | null = null
let _pendingRenders = new Map<number, { resolve: (s: string[]) => void; reject: (e: Error) => void }>()
let _renderId = 0

function getVrvWorker(): Worker {
  if (_worker) return _worker
  _worker = new VrvWorker()
  _worker.onmessage = (e: MessageEvent) => {
    const { type, id, svgs, message } = e.data
    const pending = _pendingRenders.get(id)
    if (!pending) return
    _pendingRenders.delete(id)
    if (type === 'result') pending.resolve(svgs)
    else pending.reject(new Error(message ?? 'Worker render error'))
  }
  _worker.onerror = (e) => {
    console.error('[VrvWorker]', e.message)
    _pendingRenders.forEach(p => p.reject(new Error(e.message)))
    _pendingRenders.clear()
    _worker = null  // allow re-creation on next call
  }
  return _worker
}

function renderWithVerovio(xmlString: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const id = ++_renderId
    _pendingRenders.set(id, { resolve, reject })
    const preparedXml = prepareMusicXML(xmlString)
    getVrvWorker().postMessage({ type: 'render', xml: preparedXml, id })
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NoteElement {
  id: string
  measureNum: number
  bbox: DOMRect
  staffBboxes: DOMRect[]  // one per g.staff child — used for hit detection and selection display
}

/**
 * Builds two ID mappings between noteMap IDs and Verovio SVG element IDs.
 *
 * Strategy: positional matching within each measure/staff.
 * Verovio SVG g.note elements have NO pitch attributes — we sort both
 * sequences by position (x-coord for SVG, beat for noteMap) and zip them 1:1.
 *
 * This works because:
 *  - Verovio g.note excludes rests (those are g.rest), matching noteMap's step!='R' filter
 *  - Both sequences are in beat order within each measure
 *  - DONNALEE.XML: 643 notes, all in staff 1 (first g.staff per measure)
 *
 * Returns:
 *   toVrv   — noteMapId → verovioId   (rendering: apply colors to SVG elements)
 *   fromVrv — verovioId → noteMapId   (click: translate SVG click → noteMap lookup)
 */
function buildVrvNoteIdMap(
  container: Element,
  noteMap: import('../../types/score').NoteMap,
): { toVrv: Map<string, string>; fromVrv: Map<string, string> } {
  const toVrv   = new Map<string, string>()
  const fromVrv = new Map<string, string>()

  const measureEls = Array.from(container.querySelectorAll('g.measure'))

  measureEls.forEach((measureEl, index) => {
    const measureNum = index + 1

    // First g.staff = melody staff (staff 1)
    const staff1El = measureEl.querySelector(':scope > g.staff')
    if (!staff1El) return

    // Verovio notes in this staff, sorted left→right (= chronological beat order)
    const vrvNotes = Array.from(staff1El.querySelectorAll('g.note'))
      .filter(el => !!el.id)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)

    if (vrvNotes.length === 0) return

    // NoteMap notes for same measure, staff 1, no rests — sorted by beat
    const nmNotes = Array.from(noteMap.notes.values())
      .filter(n => n.measureNum === measureNum && n.staff === 1 && n.step !== 'R')
      .sort((a, b) => a.beat - b.beat)

    // Positional zip — counts must match; if they don't, skip mismatched tail
    const len = Math.min(vrvNotes.length, nmNotes.length)
    for (let i = 0; i < len; i++) {
      toVrv.set(nmNotes[i].id, vrvNotes[i].id)
      fromVrv.set(vrvNotes[i].id, nmNotes[i].id)
    }
  })

  return { toVrv, fromVrv }
}

// Build element map from Verovio SVG DOM.
function buildElementMap(container: Element): Map<string, NoteElement> {
  const elementMap = new Map<string, NoteElement>()
  const measureEls = Array.from(container.querySelectorAll('g.measure'))

  measureEls.forEach((el, index) => {
    const measureNum = index + 1
    const bbox = (el as Element).getBoundingClientRect()
    if (bbox.width === 0) return

    const staffEls = Array.from(el.querySelectorAll('g.staff'))
    const staffBboxes = staffEls
      .map(s => s.getBoundingClientRect())
      .filter(b => b.width > 0)

    const id = `measure-${index}`
    elementMap.set(id, { id, measureNum, bbox, staffBboxes })
  })

  return elementMap
}

// Find which measure+staff a screen coordinate hits.
// Only matches inside actual g.staff bounds — clicking between staves or in margins returns null.
function findMeasureAtPoint(
  clientX: number, clientY: number,
  elementMap: Map<string, NoteElement>
): { measureNum: number; staffIndex: number } | null {
  for (const el of elementMap.values()) {
    for (let i = 0; i < el.staffBboxes.length; i++) {
      const b = el.staffBboxes[i]
      if (clientX >= b.left && clientX <= b.right && clientY >= b.top && clientY <= b.bottom) {
        return { measureNum: el.measureNum, staffIndex: i }
      }
    }
  }
  return null
}

function lassoIntersects(
  bbox: DOMRect,
  lasso: { left: number; top: number; right: number; bottom: number }
): boolean {
  return (
    bbox.left   < lasso.right  &&
    bbox.right  > lasso.left   &&
    bbox.top    < lasso.bottom &&
    bbox.bottom > lasso.top
  )
}

const NOTE_COLORS: Record<string, string> = {
  CT: '#3b82f6',
  'NCT-diatonic': '#222222',
  'NCT-chromatic': '#f97316',
  unanalyzed: '#9ca3af',
}

function applyNoteColors(
  container: Element,
  annotations: Record<string, any>,
  toVrv: Map<string, string>,
) {
  Object.values(annotations)
    .filter(a => a.layer === 'noteColor')
    .forEach(ann => {
      ann.noteIds?.forEach((id: string) => {
        // id is a noteMap ID — translate to Verovio SVG ID for DOM lookup
        const vrvId = toVrv.get(id) ?? id
        const el = container.querySelector(`#${CSS.escape(vrvId)}`)
        if (!el) return
        const color = NOTE_COLORS[ann.colorType] ?? NOTE_COLORS.unanalyzed
        el.querySelectorAll('path, use, ellipse, rect').forEach(shape => {
          (shape as SVGElement).style.fill = color
        })
      })
    })
}

function clearNoteColors(container: Element) {
  container.querySelectorAll('path, use, ellipse, rect').forEach(el => {
    (el as SVGElement).style.fill = ''
  })
}

// ── ScoreView ─────────────────────────────────────────────────────────────────

export function ScoreView() {
  const { t } = useTranslation()
  const { xmlString, metadata } = useScoreStore()
  const { selection, setSelection, showContextMenu, hideContextMenu } = useSelectionStore()
  const visible = useLayerStore(s => s.visible)
  const annotations = useAnnotationStore(s => s.annotations)
  const { currentMeasure, isPlaying } = usePlaybackStore()
  const highlightedMeasure = isPlaying ? currentMeasure : null

  const setToVrv = useScoreStore(s => s.setToVrv)
  const toVrv    = useScoreStore(s => s.toVrv)
  const noteMap  = useScoreStore(s => s.noteMap)
  // fromVrv: verovioId → noteMapId — only used in click handlers, kept as ref (no re-render needed)
  const fromVrvRef = useRef(new Map<string, string>())

  const scoreRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string>('')
  const [rendering, setRendering] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [elementMap, setElementMap] = useState<Map<string, NoteElement>>(new Map())
  const [harmonies, setHarmonies] = useState<HarmonyItem[]>([])

  // Drag-lasso state (all via refs — no React state to avoid lag)
  type LassoState = { startX: number; startY: number; currentX: number; currentY: number }
  const dragStartRef   = useRef<{ x: number; y: number } | null>(null)
  const didDragRef     = useRef(false)
  const dragStateRef   = useRef<LassoState | null>(null)
  const lassoRectRef   = useRef<SVGRectElement>(null)

  const renderKeyRef = useRef(0)

  // Core render function
  const doRender = useCallback((xml: string) => {
    const key = ++renderKeyRef.current
    setRendering(true)
    setScoreError(null)

    renderWithVerovio(xml).then(svgs => {
      if (key !== renderKeyRef.current) return
      setSvgContent(svgs.join('\n'))
      setRendering(false)
    }).catch(e => {
      if (key !== renderKeyRef.current) return
      console.error('verovio render error:', e)
      setScoreError(`Render error: ${e?.message ?? e}`)
      setRendering(false)
    })

    return () => { renderKeyRef.current++ }
  }, [])

  // Render when XML changes
  useEffect(() => {
    if (!xmlString) { setSvgContent(''); setHarmonies([]); return }
    setHarmonies(parseHarmonies(xmlString))
    return doRender(xmlString)
  }, [xmlString, doRender])

  // Build element map after SVG is in DOM.
  // requestAnimationFrame ensures layout has run so getBoundingClientRect() is valid.
  useEffect(() => {
    if (!svgContent || !scoreRef.current) return
    const container = scoreRef.current.querySelector('.vrv-svg')
    if (!container) return

    requestAnimationFrame(() => {
      const eMap = buildElementMap(container)
      setElementMap(eMap)
      let localToVrv = new Map<string, string>()
      if (noteMap) {
        const maps = buildVrvNoteIdMap(container, noteMap)
        localToVrv = maps.toVrv
        fromVrvRef.current = maps.fromVrv
        setToVrv(localToVrv)
      }
      if (visible.noteColor) applyNoteColors(container, annotations, localToVrv)
    })
  // noteMap in deps: if noteMap arrives after svgContent (async session restore),
  // this effect re-fires and builds the ID maps correctly.
  }, [svgContent, noteMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reapply note colors when layer/annotations change
  useEffect(() => {
    if (!scoreRef.current) return
    const container = scoreRef.current.querySelector('.vrv-svg')
    if (!container) return
    if (visible.noteColor) applyNoteColors(container, annotations, toVrv)
    else clearNoteColors(container)
  }, [visible.noteColor, annotations, toVrv])

  // ── Mouse handlers for drag-lasso ─────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    didDragRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    if (lassoRectRef.current) lassoRectRef.current.style.display = 'none'
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      if (!didDragRef.current) {
        didDragRef.current = true
        scoreRef.current?.classList.add('dragging')
      }
      dragStateRef.current = {
        startX: dragStartRef.current.x,
        startY: dragStartRef.current.y,
        currentX: e.clientX,
        currentY: e.clientY,
      }

      // Direct DOM update for lasso rect — no React re-render = no lag
      if (lassoRectRef.current && scoreRef.current) {
        const cr = scoreRef.current.getBoundingClientRect()
        const x = Math.min(dragStartRef.current.x, e.clientX) - cr.left
        const y = Math.min(dragStartRef.current.y, e.clientY) - cr.top
        const w = Math.abs(e.clientX - dragStartRef.current.x)
        const h = Math.abs(e.clientY - dragStartRef.current.y)
        const r = lassoRectRef.current
        r.setAttribute('x', String(x))
        r.setAttribute('y', String(y))
        r.setAttribute('width', String(w))
        r.setAttribute('height', String(h))
        r.style.display = ''
      }

    }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const drag = dragStateRef.current
    dragStartRef.current = null
    dragStateRef.current = null
    if (lassoRectRef.current) lassoRectRef.current.style.display = 'none'
    scoreRef.current?.classList.remove('dragging')

    if (!didDragRef.current || !drag) return

    const lassoRect = {
      left:   Math.min(drag.startX, drag.currentX),
      top:    Math.min(drag.startY, drag.currentY),
      right:  Math.max(drag.startX, drag.currentX),
      bottom: Math.max(drag.startY, drag.currentY),
    }

    const container = scoreRef.current?.querySelector('.vrv-svg')
    if (!container) return

    const allMeasures = Array.from(container.querySelectorAll('g.measure'))
    const hitNoteIds: string[] = []
    const hitMeasureNums: number[] = []

    container.querySelectorAll('g.note').forEach(noteEl => {
      const bbox = noteEl.getBoundingClientRect()
      if (lassoIntersects(bbox, lassoRect) && noteEl.id) {
        // Translate Verovio ID → noteMap ID (stable, renderer-agnostic)
        hitNoteIds.push(fromVrvRef.current.get(noteEl.id) ?? noteEl.id)
        const measureEl = noteEl.closest('g.measure')
        const idx = measureEl ? allMeasures.indexOf(measureEl) : -1
        if (idx >= 0) hitMeasureNums.push(idx + 1)
      }
    })

    if (hitNoteIds.length > 0) {
      const minM = Math.min(...hitMeasureNums)
      const maxM = Math.max(...hitMeasureNums)
      setSelection({ type: 'notes', measureStart: minM, measureEnd: maxM, noteIds: hitNoteIds, anchorMeasure: minM })
      showContextMenu(drag.currentX, drag.currentY)
    } else {
      setSelection(null)
      hideContextMenu()
    }
  }, [setSelection, showContextMenu, hideContextMenu])

  const handleMouseLeave = useCallback(() => {
    dragStartRef.current = null
    didDragRef.current = false
    dragStateRef.current = null
    if (lassoRectRef.current) lassoRectRef.current.style.display = 'none'
    scoreRef.current?.classList.remove('dragging')
  }, [])

  // ── Click handlers ─────────────────────────────────────────────────────────

  const handleScoreClick = useCallback((e: React.MouseEvent) => {
    if (didDragRef.current) return

    // Harmony/chord symbol click
    const harmEl = (e.target as Element).closest?.('g.harm') as SVGGElement | null
    if (harmEl && !e.shiftKey) {
      const allMeasures = Array.from(document.querySelectorAll('g.measure'))
      const measureEl = harmEl.closest('g.measure') as Element | null
      const measureIndex = measureEl ? allMeasures.indexOf(measureEl) : -1
      const measureNum = measureIndex >= 0 ? measureIndex + 1 : 1
      setSelection({ type: 'note', measureStart: measureNum, measureEnd: measureNum, noteIds: [harmEl.id], anchorMeasure: measureNum })
      showContextMenu(e.clientX, e.clientY)
      return
    }

    // Note click
    const noteEl = (e.target as Element).closest?.('g.note') as SVGGElement | null
    if (noteEl && !e.shiftKey) {
      const allMeasures = Array.from(document.querySelectorAll('g.measure'))
      const measureEl = noteEl.closest('g.measure') as Element | null
      const measureIndex = measureEl ? allMeasures.indexOf(measureEl) : -1
      const measureNum = measureIndex >= 0 ? measureIndex + 1 : 1
      // Translate Verovio ID → noteMap ID
      const noteMapId = fromVrvRef.current.get(noteEl.id) ?? noteEl.id
      setSelection({ type: 'note', measureStart: measureNum, measureEnd: measureNum, noteIds: [noteMapId], anchorMeasure: measureNum })
      showContextMenu(e.clientX, e.clientY)
      return
    }

    const hit = findMeasureAtPoint(e.clientX, e.clientY, elementMap)
    if (!hit) {
      hideContextMenu()
      setSelection(null)
      return
    }
    const { measureNum, staffIndex } = hit

    if (e.shiftKey && selection) {
      const anchor = selection.anchorMeasure ?? selection.measureStart
      const minM = Math.min(anchor, measureNum)
      const maxM = Math.max(anchor, measureNum)
      setSelection({ type: 'measures', measureStart: minM, measureEnd: maxM, noteIds: [], anchorMeasure: anchor, staffIndex: selection.staffIndex ?? staffIndex })
      showContextMenu(e.clientX, e.clientY)
      return
    }

    setSelection({ type: 'measure', measureStart: measureNum, measureEnd: measureNum, noteIds: [], anchorMeasure: measureNum, staffIndex })
    showContextMenu(e.clientX, e.clientY)
  }, [selection, setSelection, showContextMenu, hideContextMenu, elementMap])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const hit = findMeasureAtPoint(e.clientX, e.clientY, elementMap)
    if (!hit) return
    setSelection({ type: 'measure', measureStart: hit.measureNum, measureEnd: hit.measureNum, noteIds: [], anchorMeasure: hit.measureNum, staffIndex: hit.staffIndex })
    showContextMenu(e.clientX, e.clientY)
  }, [setSelection, showContextMenu, elementMap])

  if (!xmlString) {
    return (
      <div className="score-empty">
        <div className="score-empty-icon">♩</div>
        <p>{t('app.noScore')}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <OpenFileButton />
          <LoadSampleButton />
        </div>
      </div>
    )
  }

  return (
    <div className="score-view">
      <FormalStrip annotations={annotations} metadata={metadata} />
      <div className="score-scroll" ref={scrollRef}>
        <div
          ref={scoreRef}
          className="score-container"
          onClick={handleScoreClick}
          onContextMenu={handleContextMenu}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {rendering && <div className="score-loading">Rendering score…</div>}
          {scoreError && <div className="score-error">{scoreError}</div>}
          {svgContent && (
            <div
              className="vrv-svg"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
          {svgContent && (
            <AnnotationOverlay
              annotations={annotations}
              visible={visible}
              elementMap={elementMap}
              containerRef={scoreRef}
              scrollRef={scrollRef}
              playbackMeasure={highlightedMeasure}
              toVrv={toVrv}
            />
          )}
          {svgContent && (
            <SelectionOverlay
              selection={selection}
              elementMap={elementMap}
              containerRef={scoreRef}
              scrollRef={scrollRef}
              toVrv={toVrv}
            />
          )}
          {/* Lasso rect — direct DOM updates, zero React re-renders */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 11 }}>
            <rect ref={lassoRectRef} style={{ display: 'none' }} fill="rgba(124,106,247,0.08)" stroke="#7c6af7" strokeDasharray="5 3" strokeWidth="1.5" x="0" y="0" width="0" height="0" />
          </svg>
          {svgContent && <FreehandCanvas containerRef={scoreRef} />}
        </div>
      </div>
      <ContextMenu />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OpenFileButton() {
  const { t } = useTranslation()
  const handleClick = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,.musicxml,.XML'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const noteMap = parseMusicXml(text)
      useScoreStore.getState().setXml(text, file.name)
      useScoreStore.getState().setNoteMap(noteMap)
    }
    input.click()
  }
  return <button className="btn-open-score" onClick={handleClick}>{t('app.openFile')}</button>
}

function LoadSampleButton() {
  const handleClick = async () => {
    const saved = await loadFile('DONNALEE.XML')

    let text: string
    if (saved) {
      text = saved.xml
      useAnnotationStore.getState().loadAnnotations(saved.annotations)
    } else {
      const res = await fetch('/DONNALEE.XML')
      text = await res.text()
      await saveFile('DONNALEE.XML', text, {})
    }

    const noteMap = parseMusicXml(text)
    useScoreStore.getState().setXml(text, 'DONNALEE.XML')
    useScoreStore.getState().setNoteMap(noteMap)

    useLibraryStore.getState().addPiece({
      id: 'DONNALEE.XML',
      title: noteMap.metadata.title || 'Donna Lee',
      composer: noteMap.metadata.composer || 'Charlie Parker',
      fileName: 'DONNALEE.XML',
      totalMeasures: noteMap.metadata.totalMeasures,
      lastOpened: Date.now(),
      key: noteMap.metadata.key,
      timeSignature: noteMap.metadata.timeSignature,
    })
    useLibraryStore.getState().setActive('DONNALEE.XML')
  }
  return (
    <button className="btn-open-score" onClick={handleClick} style={{ borderColor: '#22c55e', color: '#22c55e' }}>
      ♩ Donna Lee
    </button>
  )
}
