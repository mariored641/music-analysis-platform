import { useState } from 'react'
import { NOTE_COLORS } from '../../constants/layers'

type ColorType = 'CT' | 'NCT-diatonic' | 'NCT-chromatic' | 'unanalyzed'

const OPTIONS: { value: ColorType; label: string; desc: string }[] = [
  { value: 'CT',           label: 'CT',           desc: 'Chord Tone' },
  { value: 'NCT-diatonic', label: 'NCT-d',        desc: 'Non-Chord Tone (diatonic)' },
  { value: 'NCT-chromatic',label: 'NCT-c',        desc: 'Non-Chord Tone (chromatic)' },
  { value: 'unanalyzed',   label: '—',            desc: 'Unanalyzed' },
]

interface Props { onApply: (annotation: any) => void }

export function NoteColorMenu({ onApply }: Props) {
  const [selected, setSelected] = useState<ColorType | ''>('')

  return (
    <div className="sub-menu">
      <div className="menu-section-label">Note function color</div>
      <div className="sub-menu-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {OPTIONS.map(o => (
          <button
            key={o.value}
            className={`tag-chip ${selected === o.value ? 'selected' : ''}`}
            style={{ borderColor: NOTE_COLORS[o.value], color: NOTE_COLORS[o.value] }}
            title={o.desc}
            onClick={() => setSelected(selected === o.value ? '' : o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#4a5568', marginTop: 4 }}>
        {selected ? OPTIONS.find(o => o.value === selected)?.desc : 'Select a color type'}
      </div>
      <button
        className="btn-apply"
        disabled={!selected}
        onClick={() => selected && onApply({ layer: 'noteColor', colorType: selected })}
      >
        Apply Color
      </button>
    </div>
  )
}
