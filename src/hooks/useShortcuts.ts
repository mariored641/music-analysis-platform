import { useEffect } from 'react'
import { useAnnotationStore } from '../store/annotationStore'
import { useSelectionStore, type QuickSection } from '../store/selectionStore'
import { usePlaybackStore } from '../store/playbackStore'
import { useStylusStore } from '../store/stylusStore'
import { useUiStore } from '../store/uiStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { extendBySystem, moveFocus, moveVertical, selectAll, selectNotes } from '../score/selectionOps'
import { deleteAnnotation, setMelodyFunction } from '../services/tagActions'
import { savePiece } from '../services/pieceService'
import { MELODY_FUNCTIONS } from '../constants/layers'
import { tr } from '../i18n'

const SECTION_KEYS: Record<string, QuickSection> = {
  h: 'harmony', n: 'melody', m: 'motif', f: 'form', t: 'labels', q: 'questions', k: 'color',
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/** Move the selected harmony's anchor to the previous/next note (its "real" position). */
function nudgeAnchor(dir: 1 | -1): boolean {
  const { selectedAnnotationId } = useSelectionStore.getState()
  const a = selectedAnnotationId ? useAnnotationStore.getState().annotations[selectedAnnotationId] : null
  const { geometry, noteMap } = useWorkspaceStore.getState()
  if (!a || a.layer !== 'harmony' || !a.noteIds?.[0] || !geometry || !noteMap) return false
  const cur = noteMap.notes.get(a.noteIds[0])
  const order = geometry.order.filter(id => noteMap.notes.get(id)?.globalStaff === cur?.globalStaff)
  const next = order[order.indexOf(a.noteIds[0]) + dir]
  if (!next) return true
  const m = noteMap.notes.get(next)!.measureNum
  useAnnotationStore.getState().updateAnnotation(a.id, { noteIds: [next], measureStart: m, measureEnd: m, visualOffset: undefined })
  selectNotes([next])
  useSelectionStore.getState().selectAnnotation(a.id)
  return true
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(e.target)
      const ctrl = e.ctrlKey || e.metaKey
      const sel = useSelectionStore.getState()
      const pb = usePlaybackStore.getState()
      const stylus = useStylusStore.getState()

      if (e.key === 'Escape') {
        if (typing) { (e.target as HTMLElement).blur(); return }
        if (sel.quickSection || sel.quickAt) { sel.openQuick(null); return }
        if (stylus.mode !== 'select') { stylus.setMode('select'); return }
        if (useUiStore.getState().scriptsOpen) { useUiStore.getState().setScriptsOpen(false); return }
        sel.clear()
        return
      }
      if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); savePiece().then(() => useUiStore.getState().toast(tr('נשמר', 'Saved'), 'success')); return }
      if (typing) return

      if (ctrl) {
        const k = e.key.toLowerCase()
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) useAnnotationStore.getState().redo(); else useAnnotationStore.getState().undo(); return }
        if (k === 'y') { e.preventDefault(); useAnnotationStore.getState().redo(); return }
        if (k === 'a') { e.preventDefault(); selectAll(); return }
        if (k === '=' || k === '+') { e.preventDefault(); const z = useUiStore.getState().zoom || 1; useUiStore.getState().setZoom(z + 0.1); return }
        if (k === '-') { e.preventDefault(); const z = useUiStore.getState().zoom || 1; useUiStore.getState().setZoom(z - 0.1); return }
        if (k === '0') { e.preventDefault(); useUiStore.getState().setZoom(0); return }
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
          if (pb.isPlaying) pb.pause(); else if (pb.isPaused) pb.resume(); else pb.play()
          return
        case 'ArrowRight':
        case 'ArrowLeft': {
          e.preventDefault()
          const dir = e.key === 'ArrowRight' ? 1 : -1
          if (e.altKey) { nudgeAnchor(dir); return }
          moveFocus(dir, e.shiftKey)
          return
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault()
          const dir = e.key === 'ArrowDown' ? 1 : -1
          if (e.shiftKey) extendBySystem(dir); else moveVertical(dir)
          return
        }
        case 'Delete':
        case 'Backspace':
          if (sel.selectedAnnotationId) { e.preventDefault(); deleteAnnotation(sel.selectedAnnotationId) }
          return
        case 'Enter':
          if (sel.selection && !sel.quickSection) { e.preventDefault(); sel.openQuick('harmony') }
          return
      }

      const k = e.key.toLowerCase()
      if (sel.quickSection === 'melody' && /^[1-8]$/.test(e.key)) {
        e.preventDefault()
        setMelodyFunction(MELODY_FUNCTIONS[parseInt(e.key) - 1].value)
        return
      }
      if (SECTION_KEYS[k] && sel.selection && !e.altKey) {
        e.preventDefault()
        sel.openQuick(sel.quickSection === SECTION_KEYS[k] ? null : SECTION_KEYS[k])
        return
      }
      if (k === 'd') { stylus.setMode(stylus.mode === 'draw' ? 'select' : 'draw'); return }
      if (k === 'e') { stylus.setMode(stylus.mode === 'erase' ? 'select' : 'erase'); return }
      if (k === 'v') { stylus.setMode('select'); return }
      if (k === 'l' && sel.selection) { pb.setLoop(!pb.loop); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
