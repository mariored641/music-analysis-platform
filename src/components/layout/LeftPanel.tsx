import { useTranslation } from 'react-i18next'
import { useLayerStore } from '../../store/layerStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useSelectionStore } from '../../store/selectionStore'
import { LAYERS } from '../../constants/layers'
import { v4 as uuid } from 'uuid'
import type { LayerId } from '../../types/annotation'
import './LeftPanel.css'

export function LeftPanel() {
  const { t } = useTranslation()
  const { visible, toggle } = useLayerStore()
  const { addAnnotation, addToLabelHistory } = useAnnotationStore()
  const selection = useSelectionStore(s => s.selection)

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

  return (
    <aside className="left-panel">
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
