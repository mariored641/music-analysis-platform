import { useState, useRef } from 'react'
import { useAnnotationStore } from '../../store/annotationStore'
import { DEFAULT_LABEL_SUGGESTIONS } from '../../constants/tags'

interface Props {
  onApply: (annotation: any) => void
}

export function LabelMenu({ onApply }: Props) {
  const [text, setText] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const labelHistory = useAnnotationStore(s => s.labelHistory)

  const allSuggestions = [
    ...labelHistory,
    ...DEFAULT_LABEL_SUGGESTIONS.filter(s => !labelHistory.includes(s)),
  ]

  const filtered = text
    ? allSuggestions.filter(s => s.toLowerCase().includes(text.toLowerCase()))
    : allSuggestions.slice(0, 12)

  const handleApply = () => {
    if (!text.trim()) return
    onApply({ layer: 'labels', text: text.trim() })
  }

  return (
    <div className="sub-menu">
      <div className="menu-section-label">Free Label (with autocomplete)</div>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          className="menu-input"
          value={text}
          onChange={e => { setText(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleApply()
            if (e.key === 'Escape') setShowSuggestions(false)
          }}
          placeholder="Arpeggio, Scale run, Enclosure..."
          autoFocus
        />
        {showSuggestions && filtered.length > 0 && (
          <ul className="autocomplete-list">
            {filtered.slice(0, 8).map(s => (
              <li
                key={s}
                className="autocomplete-item"
                onMouseDown={() => { setText(s); setShowSuggestions(false) }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sub-menu-row" style={{ marginTop: 4 }}>
        {DEFAULT_LABEL_SUGGESTIONS.slice(0, 6).map(s => (
          <button
            key={s}
            className={`tag-chip ${text === s ? 'selected' : ''}`}
            onClick={() => setText(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <button className="btn-apply" onClick={handleApply} disabled={!text.trim()}>Apply</button>
    </div>
  )
}
