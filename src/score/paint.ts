/**
 * Direct DOM painting of the rendered score: notehead colors and element colors.
 * Diff-based — only touches elements whose color changed.
 */

const painted = new WeakMap<Element, string>()

function setColor(el: Element, color: string | null) {
  const prev = painted.get(el) ?? null
  if (prev === color) return
  const targets = el.matches('path, text, rect, ellipse, use') ? [el] : Array.from(el.querySelectorAll('path, text, rect, ellipse, use'))
  for (const t of targets as SVGElement[]) {
    if (color) {
      const strokeOnly = t.getAttribute('fill') === 'none'
      if (!strokeOnly) t.style.fill = color
      if (strokeOnly || t.getAttribute('stroke')) t.style.stroke = color
    } else {
      t.style.fill = ''
      t.style.stroke = ''
    }
  }
  if (color) painted.set(el, color); else painted.delete(el)
}

/** Apply `colors` (noteId → color) to noteheads; noteheads not in the map are reset. */
export function paintNotes(noteEls: Map<string, Element>, colors: Map<string, string>) {
  for (const [id, el] of noteEls) setColor(el, colors.get(id) ?? null)
}

/** Apply element colors (colorable index → color). */
export function paintElements(colorables: Element[], colors: Map<number, string>) {
  colorables.forEach((el, i) => setColor(el, colors.get(i) ?? null))
}
