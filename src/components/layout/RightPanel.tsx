import { useTranslation } from 'react-i18next'
import { useSelectionStore } from '../../store/selectionStore'
import { useScoreStore } from '../../store/scoreStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { LAYER_MAP, NOTE_COLORS } from '../../constants/layers'
import './RightPanel.css'

export function RightPanel() {
  const { t } = useTranslation()
  const selection = useSelectionStore(s => s.selection)
  const noteMap = useScoreStore(s => s.noteMap)
  const annotations = useAnnotationStore(s => s.annotations)
  const { removeAnnotation } = useAnnotationStore()

  const annotationList = Object.values(annotations)
  const openQuestions = annotationList.filter(a => (a as any).isQuestion).length

  // Annotations touching the current selection range.
  // For noteColor annotations on a note selection, narrow to the exact selected note(s).
  const selNoteIdSet = new Set(selection?.noteIds ?? [])
  const selectionAnnotations = selection
    ? annotationList.filter(a => {
        const inRange =
          a.measureStart <= (selection.measureEnd ?? selection.measureStart) &&
          (a.measureEnd ?? a.measureStart) >= selection.measureStart
        if (!inRange) return false
        if (a.layer === 'noteColor' && selNoteIdSet.size > 0) {
          // noteIds on both sides are noteMap IDs — direct compare
          return (a as any).noteIds?.some((id: string) => selNoteIdSet.has(id)) ?? false
        }
        return true
      }).sort((a, b) => a.measureStart - b.measureStart)
    : []

  // Measure info from NoteMap
  const measureData = selection && noteMap
    ? noteMap.measures.get(selection.measureStart)
    : null

  return (
    <aside className="right-panel">
      {/* Selection header */}
      <section className="panel-section">
        <div className="panel-section-header">
          {selection
            ? (selection.measureEnd && selection.measureEnd !== selection.measureStart
                ? `m.${selection.measureStart}–${selection.measureEnd}`
                : `m.${selection.measureStart}`) +
              ` · ${t(`selection.${selection.type}`)}`
            : t('selection.none')
          }
        </div>

        {selection && measureData && (
          <div className="selection-detail">
            {measureData.keySignature && (
              <div className="detail-row">
                <span className="detail-label">Key</span>
                <span className="detail-value">{measureData.keySignature.fifths}♭/♯ {measureData.keySignature.mode}</span>
              </div>
            )}
            {measureData.timeSignature && (
              <div className="detail-row">
                <span className="detail-label">Time</span>
                <span className="detail-value">{measureData.timeSignature.beats}/{measureData.timeSignature.beatType}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Notes</span>
              <span className="detail-value">{measureData.notes.length}</span>
            </div>
            {selection.type === 'note' && (selection as any).notePitch && (
              <div className="detail-row">
                <span className="detail-label">Pitch</span>
                <span className="detail-value">{(selection as any).notePitch}</span>
              </div>
            )}
          </div>
        )}

        {!selection && (
          <p className="no-selection-hint">
            {t('app.noScore').includes('Open')
              ? 'Click a note or measure to select it'
              : 'לחץ על תו או תיבה לבחירה'}
          </p>
        )}
      </section>

      {/* Annotations for selection */}
      {selectionAnnotations.length > 0 && (
        <section className="panel-section">
          <div className="panel-section-header">Analysis ({selectionAnnotations.length})</div>
          <ul className="annotation-list">
            {selectionAnnotations.map(ann => {
              const layer = LAYER_MAP.get(ann.layer)
              return (
                <li key={ann.id} className="annotation-item">
                  <span
                    className="ann-layer-dot"
                    style={{
                      background: ann.layer === 'noteColor'
                        ? (NOTE_COLORS[(ann as any).colorType] ?? layer?.color)
                        : layer?.color
                    }}
                  />
                  <span
                    className="ann-text"
                    style={{
                      color: ann.layer === 'noteColor'
                        ? (NOTE_COLORS[(ann as any).colorType] ?? undefined)
                        : undefined
                    }}
                  >{getAnnotationSummary(ann)}</span>
                  <button
                    className="ann-delete"
                    onClick={() => removeAnnotation(ann.id)}
                    title="Remove"
                  >×</button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Stats */}
      <section className="panel-section stats-section">
        <div className="stat-row">
          <span className="stat-label">Tags</span>
          <span className="stat-value">{annotationList.length}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Open ?</span>
          <span className="stat-value" style={{ color: openQuestions > 0 ? '#f59e0b' : undefined }}>
            {openQuestions}
          </span>
        </div>
        {noteMap && (
          <div className="stat-row">
            <span className="stat-label">Measures</span>
            <span className="stat-value">{noteMap.metadata.totalMeasures}</span>
          </div>
        )}
      </section>
    </aside>
  )
}

const COLOR_TYPE_LABELS: Record<string, string> = {
  CHORD_TONE:    'Chord Tone',
  PASSING_TONE:  'Passing Tone',
  NEIGHBOR_TONE: 'Neighbor Tone',
}

function getAnnotationSummary(ann: any): string {
  switch (ann.layer) {
    case 'harmony':   return ann.cadenceType || ann.scaleDegree || ann.chordSymbol || 'Harmony'
    case 'melody':    return ann.noteFunction || ann.chromaticism || 'Melody'
    case 'form':      return ann.midLevel || ann.highLevel || ann.lowLevel || 'Form'
    case 'motif':     return `Motif ${ann.label}${ann.variantType && ann.variantType !== 'original' ? ` (${ann.variantType})` : ''}`
    case 'labels':    return (ann.isQuestion ? '? ' : '') + (ann.text || 'Label')
    case 'texture':   return ann.textureType || 'Texture'
    case 'noteColor': return COLOR_TYPE_LABELS[ann.colorType] ?? ann.colorType ?? 'Note Color'
    default:          return ann.layer
  }
}
