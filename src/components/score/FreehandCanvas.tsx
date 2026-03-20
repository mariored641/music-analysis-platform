import { useRef, useEffect, useState, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useAnnotationStore } from '../../store/annotationStore'
import { useLayerStore } from '../../store/layerStore'

const COLORS = ['#ec4899', '#f97316', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444']
const STROKE = 2

interface Point { x: number; y: number }

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function FreehandCanvas({ containerRef }: Props) {
  const visible = useLayerStore(s => s.visible)
  const { addAnnotation } = useAnnotationStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const currentPath = useRef<Point[]>([])
  const [color, setColor] = useState(COLORS[0])
  const [active, setActive] = useState(false)

  // Resize canvas to match container
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

  const getPos = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const drawLine = useCallback((from: Point, to: Point, col: string) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.strokeStyle = col
    ctx.lineWidth = STROKE
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    if (!active) return
    drawing.current = true
    const pt = getPos(e)
    currentPath.current = [pt]
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!active || !drawing.current) return
    const pt = getPos(e)
    const prev = currentPath.current[currentPath.current.length - 1]
    drawLine(prev, pt, color)
    currentPath.current.push(pt)
  }

  const onMouseUp = () => {
    if (!drawing.current) return
    drawing.current = false
    if (currentPath.current.length < 2) { currentPath.current = []; return }

    // Build SVG path string from points
    const pts = currentPath.current
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`

    addAnnotation({
      id: uuid(),
      layer: 'freehand',
      measureStart: 1,
      path: d,
      color,
      strokeWidth: STROKE,
      createdAt: Date.now(),
    })
    currentPath.current = []
  }

  // Redraw all freehand annotations on canvas when they change
  const annotations = useAnnotationStore(s => s.annotations)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!visible.freehand) return
    Object.values(annotations)
      .filter((a): a is any => a.layer === 'freehand')
      .forEach(ann => {
        const path = new Path2D(ann.path)
        ctx.strokeStyle = ann.color
        ctx.lineWidth = ann.strokeWidth ?? STROKE
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke(path)
      })
  }, [annotations, visible.freehand])

  if (!visible.freehand) return null

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: active ? 'all' : 'none',
          cursor: active ? 'crosshair' : 'default',
          zIndex: 20,
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
      {/* Toolbar */}
      <div style={{
        position: 'sticky',
        top: 4,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#1a1a2e',
        border: '1px solid #2d2d4e',
        borderRadius: 8,
        padding: '4px 8px',
        zIndex: 30,
        pointerEvents: 'all',
        width: 'fit-content',
      }}>
        <button
          onClick={() => setActive(a => !a)}
          style={{
            background: active ? '#ec4899' : '#2d2d4e',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontSize: 11,
            padding: '3px 8px',
            cursor: 'pointer',
          }}
        >
          ✏️ {active ? 'Drawing' : 'Draw'}
        </button>
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: c,
              border: color === c ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </div>
    </>
  )
}
