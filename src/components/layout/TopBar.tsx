import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useScoreStore } from '../../store/scoreStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { useSelectionStore } from '../../store/selectionStore'
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
  const {
    isPlaying, isPaused,
    setPlaying, pausePlayback, resumePlayback, stopPlayback,
    tempo, setTempo,
    loopEnabled, loopStart, loopEnd, setLoop, clearLoop,
    setStartMeasure,
  } = usePlaybackStore()
  const selection = useSelectionStore(s => s.selection)
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

  // Play from selection.measureStart (or measure 1 if no selection)
  const handlePlay = () => {
    const from = selection?.measureStart ?? 1
    setStartMeasure(from)
    setPlaying(true)
  }

  // Toggle loop on current selection range
  const handleLoopToggle = () => {
    if (loopEnabled) {
      clearLoop()
    } else if (selection && selection.measureEnd && selection.measureEnd > selection.measureStart) {
      setLoop(selection.measureStart, selection.measureEnd)
    } else if (selection) {
      setLoop(selection.measureStart, selection.measureStart)
    }
  }

  const hasRangeSelection = selection !== null &&
    selection.measureEnd !== undefined &&
    selection.measureEnd > selection.measureStart

  const saveStatus = isSaving
    ? t('app.saving')
    : isDirty
      ? t('app.unsaved')
      : lastSaved
        ? t('app.saved')
        : ''

  const isHe = i18n.language === 'he'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn-back-library" onClick={() => setView('library')} title={isHe ? 'חזרה לספריה' : 'Back to library'}>
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

            {/* Transport controls */}
            <div className="transport-group">
              {/* Play / Resume button — only shown when stopped or paused */}
              {!isPlaying && (
                <button
                  className={`btn-play ${isPaused ? 'paused' : ''}`}
                  onClick={isPaused ? resumePlayback : handlePlay}
                  title={isPaused ? (isHe ? 'המשך נגינה' : 'Resume') : `${isHe ? 'נגן' : 'Play'} (Space)`}
                >
                  ▶
                </button>
              )}

              {/* Pause button — only shown when playing */}
              {isPlaying && (
                <button
                  className="btn-play active"
                  onClick={pausePlayback}
                  title={isHe ? 'השהה (Space)' : 'Pause (Space)'}
                >
                  ⏸
                </button>
              )}

              {/* Stop button — shown when playing or paused */}
              {(isPlaying || isPaused) && (
                <button
                  className="btn-stop"
                  onClick={stopPlayback}
                  title={isHe ? 'עצור' : 'Stop'}
                >
                  ⏹
                </button>
              )}

              {/* Loop button — shown when there's a range selection, or loop is active */}
              {(hasRangeSelection || loopEnabled) && (
                <button
                  className={`btn-loop ${loopEnabled ? 'active' : ''}`}
                  onClick={handleLoopToggle}
                  title={loopEnabled
                    ? (isHe ? `לולאה פעילה: ${loopStart}–${loopEnd} (לחץ לביטול)` : `Loop active: ${loopStart}–${loopEnd} (click to cancel)`)
                    : (isHe ? 'לולאה על הסלקציה' : 'Loop selection')
                  }
                >
                  🔁{loopEnabled && loopStart !== null && ` ${loopStart}–${loopEnd}`}
                </button>
              )}
            </div>

            <button
              className={`btn-sync ${syncActive ? 'active' : syncFolderName ? 'stale' : ''}`}
              onClick={handleSyncClick}
              title={
                syncActive
                  ? (isHe ? `Sync פעיל: ${syncFolderName}` : `Sync active: ${syncFolderName}`)
                  : syncFolderName
                    ? (isHe ? `לחץ לחיבור מחדש: ${syncFolderName}` : `Click to reconnect: ${syncFolderName}`)
                    : (isHe ? 'בחר תיקיית Sync' : 'Pick sync folder')
              }
            >
              📁{syncFolderName ? ` ${syncFolderName}` : ' Sync'}
            </button>
            <button className="btn-export" onClick={handleExport} title={t('app.export')}>
              ⬇ JSON
            </button>
            <button className="btn-export" onClick={handleExportPdf} title={isHe ? 'ייצוא PDF' : 'Export PDF'}>
              🖨 PDF
            </button>
          </>
        )}
        {metadata && (
          <div style={{ position: 'relative' }}>
            <button
              className={`btn-scripts ${scriptPanelOpen ? 'active' : ''}`}
              onClick={() => setScriptPanelOpen(p => !p)}
              title={isHe ? 'סקריפטים' : 'Scripts'}
            >
              🔬
            </button>
            {scriptPanelOpen && (
              <ScriptPanel onClose={() => setScriptPanelOpen(false)} />
            )}
          </div>
        )}
        <button className="btn-lang" onClick={toggleLang} title="Switch language">
          {isHe ? 'EN' : 'עב'}
        </button>
      </div>
    </header>
  )
}
