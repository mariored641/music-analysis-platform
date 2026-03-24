import { useEffect, useState, type RefObject } from 'react'
import type { Annotation, LayerId } from '../../types/annotation'
import { LAYER_MAP } from '../../constants/layers'
import type { NoteElement } from './ScoreView'

interface Props {
  annotations: Record<string, Annotation>
  visible: Record<LayerId, boolean>
  elementMap: Map<string, NoteElement>
  containerRef: RefObject<HTMLDivElement | null>
  scrollRef?: RefObject<HTMLDivElement | null>
  playbackMeasure?: number
  toVrv?: Map<string, string>
}

export function AnnotationOverlay({ annotations, visible, elementMap, containerRef, scrollRef, playbackMeasure, toVrv }: Props) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const update = () => {
      if (containerRef.current) setContainerRect(containerRef.current.getBoundingClientRect())
    }
    update()
    window.addEventListener('resize', update)
    const observer = new ResizeObserver(update)
    observer.observe(containerRef.current)
    return () => { window.removeEventListener('resize', update); observer.disconnect() }
  }, [containerRef])

  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    const onScroll = () => {
      if (containerRef.current) setContainerRect(containerRef.current.getBoundingClientRect())
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, containerRef])

  if (!containerRect) return null

  const annotationList = Object.values(annotations).filter(a => visible[a.layer])

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {playbackMeasure && (
        <PlaybackHighlightShape
          measureNum={playbackMeasure}
          elementMap={elementMap}
          containerRect={containerRect}
        />
      )}
      {annotationList.map(ann => (
        <AnnotationShape
          key={ann.id}
          annotation={ann}
          elementMap={elementMap}
          containerRect={containerRect}
          toVrv={toVrv}
        />
      ))}
    </svg>
  )
}

function AnnotationShape({ annotation, elementMap, containerRect, toVrv }: {
  annotation: Annotation
  elementMap: Map<string, NoteElement>
  containerRect: DOMRect
  toVrv?: Map<string, string>
}) {
  // noteColor annotations are rendered directly on SVG noteheads via applyNoteColors — no overlay rect
  if (annotation.layer === 'noteColor') return null

  const layer = LAYER_MAP.get(annotation.layer)
  if (!layer) return null

  const color = layer.color
  const noteIds = annotation.noteIds || []

  // Tight bounding boxes — query DOM directly so chord symbols get tspan-accurate bounds
  const regions: Array<{ left: number; top: number; right: number; bottom: number }> = []

  if (noteIds.length > 0) {
    noteIds.forEach(id => {
      // id is a noteMap ID — translate to Verovio SVG ID for DOM lookup
      const vrvId = toVrv?.get(id) ?? id
      const domEl = document.getElementById(vrvId)
      if (!domEl) return
      const bbox = domEl.getBoundingClientRect()
      if (bbox.width === 0) return

      // Chord symbol (g.harm — no parent g.staff): use tspan bounds for tight rect
      if (!domEl.closest('g.staff')) {
        const tspans = Array.from(domEl.querySelectorAll('tspan')).filter(t => t.textContent?.trim())
        const tboxes = tspans.map(t => t.getBoundingClientRect())
        const tTop = tboxes.length > 0 ? Math.min(...tboxes.map(b => b.top)) : bbox.top
        const smallBoxes = tboxes.filter(b => b.height < 15)
        const tBottom = smallBoxes.length > 0
          ? Math.max(...smallBoxes.map(b => b.bottom))
          : bbox.top + bbox.height * 0.7
        regions.push({ left: bbox.left, top: tTop, right: bbox.right, bottom: tBottom })
      } else {
        regions.push({ left: bbox.left, top: bbox.top, right: bbox.right, bottom: bbox.bottom })
      }
    })
  }

  // Measure-level fallback: gather all measure staff bboxes in range
  if (regions.length === 0 && isMeasureLevel(annotation)) {
    for (let m = annotation.measureStart; m <= (annotation.measureEnd ?? annotation.measureStart); m++) {
      const el = elementMap.get(`measure-${m - 1}`)
      if (!el) continue
      el.staffBboxes.forEach(sb => {
        regions.push({ left: sb.left, top: sb.top, right: sb.right, bottom: sb.bottom })
      })
    }
  }

  if (regions.length === 0) return null

  const minX = Math.min(...regions.map(b => b.left))  - containerRect.left - 2
  const minY = Math.min(...regions.map(b => b.top))   - containerRect.top  - 2
  const maxX = Math.max(...regions.map(b => b.right)) - containerRect.left + 2
  const maxY = Math.max(...regions.map(b => b.bottom))- containerRect.top  + 2

  const label = getAnnotationLabel(annotation)

  return (
    <g>
      <rect
        x={minX} y={minY}
        width={maxX - minX} height={maxY - minY}
        fill={color + '20'}
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.75"
        rx="3"
      />
      {label && (
        <text x={minX + 2} y={minY - 3} fontSize="9" fill={color} fontWeight="700" fontFamily="monospace">
          {label}
        </text>
      )}
    </g>
  )
}

function PlaybackHighlightShape({ measureNum, elementMap, containerRect }: {
  measureNum: number
  elementMap: Map<string, NoteElement>
  containerRect: DOMRect
}) {
  const bboxes: DOMRect[] = []
  for (const el of elementMap.values()) {
    if (el.measureNum === measureNum) bboxes.push(el.bbox)
  }
  if (bboxes.length === 0) return null

  const minX = Math.min(...bboxes.map(b => b.left)) - containerRect.left - 4
  const minY = Math.min(...bboxes.map(b => b.top)) - containerRect.top - 8
  const maxX = Math.max(...bboxes.map(b => b.right)) - containerRect.left + 4
  const maxY = Math.max(...bboxes.map(b => b.bottom)) - containerRect.top + 8

  return (
    <rect
      x={minX} y={minY}
      width={maxX - minX} height={maxY - minY}
      fill="rgba(59, 130, 246, 0.12)"
      stroke="rgba(59, 130, 246, 0.3)"
      strokeWidth="1"
      rx="3"
    />
  )
}

function isMeasureLevel(ann: Annotation): boolean {
  return ann.layer === 'harmony' || ann.layer === 'form' || ann.layer === 'texture'
}

function getAnnotationLabel(ann: Annotation): string {
  switch (ann.layer) {
    case 'harmony': return (ann as any).cadenceType || (ann as any).scaleDegree || (ann as any).chordSymbol || ''
    case 'melody':  return (ann as any).noteFunction || ''
    case 'form':    return (ann as any).midLevel || (ann as any).highLevel || ''
    case 'motif':   return `${(ann as any).label}${(ann as any).variantType !== 'original' ? "'" : ''}`
    case 'labels':  return ((ann as any).text || '').slice(0, 14)
    default:        return ''
  }
}
