import { useState } from 'react'
import { MELODY_NOTE_FUNCTIONS, CHROMATICISM } from '../../constants/tags'
import i18n from '../../i18n/index'

interface Props {
  onApply: (annotation: any) => void
}

export function MelodyMenu({ onApply }: Props) {
  const [noteFunction, setNoteFunction] = useState('')
  const [chromaticism, setChromaticism] = useState('')
  const [melodicRole, setMelodicRole] = useState('')

  const lang = i18n.language as 'he' | 'en'

  const handleApply = () => {
    if (!noteFunction && !chromaticism && !melodicRole) return
    onApply({
      layer: 'melody',
      noteFunction: noteFunction || undefined,
      chromaticism: chromaticism || undefined,
      melodicRole: melodicRole || undefined,
    })
  }

  return (
    <div className="sub-menu">
      <div className="menu-section-label">Note Function</div>
      <div className="sub-menu-row">
        {MELODY_NOTE_FUNCTIONS.map(f => (
          <button
            key={f.value}
            className={`tag-chip ${noteFunction === f.value ? 'selected' : ''}`}
            onClick={() => setNoteFunction(noteFunction === f.value ? '' : f.value)}
            title={lang === 'he' ? f.labelHe : f.labelEn}
          >
            {f.value}
          </button>
        ))}
      </div>

      <div className="menu-section-label">Chromaticism</div>
      <div className="sub-menu-row">
        {CHROMATICISM.map(c => (
          <button
            key={c.value}
            className={`tag-chip ${chromaticism === c.value ? 'selected' : ''}`}
            title={`${c.labelHe} / ${c.labelEn}`}
            onClick={() => setChromaticism(chromaticism === c.value ? '' : c.value)}
          >
            {lang === 'he' ? c.labelHe : c.labelEn}
          </button>
        ))}
      </div>

      <div className="menu-section-label">Melodic Role</div>
      <div className="sub-menu-row">
        {['peak-local', 'peak-global', 'low-local', 'low-global'].map(r => (
          <button
            key={r}
            className={`tag-chip ${melodicRole === r ? 'selected' : ''}`}
            onClick={() => setMelodicRole(melodicRole === r ? '' : r)}
          >
            {r.replace('-', ' ')}
          </button>
        ))}
      </div>

      <button className="btn-apply" onClick={handleApply} disabled={!noteFunction && !chromaticism && !melodicRole}>
        Apply
      </button>
    </div>
  )
}
