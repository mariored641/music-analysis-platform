import { useState } from 'react'
import { useStylusStore } from '../../store/stylusStore'
import { Popover } from '../common/Popover'
import { Icon } from '../common/Icon'
import { useTr } from '../../i18n'

/**
 * Bottom corner of the score: color circles + draw / erase.
 * Vision: click a circle → small pop-out (width, opacity, color) that saves on outside click;
 * + adds a circle, × (on hover) removes one.
 */
export function StylusDock() {
  const tr = useTr()
  const { palette, activeId, mode, penAlwaysDraws } = useStylusStore()
  const st = useStylusStore.getState()
  const [edit, setEdit] = useState<{ id: string; at: { x: number; y: number } } | null>(null)
  const entry = palette.find(e => e.id === edit?.id)

  const onCircle = (id: string, e: React.MouseEvent) => {
    if (id === activeId && mode === 'draw') {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setEdit({ id, at: { x: r.left - 90, y: r.top - 190 } })
    } else {
      st.setActive(id)
      st.setMode('draw')
    }
  }

  return (
    <div className="stylus-dock" onPointerDown={e => e.stopPropagation()}>
      <button className={`dock-btn${mode === 'select' ? ' on' : ''}`} onClick={() => st.setMode('select')} title={tr('בחירה (V)', 'Select (V)')}><Icon name="cursor" size={17} /></button>
      <button className={`dock-btn${mode === 'draw' ? ' on' : ''}`} onClick={() => st.setMode(mode === 'draw' ? 'select' : 'draw')} title={tr('ציור (D)', 'Draw (D)')}><Icon name="pen" size={17} /></button>
      <button className={`dock-btn${mode === 'erase' ? ' on' : ''}`} onClick={() => st.setMode(mode === 'erase' ? 'select' : 'erase')} title={tr('מחק (E)', 'Erase (E)')}><Icon name="eraser" size={17} /></button>
      <span className="dock-sep" />
      {palette.map(p => (
        <span key={p.id} className="dock-color-wrap">
          <button className={`dock-color${p.id === activeId ? ' active' : ''}`} onClick={e => onCircle(p.id, e)}
            title={p.id === activeId ? tr('לחץ שוב לעריכה', 'Click again to edit') : ''}
            style={{ ['--c' as string]: p.color }}>
            <span style={{ width: Math.min(18, 5 + p.width * 1.2), height: Math.min(18, 5 + p.width * 1.2), opacity: Math.max(0.35, p.opacity) }} />
          </button>
          {palette.length > 1 && <button className="dock-remove" onClick={() => st.removeEntry(p.id)} aria-label="remove"><Icon name="close" size={9} stroke={3} /></button>}
        </span>
      ))}
      <button className="dock-btn add" onClick={e => {
        const id = st.addEntry()
        st.setMode('draw')
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setEdit({ id, at: { x: r.left - 90, y: r.top - 190 } })
      }} title={tr('צבע חדש', 'New color')}><Icon name="plus" size={16} /></button>
      <label className="dock-pen" title={tr('עט מגע מצייר תמיד, גם במצב בחירה', 'A stylus always draws, even in select mode')}>
        <input type="checkbox" checked={penAlwaysDraws} onChange={e => st.setPenAlwaysDraws(e.target.checked)} />
        <span>{tr('עט', 'Pen')}</span>
      </label>

      {edit && entry && (
        <Popover at={edit.at} onClose={() => setEdit(null)} className="pen-pop">
          <label className="pp-row">
            <span>{tr('צבע', 'Color')}</span>
            <input type="color" value={entry.color} onChange={e => st.updateEntry(entry.id, { color: e.target.value })} />
          </label>
          <label className="pp-row">
            <span>{tr('עובי', 'Width')}</span>
            <input type="range" min={1} max={24} value={entry.width} onChange={e => st.updateEntry(entry.id, { width: Number(e.target.value) })} />
            <b>{entry.width}</b>
          </label>
          <label className="pp-row">
            <span>{tr('אטימות', 'Opacity')}</span>
            <input type="range" min={10} max={100} value={Math.round(entry.opacity * 100)} onChange={e => st.updateEntry(entry.id, { opacity: Number(e.target.value) / 100 })} />
            <b>{Math.round(entry.opacity * 100)}%</b>
          </label>
          <svg className="pp-preview" viewBox="0 0 160 30"><path d="M8 20 C 40 4, 70 28, 100 14 S 140 8, 152 16" stroke={entry.color} strokeWidth={entry.width} strokeOpacity={entry.opacity} fill="none" strokeLinecap="round" /></svg>
        </Popover>
      )}
    </div>
  )
}
