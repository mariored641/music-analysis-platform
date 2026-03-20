import { useRef, useEffect, useState, useCallback } from 'react'
import { useScoreStore } from '../../store/scoreStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useLayerStore } from '../../store/layerStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useTranslation } from 'react-i18next'
import { parseMusicXml, parseHarmonies, type HarmonyItem } from '../../services/xmlParser'
import { saveFile, loadFile } from '../../services/storageService'
import { AnnotationOverlay } from './AnnotationOverlay'
import { HarmonyOverlay } from './HarmonyOverlay'
import { FormalStrip } from './FormalStrip'
import { FreehandCanvas } from './FreehandCanvas'
import { ContextMenu } from '../menus/ContextMenu'
import './ScoreView.css'

// webmscore is loaded as a global via CDN <script> tag in index.html
declare const WebMscore: any

export interface NoteElement {
  id: string
  measureNum: number
  bbox: DOMRect
}

interface PositionsData {
  elements: Array<{ id: number; page: number; x: number; y: number; sx: number; sy: number }>
  pageSize: { width: number; height: number }
}

// Wait for webmscore CDN to load and be ready
let wmReadyPromise: Promise<void> | null = null
function waitForWebMscore(): Promise<void> {
  if (wmReadyPromise) return wmReadyPromise
  wmReadyPromise = new Promise((resolve, reject) => {
    const check = () => {
      if (typeof WebMscore !== 'undefined') {
        WebMscore.ready.then(resolve).catch(reject)
      } else {
        setTimeout(check, 100)
      }
    }
    check()
    setTimeout(() => reject(new Error('webmscore CDN load timeout')), 30000)
  })
  return wmReadyPromise
}

// Strip XML/DOCTYPE declarations so SVG strings can be injected via innerHTML
function stripXmlDeclarations(svg: string): string {
  return svg
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .trim()
}

// Render MusicXML → SVG strings (one per page) + measure positions
async function renderWithWebMscore(xmlString: string): Promise<{ svgs: string[]; positions: PositionsData }> {
  await waitForWebMscore()
  const encoder = new TextEncoder()
  const data = encoder.encode(xmlString)
  const score = await WebMscore.load('musicxml', data)
  try {
    const meta = await score.metadata()
    const pageCount: number = meta.pages ?? 1
    const svgs: string[] = []
    for (let i = 0; i < pageCount; i++) {
      const svg: string = await score.saveSvg(i, false)
      svgs.push(stripXmlDeclarations(svg))
    }
    const posJson: string = await score.savePositions(false)
    const positions: PositionsData = JSON.parse(posJson)
    return { svgs, positions }
  } finally {
    score.destroy()
  }
}

// Build element map from webmscore positions data.
// positions.elements: one entry per measure (id = 0-based measure index),
// with x/y/sx/sy in SVG page coordinates.
// Each SVG page is a <svg> element inside .wm-svg — use getBoundingClientRect()
// to convert SVG coordinates to screen coordinates.
function buildElementMap(container: Element, positions: PositionsData): Map<string, NoteElement> {
  const elementMap = new Map<string, NoteElement>()
  const svgEls = Array.from(container.querySelectorAll(':scope > svg'))
  const { width: svgW, height: svgH } = positions.pageSize

  for (const measure of positions.elements) {
    const pageEl = svgEls[measure.page]
    if (!pageEl) continue

    const svgRect = pageEl.getBoundingClientRect()
    if (svgRect.width === 0) continue

    const scaleX = svgRect.width / svgW
    const scaleY = svgRect.height / svgH

    const left   = svgRect.left + measure.x * scaleX
    const top    = svgRect.top  + measure.y * scaleY
    const width  = measure.sx * scaleX
    const height = measure.sy * scaleY

    const id = `measure-${measure.id}`
    const bbox = {
      left, top, right: left + width, bottom: top + height,
      width, height, x: left, y: top,
      toJSON: () => ({}),
    } as DOMRect

    elementMap.set(id, { id, measureNum: measure.id + 1, bbox })
  }

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
  const [positions, setPositions] = useState<PositionsData | null>(null)
  const [rendering, setRendering] = useState(false)
  const [scoreError, setScoreError] = useState<string | null>(null)
  const [elementMap, setElementMap] = useState<Map<string, NoteElement>>(new Map())
  const [harmonies, setHarmonies] = useState<HarmonyItem[]>([])

  const renderKeyRef = useRef(0)

  // Core render function
  const doRender = useCallback((xml: string) => {
    const key = ++renderKeyRef.current
    setRendering(true)
    setScoreError(null)

    renderWithWebMscore(xml).then(({ svgs, positions: pos }) => {
      if (key !== renderKeyRef.current) return
      setSvgContent(svgs.join('\n'))
      setPositions(pos)
      setRendering(false)
    }).catch(e => {
      if (key !== renderKeyRef.current) return
      console.error('webmscore render error:', e)
      setScoreError(`Render error: ${e?.message ?? e}`)
      setRendering(false)
    })

    return () => { renderKeyRef.current++ }
  }, [])

  // Render when XML changes
  useEffect(() => {
    if (!xmlString) { setSvgContent(''); setPositions(null); setHarmonies([]); return }
    setHarmonies(parseHarmonies(xmlString))
    return doRender(xmlString)
  }, [xmlString, doRender])

  // Build element map after SVG is injected into DOM and positions are available.
  // requestAnimationFrame ensures SVG elements have non-zero layout dimensions.
  useEffect(() => {
    if (!svgContent || !positions || !scoreRef.current) return
    const container = scoreRef.current.querySelector('.wm-svg')
    if (!container) return

    requestAnimationFrame(() => {
      const eMap = buildElementMap(container, positions)
      setElementMap(eMap)
      if (visible.noteColor) applyNoteColors(container, annotations)
    })
  }, [svgContent, positions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reapply note colors when layer/annotations change
  useEffect(() => {
    if (!scoreRef.current) return
    const container = scoreRef.current.querySelector('.wm-svg')
    if (!container) return
    if (visible.noteColor) applyNoteColors(container, annotations)
    else clearNoteColors(container)
  }, [visible.noteColor, annotations])

  const handleScoreClick = useCallback((e: React.MouseEvent) => {
    const measureNum = findMeasureAtPoint(e.clientX, e.clientY, elementMap)
    if (measureNum === null) {
      if (selection) { hideContextMenu(); setSelection(null) }
      return
    }

    if (e.shiftKey && selection) {
      const minM = Math.min(selection.measureStart, measureNum)
      const maxM = Math.max(selection.measureEnd ?? selection.measureStart, measureNum)
      setSelection({ type: 'measures', measureStart: minM, measureEnd: maxM, noteIds: [] })
      showContextMenu(e.clientX, e.clientY)
      return
    }

    setSelection({ type: 'measure', measureStart: measureNum, measureEnd: measureNum, noteIds: [] })
    showContextMenu(e.clientX, e.clientY)
  }, [selection, setSelection, showContextMenu, hideContextMenu, elementMap])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const measureNum = findMeasureAtPoint(e.clientX, e.clientY, elementMap)
    if (!measureNum) return
    setSelection({ type: 'measure', measureStart: measureNum, measureEnd: measureNum, noteIds: [] })
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
        >
          {rendering && <div className="score-loading">Rendering score…</div>}
          {scoreError && <div className="score-error">{scoreError}</div>}
          {svgContent && (
            <div
              className="wm-svg"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
          {svgContent && (
            <AnnotationOverlay
              annotations={annotations}
              visible={visible}
              elementMap={elementMap}
              containerRef={scoreRef}
              playbackMeasure={highlightedMeasure}
            />
          )}
          {svgContent && harmonies.length > 0 && (
            <HarmonyOverlay
              harmonies={harmonies}
              elementMap={elementMap}
              containerRef={scoreRef}
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
