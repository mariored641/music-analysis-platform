import type { LayerId, NoteFunction } from '../types/annotation'

export interface LegendItem {
  key: string        // stable key for user color overrides
  color: string
  he: string
  en: string
}

export interface LayerConfig {
  id: LayerId
  he: string
  en: string
  color: string
  shortcut?: string
  legend?: LegendItem[]
}

export const MELODY_FUNCTIONS: Array<{ value: NoteFunction; color: string; he: string; en: string }> = [
  { value: 'CT',  color: '#2f6fdb', he: 'צליל אקורד',   en: 'Chord tone' },
  { value: 'PT',  color: '#9b4fd8', he: 'צליל מעבר',     en: 'Passing tone' },
  { value: 'NT',  color: '#1f9d55', he: 'צליל שכן',      en: 'Neighbor tone' },
  { value: 'SUS', color: '#e0761f', he: 'השהיה',         en: 'Suspension' },
  { value: 'ANT', color: '#0e9bb5', he: 'הקדמה',         en: 'Anticipation' },
  { value: 'APP', color: '#d4a017', he: "אפוג'יאטורה",   en: 'Appoggiatura' },
  { value: 'ESC', color: '#d6457d', he: 'צליל בריחה',    en: 'Escape tone' },
  { value: 'PED', color: '#6d5bd0', he: 'צליל פדל',      en: 'Pedal tone' },
]

/** Motif label → color (A, B, C …); further labels cycle. */
export const MOTIF_COLORS = ['#e0761f', '#8b5cf6', '#16a34a', '#db2777', '#0891b2', '#ca8a04', '#4f46e5', '#dc2626']

export const FORM_COLORS = ['#2f6fdb', '#e0761f', '#16a34a', '#9b4fd8', '#db2777', '#0891b2', '#ca8a04', '#64748b']

export const LAYERS: LayerConfig[] = [
  {
    id: 'harmony', he: 'הרמוניה', en: 'Harmony', color: '#2f6fdb', shortcut: 'H',
    legend: [
      { key: 'chord', color: '#2f6fdb', he: 'סימן אקורד', en: 'Chord symbol' },
      { key: 'rn', color: '#1e40af', he: 'דרגה (ספרה רומית)', en: 'Roman numeral' },
      { key: 'cadence', color: '#b45309', he: 'קדנצה', en: 'Cadence' },
    ],
  },
  {
    id: 'melody', he: 'מלודיה', en: 'Melody', color: '#9b4fd8', shortcut: 'N',
    legend: MELODY_FUNCTIONS.map(f => ({ key: f.value, color: f.color, he: `${f.value} — ${f.he}`, en: `${f.value} — ${f.en}` })),
  },
  {
    id: 'motif', he: 'מוטיבים', en: 'Motifs', color: '#e0761f', shortcut: 'M',
    legend: [
      { key: 'original', color: '#e0761f', he: 'מקור — קו מלא', en: 'Original — solid' },
      { key: 'variant', color: '#e0761f', he: 'וריאציה — קו מקווקו', en: 'Variant — dashed' },
    ],
  },
  { id: 'form', he: 'מבנה', en: 'Form', color: '#16a34a', shortcut: 'F' },
  { id: 'texture', he: 'מרקם', en: 'Texture', color: '#0891b2' },
  { id: 'labels', he: 'תוויות', en: 'Labels', color: '#ca8a04', shortcut: 'T' },
  { id: 'questions', he: 'שאלות', en: 'Questions', color: '#dc2626', shortcut: 'Q' },
  { id: 'color', he: 'צביעה', en: 'Coloring', color: '#db2777', shortcut: 'K' },
  { id: 'freehand', he: 'ציור חופשי', en: 'Freehand', color: '#475569', shortcut: 'D' },
]

export const LAYER_MAP = new Map(LAYERS.map(l => [l.id, l]))

export function motifColor(label: string, overrides?: Record<string, string>): string {
  const o = overrides?.[`motif:${label}`]
  if (o) return o
  const base = label.replace(/['’]+$/, '').toUpperCase()
  const idx = base.length === 1 && base >= 'A' && base <= 'Z' ? base.charCodeAt(0) - 65 : hash(base)
  return MOTIF_COLORS[idx % MOTIF_COLORS.length]
}

export function formColor(label: string, overrides?: Record<string, string>): string {
  const o = overrides?.[`form:${label}`]
  if (o) return o
  const base = label.replace(/['’]+$/, '')
  const fixed: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, Intro: 7, Introduction: 7, Coda: 3, Exposition: 0, Development: 1, Recapitulation: 2 }
  return FORM_COLORS[(fixed[base] ?? hash(base)) % FORM_COLORS.length]
}

export function melodyColor(fn: string, overrides?: Record<string, string>): string {
  return overrides?.[`melody:${fn}`] ?? MELODY_FUNCTIONS.find(f => f.value === fn)?.color ?? '#64748b'
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export const COLOR_SWATCHES = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#16a34a', '#0d9488',
  '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#db2777', '#1f2937',
]
