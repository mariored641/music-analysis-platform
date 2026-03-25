/**
 * PDF export via browser print dialog.
 * Adds 'map-printing' class to body → triggers @media print CSS that
 * hides all panels and shows only the score + overlays full-page.
 */
export function exportToPdf(title: string) {
  const prevTitle = document.title
  document.title = title

  document.body.classList.add('map-printing')

  const cleanup = () => {
    document.title = prevTitle
    document.body.classList.remove('map-printing')
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)
  window.print()
}
