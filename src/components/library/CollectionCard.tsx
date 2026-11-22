import { useTr } from '../../i18n'
import { Icon } from '../common/Icon'
import './CollectionCard.css'

interface Props {
  name: string
  pieceCount: number
  onClick: () => void
}

export function CollectionCard({ name, pieceCount, onClick }: Props) {
  const tr = useTr()
  return (
    <button className="card collection-card" onClick={onClick} aria-label={name}>
      <span className="collection-card-cover"><Icon name="folder" size={38} stroke={1.4} /></span>
      <span className="collection-card-details">
        <strong>{name}</strong>
        <span className="collection-card-count">{pieceCount} {tr('יצירות', 'pieces')}</span>
      </span>
    </button>
  )
}
