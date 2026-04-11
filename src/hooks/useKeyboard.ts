import { useEffect, useRef } from 'react'
import { useAnnotationStore } from '../store/annotationStore'
import { useSelectionStore } from '../store/selectionStore'
import { usePlaybackStore } from '../store/playbackStore'
import { useScoreStore } from '../store/scoreStore'
import type { Selection } from '../store/selectionStore'

// Renderer-agnostic selectors — OSMD uses .note (stamped), native uses g.note
// Combined selectors match whichever renderer is active
const SEL_NOTE_WITH_ID = '[data-notemap-id]'
const SEL_MEASURE_ANY = 'g.measure, g.vf-measure'

// Get noteMap IDs in DOM score order (reads data-notemap-id stamped by buildVrvNoteIdMap / buildOSMDElementMap)
function getDomOrderedNoteIds(): string[] {
  return Array.from(document.querySelectorAll(SEL_NOTE_WITH_ID))
    .map(el => (el as HTMLElement).dataset.notemapId!)
    .filter(Boolean)
}

// Get measure number (1-based) for a noteMap ID via data attribute
function getMeasureNumForNote(noteMapId: string): number {
  const noteEl = document.querySelector(`[data-notemap-id="${CSS.escape(noteMapId)}"]`)
  if (!noteEl) return 1
  const measureEl = noteEl.closest(SEL_MEASURE_ANY)
  if (!measureEl) return 1
  const allMeasures = Array.from(document.querySelectorAll(SEL_MEASURE_ANY))
  const idx = allMeasures.indexOf(measureEl)
  return idx >= 0 ? idx + 1 : 1
}

// Find the g.system element that contains a given measure number (1-based)
function getSystemForMeasure(measureNum: number): Element | null {
  const allMeasures = Array.from(document.querySelectorAll(SEL_MEASURE_ANY))
  const measureEl = allMeasures[measureNum - 1]
  if (!measureEl) return null
  return measureEl.closest('g.system')
}

// Get the first and last measure numbers (1-based) within a g.system element
function getSystemMeasureRange(systemEl: Element): { first: number; last: number } {
  const allMeasures = Array.from(document.querySelectorAll(SEL_MEASURE_ANY))
  const sysMeasures = Array.from(systemEl.querySelectorAll(SEL_MEASURE_ANY))
  const indices = sysMeasures.map(m => allMeasures.indexOf(m)).filter(i => i >= 0)
  if (indices.length === 0) return { first: 1, last: 1 }
  return { first: Math.min(...indices) + 1, last: Math.max(...indices) + 1 }
}

export function useKeyboard() {
  const { undo, redo } = useAnnotationStore()
  const { clearSelection, hideContextMenu, showContextMenu, selection, setSelection } = useSelectionStore()
  const { isPlaying, isPaused, setPlaying, pausePlayback, resumePlayback } = usePlaybackStore()
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
          if (isPlaying) pausePlayback()
          else if (isPaused) resumePlayback()
          else setPlaying(true)
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

        // ── Shift+→ : extend right OR shrink from left ──────────────────────
        case 'ArrowRight':
          if (e.shiftKey && selectionRef.current) {
            e.preventDefault()
            const sel = selectionRef.current
            if (sel.type === 'note' || sel.type === 'notes') {
              const ordered = getDomOrderedNoteIds()
              const anchor = sel.anchorNoteId ?? sel.noteIds[0]
              const firstId = sel.noteIds[0]
              const lastId  = sel.noteIds[sel.noteIds.length - 1]
              const firstIdx = ordered.indexOf(firstId)
              const lastIdx  = ordered.indexOf(lastId)

              // anchor at start → cursor at end → extend right
              if (anchor === firstId || firstIdx < 0) {
                if (lastIdx >= 0 && lastIdx < ordered.length - 1) {
                  const nextId = ordered[lastIdx + 1]
                  const nextMeasure = getMeasureNumForNote(nextId)
                  const updated: Selection = {
                    ...sel,
                    type: 'notes',
                    noteIds: [...sel.noteIds, nextId],
                    measureEnd: Math.max(sel.measureEnd, nextMeasure),
                    anchorNoteId: anchor,
                  }
                  selectionRef.current = updated
                  setSelection(updated)
                }
              } else {
                // anchor at end → cursor at start → shrink from left
                if (sel.noteIds.length > 1) {
                  const newIds = sel.noteIds.slice(1)
                  const updated: Selection = {
                    ...sel,
                    type: newIds.length === 1 ? 'note' : 'notes',
                    noteIds: newIds,
                    measureStart: getMeasureNumForNote(newIds[0]),
                    anchorNoteId: anchor,
                  }
                  selectionRef.current = updated
                  setSelection(updated)
                }
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

        // ── Shift+← : extend left OR shrink from right ──────────────────────
        case 'ArrowLeft':
          if (e.shiftKey && selectionRef.current) {
            e.preventDefault()
            const sel = selectionRef.current
            if (sel.type === 'note' || sel.type === 'notes') {
              const ordered = getDomOrderedNoteIds()
              const anchor = sel.anchorNoteId ?? sel.noteIds[0]
              const firstId = sel.noteIds[0]
              const lastId  = sel.noteIds[sel.noteIds.length - 1]
              const firstIdx = ordered.indexOf(firstId)
              const lastIdx  = ordered.indexOf(lastId)

              // anchor at end → cursor at start → extend left
              if (anchor === lastId || lastIdx < 0) {
                if (firstIdx > 0) {
                  const prevId = ordered[firstIdx - 1]
                  const prevMeasure = getMeasureNumForNote(prevId)
                  const updated: Selection = {
                    ...sel,
                    type: 'notes',
                    noteIds: [prevId, ...sel.noteIds],
                    measureStart: Math.min(sel.measureStart, prevMeasure),
                    anchorNoteId: anchor,
                  }
                  selectionRef.current = updated
                  setSelection(updated)
                }
              } else {
                // anchor at start → cursor at end → shrink from right
                if (sel.noteIds.length > 1) {
                  const newIds = sel.noteIds.slice(0, -1)
                  const updated: Selection = {
                    ...sel,
                    type: newIds.length === 1 ? 'note' : 'notes',
                    noteIds: newIds,
                    measureEnd: getMeasureNumForNote(newIds[newIds.length - 1]),
                    anchorNoteId: anchor,
                  }
                  selectionRef.current = updated
                  setSelection(updated)
                }
              }
            } else if (sel.measureStart > 1) {
              const updated = { ...sel, measureStart: sel.measureStart - 1 }
              selectionRef.current = updated
              setSelection(updated)
            }
          }
          break

        // ── Shift+↑ : extend selection to system row above ──────────────────
        case 'ArrowUp':
          if (e.shiftKey && selectionRef.current) {
            e.preventDefault()
            const sel = selectionRef.current
            const currentSystem = getSystemForMeasure(sel.measureStart)
            if (!currentSystem) break
            const allSystems = Array.from(document.querySelectorAll('g.system'))
            const currentSysIdx = allSystems.indexOf(currentSystem)
            if (currentSysIdx > 0) {
              const prevSystem = allSystems[currentSysIdx - 1]
              const { first } = getSystemMeasureRange(prevSystem)
              const updated: Selection = {
                ...sel,
                type: 'measures',
                measureStart: first,
                noteIds: [],
                anchorMeasure: sel.measureEnd,
              }
              selectionRef.current = updated
              setSelection(updated)
            }
          }
          break

        // ── Shift+↓ : extend selection to system row below ──────────────────
        case 'ArrowDown':
          if (e.shiftKey && selectionRef.current) {
            e.preventDefault()
            const sel = selectionRef.current
            const currentSystem = getSystemForMeasure(sel.measureEnd)
            if (!currentSystem) break
            const allSystems = Array.from(document.querySelectorAll('g.system'))
            const currentSysIdx = allSystems.indexOf(currentSystem)
            if (currentSysIdx < allSystems.length - 1) {
              const nextSystem = allSystems[currentSysIdx + 1]
              const { last } = getSystemMeasureRange(nextSystem)
              const updated: Selection = {
                ...sel,
                type: 'measures',
                measureEnd: last,
                noteIds: [],
                anchorMeasure: sel.measureStart,
              }
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
  }, [undo, redo, clearSelection, hideContextMenu, showContextMenu, selection, setSelection, isPlaying, isPaused, setPlaying, pausePlayback, resumePlayback, totalMeasures])
}
