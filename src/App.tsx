import { useEffect } from 'react'
import { TopBar } from './components/layout/TopBar'
import { LeftPanel } from './components/layout/LeftPanel'
import { RightPanel } from './components/layout/RightPanel'
import { StatusBar } from './components/layout/StatusBar'
import { ScoreView } from './components/score/ScoreView'
import { useAutoSave } from './hooks/useAutoSave'
import { useKeyboard } from './hooks/useKeyboard'
import { usePlayback } from './hooks/usePlayback'
import { useRestoreSession } from './hooks/useRestoreSession'
import i18n from './i18n/index'
import './App.css'

export function App() {
  useRestoreSession()
  useAutoSave()
  useKeyboard()
  usePlayback()

  // Set RTL/LTR based on language
  useEffect(() => {
    document.dir = i18n.language === 'he' ? 'rtl' : 'ltr'
    const onLangChange = (lng: string) => {
      document.dir = lng === 'he' ? 'rtl' : 'ltr'
    }
    i18n.on('languageChanged', onLangChange)
    return () => i18n.off('languageChanged', onLangChange)
  }, [])

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
