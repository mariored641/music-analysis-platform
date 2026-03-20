import { useEffect, useState, type RefObject } from 'react'
import type { NoteElement } from './ScoreView'
import type { HarmonyItem } from '../../services/xmlParser'

interface Props {
  harmonies: HarmonyItem[]
  elementMap: Map<string, NoteElement>
  containerRef: RefObject<HTMLDivElement | null>
}

export function HarmonyOverlay({ harmonies, elementMap, containerRef }: Props) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const update = () => {
      if (containerRef.current) setContainerRect(containerRef.current.getBoundingClientRect())
    }
    update()
    window.addEventListener('resize', update)
    const obs = new ResizeObserver(update)
    obs.observe(containerRef.current)
    return () => { window.removeEventListener('resize', update); obs.disconnect() }
  }, [containerRef])

  if (!containerRect || elementMap.size === 0) return null

  // Build map: measureNum → NoteElement (first/only entry per measure)
  const measureMap = new Map<number, NoteElement>()
  for (const el of elementMap.values()) {
    if (!measureMap.has(el.measureNum)) measureMap.set(el.measureNum, el)
  }

  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none', overflow: 'visible',
    }}>
      {harmonies.map((h, i) => {
        const el = measureMap.get(h.measureNum)
        if (!el) return null
        const b = el.bbox
        const x = b.left - containerRect.left + h.beatFraction * b.width
        const y = b.top - containerRect.top - 16
        return (
          <text
            key={i}
            x={x}
            y={y}
            fontSize="9"
            fontFamily="Arial, sans-serif"
            fontWeight="bold"
            fill="#111"
          >
            {h.label}
          </text>
        )
      })}
    </svg>
  )
}
