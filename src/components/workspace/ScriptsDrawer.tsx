import { useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useLayerStore } from '../../store/layerStore'
import { runMelodyColorScript, SCRIPT_ID as MELODY_ID } from '../../services/melodyColorScript'
import { runMotifScript, SCRIPT_ID as MOTIF_ID, type MotifTransformation } from '../../services/motifScript'
import { runRomanNumeralScript, SCRIPT_ID as RN_ID } from '../../services/romanNumeralScript'
import { addMotif, nextMotifLabel } from '../../services/tagActions'
import type { Annotation, HarmonyAnnotation, MotifAnnotation } from '../../types/annotation'
import { Icon } from '../common/Icon'
import { useTr } from '../../i18n'

type Result = { ok: boolean; text: string }

export function ScriptsDrawer() {
  const tr = useTr()
  const open = useUiStore(s => s.scriptsOpen)
  const annotations = useAnnotationStore(s => s.annotations)
  const xmlHarmonies = useWorkspaceStore(s => s.xmlHarmonies)
  const selection = useSelectionStore(s => s.selection)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [threshold, setThreshold] = useState(80)
  const [transforms, setTransforms] = useState<MotifTransformation[]>(['EXACT', 'INVERSION', 'RETROGRADE'])

  if (!open) return null
  const close = () => useUiStore.getState().setScriptsOpen(false)

  const list = Object.values(annotations)
  const userChords = list.filter(a => a.layer === 'harmony' && a.chordSymbol && !a.scriptId).length
  const chordCount = userChords + xmlHarmonies.length
  const seeds = list.filter((a): a is MotifAnnotation => a.layer === 'motif' && !a.scriptId)
  const seedLabels = [...new Set(seeds.map(s => s.label))]
  const hasRun = (id: string) => list.some(a => a.scriptId === id)
  const selNotes = selection?.kind === 'notes' ? selection.noteIds.length : 0

  const setResult = (id: string, r: Result) => setResults(s => ({ ...s, [id]: r }))

  /** Remove a script's previous output (RN: also reset fields it wrote into user chords). */
  const clearDraft = (id: string, draft: Record<string, Annotation>) => {
    for (const a of Object.values(draft)) {
      if (a.scriptId !== id) continue
      if (id === RN_ID && a.layer === 'harmony' && !a.id.startsWith('rn-')) draft[a.id] = { ...a, scaleDegree: undefined, function: undefined, scriptId: undefined }
      else delete draft[a.id]
    }
  }

  const clear = (id: string) => {
    useAnnotationStore.getState().transact(d => clearDraft(id, d))
    setResult(id, { ok: true, text: tr('התוצאות נוקו', 'Results cleared') })
  }

  const runMelody = () => {
    const { noteMap, xml } = useWorkspaceStore.getState()
    if (!noteMap) return
    const harm = list.filter((a): a is HarmonyAnnotation => a.layer === 'harmony' && !a.xmlChord)
    const { annotations: out, error } = runMelodyColorScript(noteMap, harm, xml)
    if (error) { setResult(MELODY_ID, { ok: false, text: tr('אין אקורדים. הוסף סימני אקורד (H) או הרץ "ספרות רומיות" כדי למצוא אקורדים.', 'No chords. Add chord symbols (H) or run "Roman numerals" to find chords.') }); return }
    const manual = new Set(list.filter(a => a.layer === 'melody' && !a.scriptId).flatMap(a => a.noteIds ?? []))
    const fresh = out.filter(a => !a.noteIds?.some(id => manual.has(id)))
    useAnnotationStore.getState().transact(d => { clearDraft(MELODY_ID, d); fresh.forEach(a => { d[a.id] = a }) })
    useLayerStore.getState().setVisible('melody', true)
    const by = (fn: string) => fresh.filter(a => a.noteFunction === fn).length
    setResult(MELODY_ID, { ok: true, text: tr(`נצבעו ${fresh.length} תווים — CT ${by('CT')} · PT ${by('PT')} · NT ${by('NT')}`, `Colored ${fresh.length} notes — CT ${by('CT')} · PT ${by('PT')} · NT ${by('NT')}`) })
  }

  const runMotifs = () => {
    const { noteMap } = useWorkspaceStore.getState()
    if (!noteMap) return
    if (seeds.length === 0 && selNotes >= 2) addMotif(nextMotifLabel())
    const all = useAnnotationStore.getState().annotations
    const { annotations: out, error, found } = runMotifScript(noteMap, all, { threshold: threshold / 100, transformations: transforms })
    if (error) { setResult(MOTIF_ID, { ok: false, text: tr('סמן קודם מוטיב: בחר תווים ← M ← מוטיב חדש (או בחר תווים ולחץ כאן).', 'Tag a motif first: select notes → M → new motif (or select notes and run).') }); return }
    useAnnotationStore.getState().transact(d => { clearDraft(MOTIF_ID, d); out.forEach(a => { d[a.id] = a }) })
    useLayerStore.getState().setVisible('motif', true)
    const summary = Object.entries(found).map(([l, n]) => `${l}: ${n}`).join(' · ')
    setResult(MOTIF_ID, { ok: true, text: tr(`נמצאו מופעים — ${summary || 'אין'}`, `Occurrences — ${summary || 'none'}`) })
  }

  const runRN = () => {
    const { noteMap, xml } = useWorkspaceStore.getState()
    if (!noteMap || !xml) return
    const harm = list.filter((a): a is HarmonyAnnotation => a.layer === 'harmony' && a.scriptId !== RN_ID)
    const res = runRomanNumeralScript(noteMap, harm, xml)
    if (res.error) { setResult(RN_ID, { ok: false, text: tr('לא נמצאו אקורדים לניתוח.', 'No chords found to analyze.') }); return }
    useAnnotationStore.getState().transact(d => {
      clearDraft(RN_ID, d)
      for (const a of res.annotations) {
        if (res.mode === 'update') { if (d[a.id]) d[a.id] = { ...d[a.id], scaleDegree: a.scaleDegree, function: a.function, scriptId: RN_ID } as Annotation }
        else d[a.id] = a
      }
    })
    useLayerStore.getState().setVisible('harmony', true)
    setResult(RN_ID, { ok: true, text: tr(`נותחו ${res.count} אקורדים`, `Analyzed ${res.count} chords`) })
  }

  const T: Array<{ v: MotifTransformation; he: string; en: string }> = [
    { v: 'EXACT', he: 'זהה (טרנספוזיציה)', en: 'Exact (transposed)' },
    { v: 'INVERSION', he: 'היפוך', en: 'Inversion' },
    { v: 'RETROGRADE', he: 'נסיגה', en: 'Retrograde' },
    { v: 'AUGMENTATION', he: 'הגדלה', en: 'Augmentation' },
    { v: 'DIMINUTION', he: 'הקטנה', en: 'Diminution' },
  ]

  return (
    <div className="drawer-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) close() }}>
      <aside className="drawer">
        <div className="drawer-head">
          <h2><Icon name="flask" />{tr('סקריפטים לניתוח', 'Analysis scripts')}</h2>
          <button className="icon-btn" onClick={close}><Icon name="close" /></button>
        </div>
        <p className="drawer-intro">{tr('הסקריפטים כותבים לשכבות הרגילות (מסומנים ✦). אפשר להריץ שוב בכל רגע — התוצאות הקודמות מוחלפות, ותיוגים ידניים לא נדרסים. Ctrl+Z מבטל.', 'Scripts write to the normal layers (marked ✦). Re-run any time — old results are replaced, manual tags are never overwritten. Ctrl+Z undoes.')}</p>

        <ScriptCard title={tr('תפקידים מלודיים', 'Melodic roles')}
          desc={tr('צובע כל תו בקו המלודי: צליל אקורד (CT), מעבר (PT), שכן (NT) — לפי האקורדים ביצירה.', 'Colors each melody note: chord tone, passing, neighbor — from the chords in the piece.')}
          req={chordCount > 0 ? { ok: true, text: tr(`${chordCount} אקורדים זמינים`, `${chordCount} chords available`) } : { ok: false, text: tr('דורש אקורדים', 'Needs chords') }}
          onRun={runMelody} onClear={hasRun(MELODY_ID) ? () => clear(MELODY_ID) : undefined} result={results[MELODY_ID]} />

        <ScriptCard title={tr('זיהוי מוטיבים', 'Motif finder')}
          desc={tr('מוצא את כל המופעים של המוטיבים שסימנת — כולל טרנספוזיציה, היפוך ונסיגה.', 'Finds every occurrence of the motifs you tagged — transposed, inverted, retrograde.')}
          req={seeds.length ? { ok: true, text: tr(`מוטיבים: ${seedLabels.join(', ')}`, `Motifs: ${seedLabels.join(', ')}`) }
            : selNotes >= 2 ? { ok: true, text: tr(`הבחירה (${selNotes} תווים) תהפוך למוטיב ${nextMotifLabel()}`, `The selection (${selNotes} notes) becomes motif ${nextMotifLabel()}`) }
            : { ok: false, text: tr('סמן מוטיב או בחר תווים', 'Tag a motif or select notes') }}
          onRun={runMotifs} onClear={hasRun(MOTIF_ID) ? () => clear(MOTIF_ID) : undefined} result={results[MOTIF_ID]}>
          <label className="sc-opt">
            <span>{tr('סף התאמה', 'Match threshold')}</span>
            <input type="range" min={60} max={100} step={10} value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
            <b>{threshold}%</b>
          </label>
          <div className="sc-checks">
            {T.map(t => (
              <label key={t.v}><input type="checkbox" checked={transforms.includes(t.v)}
                onChange={e => setTransforms(s => e.target.checked ? [...s, t.v] : s.filter(x => x !== t.v))} />{tr(t.he, t.en)}</label>
            ))}
          </div>
        </ScriptCard>

        <ScriptCard title={tr('ספרות רומיות', 'Roman numerals')}
          desc={tr('מוסיף דרגה ופונקציה (T/S/D) לכל אקורד. אם אין אקורדים ביצירה — מזהה אותם אוטומטית מכל החמשות.', 'Adds degree and function (T/S/D) to each chord. If the piece has no chords, detects them from all staves.')}
          req={{ ok: true, text: chordCount > 0 ? tr(`${chordCount} אקורדים`, `${chordCount} chords`) : tr('יזהה אקורדים אוטומטית', 'Will detect chords') }}
          onRun={runRN} onClear={hasRun(RN_ID) ? () => clear(RN_ID) : undefined} result={results[RN_ID]} />
      </aside>
    </div>
  )
}

function ScriptCard({ title, desc, req, onRun, onClear, result, children }: {
  title: string; desc: string; req: Result; onRun: () => void; onClear?: () => void; result?: Result; children?: React.ReactNode
}) {
  const tr = useTr()
  return (
    <section className="script-card">
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className={`sc-req ${req.ok ? 'ok' : 'no'}`}>{req.ok ? '✓' : '!'} {req.text}</div>
      {children}
      <div className="sc-actions">
        <button className="btn primary" onClick={onRun}><Icon name="play" size={14} fill />{onClear ? tr('הרץ שוב', 'Run again') : tr('הרץ', 'Run')}</button>
        {onClear && <button className="btn" onClick={onClear}>{tr('נקה תוצאות', 'Clear results')}</button>}
      </div>
      {result && <div className={`sc-result ${result.ok ? 'ok' : 'no'}`}>{result.text}</div>}
    </section>
  )
}
