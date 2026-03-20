import { useTranslation } from 'react-i18next'
import { useLayerStore } from '../../store/layerStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useScoreStore } from '../../store/scoreStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useSelectionStore } from '../../store/selectionStore'
import { parseMusicXml } from '../../services/xmlParser'
import { saveFile, loadFile, deleteFile } from '../../services/storageService'
import { LAYERS } from '../../constants/layers'
import { v4 as uuid } from 'uuid'
import type { LayerId } from '../../types/annotation'
import './LeftPanel.css'

export function LeftPanel() {
  const { t } = useTranslation()
  const { visible, toggle } = useLayerStore()
  const { addAnnotation, addToLabelHistory } = useAnnotationStore()
  const { setXml, setNoteMap } = useScoreStore()
  const { pieces, addPiece, setActive, removePiece } = useLibraryStore()
  const selection = useSelectionStore(s => s.selection)

  // Quick tags: last 6 used labels from history
  const labelHistory = useAnnotationStore(s => s.labelHistory)
  const quickTags = labelHistory.slice(0, 6)

  const handleQuickTag = (text: string) => {
    if (!selection) return
    addAnnotation({
      id: uuid(),
      layer: 'labels',
      text,
      measureStart: selection.measureStart,
      measureEnd: selection.measureEnd,
      noteIds: selection.noteIds,
      createdAt: Date.now(),
    })
    addToLabelHistory(text)
  }

  const handleDeletePiece = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteFile(id)
    removePiece(id)
    if (useScoreStore.getState().fileName === id) {
      useScoreStore.getState().setXml('', '')
    }
  }

  const handleOpenFile = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,.musicxml'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const noteMap = parseMusicXml(text)
      await saveFile(file.name, text, {})

      useScoreStore.getState().setXml(text, file.name)
      useScoreStore.getState().setNoteMap(noteMap)

      const id = file.name
      addPiece({
        id,
        title: noteMap.metadata.title,
        composer: noteMap.metadata.composer,
        fileName: file.name,
        totalMeasures: noteMap.metadata.totalMeasures,
        lastOpened: Date.now(),
        key: noteMap.metadata.key,
        timeSignature: noteMap.metadata.timeSignature,
      })
      setActive(id)
    }
    input.click()
  }

  const handleLoadPiece = async (id: string) => {
    const saved = await loadFile(id)
    if (!saved) return
    const noteMap = parseMusicXml(saved.xml)
    useScoreStore.getState().setXml(saved.xml, saved.id)
    useScoreStore.getState().setNoteMap(noteMap)
    useAnnotationStore.getState().loadAnnotations(saved.annotations)
    setActive(id)
  }

  return (
    <aside className="left-panel">
      {/* Library */}
      <section className="panel-section">
        <div className="panel-section-header">
          <span>{t('app.library')}</span>
          <button className="btn-open" onClick={handleOpenFile} title={t('app.openFile')}>+</button>
        </div>
        <ul className="library-list">
          {pieces.length === 0 && (
            <li className="library-empty">{t('app.noScore')}</li>
          )}
          {pieces.map(p => (
            <li key={p.id} className="library-item" onClick={() => handleLoadPiece(p.id)} title={p.fileName}>
              <div className="library-title">{p.title || p.fileName}</div>
              {p.composer && <div className="library-composer">{p.composer}</div>}
              <div className="library-meta">{p.key} · m.{p.totalMeasures}</div>
              <button
                className="library-delete"
                onClick={(e) => handleDeletePiece(e, p.id)}
                title="Remove from library"
              >×</button>
            </li>
          ))}
        </ul>
      </section>

      {/* Layer toggles */}
      <section className="panel-section">
        <div className="panel-section-header">{t('app.layers')}</div>
        <ul className="layer-list">
          {LAYERS.map(layer => (
            <li key={layer.id} className="layer-item">
              <button
                className={`layer-toggle ${visible[layer.id as LayerId] ? 'active' : ''}`}
                onClick={() => toggle(layer.id as LayerId)}
                style={{ '--layer-color': layer.color } as React.CSSProperties}
              >
                <span className="layer-dot" style={{ background: layer.color }} />
                <span className="layer-label">{t(`layers.${layer.id}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Quick tags */}
      {quickTags.length > 0 && (
        <section className="panel-section">
          <div className="panel-section-header">{t('app.quickTags')}</div>
          <div className="quick-tags">
            {quickTags.map(tag => (
              <button
                key={tag}
                className={`quick-tag ${!selection ? 'disabled' : ''}`}
                onClick={() => handleQuickTag(tag)}
                title={selection ? `Apply "${tag}" to selection` : 'Select a note or measure first'}
              >{tag}</button>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
