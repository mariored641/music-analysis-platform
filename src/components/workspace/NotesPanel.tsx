import { useEffect, useLayoutEffect, useRef } from 'react'
import { useResearchStore, type ResearchLink, type ResearchNote } from '../../store/researchStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { selectionLinkLabel } from '../../services/annotationQueries'
import { selectMeasures, selectNotes } from '../../score/selectionOps'
import { Icon } from '../common/Icon'
import { useHe, useTr } from '../../i18n'

export function followLink(link: ResearchLink) {
  if (link.type === 'notes' && link.noteIds?.length) selectNotes(link.noteIds)
  else selectMeasures(link.measureStart, link.measureEnd ?? link.measureStart)
  useSelectionStore.getState().requestScroll(link.measureStart, link.noteIds?.[0])
}

function currentLink(he: boolean): ResearchLink | null {
  const s = useSelectionStore.getState().selection
  if (!s) return null
  const notes = s.kind === 'notes' && !s.wholeMeasures
  return {
    type: notes ? 'notes' : 'measures',
    measureStart: s.measureStart,
    measureEnd: s.measureEnd,
    noteIds: notes ? s.noteIds : undefined,
    label: selectionLinkLabel(s, useWorkspaceStore.getState().noteMap, he),
  }
}

export function NotesPanel() {
  const tr = useTr()
  const he = useHe()
  const notes = useResearchStore(s => s.notes)
  const hasSel = useSelectionStore(s => !!s.selection)
  return (
    <div className="notes">
      <p className="notes-intro">{tr('כתוב חופשי. כל פסקה יכולה להיות מקושרת לתווים או לתיבות — לחיצה על קישור קופצת אליהם.', 'Write freely. Each paragraph can link to notes or bars — click a link to jump there.')}</p>
      {notes.map(n => <Paragraph key={n.id} note={n} hasSel={hasSel} />)}
      <div className="notes-add">
        <button className="btn dashed" onClick={() => useResearchStore.getState().addNote()}><Icon name="plus" size={15} />{tr('פסקה חדשה', 'New paragraph')}</button>
        {hasSel && (
          <button className="btn dashed" onClick={() => { const l = currentLink(he); useResearchStore.getState().addNote(null, l ?? undefined) }}>
            <Icon name="link" size={15} />{tr('פסקה על הבחירה', 'Paragraph about selection')}
          </button>
        )}
      </div>
    </div>
  )
}

function Paragraph({ note, hasSel }: { note: ResearchNote; hasSel: boolean }) {
  const tr = useTr()
  const he = useHe()
  const ref = useRef<HTMLTextAreaElement>(null)
  const focusId = useResearchStore(s => s.focusId)
  const store = useResearchStore.getState()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [note.text])

  useEffect(() => {
    if (focusId === note.id && ref.current) {
      ref.current.focus()
      ref.current.scrollIntoView({ block: 'nearest' })
      store.setFocus(null)
    }
  }, [focusId, note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="para">
      <textarea ref={ref} rows={2} value={note.text} placeholder={tr('מה שמת לב אליו…', 'What did you notice…')}
        onChange={e => store.updateNote(note.id, e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); store.addNote(note.id) }
          if (e.key === 'Backspace' && !note.text && note.links.length === 0) { e.preventDefault(); store.removeNote(note.id) }
        }} />
      <div className="para-links">
        {note.links.map((l, i) => (
          <span key={i} className="link-chip">
            <button onClick={() => followLink(l)} title={tr('קפוץ לפרטיטורה', 'Jump to score')}><Icon name="link" size={12} />{l.label}</button>
            <button className="x" onClick={() => store.removeLink(note.id, i)} aria-label="remove"><Icon name="close" size={11} /></button>
          </span>
        ))}
        <span className="para-tools">
          <button disabled={!hasSel} onClick={() => { const l = currentLink(he); if (l) store.addLink(note.id, l) }}
            title={hasSel ? tr('קשר לבחירה הנוכחית', 'Link to current selection') : tr('בחר תווים בפרטיטורה כדי לקשר', 'Select notes in the score to link')}>
            <Icon name="link" size={13} />{tr('קשר', 'Link')}
          </button>
          <button onClick={() => store.removeNote(note.id)} title={tr('מחק פסקה', 'Delete paragraph')}><Icon name="trash" size={13} /></button>
        </span>
      </div>
    </div>
  )
}
