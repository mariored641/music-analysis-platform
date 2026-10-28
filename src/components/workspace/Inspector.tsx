import { useMemo } from 'react'
import { useAnnotationStore } from '../../store/annotationStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useLayerStore } from '../../store/layerStore'
import { useUiStore } from '../../store/uiStore'
import { useResearchStore } from '../../store/researchStore'
import { annotationsForSelection, rangeLabel, summarize, visKey } from '../../services/annotationQueries'
import { addDetectedChord, colorSelection, deleteAnnotation } from '../../services/tagActions'
import { detectAllChords } from '../../services/chordDetector'
import { describeElement } from '../../score/registry'
import { LAYERS, LAYER_MAP, MELODY_FUNCTIONS, COLOR_SWATCHES, melodyColor, motifColor, formColor } from '../../constants/layers'
import { CADENCE_TYPES, HARMONIC_FUNCTIONS, MOTIF_VARIANTS, TEXTURE_TYPES } from '../../constants/tags'
import type { Annotation, LayerId } from '../../types/annotation'
import { Icon } from '../common/Icon'
import { NotesPanel } from './NotesPanel'
import { jumpTo } from './LayersPanel'
import { useHe, useTr } from '../../i18n'
import { prettyChord } from '../../score/AnnotationLayer'

export function RightPanel() {
  const tr = useTr()
  const tab = useUiStore(s => s.rightTab)
  const setTab = useUiStore(s => s.setRightTab)
  const noteCount = useResearchCount()
  return (
    <aside className="side-panel right-panel">
      <div className="tabs">
        <button className={tab === 'inspect' ? 'on' : ''} onClick={() => setTab('inspect')}><Icon name="tag" size={15} />{tr('ניתוח', 'Analysis')}</button>
        <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}><Icon name="note" size={15} />{tr('הערות מחקר', 'Research notes')}{noteCount > 0 && <span className="count">{noteCount}</span>}</button>
      </div>
      <div className="panel-scroll">{tab === 'inspect' ? <Inspector /> : <NotesPanel />}</div>
    </aside>
  )
}

function useResearchCount() { return useResearchStore(s => s.notes.length) }

function Inspector() {
  const selection = useSelectionStore(s => s.selection)
  if (!selection) return <Overview />
  return <SelectionInfo />
}

function SelectionInfo() {
  const he = useHe()
  const tr = useTr()
  const selection = useSelectionStore(s => s.selection)!
  const selectedId = useSelectionStore(s => s.selectedAnnotationId)
  const annotations = useAnnotationStore(s => s.annotations)
  const noteMap = useWorkspaceStore(s => s.noteMap)
  const related = useMemo(() => annotationsForSelection(annotations, selection), [annotations, selection])

  if (selection.kind === 'element') {
    return (
      <div className="insp">
        <div className="insp-head">
          <span className="insp-kind">{tr('אלמנט בפרטיטורה', 'Score element')}</span>
          <h4>{describeElement(selection.element.index) || '—'}</h4>
          <span className="muted">{rangeLabel(selection.measureStart, selection.measureEnd, he)}</span>
        </div>
        <div className="insp-section">
          <div className="insp-label">{tr('צביעה', 'Color')}</div>
          <div className="swatches">
            {COLOR_SWATCHES.map(c => <button key={c} className="swatch" style={{ background: c }} onClick={() => colorSelection(c)} />)}
            <button className="chip ghost" onClick={() => colorSelection(null)}>{tr('ללא', 'None')}</button>
          </div>
        </div>
      </div>
    )
  }

  const notes = selection.noteIds.map(id => noteMap?.notes.get(id)).filter(Boolean) as NonNullable<ReturnType<NonNullable<typeof noteMap>['notes']['get']>>[]
  const chords = noteMap && notes.length > 1 ? detectAllChords(selection.noteIds, noteMap).slice(0, 3) : []
  const single = notes.length === 1 ? notes[0] : null

  return (
    <div className="insp">
      <div className="insp-head">
        <span className="insp-kind">
          {selection.wholeMeasures ? tr('תיבות', 'Measures') : single ? tr('תו', 'Note') : tr(`${notes.length} תווים`, `${notes.length} notes`)}
        </span>
        <h4>
          {single ? <>{prettyPitch(single.pitch)} <span className="muted">{tr('פעמה', 'beat')} {fmtBeat(single.beat)}</span></> : rangeLabel(selection.measureStart, selection.measureEnd, he)}
        </h4>
        {single && <span className="muted">{rangeLabel(single.measureNum, single.measureNum, he)} · {single.type}{single.staff > 1 ? ` · ${tr('חמשה', 'staff')} ${single.staff}` : ''}</span>}
      </div>

      {notes.length > 1 && (
        <div className="insp-section">
          <div className="pitch-row">{notes.slice(0, 24).map(n => <span key={n.id} className="pitch">{prettyPitch(n.pitch)}</span>)}{notes.length > 24 && <span className="muted">+{notes.length - 24}</span>}</div>
          {chords.length > 0 && (
            <div className="chord-row">
              <button className="chord-add" onClick={() => addDetectedChord()} title={tr('הוסף כסימן אקורד', 'Add as chord symbol')}>
                <Icon name="plus" size={14} />{prettyChord(chords[0])}
              </button>
              {chords.slice(1).map(c => <span key={c} className="muted mono">{prettyChord(c)}</span>)}
            </div>
          )}
        </div>
      )}

      <div className="insp-section">
        <div className="insp-label">{tr('תיוגים כאן', 'Tags here')}{related.length > 0 && <span className="count">{related.length}</span>}</div>
        {related.length === 0 && (
          <div className="empty-hint">
            {tr('אין תיוגים. השתמש בסרגל שמעל הבחירה, או במקשים:', 'No tags. Use the bar above the selection, or keys:')}
            <div className="kbd-row"><kbd>H</kbd>{tr('אקורד', 'chord')} <kbd>N</kbd>{tr('תפקיד', 'role')} <kbd>M</kbd>{tr('מוטיב', 'motif')} <kbd>F</kbd>{tr('מבנה', 'form')} <kbd>T</kbd>{tr('תווית', 'label')} <kbd>Q</kbd>{tr('שאלה', 'question')}</div>
          </div>
        )}
        {related.map(a => <AnnotationCard key={a.id} a={a} open={a.id === selectedId} />)}
      </div>
    </div>
  )
}

function AnnotationCard({ a, open }: { a: Annotation; open: boolean }) {
  const he = useHe()
  const tr = useTr()
  const colors = useLayerStore(s => s.colors)
  const layer = LAYER_MAP.get(visKey(a))!
  const color = a.layer === 'melody' && a.noteFunction ? melodyColor(a.noteFunction, colors)
    : a.layer === 'motif' ? motifColor(a.label, colors)
    : a.layer === 'form' ? formColor(a.midLevel || a.highLevel || '', colors)
    : a.layer === 'color' ? a.color : layer.color
  return (
    <div className={`ann-card${open ? ' open' : ''}`}>
      <div className="ann-card-head" onClick={() => useSelectionStore.getState().selectAnnotation(open ? null : a.id)}>
        <span className="layer-dot" style={{ background: color }} />
        <span className="ann-card-layer">{he ? layer.he : layer.en}</span>
        <span className="ann-card-text">{summarize(a, he)}</span>
        {a.scriptId && <span className="badge" title={tr('נוצר ע״י סקריפט', 'Created by a script')}><Icon name="sparkle" size={11} /></span>}
        <button className="icon-btn sm" onClick={e => { e.stopPropagation(); deleteAnnotation(a.id) }} title={tr('מחק (Delete)', 'Delete (Del)')}><Icon name="trash" size={14} /></button>
      </div>
      {open && <AnnotationEditor a={a} />}
    </div>
  )
}

function AnnotationEditor({ a }: { a: Annotation }) {
  const he = useHe()
  const tr = useTr()
  const up = (patch: Partial<Annotation>) => useAnnotationStore.getState().updateAnnotation(a.id, { ...patch, scriptId: undefined } as Partial<Annotation>)
  const txt = (label: string, value: string | undefined, key: string, mono = false) => (
    <label className="ed-field">
      <span>{label}</span>
      <input className={mono ? 'mono' : ''} defaultValue={value ?? ''} key={`${a.id}-${key}-${value}`}
        onBlur={e => { const v = e.target.value.trim() || undefined; if (v !== value) up({ [key]: v } as Partial<Annotation>) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
    </label>
  )
  const sel = <T extends string>(label: string, value: T | undefined, key: string, opts: Array<{ value: T; he: string; en: string }>) => (
    <label className="ed-field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={e => up({ [key]: e.target.value || undefined } as Partial<Annotation>)}>
        <option value="">—</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.value === o.en ? o.en : `${o.value} — ${he ? o.he : o.en}`}</option>)}
      </select>
    </label>
  )
  let body: React.ReactNode = null
  switch (a.layer) {
    case 'harmony':
      body = <>
        {!a.xmlChord && txt(tr('אקורד', 'Chord'), a.chordSymbol, 'chordSymbol', true)}
        {txt(tr('דרגה', 'Degree'), a.scaleDegree, 'scaleDegree', true)}
        {sel(tr('פונקציה', 'Function'), a.function, 'function', HARMONIC_FUNCTIONS)}
        {sel(tr('קדנצה', 'Cadence'), a.cadenceType, 'cadenceType', CADENCE_TYPES)}
        {txt(tr('מודולציה ל-', 'Modulates to'), a.modulation, 'modulation')}
        <p className="ed-tip">{tr('גרור את הנקודה הכתומה לתו אחר כדי לשנות את נקודת ההתחלה של האקורד.', 'Drag the orange dot onto another note to move where the chord starts.')}</p>
      </>
      break
    case 'melody':
      body = sel(tr('תפקיד', 'Function'), a.noteFunction, 'noteFunction', MELODY_FUNCTIONS.map(f => ({ value: f.value, he: f.he, en: f.en })))
      break
    case 'motif':
      body = <>{txt(tr('שם', 'Label'), a.label, 'label', true)}{sel(tr('סוג', 'Variant'), a.variantType, 'variantType', MOTIF_VARIANTS)}</>
      break
    case 'form':
      body = <>{txt(tr('חלק', 'Section'), a.midLevel, 'midLevel')}{txt(tr('חלק גדול', 'Large section'), a.highLevel, 'highLevel')}{txt(tr('משפט', 'Phrase'), a.lowLevel, 'lowLevel')}</>
      break
    case 'texture':
      body = sel(tr('מרקם', 'Texture'), a.textureType, 'textureType', TEXTURE_TYPES)
      break
    case 'labels':
      body = <>
        {txt(a.isQuestion ? tr('שאלה', 'Question') : tr('טקסט', 'Text'), a.text, 'text')}
        <label className="ed-check"><input type="checkbox" checked={!!a.isQuestion} onChange={e => up({ isQuestion: e.target.checked || undefined } as Partial<Annotation>)} />{tr('שאלה פתוחה', 'Open question')}</label>
      </>
      break
    case 'color':
      body = <label className="ed-field"><span>{tr('צבע', 'Color')}</span><input type="color" value={a.color} onChange={e => up({ color: e.target.value } as Partial<Annotation>)} /></label>
      break
  }
  return (
    <div className="ann-editor">
      {body}
      <div className="ed-actions">
        <button className="btn-link" onClick={() => jumpTo(a)}>{tr('הצג בפרטיטורה', 'Show in score')}</button>
        {a.visualOffset && <button className="btn-link" onClick={() => up({ visualOffset: undefined })}>{tr('החזר למקום', 'Reset position')}</button>}
      </div>
    </div>
  )
}

function Overview() {
  const he = useHe()
  const tr = useTr()
  const annotations = useAnnotationStore(s => s.annotations)
  const noteMap = useWorkspaceStore(s => s.noteMap)
  const list = Object.values(annotations)
  const counts = new Map<LayerId, number>()
  list.forEach(a => counts.set(visKey(a), (counts.get(visKey(a)) ?? 0) + 1))
  const questions = list.filter(a => a.layer === 'labels' && a.isQuestion).sort((a, b) => a.measureStart - b.measureStart)
  const recent = list.filter(a => a.layer !== 'freehand').sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)
  const md = noteMap?.metadata

  return (
    <div className="insp">
      {md && (
        <div className="facts">
          <div><span>{tr('סולם', 'Key')}</span><b>{md.key}</b></div>
          <div><span>{tr('משקל', 'Time')}</span><b>{md.timeSignature}</b></div>
          <div><span>{tr('תיבות', 'Bars')}</span><b>{md.totalMeasures}</b></div>
          <div><span>{tr('תווים', 'Notes')}</span><b>{noteMap?.notes.size}</b></div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="welcome">
          <h4>{tr('איך מתחילים', 'Getting started')}</h4>
          <ol>
            <li>{tr('לחץ על תו, או גרור כדי לבחור כמה תווים. לחיצה על אזור ריק בתיבה בוחרת את כל התיבה.', 'Click a note, or drag to select several. Click empty space in a bar to select the bar.')}</li>
            <li>{tr('סרגל התיוג מופיע מעל הבחירה — קליק אחד מתייג.', 'The tag bar appears above the selection — one click tags it.')}</li>
            <li>{tr('Shift+חצים מרחיבים את הבחירה, חצים זזים תו-תו.', 'Shift+arrows extend, arrows move note by note.')}</li>
            <li>{tr('רווח מנגן מהבחירה. עט מגע מצייר ישר על הדף.', 'Space plays from the selection. A pen draws right on the page.')}</li>
          </ol>
        </div>
      ) : (
        <div className="insp-section">
          <div className="insp-label">{tr('סיכום הניתוח', 'Analysis summary')}</div>
          <div className="stat-grid">
            {LAYERS.filter(l => counts.get(l.id)).map(l => (
              <div key={l.id} className="stat"><span className="layer-dot" style={{ background: l.color }} /><span>{he ? l.he : l.en}</span><b>{counts.get(l.id)}</b></div>
            ))}
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div className="insp-section">
          <div className="insp-label">{tr('שאלות פתוחות', 'Open questions')}<span className="count">{questions.length}</span></div>
          {questions.map(q => (
            <button key={q.id} className="q-item" onClick={() => jumpTo(q)}>
              <span className="q-mark">?</span><span className="ellipsis">{q.layer === 'labels' ? q.text : ''}</span><span className="muted">{rangeLabel(q.measureStart, q.measureEnd ?? q.measureStart, he)}</span>
            </button>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="insp-section">
          <div className="insp-label">{tr('אחרונים', 'Recent')}</div>
          {recent.map(a => (
            <button key={a.id} className="q-item" onClick={() => jumpTo(a)}>
              <span className="layer-dot" style={{ background: LAYER_MAP.get(visKey(a))?.color }} />
              <span className="ellipsis">{summarize(a, he)}</span>
              <span className="muted">{rangeLabel(a.measureStart, a.measureStart, he)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function prettyPitch(p: string) {
  return p.replace(/^([A-G])##/, '$1𝄪').replace(/^([A-G])bb/, '$1𝄫').replace(/^([A-G])#/, '$1♯').replace(/^([A-G])b/, '$1♭')
}

function fmtBeat(b: number) {
  return Number.isInteger(b) ? String(b) : b.toFixed(2).replace(/0+$/, '')
}
