import { useEffect, useState, useCallback, useRef, type RefObject } from 'react'
import type {
  Annotation, LayerId,
  HarmonyAnnotation, MelodyAnnotation, FormAnnotation,
  MotifAnnotation, LabelAnnotation,
} from '../../types/annotation'
import { LAYER_MAP } from '../../constants/layers'
import { useAnnotationStore } from '../../store/annotationStore'
import { useScoreStore } from '../../store/scoreStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useLayerStore, getEffectiveMelodyColors } from '../../store/layerStore'
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

// ── Geometry helpers ──────────────────────────────────────────────────────────

function getNoteHeadInfo(
  noteId: string,
  toVrv: Map<string, string>,
  containerRect: DOMRect
): { cx: number; cy: number; top: number } | null {
  const vrvId = toVrv.get(noteId)
  if (!vrvId) return null
  const noteEl = document.getElementById(vrvId)
  if (!noteEl) return null
  const headEl = (noteEl.querySelector('g.notehead') as Element | null) ?? noteEl
  const b = headEl.getBoundingClientRect()
  if (b.width === 0) return null
  return {
    cx: b.left + b.width / 2 - containerRect.left,
    cy: b.top + b.height / 2 - containerRect.top,
    top: b.top - containerRect.top,
  }
}

function getStaffTopY(
  measureNum: number,
  elementMap: Map<string, NoteElement>,
  _containerRect: DOMRect
): number | null {
  const el = elementMap.get(`measure-${measureNum - 1}`)
  if (!el || el.staffBboxes.length === 0) return null
  return Math.min(...el.staffBboxes.map(b => b.top))
}

function getMeasureXRange(
  measureNum: number,
  elementMap: Map<string, NoteElement>,
  _containerRect: DOMRect
): { left: number; right: number } | null {
  const el = elementMap.get(`measure-${measureNum - 1}`)
  if (!el) return null
  return { left: el.bbox.left, right: el.bbox.right }
}

function getRowBottomY(
  refTop: number,
  elementMap: Map<string, NoteElement>,
  _containerRect: DOMRect
): number {
  let maxBottom = 0
  elementMap.forEach(el => {
    if (el.staffBboxes.length === 0) return
    if (Math.abs(el.staffBboxes[0].top - refTop) >= 60) return
    el.staffBboxes.forEach(sb => { if (sb.bottom > maxBottom) maxBottom = sb.bottom })
  })
  return maxBottom
}

function getRowXRange(
  measures: number[],
  elementMap: Map<string, NoteElement>,
  containerRect: DOMRect
): { left: number; right: number } | null {
  let minLeft = Infinity, maxRight = -Infinity
  measures.forEach(m => {
    const r = getMeasureXRange(m, elementMap, containerRect)
    if (!r) return
    if (r.left < minLeft) minLeft = r.left
    if (r.right > maxRight) maxRight = r.right
  })
  if (minLeft === Infinity) return null
  return { left: minLeft, right: maxRight }
}

// Returns: array of { measures, rowTop } sorted top→bottom
function splitMeasuresByRow(
  measureStart: number,
  measureEnd: number,
  elementMap: Map<string, NoteElement>
): Array<{ measures: number[]; rowTop: number }> {
  const rows: Array<{ rowTop: number; measures: number[] }> = []
  for (let m = measureStart; m <= measureEnd; m++) {
    const el = elementMap.get(`measure-${m - 1}`)
    if (!el || el.staffBboxes.length === 0) continue
    const top = el.staffBboxes[0].top
    const existing = rows.find(r => Math.abs(r.rowTop - top) < 60)
    if (existing) existing.measures.push(m)
    else rows.push({ rowTop: top, measures: [m] })
  }
  return rows.sort((a, b) => a.rowTop - b.rowTop)
}

// Group note head positions by score row (system)
function groupCentersByRow(
  noteIds: string[],
  toVrv: Map<string, string>,
  elementMap: Map<string, NoteElement>,
  containerRect: DOMRect
): Array<Array<{ cx: number; cy: number }>> {
  const items: Array<{ cx: number; cy: number; rowTop: number }> = []
  noteIds.forEach(nid => {
    const info = getNoteHeadInfo(nid, toVrv, containerRect)
    if (!info) return
    const match = nid.match(/note-m(\d+)b/)
    let rowTop = info.cy
    if (match) {
      const mNum = parseInt(match[1])
      const el = elementMap.get(`measure-${mNum - 1}`)
      if (el && el.staffBboxes.length > 0) rowTop = el.staffBboxes[0].top
    }
    items.push({ cx: info.cx, cy: info.cy, rowTop })
  })

  const rowGroups: Array<{ rowTop: number; pts: Array<{ cx: number; cy: number }> }> = []
  items.forEach(item => {
    const existing = rowGroups.find(rg => Math.abs(rg.rowTop - item.rowTop) < 60)
    if (existing) existing.pts.push({ cx: item.cx, cy: item.cy })
    else rowGroups.push({ rowTop: item.rowTop, pts: [{ cx: item.cx, cy: item.cy }] })
  })

  return rowGroups
    .sort((a, b) => a.rowTop - b.rowTop)
    .map(rg => rg.pts.sort((a, b) => a.cx - b.cx))
}

// ── Metaball blob path ────────────────────────────────────────────────────────

function catmullRomSegment(pts: Array<{ x: number; y: number }>): string {
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

function buildMotifBlobPath(
  centers: Array<{ cx: number; cy: number }>,
  r: number,
  leftCap: 'round' | 'flat',
  rightCap: 'round' | 'flat'
): string {
  if (centers.length === 0) return ''
  const pts = [...centers].sort((a, b) => a.cx - b.cx)

  if (pts.length === 1) {
    const { cx, cy } = pts[0]
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
  }

  const upper = pts.map(p => ({ x: p.cx, y: p.cy - r }))
  const lower = pts.map(p => ({ x: p.cx, y: p.cy + r }))
  const first = pts[0], last = pts[pts.length - 1]

  let d = `M ${upper[0].x.toFixed(1)} ${upper[0].y.toFixed(1)}`
  d += catmullRomSegment(upper)

  if (rightCap === 'round') {
    d += ` A ${r} ${r} 0 0 1 ${last.cx.toFixed(1)} ${(last.cy + r).toFixed(1)}`
  } else {
    d += ` L ${last.cx.toFixed(1)} ${(last.cy + r).toFixed(1)}`
  }

  d += catmullRomSegment([...lower].reverse())

  if (leftCap === 'round') {
    d += ` A ${r} ${r} 0 0 1 ${first.cx.toFixed(1)} ${(first.cy - r).toFixed(1)}`
  } else {
    d += ` L ${first.cx.toFixed(1)} ${(first.cy - r).toFixed(1)}`
  }

  return d + ' Z'
}

// ── Drag hook ─────────────────────────────────────────────────────────────────

function useDrag(
  savedOffset: { x: number; y: number } | undefined,
  onDragEnd: (offset: { x: number; y: number }) => void
) {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const offset = dragOffset ?? savedOffset ?? { x: 0, y: 0 }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const base = savedOffset ?? { x: 0, y: 0 }
    let current = { ...base }
    const onMove = (me: MouseEvent) => {
      current = { x: base.x + me.clientX - startX, y: base.y + me.clientY - startY }
      setDragOffset({ ...current })
    }
    const onUp = () => {
      onDragEnd(current)
      setDragOffset(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [savedOffset, onDragEnd])

  return { offset, handleMouseDown }
}

// ── Tooltip text ──────────────────────────────────────────────────────────────

function getTooltipText(ann: Annotation): string {
  switch (ann.layer) {
    case 'harmony': {
      const h = ann as HarmonyAnnotation
      const label = h.chordSymbol || h.scaleDegree || h.cadenceType || ''
      return label ? `אקורד: ${label}` : 'הרמוניה'
    }
    case 'melody': {
      const m = ann as MelodyAnnotation
      const map: Record<string, string> = {
        CT: 'תו אקורד', PT: 'תו מעבר', NT: 'תו שכן',
        SUS: 'השהיה', APP: "אפוג'יאטורה", ESC: 'אסקפה', ANT: 'אנטיסיפציה', PED: 'פדאל',
      }
      return map[m.noteFunction || ''] || 'מלודיה'
    }
    case 'motif': {
      const mo = ann as MotifAnnotation
      return `מוטיב: ${mo.label}`
    }
    case 'form': {
      const f = ann as FormAnnotation
      const label = f.midLevel || f.highLevel || f.lowLevel || ''
      return label ? `מבנה: ${label}` : 'מבנה'
    }
    case 'labels': {
      const l = ann as LabelAnnotation
      return l.text || 'תווית'
    }
    default:
      return ann.layer
  }
}

// ── Common shape props ────────────────────────────────────────────────────────

type AnchorSide = 'start' | 'end'

interface ShapeProps {
  annotation: Annotation
  elementMap: Map<string, NoteElement>
  containerRect: DOMRect
  toVrv: Map<string, string>
  onDragEnd: (id: string, offset: { x: number; y: number }) => void
  onHover: (x: number, y: number, text: string) => void
  onLeave: () => void
  isSelected: boolean
  onSelect: (id: string) => void
  selectedAnchor: AnchorSide | null
  onSelectAnchor: (side: AnchorSide | null) => void
  melodyColors?: Record<string, string>
}

// ── HarmonyShape ──────────────────────────────────────────────────────────────

function HarmonyShape({ annotation, elementMap, containerRect, toVrv, onDragEnd, onHover, onLeave, isSelected, onSelect, selectedAnchor, onSelectAnchor }: ShapeProps) {
  const ann = annotation as HarmonyAnnotation
  const layer = LAYER_MAP.get('harmony')!
  const { offset, handleMouseDown } = useDrag(ann.visualOffset, off => onDragEnd(ann.id, off))

  const text = ann.chordSymbol || ann.scaleDegree || ann.cadenceType || ''
  if (!text) return null

  const anchorNoteId = ann.noteIds?.[0]
  let anchorX: number | null = null
  let anchorNoteY: number | null = null

  if (anchorNoteId) {
    const info = getNoteHeadInfo(anchorNoteId, toVrv, containerRect)
    if (info) { anchorX = info.cx; anchorNoteY = info.cy }
  }

  const staffTopY = getStaffTopY(ann.measureStart, elementMap, containerRect)
  if (anchorX === null) {
    const xRange = getMeasureXRange(ann.measureStart, elementMap, containerRect)
    if (xRange) anchorX = xRange.left + 12
  }
  if (anchorX === null || staffTopY === null) return null

  const textX = anchorX + offset.x
  const textY = (staffTopY - 18) + offset.y
  const anchorActive = isSelected && selectedAnchor === 'start'

  return (
    <g
      style={{ cursor: 'move', pointerEvents: 'all' }}
      onMouseDown={e => {
        handleMouseDown(e)
        onSelect(ann.id)
        const { setSelection, showContextMenu } = useSelectionStore.getState()
        const anchorId = ann.noteIds?.[0]
        if (anchorId) {
          setSelection({ type: 'note', measureStart: ann.measureStart, measureEnd: ann.measureStart, noteIds: [anchorId], anchorMeasure: ann.measureStart, anchorNoteId: anchorId })
        } else {
          setSelection({ type: 'measure', measureStart: ann.measureStart, measureEnd: ann.measureStart, noteIds: [], anchorMeasure: ann.measureStart })
        }
        showContextMenu(e.clientX, e.clientY, 'harmony')
      }}
      onClick={e => e.stopPropagation()}
      onMouseEnter={e => onHover(e.clientX, e.clientY, getTooltipText(ann))}
      onMouseLeave={onLeave}
    >
      {isSelected && anchorNoteY !== null && (
        <line
          x1={textX} y1={textY + 4}
          x2={anchorX} y2={anchorNoteY}
          stroke={layer.color} strokeWidth="1"
          strokeDasharray="3,3" opacity="0.65"
        />
      )}
      <text
        x={textX} y={textY}
        fontSize="15"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fill={layer.color}
        textAnchor="middle"
        style={{ userSelect: 'none' }}
      >
        {text}
      </text>
      {/* Clickable anchor dot at note position */}
      {isSelected && anchorNoteY !== null && (
        <circle
          cx={anchorX!} cy={anchorNoteY}
          r="5"
          fill={anchorActive ? layer.color : 'white'}
          stroke={layer.color} strokeWidth="1.5"
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
          onMouseDown={e => { e.stopPropagation(); onSelectAnchor('start') }}
        />
      )}
    </g>
  )
}

// ── MelodyShape ───────────────────────────────────────────────────────────────

function MelodyShape({ annotation, containerRect, toVrv, onHover, onLeave, melodyColors }: ShapeProps) {
  const ann = annotation as MelodyAnnotation
  const colors = melodyColors || {}
  const color = colors[ann.noteFunction || ''] || LAYER_MAP.get('melody')!.color
  const noteIds = ann.noteIds || []
  if (noteIds.length === 0) return null

  const dots: Array<{ cx: number; cy: number }> = []
  noteIds.forEach(nid => {
    const info = getNoteHeadInfo(nid, toVrv, containerRect)
    if (info) dots.push({ cx: info.cx, cy: info.cy })
  })
  if (dots.length === 0) return null

  return (
    <g
      style={{ pointerEvents: 'none' }}
      onMouseEnter={e => onHover(e.clientX, e.clientY, getTooltipText(ann))}
      onMouseLeave={onLeave}
    >
      {dots.map((dot, i) => (
        <circle key={i} cx={dot.cx} cy={dot.cy} r="5" fill={color} opacity="0.80" />
      ))}
    </g>
  )
}

// ── MotifShape ────────────────────────────────────────────────────────────────

function MotifShape({ annotation, elementMap, containerRect, toVrv, onDragEnd, onHover, onLeave, onSelect }: ShapeProps) {
  const ann = annotation as MotifAnnotation
  const layer = LAYER_MAP.get('motif')!
  const { offset, handleMouseDown } = useDrag(ann.visualOffset, off => onDragEnd(ann.id, off))

  const noteIds = ann.noteIds || []
  if (noteIds.length === 0) return null

  const R = 13
  const rowGroups = groupCentersByRow(noteIds, toVrv, elementMap, containerRect)
  if (rowGroups.length === 0) return null

  const totalRows = rowGroups.length
  const paths = rowGroups.map((rowPts, idx) => buildMotifBlobPath(
    rowPts, R,
    idx === 0 ? 'round' : 'flat',
    idx === totalRows - 1 ? 'round' : 'flat'
  ))

  return (
    <g
      transform={`translate(${offset.x}, ${offset.y})`}
      style={{ cursor: 'move', pointerEvents: 'all' }}
      onMouseDown={e => { handleMouseDown(e); onSelect(ann.id) }}
      onMouseEnter={e => onHover(e.clientX, e.clientY, getTooltipText(ann))}
      onMouseLeave={onLeave}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} fill="transparent" stroke={layer.color}
          strokeWidth="2.5" strokeLinejoin="round" opacity="0.85" />
      ))}
    </g>
  )
}

// ── FormShape ─────────────────────────────────────────────────────────────────

function FormShape({ annotation, elementMap, containerRect, onDragEnd, onHover, onLeave, isSelected, onSelect, selectedAnchor, onSelectAnchor }: ShapeProps) {
  const ann = annotation as FormAnnotation
  const layer = LAYER_MAP.get('form')!
  const { offset, handleMouseDown } = useDrag(ann.visualOffset, off => onDragEnd(ann.id, off))

  const label = ann.midLevel || ann.highLevel || ann.lowLevel || ''
  const measureEnd = ann.measureEnd ?? ann.measureStart
  const rows = splitMeasuresByRow(ann.measureStart, measureEnd, elementMap)
  if (rows.length === 0) return null

  const BELOW_GAP = 8
  const TICK_H = 16
  const TEXT_BELOW = 13

  return (
    <g
      transform={`translate(${offset.x}, ${offset.y})`}
      style={{ cursor: 'move', pointerEvents: 'all' }}
      onMouseDown={e => { handleMouseDown(e); onSelect(ann.id) }}
      onMouseEnter={e => onHover(e.clientX, e.clientY, getTooltipText(ann))}
      onMouseLeave={onLeave}
    >
      {rows.map((row, i) => {
        const xRange = getRowXRange(row.measures, elementMap, containerRect)
        if (!xRange) return null
        const isFirst = i === 0
        const isLast = i === rows.length - 1
        const lineY = getRowBottomY(row.rowTop, elementMap, containerRect) + BELOW_GAP
        const midX = (xRange.left + xRange.right) / 2
        const startActive = isSelected && selectedAnchor === 'start'
        const endActive = isSelected && selectedAnchor === 'end'

        return (
          <g key={i}>
            <line x1={xRange.left} y1={lineY} x2={xRange.right} y2={lineY}
              stroke={layer.color} strokeWidth="2" />
            {isFirst && (
              <g>
                <line x1={xRange.left} y1={lineY} x2={xRange.left} y2={lineY - TICK_H}
                  stroke={layer.color} strokeWidth={startActive ? 3 : 2} />
                {isSelected && (
                  <circle cx={xRange.left} cy={lineY - TICK_H}
                    r="5" fill={startActive ? layer.color : 'white'}
                    stroke={layer.color} strokeWidth="1.5"
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onMouseDown={e => { e.stopPropagation(); onSelectAnchor('start') }}
                  />
                )}
              </g>
            )}
            {isLast && (
              <g>
                <line x1={xRange.right} y1={lineY} x2={xRange.right} y2={lineY - TICK_H}
                  stroke={layer.color} strokeWidth={endActive ? 3 : 2} />
                {isSelected && (
                  <circle cx={xRange.right} cy={lineY - TICK_H}
                    r="5" fill={endActive ? layer.color : 'white'}
                    stroke={layer.color} strokeWidth="1.5"
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onMouseDown={e => { e.stopPropagation(); onSelectAnchor('end') }}
                  />
                )}
              </g>
            )}
            {label && (
              <text x={midX} y={lineY + TEXT_BELOW}
                fontSize="11" fontFamily="sans-serif" fontWeight="700"
                fill={layer.color} textAnchor="middle"
                style={{ userSelect: 'none' }}>
                {label}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

// ── LabelShape ────────────────────────────────────────────────────────────────

function LabelShape({ annotation, elementMap, containerRect, toVrv, onDragEnd, onHover, onLeave, onSelect }: ShapeProps) {
  const ann = annotation as LabelAnnotation
  const layer = LAYER_MAP.get('labels')!
  const { offset, handleMouseDown } = useDrag(ann.visualOffset, off => onDragEnd(ann.id, off))

  const ABOVE = 14
  const TICK_H = 12

  const noteIds = ann.noteIds || []

  // Fallback: if no noteIds, draw flat line above staff
  if (noteIds.length === 0) {
    const measureEnd = ann.measureEnd ?? ann.measureStart
    const rows = splitMeasuresByRow(ann.measureStart, measureEnd, elementMap)
    if (rows.length === 0) return null

    return (
      <g
        transform={`translate(${offset.x}, ${offset.y})`}
        style={{ cursor: 'move', pointerEvents: 'all' }}
        onMouseDown={e => { handleMouseDown(e); onSelect(ann.id) }}
        onMouseEnter={e => onHover(e.clientX, e.clientY, getTooltipText(ann))}
        onMouseLeave={onLeave}
      >
        {rows.map((row, i) => {
          const xRange = getRowXRange(row.measures, elementMap, containerRect)
          const staffTop = getStaffTopY(row.measures[0], elementMap, containerRect)
          if (!xRange || staffTop === null) return null
          const lineY = staffTop - ABOVE
          const isFirst = i === 0, isLast = i === rows.length - 1

          {
            const midX = (xRange.left + xRange.right) / 2
            return (
            <g key={i}>
              <line x1={xRange.left} y1={lineY} x2={xRange.right} y2={lineY}
                stroke={layer.color} strokeWidth="1.8" opacity="0.8" />
              {isFirst && (
                <line x1={xRange.left} y1={lineY} x2={xRange.left} y2={lineY + TICK_H}
                  stroke={layer.color} strokeWidth="2" />
              )}
              {isLast && (
                <line x1={xRange.right} y1={lineY} x2={xRange.right} y2={lineY + TICK_H}
                  stroke={layer.color} strokeWidth="2" />
              )}
              {ann.text && (
                <text x={midX} y={lineY - 3}
                  fontSize="10" fontFamily="sans-serif" textAnchor="middle"
                  fill={layer.color} style={{ userSelect: 'none' }}>
                  {ann.text.slice(0, 24)}
                </text>
              )}
            </g>
          )}
        })}
      </g>
    )
  }

  // Build zigzag points from note head positions
  const pts: Array<{ x: number; y: number }> = []
  let lastY: number | null = null
  let lastX = 0
  noteIds.forEach(nid => {
    const info = getNoteHeadInfo(nid, toVrv, containerRect)
    if (info) {
      const y = info.top - ABOVE
      pts.push({ x: info.cx, y })
      lastY = y
      lastX = info.cx
    } else if (lastY !== null) {
      // rest or unmapped note — continue at same y, estimate x from previous
      pts.push({ x: lastX + 8, y: lastY })
    }
  })
  if (pts.length === 0) return null

  // Split into rows on leftward jumps (row break detection)
  const rowPts: Array<Array<{ x: number; y: number }>> = [[pts[0]]]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x < pts[i - 1].x - 80) rowPts.push([pts[i]])
    else rowPts[rowPts.length - 1].push(pts[i])
  }

  return (
    <g
      transform={`translate(${offset.x}, ${offset.y})`}
      style={{ cursor: 'move', pointerEvents: 'all' }}
      onMouseDown={e => { handleMouseDown(e); onSelect(ann.id) }}
      onMouseEnter={e => onHover(e.clientX, e.clientY, getTooltipText(ann))}
      onMouseLeave={onLeave}
    >
      {rowPts.map((row, rowIdx) => {
        if (row.length === 0) return null
        const isFirst = rowIdx === 0
        const isLast = rowIdx === rowPts.length - 1
        const polylinePoints = row.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
        const firstPt = row[0], lastPt = row[row.length - 1]

        {
          const rowMidX = (firstPt.x + lastPt.x) / 2
          const rowTopY = Math.min(...row.map(p => p.y))
          return (
          <g key={rowIdx}>
            <polyline points={polylinePoints}
              fill="none" stroke={layer.color} strokeWidth="1.8" opacity="0.85" />
            {isFirst && (
              <line x1={firstPt.x} y1={firstPt.y}
                x2={firstPt.x} y2={firstPt.y + TICK_H}
                stroke={layer.color} strokeWidth="2" />
            )}
            {isLast && row.length > 1 && (
              <line x1={lastPt.x} y1={lastPt.y}
                x2={lastPt.x} y2={lastPt.y + TICK_H}
                stroke={layer.color} strokeWidth="2" />
            )}
            {ann.text && (
              <text x={rowMidX} y={rowTopY - 4}
                fontSize="10" fontFamily="sans-serif" textAnchor="middle"
                fill={layer.color} style={{ userSelect: 'none' }}>
                {ann.text.slice(0, 24)}
              </text>
            )}
          </g>
        )}
      })}
    </g>
  )
}

// ── DefaultShape (fallback for texture + other layers) ────────────────────────

function DefaultShape({ annotation, elementMap, containerRect, toVrv, onDragEnd, onHover, onLeave, onSelect }: ShapeProps) {
  const layer = LAYER_MAP.get(annotation.layer)
  if (!layer) return null

  const { offset, handleMouseDown } = useDrag(
    (annotation as any).visualOffset,
    off => onDragEnd(annotation.id, off)
  )

  const noteIds = annotation.noteIds || []
  const color = layer.color
  const regions: Array<{ left: number; top: number; right: number; bottom: number }> = []

  if (noteIds.length > 0 && toVrv) {
    noteIds.forEach(id => {
      const vrvId = toVrv.get(id) ?? id
      const domEl = document.getElementById(vrvId)
      if (!domEl) return
      const bbox = domEl.getBoundingClientRect()
      if (bbox.width === 0) return
      if (!domEl.closest('g.staff')) {
        const tspans = Array.from(domEl.querySelectorAll('tspan')).filter(t => t.textContent?.trim())
        const tboxes = tspans.map(t => t.getBoundingClientRect())
        const tTop = tboxes.length > 0 ? Math.min(...tboxes.map(b => b.top)) : bbox.top
        const small = tboxes.filter(b => b.height < 15)
        const tBottom = small.length > 0 ? Math.max(...small.map(b => b.bottom)) : bbox.top + bbox.height * 0.7
        regions.push({ left: bbox.left, top: tTop, right: bbox.right, bottom: tBottom })
      } else {
        regions.push({ left: bbox.left, top: bbox.top, right: bbox.right, bottom: bbox.bottom })
      }
    })
  }

  if (regions.length === 0) {
    for (let m = annotation.measureStart; m <= (annotation.measureEnd ?? annotation.measureStart); m++) {
      const el = elementMap.get(`measure-${m - 1}`)
      if (!el) continue
      el.staffBboxes.forEach(sb => regions.push({ left: sb.left, top: sb.top, right: sb.right, bottom: sb.bottom }))
    }
  }

  if (regions.length === 0) return null

  const minX = Math.min(...regions.map(b => b.left)) - containerRect.left - 2
  const minY = Math.min(...regions.map(b => b.top)) - containerRect.top - 2
  const maxX = Math.max(...regions.map(b => b.right)) - containerRect.left + 2
  const maxY = Math.max(...regions.map(b => b.bottom)) - containerRect.top + 2

  const lbl = getAnnotationLabel(annotation)

  return (
    <g
      transform={`translate(${offset.x}, ${offset.y})`}
      style={{ cursor: 'move', pointerEvents: 'all' }}
      onMouseDown={e => { handleMouseDown(e); onSelect(annotation.id) }}
      onMouseEnter={e => onHover(e.clientX, e.clientY, getTooltipText(annotation))}
      onMouseLeave={onLeave}
    >
      <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY}
        fill={color + '20'} stroke={color} strokeWidth="1.5" strokeOpacity="0.75" rx="3" />
      {lbl && (
        <text x={minX + 2} y={minY - 3}
          fontSize="9" fill={color} fontWeight="700" fontFamily="monospace">
          {lbl}
        </text>
      )}
    </g>
  )
}

// ── PlaybackHighlightShape ────────────────────────────────────────────────────

function PlaybackHighlightShape({ measureNum, elementMap }: {
  measureNum: number
  elementMap: Map<string, NoteElement>
}) {
  const bboxes: DOMRect[] = []
  for (const el of elementMap.values()) {
    if (el.measureNum === measureNum) bboxes.push(el.bbox)
  }
  if (bboxes.length === 0) return null

  // elementMap bboxes are already container-relative — use directly as SVG coordinates
  const minX = Math.min(...bboxes.map(b => b.left)) - 4
  const minY = Math.min(...bboxes.map(b => b.top)) - 8
  const maxX = Math.max(...bboxes.map(b => b.right)) + 4
  const maxY = Math.max(...bboxes.map(b => b.bottom)) + 8

  return (
    <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY}
      fill="rgba(59,130,246,0.14)" stroke="rgba(59,130,246,0.5)"
      strokeWidth="1.5" rx="3" />
  )
}

// ── Label helpers (kept) ──────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export function AnnotationOverlay({ annotations, visible, elementMap, containerRef, scrollRef, playbackMeasure, toVrv }: Props) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null)
  const [selectedAnchor, setSelectedAnchor] = useState<AnchorSide | null>(null)
  const updateAnnotation = useAnnotationStore(s => s.updateAnnotation)
  const noteMap = useScoreStore(s => s.noteMap)
  const legendColors = useLayerStore(s => s.legendColors)
  const melodyColors = getEffectiveMelodyColors(legendColors)

  // Refs for stale-closure-safe keyboard handler
  const selectedAnnIdRef  = useRef<string | null>(null)
  const selectedAnchorRef = useRef<AnchorSide | null>(null)
  const annotationsRef    = useRef(annotations)
  useEffect(() => { selectedAnnIdRef.current  = selectedAnnId  }, [selectedAnnId])
  useEffect(() => { selectedAnchorRef.current = selectedAnchor }, [selectedAnchor])
  useEffect(() => { annotationsRef.current    = annotations    }, [annotations])

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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest('svg')) { setSelectedAnnId(null); setSelectedAnchor(null) }
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  // Ctrl+arrows — move anchor of selected annotation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
      const annId = selectedAnnIdRef.current
      if (!annId) return
      const ann = annotationsRef.current[annId]
      if (!ann) return
      e.preventDefault()

      const dir = e.key === 'ArrowLeft' ? -1 : 1

      if (ann.layer === 'harmony') {
        // Move anchor note to prev/next note in staff-1
        const anchorId = ann.noteIds?.[0]
        if (!anchorId || !noteMap) return
        const allNotes = Array.from(noteMap.notes.values())
          .filter(n => n.staff === 1 && n.step !== 'R')
          .sort((a, b) => a.measureNum !== b.measureNum ? a.measureNum - b.measureNum : a.beat - b.beat)
        const idx = allNotes.findIndex(n => n.id === anchorId)
        if (idx < 0) return
        const next = allNotes[idx + dir]
        if (!next) return
        updateAnnotation(annId, {
          noteIds: [next.id],
          measureStart: next.measureNum,
        })
      }

      if (ann.layer === 'form' || ann.layer === 'labels') {
        const side = selectedAnchorRef.current
        if (!side) return
        const measureCount = Array.from(elementMap.keys()).length
        if (side === 'start') {
          const newStart = Math.max(1, (ann.measureStart ?? 1) + dir)
          const newEnd = ann.measureEnd ?? ann.measureStart
          if (newStart <= (newEnd ?? newStart)) updateAnnotation(annId, { measureStart: newStart })
        } else {
          const newEnd = Math.min(measureCount, ((ann.measureEnd ?? ann.measureStart) + dir))
          if (newEnd >= ann.measureStart) updateAnnotation(annId, { measureEnd: newEnd })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [updateAnnotation, elementMap, noteMap])

  if (!containerRect) return null

  const resolvedToVrv = toVrv ?? new Map()
  const annotationList = Object.values(annotations).filter(a => visible[a.layer as LayerId])

  const shapeProps = (ann: Annotation): ShapeProps => ({
    annotation: ann,
    elementMap,
    containerRect,
    toVrv: resolvedToVrv,
    onDragEnd: (id, offset) => updateAnnotation(id, { visualOffset: offset }),
    onHover: (x, y, text) => setTooltip({ x, y, text }),
    onLeave: () => setTooltip(null),
    isSelected: selectedAnnId === ann.id,
    onSelect: id => { setSelectedAnnId(id); setSelectedAnchor(null) },
    selectedAnchor: selectedAnnId === ann.id ? selectedAnchor : null,
    onSelectAnchor: side => setSelectedAnchor(side),
    melodyColors,
  })

  return (
    <>
      <svg
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', overflow: 'visible',
        }}
      >
        {playbackMeasure && (
          <PlaybackHighlightShape
            measureNum={playbackMeasure}
            elementMap={elementMap}
          />
        )}
        {annotationList.map(ann => {
          if (ann.layer === 'noteColor' || ann.layer === 'svgColor' || ann.layer === 'freehand') return null
          const props = shapeProps(ann)
          switch (ann.layer) {
            case 'harmony': return <HarmonyShape key={ann.id} {...props} />
            case 'melody':  return <MelodyShape  key={ann.id} {...props} />
            case 'motif':   return <MotifShape   key={ann.id} {...props} />
            case 'form':    return <FormShape    key={ann.id} {...props} />
            case 'labels':  return <LabelShape   key={ann.id} {...props} />
            default:        return <DefaultShape key={ann.id} {...props} />
          }
        })}
      </svg>

      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 14,
          top: tooltip.y - 32,
          background: 'rgba(15,23,42,0.92)',
          color: '#f8fafc',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'sans-serif',
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }}>
          {tooltip.text}
        </div>
      )}
    </>
  )
}
