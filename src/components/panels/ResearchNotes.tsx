import { useRef } from 'react'
import { useResearchStore, type ResearchLink } from '../../store/researchStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useTranslation } from 'react-i18next'
import './ResearchNotes.css'

export function ResearchNotes() {
  const { i18n } = useTranslation()
  const isHe = i18n.language === 'he'

  const notes = useResearchStore(s => s.notes)
  const { addNote, updateNote, addLink, removeLink, removeNote } = useResearchStore()

  const selection = useSelectionStore(s => s.selection)
  const setSelection = useSelectionStore(s => s.setSelection)
  const setScrollToMeasure = useSelectionStore(s => s.setScrollToMeasure)

  function handleLinkToSelection(noteId: string) {
    if (!selection) return
    const mStart = selection.measureStart
    const mEnd = selection.measureEnd ?? mStart
    let label: string
    if (selection.type === 'notes' || selection.type === 'note') {
      label = isHe
        ? `תו m.${mStart}`
        : `note m.${mStart}`
    } else {
      label = mEnd !== mStart ? `m.${mStart}–${mEnd}` : `m.${mStart}`
    }
    const link: ResearchLink = {
      type: selection.type === 'notes' || selection.type === 'note' ? 'notes' : 'measures',
      measureStart: mStart,
      measureEnd: mEnd !== mStart ? mEnd : undefined,
      noteIds: selection.noteIds?.length ? selection.noteIds : undefined,
      label,
    }
    addLink(noteId, link)
  }

  function handleLinkClick(link: ResearchLink) {
    if (link.type === 'notes' && link.noteIds?.length) {
      setSelection({
        type: 'notes',
        measureStart: link.measureStart,
        measureEnd: link.measureEnd ?? link.measureStart,
        noteIds: link.noteIds,
      })
    } else {
      setSelection({
        type: 'measures',
        measureStart: link.measureStart,
        measureEnd: link.measureEnd ?? link.measureStart,
        noteIds: [],
      })
    }
    setScrollToMeasure(link.measureStart)
  }

  return (
    <div className="research-notes" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="rn-list">
        {notes.length === 0 && (
          <p className="rn-empty">
            {isHe ? 'אין פתקים עדיין' : 'No notes yet'}
          </p>
        )}
        {notes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            isHe={isHe}
            hasSelection={!!selection}
            onTextChange={(text) => updateNote(note.id, text)}
            onLinkToSelection={() => handleLinkToSelection(note.id)}
            onLinkClick={handleLinkClick}
            onRemoveLink={(i) => removeLink(note.id, i)}
            onDelete={() => removeNote(note.id)}
          />
        ))}
      </div>
      <button className="rn-add-btn" onClick={addNote}>
        {isHe ? '+ פתק חדש' : '+ New note'}
      </button>
    </div>
  )
}

interface NoteCardProps {
  note: { id: string; text: string; links: ResearchLink[] }
  isHe: boolean
  hasSelection: boolean
  onTextChange: (text: string) => void
  onLinkToSelection: () => void
  onLinkClick: (link: ResearchLink) => void
  onRemoveLink: (index: number) => void
  onDelete: () => void
}

function NoteCard({
  note, isHe, hasSelection,
  onTextChange, onLinkToSelection, onLinkClick, onRemoveLink, onDelete
}: NoteCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className="rn-card">
      <div className="rn-card-header">
        <button
          className="rn-delete-note"
          onClick={onDelete}
          title={isHe ? 'מחק פתק' : 'Delete note'}
        >×</button>
      </div>
      <textarea
        ref={textareaRef}
        className="rn-textarea"
        value={note.text}
        onChange={e => onTextChange(e.target.value)}
        placeholder={isHe ? 'כתוב הערה...' : 'Write a note...'}
        rows={3}
      />
      {note.links.length > 0 && (
        <div className="rn-links">
          {note.links.map((link, i) => (
            <span key={i} className="rn-link-chip">
              <button
                className="rn-link-btn"
                onClick={() => onLinkClick(link)}
                title={isHe ? 'קפוץ למיקום' : 'Jump to location'}
              >
                🔗 {link.label}
              </button>
              <button
                className="rn-link-remove"
                onClick={() => onRemoveLink(i)}
                title={isHe ? 'הסר קישור' : 'Remove link'}
              >×</button>
            </span>
          ))}
        </div>
      )}
      <button
        className={`rn-link-to-sel${hasSelection ? '' : ' rn-link-to-sel--disabled'}`}
        onClick={onLinkToSelection}
        disabled={!hasSelection}
        title={isHe ? 'קשר לבחירה הנוכחית' : 'Link to current selection'}
      >
        {isHe ? '🔗 קשר לבחירה' : '🔗 Link selection'}
      </button>
    </div>
  )
}
