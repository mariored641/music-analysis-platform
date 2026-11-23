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
  addDetectedChord, addDetectedChords, addForm, addLabel, addMotif, addTexture, anchorNote, colorSelection, harmonyAtAnchor,
  keyAtMeasure, linkSelectionToNewNote, melodyFunctionsOfSelection, motifLabels, nextMotifLabel, printedChordAtNote,
  selectionChordSlots, setHarmony, setHarmonyAt, setMelodyFunction, slotChord, type ChordSlot,
} from '../../services/tagActions'
import { suggestDegree } from '../../services/romanNumeralScript'
import { omittedTones } from '../../services/chordDetector'
import { COLOR_SWATCHES, MELODY_FUNCTIONS, melodyColor, motifColor, formColor, LAYER_MAP } from '../../constants/layers'
import {
  APPLIED_MAJOR, APPLIED_MINOR, CADENCE_TYPES, CHROMATIC_DEGREES, DEFAULT_LABEL_SUGGESTIONS, DEGREE_FIGURES, DEGREES_MAJOR, DEGREES_MINOR,
  FORM_LARGE, FORM_PHRASES, FORM_SECTIONS, HARMONIC_FUNCTIONS, MOTIF_VARIANTS, TEXTURE_TYPES, degreeFigure, withFigure,
} from '../../constants/tags'
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
  const annotations = useAnnotationStore(s => s.annotations) // re-render on changes (active states)
  const colors = useLayerStore(s => s.colors)

  const chords = useMemo(() => {
    if (!selection || selection.kind !== 'notes' || !noteMap || selection.noteIds.length < 2) return []
    return detectAllChords(selection.noteIds, noteMap).slice(0, 4)
  }, [selection, noteMap])
  // Several chord positions selected (tagged, printed or played chords) → the chord tools act on each
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slots = useMemo(() => selectionChordSlots(), [selection, noteMap, annotations])
  const multi = slots.length >= 2
  const untagged = slots.filter(s => !s.ann?.chordSymbol && !s.printed && s.detected).length

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
      y0: Math.min(sys0?.content.y ?? 0, ...(first ?? []).map(n => n.y)) - 40,
      y1: (sys1 ? sys1.content.y + sys1.content.h : 0) + 30,
    }
  }
  const isElement = selection.kind === 'element'
  const toggle = (id: Exclude<QuickSection, null>) => openQuick(section === id ? null : id, quickAt)

  const bar = (
    <FloatingBar anchor={anchor} at={quickAt} scale={scale}>
      {section && <div className="qb-panel">{renderSection(section)}</div>}
      <div className="qb-row">
        {!isElement && multi && untagged > 0 && (
          <button className="qb-chord" onClick={() => addDetectedChords(slots)}
            title={slots.filter(s => !s.ann?.chordSymbol && !s.printed && s.detected).map(s => s.detected).join('  ')}>
            <Icon name="plus" size={14} /> {tr(`${untagged} אקורדים`, `${untagged} chords`)}
          </button>
        )}
        {!isElement && !multi && chords[0] && (
          <button className="qb-chord" onClick={() => addDetectedChord()}
            title={`${tr('הוסף את האקורד המזוהה (Enter)', 'Add detected chord (Enter)')}${omitHint(chords[0], he)}`}>
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
      case 'harmony': return multi ? <ChordSequencePanel slots={slots} /> : <HarmonyPanel chords={chords} />
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

/** " — missing: 5th" for chords suggested with absent chord tones. */
function omitHint(chord: string, he: boolean) {
  const missing = omittedTones(chord)
  if (missing.length === 0) return ''
  const names = missing.map(t => (he ? TONE_HE : TONE_EN)[t] ?? t).join(', ')
  return he ? `\nחסרים בתווים: ${names}` : `\nNot in the notes: ${names}`
}
const TONE_HE: Record<string, string> = { R: 'יסוד', '2': 'סקונדה', '3': 'טרצה', '4': 'קוורטה', '5': 'קווינטה', '6': 'סקסטה', '7': 'ספטימה' }
const TONE_EN: Record<string, string> = { R: 'root', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th', '6': '6th', '7': '7th' }

function HarmonyPanel({ chords }: { chords: string[] }) {
  const tr = useTr()
  const he = useHe()
  const existing = harmonyAtAnchor()
  const anchor = anchorNote()
  const printed = printedChordAtNote(anchor)
  const [chord, setChord] = useState(existing?.chordSymbol ?? printed ?? chords[0] ?? '')
  const [degree, setDegree] = useState(existing?.scaleDegree ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  useEffect(() => { setDegree(existing?.scaleDegree ?? '') }, [existing?.scaleDegree])
  const submit = () => {
    setHarmony({ chordSymbol: chord.trim() || undefined, scaleDegree: degree.trim() || undefined })
    useSelectionStore.getState().openQuick(null)
  }
  const measure = useWorkspaceStore.getState().noteMap?.notes.get(anchor ?? '')?.measureNum ?? 1
  const pickDegree = (d: string | undefined) => { setDegree(d ?? ''); setHarmony({ scaleDegree: d }) }
  return (
    <div className="qb-stack">
      <div className="qb-inputs" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}>
        <input ref={inputRef} value={chord} onChange={e => setChord(e.target.value)} placeholder={tr('אקורד (Cmaj7)', 'Chord (Cmaj7)')} className="mono"
          readOnly={!!(existing?.xmlChord || (!existing && printed))} title={existing?.xmlChord || printed ? tr('האקורד מודפס בפרטיטורה', 'Printed in the score') : undefined} />
        <input value={degree} onChange={e => setDegree(e.target.value)} placeholder={tr('דרגה (ii, V7/V)', 'Degree (ii, V7/V)')} className="mono short" />
        <button className="btn primary sm" onClick={submit}>{tr('הוסף', 'Add')} ↵</button>
      </div>
      {chords.length > 1 && !printed && (
        <div className="qb-chips small">
          <span className="qb-hint">{tr('אפשרויות', 'Options')}</span>
          {chords.map(c => <button key={c} className="chip ghost mono" title={omitHint(c, he).trim() || undefined} onClick={() => setChord(c)}>{prettyChord(c)}</button>)}
        </div>
      )}
      <DegreePad current={existing?.scaleDegree} measure={measure} chord={chord.trim() || null} onPick={pickDegree} />
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

/**
 * One-click roman numerals: diatonic degrees (major/minor from the key signature), applied
 * dominants, chromatic chords and inversion figures. The degree suggested from the chord
 * symbol is offered first. Clicking the current degree removes it.
 */
function DegreePad({ current, measure, chord, onPick, figureOf = current, onFigure = onPick }: {
  current?: string; measure: number; chord: string | null; onPick: (d: string | undefined) => void
  /** degree the figure buttons edit (defaults to `current`) */
  figureOf?: string; onFigure?: (d: string | undefined) => void
}) {
  const he = useHe()
  const tr = useTr()
  const key = keyAtMeasure(measure)
  const suggested = chord ? suggestDegree(chord, key) : null
  const minor = key.mode === 'minor'
  const base = current ? current.replace(/(65|64|43|42|7|6|2)(?=\/|$)/, '') : ''
  const fig = current ? degreeFigure(current) : ''
  const targetFig = figureOf ? degreeFigure(figureOf) : ''
  const btn = (o: { value: string; he: string; en: string }, cls = '') => (
    <button key={o.value} className={`chip mono${cls}${current === o.value || (base === o.value && fig) ? ' on' : ''}`} title={he ? o.he : o.en}
      onClick={() => onPick(current === o.value ? undefined : o.value)}>{o.value}</button>
  )
  return (
    <div className="qb-degrees">
      <div className="qb-chips small">
        <span className="qb-hint">{tr('דרגה', 'Degree')}</span>
        {suggested && btn({ value: suggested, he: `מוצע לפי ${chord}`, en: `Suggested from ${chord}` }, ' suggest')}
        {(minor ? DEGREES_MINOR : DEGREES_MAJOR).map(o => btn(o))}
      </div>
      <div className="qb-chips small">
        <span className="qb-hint">{tr('משני', 'Applied')}</span>
        {(minor ? APPLIED_MINOR : APPLIED_MAJOR).map(o => btn(o))}
        <span className="qb-sep" />
        {CHROMATIC_DEGREES.map(o => btn(o, ' ghost'))}
      </div>
      <div className="qb-chips small">
        <span className="qb-hint">{tr('היפוך', 'Figure')}</span>
        {DEGREE_FIGURES.map(f => (
          <button key={f.value} className={`chip ghost mono${targetFig === f.value ? ' on' : ''}`} title={he ? f.he : f.en} disabled={!figureOf}
            onClick={() => figureOf && onFigure(withFigure(figureOf, f.value) || undefined)}>{f.value}</button>
        ))}
      </div>
    </div>
  )
}

/**
 * Several chords selected: a strip of the chord positions (one is "current"). Degree buttons
 * fill the current chord and move on to the next, so ii → V → I tags a progression in three
 * clicks. A typed sequence ("ii V I") fills them in order; a cadence goes on the last chord.
 */
function ChordSequencePanel({ slots }: { slots: ChordSlot[] }) {
  const tr = useTr()
  const he = useHe()
  const [focus, setFocus] = useState(0)
  const [lastSet, setLastSet] = useState<number | null>(null)
  const [degrees, setDegrees] = useState('')
  const [symbols, setSymbols] = useState('')
  const i = Math.min(focus, slots.length - 1)
  const cur = slots[i]
  const last = slots[slots.length - 1]
  const anchorsFrom = (k: number) => slots.slice(k).map(s => s.anchorId)
  const tokens = (v: string) => v.trim().split(/[\s,|]+/).filter(Boolean)

  // Figures (7, 6, 65…) go on the current chord — or, right after a degree moved focus on, on the chord just tagged
  const figTarget = !cur.ann?.scaleDegree && lastSet !== null && slots[lastSet]?.ann?.scaleDegree ? lastSet : i
  const pick = (d: string | undefined) => {
    setHarmonyAt([cur.anchorId], { scaleDegree: d })
    setLastSet(d ? i : null)
    // a new degree moves on to the next chord; changing a figure / removing stays put
    if (d && (!cur.ann?.scaleDegree || withoutFigure(cur.ann.scaleDegree) !== withoutFigure(d))) setFocus(Math.min(i + 1, slots.length - 1))
  }
  const pickFigure = (d: string | undefined) => {
    if (figTarget === i) { pick(d); return }
    setHarmonyAt([slots[figTarget].anchorId], { scaleDegree: d })
  }
  const fill = (field: 'scaleDegree' | 'chordSymbol', v: string) => {
    const t = tokens(v)
    if (t.length === 0) return
    setHarmonyAt(anchorsFrom(i), k => (t[k] ? { [field]: t[k] } : null))
    setFocus(Math.min(i + t.length, slots.length - 1))
  }

  return (
    <div className="qb-stack">
      <div className="qb-slots">
        {slots.map((s, k) => {
          const chord = slotChord(s)
          const guessed = !s.ann?.chordSymbol && !s.printed
          return (
            <button key={s.key} className={`qb-slot${k === i ? ' on' : ''}`} onClick={() => { setFocus(k); setLastSet(null) }}
              title={`${tr('תיבה', 'Bar')} ${s.measure} · ${tr('פעמה', 'beat')} ${+s.beat.toFixed(2)}${chord ? omitHint(chord, he) : ''}`}>
              <span className={`qb-slot-chord${guessed ? ' guessed' : ''}`}>{chord ? prettyChord(chord) : '·'}{guessed && chord ? '?' : ''}</span>
              <span className="qb-slot-deg">{s.ann?.scaleDegree ?? '—'}{s.ann?.cadenceType ? ` ${s.ann.cadenceType}` : ''}</span>
            </button>
          )
        })}
      </div>
      <DegreePad current={cur.ann?.scaleDegree} measure={cur.measure} chord={slotChord(cur)} onPick={pick}
        figureOf={slots[figTarget].ann?.scaleDegree} onFigure={pickFigure} />
      <div className="qb-chips small">
        {HARMONIC_FUNCTIONS.map(f => (
          <button key={f.value} className={`chip${cur.ann?.function === f.value ? ' on' : ''}`} title={he ? f.he : f.en}
            onClick={() => setHarmonyAt([cur.anchorId], { function: cur.ann?.function === f.value ? undefined : f.value })}>{f.value}</button>
        ))}
        <span className="qb-sep" />
        <span className="qb-hint">{tr('קדנצה (באקורד האחרון)', 'Cadence (on the last chord)')}</span>
        {CADENCE_TYPES.map(c => (
          <button key={c.value} className={`chip${last.ann?.cadenceType === c.value ? ' on' : ''}`} title={he ? c.he : c.en}
            onClick={() => setHarmonyAt([last.anchorId], { cadenceType: last.ann?.cadenceType === c.value ? undefined : c.value })}>{c.value}</button>
        ))}
      </div>
      <div className="qb-inputs">
        <input value={degrees} onChange={e => setDegrees(e.target.value)} className="mono" placeholder={tr('דרגות ברצף: ii V I', 'Degrees in order: ii V I')}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fill('scaleDegree', degrees); setDegrees('') } }} />
        <input value={symbols} onChange={e => setSymbols(e.target.value)} className="mono" placeholder={tr('אקורדים ברצף: Dm7 G7 C', 'Chords in order: Dm7 G7 C')}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fill('chordSymbol', symbols); setSymbols('') } }} />
      </div>
      <div className="qb-chips small">
        <span className="qb-hint">{tr('כל הרצף', 'Whole progression')}</span>
        <button className="chip" onClick={() => { addLabel(tr('סקוונצה', 'Sequence')); useSelectionStore.getState().openQuick(null) }}>{tr('סקוונצה', 'Sequence')}</button>
        <button className="chip" onClick={() => { addLabel(tr('מעגל קווינטות', 'Circle of fifths')); useSelectionStore.getState().openQuick(null) }}>{tr('מעגל קווינטות', 'Circle of fifths')}</button>
        <button className="chip ghost" onClick={() => useSelectionStore.getState().openQuick('labels')}>{tr('תווית אחרת…', 'Other label…')}</button>
      </div>
    </div>
  )
}

const withoutFigure = (d: string) => d.replace(/(65|64|43|42|7|6|2)(?=\/|$)/, '')

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
