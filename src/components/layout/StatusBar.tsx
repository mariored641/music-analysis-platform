import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { useSelectionStore } from '../../store/selectionStore'
import { useScoreStore } from '../../store/scoreStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { detectChord } from '../../services/chordDetector'
import type { HarmonyAnnotation } from '../../types/annotation'
import './StatusBar.css'

export function StatusBar() {
  const { t } = useTranslation()
  const selection = useSelectionStore(s => s.selection)
  const metadata = useScoreStore(s => s.metadata)
  const noteMap = useScoreStore(s => s.noteMap)
  const annotations = useAnnotationStore(s => s.annotations)
  const addAnnotation = useAnnotationStore(s => s.addAnnotation)
  const { currentMeasure, isPlaying } = usePlaybackStore()

  const annotationList = Object.values(annotations)
  const totalTags = annotationList.length
  const openQuestions = annotationList.filter(a => (a as any).isQuestion).length

  // Note display names from noteMap (stable, renderer-agnostic)
  const noteNames = useMemo(() => {
    if (!selection?.noteIds?.length || !noteMap) return []
    return selection.noteIds
      .map(id => noteMap.notes.get(id)?.pitch ?? null)
      .filter((p): p is string => p !== null)
  }, [selection?.noteIds, noteMap])

  // Chord detection — only when 2+ distinct pitch classes selected
  const detectedChord = useMemo(() => {
    if (!selection?.noteIds || selection.noteIds.length < 2 || !noteMap) return null
    return detectChord(selection.noteIds, noteMap)
  }, [selection?.noteIds, noteMap])

  const handleAddChord = () => {
    if (!detectedChord || !selection || !noteMap) return

    // Pick the first note by measure + beat order
    const firstNote = selection.noteIds
      .map(id => ({ id, note: noteMap.notes.get(id) }))
      .filter(x => x.note != null)
      .sort((a, b) => {
        const n1 = a.note!, n2 = b.note!
        return n1.measureNum !== n2.measureNum
          ? n1.measureNum - n2.measureNum
          : n1.beat - n2.beat
      })[0]

    addAnnotation({
      id: uuid(),
      layer: 'harmony',
      measureStart: selection.measureStart,
      noteIds: firstNote ? [firstNote.id] : [],
      chordSymbol: detectedChord,
      createdAt: Date.now(),
    } as HarmonyAnnotation)
  }

  // Build the left-side selection description
  const hasNotes = (selection?.type === 'note' || selection?.type === 'notes') && noteNames.length > 0

  let selDesc: string
  if (isPlaying) {
    selDesc = `▶ m.${currentMeasure}`
  } else if (!selection) {
    selDesc = metadata ? `${t('status.measure')} — / ${metadata.totalMeasures}` : '—'
  } else if (hasNotes) {
    const shown = noteNames.slice(0, 5)
    const extra = noteNames.length > 5 ? ` +${noteNames.length - 5}` : ''
    selDesc = `${shown.join(' ')}${extra}`
  } else {
    selDesc = selection.measureStart === selection.measureEnd
      ? `${t('status.measure')} ${selection.measureStart}`
      : `Measures ${selection.measureStart}–${selection.measureEnd} (${(selection.measureEnd ?? selection.measureStart) - selection.measureStart + 1})`
  }

  const measurePos = !isPlaying && selection
    ? selection.measureStart === selection.measureEnd
      ? `m.${selection.measureStart}`
      : `m.${selection.measureStart}–${selection.measureEnd}`
    : null

  return (
    <div className="status-bar">
      <span className="status-item">{selDesc}</span>

      {detectedChord && (
        <>
          <span className="status-separator">→</span>
          <button
            className="status-chord-btn"
            onClick={handleAddChord}
            title="Click to add as harmony annotation"
          >
            {detectedChord}
          </button>
        </>
      )}

      {/* Show measure position separately when notes are displayed */}
      {hasNotes && measurePos && !isPlaying && (
        <>
          <span className="status-separator">·</span>
          <span className="status-item">{measurePos}</span>
        </>
      )}

      <span className="status-separator">|</span>
      <span className="status-item">{t('status.total_tags')}: {totalTags}</span>
      <span className="status-separator">|</span>
      <span className={`status-item ${openQuestions > 0 ? 'status-warn' : ''}`}>
        {t('status.open_questions')}: {openQuestions}
      </span>
      {metadata && (
        <>
          <span className="status-separator">|</span>
          <span className="status-item">{t('status.key')}: {metadata.key}</span>
        </>
      )}
      <span className="status-spacer" />
      <span className="status-hint">
        H Harmony · M Motif · F Form · T Label · Q Question · Space Play
      </span>
    </div>
  )
}
