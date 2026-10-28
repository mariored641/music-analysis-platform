import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/index'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Dev-only handle for debugging / browser tests
if (import.meta.env.DEV) {
  Promise.all([
    import('./store/annotationStore'), import('./store/selectionStore'), import('./store/researchStore'),
    import('./store/workspaceStore'), import('./store/libraryStore'), import('./store/playbackStore'),
  ]).then(([a, s, r, w, l, pb]) => {
    (window as any).__map = { annotations: a.useAnnotationStore, selection: s.useSelectionStore, research: r.useResearchStore, workspace: w.useWorkspaceStore, library: l.useLibraryStore, playback: pb.usePlaybackStore }
  })
}
