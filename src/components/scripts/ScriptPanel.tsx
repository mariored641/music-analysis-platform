/**
 * ScriptPanel.tsx
 * Floating panel that lists all analysis scripts.
 * Clicking a script runs it; clicking again clears its results and re-runs.
 */

import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useScoreStore } from '../../store/scoreStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { useLayerStore } from '../../store/layerStore'
import { runMelodyColorScript } from '../../services/melodyColorScript'
import { runMotifScript, SCRIPT_ID as MOTIF_ID } from '../../services/motifScript'
import type { HarmonyAnnotation } from '../../types/annotation'
import './ScriptPanel.css'

interface Props {
  onClose: () => void
}

interface ScriptDef {
  id: string
  labelEn: string
  labelHe: string
  descEn: string
  descHe: string
}

const SCRIPTS: ScriptDef[] = [
  {
    id: 'melodyColor',
    labelEn: 'Melody Colors',
    labelHe: 'צביעת תפקידים מלודיים',
    descEn: 'Colors each note by its melodic role (chord tone, passing, neighbor, chromatic). Requires harmony annotations.',
    descHe: 'צובע כל תו לפי תפקידו המלודי (תו הסכמה, מעבר, שכן, כרומטי). דורש ניתוח הרמוניה.',
  },
  {
    id: 'motifFinder',
    labelEn: 'Motif Finder',
    labelHe: 'זיהוי מוטיבים',
    descEn: 'Select 2+ notes to define a motif, then find all occurrences (incl. inversions and retrogrades).',
    descHe: 'בחר 2 תווים או יותר כמוטיב, ומצא את כל המופעים ביצירה (כולל היפוך ורטרוגרד).',
  },
]

export function ScriptPanel({ onClose }: Props) {
  const { i18n } = useTranslation()
  const isHe = i18n.language === 'he'

  const noteMap   = useScoreStore(s => s.noteMap)
  const xmlString = useScoreStore(s => s.xmlString)
  const annotations    = useAnnotationStore(s => s.annotations)
  const addAnnotation  = useAnnotationStore(s => s.addAnnotation)
  const removeAnnotation = useAnnotationStore(s => s.removeAnnotation)

  const panelRef = useRef<HTMLDivElement>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function isActive(scriptId: string): boolean {
    return Object.values(annotations).some(
      a => (a as any).scriptId === scriptId
    )
  }

  function clearScript(scriptId: string) {
    // Read fresh state (not stale closure) to avoid missing previously-added annotations
    const fresh = useAnnotationStore.getState().annotations
    const toRemove = Object.values(fresh)
      .filter(a => (a as any).scriptId === scriptId)
      .map(a => a.id)
    toRemove.forEach(id => removeAnnotation(id))
  }

  function runScript(scriptId: string): string | null {
    if (!noteMap) return 'NO_SCORE'

    if (scriptId === 'melodyColor') {
      const harmonyAnns = Object.values(annotations).filter(
        a => a.layer === 'harmony'
      ) as HarmonyAnnotation[]
      const { annotations: newAnns, error, count } = runMelodyColorScript(noteMap, harmonyAnns, xmlString)
      if (error) return error
      newAnns.forEach(ann => addAnnotation(ann))
      useLayerStore.getState().setVisible('noteColor', true)
      const msg = isHe ? `✓ סיים — ${count} תווים נצבעו` : `✓ Done — ${count} notes colored`
      setStatusMsg(msg)
      return null
    }

    if (scriptId === MOTIF_ID) {
      const { annotations: newAnns, error, found } = runMotifScript(noteMap, annotations)
      if (error) return error
      newAnns.forEach(ann => addAnnotation(ann))
      // Show summary
      const summary = Object.entries(found)
        .map(([label, count]) => `${label}: ${count}`)
        .join(', ')
      if (summary) {
        const msg = isHe
          ? `נמצאו: ${summary} מופעים`
          : `Found: ${summary} occurrences`
        alert(msg)
      }
      return null
    }

    return 'UNKNOWN_SCRIPT'
  }

  function handleClick(scriptId: string) {
    setStatusMsg(null)
    clearScript(scriptId)
    const error = runScript(scriptId)
    if (error) {
      alert(errorMessage(scriptId, error, isHe))
    }
  }

  return (
    <div className="script-panel" ref={panelRef} dir={isHe ? 'rtl' : 'ltr'}>
      <div className="script-panel-header">
        {isHe ? 'סקריפטים' : 'Scripts'}
      </div>
      <div className="script-panel-list">
        {SCRIPTS.map(script => {
          const active = isActive(script.id)
          return (
            <button
              key={script.id}
              className={`script-item ${active ? 'active' : ''}`}
              onClick={() => handleClick(script.id)}
              title={isHe ? script.descHe : script.descEn}
            >
              <div className="script-item-name">
                {isHe ? script.labelHe : script.labelEn}
                {active && <span className="script-active-dot" />}
              </div>
              <div className="script-item-desc">
                {isHe ? script.descHe : script.descEn}
              </div>
            </button>
          )
        })}
      </div>
      {statusMsg && (
        <div className="script-status-msg">{statusMsg}</div>
      )}
    </div>
  )
}

function errorMessage(scriptId: string, error: string, isHe: boolean): string {
  if (error === 'NO_SCORE') return isHe ? 'אין פרטיטורה פתוחה.' : 'No score is open.'
  if (error === 'NO_HARMONY') return isHe
    ? 'אין אקורדים מסומנים. סמן אקורדים (שכבת הרמוניה) לפני הרצת הסקריפט.'
    : 'No harmony annotations found. Add chord symbols (Harmony layer) before running this script.'
  if (error === 'NO_CHORD_SYMBOLS') return isHe
    ? 'האקורדים המסומנים אינם מכילים סמלי אקורד. הזן סמל אקורד בשדה "Chord Symbol".'
    : 'Harmony annotations contain no chord symbols. Enter a chord symbol in the Harmony menu.'
  if (error === 'SELECT_MORE_NOTES') return isHe
    ? 'בחר לפחות 2 תווים לפני הרצת זיהוי מוטיבים.'
    : 'Select at least 2 notes before running Motif Finder.'
  if (error === 'NO_MOTIF_ANNOTATIONS') return isHe
    ? 'לא נמצאו מוטיבים מסומנים. בחר תווים → תפריט ימני → מוטיב → תייג כ-A/B/C.'
    : 'No tagged motifs found. Select notes → right-click → Motif → tag as A/B/C first.'
  return isHe ? `שגיאה: ${error}` : `Error: ${error}`
}
