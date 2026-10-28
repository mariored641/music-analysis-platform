/**
 * Library-card thumbnails: the first system of the rendered score, rasterized
 * to a small WebP and kept in IndexedDB.
 */
import { kvDelete, kvGet, kvSet } from '../services/storageService'
import type { Rect } from './geometry'

const cache = new Map<string, string | null>()
const listeners = new Set<() => void>()

export async function saveThumbnail(pieceId: string, host: HTMLElement, sys: Rect) {
  try {
    const svg = host.querySelector('svg')
    if (!svg) return
    const pad = 14
    const box = { x: Math.max(0, sys.x - pad), y: Math.max(0, sys.y - 34), w: sys.w + pad * 2, h: sys.h + 56 }
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.querySelectorAll('[style]').forEach(el => (el as SVGElement).removeAttribute('style'))
    clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`)
    const W = 520, H = Math.round((W * box.h) / box.w)
    clone.setAttribute('width', String(W))
    clone.setAttribute('height', String(H))
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0, W, H)
    URL.revokeObjectURL(url)
    const data = canvas.toDataURL('image/webp', 0.82)
    cache.set(pieceId, data)
    await kvSet(`thumb:${pieceId}`, data)
    listeners.forEach(l => l())
  } catch (e) {
    console.warn('thumbnail failed', e)
  }
}

export async function loadThumbnail(pieceId: string): Promise<string | null> {
  if (cache.has(pieceId)) return cache.get(pieceId) ?? null
  const data = (await kvGet<string>(`thumb:${pieceId}`).catch(() => undefined)) ?? null
  cache.set(pieceId, data)
  return data
}

export async function deleteThumbnail(pieceId: string) {
  cache.delete(pieceId)
  await kvDelete(`thumb:${pieceId}`).catch(() => {})
}

export function onThumbnailChange(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
