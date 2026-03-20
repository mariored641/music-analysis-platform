import { useTranslation } from 'react-i18next'
import { useScoreStore } from '../../store/scoreStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { exportToAnalysisJson, downloadJson } from '../../services/jsonExporter'
import i18n from '../../i18n/index'
import './TopBar.css'

export function TopBar() {
  const { t } = useTranslation()
  const { metadata, xmlString, fileName, isDirty, isSaving, lastSaved } = useScoreStore()
  const { isPlaying, setPlaying, tempo, setTempo } = usePlaybackStore()
  const annotations = useAnnotationStore(s => s.annotations)

  const toggleLang = () => {
    const next = i18n.language === 'he' ? 'en' : 'he'
    i18n.changeLanguage(next)
    localStorage.setItem('map-lang', next)
    document.dir = next === 'he' ? 'rtl' : 'ltr'
  }

  const handleExport = () => {
    if (!xmlString || !metadata || !fileName) return
    const json = exportToAnalysisJson(xmlString, metadata, annotations)
    downloadJson(json, fileName)
  }

  const saveStatus = isSaving
    ? t('app.saving')
    : isDirty
      ? t('app.unsaved')
      : lastSaved
        ? t('app.saved')
        : ''

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-logo">MAP</span>
        {metadata && (
          <div className="topbar-meta">
            <span className="topbar-title">{metadata.title}</span>
            {metadata.composer && <span className="topbar-composer">— {metadata.composer}</span>}
            <span className="topbar-badge">{metadata.key}</span>
            <span className="topbar-badge">{metadata.timeSignature}</span>
            {metadata.tempo && <span className="topbar-badge">{metadata.tempo}</span>}
          </div>
        )}
      </div>
      <div className="topbar-right">
        {saveStatus && (
          <span className={`save-status ${isDirty ? 'unsaved' : 'saved'}`}>{saveStatus}</span>
        )}
        {metadata && (
          <>
            <input
              className="tempo-input"
              type="number"
              min={40} max={300}
              value={tempo}
              onChange={e => setTempo(Number(e.target.value))}
              title="BPM"
            />
            <button
              className={`btn-play ${isPlaying ? 'active' : ''}`}
              onClick={() => setPlaying(!isPlaying)}
              title="Space"
            >
              {isPlaying ? '⏸' : '▶'} {isPlaying ? t('app.pause') : t('app.play')}
            </button>
            <button className="btn-export" onClick={handleExport} title={t('app.export')}>
              ⬇ JSON
            </button>
          </>
        )}
        <button className="btn-lang" onClick={toggleLang} title="Switch language">
          {i18n.language === 'he' ? 'EN' : 'עב'}
        </button>
      </div>
    </header>
  )
}
