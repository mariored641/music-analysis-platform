import { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuid } from 'uuid'
import { useSelectionStore } from '../../store/selectionStore'
import { useAnnotationStore } from '../../store/annotationStore'
import { HarmonyMenu } from './HarmonyMenu'
import { MelodyMenu } from './MelodyMenu'
import { FormMenu } from './FormMenu'
import { MotifMenu } from './MotifMenu'
import { LabelMenu } from './LabelMenu'
import { NoteColorMenu } from './NoteColorMenu'
import './ContextMenu.css'

type MenuTab = 'harmony' | 'melody' | 'form' | 'motif' | 'label' | 'question' | 'noteColor'

export function ContextMenu() {
  const { t } = useTranslation()
  const { contextMenu, hideContextMenu, selection } = useSelectionStore()
  const { addAnnotation, addToLabelHistory } = useAnnotationStore()
  const ref = useRef<HTMLDivElement>(null)

  const initialTab = (contextMenu.tab as MenuTab) || deriveDefaultTab(selection?.type)
  const [activeTab, setActiveTab] = useState<MenuTab>(initialTab)

  useEffect(() => {
    if (contextMenu.visible) {
      setActiveTab((contextMenu.tab as MenuTab) || deriveDefaultTab(selection?.type))
    }
  }, [contextMenu.visible, contextMenu.tab, selection?.type])

  useEffect(() => {
    if (!contextMenu.visible) return
    const onClickOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        hideContextMenu()
      }
    }
    document.addEventListener('mousedown', onClickOut)
    return () => document.removeEventListener('mousedown', onClickOut)
  }, [contextMenu.visible, hideContextMenu])

  const [pos, setPos] = useState<{ left: number; top: number; visible: boolean }>({
    left: -9999, top: -9999, visible: false,
  })

  // After every render, measure the actual element and clamp it on-screen
  // (runs synchronously before paint so there's no flicker)
  useLayoutEffect(() => {
    if (!contextMenu.visible || !ref.current) return
    const el = ref.current
    const w = el.offsetWidth || 300
    const h = el.offsetHeight || 100
    let left = contextMenu.x
    let top = contextMenu.y
    if (left + w > window.innerWidth)  left = window.innerWidth  - w - 8
    if (top  + h > window.innerHeight) top  = window.innerHeight - h - 8
    if (left < 8) left = 8
    if (top  < 8) top  = 8
    setPos({ left, top, visible: true })
  }, [contextMenu.visible, contextMenu.x, contextMenu.y, activeTab])

  if (!contextMenu.visible || !selection) return null

  const tabs = getTabsForSelection(selection.type)

  const handleApplyAnnotation = (annotation: any) => {
    const id = uuid()
    addAnnotation({
      id,
      ...annotation,
      measureStart: selection.measureStart,
      measureEnd: selection.measureEnd,
      noteIds: selection.noteIds,
      createdAt: Date.now(),
    })
    if (annotation.layer === 'labels' && annotation.text) {
      addToLabelHistory(annotation.text)
    }
    hideContextMenu()
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.left, top: pos.top, visibility: pos.visible ? 'visible' : 'hidden' }}
      onClick={e => e.stopPropagation()}
    >
      <div className="menu-header">
        <span className="menu-title">
          {selection.type === 'note' && `${t('selection.note')} · m.${selection.measureStart}`}
          {selection.type === 'notes' && `${selection.noteIds.length} ${t('selection.notes')}`}
          {selection.type === 'measure' && `${t('selection.measure')} ${selection.measureStart}`}
          {selection.type === 'measures' && `m.${selection.measureStart}–${selection.measureEnd}`}
        </span>
        <button className="menu-close" onClick={hideContextMenu}>×</button>
      </div>

      <div className="menu-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`menu-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as MenuTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="menu-body">
        {activeTab === 'harmony' && <HarmonyMenu onApply={handleApplyAnnotation} />}
        {activeTab === 'melody' && <MelodyMenu onApply={handleApplyAnnotation} />}
        {activeTab === 'form' && <FormMenu onApply={handleApplyAnnotation} />}
        {activeTab === 'motif' && <MotifMenu onApply={handleApplyAnnotation} />}
        {activeTab === 'label' && <LabelMenu onApply={handleApplyAnnotation} />}
        {activeTab === 'question' && <QuestionMenu onApply={handleApplyAnnotation} />}
        {activeTab === 'noteColor' && <NoteColorMenu onApply={handleApplyAnnotation} />}
      </div>
    </div>
  )
}

function deriveDefaultTab(selType?: string): MenuTab {
  switch (selType) {
    case 'note': return 'melody'
    case 'notes': return 'motif'
    case 'measure': return 'harmony'
    case 'measures': return 'form'
    default: return 'harmony'
  }
}

function getTabsForSelection(selType: string) {
  if (selType === 'note') return [
    { id: 'melody', label: 'Melody' },
    { id: 'harmony', label: 'Harm.' },
    { id: 'noteColor', label: 'Color' },
    { id: 'label', label: 'Label' },
    { id: 'question', label: '?' },
  ]
  if (selType === 'notes') return [
    { id: 'motif', label: 'Motif' },
    { id: 'noteColor', label: 'Color' },
    { id: 'melody', label: 'Melody' },
    { id: 'label', label: 'Label' },
    { id: 'question', label: '?' },
  ]
  if (selType === 'measure') return [
    { id: 'harmony', label: 'Harm.' },
    { id: 'form', label: 'Form' },
    { id: 'label', label: 'Label' },
    { id: 'question', label: '?' },
  ]
  return [
    { id: 'form', label: 'Form' },
    { id: 'harmony', label: 'Harm.' },
    { id: 'motif', label: 'Motif' },
    { id: 'question', label: '?' },
  ]
}

function QuestionMenu({ onApply }: { onApply: (a: any) => void }) {
  const [text, setText] = useState('')
  return (
    <div className="sub-menu">
      <p className="sub-menu-hint">Mark this as an open question:</p>
      <textarea
        className="menu-textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe the question (optional)..."
        rows={3}
      />
      <button
        className="btn-apply"
        onClick={() => onApply({ layer: 'labels', isQuestion: true, text: text || 'Unclear' })}
      >
        Mark as Question
      </button>
    </div>
  )
}
