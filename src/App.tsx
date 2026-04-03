import { useEffect } from 'react'
import { TopBar } from './components/layout/TopBar'
import { LeftPanel } from './components/layout/LeftPanel'
import { RightPanel } from './components/layout/RightPanel'
import { StatusBar } from './components/layout/StatusBar'
import { ScoreView } from './components/score/ScoreView'
import { LibraryView } from './views/LibraryView'
import { RendererTestView } from './views/RendererTestView'
import { AppTestView } from './views/AppTestView'
import { useLibraryStore } from './store/libraryStore'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboard } from './hooks/useKeyboard'
import { usePlayback } from './hooks/usePlayback'
import { useRestoreSession } from './hooks/useRestoreSession'
import i18n from './i18n/index'
import './App.css'

export function App() {
  // Dev routes (no hooks needed)
  if (window.location.pathname === '/renderer-test') return <RendererTestView />
  // Layer 2 test: same fixtures rendered inside app CSS context (.vrv-svg / ScoreView.css)
  if (window.location.pathname === '/app-test') return <AppTestView />
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
        <ScoreView />
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  )
}
