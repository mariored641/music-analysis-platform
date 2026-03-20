import type { Annotation, FormAnnotation } from '../../types/annotation'
import type { ScoreMetadata } from '../../types/score'
import { FORMAL_SECTION_COLORS } from '../../constants/layers'
import './FormalStrip.css'

interface Props {
  annotations: Record<string, Annotation>
  metadata: ScoreMetadata | null
}

export function FormalStrip({ annotations, metadata }: Props) {
  if (!metadata) return null

  const formAnnotations = Object.values(annotations)
    .filter((a): a is FormAnnotation => a.layer === 'form' && !!a.midLevel)
    .sort((a, b) => a.measureStart - b.measureStart)

  if (formAnnotations.length === 0) return <div className="formal-strip formal-strip-empty" />

  const total = metadata.totalMeasures

  return (
    <div className="formal-strip">
      {formAnnotations.map(ann => {
        const start = ann.measureStart
        const end = ann.measureEnd ?? ann.measureStart
        const left = ((start - 1) / total) * 100
        const width = ((end - start + 1) / total) * 100
        const label = ann.midLevel || ann.highLevel || ''
        const color = FORMAL_SECTION_COLORS[label] || '#6b7280'

        return (
          <div
            key={ann.id}
            className="formal-section"
            style={{ left: `${left}%`, width: `${width}%`, background: color }}
            title={`${label} (m.${start}–${end})`}
          >
            <span className="formal-label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
