import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUiStore } from '../../store/uiStore'
import { ScoreCanvas } from '../../score/ScoreCanvas'
import { TopBar } from './TopBar'
import { LayersPanel } from './LayersPanel'
import { RightPanel } from './Inspector'
import { StatusBar } from './StatusBar'
import { StylusDock } from './StylusDock'
import { ScriptsDrawer } from './ScriptsDrawer'
import { ShortcutsHelp } from './ShortcutsHelp'
import { Icon } from '../common/Icon'
import { useShortcuts } from '../../hooks/useShortcuts'
import { useTr } from '../../i18n'
import { closePiece } from '../../services/pieceService'
import './workspace.css'

export function Workspace() {
  const tr = useTr()
  useShortcuts()
  const status = useWorkspaceStore(s => s.status)
  const leftOpen = useUiStore(s => s.leftOpen)
  const rightOpen = useUiStore(s => s.rightOpen)
  const ui = useUiStore.getState()

  if (status === 'loading' || status === 'idle') return <div className="ws-loading"><span className="spinner big" />{tr('טוען יצירה…', 'Loading piece…')}</div>
  if (status === 'error') return (
    <div className="ws-loading">
      {tr('לא ניתן לפתוח את היצירה.', 'Could not open this piece.')}
      <button className="btn" onClick={() => closePiece()}>{tr('חזרה לספרייה', 'Back to library')}</button>
    </div>
  )

  return (
    <div className="workspace">
      <TopBar />
      <div className={`ws-body${leftOpen ? '' : ' no-left'}${rightOpen ? '' : ' no-right'}`}>
        {leftOpen && <LayersPanel />}
        <main className="ws-score">
          <button className="panel-toggle start" onClick={ui.toggleLeft} title={tr('שכבות', 'Layers')}><Icon name="sidebar" size={16} /></button>
          <button className="panel-toggle end" onClick={ui.toggleRight} title={tr('פאנל ניתוח', 'Analysis panel')}><Icon name="sidebarR" size={16} /></button>
          <ScoreCanvas />
          <StylusDock />
        </main>
        {rightOpen && <RightPanel />}
      </div>
      <StatusBar />
      <ScriptsDrawer />
      <ShortcutsHelp />
    </div>
  )
}
