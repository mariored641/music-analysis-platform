import { useEffect, useState, type RefObject } from 'react'
import type { NoteElement } from './ScoreView'
import type { Selection } from '../../store/selectionStore'

interface Props {
  selection: Selection | null
  elementMap: Map<string, NoteElement>
  containerRef: RefObject<HTMLDivElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
  toVrv?: Map<string, string>
}

export function SelectionOverlay({ selection, elementMap, containerRef, scrollRef, toVrv }: Props) {
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

  const selectionRects: Array<{ x: number; y: number; w: number; h: number }> = []

  if (selection) {
    if ((selection.type === 'note' || selection.type === 'notes') && selection.noteIds?.length) {
      // Group selected elements by their parent g.staff — one hull rect per staff row
      const staffGroups = new Map<string, { left: number; right: number; top: number; bottom: number }>()

      for (const noteId of selection.noteIds) {
        // noteId is a noteMap ID — translate to Verovio SVG ID for DOM lookup
        const vrvId = toVrv?.get(noteId) ?? noteId
        const noteEl = document.getElementById(vrvId)
        if (!noteEl) continue
        const noteBbox = noteEl.getBoundingClientRect()
        if (noteBbox.width === 0) continue

        // Try g.staff (Verovio), fall back to .staffline (OSMD), then g.measure/g.vf-measure
        const staffEl = noteEl.closest('g.staff') ?? noteEl.closest('.staffline') ?? noteEl.closest('g.vf-measure') ?? noteEl.closest('g.measure')
        if (!staffEl) {
          // Harmony/chord symbol — use tspan bounds for tight rect
          const tspans = Array.from(noteEl.querySelectorAll('tspan')).filter(t => t.textContent?.trim())
          const tboxes = tspans.map(t => t.getBoundingClientRect())
          const tTop = tboxes.length > 0 ? Math.min(...tboxes.map(b => b.top)) : noteBbox.top
          const smallBoxes = tboxes.filter(b => b.height < 15)
          const tBottom = smallBoxes.length > 0
            ? Math.max(...smallBoxes.map(b => b.bottom))
            : noteBbox.top + noteBbox.height * 0.7
          selectionRects.push({
            x: noteBbox.left - containerRect.left - 3,
            y: tTop    - containerRect.top  - 2,
            w: noteBbox.width + 6,
            h: (tBottom - tTop) + 4,
          })
          continue
        }

        const groupKey = (staffEl as SVGGElement).dataset?.measure
          ?? staffEl.id
          ?? String(Array.from(staffEl.parentElement?.children ?? []).indexOf(staffEl))
        const staffBbox = staffEl.getBoundingClientRect()

        const existing = staffGroups.get(groupKey)
        if (existing) {
          existing.left  = Math.min(existing.left,  noteBbox.left)
          existing.right = Math.max(existing.right, noteBbox.right)
        } else {
          staffGroups.set(groupKey, {
            left:   noteBbox.left,
            right:  noteBbox.right,
            top:    staffBbox.top,
            bottom: staffBbox.bottom,
          })
        }
      }

      for (const [, g] of staffGroups) {
        selectionRects.push({
          x: g.left  - containerRect.left - 4,
          y: g.top   - containerRect.top  - 2,
          w: g.right - g.left + 8,
          h: g.bottom - g.top + 4,
        })
      }
    } else {
      // Measure-level selection — use staffBboxes for accurate left/right/top/bottom
      for (let m = selection.measureStart; m <= selection.measureEnd; m++) {
        const el = elementMap.get(`measure-${m - 1}`)
        if (!el) continue

        const staffIdx = selection.staffIndex ?? 0
        const sb = el.staffBboxes[staffIdx] ?? el.staffBboxes[0]
        if (!sb) continue

        selectionRects.push({
          x: sb.left  - containerRect.left - 2,
          y: sb.top   - containerRect.top  - 2,
          w: sb.width  + 4,
          h: sb.height + 4,
        })
      }
    }
  }

  if (selectionRects.length === 0) return null

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
    </svg>
  )
}
