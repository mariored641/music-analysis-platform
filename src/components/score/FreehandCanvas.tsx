import { useRef, useEffect, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useAnnotationStore } from '../../store/annotationStore'
import { useLayerStore } from '../../store/layerStore'
import { useStylusStore } from '../../store/stylusStore'
import type { FreehandAnnotation, LayerId } from '../../types/annotation'

interface Point { x: number; y: number }

// Parse "M x y L x y..." to array of points
function parsePathPoints(d: string): Point[] {
  const pts: Point[] = []
  const parts = d.trim().split(/[ML]/).map(s => s.trim()).filter(Boolean)
  for (const part of parts) {
    const nums = part.split(/\s+/)
    if (nums.length >= 2) {
      pts.push({ x: parseFloat(nums[0]), y: parseFloat(nums[1]) })
    }
  }
  return pts
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function isNearPath(d: string, x: number, y: number, threshold = 14): boolean {
  const pts = parsePathPoints(d)
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < threshold) return true
  }
  return false
}

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function FreehandCanvas({ containerRef }: Props) {
  const visible = useLayerStore(s => s.visible)
  const { annotations, addAnnotation, removeAnnotation } = useAnnotationStore()
  const { palette, activeColorId, drawMode } = useStylusStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const currentPath = useRef<Point[]>([])

  const activeEntry = palette.find(e => e.id === activeColorId) ?? palette[0]
  const mode = drawMode

  // Resize canvas to match full scroll size of container
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      canvas.width = container.scrollWidth
      canvas.height = container.scrollHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [containerRef])

  // A stroke is visible if: freehand layer is on AND (no linkedLayer, or linkedLayer is also on)
  const isStrokeVisible = useCallback((ann: FreehandAnnotation): boolean => {
    if (!visible.freehand) return false
    if (ann.linkedLayer && ann.linkedLayer !== 'freehand') {
      if (visible[ann.linkedLayer as LayerId] === false) return false
    }
    return true
  }, [visible])

  // Redraw all stored strokes onto the canvas
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    Object.values(annotations)
      .filter((a): a is FreehandAnnotation => a.layer === 'freehand')
      .filter(isStrokeVisible)
      .forEach(ann => {
        const path = new Path2D(ann.path)
        ctx.save()
        ctx.globalAlpha = ann.opacity ?? 1
        ctx.strokeStyle = ann.color
        ctx.lineWidth = ann.strokeWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke(path)
        ctx.restore()
      })
  }, [annotations, isStrokeVisible])

  useEffect(() => { redrawAll() }, [redrawAll])

  // Get canvas-space coordinates from a pointer event
  const getPos = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const drawSegment = (from: Point, to: Point) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !activeEntry) return
    ctx.save()
    ctx.globalAlpha = activeEntry.opacity
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.strokeStyle = activeEntry.color
    ctx.lineWidth = activeEntry.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode === 'off') return
    const pt = getPos(e)

    if (mode === 'erase') {
      const strokes = Object.values(annotations)
        .filter((a): a is FreehandAnnotation => a.layer === 'freehand' && isStrokeVisible(a))
      for (const stroke of strokes) {
        if (isNearPath(stroke.path, pt.x, pt.y)) {
          removeAnnotation(stroke.id)
          return
        }
      }
      return
    }

    // Draw mode — capture pointer so we get events even if cursor leaves canvas
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
    drawing.current = true
    currentPath.current = [pt]
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode !== 'draw' || !drawing.current) return
    const pt = getPos(e)
    const prev = currentPath.current[currentPath.current.length - 1]
    drawSegment(prev, pt)
    currentPath.current.push(pt)
  }

  const onPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    if (currentPath.current.length < 2) { currentPath.current = []; return }

    const pts = currentPath.current
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`

    addAnnotation({
      id: uuid(),
      layer: 'freehand',
      measureStart: 1,
      path: d,
      color: activeEntry?.color ?? '#ef4444',
      strokeWidth: activeEntry?.width ?? 3,
      opacity: activeEntry?.opacity ?? 1,
      linkedLayer: activeEntry?.linkedLayer,
      createdAt: Date.now(),
    } as FreehandAnnotation)
    currentPath.current = []
  }

  if (!visible.freehand) return null

  const modeOff = mode === 'off'
  const modeDraw = mode === 'draw'
  const modeErase = mode === 'erase'

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: mode === 'off' ? 'none' : 'all',
        cursor: mode === 'draw' ? 'crosshair' : mode === 'erase' ? 'cell' : 'default',
        touchAction: mode === 'off' ? 'auto' : 'none',
        zIndex: 20,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )
}
