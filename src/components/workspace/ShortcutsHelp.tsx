import { Modal } from '../common/Modal'
import { useUiStore } from '../../store/uiStore'
import { useTr } from '../../i18n'

const GROUPS: Array<{ he: string; en: string; rows: Array<[string, string, string]> }> = [
  { he: 'בחירה', en: 'Selection', rows: [
    ['קליק', 'בחירת תו / תיבה (אזור ריק)', 'Select note / bar (empty area)'],
    ['גרירה', 'בחירת כמה תווים (לאסו)', 'Select several notes (lasso)'],
    ['Shift+קליק', 'הרחבה עד לנקודה', 'Extend to here'],
    ['Ctrl+קליק', 'הוספה / הסרה של תו', 'Add / remove a note'],
    ['דאבל-קליק', 'תו → כל התיבה · תיבה → כל השורה', 'Note → whole bar · bar → whole system'],
    ['← →', 'תו קודם / הבא', 'Previous / next note'],
    ['Shift+← →', 'הרחבה / צמצום תו-תו', 'Extend / shrink by a note'],
    ['Shift+↑ ↓', 'הרחבה לשורה מעל / מתחת', 'Extend to system above / below'],
    ['↑ ↓', 'תו מעל / מתחת', 'Note above / below'],
    ['Ctrl+A', 'הכל', 'Everything'],
    ['Esc', 'סגירה / ביטול בחירה', 'Close / clear selection'],
  ] },
  { he: 'תיוג', en: 'Tagging', rows: [
    ['H / Enter', 'אקורד ודרגה', 'Chord & degree'],
    ['N', 'תפקיד מלודי — ואז 1–8', 'Melodic role — then 1–8'],
    ['M', 'מוטיב — ואז 1–9', 'Motif — then 1–9'],
    ['F', 'מבנה / מרקם', 'Form / texture'],
    ['T', 'תווית', 'Label'],
    ['Q', 'שאלה פתוחה', 'Open question'],
    ['K', 'צבע', 'Color'],
    ['Del', 'מחיקת התיוג הנבחר', 'Delete the selected tag'],
    ['Alt+← →', 'הזזת נקודת ההתחלה של אקורד', 'Move a chord’s anchor note'],
    ['Ctrl+Z / Ctrl+Y', 'בטל / בצע שוב', 'Undo / redo'],
  ] },
  { he: 'כלים', en: 'Tools', rows: [
    ['רווח', 'נגן מהבחירה / השהה', 'Play from selection / pause'],
    ['L', 'לופ על הבחירה', 'Loop the selection'],
    ['D / E / V', 'ציור / מחק / בחירה', 'Draw / erase / select'],
    ['Ctrl+גלגלת', 'זום (Ctrl+0 = רוחב)', 'Zoom (Ctrl+0 = fit)'],
    ['Ctrl+S', 'שמירה מיידית', 'Save now'],
    ['?', 'המסך הזה', 'This screen'],
  ] },
]

export function ShortcutsHelp() {
  const tr = useTr()
  const open = useUiStore(s => s.helpOpen)
  if (!open) return null
  return (
    <Modal title={tr('קיצורי מקלדת', 'Keyboard shortcuts')} onClose={() => useUiStore.getState().setHelpOpen(false)} width={720}>
      <div className="help-grid">
        {GROUPS.map(g => (
          <section key={g.en}>
            <h3>{tr(g.he, g.en)}</h3>
            {g.rows.map(([k, h, e]) => (
              <div key={k} className="help-row"><kbd>{k}</kbd><span>{tr(h, e)}</span></div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  )
}
