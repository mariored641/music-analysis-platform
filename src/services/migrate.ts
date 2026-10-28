import type { Annotation, NoteFunction } from '../types/annotation'

const OLD_COLOR_TYPE: Record<string, NoteFunction> = {
  CHORD_TONE: 'CT', PASSING_TONE: 'PT', NEIGHBOR_TONE: 'NT',
}
const VALID = new Set(['harmony', 'melody', 'motif', 'form', 'texture', 'labels', 'color', 'freehand'])

/**
 * Upgrade annotations saved by older versions of MAP:
 *  - noteColor{colorType} (old melody-color script) → melody{noteFunction}
 *  - svgColor (Verovio-era element colors, never matched OSMD output) → dropped
 */
export function migrateAnnotations(input: Record<string, any> | any[] | null | undefined): Record<string, Annotation> {
  const out: Record<string, Annotation> = {}
  const list = Array.isArray(input) ? input : Object.values(input ?? {})
  for (const raw of list) {
    if (!raw || typeof raw !== 'object' || !raw.id || !raw.layer) continue
    let a = raw
    if (a.layer === 'noteColor') {
      const fn = OLD_COLOR_TYPE[a.colorType]
      if (!fn) continue
      const { colorType: _ct, ...rest } = a
      a = { ...rest, layer: 'melody', noteFunction: fn }
    }
    if (!VALID.has(a.layer)) continue
    if (typeof a.measureStart !== 'number') continue
    if (!a.createdAt) a = { ...a, createdAt: Date.now() }
    out[a.id] = a as Annotation
  }
  return out
}
