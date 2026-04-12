import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnotationStore } from '../../store/annotationStore'
import { useAnnotationBrowserStore } from '../../store/annotationBrowserStore'
import { useSelectionStore } from '../../store/selectionStore'
import { LAYER_MAP } from '../../constants/layers'
import type { LayerId, Annotation } from '../../types/annotation'
import './AnnotationBrowser.css'

interface Props {
  layerId: LayerId
}

/** Get a grouping key for an annotation based on its layer */
function getGroupKey(a: Annotation): string {
  switch (a.layer) {
    case 'harmony': return (a as any).chordSymbol || (a as any).cadenceType || (a as any).function || 'other'
    case 'melody': return (a as any).noteFunction || 'other'
    case 'form': return (a as any).highLevel || 'other'
    case 'motif': return (a as any).label || 'other'
    case 'labels': return (a as any).isQuestion ? 'question' : 'label'
    case 'noteColor': return (a as any).colorType || 'other'
    case 'svgColor': return (a as any).svgClass || 'other'
    case 'freehand': return (a as any).color || 'other'
    case 'texture': return (a as any).textureType || 'other'
    default: return 'other'
  }
}

/** Get a short summary for an annotation chip */
function getSummary(a: Annotation, lang: string): string {
  const m = `m.${a.measureStart}${a.measureEnd && a.measureEnd !== a.measureStart ? `–${a.measureEnd}` : ''}`
  let detail = ''
  switch (a.layer) {
    case 'harmony': detail = (a as any).chordSymbol || (a as any).cadenceType || (a as any).scaleDegree || ''; break
    case 'melody': detail = (a as any).noteFunction || ''; break
    case 'form': detail = (a as any).highLevel || (a as any).midLevel || ''; break
    case 'motif': detail = `${(a as any).label || ''}${(a as any).variantType ? ` (${(a as any).variantType})` : ''}`; break
    case 'labels': detail = ((a as any).text || '').slice(0, 20); break
    case 'noteColor': {
      const ct = (a as any).colorType as string
      if (ct === 'CHORD_TONE') detail = lang === 'he' ? 'הסכמה' : 'CT'
      else if (ct === 'PASSING_TONE') detail = lang === 'he' ? 'מעבר' : 'PT'
      else if (ct === 'NEIGHBOR_TONE') detail = lang === 'he' ? 'שכן' : 'NT'
      else detail = ct
      break
    }
    case 'svgColor': detail = (a as any).svgClass || ''; break
    case 'freehand': detail = ''; break
    case 'texture': detail = (a as any).textureType || ''; break
  }
  return detail ? `${m}: ${detail}` : m
}

/** Get a readable label for a group key */
function getGroupLabel(layerId: LayerId, key: string, lang: string): string {
  if (layerId === 'noteColor') {
    const map: Record<string, [string, string]> = {
      'CHORD_TONE': ['Chord Tone', 'צליל הסכמה'],
      'PASSING_TONE': ['Passing Tone', 'צליל מעבר'],
      'NEIGHBOR_TONE': ['Neighbor Tone', 'צליל שכן'],
    }
    const pair = map[key]
    return pair ? (lang === 'he' ? pair[1] : pair[0]) : key
  }
  if (layerId === 'melody') {
    const map: Record<string, [string, string]> = {
      'CT': ['Chord Tone', 'הסכמה'], 'PT': ['Passing', 'מעבר'], 'NT': ['Neighbor', 'שכן'],
      'SUS': ['Suspension', 'השהיה'], 'ANT': ['Anticipation', 'ציפייה'],
      'APP': ['Appoggiatura', 'אפוג\''], 'ESC': ['Escape', 'בריחה'], 'PED': ['Pedal', 'פדל'],
    }
    const pair = map[key]
    return pair ? (lang === 'he' ? pair[1] : pair[0]) : key
  }
  if (layerId === 'labels') {
    if (key === 'question') return lang === 'he' ? 'שאלות' : 'Questions'
    return lang === 'he' ? 'תוויות' : 'Labels'
  }
  return key
}

export function AnnotationBrowser({ layerId }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const annotations = useAnnotationStore(s => s.annotations)
  const { removeAnnotations, updateAnnotations } = useAnnotationStore()
  const { checkedIds, toggleChecked, checkAll, uncheckAll } = useAnnotationBrowserStore()
  const setScrollToMeasure = useSelectionStore(s => s.setScrollToMeasure)
  const colorInputRef = useRef<HTMLInputElement>(null)

  const layerConfig = LAYER_MAP.get(layerId)

  // Filter annotations for this layer, sorted by measure
  const layerAnnotations = useMemo(() => {
    return Object.values(annotations)
      .filter(a => a.layer === layerId)
      .sort((a, b) => a.measureStart - b.measureStart)
  }, [annotations, layerId])

  // Group by sub-type
  const groups = useMemo(() => {
    const map = new Map<string, Annotation[]>()
    for (const a of layerAnnotations) {
      const key = getGroupKey(a)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return map
  }, [layerAnnotations])

  const allIds = layerAnnotations.map(a => a.id)
  const allChecked = allIds.length > 0 && allIds.every(id => checkedIds.has(id))
  const someChecked = checkedIds.size > 0

  const handleSelectAll = () => {
    if (allChecked) uncheckAll()
    else checkAll(allIds)
  }

  const handleGroupToggle = (groupIds: string[]) => {
    const allGroupChecked = groupIds.every(id => checkedIds.has(id))
    if (allGroupChecked) {
      // Uncheck only this group
      for (const id of groupIds) {
        if (checkedIds.has(id)) toggleChecked(id)
      }
    } else {
      // Check all in group (add to existing)
      const currentChecked = new Set(checkedIds)
      for (const id of groupIds) currentChecked.add(id)
      checkAll([...currentChecked])
    }
  }

  const handleDelete = () => {
    const ids = [...checkedIds]
    if (ids.length === 0) return
    removeAnnotations(ids)
    uncheckAll()
  }

  const handleColorChange = (color: string) => {
    const ids = [...checkedIds]
    if (ids.length === 0) return
    // Different layers store color differently
    if (layerId === 'freehand' || layerId === 'svgColor') {
      updateAnnotations(ids, { color })
    }
  }

  const handleChipClick = (a: Annotation) => {
    setScrollToMeasure(a.measureStart)
  }

  const supportsColorChange = layerId === 'freehand' || layerId === 'svgColor'

  if (layerAnnotations.length === 0) {
    return (
      <div className="annotation-browser">
        <div className="ab-empty">{lang === 'he' ? 'אין תיוגים' : 'No annotations'}</div>
      </div>
    )
  }

  return (
    <div className="annotation-browser" style={{ '--ab-color': layerConfig?.color ?? '#6366f1' } as React.CSSProperties}>
      {/* Header */}
      <label className="ab-header" onClick={handleSelectAll}>
        <input
          type="checkbox"
          checked={allChecked}
          onChange={handleSelectAll}
          className="ab-checkbox"
        />
        <span className="ab-header-text">
          {lang === 'he' ? 'בחר הכל' : 'Select All'} ({layerAnnotations.length})
        </span>
      </label>

      {/* Groups */}
      <div className="ab-groups">
        {[...groups.entries()].map(([key, items]) => {
          const groupIds = items.map(a => a.id)
          const groupChecked = groupIds.every(id => checkedIds.has(id))

          return (
            <div key={key} className="ab-group">
              {groups.size > 1 && (
                <label className="ab-group-header" onClick={() => handleGroupToggle(groupIds)}>
                  <input
                    type="checkbox"
                    checked={groupChecked}
                    onChange={() => handleGroupToggle(groupIds)}
                    className="ab-checkbox"
                  />
                  <span className="ab-group-label">
                    {getGroupLabel(layerId, key, lang)} ({items.length})
                  </span>
                </label>
              )}
              {items.map(a => (
                <label key={a.id} className={`ab-chip ${checkedIds.has(a.id) ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(a.id)}
                    onChange={() => toggleChecked(a.id)}
                    className="ab-checkbox"
                  />
                  <span
                    className="ab-chip-text"
                    onClick={(e) => { e.preventDefault(); handleChipClick(a) }}
                    title={lang === 'he' ? 'לחץ לגלילה' : 'Click to scroll'}
                  >
                    {getSummary(a, lang)}
                  </span>
                </label>
              ))}
            </div>
          )
        })}
      </div>

      {/* Action bar */}
      {someChecked && (
        <div className="ab-actions">
          <button className="ab-action-btn ab-delete" onClick={handleDelete} title={lang === 'he' ? 'מחק נבחרים' : 'Delete selected'}>
            🗑 {lang === 'he' ? 'מחק' : 'Delete'} ({checkedIds.size})
          </button>
          {supportsColorChange && (
            <div className="ab-color-wrap">
              <button
                className="ab-action-btn ab-color"
                onClick={() => colorInputRef.current?.click()}
                title={lang === 'he' ? 'שנה צבע' : 'Change color'}
              >
                🎨
              </button>
              <input
                ref={colorInputRef}
                type="color"
                className="ab-hidden-color"
                onChange={e => handleColorChange(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
