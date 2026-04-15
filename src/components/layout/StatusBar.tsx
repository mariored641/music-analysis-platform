import { useMemo, useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { useSelectionStore } from '../../store/selectionStore'
import { useScoreStore } from '../../store/scoreStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { detectAllChords } from '../../services/chordDetector'
import type { HarmonyAnnotation } from '../../types/annotation'
import './StatusBar.css'

const STEP_TO_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
function noteToMidi(step: string, octave: number, alter?: number): number {
  return (octave + 1) * 12 + (STEP_TO_SEMITONE[step] ?? 0) + Math.round(alter ?? 0)
}

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

  // Chord detection — all matching chords when 2+ distinct pitch classes selected
  const detectedChords = useMemo(() => {
    if (!selection?.noteIds || selection.noteIds.length < 2 || !noteMap) return []
    return detectAllChords(selection.noteIds, noteMap)
  }, [selection?.noteIds, noteMap])

  const [showChordDropdown, setShowChordDropdown] = useState(false)
  const chordDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showChordDropdown) return
    const handler = (e: MouseEvent) => {
      if (chordDropdownRef.current && !chordDropdownRef.current.contains(e.target as Node)) {
        setShowChordDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showChordDropdown])

  const handleAddChord = (chordName: string) => {
    if (!selection || !noteMap) return

    // Pick the first note by measure + beat, tiebreak by lowest pitch (bass)
    const firstNote = selection.noteIds
      .map(id => ({ id, note: noteMap.notes.get(id) }))
      .filter(x => x.note != null)
      .sort((a, b) => {
        const n1 = a.note!, n2 = b.note!
        if (n1.measureNum !== n2.measureNum) return n1.measureNum - n2.measureNum
        if (n1.beat !== n2.beat) return n1.beat - n2.beat
        return noteToMidi(n1.step, n1.octave, n1.alter) - noteToMidi(n2.step, n2.octave, n2.alter)
      })[0]

    addAnnotation({
      id: uuid(),
      layer: 'harmony',
      measureStart: firstNote?.note?.measureNum ?? selection.measureStart,
      noteIds: firstNote ? [firstNote.id] : [],
      chordSymbol: chordName,
      createdAt: Date.now(),
    } as HarmonyAnnotation)
    setShowChordDropdown(false)
  }

  // Build the left-side selection description
  const hasNotes = (selection?.type === 'note' || selection?.type === 'notes') && noteNames.length > 0

  const shown = hasNotes ? noteNames.slice(0, 5) : []
  const extraCount = hasNotes && noteNames.length > 5 ? noteNames.length - 5 : 0

  let selDesc: string
  if (isPlaying) {
    selDesc = `▶ m.${currentMeasure}`
  } else if (!selection) {
    selDesc = metadata ? `${t('status.measure')} — / ${metadata.totalMeasures}` : '—'
  } else if (hasNotes) {
    selDesc = shown.join(' ')
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

  const primaryChord = detectedChords[0] ?? null
  const altChords = detectedChords.slice(1)

  return (
    <div className="status-bar">
      <span className="status-item">{selDesc}</span>

      {/* Hover tooltip for overflow notes */}
      {extraCount > 0 && (
        <span className="status-notes-wrap">
          <span className="status-extra-badge">+{extraCount}</span>
          <span className="status-notes-popover">
            {noteNames.map((n, i) => <span key={i} className="status-note-entry">{n}</span>)}
          </span>
        </span>
      )}

      {primaryChord && (
        <>
          <span className="status-separator">→</span>
          <div className="status-chord-wrap" ref={chordDropdownRef}>
            <button
              className="status-chord-btn"
              onClick={() => handleAddChord(primaryChord)}
              title="Click to add as harmony annotation"
            >
              {primaryChord}
            </button>
            {altChords.length > 0 && (
              <>
                <button
                  className="status-chord-alt-toggle"
                  onClick={() => setShowChordDropdown(v => !v)}
                  title="Show alternative chords"
                >
                  ▾
                </button>
                {showChordDropdown && (
                  <div className="status-chord-dropdown">
                    {altChords.map(c => (
                      <button
                        key={c}
                        className="status-chord-dropdown-item"
                        onClick={() => handleAddChord(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
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
