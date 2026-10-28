import { useEffect, useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { usePlaybackStore } from '../../store/playbackStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useResearchStore } from '../../store/researchStore'
import { useUiStore } from '../../store/uiStore'
import { useSyncStore, connectFolder, reauthorize, disconnectFolder } from '../../services/syncService'
import { closePiece, savePiece } from '../../services/pieceService'
import { buildAnalysisFile, downloadText, baseName } from '../../services/analysisExport'
import { exportToPdf } from '../../services/pdfExporter'
import { Icon } from '../common/Icon'
import { Popover } from '../common/Popover'
import { PieceForm } from '../library/PieceForm'
import { setLanguage, useHe, useTr } from '../../i18n'

export function TopBar() {
  const tr = useTr()
  const he = useHe()
  const pieceId = useWorkspaceStore(s => s.pieceId)
  const piece = useLibraryStore(s => s.pieces.find(p => p.id === pieceId))
  const [editing, setEditing] = useState(false)
  const [exportAt, setExportAt] = useState<{ x: number; y: number } | null>(null)
  const canUndo = useAnnotationStore(s => s.undoStack.length > 0)
  const canRedo = useAnnotationStore(s => s.redoStack.length > 0)

  return (
    <header className="topbar">
      <div className="tb-group">
        <button className="btn ghost" onClick={() => closePiece()} title={tr('חזרה לספרייה', 'Back to library')}>
          <Icon name={he ? 'forward' : 'back'} />{tr('ספרייה', 'Library')}
        </button>
        <button className="tb-title" onClick={() => setEditing(true)} title={tr('עריכת פרטי היצירה', 'Edit piece details')}>
          <strong>{piece?.title ?? ''}</strong>
          {piece?.composer && <span>{piece.composer}</span>}
        </button>
        <SaveIndicator />
      </div>

      <Transport />

      <div className="tb-group end">
        <button className="icon-btn" disabled={!canUndo} onClick={() => useAnnotationStore.getState().undo()} title={tr('בטל (Ctrl+Z)', 'Undo (Ctrl+Z)')}><Icon name="undo" /></button>
        <button className="icon-btn" disabled={!canRedo} onClick={() => useAnnotationStore.getState().redo()} title={tr('בצע שוב (Ctrl+Y)', 'Redo (Ctrl+Y)')}><Icon name="redo" /></button>
        <span className="tb-sep" />
        <button className="btn ghost" onClick={() => useUiStore.getState().setScriptsOpen(true)} title={tr('סקריפטים לניתוח אוטומטי', 'Analysis scripts')}>
          <Icon name="flask" />{tr('סקריפטים', 'Scripts')}
        </button>
        <button className="btn ghost" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setExportAt({ x: he ? r.left : r.right - 260, y: r.bottom + 6 }) }}>
          <Icon name="download" />{tr('ייצוא', 'Export')}
        </button>
        <button className="icon-btn" onClick={() => setLanguage(he ? 'en' : 'he')} title={he ? 'English' : 'עברית'}><span className="lang">{he ? 'EN' : 'עב'}</span></button>
      </div>

      {exportAt && <ExportMenu at={exportAt} onClose={() => setExportAt(null)} />}
      {editing && piece && (
        <PieceForm initial={piece} heading={tr('פרטי היצירה', 'Piece details')} submitLabel={tr('שמור', 'Save')} onClose={() => setEditing(false)}
          onSubmit={m => { useLibraryStore.getState().updatePiece(piece.id, m); setEditing(false); savePiece() }} />
      )}
    </header>
  )
}

function SaveIndicator() {
  const tr = useTr()
  const state = useWorkspaceStore(s => s.saveState)
  const last = useWorkspaceStore(s => s.lastSaved)
  const sync = useSyncStore(s => s.status)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(t) }, [])
  const ago = last ? relTime(last, tr) : ''
  return (
    <span className={`save-ind ${state}`} title={last ? new Date(last).toLocaleString() : ''}>
      {state === 'saved' && <><Icon name="check" size={14} />{tr('נשמר', 'Saved')} <em>{ago}</em>{sync === 'ready' && <Icon name="folder" size={13} />}</>}
      {(state === 'dirty' || state === 'saving') && <><span className="spinner" />{tr('שומר…', 'Saving…')}</>}
      {state === 'error' && <>{tr('שגיאת שמירה', 'Save failed')}</>}
    </span>
  )
}

function relTime(ts: number, tr: (h: string, e: string) => string) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 45) return tr('עכשיו', 'just now')
  const m = Math.round(s / 60)
  if (m < 60) return tr(`לפני ${m} ד׳`, `${m}m ago`)
  const h = Math.round(m / 60)
  if (h < 24) return tr(`לפני ${h} ש׳`, `${h}h ago`)
  return new Date(ts).toLocaleDateString()
}

function Transport() {
  const tr = useTr()
  const { isPlaying, isPaused, tempo, loop } = usePlaybackStore()
  const pb = usePlaybackStore.getState()
  const hasRange = useSelectionStore(s => !!s.selection && s.selection.measureEnd > s.selection.measureStart)
  return (
    <div className="transport">
      <button className={`play-btn${isPlaying ? ' on' : ''}`} onClick={() => isPlaying ? pb.pause() : isPaused ? pb.resume() : pb.play()}
        title={tr('נגן מהבחירה / השהה (רווח)', 'Play from selection / pause (Space)')}>
        <Icon name={isPlaying ? 'pause' : 'play'} fill={!isPlaying} size={16} />
      </button>
      <button className="icon-btn" disabled={!isPlaying && !isPaused} onClick={() => pb.stop()} title={tr('עצור', 'Stop')}><Icon name="stop" size={16} /></button>
      <label className="tempo" title={tr('טמפו', 'Tempo')}>
        <span>♩=</span>
        <input type="number" min={20} max={400} value={tempo} onChange={e => pb.setTempo(Number(e.target.value) || 120)} />
      </label>
      <button className={`icon-btn${loop ? ' on' : ''}`} disabled={!hasRange && !loop} onClick={() => pb.setLoop(!loop)} title={tr('לופ על הבחירה', 'Loop the selection')}>
        <Icon name="loop" size={16} />
      </button>
    </div>
  )
}

function ExportMenu({ at, onClose }: { at: { x: number; y: number }; onClose: () => void }) {
  const tr = useTr()
  const sync = useSyncStore()
  const pieceId = useWorkspaceStore(s => s.pieceId)
  const piece = useLibraryStore(s => s.pieces.find(p => p.id === pieceId))

  const exportJson = () => {
    const { noteMap, xml } = useWorkspaceStore.getState()
    if (!piece) return
    const file = buildAnalysisFile(piece, useAnnotationStore.getState().annotations, useResearchStore.getState().notes, noteMap, xml)
    downloadText(JSON.stringify(file, null, 2), `${baseName(piece.fileName)}.analysis.json`)
    onClose()
  }
  const exportXml = () => {
    const { xml } = useWorkspaceStore.getState()
    if (piece && xml) downloadText(xml, `${baseName(piece.fileName)}.musicxml`, 'application/xml')
    onClose()
  }
  const folder = async () => {
    const ok = sync.status === 'needs-permission' ? await reauthorize() : await connectFolder()
    if (ok) { await savePiece(); useUiStore.getState().toast(tr('התיקייה מסונכרנת', 'Folder synced'), 'success') }
    onClose()
  }

  return (
    <Popover at={at} onClose={onClose} className="menu">
      <button className="menu-item" onClick={() => { onClose(); useSelectionStore.getState().clear(); setTimeout(() => exportToPdf(piece?.title ?? 'MAP'), 80) }}>
        <Icon name="printer" /><div><b>PDF</b><small>{tr('הדפסה / שמירה כ-PDF עם כל התיוגים', 'Print / save as PDF with all tags')}</small></div>
      </button>
      <button className="menu-item" onClick={exportJson}>
        <Icon name="download" /><div><b>analysis.json</b><small>{tr('כל הניתוח בקובץ קריא (לקלוד קוד)', 'Full analysis as readable JSON')}</small></div>
      </button>
      <button className="menu-item" onClick={exportXml}>
        <Icon name="music" /><div><b>MusicXML</b><small>{tr('קובץ התווים המקורי', 'Original score file')}</small></div>
      </button>
      <div className="menu-sep" />
      {sync.status === 'unsupported' ? (
        <div className="menu-note">{tr('סנכרון תיקייה זמין ב-Chrome / Edge', 'Folder sync needs Chrome / Edge')}</div>
      ) : (
        <button className="menu-item" onClick={folder}>
          <Icon name="folder" /><div>
            <b>{sync.status === 'ready' ? tr(`מסונכרן: ${sync.folder}`, `Synced: ${sync.folder}`) : sync.status === 'needs-permission' ? tr(`חדש גישה ל-${sync.folder}`, `Re-allow ${sync.folder}`) : tr('סנכרון לתיקייה במחשב', 'Sync to a folder')}</b>
            <small>{tr('כל שמירה נכתבת גם לתיקייה — קלוד קוד יכול לקרוא ולערוך', 'Every save is written there — Claude Code can read & edit')}</small>
          </div>
        </button>
      )}
      {sync.status === 'ready' && <button className="menu-item subtle" onClick={() => { disconnectFolder(); onClose() }}>{tr('נתק תיקייה', 'Disconnect folder')}</button>}
    </Popover>
  )
}
