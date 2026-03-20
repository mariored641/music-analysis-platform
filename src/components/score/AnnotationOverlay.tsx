import { useEffect, useState, type RefObject } from 'react'
import type { Annotation, LayerId } from '../../types/annotation'
import { LAYER_MAP } from '../../constants/layers'
import type { NoteElement } from './ScoreView'

interface Props {
  annotations: Record<string, Annotation>
  visible: Record<LayerId, boolean>
  elementMap: Map<string, NoteElement>
  containerRef: RefObject<HTMLDivElement | null>
  playbackMeasure?: number
}

export function AnnotationOverlay({ annotations, visible, elementMap, containerRef, playbackMeasure }: Props) {
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
        />
      ))}
    </svg>
  )
}

function AnnotationShape({ annotation, elementMap, containerRect }: {
  annotation: Annotation
  elementMap: Map<string, NoteElement>
  containerRect: DOMRect
}) {
  const layer = LAYER_MAP.get(annotation.layer)
  if (!layer) return null

  const color = layer.color
  const noteIds = annotation.noteIds || []

  const bboxes: DOMRect[] = []

  // Note-level: use element map
  noteIds.forEach(id => {
    const el = elementMap.get(id)
    if (el) bboxes.push(el.bbox)
  })

  // Measure-level: gather all notes in range
  if (bboxes.length === 0 && isMeasureLevel(annotation)) {
    for (const [, el] of elementMap) {
      if (el.measureNum >= annotation.measureStart &&
          el.measureNum <= (annotation.measureEnd ?? annotation.measureStart)) {
        bboxes.push(el.bbox)
      }
    }
  }

  if (bboxes.length === 0) return null

  const minX = Math.min(...bboxes.map(b => b.left)) - containerRect.left - 2
  const minY = Math.min(...bboxes.map(b => b.top)) - containerRect.top - 2
  const maxX = Math.max(...bboxes.map(b => b.right)) - containerRect.left + 2
  const maxY = Math.max(...bboxes.map(b => b.bottom)) - containerRect.top + 2

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
