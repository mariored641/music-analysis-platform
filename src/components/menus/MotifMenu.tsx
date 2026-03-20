import { useState } from 'react'
import { useAnnotationStore } from '../../store/annotationStore'
import { MOTIF_VARIANTS } from '../../constants/tags'
import type { MotifAnnotation } from '../../types/annotation'

interface Props {
  onApply: (annotation: any) => void
}

export function MotifMenu({ onApply }: Props) {
  const [label, setLabel] = useState('')
  const [variantType, setVariantType] = useState('original')
  const [crossRef, setCrossRef] = useState('')

  const annotations = useAnnotationStore(s => s.annotations)
  const existingLabels = [...new Set(
    Object.values(annotations)
      .filter((a): a is MotifAnnotation => a.layer === 'motif')
      .map(a => a.label)
  )].sort()

  const handleApply = () => {
    if (!label) return
    onApply({
      layer: 'motif',
      label,
      variantType,
      crossRef: crossRef || undefined,
    })
  }

  return (
    <div className="sub-menu">
      <div className="menu-section-label">Motif Label</div>
      {existingLabels.length > 0 && (
        <div className="sub-menu-row">
          {existingLabels.map(l => (
            <button
              key={l}
              className={`tag-chip ${label === l ? 'selected' : ''}`}
              onClick={() => setLabel(label === l ? '' : l)}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      <input
        className="menu-input"
        value={label}
        onChange={e => setLabel(e.target.value.toUpperCase().slice(0, 3))}
        placeholder="A, B, C, A'..."
        maxLength={3}
      />

      <div className="menu-section-label">Variant Type</div>
      <div className="sub-menu-row">
        {MOTIF_VARIANTS.map(v => (
          <button
            key={v.value}
            className={`tag-chip ${variantType === v.value ? 'selected' : ''}`}
            onClick={() => setVariantType(v.value)}
          >
            {v.labelEn}
          </button>
        ))}
      </div>

      <div className="menu-section-label">Cross-reference (returns in m.)</div>
      <input
        className="menu-input"
        value={crossRef}
        onChange={e => setCrossRef(e.target.value)}
        placeholder="e.g. 'returns in m. 24'"
      />

      <button className="btn-apply" onClick={handleApply} disabled={!label}>Apply</button>
    </div>
  )
}
