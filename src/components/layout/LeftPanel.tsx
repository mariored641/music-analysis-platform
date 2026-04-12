import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLayerStore } from '../../store/layerStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useAnnotationBrowserStore } from '../../store/annotationBrowserStore'
import { LAYERS } from '../../constants/layers'
import { ColorPalette } from '../stylus/ColorPalette'
import { AnnotationBrowser } from './AnnotationBrowser'
import { v4 as uuid } from 'uuid'
import type { LayerId } from '../../types/annotation'
import './LeftPanel.css'

export function LeftPanel() {
  const { t, i18n } = useTranslation()
  const { visible, toggle, legendColors, setLegendColor } = useLayerStore()
  const { addAnnotation, addToLabelHistory } = useAnnotationStore()
  const selection = useSelectionStore(s => s.selection)
  const labelHistory = useAnnotationStore(s => s.labelHistory)
  const quickTags = labelHistory.slice(0, 6)

  const { browsingLayer, setBrowsingLayer } = useAnnotationBrowserStore()
  const [expanded, setExpanded] = useState<Set<LayerId>>(new Set())

  const toggleExpand = (id: LayerId) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  const lang = i18n.language

  return (
    <aside className="left-panel">
      {/* Layer toggles */}
      <section className="panel-section">
        <div className="panel-section-header">{t('app.layers')}</div>
        <ul className="layer-list">
          {LAYERS.map(layer => {
            const isVisible = visible[layer.id as LayerId]
            const isExpanded = expanded.has(layer.id as LayerId)
            const hasLegend = layer.id === 'freehand' || (layer.legend && layer.legend.length > 0)

            return (
              <li key={layer.id} className="layer-item">
                <div
                  className={`layer-row ${browsingLayer === layer.id ? 'browsing' : ''}`}
                  style={{ '--layer-color': layer.color } as React.CSSProperties}
                >
                  <span
                    className={`layer-checkbox ${isVisible ? 'checked' : ''}`}
                    style={isVisible ? { background: layer.color, borderColor: layer.color } : {}}
                    onClick={() => toggle(layer.id as LayerId)}
                    title={isVisible ? t('layers.hide') : t('layers.show')}
                  />

                  <span
                    className={`layer-label-btn ${isVisible ? 'active' : ''}`}
                    onClick={() => setBrowsingLayer(layer.id as LayerId)}
                    title={lang === 'he' ? 'עיין בתיוגים' : 'Browse annotations'}
                  >
                    {t(`layers.${layer.id}`)}
                  </span>

                  {hasLegend && (
                    <button
                      className={`layer-expand-btn ${isExpanded ? 'open' : ''}`}
                      onClick={() => toggleExpand(layer.id as LayerId)}
                      title={isExpanded ? t('layers.collapseLegend') : t('layers.expandLegend')}
                    >
                      ▸
                    </button>
                  )}
                </div>

                {browsingLayer === layer.id && (
                  <AnnotationBrowser layerId={layer.id as LayerId} />
                )}

                {isExpanded && hasLegend && (
                  <div className="layer-legend">
                    {layer.id === 'freehand' ? (
                      <ColorPalette />
                    ) : (
                      layer.legend?.map((item, i) => {
                        const effectiveColor = legendColors[`${layer.id}:${i}`] ?? item.color
                        return (
                          <div key={i} className="legend-item">
                            <label
                              className="legend-dot-label"
                              title={lang === 'he' ? 'לחץ לשינוי צבע' : 'Click to change color'}
                            >
                              <span className="legend-dot" style={{ background: effectiveColor }} />
                              <input
                                type="color"
                                value={effectiveColor}
                                onChange={e => setLegendColor(layer.id as LayerId, i, e.target.value)}
                                className="legend-color-input"
                              />
                            </label>
                            <span className="legend-text">
                              {lang === 'he' ? item.labelHe : item.labelEn}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </li>
            )
          })}
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
