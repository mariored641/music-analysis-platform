import { useEffect } from 'react'
import { useAnnotationStore } from '../store/annotationStore'
import { useSelectionStore } from '../store/selectionStore'
import { usePlaybackStore } from '../store/playbackStore'

export function useKeyboard() {
  const { undo, redo } = useAnnotationStore()
  const { clearSelection, hideContextMenu, showContextMenu, selection } = useSelectionStore()
  const { isPlaying, setPlaying } = usePlaybackStore()

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
  }, [undo, redo, clearSelection, hideContextMenu, showContextMenu, selection, isPlaying, setPlaying])
}
