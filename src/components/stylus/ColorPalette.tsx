import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStylusStore } from '../../store/stylusStore'
import { LAYERS } from '../../constants/layers'
import './ColorPalette.css'

export function ColorPalette() {
  const { t } = useTranslation()
  const { palette, activeColorId, setActiveColor, addPaletteEntry, updatePaletteEntry, removePaletteEntry } = useStylusStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close popover on outside click
  useEffect(() => {
    if (!editingId) return
    const handler = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setEditingId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [editingId])

  const editingEntry = palette.find(e => e.id === editingId)

  const handleCircleClick = (id: string) => {
    setActiveColor(id)
    setEditingId(prev => prev === id ? null : id)
  }

  return (
    <div className="color-palette">
      <div className="palette-circles">
        {palette.map(entry => (
          <div
            key={entry.id}
            className={`palette-circle-wrap ${activeColorId === entry.id ? 'active' : ''}`}
          >
            <button
              className="palette-circle"
              style={{ background: entry.color, opacity: entry.opacity }}
              onClick={() => handleCircleClick(entry.id)}
              title={entry.label || entry.color}
            />
            <button
              className="palette-remove"
              onClick={(e) => {
                e.stopPropagation()
                if (editingId === entry.id) setEditingId(null)
                removePaletteEntry(entry.id)
              }}
              title={t('palette.remove')}
            >×</button>
          </div>
        ))}
        <button className="palette-add" onClick={addPaletteEntry} title={t('palette.add')}>+</button>
      </div>

      {editingId && editingEntry && (
        <div className="palette-popover" ref={popoverRef}>
          <div className="popover-row">
            <label className="popover-label">{t('palette.color')}</label>
            <input
              type="color"
              value={editingEntry.color}
              onChange={e => updatePaletteEntry(editingId, { color: e.target.value })}
              className="popover-color-input"
            />
          </div>

          <div className="popover-row">
            <label className="popover-label">{t('palette.width')} {editingEntry.width}px</label>
            <input
              type="range" min={1} max={12} step={1}
              value={editingEntry.width}
              onChange={e => updatePaletteEntry(editingId, { width: +e.target.value })}
              className="popover-range"
            />
          </div>

          <div className="popover-row">
            <label className="popover-label">{t('palette.opacity')} {Math.round(editingEntry.opacity * 100)}%</label>
            <input
              type="range" min={0.1} max={1} step={0.05}
              value={editingEntry.opacity}
              onChange={e => updatePaletteEntry(editingId, { opacity: +e.target.value })}
              className="popover-range"
            />
          </div>

          <div className="popover-row">
            <label className="popover-label">{t('palette.label')}</label>
            <input
              type="text"
              placeholder={t('palette.labelPlaceholder')}
              value={editingEntry.label || ''}
              onChange={e => updatePaletteEntry(editingId, { label: e.target.value })}
              className="popover-text-input"
            />
          </div>

          <div className="popover-row">
            <label className="popover-label">{t('palette.linkLayer')}</label>
            <select
              value={editingEntry.linkedLayer || ''}
              onChange={e => updatePaletteEntry(editingId, { linkedLayer: e.target.value || undefined })}
              className="popover-select"
            >
              <option value="">{t('palette.noLink')}</option>
              {LAYERS.filter(l => l.id !== 'freehand').map(l => (
                <option key={l.id} value={l.id}>{l.labelHe} / {l.labelEn}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
