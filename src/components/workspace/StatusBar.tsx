import { useMemo } from 'react'
import { useSelectionStore } from '../../store/selectionStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { useUiStore } from '../../store/uiStore'
import { useStylusStore } from '../../store/stylusStore'
import { detectChord } from '../../services/chordDetector'
import { addDetectedChord } from '../../services/tagActions'
import { rangeLabel } from '../../services/annotationQueries'
import { describeElement } from '../../score/registry'
import { prettyPitch } from './Inspector'
import { prettyChord } from '../../score/AnnotationLayer'
import { Icon } from '../common/Icon'
import { useHe, useTr } from '../../i18n'

export function StatusBar() {
  const he = useHe()
  const tr = useTr()
  const selection = useSelectionStore(s => s.selection)
  const noteMap = useWorkspaceStore(s => s.noteMap)
  const playMeasure = usePlaybackStore(s => s.currentMeasure)
  const isPlaying = usePlaybackStore(s => s.isPlaying)
  const mode = useStylusStore(s => s.mode)
  const zoom = useUiStore(s => s.zoom)
  const setZoom = useUiStore(s => s.setZoom)

  const info = useMemo(() => {
    if (!selection || selection.kind !== 'notes' || !noteMap) return null
    const notes = selection.noteIds.map(id => noteMap.notes.get(id)).filter(Boolean)
    return { names: notes.map(n => prettyPitch(n!.pitch)), chord: notes.length > 1 ? detectChord(selection.noteIds, noteMap) : null }
  }, [selection, noteMap])

  const hint = mode === 'draw' ? tr('מצב ציור — Esc ליציאה', 'Drawing — Esc to exit')
    : mode === 'erase' ? tr('מחק — לחץ על קו כדי למחוק', 'Eraser — click a stroke to delete')
    : selection ? tr('Shift+חצים להרחבה · H אקורד · N תפקיד · M מוטיב · F מבנה · T תווית · Q שאלה · Del מחיקה', 'Shift+arrows extend · H chord · N role · M motif · F form · T label · Q question · Del delete')
    : tr('לחץ על תו או גרור לבחירה · רווח לנגינה · D ציור', 'Click a note or drag to select · Space to play · D to draw')

  return (
    <footer className="statusbar">
      <div className="sb-sel">
        {isPlaying && playMeasure ? <span className="sb-play">▶ {rangeLabel(playMeasure, playMeasure, he)}</span> : null}
        {selection?.kind === 'element' && <span>{tr('אלמנט', 'Element')}: <b>{describeElement(selection.element.index)}</b></span>}
        {info && (
          <>
            <span className="sb-pos">{rangeLabel(selection!.measureStart, selection!.measureEnd, he)}</span>
            <span className="sb-names" dir="ltr">{info.names.slice(0, 16).join(' ')}{info.names.length > 16 ? ` +${info.names.length - 16}` : ''}</span>
            {info.chord && (
              <button className="sb-chord" onClick={() => addDetectedChord()} title={tr('לחץ כדי להוסיף את האקורד מעל התו הראשון', 'Click to add this chord above the first note')}>
                {prettyChord(info.chord)} <Icon name="plus" size={12} />
              </button>
            )}
          </>
        )}
      </div>
      <div className="sb-hint">{hint}</div>
      <button className="icon-btn sm" onClick={() => useUiStore.getState().setHelpOpen(true)} title={tr('קיצורי מקלדת (?)', 'Keyboard shortcuts (?)')}><Icon name="keyboard" size={16} /></button>
      <div className="sb-zoom">
        <button className="icon-btn sm" onClick={() => setZoom((zoom || 1) - 0.1)} title={tr('הקטן', 'Zoom out')}><Icon name="zoomOut" size={15} /></button>
        <button className="sb-zoom-val" onClick={() => setZoom(0)} title={tr('התאם לרוחב', 'Fit width')}>{zoom === 0 ? tr('רוחב', 'Fit') : `${Math.round(zoom * 100)}%`}</button>
        <button className="icon-btn sm" onClick={() => setZoom((zoom || 1) + 0.1)} title={tr('הגדל', 'Zoom in')}><Icon name="zoomIn" size={15} /></button>
      </div>
    </footer>
  )
}
