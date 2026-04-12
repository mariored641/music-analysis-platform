import { useRef, useEffect, useState, useCallback } from 'react'
import { useScoreStore } from '../../store/scoreStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useResearchStore } from '../../store/researchStore'
import { useLayerStore, getEffectiveNoteColors } from '../../store/layerStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useTranslation } from 'react-i18next'
import { parseMusicXml, parseHarmonies, type HarmonyItem } from '../../services/xmlParser'
import { saveFile, loadFile } from '../../services/storageService'
import { renderScore } from '../../renderer/index'
import { renderWithOSMD, buildOSMDElementMap } from '../../renderer/osmdAdapter'
import { AnnotationOverlay } from './AnnotationOverlay'
import { HarmonyOverlay } from './HarmonyOverlay'
import { FormalStrip } from './FormalStrip'
import { FreehandCanvas } from './FreehandCanvas'
import type { NoteMap } from '../../types/score'
import { ContextMenu } from '../menus/ContextMenu'
import './ScoreView.css'

// OSMD is the default renderer. Use ?renderer=native to force the native renderer.
const useOSMDRenderer = new URLSearchParams(window.location.search).get('renderer') !== 'native'

// Renderer-agnostic CSS selectors — OSMD uses vf-* prefixed VexFlow classes
const SEL_MEASURE = useOSMDRenderer ? 'g.vf-measure' : 'g.measure'
const SEL_NOTE = useOSMDRenderer ? '.note' : 'g.note'

// Decompress MXL (zipped MusicXML) to XML string
async function extractXmlFromFile(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('Invalid MXL: missing META-INF/container.xml')
  const containerXml = await containerFile.async('string')
  const match = containerXml.match(/full-path="([^"]+\.xml)"/i)
  if (!match) throw new Error('Invalid MXL: cannot find rootfile')
  const rootFile = zip.file(match[1])
  if (!rootFile) throw new Error(`Invalid MXL: rootfile "${match[1]}" not found`)
  return rootFile.async('string')
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NoteElement {
  id: string
  measureNum: number
  bbox: DOMRect
  staffBboxes: DOMRect[]  // one per g.staff child — used for hit detection and selection display
}

// Build element map from native renderer SVG DOM.
// Stores positions RELATIVE to the container element (not viewport),
// so they remain correct after the user scrolls.
function buildElementMap(container: Element): Map<string, NoteElement> {
  const elementMap = new Map<string, NoteElement>()
  const containerRect = container.getBoundingClientRect()
  const measureEls = Array.from(container.querySelectorAll(SEL_MEASURE))

  measureEls.forEach((el, index) => {
    const measureNum = index + 1
    const absBox = (el as Element).getBoundingClientRect()
    if (absBox.width === 0) return

    // Container-relative bbox (scroll-independent)
    const bbox = new DOMRect(
      absBox.left - containerRect.left,
      absBox.top - containerRect.top,
      absBox.width,
      absBox.height
    )

    // Native renderer has no g.staff wrappers — fall back to measure bbox as single staff
    const staffEls = Array.from(el.querySelectorAll('g.staff'))
    const staffBboxes = staffEls.length > 0
      ? staffEls
          .map(s => {
            const sb = s.getBoundingClientRect()
            return new DOMRect(
              sb.left - containerRect.left,
              sb.top - containerRect.top,
              sb.width,
              sb.height
            )
          })
          .filter(b => b.width > 0)
      : [bbox]   // native renderer: one implicit staff per measure = the measure bbox itself

    const id = `measure-${index}`
    elementMap.set(id, { id, measureNum, bbox, staffBboxes })
  })

  return elementMap
}

// Find which measure+staff a screen coordinate hits.
// elementMap stores container-relative positions, so we convert clientX/Y first.
function findMeasureAtPoint(
  clientX: number, clientY: number,
  elementMap: Map<string, NoteElement>,
  containerRect: DOMRect
): { measureNum: number; staffIndex: number } | null {
  const x = clientX - containerRect.left
  const y = clientY - containerRect.top
  for (const el of elementMap.values()) {
    for (let i = 0; i < el.staffBboxes.length; i++) {
      const b = el.staffBboxes[i]
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
        return { measureNum: el.measureNum, staffIndex: i }
      }
    }
  }
  return null
}

// Get all noteMap IDs in a measure range (for converting measure clicks → note selection)
function getNoteIdsInRange(noteMap: NoteMap | null, start: number, end: number): string[] {
  if (!noteMap) return []
  return Array.from(noteMap.notes.values())
    .filter(n => n.measureNum >= start && n.measureNum <= end && n.step !== 'R')
    .sort((a, b) => a.measureNum - b.measureNum || a.beat - b.beat)
    .map(n => n.id)
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


// SVG element classes that can be colored by clicking
// Use class names exactly as Verovio generates them
const SVG_COLORABLE = ['dynam', 'artic', 'hairpin', 'tempo', 'fermata', 'trill', 'turn', 'mordent', 'ornament', 'dir']

// Proximity hit-padding in pixels — makes thin elements like hairpins easy to click
// Also compensates for use-element bbox underreporting (fermata shows as 3x6px)
const SVG_HIT_PADDING = 8

// Find the nearest SVG colorable element within SVG_HIT_PADDING pixels of the click.
// Handles thin/stroke-only elements (hairpins, slurs) that are impossible to hit precisely.
function findNearbyColorableElement(
  clientX: number, clientY: number,
  container: Element,
): SVGGElement | null {
  let bestEl: SVGGElement | null = null
  let bestDist = SVG_HIT_PADDING + 1

  SVG_COLORABLE.forEach(cls => {
    container.querySelectorAll(`g.${cls}`).forEach(raw => {
      const el = raw as SVGGElement
      const bbox = el.getBoundingClientRect()
      if (bbox.width === 0 && bbox.height === 0) return
      // Distance from click point to nearest edge of bbox (0 if inside)
      const dx = Math.max(bbox.left - clientX, 0, clientX - bbox.right)
      const dy = Math.max(bbox.top  - clientY, 0, clientY - bbox.bottom)
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < bestDist) {
        bestDist = dist
        bestEl = el
      }
    })
  })

  return bestEl
}

function applySvgColors(container: Element, annotations: Record<string, any>, visible: Record<string, boolean>) {
  // Clear previous svgColor styles (both fill and stroke)
  SVG_COLORABLE.forEach(cls => {
    container.querySelectorAll(`g.${cls}`).forEach(el => {
      ;(el as SVGElement).style.color = ''
      ;(el as SVGElement).style.stroke = ''
      el.querySelectorAll('*').forEach(child => {
        ;(child as SVGElement).style.fill = ''
        ;(child as SVGElement).style.color = ''
        ;(child as SVGElement).style.stroke = ''
      })
    })
  })
  if (!visible.svgColor) return
  Object.values(annotations)
    .filter(a => a.layer === 'svgColor')
    .forEach(ann => {
      const allMeasures = Array.from(container.querySelectorAll(SEL_MEASURE))
      const measureEl = allMeasures[ann.measureStart - 1]
      if (!measureEl) return
      const siblings = Array.from(measureEl.querySelectorAll(`g.${ann.svgClass}`))
      const el = siblings[ann.positionIndex] as SVGElement | undefined
      if (!el) return
      el.style.color = ann.color
      // Smart coloring: stroke-only elements (hairpin, slur) → only change stroke
      // Fill-based elements (dynam text, artic/ferm glyphs) → change fill
      el.querySelectorAll('*').forEach(child => {
        const c = child as SVGElement
        if (c.getAttribute('fill') === 'none') {
          // Stroke-only path (hairpin lines, slur arc) — don't fill the shape
          c.style.stroke = ann.color
        } else {
          c.style.fill  = ann.color
          c.style.color = ann.color
        }
      })
    })
}

function applyNoteColors(
  container: Element,
  annotations: Record<string, any>,
  toVrv: Map<string, string>,
  noteColors: Record<string, string>,
) {
  const noteColorAnns = Object.values(annotations).filter(a => a.layer === 'noteColor')
  let colored = 0, missed = 0
  noteColorAnns.forEach(ann => {
    const color = noteColors[ann.colorType]
    if (!color) return
    ann.noteIds?.forEach((id: string) => {
      const vrvId = toVrv.get(id) ?? id
      const el = container.querySelector(`#${CSS.escape(vrvId)}`)
      if (!el) { missed++; return }
      // Native renderer: .notehead > use; OSMD: element itself IS the notehead
      const notehead = el.querySelector('.notehead') ?? el.querySelector('use') ?? el
      if (!notehead) return
      ;(notehead as SVGElement).style.fill = color
      ;(notehead as SVGElement).style.stroke = color
      notehead.querySelectorAll('use, path, ellipse').forEach(child => {
        (child as SVGElement).style.fill = color
        ;(child as SVGElement).style.stroke = color
      })
      colored++
    })
  })
}

function clearNoteColors(container: Element) {
  // Native renderer: .notehead and children; OSMD: g.vf-notehead and its path children
  container.querySelectorAll('.notehead, .notehead *, g.vf-notehead, g.vf-notehead *').forEach(el => {
    (el as SVGElement).style.fill = ''
    ;(el as SVGElement).style.stroke = ''
  })
}

// ── ScoreView ─────────────────────────────────────────────────────────────────

export function ScoreView() {
  const { t } = useTranslation()
  const { xmlString, metadata } = useScoreStore()
  const { selection, setSelection, clearSelection, showContextMenu, hideContextMenu } = useSelectionStore()
  const scrollToMeasure = useSelectionStore(s => s.scrollToMeasure)
  const setScrollToMeasure = useSelectionStore(s => s.setScrollToMeasure)
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

  // SVG element color picker state
  type SvgColorPickerState = { x: number; y: number; svgClass: string; measureNum: number; positionIndex: number }
  const [svgColorPicker, setSvgColorPicker] = useState<SvgColorPickerState | null>(null)

  // Drag-lasso state (all via refs — no React state to avoid lag)
  type LassoState = { startX: number; startY: number; currentX: number; currentY: number }
  const dragStartRef   = useRef<{ x: number; y: number } | null>(null)
  const didDragRef     = useRef(false)
  const dragStateRef   = useRef<LassoState | null>(null)
  const lassoRectRef   = useRef<SVGRectElement>(null)

  const renderKeyRef = useRef(0)
  const vrvDivRef = useRef<HTMLDivElement>(null)
  const prevSvgRef = useRef('')

  // Manually update vrv-svg innerHTML only when svgContent changes.
  // This prevents React re-renders from wiping inline styles (note colors).
  // After injecting, wait for fonts to load and set data-ready for Playwright (Layer 2 tests).
  // When OSMD is active, it renders directly into the div — skip innerHTML injection.
  useEffect(() => {
    if (!vrvDivRef.current) return
    if (svgContent === prevSvgRef.current) return
    prevSvgRef.current = svgContent
    const div = vrvDivRef.current
    if (useOSMDRenderer) {
      // OSMD already rendered into div — just set data-ready
      div.setAttribute('data-ready', 'true')
      return
    }
    div.removeAttribute('data-ready')
    div.innerHTML = svgContent
    // Fonts are declared in App.css with font-display:block — document.fonts.ready
    // resolves once all registered fonts finish loading.
    document.fonts.ready.then(() => {
      if (div.isConnected) div.setAttribute('data-ready', 'true')
    })
  }, [svgContent])

  // Core render function — supports native (sync) and OSMD (async) renderers
  const doRender = useCallback((xml: string) => {
    const key = ++renderKeyRef.current
    setRendering(true)
    setScoreError(null)

    if (useOSMDRenderer) {
      // OSMD path — async, renders directly into DOM
      const container = vrvDivRef.current
      if (!container) { setRendering(false); return }
      renderWithOSMD(xml, container)
        .then(() => {
          if (key !== renderKeyRef.current) return
          // OSMD rendered into container directly — no svgContent needed
          // Set a sentinel value so the elementMap effect fires
          setSvgContent('__osmd__')
          setRendering(false)
        })
        .catch((e: any) => {
          if (key !== renderKeyRef.current) return
          console.error('OSMD render error:', e)
          setScoreError(`OSMD render error: ${e?.message ?? e}`)
          setRendering(false)
        })
    } else {
      // Native renderer — synchronous
      try {
        const result = renderScore(xml)
        if (key !== renderKeyRef.current) return
        setSvgContent(result.svg)
        setRendering(false)
      } catch (e: any) {
        if (key !== renderKeyRef.current) return
        console.error('native render error:', e)
        setScoreError(`Render error: ${e?.message ?? e}`)
        setRendering(false)
      }
    }

    return () => { renderKeyRef.current++ }
  }, [])

  // Render when XML changes
  useEffect(() => {
    if (!xmlString) { setSvgContent(''); setHarmonies([]); return }
    setHarmonies(parseHarmonies(xmlString))
    return doRender(xmlString)
  }, [xmlString, doRender])

  // Build element map + identity ID maps after SVG is in DOM.
  // requestAnimationFrame ensures layout has run so getBoundingClientRect() is valid.
  // Native renderer: g.note id IS the noteMapId — no positional matching needed.
  useEffect(() => {
    if (!svgContent || !scoreRef.current) return
    const container = scoreRef.current.querySelector('.vrv-svg')
    if (!container) return

    requestAnimationFrame(() => {
      let toVrvMap: Map<string, string>
      let fromVrvMap: Map<string, string>

      if (useOSMDRenderer && noteMap) {
        // OSMD path — walk GraphicSheet for note coordinates
        const result = buildOSMDElementMap(container, noteMap)
        setElementMap(result.elementMap)
        toVrvMap = result.toVrv
        fromVrvMap = result.fromVrv
      } else {
        // Native renderer path — g.note id IS the noteMapId
        const eMap = buildElementMap(container)
        setElementMap(eMap)
        toVrvMap = new Map<string, string>()
        fromVrvMap = new Map<string, string>()
        container.querySelectorAll('g.note[id]').forEach(el => {
          const id = el.id
          if (!id) return
          toVrvMap.set(id, id)
          fromVrvMap.set(id, id)
          ;(el as SVGGElement).dataset.notemapId = id
        })
      }

      setToVrv(toVrvMap)
      fromVrvRef.current = fromVrvMap

      // Read fresh state directly — avoids stale-closure issue when SVG re-renders
      const freshAnnotations = useAnnotationStore.getState().annotations
      const freshVisible = useLayerStore.getState().visible
      if (freshVisible.noteColor) {
        const freshNoteColors = getEffectiveNoteColors(useLayerStore.getState().legendColors)
        applyNoteColors(container, freshAnnotations, toVrvMap, freshNoteColors)
      }
      applySvgColors(container, freshAnnotations, freshVisible)
    })
  }, [svgContent, noteMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selection → CSS classes on SVG note elements (NoghenMadid-style pink highlight)
  useEffect(() => {
    const container = scoreRef.current?.querySelector('.vrv-svg')
    if (!container) return
    container.querySelectorAll('.selected-note').forEach(el => el.classList.remove('selected-note'))
    if (!selection?.noteIds?.length) return
    for (const noteId of selection.noteIds) {
      const vrvId = toVrv.get(noteId) ?? noteId
      const el = document.getElementById(vrvId)
      if (el) el.classList.add('selected-note')
    }
  }, [selection, toVrv])

  // Reapply note colors + svg element colors when layer/annotations change
  useEffect(() => {
    if (!scoreRef.current) return
    const container = scoreRef.current.querySelector('.vrv-svg')
    if (!container) return
    const noteColors = getEffectiveNoteColors(useLayerStore.getState().legendColors)
    if (visible.noteColor) applyNoteColors(container, annotations, toVrv, noteColors)
    else clearNoteColors(container)
    applySvgColors(container, annotations, visible)
  }, [visible.noteColor, visible.svgColor, annotations, toVrv])

  // Reapply note colors when legend color overrides change (subscription avoids deps-array size change)
  useEffect(() => {
    return useLayerStore.subscribe((state, prev) => {
      if (state.legendColors === prev.legendColors) return
      if (!scoreRef.current || !state.visible.noteColor) return
      const container = scoreRef.current.querySelector('.vrv-svg')
      if (!container) return
      applyNoteColors(
        container,
        useAnnotationStore.getState().annotations,
        useScoreStore.getState().toVrv,
        getEffectiveNoteColors(state.legendColors),
      )
    })
  }, [])

  // ── Auto-scroll during playback ─────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || !scrollRef.current || elementMap.size === 0) return
    const el = elementMap.get(`measure-${currentMeasure - 1}`)
    if (!el) return
    const scrollEl = scrollRef.current
    const elTop    = el.bbox.top
    const elBottom = el.bbox.bottom
    const viewH    = scrollEl.clientHeight
    const scrollT  = scrollEl.scrollTop
    // Scroll only if measure is outside the middle 60% of the viewport
    const margin = viewH * 0.2
    if (elTop - margin < scrollT || elBottom + margin > scrollT + viewH) {
      scrollEl.scrollTop = Math.max(0, elTop - viewH * 0.35)
    }
  }, [currentMeasure, isPlaying, elementMap])

  // ── Scroll to measure (from ResearchNotes link clicks) ────────────────────
  useEffect(() => {
    if (!scrollToMeasure || !scrollRef.current || elementMap.size === 0) return
    const el = elementMap.get(`measure-${scrollToMeasure - 1}`)
    if (el) {
      scrollRef.current.scrollTop = Math.max(0, el.bbox.top - 48)
    }
    setScrollToMeasure(null)
  }, [scrollToMeasure, elementMap])

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

    const allMeasures = Array.from(container.querySelectorAll(SEL_MEASURE))
    const hitNoteIds: string[] = []
    const hitMeasureNums: number[] = []

    container.querySelectorAll(SEL_NOTE).forEach(noteEl => {
      const bbox = noteEl.getBoundingClientRect()
      if (lassoIntersects(bbox, lassoRect) && noteEl.id) {
        // Translate Verovio ID → noteMap ID (stable, renderer-agnostic)
        hitNoteIds.push(fromVrvRef.current.get(noteEl.id) ?? noteEl.id)
        const measureEl = noteEl.closest(SEL_MEASURE)
        const idx = measureEl ? allMeasures.indexOf(measureEl) : -1
        if (idx >= 0) hitMeasureNums.push(idx + 1)
      }
    })

    if (hitNoteIds.length > 0) {
      const minM = Math.min(...hitMeasureNums)
      const maxM = Math.max(...hitMeasureNums)
      // Ctrl+lasso: merge with existing selection
      if (e.ctrlKey) {
        const current = useSelectionStore.getState().selection
        const existingIds = current?.noteIds ?? []
        const merged = [...existingIds, ...hitNoteIds.filter(id => !existingIds.includes(id))]
        const allMNums = [...(current ? [current.measureStart, current.measureEnd] : []), minM, maxM]
        setSelection({ type: 'notes', measureStart: Math.min(...allMNums), measureEnd: Math.max(...allMNums), noteIds: merged, anchorMeasure: Math.min(...allMNums) })
      } else {
        setSelection({ type: 'notes', measureStart: minM, measureEnd: maxM, noteIds: hitNoteIds, anchorMeasure: minM })
      }
    } else if (!e.ctrlKey) {
      setSelection(null)
      hideContextMenu()
    }
  }, [setSelection, hideContextMenu])

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

    // Helper to get measure number from an element
    const getMeasureNum = (el: Element): number => {
      const allMeasures = Array.from(document.querySelectorAll(SEL_MEASURE))
      const measureEl = el.closest(SEL_MEASURE) as Element | null
      const idx = measureEl ? allMeasures.indexOf(measureEl) : -1
      return idx >= 0 ? idx + 1 : 1
    }

    // Harmony/chord symbol click (native renderer: <text class="harmony">)
    const harmEl = (e.target as Element).closest?.('text.harmony') as SVGTextElement | null
    if (harmEl && !e.shiftKey && !e.ctrlKey) {
      setSelection({ type: 'note', measureStart: getMeasureNum(harmEl), measureEnd: getMeasureNum(harmEl), noteIds: [harmEl.id], anchorMeasure: getMeasureNum(harmEl) })
      return
    }

    // Note click — Ctrl toggles, plain click replaces, no context menu
    const noteEl = (e.target as Element).closest?.(SEL_NOTE) as SVGGElement | null
    if (noteEl && !e.shiftKey) {
      const measureNum = getMeasureNum(noteEl)
      const noteMapId = fromVrvRef.current.get(noteEl.id) ?? noteEl.id

      if (e.ctrlKey) {
        // Ctrl+click: toggle note in/out of selection
        const current = useSelectionStore.getState().selection
        const existingIds = current?.noteIds ?? []
        if (existingIds.includes(noteMapId)) {
          const newIds = existingIds.filter(id => id !== noteMapId)
          if (newIds.length === 0) { clearSelection(); return }
          const measures = newIds.map(id => {
            const n = noteMap?.notes.get(id); return n ? n.measureNum : measureNum
          })
          setSelection({ type: newIds.length === 1 ? 'note' : 'notes', measureStart: Math.min(...measures), measureEnd: Math.max(...measures), noteIds: newIds, anchorMeasure: Math.min(...measures) })
        } else {
          const merged = [...existingIds, noteMapId]
          const measures = merged.map(id => {
            const n = noteMap?.notes.get(id); return n ? n.measureNum : measureNum
          })
          setSelection({ type: 'notes', measureStart: Math.min(...measures), measureEnd: Math.max(...measures), noteIds: merged, anchorMeasure: Math.min(...measures) })
        }
        return
      }

      setSelection({ type: 'note', measureStart: measureNum, measureEnd: measureNum, noteIds: [noteMapId], anchorMeasure: measureNum, anchorNoteId: noteMapId })
      return
    }

    // SVG element (dynamics, articulation, hairpin, etc.) → color picker
    if (!e.shiftKey && !e.ctrlKey && scoreRef.current) {
      const vrvContainer = scoreRef.current.querySelector('.vrv-svg')
      if (vrvContainer) {
        const svgColorEl = findNearbyColorableElement(e.clientX, e.clientY, vrvContainer)
        if (svgColorEl) {
          const svgClass = SVG_COLORABLE.find(c => svgColorEl.classList.contains(c)) ?? ''
          const allMeasures = Array.from(document.querySelectorAll(SEL_MEASURE))
          const measureEl = svgColorEl.closest(SEL_MEASURE)
          const measureNum = measureEl ? allMeasures.indexOf(measureEl) + 1 : 1
          const siblings = measureEl ? Array.from(measureEl.querySelectorAll(`g.${svgClass}`)) : []
          const positionIndex = siblings.indexOf(svgColorEl)
          setSvgColorPicker({ x: e.clientX, y: e.clientY, svgClass, measureNum, positionIndex })
          return
        }
      }
    }

    const cRect = scoreRef.current?.getBoundingClientRect()
    if (!cRect) { hideContextMenu(); clearSelection(); return }
    const hit = findMeasureAtPoint(e.clientX, e.clientY, elementMap, cRect)
    if (!hit) {
      hideContextMenu()
      clearSelection()
      return
    }
    const { measureNum } = hit

    // Shift+click: extend note range from anchor to clicked measure
    if (e.shiftKey && selection) {
      const anchor = selection.anchorMeasure ?? selection.measureStart
      const minM = Math.min(anchor, measureNum)
      const maxM = Math.max(anchor, measureNum)
      const ids = getNoteIdsInRange(noteMap, minM, maxM)
      if (ids.length > 0) {
        setSelection({ type: 'notes', measureStart: minM, measureEnd: maxM, noteIds: ids, anchorMeasure: anchor })
      }
      return
    }

    // Click empty area in measure → select all notes in that measure
    const ids = getNoteIdsInRange(noteMap, measureNum, measureNum)
    if (ids.length > 0) {
      setSelection({ type: ids.length === 1 ? 'note' : 'notes', measureStart: measureNum, measureEnd: measureNum, noteIds: ids, anchorMeasure: measureNum })
    } else {
      clearSelection()
      hideContextMenu()
    }
  }, [selection, setSelection, clearSelection, hideContextMenu, elementMap, noteMap])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const currentSelection = useSelectionStore.getState().selection
    if (currentSelection) {
      // Selection exists — just open context menu without changing selection
      showContextMenu(e.clientX, e.clientY)
    } else {
      // No selection — select all notes in measure at click point, then show menu
      const cRect = scoreRef.current?.getBoundingClientRect()
      if (!cRect) return
      const hit = findMeasureAtPoint(e.clientX, e.clientY, elementMap, cRect)
      if (!hit) return
      const ids = getNoteIdsInRange(noteMap, hit.measureNum, hit.measureNum)
      if (ids.length > 0) {
        setSelection({ type: ids.length === 1 ? 'note' : 'notes', measureStart: hit.measureNum, measureEnd: hit.measureNum, noteIds: ids, anchorMeasure: hit.measureNum })
      }
      showContextMenu(e.clientX, e.clientY)
    }
  }, [setSelection, showContextMenu, elementMap, noteMap])

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
          <div className="vrv-svg" ref={vrvDivRef} />
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
          {/* Lasso rect — direct DOM updates, zero React re-renders */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 11 }}>
            <rect ref={lassoRectRef} style={{ display: 'none' }} fill="rgba(124,106,247,0.08)" stroke="#7c6af7" strokeDasharray="5 3" strokeWidth="1.5" x="0" y="0" width="0" height="0" />
          </svg>
          {svgContent && <FreehandCanvas containerRef={scoreRef} />}
        </div>
      </div>
      <ContextMenu />
      {svgColorPicker && (
        <SvgColorPicker
          x={svgColorPicker.x}
          y={svgColorPicker.y}
          onSelect={(color) => {
            const { svgClass, measureNum, positionIndex } = svgColorPicker
            useAnnotationStore.getState().addAnnotation({
              id: `svgcolor-${Date.now()}`,
              layer: 'svgColor',
              measureStart: measureNum,
              svgClass,
              positionIndex,
              color,
              createdAt: Date.now(),
            } as any)
            setSvgColorPicker(null)
          }}
          onClose={() => setSvgColorPicker(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6',
  '#ec4899', '#000000', '#6b7280', '#ffffff',
]

function SvgColorPicker({ x, y, onSelect, onClose }: {
  x: number; y: number
  onSelect: (color: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('svg-color-picker-popup')
      if (el && !el.contains(e.target as Node)) onClose()
    }
    // Slight delay so the same click that opened it doesn't close it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  // Clamp to viewport
  const px = Math.min(x, window.innerWidth  - 220)
  const py = Math.min(y, window.innerHeight - 80)

  return (
    <div
      id="svg-color-picker-popup"
      style={{
        position: 'fixed', left: px, top: py, zIndex: 9999,
        background: '#1e1e2e', border: '1px solid #333', borderRadius: 8,
        padding: '8px 10px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        display: 'flex', gap: 6, flexWrap: 'wrap', width: 200,
      }}
    >
      {COLOR_PRESETS.map(c => (
        <div
          key={c}
          onClick={() => onSelect(c)}
          style={{
            width: 22, height: 22, borderRadius: '50%', background: c,
            cursor: 'pointer', border: c === '#ffffff' ? '2px solid #555' : '2px solid transparent',
            boxSizing: 'border-box',
          }}
          title={c}
        />
      ))}
      <input
        type="color"
        title="Custom color"
        onChange={e => onSelect(e.target.value)}
        style={{ width: 22, height: 22, padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
      />
    </div>
  )
}

function OpenFileButton() {
  const { t } = useTranslation()
  const handleClick = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,.musicxml,.mxl,.XML'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = file.name.toLowerCase().endsWith('.mxl')
        ? await extractXmlFromFile(file)
        : await file.text()
      const noteMap = parseMusicXml(text)
      const existing = await loadFile(file.name)
      if (existing) {
        useAnnotationStore.getState().loadAnnotations(existing.annotations)
        useResearchStore.getState().loadNotes(existing.researchNotes ?? [])
      } else {
        useAnnotationStore.getState().loadAnnotations({})
        useResearchStore.getState().loadNotes([])
        await saveFile(file.name, text, {})
      }
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
      useResearchStore.getState().loadNotes(saved.researchNotes ?? [])
    } else {
      const res = await fetch('/DONNALEE.XML')
      text = await res.text()
      await saveFile('DONNALEE.XML', text, {})
      useResearchStore.getState().loadNotes([])
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
