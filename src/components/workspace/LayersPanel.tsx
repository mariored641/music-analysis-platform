import { useMemo, useState } from 'react'
import { useAnnotationStore } from '../../store/annotationStore'
import { useLayerStore } from '../../store/layerStore'
import { useSelectionStore } from '../../store/selectionStore'
import { LAYERS, MELODY_FUNCTIONS, formColor, melodyColor, motifColor, type LayerConfig } from '../../constants/layers'
import { visKey, summarize, measureEnd, motifTag } from '../../services/annotationQueries'
import { selectMeasures, selectNotes } from '../../score/selectionOps'
import type { Annotation, FreehandAnnotation, LayerId } from '../../types/annotation'
import { Icon } from '../common/Icon'
import { useHe, useTr } from '../../i18n'

export function jumpTo(a: Annotation) {
  if (a.layer === 'form' || a.layer === 'texture' || !a.noteIds?.length) selectMeasures(a.measureStart, measureEnd(a))
  else selectNotes(a.noteIds)
  useSelectionStore.getState().selectAnnotation(a.id)
  useSelectionStore.getState().requestScroll(a.measureStart, a.noteIds?.[0])
}

export function LayersPanel() {
  const tr = useTr()
  const annotations = useAnnotationStore(s => s.annotations)
  const visible = useLayerStore(s => s.visible)
  const soloLayer = useLayerStore(s => s.soloLayer)
  const [open, setOpen] = useState<Set<LayerId>>(new Set(['melody']))

  const byLayer = useMemo(() => {
    const m = new Map<LayerId, Annotation[]>()
    for (const a of Object.values(annotations)) {
      const k = visKey(a)
      const arr = m.get(k)
      if (arr) arr.push(a); else m.set(k, [a])
    }
    for (const arr of m.values()) arr.sort((a, b) => a.measureStart - b.measureStart)
    return m
  }, [annotations])

  const toggleOpen = (id: LayerId) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <aside className="side-panel layers-panel">
      <div className="panel-head">
        <h3><Icon name="layers" size={16} />{tr('שכבות ניתוח', 'Analysis layers')}</h3>
        {soloLayer && <button className="btn-link" onClick={() => useLayerStore.getState().showAll()}>{tr('הצג הכל', 'Show all')}</button>}
      </div>
      <div className="layer-list">
        {LAYERS.map(l => (
          <LayerRow key={l.id} layer={l} items={byLayer.get(l.id) ?? []} visible={visible[l.id]} solo={soloLayer === l.id}
            open={open.has(l.id)} onToggleOpen={() => toggleOpen(l.id)} />
        ))}
      </div>
      <p className="panel-tip">{tr('🎯 = הצג רק את השכבה הזו. לחיצה על נקודת צבע משנה את הצבע.', '🎯 = show only this layer. Click a color dot to change it.')}</p>
    </aside>
  )
}

function LayerRow({ layer, items, visible, solo, open, onToggleOpen }: {
  layer: LayerConfig; items: Annotation[]; visible: boolean; solo: boolean; open: boolean; onToggleOpen: () => void
}) {
  const he = useHe()
  const tr = useTr()
  const colors = useLayerStore(s => s.colors)
  const color = colors[`layer:${layer.id}`] ?? layer.color
  return (
    <div className={`layer${visible ? '' : ' off'}${solo ? ' solo' : ''}`}>
      <div className="layer-row">
        <button className="layer-eye" onClick={() => useLayerStore.getState().toggle(layer.id)} title={visible ? tr('הסתר', 'Hide') : tr('הצג', 'Show')}>
          <Icon name={visible ? 'eye' : 'eyeOff'} size={16} />
        </button>
        <button className="layer-name" onClick={onToggleOpen}>
          <span className="layer-dot" style={{ background: color }} />
          <span>{he ? layer.he : layer.en}</span>
          {items.length > 0 && <span className="count">{items.length}</span>}
        </button>
        <button className={`layer-solo${solo ? ' on' : ''}`} onClick={() => useLayerStore.getState().solo(layer.id)} title={tr('רק השכבה הזו', 'Only this layer')}>
          <Icon name="target" size={15} />
        </button>
        <button className={`layer-chev${open ? ' open' : ''}`} onClick={onToggleOpen} aria-label="legend"><Icon name="chevron" size={15} /></button>
      </div>
      {open && <div className="legend"><Legend layer={layer.id} items={items} /></div>}
    </div>
  )
}

function ColorDot({ colorKey, fallback, size = 12 }: { colorKey: string; fallback: string; size?: number }) {
  const color = useLayerStore(s => s.colors[colorKey]) ?? fallback
  return (
    <label className="dot-edit" style={{ background: color, width: size, height: size }} onClick={e => e.stopPropagation()}>
      <input type="color" value={toHex(color)} onChange={e => useLayerStore.getState().setColor(colorKey, e.target.value)} />
    </label>
  )
}

function toHex(c: string) { return /^#[0-9a-f]{6}$/i.test(c) ? c : '#888888' }

function Legend({ layer, items }: { layer: LayerId; items: Annotation[] }) {
  const he = useHe()
  const tr = useTr()
  const colors = useLayerStore(s => s.colors)
  const empty = <div className="legend-empty">{tr('אין עדיין תיוגים', 'No tags yet')}</div>

  switch (layer) {
    case 'melody': {
      const counts = new Map<string, number>()
      items.forEach(a => a.layer === 'melody' && a.noteFunction && counts.set(a.noteFunction, (counts.get(a.noteFunction) ?? 0) + 1))
      return <>{MELODY_FUNCTIONS.map(f => (
        <div key={f.value} className="legend-item">
          <ColorDot colorKey={`melody:${f.value}`} fallback={f.color} />
          <span className="mono">{f.value}</span><span>{he ? f.he : f.en}</span>
          {counts.get(f.value) ? <span className="count">{counts.get(f.value)}</span> : null}
        </div>
      ))}</>
    }
    case 'harmony':
      return <>
        <div className="legend-item"><ColorDot colorKey="harmony:chord" fallback="#2f6fdb" /><span>{tr('סימן אקורד — מעל החמשה', 'Chord symbol — above')}</span></div>
        <div className="legend-item"><ColorDot colorKey="harmony:rn" fallback="#1e40af" /><span>{tr('דרגה ופונקציה — מתחת', 'Degree & function — below')}</span></div>
        <div className="legend-item"><ColorDot colorKey="harmony:cadence" fallback="#b45309" /><span>{tr('קדנצה', 'Cadence')}</span></div>
        <ItemList items={items} />
      </>
    case 'motif': {
      const groups = new Map<string, Annotation[]>()
      items.forEach(a => { if (a.layer !== 'motif') return; const k = a.label; groups.set(k, [...(groups.get(k) ?? []), a]) })
      if (groups.size === 0) return empty
      return <>{[...groups.entries()].sort().map(([label, list]) => (
        <MotifGroup key={label} label={label} list={list} color={motifColor(label, colors)} />
      ))}</>
    }
    case 'form':
      if (!items.length) return empty
      return <>{items.map(a => a.layer === 'form' && (
        <button key={a.id} className="legend-item link" onClick={() => jumpTo(a)}>
          <ColorDot colorKey={`form:${a.midLevel || a.highLevel || a.lowLevel}`} fallback={formColor(a.midLevel || a.highLevel || a.lowLevel || '', colors)} />
          <span>{summarize(a, he)}</span><span className="muted">{a.measureStart}–{measureEnd(a)}</span>
        </button>
      ))}</>
    case 'freehand':
      return <StrokeLegend items={items as FreehandAnnotation[]} />
    case 'color': {
      if (!items.length) return empty
      return <ItemList items={items} />
    }
    default:
      return items.length ? <ItemList items={items} /> : empty
  }
}

function MotifGroup({ label, list, color }: { label: string; list: Annotation[]; color: string }) {
  const [i, setI] = useState(0)
  const tr = useTr()
  return (
    <div className="legend-item motif-group">
      <ColorDot colorKey={`motif:${label}`} fallback={color} />
      <button className="link" onClick={() => { const a = list[i % list.length]; jumpTo(a); setI(i + 1) }} title={tr('קפוץ למופע הבא', 'Jump to next occurrence')}>
        <b>{label}</b> · {list.length} {tr('מופעים', 'occurrences')}
      </button>
      <span className="muted small">{[...new Set(list.map(a => a.layer === 'motif' ? motifTag('', a.variantType).trim() : ''))].filter(Boolean).join(' ')}</span>
    </div>
  )
}

function ItemList({ items }: { items: Annotation[] }) {
  const he = useHe()
  if (!items.length) return null
  return (
    <div className="legend-items">
      {items.slice(0, 60).map(a => (
        <button key={a.id} className="legend-item link" onClick={() => jumpTo(a)}>
          {a.layer === 'color' && <span className="layer-dot" style={{ background: a.color }} />}
          <span className="ellipsis">{summarize(a, he)}</span>
          <span className="muted">{he ? 'ת.' : 'm.'}{a.measureStart}</span>
        </button>
      ))}
      {items.length > 60 && <div className="muted small">+{items.length - 60}</div>}
    </div>
  )
}

/** Vision: every color used in drawings shows up here; give it a meaning and link it to a layer. */
function StrokeLegend({ items }: { items: FreehandAnnotation[] }) {
  const tr = useTr()
  const he = useHe()
  const groups = new Map<string, FreehandAnnotation[]>()
  items.forEach(s => { const k = s.color.toLowerCase(); groups.set(k, [...(groups.get(k) ?? []), s]) })
  if (groups.size === 0) return <div className="legend-empty">{tr('צייר עם העט (או ✎) — הצבעים יופיעו כאן', 'Draw with the pen (or ✎) — colors appear here')}</div>
  const update = (list: FreehandAnnotation[], patch: Partial<FreehandAnnotation>) =>
    useAnnotationStore.getState().updateAnnotations(list.map(s => s.id), patch)
  return <>{[...groups.entries()].map(([color, list]) => (
    <div key={color} className="stroke-legend">
      <div className="legend-item">
        <span className="layer-dot" style={{ background: color }} />
        <input className="inline-input" defaultValue={list[0].label ?? ''} placeholder={tr('מה הצבע מסמן? (אולי מוטיב A?)', 'What does it mean? (maybe motif A?)')}
          onBlur={e => { if ((e.target.value || undefined) !== list[0].label) update(list, { label: e.target.value || undefined }) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        <span className="count">{list.length}</span>
      </div>
      <label className="link-layer">
        <span>{tr('שייך לשכבה', 'Link to layer')}</span>
        <select value={list[0].linkedLayer ?? ''} onChange={e => update(list, { linkedLayer: (e.target.value || undefined) as LayerId | undefined })}>
          <option value="">{tr('— ללא —', '— none —')}</option>
          {LAYERS.filter(l => l.id !== 'freehand').map(l => <option key={l.id} value={l.id}>{he ? l.he : l.en}</option>)}
        </select>
      </label>
    </div>
  ))}</>
}
