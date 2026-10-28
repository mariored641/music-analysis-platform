import type { Annotation, LayerId, LabelAnnotation } from '../types/annotation'
import type { Selection } from '../store/selectionStore'
import type { Visibility } from '../store/layerStore'
import type { NoteMap } from '../types/score'
import { MELODY_FUNCTIONS } from '../constants/layers'
import { MOTIF_VARIANTS, TEXTURE_TYPES, VARIANT_SHORT } from '../constants/tags'

/** The visibility layer an annotation belongs to (questions are labels with isQuestion). */
export function visKey(a: Annotation): LayerId {
  if (a.layer === 'labels' && (a as LabelAnnotation).isQuestion) return 'questions'
  return a.layer
}

export function isVisible(a: Annotation, visible: Visibility): boolean {
  if (a.layer === 'freehand') return visible.freehand || (!!a.linkedLayer && !!visible[a.linkedLayer])
  return !!visible[visKey(a)]
}

export function measureEnd(a: { measureStart: number; measureEnd?: number }) {
  return a.measureEnd ?? a.measureStart
}

/** Annotations that apply to the current selection, grouped in display order. */
export function annotationsForSelection(
  annotations: Record<string, Annotation>,
  sel: Selection | null,
): Annotation[] {
  if (!sel) return []
  const ids = sel.kind === 'notes' ? new Set(sel.noteIds) : new Set<string>()
  const out: Annotation[] = []
  for (const a of Object.values(annotations)) {
    if (a.layer === 'freehand') continue
    if (sel.kind === 'element') {
      if (a.layer === 'color' && a.element && a.element.index === sel.element.index) out.push(a)
      continue
    }
    if (a.noteIds?.length && a.layer !== 'form' && a.layer !== 'texture') {
      if (a.noteIds.some(id => ids.has(id))) out.push(a)
    } else if (a.measureStart <= sel.measureEnd && measureEnd(a) >= sel.measureStart) {
      out.push(a)
    }
  }
  const order: LayerId[] = ['form', 'texture', 'harmony', 'motif', 'melody', 'labels', 'questions', 'color']
  return out.sort((a, b) => order.indexOf(visKey(a)) - order.indexOf(visKey(b)) || a.measureStart - b.measureStart)
}

export function summarize(a: Annotation, he: boolean): string {
  switch (a.layer) {
    case 'harmony': {
      const parts = [a.chordSymbol, a.scaleDegree, a.function, a.cadenceType, a.modulation && `→ ${a.modulation}`].filter(Boolean)
      return parts.join(' · ') || (he ? 'הרמוניה' : 'Harmony')
    }
    case 'melody': {
      const f = MELODY_FUNCTIONS.find(x => x.value === a.noteFunction)
      return f ? `${f.value} — ${he ? f.he : f.en}` : (he ? 'מלודיה' : 'Melody')
    }
    case 'motif': {
      const v = MOTIF_VARIANTS.find(x => x.value === a.variantType)
      const variant = v && v.value !== 'original' ? ` (${he ? v.he : v.en})` : ''
      return `${he ? 'מוטיב' : 'Motif'} ${a.label}${variant}`
    }
    case 'form':
      return [a.highLevel, a.midLevel, a.lowLevel].filter(Boolean).join(' / ') || (he ? 'חלק' : 'Section')
    case 'texture': {
      const t = TEXTURE_TYPES.find(x => x.value === a.textureType)
      return t ? (he ? t.he : t.en) : (he ? 'מרקם' : 'Texture')
    }
    case 'labels':
      return a.text
    case 'color':
      return a.element ? (he ? 'אלמנט צבוע' : 'Colored element') : (he ? 'תווים צבועים' : 'Colored notes')
    case 'freehand':
      return a.label || (he ? 'ציור' : 'Drawing')
  }
}

/** Short on-score text for a motif (A, A inv…) */
export function motifTag(label: string, variant?: string) {
  const v = variant ? VARIANT_SHORT[variant] : ''
  return v ? `${label} ${v}` : label
}

export function rangeLabel(start: number, end: number, he: boolean) {
  const m = he ? 'ת.' : 'm.'
  return start === end ? `${m}${start}` : `${m}${start}–${end}`
}

export function selectionLinkLabel(sel: Selection, noteMap: NoteMap | null, he: boolean): string {
  if (sel.kind === 'notes' && sel.noteIds.length === 1 && noteMap) {
    const n = noteMap.notes.get(sel.noteIds[0])
    if (n) return `${n.pitch} ${rangeLabel(n.measureNum, n.measureNum, he)}`
  }
  return rangeLabel(sel.measureStart, sel.measureEnd, he)
}

let idSeq = 0
export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${(idSeq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`
}
