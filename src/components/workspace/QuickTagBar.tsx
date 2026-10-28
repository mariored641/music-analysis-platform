import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSelectionStore, type QuickSection } from '../../store/selectionStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useAnnotationStore, getLabelHistory } from '../../store/annotationStore'
import { useLayerStore } from '../../store/layerStore'
import { notesBySystem } from '../../score/geometry'
import { registry } from '../../score/registry'
import { detectAllChords } from '../../services/chordDetector'
import {
  addDetectedChord, addForm, addLabel, addMotif, addTexture, colorSelection, harmonyAtAnchor,
  linkSelectionToNewNote, melodyFunctionsOfSelection, motifLabels, nextMotifLabel, setHarmony, setMelodyFunction,
} from '../../services/tagActions'
import { COLOR_SWATCHES, MELODY_FUNCTIONS, melodyColor, motifColor, formColor, LAYER_MAP } from '../../constants/layers'
import { CADENCE_TYPES, DEFAULT_LABEL_SUGGESTIONS, FORM_LARGE, FORM_PHRASES, FORM_SECTIONS, HARMONIC_FUNCTIONS, MOTIF_VARIANTS, TEXTURE_TYPES } from '../../constants/tags'
import type { MotifVariant } from '../../types/annotation'
import { Icon } from '../common/Icon'
import { useHe, useTr } from '../../i18n'
import { prettyChord } from '../../score/AnnotationLayer'

const SECTIONS: Array<{ id: Exclude<QuickSection, null>; he: string; en: string; key: string; layer: string }> = [
  { id: 'harmony', he: 'אקורד', en: 'Chord', key: 'H', layer: 'harmony' },
  { id: 'melody', he: 'תפקיד', en: 'Role', key: 'N', layer: 'melody' },
  { id: 'motif', he: 'מוטיב', en: 'Motif', key: 'M', layer: 'motif' },
  { id: 'form', he: 'מבנה', en: 'Form', key: 'F', layer: 'form' },
  { id: 'labels', he: 'תווית', en: 'Label', key: 'T', layer: 'labels' },
  { id: 'questions', he: 'שאלה', en: 'Question', key: 'Q', layer: 'questions' },
  { id: 'color', he: 'צבע', en: 'Color', key: 'K', layer: 'color' },
]

export function QuickTagBar({ scale, hidden }: { scale: number; hidden: boolean }) {
  const he = useHe()
  const tr = useTr()
  const selection = useSelectionStore(s => s.selection)
  const section = useSelectionStore(s => s.quickSection)
  const quickAt = useSelectionStore(s => s.quickAt)
  const openQuick = useSelectionStore(s => s.openQuick)
  const g = useWorkspaceStore(s => s.geometry)
  const noteMap = useWorkspaceStore(s => s.noteMap)
  useAnnotationStore(s => s.annotations) // re-render on changes (active states)
  const colors = useLayerStore(s => s.colors)

  const chords = useMemo(() => {
    if (!selection || selection.kind !== 'notes' || !noteMap || selection.noteIds.length < 2) return []
    return detectAllChords(selection.noteIds, noteMap).slice(0, 4)
  }, [selection, noteMap])

  if (!selection || !g || hidden) return null

  // anchor rect of the selection, page units
  let anchor = { x0: 0, x1: 0, y0: 0, y1: 0 }
  if (selection.kind === 'element') {
    const r = registry.colorableRects[selection.element.index]
    if (r) anchor = { x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h }
  } else {
    const groups = notesBySystem(g, selection.noteIds)
    const first = groups[0], last = groups[groups.length - 1]
    const sys0 = g.systems[first?.[0]?.system ?? g.measures[selection.measureStart - 1]?.system ?? 0]
    const sys1 = g.systems[last?.[0]?.system ?? g.measures[selection.measureEnd - 1]?.system ?? 0]
    anchor = {
      x0: first?.[0]?.x ?? g.measures[selection.measureStart - 1]?.x ?? 0,
      x1: first ? first[first.length - 1].x + 12 : (g.measures[selection.measureStart - 1]?.x ?? 0) + 40,
      y0: Math.min(sys0?.y ?? 0, ...(first ?? []).map(n => n.y)) - 34,
      y1: (sys1?.y ?? 0) + (sys1?.h ?? 0) + 30,
    }
  }
  const isElement = selection.kind === 'element'
  const toggle = (id: Exclude<QuickSection, null>) => openQuick(section === id ? null : id, quickAt)

  const bar = (
    <FloatingBar anchor={anchor} at={quickAt} scale={scale}>
      {section && <div className="qb-panel">{renderSection(section)}</div>}
      <div className="qb-row">
        {!isElement && chords[0] && (
          <button className="qb-chord" onClick={() => addDetectedChord()} title={tr('הוסף את האקורד המזוהה (Enter)', 'Add detected chord (Enter)')}>
            <Icon name="plus" size={14} /> {prettyChord(chords[0])}
          </button>
        )}
        {SECTIONS.filter(s => !isElement || s.id === 'color').map(s => (
          <button key={s.id} className={`qb-cat${section === s.id ? ' active' : ''}`} onClick={() => toggle(s.id)}
            title={`${he ? s.he : s.en} (${s.key})`} style={{ ['--cat' as string]: LAYER_MAP.get(s.layer as any)?.color }}>
            <span className="qb-dot" />{he ? s.he : s.en}<kbd>{s.key}</kbd>
          </button>
        ))}
        {!isElement && (
          <button className="qb-cat" onClick={linkSelectionToNewNote} title={tr('כתוב הערה מקושרת לבחירה', 'Write a note linked to the selection')}>
            <Icon name="note" size={14} />{tr('הערה', 'Note')}
          </button>
        )}
        <button className="qb-x" onClick={() => useSelectionStore.getState().clear()} title={tr('ביטול בחירה (Esc)', 'Clear selection (Esc)')}><Icon name="close" size={14} /></button>
      </div>
    </FloatingBar>
  )

  return bar

  function renderSection(sec: Exclude<QuickSection, null>) {
    switch (sec) {
      case 'harmony': return <HarmonyPanel chords={chords} />
      case 'melody': return (
        <div className="qb-chips">
          {MELODY_FUNCTIONS.map((f, i) => {
            const active = melodyFunctionsOfSelection().has(f.value)
            return (
              <button key={f.value} className={`chip${active ? ' on' : ''}`} style={{ ['--c' as string]: melodyColor(f.value, colors) }}
                onClick={() => setMelodyFunction(f.value)} title={he ? f.he : f.en}>
                <span className="dot" />{f.value}<small>{he ? f.he : f.en}</small><kbd>{i + 1}</kbd>
              </button>
            )
          })}
        </div>
      )
      case 'motif': return <MotifPanel />
      case 'form': return (
        <div className="qb-stack">
          <div className="qb-chips">
            {FORM_SECTIONS.map(l => <button key={l} className="chip" style={{ ['--c' as string]: formColor(l, colors) }} onClick={() => { addForm(l); openQuick(null) }}><span className="dot" />{l}</button>)}
          </div>
          <div className="qb-chips small">
            {FORM_LARGE.map(l => <button key={l} className="chip" onClick={() => { addForm(l, 'highLevel'); openQuick(null) }}>{l}</button>)}
            {FORM_PHRASES.map(l => <button key={l} className="chip ghost" onClick={() => { addForm(l, 'lowLevel'); openQuick(null) }}>{l}</button>)}
          </div>
          <div className="qb-chips small">
            <span className="qb-hint">{tr('מרקם', 'Texture')}</span>
            {TEXTURE_TYPES.map(t => <button key={t.value} className="chip ghost" onClick={() => { addTexture(t.value); openQuick(null) }}>{he ? t.he : t.en}</button>)}
          </div>
          <TextEntry placeholder={tr('שם חלק אחר…', 'Other section name…')} onSubmit={v => { addForm(v); openQuick(null) }} />
        </div>
      )
      case 'labels': return <LabelPanel />
      case 'questions': return <TextEntry autoFocus placeholder={tr('מה לא ברור כאן?', 'What is unclear here?')} onSubmit={v => { addLabel(v, true); openQuick(null) }} />
      case 'color': return (
        <div className="qb-chips">
          {COLOR_SWATCHES.map(c => <button key={c} className="swatch" style={{ background: c }} onClick={() => colorSelection(c)} aria-label={c} />)}
          <label className="swatch custom" title={tr('צבע אחר', 'Custom color')}>
            <input type="color" onChange={e => colorSelection(e.target.value)} />
          </label>
          <button className="chip ghost" onClick={() => colorSelection(null)}>{tr('ללא צבע', 'No color')}</button>
        </div>
      )
    }
  }
}

/**
 * Positions the bar in viewport coordinates: above the selection when there is
 * room, otherwise below it; clamped to the visible score area. Follows scrolling.
 */
function FloatingBar({ anchor, at, scale, children }: { anchor: { x0: number; x1: number; y0: number; y1: number }; at: { x: number; y: number } | null; scale: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPosRaw] = useState<{ left: number; top: number; below: boolean } | null>(null)
  const setPos = (n: { left: number; top: number; below: boolean }) =>
    setPosRaw(p => (p && Math.abs(p.left - n.left) < 0.5 && Math.abs(p.top - n.top) < 0.5 && p.below === n.below ? p : n))
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const scroller = document.querySelector('.score-scroll')
    const bump = () => setTick(t => t + 1)
    scroller?.addEventListener('scroll', bump, { passive: true })
    window.addEventListener('resize', bump)
    return () => { scroller?.removeEventListener('scroll', bump); window.removeEventListener('resize', bump) }
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    const page = document.querySelector('.score-page')
    const area = document.querySelector('.ws-score')
    if (!el || !page || !area) return
    const pr = page.getBoundingClientRect()
    const ar = area.getBoundingClientRect()
    const w = el.offsetWidth, h = el.offsetHeight
    if (at) {
      setPos({ left: Math.max(ar.left + 8, Math.min(at.x, ar.right - w - 8)), top: Math.max(ar.top + 8, Math.min(at.y, ar.bottom - h - 8)), below: true })
      return
    }
    const ax = pr.left + anchor.x0 * scale
    const aTop = pr.top + anchor.y0 * scale
    const aBottom = pr.top + anchor.y1 * scale
    const below = aTop - h - 6 < ar.top + 6 && aBottom + h + 6 < ar.bottom
    let top = below ? aBottom + 6 : aTop - h - 6
    top = Math.max(ar.top + 6, Math.min(top, ar.bottom - h - 6))
    const left = Math.max(ar.left + 8, Math.min(ax - 12, ar.right - w - 12))
    setPos({ left, top, below })
  })
  void tick

  return createPortal(
    <div ref={ref} className={`quickbar${pos?.below ? ' below' : ''}`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      onPointerDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
      {children}
    </div>,
    document.body,
  )
}

function HarmonyPanel({ chords }: { chords: string[] }) {
  const tr = useTr()
  const he = useHe()
  const existing = harmonyAtAnchor()
  const [chord, setChord] = useState(existing?.chordSymbol ?? chords[0] ?? '')
  const [degree, setDegree] = useState(existing?.scaleDegree ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  const submit = () => {
    setHarmony({ chordSymbol: chord.trim() || undefined, scaleDegree: degree.trim() || undefined })
    useSelectionStore.getState().openQuick(null)
  }
  return (
    <div className="qb-stack">
      <div className="qb-inputs" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}>
        <input ref={inputRef} value={chord} onChange={e => setChord(e.target.value)} placeholder={tr('אקורד (Cmaj7)', 'Chord (Cmaj7)')} className="mono" />
        <input value={degree} onChange={e => setDegree(e.target.value)} placeholder={tr('דרגה (ii, V7/V)', 'Degree (ii, V7/V)')} className="mono short" />
        <button className="btn primary sm" onClick={submit}>{tr('הוסף', 'Add')} ↵</button>
      </div>
      {chords.length > 1 && (
        <div className="qb-chips small">
          <span className="qb-hint">{tr('אפשרויות', 'Options')}</span>
          {chords.map(c => <button key={c} className="chip ghost mono" onClick={() => setChord(c)}>{prettyChord(c)}</button>)}
        </div>
      )}
      <div className="qb-chips small">
        {HARMONIC_FUNCTIONS.map(f => (
          <button key={f.value} className={`chip${existing?.function === f.value ? ' on' : ''}`} title={he ? f.he : f.en}
            onClick={() => setHarmony({ function: existing?.function === f.value ? undefined : f.value })}>{f.value}</button>
        ))}
        <span className="qb-sep" />
        {CADENCE_TYPES.map(c => (
          <button key={c.value} className={`chip${existing?.cadenceType === c.value ? ' on' : ''}`} title={he ? c.he : c.en}
            onClick={() => setHarmony({ cadenceType: existing?.cadenceType === c.value ? undefined : c.value })}>{c.value}</button>
        ))}
      </div>
    </div>
  )
}

function MotifPanel() {
  const he = useHe()
  const tr = useTr()
  const colors = useLayerStore(s => s.colors)
  const [variant, setVariant] = useState<MotifVariant>('original')
  const labels = motifLabels()
  const next = nextMotifLabel()
  const apply = (l: string) => { addMotif(l, variant); useSelectionStore.getState().openQuick(null) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const n = parseInt(e.key)
      if (n >= 1 && n <= labels.length) { e.preventDefault(); e.stopPropagation(); apply(labels[n - 1]) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })
  return (
    <div className="qb-stack">
      <div className="qb-chips">
        {labels.map((l, i) => (
          <button key={l} className="chip strong" style={{ ['--c' as string]: motifColor(l, colors) }} onClick={() => apply(l)}>
            <span className="dot" />{l}<kbd>{i + 1}</kbd>
          </button>
        ))}
        <button className="chip dashed" style={{ ['--c' as string]: motifColor(next, colors) }} onClick={() => apply(next)}>
          <Icon name="plus" size={13} />{tr(`מוטיב חדש ${next}`, `New motif ${next}`)}
        </button>
      </div>
      <div className="qb-chips small">
        {MOTIF_VARIANTS.map(v => (
          <button key={v.value} className={`chip ghost${variant === v.value ? ' on' : ''}`} onClick={() => setVariant(v.value)}>{he ? v.he : v.en}</button>
        ))}
      </div>
    </div>
  )
}

function LabelPanel() {
  const tr = useTr()
  const recent = [...new Set([...getLabelHistory(), ...DEFAULT_LABEL_SUGGESTIONS])].slice(0, 8)
  return (
    <div className="qb-stack">
      <TextEntry autoFocus placeholder={tr('תווית (Enclosure, ארפג׳…)', 'Label (enclosure, arpeggio…)')} suggestions={[...getLabelHistory(), ...DEFAULT_LABEL_SUGGESTIONS]}
        onSubmit={v => { addLabel(v); useSelectionStore.getState().openQuick(null) }} />
      <div className="qb-chips small">
        {recent.map(l => <button key={l} className="chip ghost" onClick={() => { addLabel(l); useSelectionStore.getState().openQuick(null) }}>{l}</button>)}
      </div>
    </div>
  )
}

function TextEntry({ placeholder, onSubmit, autoFocus, suggestions }: { placeholder: string; onSubmit: (v: string) => void; autoFocus?: boolean; suggestions?: string[] }) {
  const [v, setV] = useState('')
  const tr = useTr()
  const listId = useMemo(() => `sugg-${Math.random().toString(36).slice(2, 7)}`, [])
  return (
    <form className="qb-inputs" onSubmit={e => { e.preventDefault(); if (v.trim()) onSubmit(v.trim()) }}>
      <input autoFocus={autoFocus} value={v} onChange={e => setV(e.target.value)} placeholder={placeholder} list={suggestions ? listId : undefined} />
      {suggestions && <datalist id={listId}>{[...new Set(suggestions)].map(s => <option key={s} value={s} />)}</datalist>}
      <button className="btn primary sm" type="submit" disabled={!v.trim()}>{tr('הוסף', 'Add')} ↵</button>
    </form>
  )
}
