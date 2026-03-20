import { useEffect, useState, type RefObject } from 'react'
import type { NoteElement } from './ScoreView'
import type { Selection } from '../../store/selectionStore'

export interface DragState {
  active: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface Props {
  selection: Selection | null
  dragState: DragState | null
  elementMap: Map<string, NoteElement>
  containerRef: RefObject<HTMLDivElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
}

export function SelectionOverlay({ selection, dragState, elementMap, containerRef, scrollRef }: Props) {
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
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (containerRef.current) setContainerRect(containerRef.current.getBoundingClientRect())
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, containerRef])

  if (!containerRect) return null

  // One rect per selected measure (measures wrap across lines, so no hull)
  const selectionRects: Array<{ x: number; y: number; w: number; h: number }> = []
  if (selection) {
    for (let m = selection.measureStart; m <= selection.measureEnd; m++) {
      const el = elementMap.get(`measure-${m - 1}`)
      if (!el) continue
      const b = el.bbox
      selectionRects.push({
        x: b.left - containerRect.left - 2,
        y: b.top  - containerRect.top  - 2,
        w: b.width  + 4,
        h: b.height + 4,
      })
    }
  }

  // Rubber-band lasso rect (only while actively dragging)
  let lassoRect: { x: number; y: number; w: number; h: number } | null = null
  if (dragState?.active) {
    lassoRect = {
      x: Math.min(dragState.startX, dragState.currentX) - containerRect.left,
      y: Math.min(dragState.startY, dragState.currentY) - containerRect.top,
      w: Math.abs(dragState.currentX - dragState.startX),
      h: Math.abs(dragState.currentY - dragState.startY),
    }
  }

  if (selectionRects.length === 0 && !lassoRect) return null

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
        zIndex: 10,
      }}
    >
      {selectionRects.map((r, i) => (
        <rect
          key={i}
          x={r.x} y={r.y}
          width={r.w} height={r.h}
          fill="rgba(124, 106, 247, 0.18)"
          stroke="#7c6af7"
          strokeWidth="2"
          rx="4"
        />
      ))}
      {lassoRect && (
        <rect
          x={lassoRect.x} y={lassoRect.y}
          width={lassoRect.w} height={lassoRect.h}
          fill="rgba(124, 106, 247, 0.08)"
          stroke="#7c6af7"
          strokeDasharray="5 3"
          strokeWidth="1.5"
        />
      )}
    </svg>
  )
}
