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
import type { DragState } from './SelectionOverlay'
import { ContextMenu } from '../menus/ContextMenu'
import './ScoreView.css'

// ── Verovio initialisation ────────────────────────────────────────────────────
// verovio/wasm exports createVerovioModule (async WASM factory)
// verovio/esm  exports VerovioToolkit (class wrapper)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no bundled TS declarations for verovio
import createVerovioModule from 'verovio/wasm'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { VerovioToolkit } from 'verovio/esm'

let vrvToolkitPromise: Promise<any> | null = null

function getVerovioToolkit(): Promise<any> {
  if (vrvToolkitPromise) return vrvToolkitPromise
  vrvToolkitPromise = createVerovioModule().then((mod: any) => new VerovioToolkit(mod))
  return vrvToolkitPromise!
}

// Render MusicXML → one SVG string per page
async function renderWithVerovio(xmlString: string): Promise<string[]> {
  const tk = await getVerovioToolkit()

  tk.setOptions({
    pageWidth:        2100,
    scale:            40,
    adjustPageHeight: true,
    header:           'none',
    footer:           'none',
    breaks:           'auto',
    spacingSystem:    12,
  })

  const preparedXml = prepareMusicXML(xmlString)
  tk.loadData(preparedXml)
  console.log('[Verovio]', tk.getLog() || '(no log)')
  ;(window as any).__vrvTk = tk   // dev helper: run tk.getMEI() in console
  const pageCount: number = tk.getPageCount()
  const svgs: string[] = []
  for (let i = 1; i <= pageCount; i++) {
    svgs.push(tk.renderToSVG(i, false))  // false = no XML declaration
  }
  return svgs
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NoteElement {
  id: string
  measureNum: number
  bbox: DOMRect
}

// Build element map from Verovio SVG DOM.
// Verovio renders each measure as <g class="measure"> inside the SVG.
// We query all of them in order and assign measure numbers 1, 2, 3…
function buildElementMap(container: Element): Map<string, NoteElement> {
  const elementMap = new Map<string, NoteElement>()
  const measureEls = Array.from(container.querySelectorAll('g.measure'))

  measureEls.forEach((el, index) => {
    const measureNum = index + 1
    const bbox = (el as Element).getBoundingClientRect()
    if (bbox.width === 0) return

    const id = `measure-${index}`
    elementMap.set(id, { id, measureNum, bbox })
  })

  return elementMap
}

// Find which measure contains a screen coordinate (clientX, clientY)
function findMeasureAtPoint(clientX: number, clientY: number, elementMap: Map<string, NoteElement>): number | null {
  for (const el of elementMap.values()) {
    const b = el.bbox
    if (clientX >= b.left && clientX <= b.right && clientY >= b.top && clientY <= b.bottom) {
      return el.measureNum
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

function applyNoteColors(container: Element, annotations: Record<string, any>) {
  Object.values(annotations)
    .filter(a => a.layer === 'noteColor')
    .forEach(ann => {
      ann.noteIds?.forEach((id: string) => {
        const el = container.querySelector(`#${id}`)
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
  const { currentMeasure: highlightedMeasure } = usePlaybackStore()

  const scoreRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string>('')
  const [rendering, setRendering] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [elementMap, setElementMap] = useState<Map<string, NoteElement>>(new Map())
  const [harmonies, setHarmonies] = useState<HarmonyItem[]>([])

  // Drag-lasso state
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const didDragRef = useRef(false)
  const dragStateRef = useRef<DragState | null>(null)
  useEffect(() => { dragStateRef.current = dragState }, [dragState])

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
      if (visible.noteColor) applyNoteColors(container, annotations)
    })
  }, [svgContent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reapply note colors when layer/annotations change
  useEffect(() => {
    if (!scoreRef.current) return
    const container = scoreRef.current.querySelector('.vrv-svg')
    if (!container) return
    if (visible.noteColor) applyNoteColors(container, annotations)
    else clearNoteColors(container)
  }, [visible.noteColor, annotations])

  // ── Mouse handlers for drag-lasso ─────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    didDragRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      didDragRef.current = true
      setDragState({
        active: true,
        startX: dragStartRef.current.x,
        startY: dragStartRef.current.y,
        currentX: e.clientX,
        currentY: e.clientY,
      })
    }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    dragStartRef.current = null
    const drag = dragStateRef.current
    setDragState(null)

    if (!didDragRef.current || !drag) return

    const lassoRect = {
      left:   Math.min(drag.startX, drag.currentX),
      top:    Math.min(drag.startY, drag.currentY),
      right:  Math.max(drag.startX, drag.currentX),
      bottom: Math.max(drag.startY, drag.currentY),
    }

    // Collect all g.note elements that intersect the lasso rect
    const container = scoreRef.current?.querySelector('.vrv-svg')
    if (!container) return

    const allMeasures = Array.from(container.querySelectorAll('g.measure'))
    const hitNoteIds: string[] = []
    const hitMeasureNums: number[] = []

    container.querySelectorAll('g.note').forEach(noteEl => {
      const bbox = noteEl.getBoundingClientRect()
      if (lassoIntersects(bbox, lassoRect) && noteEl.id) {
        hitNoteIds.push(noteEl.id)
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
    setDragState(null)
  }, [])

  // ── Click handlers ─────────────────────────────────────────────────────────

  const handleScoreClick = useCallback((e: React.MouseEvent) => {
    if (didDragRef.current) return

    // Check for note click first — Verovio assigns IDs to every g.note element
    const noteEl = (e.target as Element).closest?.('g.note') as SVGGElement | null
    if (noteEl && !e.shiftKey) {
      const noteId = noteEl.id
      const measureEl = noteEl.closest('g.measure') as Element | null
      const allMeasures = Array.from(document.querySelectorAll('g.measure'))
      const measureIndex = measureEl ? allMeasures.indexOf(measureEl) : -1
      const measureNum = measureIndex >= 0 ? measureIndex + 1 : 1
      setSelection({ type: 'note', measureStart: measureNum, measureEnd: measureNum, noteIds: [noteId], anchorMeasure: measureNum })
      showContextMenu(e.clientX, e.clientY)
      return
    }

    const measureNum = findMeasureAtPoint(e.clientX, e.clientY, elementMap)
    if (measureNum === null) {
      hideContextMenu()
      setSelection(null)
      return
    }

    if (e.shiftKey && selection) {
      const anchor = selection.anchorMeasure ?? selection.measureStart
      const minM = Math.min(anchor, measureNum)
      const maxM = Math.max(anchor, measureNum)
      setSelection({ type: 'measures', measureStart: minM, measureEnd: maxM, noteIds: [], anchorMeasure: anchor })
      showContextMenu(e.clientX, e.clientY)
      return
    }

    setSelection({ type: 'measure', measureStart: measureNum, measureEnd: measureNum, noteIds: [], anchorMeasure: measureNum })
    showContextMenu(e.clientX, e.clientY)
  }, [selection, setSelection, showContextMenu, hideContextMenu, elementMap])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const measureNum = findMeasureAtPoint(e.clientX, e.clientY, elementMap)
    if (!measureNum) return
    setSelection({ type: 'measure', measureStart: measureNum, measureEnd: measureNum, noteIds: [], anchorMeasure: measureNum })
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
          className={`score-container${dragState?.active ? ' dragging' : ''}`}
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
            />
          )}
          {svgContent && (
            <SelectionOverlay
              selection={selection}
              dragState={dragState}
              elementMap={elementMap}
              containerRef={scoreRef}
              scrollRef={scrollRef}
            />
          )}
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
