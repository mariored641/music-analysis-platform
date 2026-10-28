import { useState } from 'react'
import { Modal } from '../common/Modal'
import { useTr } from '../../i18n'
import { useLibraryStore, type LibraryPiece } from '../../store/libraryStore'

export interface PieceMeta { title: string; composer: string; genre?: string; year?: number; notes?: string }

export function PieceForm({ initial, heading, submitLabel, onSubmit, onClose }: {
  initial: Partial<LibraryPiece>
  heading: string
  submitLabel: string
  onSubmit: (m: PieceMeta) => void
  onClose: () => void
}) {
  const tr = useTr()
  const pieces = useLibraryStore(s => s.pieces)
  const [m, setM] = useState<PieceMeta>({
    title: initial.title ?? '', composer: initial.composer ?? '', genre: initial.genre ?? '',
    year: initial.year, notes: initial.notes ?? '',
  })
  const genres = [...new Set(pieces.map(p => p.genre).filter(Boolean) as string[])]
  const composers = [...new Set(pieces.map(p => p.composer).filter(Boolean))]
  const submit = () => onSubmit({ ...m, title: m.title.trim() || tr('ללא שם', 'Untitled'), genre: m.genre?.trim() || undefined, notes: m.notes?.trim() || undefined })

  return (
    <Modal title={heading} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>{tr('ביטול', 'Cancel')}</button>
      <button className="btn primary" onClick={submit}>{submitLabel}</button>
    </>}>
      <form className="form" onSubmit={e => { e.preventDefault(); submit() }}>
        <label className="field wide">
          <span>{tr('שם היצירה', 'Title')}</span>
          <input autoFocus value={m.title} onChange={e => setM({ ...m, title: e.target.value })} />
        </label>
        <label className="field">
          <span>{tr('מלחין', 'Composer')}</span>
          <input value={m.composer} list="composers" onChange={e => setM({ ...m, composer: e.target.value })} />
          <datalist id="composers">{composers.map(c => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="field">
          <span>{tr("ז'אנר", 'Genre')}</span>
          <input value={m.genre} list="genres" onChange={e => setM({ ...m, genre: e.target.value })} placeholder={tr('בי-בופ, בארוק…', 'Bebop, Baroque…')} />
          <datalist id="genres">{[...new Set([...genres, 'Bebop', 'Jazz standard', 'Baroque', 'Classical', 'Romantic', 'Pop'])].map(g => <option key={g} value={g} />)}</datalist>
        </label>
        <label className="field">
          <span>{tr('שנה', 'Year')}</span>
          <input type="number" value={m.year ?? ''} onChange={e => setM({ ...m, year: e.target.value ? parseInt(e.target.value) : undefined })} />
        </label>
        <label className="field wide">
          <span>{tr('הערות', 'Notes')}</span>
          <textarea rows={3} value={m.notes} onChange={e => setM({ ...m, notes: e.target.value })} />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
