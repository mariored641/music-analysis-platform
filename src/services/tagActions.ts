/**
 * Tagging actions — everything the QuickTagBar, shortcuts and inspector can
 * do to the current selection. One call = one undo step.
 */
import { useAnnotationStore, pushLabelHistory } from '../store/annotationStore'
import { useSelectionStore, type Selection } from '../store/selectionStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useLayerStore } from '../store/layerStore'
import { useResearchStore } from '../store/researchStore'
import { useUiStore } from '../store/uiStore'
import type {
  Annotation, ColorAnnotation, FormAnnotation, HarmonyAnnotation, LabelAnnotation, LayerId,
  MelodyAnnotation, MotifAnnotation, MotifVariant, NoteFunction, TextureAnnotation,
} from '../types/annotation'
import { newId, selectionLinkLabel } from './annotationQueries'
import { detectChord } from './chordDetector'
import { tr, isHe } from '../i18n'

const sel = () => useSelectionStore.getState().selection
const anns = () => useAnnotationStore.getState().annotations

function noteSel(): Extract<Selection, { kind: 'notes' }> | null {
  const s = sel()
  return s?.kind === 'notes' ? s : null
}

function reveal(layer: LayerId) {
  const ls = useLayerStore.getState()
  if (!ls.visible[layer]) ls.setVisible(layer, true)
}

function range(s: Selection) {
  return { measureStart: s.measureStart, measureEnd: s.measureEnd !== s.measureStart ? s.measureEnd : undefined }
}

/** First note of the selection (top staff at the earliest beat). */
export function anchorNote(): string | null {
  const s = noteSel()
  if (!s || s.noteIds.length === 0) return null
  return s.noteIds[0]
}

// ── Harmony ──────────────────────────────────────────────────────────────────

/** User harmony annotation anchored at the selection's first note, if any. */
export function harmonyAtAnchor(): HarmonyAnnotation | null {
  const a = anchorNote()
  if (!a) return null
  return (Object.values(anns()).find(x => x.layer === 'harmony' && x.noteIds?.[0] === a && !x.xmlChord) as HarmonyAnnotation) ?? null
}

export function setHarmony(patch: Partial<HarmonyAnnotation>) {
  const anchor = anchorNote()
  const s = sel()
  if (!s || !anchor) return
  const nm = useWorkspaceStore.getState().noteMap
  const m = nm?.notes.get(anchor)?.measureNum ?? s.measureStart
  const existing = harmonyAtAnchor()
  if (existing) {
    const next = { ...existing, ...patch }
    const empty = !next.chordSymbol && !next.scaleDegree && !next.function && !next.cadenceType && !next.modulation
    if (empty) useAnnotationStore.getState().removeAnnotation(existing.id)
    else useAnnotationStore.getState().updateAnnotation(existing.id, { ...patch, scriptId: undefined })
  } else {
    useAnnotationStore.getState().addAnnotation({
      id: newId('harm'), layer: 'harmony', measureStart: m, noteIds: [anchor], createdAt: Date.now(), ...patch,
    } as HarmonyAnnotation)
  }
  reveal('harmony')
}

export function addDetectedChord(): string | null {
  const s = noteSel()
  const nm = useWorkspaceStore.getState().noteMap
  if (!s || !nm) return null
  const chord = detectChord(s.noteIds, nm)
  if (!chord) return null
  setHarmony({ chordSymbol: chord })
  useUiStore.getState().toast(tr(`נוסף אקורד ${chord}`, `Added chord ${chord}`), 'success')
  return chord
}

// ── Melody ───────────────────────────────────────────────────────────────────

export function melodyFunctionsOfSelection(): Set<string> {
  const s = noteSel()
  const out = new Set<string>()
  if (!s) return out
  const ids = new Set(s.noteIds)
  for (const a of Object.values(anns())) {
    if (a.layer === 'melody' && a.noteFunction && a.noteIds?.some(id => ids.has(id))) out.add(a.noteFunction)
  }
  return out
}

/** Set the melodic function of every selected note (toggle off if all already have it). */
export function setMelodyFunction(fn: NoteFunction) {
  const s = noteSel()
  if (!s || s.noteIds.length === 0) return
  const ids = new Set(s.noteIds)
  const nm = useWorkspaceStore.getState().noteMap
  const existing = Object.values(anns()).filter((a): a is MelodyAnnotation => a.layer === 'melody' && !!a.noteIds?.some(id => ids.has(id)))
  const covered = new Set(existing.filter(a => a.noteFunction === fn && !a.scriptId).flatMap(a => a.noteIds ?? []))
  const allHave = s.noteIds.every(id => covered.has(id))
  useAnnotationStore.getState().transact(draft => {
    for (const a of existing) {
      const rest = (a.noteIds ?? []).filter(id => !ids.has(id))
      if (rest.length) draft[a.id] = { ...a, noteIds: rest }
      else delete draft[a.id]
    }
    if (!allHave) {
      for (const id of s.noteIds) {
        draft[`mel-${id}`] = {
          id: `mel-${id}`, layer: 'melody', measureStart: nm?.notes.get(id)?.measureNum ?? s.measureStart,
          noteIds: [id], noteFunction: fn, createdAt: Date.now(),
        }
      }
    }
  })
  reveal('melody')
}

// ── Motif ────────────────────────────────────────────────────────────────────

export function motifLabels(): string[] {
  const set = new Set<string>()
  for (const a of Object.values(anns())) if (a.layer === 'motif') set.add(a.label.replace(/['’]+$/, ''))
  return [...set].sort()
}

export function nextMotifLabel(): string {
  const used = new Set(motifLabels())
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i)
    if (!used.has(l)) return l
  }
  return `M${used.size + 1}`
}

export function addMotif(label: string, variantType: MotifVariant = 'original') {
  const s = noteSel()
  if (!s || s.noteIds.length === 0) return
  const same = Object.values(anns()).find((a): a is MotifAnnotation =>
    a.layer === 'motif' && a.label === label && sameSet(a.noteIds ?? [], s.noteIds))
  if (same) {
    useAnnotationStore.getState().updateAnnotation(same.id, { variantType, scriptId: undefined })
  } else {
    useAnnotationStore.getState().addAnnotation({
      id: newId('motif'), layer: 'motif', label, variantType, noteIds: s.noteIds, ...range(s), createdAt: Date.now(),
    } as MotifAnnotation)
  }
  reveal('motif')
}

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every(x => s.has(x))
}

// ── Form / texture ───────────────────────────────────────────────────────────

export function addForm(label: string, level: 'midLevel' | 'highLevel' | 'lowLevel' = 'midLevel') {
  const s = sel()
  if (!s) return
  const same = Object.values(anns()).find((a): a is FormAnnotation =>
    a.layer === 'form' && a.measureStart === s.measureStart && (a.measureEnd ?? a.measureStart) === s.measureEnd)
  if (same) useAnnotationStore.getState().updateAnnotation(same.id, { [level]: label })
  else useAnnotationStore.getState().addAnnotation({ id: newId('form'), layer: 'form', ...range(s), [level]: label, createdAt: Date.now() } as FormAnnotation)
  reveal('form')
}

export function addTexture(textureType: NonNullable<TextureAnnotation['textureType']>) {
  const s = sel()
  if (!s) return
  useAnnotationStore.getState().addAnnotation({ id: newId('tex'), layer: 'texture', ...range(s), textureType, createdAt: Date.now() } as TextureAnnotation)
  reveal('texture')
}

// ── Labels / questions ──────────────────────────────────────────────────────

export function addLabel(text: string, isQuestion = false) {
  const s = sel()
  const t = text.trim()
  if (!s || !t) return
  useAnnotationStore.getState().addAnnotation({
    id: newId(isQuestion ? 'q' : 'label'), layer: 'labels', text: t, isQuestion: isQuestion || undefined,
    noteIds: s.kind === 'notes' && !s.wholeMeasures ? s.noteIds : undefined, ...range(s), createdAt: Date.now(),
  } as LabelAnnotation)
  if (!isQuestion) pushLabelHistory(t)
  reveal(isQuestion ? 'questions' : 'labels')
}

// ── Color ────────────────────────────────────────────────────────────────────

export function colorSelection(color: string | null) {
  const s = sel()
  if (!s) return
  const store = useAnnotationStore.getState()
  if (s.kind === 'element') {
    const existing = Object.values(anns()).filter((a): a is ColorAnnotation => a.layer === 'color' && a.element?.index === s.element.index)
    store.transact(draft => {
      existing.forEach(a => delete draft[a.id])
      if (color) {
        const id = newId('color')
        draft[id] = { id, layer: 'color', color, element: s.element, measureStart: s.measureStart, createdAt: Date.now() }
      }
    })
  } else {
    const ids = new Set(s.noteIds)
    const existing = Object.values(anns()).filter((a): a is ColorAnnotation => a.layer === 'color' && !a.element && !!a.noteIds?.some(id => ids.has(id)))
    store.transact(draft => {
      for (const a of existing) {
        const rest = (a.noteIds ?? []).filter(id => !ids.has(id))
        if (rest.length) draft[a.id] = { ...a, noteIds: rest }
        else delete draft[a.id]
      }
      if (color) {
        const id = newId('color')
        draft[id] = { id, layer: 'color', color, noteIds: s.noteIds, ...range(s), createdAt: Date.now() }
      }
    })
  }
  reveal('color')
}

// ── Research notes ───────────────────────────────────────────────────────────

export function linkSelectionToNewNote() {
  const s = sel()
  if (!s) return
  const nm = useWorkspaceStore.getState().noteMap
  useResearchStore.getState().addNote(null, {
    type: s.kind === 'notes' && !s.wholeMeasures ? 'notes' : 'measures',
    measureStart: s.measureStart,
    measureEnd: s.measureEnd,
    noteIds: s.kind === 'notes' && !s.wholeMeasures ? s.noteIds : undefined,
    label: selectionLinkLabel(s, nm, isHe()),
  })
  useUiStore.getState().setRightTab('notes')
}

// ── Delete ───────────────────────────────────────────────────────────────────

export function deleteAnnotation(id: string) {
  const a = anns()[id]
  if (!a) return
  useAnnotationStore.getState().removeAnnotation(id)
  if (useSelectionStore.getState().selectedAnnotationId === id) useSelectionStore.getState().selectAnnotation(null)
  useUiStore.getState().toast(tr('התיוג נמחק', 'Tag deleted'), 'info', { label: tr('בטל', 'Undo'), run: () => useAnnotationStore.getState().undo() })
}

export function annotationById(id: string | null): Annotation | null {
  return id ? anns()[id] ?? null : null
}
