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
import { detectChord, respellChordSymbol, simplifyChordSymbol, spelledFromStepAlter } from './chordDetector'
import { keyOfSignature } from './romanNumeralScript'
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

type AnnMap = Record<string, Annotation>

/** Onset key of a note: same measure + same beat = same chord position. */
function onsetOf(noteId: string): string | null {
  const n = useWorkspaceStore.getState().noteMap?.notes.get(noteId)
  return n ? `${n.measureNum}|${Math.round(n.beat * 100)}` : null
}

/**
 * Harmony annotation at a note's chord position: anchored on the note itself, else on
 * another note sounding at the same onset. Hand-made chords win over script/printed ones.
 */
export function harmonyAt(noteId: string | null, all: AnnMap = anns()): HarmonyAnnotation | null {
  if (!noteId) return null
  const key = onsetOf(noteId)
  let best: HarmonyAnnotation | null = null, bestRank = Infinity
  for (const a of Object.values(all)) {
    if (a.layer !== 'harmony' || !a.noteIds?.[0]) continue
    const exact = a.noteIds[0] === noteId
    if (!exact && (!key || onsetOf(a.noteIds[0]) !== key)) continue
    const rank = (exact ? 0 : 2) + (a.xmlChord ? 1 : 0)
    if (rank < bestRank) { bestRank = rank; best = a as HarmonyAnnotation }
  }
  return best
}

/** Harmony annotation at the selection's first note (or its onset), if any. */
export function harmonyAtAnchor(): HarmonyAnnotation | null {
  return harmonyAt(anchorNote())
}

/** Write a harmony patch at one chord position (inside a transaction). */
function applyHarmony(draft: AnnMap, anchorId: string, patch: Partial<HarmonyAnnotation>) {
  const existing = harmonyAt(anchorId, draft)
  if (existing) {
    // A printed chord symbol stays as printed — only its analysis (degree, function…) changes
    const p = existing.xmlChord ? { ...patch, chordSymbol: existing.chordSymbol } : patch
    const next = { ...existing, ...p, scriptId: undefined } as HarmonyAnnotation
    const empty = !next.chordSymbol && !next.scaleDegree && !next.function && !next.cadenceType && !next.modulation
    if (empty) delete draft[existing.id]
    else draft[existing.id] = next
    return
  }
  if (Object.values(patch).every(v => v === undefined || v === '')) return
  const nm = useWorkspaceStore.getState().noteMap
  const note = nm?.notes.get(anchorId)
  const printed = note ? printedChordAt(note.measureNum, note.beat) : null
  const id = newId('harm')
  draft[id] = {
    id, layer: 'harmony', measureStart: note?.measureNum ?? sel()?.measureStart ?? 1, noteIds: [anchorId], createdAt: Date.now(),
    ...patch,
    // analysis of a chord the score already prints keeps the printed symbol (drawn by the score, not by us)
    ...(printed && (patch.chordSymbol === undefined || patch.chordSymbol === printed) ? { chordSymbol: printed, xmlChord: true } : {}),
  } as HarmonyAnnotation
}

/** Chord symbol printed in the MusicXML at an exact onset, if any. */
export function printedChordAt(measure: number, beat: number): string | null {
  const items = useWorkspaceStore.getState().xmlHarmonies
  return items.find(h => h.measureNum === measure && Math.abs(h.beat - beat) < 0.01)?.label ?? null
}

/** Chord symbol printed at a note's onset, if any. */
export function printedChordAtNote(noteId: string | null): string | null {
  const n = noteId ? useWorkspaceStore.getState().noteMap?.notes.get(noteId) : undefined
  return n ? printedChordAt(n.measureNum, n.beat) : null
}

/** Key in effect at a measure (from its key signature) — for suggesting degrees. */
export function keyAtMeasure(measure: number) {
  const ks = useWorkspaceStore.getState().noteMap?.measures.get(measure)?.keySignature
  return keyOfSignature(ks?.fifths ?? 0, ks?.mode ?? 'major')
}

export function setHarmony(patch: Partial<HarmonyAnnotation>) {
  const anchor = anchorNote()
  if (!sel() || !anchor) return
  const target = harmonyAtAnchor()?.noteIds?.[0] ?? anchor
  useAnnotationStore.getState().transact(draft => applyHarmony(draft, target, patch))
  reveal('harmony')
}

/** Apply a harmony patch to several chord positions at once (one undo step). */
export function setHarmonyAt(anchorIds: string[], patch: Partial<HarmonyAnnotation> | ((i: number) => Partial<HarmonyAnnotation> | null)) {
  if (anchorIds.length === 0) return
  useAnnotationStore.getState().transact(draft => {
    anchorIds.forEach((id, i) => {
      const p = typeof patch === 'function' ? patch(i) : patch
      if (p) applyHarmony(draft, id, p)
    })
  })
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

// ── Several chords in one selection ──────────────────────────────────────────

/** One chord position inside the selection (a beat where a chord is tagged, printed, or played). */
export interface ChordSlot {
  key: string
  anchorId: string            // note the harmony is (or will be) anchored to
  measure: number
  beat: number
  noteIds: string[]           // selected notes starting at this onset
  ann: HarmonyAnnotation | null
  printed: string | null      // chord symbol printed in the score here
  detected: string | null     // chord detected from the selected notes at this onset
}

/** Chord symbol shown for a slot: tagged → printed → detected. */
export const slotChord = (s: ChordSlot) => s.ann?.chordSymbol ?? s.printed ?? s.detected ?? null

/**
 * The chord positions in the selection, in time order. A position counts when it already
 * carries a chord tag, the score prints a chord symbol there, or ≥3 selected notes start
 * together (a played chord). Fewer than two → the selection is "one chord".
 */
export function selectionChordSlots(): ChordSlot[] {
  const s = noteSel()
  const nm = useWorkspaceStore.getState().noteMap
  if (!s || !nm) return []
  const groups = new Map<string, string[]>()
  for (const id of s.noteIds) {
    const n = nm.notes.get(id)
    if (!n || n.grace) continue
    const k = `${n.measureNum}|${Math.round(n.beat * 100)}`
    const arr = groups.get(k)
    if (arr) arr.push(id); else groups.set(k, [id])
  }
  const byOnset = new Map<string, HarmonyAnnotation>()
  for (const a of Object.values(anns())) {
    if (a.layer !== 'harmony' || !a.noteIds?.[0]) continue
    const k = onsetOf(a.noteIds[0])
    if (!k) continue
    const prev = byOnset.get(k)
    // hand-made beats script/printed; an anchor inside the selection beats one outside
    const rank = (x: HarmonyAnnotation) => (x.xmlChord ? 1 : 0) + (groups.get(k)?.includes(x.noteIds![0]) ? 0 : 2)
    if (!prev || rank(a as HarmonyAnnotation) < rank(prev)) byOnset.set(k, a as HarmonyAnnotation)
  }
  const slots: ChordSlot[] = []
  for (const [k, ids] of groups) {
    const n = nm.notes.get(ids[0])!
    const ann = byOnset.get(k) ?? null
    const printed = printedChordAt(n.measureNum, n.beat)
    const detected = ids.length >= 2 ? detectChord(ids, nm) : null
    if (!ann && !printed && !(ids.length >= 3 && detected)) continue
    slots.push({ key: k, anchorId: ann?.noteIds?.[0] ?? ids[0], measure: n.measureNum, beat: n.beat, noteIds: ids, ann, printed, detected })
  }
  return slots.sort((a, b) => a.measure - b.measure || a.beat - b.beat)
}

/** Add the detected chord symbol to every slot that has no chord yet. Returns how many were added. */
export function addDetectedChords(slots: ChordSlot[]): number {
  const todo = slots.filter(s => !s.ann?.chordSymbol && !s.printed && s.detected)
  if (todo.length === 0) return 0
  setHarmonyAt(todo.map(s => s.anchorId), i => ({ chordSymbol: todo[i].detected! }))
  const ids = todo
  useUiStore.getState().toast(tr(`נוספו ${ids.length} אקורדים`, `Added ${ids.length} chords`), 'success')
  return ids.length
}

/** Chord annotations whose symbol would change under `simplifyChordSymbol` (B#→C, Fb→E, D##→E…). */
export function chordsToSimplify(): HarmonyAnnotation[] {
  return Object.values(anns()).filter((a): a is HarmonyAnnotation =>
    a.layer === 'harmony' && !!a.chordSymbol && !a.xmlChord && simplifyChordSymbol(a.chordSymbol) !== a.chordSymbol)
}

/** Rewrite every notated-spelling chord (B#, E#, Cb, Fb, double accidentals) with its plain enharmonic name. One undo step. */
export function simplifyChordSpellings(): number {
  const targets = chordsToSimplify()
  if (targets.length === 0) return 0
  useAnnotationStore.getState().transact(draft => {
    for (const a of targets) {
      const cur = draft[a.id] as HarmonyAnnotation | undefined
      if (cur?.chordSymbol) draft[a.id] = { ...cur, chordSymbol: simplifyChordSymbol(cur.chordSymbol) }
    }
  })
  return targets.length
}

/** Written notes sounding at a chord's anchor (all staves) — what the chord is "spelled" from. */
function writtenNotesAt(a: HarmonyAnnotation) {
  const nm = useWorkspaceStore.getState().noteMap
  const anchor = a.noteIds?.[0] ? nm?.notes.get(a.noteIds[0]) : undefined
  const measure = anchor && nm?.measures.get(anchor.measureNum)
  if (!anchor || !measure) return []
  const at = anchor.beat + 0.01
  return spelledFromStepAlter(measure.notes.filter(n => !n.grace && n.beat <= at && (n.beat + n.duration > at || Math.abs(n.beat - anchor.beat) < 0.01)))
}

/** Chord annotations whose root/bass is not spelled as the notes under them are written. */
export function chordsToRespell(): Array<{ ann: HarmonyAnnotation; next: string }> {
  const out: Array<{ ann: HarmonyAnnotation; next: string }> = []
  for (const a of Object.values(anns())) {
    if (a.layer !== 'harmony' || !a.chordSymbol || a.xmlChord) continue
    const next = respellChordSymbol(a.chordSymbol, writtenNotesAt(a as HarmonyAnnotation))
    if (next !== a.chordSymbol) out.push({ ann: a as HarmonyAnnotation, next })
  }
  return out
}

/** Respell every chord root/bass as the notes are written (C → B# over B#–D##–F##). One undo step. */
export function respellChordsToNotation(): number {
  const targets = chordsToRespell()
  if (targets.length === 0) return 0
  useAnnotationStore.getState().transact(draft => {
    for (const { ann, next } of targets) {
      const cur = draft[ann.id] as HarmonyAnnotation | undefined
      if (cur) draft[ann.id] = { ...cur, chordSymbol: next }
    }
  })
  return targets.length
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
