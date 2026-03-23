import { useEffect, useRef } from 'react'
import { useAnnotationStore } from '../store/annotationStore'
import { useSelectionStore } from '../store/selectionStore'
import { usePlaybackStore } from '../store/playbackStore'
import { useScoreStore } from '../store/scoreStore'
import type { Selection } from '../store/selectionStore'

// Get Verovio note IDs in score order directly from the DOM
function getDomOrderedNoteIds(): string[] {
  return Array.from(document.querySelectorAll('g.note'))
    .map(el => el.id)
    .filter(Boolean)
}

// Get the measure number (1-based) of a Verovio note element by its ID
function getMeasureNumForNote(noteId: string): number {
  const noteEl = document.getElementById(noteId)
  if (!noteEl) return 1
  const measureEl = noteEl.closest('g.measure')
  if (!measureEl) return 1
  const allMeasures = Array.from(document.querySelectorAll('g.measure'))
  const idx = allMeasures.indexOf(measureEl)
  return idx >= 0 ? idx + 1 : 1
}

export function useKeyboard() {
  const { undo, redo } = useAnnotationStore()
  const { clearSelection, hideContextMenu, showContextMenu, selection, setSelection } = useSelectionStore()
  const { isPlaying, setPlaying } = usePlaybackStore()
  const totalMeasures = useScoreStore(s => s.noteMap?.metadata.totalMeasures ?? 999)

  // Keep a ref to the latest selection so arrow key handlers never see stale closures
  const selectionRef = useRef<Selection | null>(selection)
  useEffect(() => { selectionRef.current = selection }, [selection])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in input fields
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
        if (e.key === 'y') { e.preventDefault(); redo(); return }
      }

      switch (e.key) {
        case 'Escape':
          hideContextMenu()
          clearSelection()
          break
        case ' ':
          e.preventDefault()
          e.stopPropagation()
          // Blur any focused button so Space doesn't also activate it
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          setPlaying(!isPlaying)
          break
        case 'h':
        case 'H':
          if (selection) showContextMenu(window.innerWidth / 2, window.innerHeight / 2, 'harmony')
          break
        case 'm':
        case 'M':
          if (selection) showContextMenu(window.innerWidth / 2, window.innerHeight / 2, 'motif')
          break
        case 'f':
        case 'F':
          if (selection) showContextMenu(window.innerWidth / 2, window.innerHeight / 2, 'form')
          break
        case 't':
        case 'T':
          if (selection) showContextMenu(window.innerWidth / 2, window.innerHeight / 2, 'label')
          break
        case 'q':
        case 'Q':
          if (selection) showContextMenu(window.innerWidth / 2, window.innerHeight / 2, 'question')
          break
        case 'ArrowRight':
          if (e.shiftKey && selectionRef.current) {
            e.preventDefault()
            const sel = selectionRef.current
            if (sel.type === 'note' || sel.type === 'notes') {
              const ordered = getDomOrderedNoteIds()
              const lastId = sel.noteIds[sel.noteIds.length - 1]
              const idx = ordered.indexOf(lastId)
              if (idx >= 0 && idx < ordered.length - 1) {
                const nextId = ordered[idx + 1]
                const nextMeasure = getMeasureNumForNote(nextId)
                const updated = {
                  ...sel,
                  type: 'notes' as const,
                  noteIds: [...sel.noteIds, nextId],
                  measureEnd: Math.max(sel.measureEnd, nextMeasure),
                }
                selectionRef.current = updated
                setSelection(updated)
              }
            } else {
              if (sel.measureEnd < totalMeasures) {
                const updated = { ...sel, measureEnd: sel.measureEnd + 1 }
                selectionRef.current = updated
                setSelection(updated)
              }
            }
          }
          break
        case 'ArrowLeft':
          if (e.shiftKey && selectionRef.current) {
            e.preventDefault()
            const sel = selectionRef.current
            if (sel.type === 'note' || sel.type === 'notes') {
              const ordered = getDomOrderedNoteIds()
              const firstId = sel.noteIds[0]
              const idx = ordered.indexOf(firstId)
              if (idx > 0) {
                const prevId = ordered[idx - 1]
                const prevMeasure = getMeasureNumForNote(prevId)
                const updated = {
                  ...sel,
                  type: 'notes' as const,
                  noteIds: [prevId, ...sel.noteIds],
                  measureStart: Math.min(sel.measureStart, prevMeasure),
                }
                selectionRef.current = updated
                setSelection(updated)
              }
            } else if (sel.measureStart > 1) {
              const updated = { ...sel, measureStart: sel.measureStart - 1 }
              selectionRef.current = updated
              setSelection(updated)
            }
          }
          break
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      // Prevent Space keyup from activating focused buttons
      if (e.key === ' ') e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [undo, redo, clearSelection, hideContextMenu, showContextMenu, selection, setSelection, isPlaying, setPlaying, totalMeasures])
}
