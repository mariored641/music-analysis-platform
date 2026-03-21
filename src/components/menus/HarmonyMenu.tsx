import { useState } from 'react'
import { SCALE_DEGREES, HARMONIC_FUNCTIONS, CADENCE_TYPES } from '../../constants/tags'

interface Props {
  onApply: (annotation: any) => void
}

export function HarmonyMenu({ onApply }: Props) {
  const [chordSymbol, setChordSymbol] = useState('')
  const [scaleDegree, setScaleDegree] = useState('')
  const [func, setFunc] = useState('')
  const [cadenceType, setCadenceType] = useState('')
  const [modulation, setModulation] = useState('')

  const handleApply = () => {
    if (!chordSymbol && !scaleDegree && !func && !cadenceType && !modulation) return
    onApply({
      layer: 'harmony',
      chordSymbol: chordSymbol || undefined,
      scaleDegree: scaleDegree || undefined,
      function: func || undefined,
      cadenceType: cadenceType || undefined,
      modulation: modulation || undefined,
    })
  }

  return (
    <div className="sub-menu">
      <div className="menu-section-label">Chord Symbol</div>
      <input
        className="menu-input"
        value={chordSymbol}
        onChange={e => setChordSymbol(e.target.value)}
        placeholder="C7, Dm7b5, G#dim..."
      />

      <div className="menu-section-label">Scale Degree</div>
      <div className="sub-menu-row">
        {SCALE_DEGREES.map(deg => (
          <button
            key={deg}
            className={`tag-chip ${scaleDegree === deg ? 'selected' : ''}`}
            onClick={() => setScaleDegree(scaleDegree === deg ? '' : deg)}
          >
            {deg}
          </button>
        ))}
      </div>

      <div className="menu-section-label">Function</div>
      <div className="sub-menu-row">
        {HARMONIC_FUNCTIONS.map(f => (
          <button
            key={f.value}
            className={`tag-chip ${func === f.value ? 'selected' : ''}`}
            title={`${f.labelHe} / ${f.labelEn}`}
            onClick={() => setFunc(func === f.value ? '' : f.value)}
          >
            {f.value} ({f.labelEn})
          </button>
        ))}
      </div>

      <div className="menu-section-label">Cadence</div>
      <div className="sub-menu-row">
        {CADENCE_TYPES.map(c => (
          <button
            key={c.value}
            className={`tag-chip ${cadenceType === c.value ? 'selected' : ''}`}
            title={`${c.labelHe} / ${c.labelEn}`}
            onClick={() => setCadenceType(cadenceType === c.value ? '' : c.value)}
          >
            {c.value}
          </button>
        ))}
      </div>

      <div className="menu-section-label">Modulation / Tonicization → key</div>
      <input
        className="menu-input"
        value={modulation}
        onChange={e => setModulation(e.target.value)}
        placeholder="e.g. G major, d minor..."
      />

      <button className="btn-apply" onClick={handleApply}>
        Apply
      </button>
    </div>
  )
}
