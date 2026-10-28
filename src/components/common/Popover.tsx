import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Floating panel anchored to a client point; closes on outside pointerdown / Escape.
 * Clamped to the viewport.
 */
export function Popover({ at, onClose, children, className }: { at: { x: number; y: number }; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(at)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)),
    })
  }, [at.x, at.y])
  useEffect(() => {
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    const t = setTimeout(() => window.addEventListener('pointerdown', down, true), 0)
    window.addEventListener('keydown', key, true)
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true) }
  }, [onClose])
  return createPortal(
    <div ref={ref} className={`popover ${className ?? ''}`} style={{ left: pos.x, top: pos.y }}>{children}</div>,
    document.body,
  )
}
