import { useEffect, lazy, Suspense } from 'react'
import { TopBar } from './components/layout/TopBar'
import { LeftPanel } from './components/layout/LeftPanel'
import { RightPanel } from './components/layout/RightPanel'
import { StatusBar } from './components/layout/StatusBar'
import { LibraryView } from './views/LibraryView'
import { useLibraryStore } from './store/libraryStore'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboard } from './hooks/useKeyboard'
import { usePlayback } from './hooks/usePlayback'
import { useRestoreSession } from './hooks/useRestoreSession'
import i18n from './i18n/index'
import './App.css'

const ScoreView = lazy(() => import('./components/score/ScoreView').then(m => ({ default: m.ScoreView })))
const RendererTestView = lazy(() => import('./views/RendererTestView').then(m => ({ default: m.RendererTestView })))
const AppTestView = lazy(() => import('./views/AppTestView').then(m => ({ default: m.AppTestView })))

export function App() {
  // Dev routes (no hooks needed)
  if (window.location.pathname === '/renderer-test') {
    return <Suspense fallback={null}><RendererTestView /></Suspense>
  }
  // Layer 2 test: same fixtures rendered inside app CSS context (.vrv-svg / ScoreView.css)
  if (window.location.pathname === '/app-test') {
    return <Suspense fallback={null}><AppTestView /></Suspense>
  }
  return <MainApp />
}

function MainApp() {
  useRestoreSession()
  useAutoSave()
  useKeyboard()
  usePlayback()

  const currentView = useLibraryStore(s => s.currentView)

  useEffect(() => {
    document.dir = i18n.language === 'he' ? 'rtl' : 'ltr'
    const onLangChange = (lng: string) => {
      document.dir = lng === 'he' ? 'rtl' : 'ltr'
    }
    i18n.on('languageChanged', onLangChange)
    return () => i18n.off('languageChanged', onLangChange)
  }, [])

  if (currentView === 'library') {
    return <LibraryView />
  }

  return (
    <div className="app">
      <TopBar />
      <div className="app-body">
        <LeftPanel />
        <Suspense fallback={<div className="score-loading">Loading score renderer…</div>}>
          <ScoreView />
        </Suspense>
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  )
}
