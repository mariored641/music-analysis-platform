import { memo, useRef, useState } from 'react'
import type { Annotation, HarmonyAnnotation, LabelAnnotation, MotifAnnotation, FormAnnotation, TextureAnnotation } from '../types/annotation'
import type { ScoreGeometry, NoteBox } from './geometry'
import { notesBySystem, segmentsForRange, systemOfMeasure } from './geometry'
import { blobPath } from './shapes'
import { formColor, motifColor, LAYER_MAP } from '../constants/layers'
import { motifTag, measureEnd, summarize } from '../services/annotationQueries'
import { useAnnotationStore } from '../store/annotationStore'
import { useSelectionStore } from '../store/selectionStore'
import { selectNotes, selectMeasures } from './selectionOps'
import { TEXTURE_TYPES } from '../constants/tags'

interface Props {
  geometry: ScoreGeometry
  annotations: Annotation[]
  colors: Record<string, string>
  selectedId: string | null
  scale: number
  he: boolean
}

type Drag = { id: string; dx: number; dy: number; moved: boolean }
type AnchorDrag = { id: string; x: number; y: number }

// vertical placement relative to a system (page units)
const CHORD_DY = -26
const RN_DY = 24
const FORM_DY = 42
const TEXTURE_DY = 56
const LABEL_CLEAR = 30   // labels sit above the chord-symbol line

export const AnnotationLayer = memo(function AnnotationLayer({ geometry: g, annotations, colors, selectedId, scale, he }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const [anchorDrag, setAnchorDrag] = useState<AnchorDrag | null>(null)
  const dragRef = useRef<Drag | null>(null)

  /** Select the annotation (and its notes) and start a drag that commits visualOffset. */
  const startDrag = (e: React.PointerEvent, a: Annotation) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    if (a.layer === 'form' || a.layer === 'texture') selectMeasures(a.measureStart, measureEnd(a))
    else if (a.noteIds?.length) selectNotes(a.noteIds)
    useSelectionStore.getState().selectAnnotation(a.id)

    const sx = e.clientX, sy = e.clientY
    const onMove = (ev: PointerEvent) => {
      const d = { id: a.id, dx: (ev.clientX - sx) / scale, dy: (ev.clientY - sy) / scale, moved: false }
      d.moved = Math.hypot(d.dx, d.dy) > 2
      dragRef.current = d
      setDrag(d)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (d?.moved) {
        const off = a.visualOffset ?? { x: 0, y: 0 }
        useAnnotationStore.getState().updateAnnotation(a.id, { visualOffset: { x: off.x + d.dx, y: off.y + d.dy } })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /** Drag a harmony's anchor dot onto another note → changes the chord's real position. */
  const startAnchorDrag = (e: React.PointerEvent, a: Annotation, origin: { x: number; y: number }) => {
    e.stopPropagation()
    e.preventDefault()
    const svg = (e.currentTarget as SVGElement).ownerSVGElement!
    const toPage = (ev: { clientX: number; clientY: number }) => {
      const r = svg.getBoundingClientRect()
      return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }
    }
    let last = origin
    const onMove = (ev: PointerEvent) => { last = toPage(ev); setAnchorDrag({ id: a.id, ...last }) }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setAnchorDrag(null)
      let best: NoteBox | null = null, bestD = 30
      for (const n of g.notes.values()) {
        const d = Math.hypot(n.cx - last.x, n.cy - last.y)
        if (d < bestD) { bestD = d; best = n }
      }
      if (best && best.id !== a.noteIds?.[0]) {
        useAnnotationStore.getState().updateAnnotation(a.id, { noteIds: [best.id], measureStart: best.measure, measureEnd: best.measure, visualOffset: undefined })
        selectNotes([best.id])
        useSelectionStore.getState().selectAnnotation(a.id)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const resetOffset = (e: React.MouseEvent, a: Annotation) => {
    e.stopPropagation()
    if (a.visualOffset) useAnnotationStore.getState().updateAnnotation(a.id, { visualOffset: undefined })
  }

  const offsetOf = (a: Annotation) => {
    const base = a.visualOffset ?? { x: 0, y: 0 }
    return drag?.id === a.id ? { x: base.x + drag.dx, y: base.y + drag.dy } : base
  }

  const common = (a: Annotation) => ({
    onPointerDown: (e: React.PointerEvent) => startDrag(e, a),
    onDoubleClick: (e: React.MouseEvent) => resetOffset(e, a),
    className: `ann ann-${a.layer}${selectedId === a.id ? ' is-selected' : ''}`,
  })

  const out: React.ReactNode[] = []

  for (const a of annotations) {
    const off = offsetOf(a)
    const sel = selectedId === a.id
    const title = summarize(a, he)

    if (a.layer === 'harmony') {
      const h = a as HarmonyAnnotation
      const anchor = h.noteIds?.[0] ? g.notes.get(h.noteIds[0]) : undefined
      const sys = anchor ? g.systems[anchor.system] : systemOfMeasure(g, h.measureStart)
      const mb = g.measures[h.measureStart - 1]
      if (!sys || !mb) continue
      const ax = anchor ? anchor.x : mb.x + 10
      const chord = h.xmlChord ? '' : (h.chordSymbol ?? '')
      const rn = [h.scaleDegree, h.function && `(${h.function})`].filter(Boolean).join(' ')
      const color = colors['harmony:chord'] ?? LAYER_MAP.get('harmony')!.color
      const rnColor = colors['harmony:rn'] ?? '#1e40af'
      const cadColor = colors['harmony:cadence'] ?? '#b45309'
      const cy = sys.y + CHORD_DY + off.y
      const ry = sys.y + sys.h + RN_DY + off.y
      out.push(
        <g key={a.id} {...common(a)}>
          <title>{title}</title>
          {chord && <text x={ax + off.x} y={cy} className="ann-chord" fill={color}>{prettyChord(chord)}</text>}
          {(rn || h.cadenceType) && (
            <text x={ax + off.x} y={ry} className="ann-rn" fill={rnColor}>
              {rn}{h.cadenceType && <tspan fill={cadColor} className="ann-cadence" dx={rn ? 6 : 0}>{h.cadenceType}</tspan>}
            </text>
          )}
          {!chord && !rn && !h.cadenceType && h.modulation && <text x={ax + off.x} y={ry} className="ann-rn" fill={rnColor}>→ {h.modulation}</text>}
          {/* generous invisible hit area */}
          <rect x={ax + off.x - 4} y={(chord ? cy - 16 : ry - 14)} width={Math.max(28, (chord || rn).length * 9 + 12)} height={20} fill="transparent" />
          {sel && anchor && (
            <g className="ann-anchor">
              <line x1={ax + off.x + 4} y1={(chord ? cy + 4 : ry - 14)} x2={anchorDrag?.id === a.id ? anchorDrag.x : anchor.cx} y2={anchorDrag?.id === a.id ? anchorDrag.y : anchor.cy} />
              <circle cx={anchorDrag?.id === a.id ? anchorDrag.x : anchor.cx} cy={anchorDrag?.id === a.id ? anchorDrag.y : anchor.cy} r={6}
                onPointerDown={e => startAnchorDrag(e, a, { x: anchor.cx, y: anchor.cy })} />
            </g>
          )}
        </g>,
      )
      continue
    }

    if (a.layer === 'motif') {
      const m = a as MotifAnnotation
      const color = motifColor(m.label, colors)
      const groups = notesBySystem(g, m.noteIds ?? [])
      if (groups.length === 0) continue
      const variant = m.variantType && m.variantType !== 'original'
      out.push(
        <g key={a.id} {...common(a)} transform={`translate(${off.x} ${off.y})`}>
          <title>{title}</title>
          {groups.map((grp, i) => (
            <path key={i} d={blobPath(grp.map(n => ({ x: n.cx, y: n.cy })), 10, i > 0, i < groups.length - 1)}
              fill={color} fillOpacity={sel ? 0.22 : 0.12} stroke={color} strokeWidth={sel ? 2.2 : 1.4}
              strokeDasharray={variant ? '5 3' : undefined} />
          ))}
          <g transform={`translate(${groups[0][0].cx - 12} ${Math.min(...groups[0].map(n => n.cy)) - 26})`}>
            <rect rx={7} height={15} width={motifTag(m.label, m.variantType).length * 7 + 10} fill={color} />
            <text x={5} y={11} className="ann-pill-text">{motifTag(m.label, m.variantType)}</text>
          </g>
        </g>,
      )
      continue
    }

    if (a.layer === 'form' || a.layer === 'texture') {
      const isForm = a.layer === 'form'
      const label = isForm
        ? [(a as FormAnnotation).midLevel, (a as FormAnnotation).highLevel, (a as FormAnnotation).lowLevel].filter(Boolean).join(' · ')
        : (TEXTURE_TYPES.find(t => t.value === (a as TextureAnnotation).textureType)?.[he ? 'he' : 'en'] ?? '')
      const color = isForm ? formColor((a as FormAnnotation).midLevel || (a as FormAnnotation).highLevel || (a as FormAnnotation).lowLevel || '', colors) : (colors['texture'] ?? '#0891b2')
      const segs = segmentsForRange(g, a.measureStart, measureEnd(a))
      out.push(
        <g key={a.id} {...common(a)} transform={`translate(${off.x} ${off.y})`}>
          <title>{title}</title>
          {segs.map((s, i) => {
            const y = s.system.y + s.system.h + (isForm ? FORM_DY : TEXTURE_DY)
            const th = isForm ? 5 : 3
            return (
              <g key={i}>
                <rect x={s.x0 + 2} y={y} width={Math.max(8, s.x1 - s.x0 - 4)} height={th} rx={th / 2} fill={color} opacity={sel ? 1 : 0.85} />
                {i === 0 && <line x1={s.x0 + 2} x2={s.x0 + 2} y1={y - 7} y2={y + th} stroke={color} strokeWidth={2} />}
                {i === segs.length - 1 && <line x1={s.x1 - 2} x2={s.x1 - 2} y1={y - 7} y2={y + th} stroke={color} strokeWidth={2} />}
                <text x={s.x0 + 8} y={y - 4} className={isForm ? 'ann-form-text' : 'ann-texture-text'} fill={color}>{i === 0 ? label : `(${label})`}</text>
                <rect x={s.x0} y={y - 16} width={s.x1 - s.x0} height={th + 18} fill="transparent" />
              </g>
            )
          })}
        </g>,
      )
      continue
    }

    if (a.layer === 'labels') {
      const l = a as LabelAnnotation
      const color = l.isQuestion ? (colors['questions'] ?? '#dc2626') : (colors['labels'] ?? '#ca8a04')
      const groups = l.noteIds?.length ? notesBySystem(g, l.noteIds) : []
      const segs = groups.length
        ? groups.map(grp => ({ x0: grp[0].x - 2, x1: grp[grp.length - 1].x + grp[grp.length - 1].w + 2, top: Math.min(...grp.map(n => n.y - 2), g.systems[grp[0].system].y - LABEL_CLEAR) }))
        : segmentsForRange(g, l.measureStart, measureEnd(l)).map(s => ({ x0: s.x0 + 4, x1: s.x1 - 4, top: s.system.y - LABEL_CLEAR }))
      if (segs.length === 0) continue
      out.push(
        <g key={a.id} {...common(a)} transform={`translate(${off.x} ${off.y})`}>
          <title>{title}</title>
          {segs.map((s, i) => {
            const y = s.top - 10
            return (
              <g key={i}>
                <path d={`M${s.x0} ${y + 5} V${y} H${s.x1} V${y + 5}`} fill="none" stroke={color} strokeWidth={sel ? 2 : 1.4} strokeDasharray={l.isQuestion ? '4 3' : undefined} />
                {i === 0 && (
                  <text x={(s.x0 + s.x1) / 2} y={y - 4} textAnchor="middle" className="ann-label-text" fill={color}>
                    {l.isQuestion ? '? ' : ''}{l.text}
                  </text>
                )}
                <rect x={s.x0} y={y - 16} width={Math.max(20, s.x1 - s.x0)} height={22} fill="transparent" />
              </g>
            )
          })}
        </g>,
      )
    }
  }

  return <g className="annotation-layer">{out}</g>
})

/** Typographic chord symbol: b → ♭, # → ♯ (only right after the root / bass letter). */
export function prettyChord(s: string) {
  return s.replace(/^([A-G])b/, '$1♭').replace(/^([A-G])#/, '$1♯').replace(/\/([A-G])b/, '/$1♭').replace(/\/([A-G])#/, '/$1♯')
}
