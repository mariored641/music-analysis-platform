import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useScoreStore } from '../../store/scoreStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useLibraryStore } from '../../store/libraryStore'
import { exportToAnalysisJson, downloadJson } from '../../services/jsonExporter'
import { exportToPdf } from '../../services/pdfExporter'
import { pickSyncFolder, clearSyncFolder, getSyncFolderName, hasSyncFolder } from '../../services/syncService'
import { useResearchStore } from '../../store/researchStore'
import { useStylusStore } from '../../store/stylusStore'
import { ScriptPanel } from '../scripts/ScriptPanel'
import i18n from '../../i18n/index'
import './TopBar.css'

export function TopBar() {
  const { t } = useTranslation()
  const { metadata, xmlString, fileName, isDirty, isSaving, lastSaved } = useScoreStore()
  const { isPlaying, setPlaying, tempo, setTempo } = usePlaybackStore()
  const annotations = useAnnotationStore(s => s.annotations)
  const researchNotes = useResearchStore(s => s.notes)
  const palette = useStylusStore(s => s.palette)
  const setView = useLibraryStore(s => s.setView)
  const [scriptPanelOpen, setScriptPanelOpen] = useState(false)
  const [syncFolderName, setSyncFolderName] = useState<string | null>(() => getSyncFolderName())
  const [syncActive, setSyncActive] = useState(() => hasSyncFolder())

  const toggleLang = () => {
    const next = i18n.language === 'he' ? 'en' : 'he'
    i18n.changeLanguage(next)
    localStorage.setItem('map-lang', next)
    document.dir = next === 'he' ? 'rtl' : 'ltr'
  }

  const handleSyncClick = async () => {
    if (syncActive) {
      // Already active — offer to clear (right-click would be nicer, but a confirm works)
      const label = syncFolderName ?? ''
      if (confirm(i18n.language === 'he' ? `נקה תיקיית sync "${label}"?` : `Clear sync folder "${label}"?`)) {
        clearSyncFolder()
        setSyncFolderName(null)
        setSyncActive(false)
      }
      return
    }
    const name = await pickSyncFolder()
    if (name) {
      setSyncFolderName(name)
      setSyncActive(true)
    }
  }

  const handleExport = () => {
    if (!xmlString || !metadata || !fileName) return
    const json = exportToAnalysisJson(xmlString, metadata, annotations, researchNotes, palette)
    downloadJson(json, fileName)
  }

  const handleExportPdf = () => {
    if (!metadata) return
    exportToPdf(metadata.title || 'MAP Score')
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
        <button className="btn-back-library" onClick={() => setView('library')} title={i18n.language === 'he' ? 'חזרה לספריה' : 'Back to library'}>
          ←
        </button>
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
            <button
              className={`btn-sync ${syncActive ? 'active' : syncFolderName ? 'stale' : ''}`}
              onClick={handleSyncClick}
              title={
                syncActive
                  ? (i18n.language === 'he' ? `Sync פעיל: ${syncFolderName}` : `Sync active: ${syncFolderName}`)
                  : syncFolderName
                    ? (i18n.language === 'he' ? `לחץ לחיבור מחדש: ${syncFolderName}` : `Click to reconnect: ${syncFolderName}`)
                    : (i18n.language === 'he' ? 'בחר תיקיית Sync' : 'Pick sync folder')
              }
            >
              📁{syncFolderName ? ` ${syncFolderName}` : ' Sync'}
            </button>
            <button className="btn-export" onClick={handleExport} title={t('app.export')}>
              ⬇ JSON
            </button>
            <button className="btn-export" onClick={handleExportPdf} title={i18n.language === 'he' ? 'ייצוא PDF' : 'Export PDF'}>
              🖨 PDF
            </button>
          </>
        )}
        {metadata && (
          <div style={{ position: 'relative' }}>
            <button
              className={`btn-scripts ${scriptPanelOpen ? 'active' : ''}`}
              onClick={() => setScriptPanelOpen(p => !p)}
              title={i18n.language === 'he' ? 'סקריפטים' : 'Scripts'}
            >
              🔬
            </button>
            {scriptPanelOpen && (
              <ScriptPanel onClose={() => setScriptPanelOpen(false)} />
            )}
          </div>
        )}
        <button className="btn-lang" onClick={toggleLang} title="Switch language">
          {i18n.language === 'he' ? 'EN' : 'עב'}
        </button>
      </div>
    </header>
  )
}
