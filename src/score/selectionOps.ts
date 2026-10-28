/**
 * Selection operations (Word-like): click, shift-extend, arrows, systems.
 * All functions read the current stores directly so they can be called from
 * pointer handlers and keyboard shortcuts alike.
 */
import { useSelectionStore, type NoteSelection } from '../store/selectionStore'
import { useWorkspaceStore } from '../store/workspaceStore'

function ctx() {
  const { geometry, noteMap } = useWorkspaceStore.getState()
  return { g: geometry, nm: noteMap }
}

function orderIndex(): Map<string, number> {
  const { g } = ctx()
  const cache = (orderIndex as any)._c as { g: unknown; m: Map<string, number> } | undefined
  if (cache && cache.g === g) return cache.m
  const m = new Map<string, number>()
  g?.order.forEach((id, i) => m.set(id, i))
  ;(orderIndex as any)._c = { g, m }
  return m
}

function measuresOf(ids: string[]): [number, number] {
  const { nm } = ctx()
  let a = Infinity, b = -Infinity
  for (const id of ids) {
    const n = nm?.notes.get(id)
    if (!n) continue
    a = Math.min(a, n.measureNum); b = Math.max(b, n.measureNum)
  }
  return a === Infinity ? [1, 1] : [a, b]
}

export function sortIds(ids: string[]): string[] {
  const idx = orderIndex()
  return [...new Set(ids)].sort((a, b) => (idx.get(a) ?? 1e9) - (idx.get(b) ?? 1e9))
}

export function selectNotes(ids: string[], extra: Partial<NoteSelection> = {}) {
  if (ids.length === 0) { useSelectionStore.getState().clear(); return }
  const noteIds = sortIds(ids)
  const [ms, me] = measuresOf(noteIds)
  useSelectionStore.getState().setSelection({
    kind: 'notes', noteIds, measureStart: ms, measureEnd: me,
    anchorId: noteIds[0], focusId: noteIds[noteIds.length - 1], ...extra,
  })
}

export function notesInMeasures(start: number, end: number): string[] {
  const { g, nm } = ctx()
  if (!g || !nm) return []
  return g.order.filter(id => {
    const m = nm.notes.get(id)?.measureNum ?? 0
    return m >= start && m <= end
  })
}

export function selectMeasures(anchor: number, focus: number) {
  const start = Math.min(anchor, focus), end = Math.max(anchor, focus)
  useSelectionStore.getState().setSelection({
    kind: 'notes', noteIds: notesInMeasures(start, end), measureStart: start, measureEnd: end,
    wholeMeasures: true, anchorMeasure: anchor, focusMeasure: focus,
  })
}

/** Notes between two notes in score order; restricted to one staff when both share it. */
function rangeBetween(a: string, b: string): string[] {
  const { g, nm } = ctx()
  if (!g || !nm) return [a, b]
  const idx = orderIndex()
  const [i0, i1] = [idx.get(a) ?? 0, idx.get(b) ?? 0].sort((x, y) => x - y)
  const sa = nm.notes.get(a)?.globalStaff, sb = nm.notes.get(b)?.globalStaff
  const slice = g.order.slice(i0, i1 + 1)
  return sa === sb ? slice.filter(id => nm.notes.get(id)?.globalStaff === sa) : slice
}

export function clickNote(id: string, mods: { shift?: boolean; ctrl?: boolean }) {
  const sel = useSelectionStore.getState().selection
  if (mods.ctrl && sel?.kind === 'notes') {
    const has = sel.noteIds.includes(id)
    const ids = has ? sel.noteIds.filter(x => x !== id) : [...sel.noteIds, id]
    selectNotes(ids, { anchorId: sel.anchorId ?? id, focusId: id })
    return
  }
  if (mods.shift && sel?.kind === 'notes') {
    if (sel.wholeMeasures) {
      const m = ctx().nm?.notes.get(id)?.measureNum ?? 1
      selectMeasures(sel.anchorMeasure ?? sel.measureStart, m)
      return
    }
    const anchor = sel.anchorId ?? sel.noteIds[0]
    if (anchor) { selectNotes(rangeBetween(anchor, id), { anchorId: anchor, focusId: id }); return }
  }
  selectNotes([id], { anchorId: id, focusId: id })
}

export function clickMeasure(num: number, mods: { shift?: boolean }) {
  const sel = useSelectionStore.getState().selection
  if (mods.shift && sel?.kind === 'notes') {
    selectMeasures(sel.wholeMeasures ? (sel.anchorMeasure ?? sel.measureStart) : sel.measureStart, num)
    return
  }
  selectMeasures(num, num)
}

export function selectSystemOf(measure: number) {
  const { g } = ctx()
  const sys = g?.systems[g.measures[measure - 1]?.system ?? -1]
  if (sys) selectMeasures(sys.first, sys.last)
}

export function selectAll() {
  const { g } = ctx()
  if (g && g.measures.length) selectMeasures(1, g.measures.length)
}

/** ←/→ : move to the previous/next note on the same staff; with extend, Shift-style. */
export function moveFocus(dir: 1 | -1, extend: boolean) {
  const { g, nm } = ctx()
  const sel = useSelectionStore.getState().selection
  if (!g || !nm || g.order.length === 0) return
  if (!sel || sel.kind !== 'notes') { selectNotes([g.order[0]]); return }

  if (sel.wholeMeasures && extend) {
    const anchor = sel.anchorMeasure ?? sel.measureStart
    const focus = (sel.focusMeasure ?? sel.measureEnd) + dir
    if (focus >= 1 && focus <= g.measures.length) selectMeasures(anchor, focus)
    return
  }
  if (sel.wholeMeasures && !extend) {
    const m = dir > 0 ? Math.min(sel.measureEnd + 1, g.measures.length) : Math.max(sel.measureStart - 1, 1)
    selectMeasures(m, m)
    return
  }

  const focus = sel.focusId ?? sel.noteIds[sel.noteIds.length - 1]
  const staff = nm.notes.get(focus)?.globalStaff
  const staffOrder = g.order.filter(id => nm.notes.get(id)?.globalStaff === staff)
  const i = staffOrder.indexOf(focus)
  let next = staffOrder[i + dir]
  // skip notes of the same chord (same beat) when stepping
  const beat = (id: string) => { const n = nm.notes.get(id)!; return n.measureNum * 1000 + n.beat }
  while (next && beat(next) === beat(focus) && staffOrder[staffOrder.indexOf(next) + dir]) next = staffOrder[staffOrder.indexOf(next) + dir]
  if (!next) return
  if (extend) {
    const anchor = sel.anchorId ?? sel.noteIds[0]
    selectNotes(rangeBetween(anchor, next), { anchorId: anchor, focusId: next })
  } else {
    selectNotes([next])
  }
  useSelectionStore.getState().requestScroll(nm.notes.get(next)!.measureNum, next)
}

/** ↑/↓ without shift: next note in the same chord / staff above or below. */
export function moveVertical(dir: 1 | -1) {
  const { g, nm } = ctx()
  const sel = useSelectionStore.getState().selection
  if (!g || !nm || !sel || sel.kind !== 'notes' || sel.noteIds.length === 0) return
  const focus = sel.focusId ?? sel.noteIds[0]
  const f = g.notes.get(focus)
  if (!f) return
  // candidates in the same system, roughly the same x, above (dir=-1) or below (dir=1)
  let best: string | null = null, bestScore = Infinity
  for (const n of g.notes.values()) {
    if (n.system !== f.system || n.id === focus) continue
    const dy = (n.cy - f.cy) * dir
    if (dy <= 1) continue
    const score = Math.abs(n.cx - f.cx) * 3 + dy
    if (Math.abs(n.cx - f.cx) < 40 && score < bestScore) { bestScore = score; best = n.id }
  }
  if (best) selectNotes([best])
}

/** Shift+↑/↓ : extend the selection to the end/start of the next/previous system. */
export function extendBySystem(dir: 1 | -1) {
  const { g } = ctx()
  const sel = useSelectionStore.getState().selection
  if (!g || !sel || sel.kind !== 'notes') return
  const anchor = sel.wholeMeasures ? (sel.anchorMeasure ?? sel.measureStart) : (dir > 0 ? sel.measureStart : sel.measureEnd)
  const focus = sel.wholeMeasures ? (sel.focusMeasure ?? sel.measureEnd) : (dir > 0 ? sel.measureEnd : sel.measureStart)
  const sys = g.systems[g.measures[focus - 1]?.system ?? -1]
  if (!sys) return
  const target = g.systems[sys.index + dir]
  const nextFocus = target ? (dir > 0 ? target.last : target.first) : (dir > 0 ? sys.last : sys.first)
  selectMeasures(anchor, nextFocus)
  useSelectionStore.getState().requestScroll(nextFocus)
}
