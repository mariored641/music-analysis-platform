import { useEffect, lazy, Suspense } from 'react'
import { useLibraryStore } from './store/libraryStore'
import { LibraryView } from './components/library/LibraryView'
import { Toasts } from './components/common/Toasts'
import { useAutoSave } from './hooks/useAutoSave'
import { usePlayback } from './hooks/usePlayback'
import { initSync } from './services/syncService'
import { openPiece } from './services/pieceService'
import i18n from './i18n'
import './styles/theme.css'

const Workspace = lazy(() => import('./components/workspace/Workspace').then(m => ({ default: m.Workspace })))
const RendererTestView = lazy(() => import('./views/RendererTestView').then(m => ({ default: m.RendererTestView })))
const AppTestView = lazy(() => import('./views/AppTestView').then(m => ({ default: m.AppTestView })))

export function App() {
  // Dev routes for the native renderer test tooling
  if (window.location.pathname === '/renderer-test') return <Suspense fallback={null}><RendererTestView /></Suspense>
  if (window.location.pathname === '/app-test') return <Suspense fallback={null}><AppTestView /></Suspense>
  return <MainApp />
}

function MainApp() {
  useAutoSave()
  usePlayback()
  const view = useLibraryStore(s => s.currentView)

  useEffect(() => {
    const apply = (lng: string) => {
      document.documentElement.dir = lng === 'he' ? 'rtl' : 'ltr'
      document.documentElement.lang = lng
    }
    apply(i18n.language)
    i18n.on('languageChanged', apply)
    initSync()
    // Restore the last open piece after a reload
    const { currentView, activePieceId } = useLibraryStore.getState()
    if (currentView === 'analysis' && activePieceId) openPiece(activePieceId).catch(() => useLibraryStore.getState().setView('library'))
    else if (currentView === 'analysis') useLibraryStore.getState().setView('library')
    return () => { i18n.off('languageChanged', apply) }
  }, [])

  return (
    <>
      {view === 'analysis'
        ? <Suspense fallback={<div className="ws-loading"><span className="spinner big" /></div>}><Workspace /></Suspense>
        : <LibraryView />}
      <Toasts />
    </>
  )
}
