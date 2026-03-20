import { useState } from 'react'
import { FORMAL_HIGH, FORMAL_MID, FORMAL_LOW } from '../../constants/tags'

interface Props {
  onApply: (annotation: any) => void
}

export function FormMenu({ onApply }: Props) {
  const [highLevel, setHighLevel] = useState('')
  const [midLevel, setMidLevel] = useState('')
  const [lowLevel, setLowLevel] = useState('')
  const [closure, setClosure] = useState('')

  const handleApply = () => {
    if (!highLevel && !midLevel && !lowLevel && !closure) return
    onApply({
      layer: 'form',
      highLevel: highLevel || undefined,
      midLevel: midLevel || undefined,
      lowLevel: lowLevel || undefined,
      closure: closure || undefined,
    })
  }

  return (
    <div className="sub-menu">
      <div className="menu-section-label">Form Type</div>
      <div className="sub-menu-row">
        {FORMAL_HIGH.map(h => (
          <button
            key={h}
            className={`tag-chip ${highLevel === h ? 'selected' : ''}`}
            onClick={() => setHighLevel(highLevel === h ? '' : h)}
          >
            {h}
          </button>
        ))}
      </div>

      <div className="menu-section-label">Section</div>
      <div className="sub-menu-row">
        {FORMAL_MID.map(m => (
          <button
            key={m}
            className={`tag-chip ${midLevel === m ? 'selected' : ''}`}
            onClick={() => setMidLevel(midLevel === m ? '' : m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="menu-section-label">Phrase Level</div>
      <div className="sub-menu-row">
        {FORMAL_LOW.map(l => (
          <button
            key={l}
            className={`tag-chip ${lowLevel === l ? 'selected' : ''}`}
            onClick={() => setLowLevel(lowLevel === l ? '' : l)}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="menu-section-label">Closure</div>
      <div className="sub-menu-row">
        {['open', 'closed', 'half-closed'].map(c => (
          <button
            key={c}
            className={`tag-chip ${closure === c ? 'selected' : ''}`}
            onClick={() => setClosure(closure === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>

      <button className="btn-apply" onClick={handleApply}>Apply</button>
    </div>
  )
}
