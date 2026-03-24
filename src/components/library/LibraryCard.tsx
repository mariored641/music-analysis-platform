import type { LibraryPiece } from '../../store/libraryStore'
import './LibraryCard.css'

interface Props {
  piece: LibraryPiece
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}

function formatDate(ts: number | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function LibraryCard({ piece, isActive, onClick, onDelete }: Props) {
  return (
    <div className={`library-card ${isActive ? 'active' : ''}`} onClick={onClick}>
      <button className="library-card-delete" onClick={onDelete} title="Remove">×</button>
      <div className="library-card-title">{piece.title || piece.fileName}</div>
      {piece.composer && <div className="library-card-composer">{piece.composer}</div>}
      <div className="library-card-tags">
        {piece.genre && <span className="library-card-tag">{piece.genre}</span>}
        {piece.year && <span className="library-card-tag">{piece.year}</span>}
        {piece.key && <span className="library-card-tag">{piece.key}</span>}
        {piece.timeSignature && <span className="library-card-tag">{piece.timeSignature}</span>}
      </div>
      <div className="library-card-meta">
        <span>m.{piece.totalMeasures}</span>
        {piece.lastOpened ? <span>נפתח: {formatDate(piece.lastOpened)}</span> : null}
      </div>
      {piece.notes && <div className="library-card-notes">{piece.notes}</div>}
    </div>
  )
}
