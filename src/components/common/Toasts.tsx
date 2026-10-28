import { useUiStore } from '../../store/uiStore'

export function Toasts() {
  const toasts = useUiStore(s => s.toasts)
  const dismiss = useUiStore(s => s.dismiss)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.tone ?? 'info'}`}>
          <span>{t.text}</span>
          {t.action && <button className="btn-link" onClick={() => { t.action!.run(); dismiss(t.id) }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  )
}
