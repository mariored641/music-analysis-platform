import { useTranslation } from 'react-i18next'
import { useSelectionStore } from '../../store/selectionStore'
import { useScoreStore } from '../../store/scoreStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { usePlaybackStore } from '../../store/playbackStore'
import './StatusBar.css'

export function StatusBar() {
  const { t } = useTranslation()
  const selection = useSelectionStore(s => s.selection)
  const metadata = useScoreStore(s => s.metadata)
  const annotations = useAnnotationStore(s => s.annotations)
  const { currentMeasure, isPlaying } = usePlaybackStore()

  const annotationList = Object.values(annotations)
  const totalTags = annotationList.length
  const openQuestions = annotationList.filter(a => (a as any).isQuestion).length

  return (
    <div className="status-bar">
      <span className="status-item">
        {isPlaying
          ? `▶ m.${currentMeasure}`
          : selection
            ? selection.measureStart === selection.measureEnd
              ? `${t('status.measure')} ${selection.measureStart}`
              : `Measures ${selection.measureStart}–${selection.measureEnd} (${selection.measureEnd - selection.measureStart + 1} measures)`
            : metadata
              ? `${t('status.measure')} — / ${metadata.totalMeasures}`
              : '—'
        }
      </span>
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
