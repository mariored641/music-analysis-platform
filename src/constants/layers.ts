import type { LayerId } from '../types/annotation'

export interface LegendItem {
  color: string
  labelHe: string
  labelEn: string
  colorKey?: string  // maps to NOTE_COLORS key (e.g. 'CHORD_TONE') — makes the item user-editable
}

export interface LayerConfig {
  id: LayerId
  labelHe: string
  labelEn: string
  color: string
  bgColor: string
  legend?: LegendItem[]
}

export const LAYERS: LayerConfig[] = [
  {
    id: 'harmony',
    labelHe: 'הרמוניה', labelEn: 'Harmony',
    color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)',
    legend: [
      { color: '#3b82f6', labelHe: 'סימן אקורד', labelEn: 'Chord symbol' },
      { color: '#60a5fa', labelHe: 'קדנצה (PAC/IAC/HC)', labelEn: 'Cadence (PAC/IAC/HC)' },
      { color: '#93c5fd', labelHe: 'מודולציה', labelEn: 'Modulation' },
      { color: '#bfdbfe', labelHe: 'פונקציה T / S / D', labelEn: 'Function T / S / D' },
    ],
  },
  {
    id: 'melody',
    labelHe: 'מלודיה', labelEn: 'Melody',
    color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)',
    legend: [
      { color: '#3b82f6', colorKey: 'CT',  labelHe: 'CT — תו הסכמה',    labelEn: 'CT — Chord tone' },
      { color: '#a855f7', colorKey: 'PT',  labelHe: 'PT — תו מעבר',      labelEn: 'PT — Passing tone' },
      { color: '#22c55e', colorKey: 'NT',  labelHe: 'NT — תו שכן',       labelEn: 'NT — Neighbor tone' },
      { color: '#f97316', colorKey: 'SUS', labelHe: 'SUS — השהיה',       labelEn: 'SUS — Suspension' },
      { color: '#f59e0b', colorKey: 'APP', labelHe: "APP — אפוג'יאטורה", labelEn: "APP — Appoggiatura" },
    ],
  },
  {
    id: 'form',
    labelHe: 'מבנה', labelEn: 'Form',
    color: '#f97316', bgColor: 'rgba(249,115,22,0.15)',
    legend: [
      { color: '#3b82f6', labelHe: 'A', labelEn: 'A' },
      { color: '#60a5fa', labelHe: "A'", labelEn: "A'" },
      { color: '#f97316', labelHe: 'B', labelEn: 'B' },
      { color: '#22c55e', labelHe: 'C', labelEn: 'C' },
      { color: '#a855f7', labelHe: 'קודה', labelEn: 'Coda' },
      { color: '#6b7280', labelHe: 'פתיחה', labelEn: 'Introduction' },
    ],
  },
  {
    id: 'motif',
    labelHe: 'מוטיב', labelEn: 'Motif',
    color: '#a855f7', bgColor: 'rgba(168,85,247,0.15)',
    legend: [
      { color: '#a855f7', labelHe: 'מקורי', labelEn: 'Original' },
      { color: '#c084fc', labelHe: 'היפוך', labelEn: 'Inversion' },
      { color: '#d8b4fe', labelHe: 'רטרוגרד', labelEn: 'Retrograde' },
      { color: '#e9d5ff', labelHe: 'הגדלה / הקטנה', labelEn: 'Augmentation / Diminution' },
      { color: '#f3e8ff', labelHe: 'רצף', labelEn: 'Sequence' },
    ],
  },
  {
    id: 'labels',
    labelHe: 'תוויות', labelEn: 'Labels',
    color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)',
    legend: [
      { color: '#f59e0b', labelHe: 'תווית טקסט חופשית', labelEn: 'Free text label' },
      { color: '#fbbf24', labelHe: 'שאלה פתוחה', labelEn: 'Open question' },
    ],
  },
  {
    id: 'texture',
    labelHe: 'מרקם', labelEn: 'Texture',
    color: '#14b8a6', bgColor: 'rgba(20,184,166,0.15)',
    legend: [
      { color: '#14b8a6', labelHe: 'הומופוניה', labelEn: 'Homophony' },
      { color: '#2dd4bf', labelHe: 'פוליפוניה', labelEn: 'Polyphony' },
      { color: '#5eead4', labelHe: 'מונופוניה', labelEn: 'Monophony' },
      { color: '#99f6e4', labelHe: 'קונטרפונקט', labelEn: 'Counterpoint' },
    ],
  },
  {
    id: 'freehand',
    labelHe: 'ציור חופשי', labelEn: 'Freehand',
    color: '#ec4899', bgColor: 'rgba(236,72,153,0.15)',
    // legend rendered as ColorPalette component — no static items
  },
  {
    id: 'noteColor',
    labelHe: 'צבע תוים', labelEn: 'Note Color',
    color: '#6b7280', bgColor: 'rgba(107,114,128,0.15)',
    legend: [
      { color: '#3b82f6', colorKey: 'CHORD_TONE',    labelHe: 'תו הסכמה', labelEn: 'Chord tone' },
      { color: '#a855f7', colorKey: 'PASSING_TONE',  labelHe: 'תו מעבר',  labelEn: 'Passing tone' },
      { color: '#22c55e', colorKey: 'NEIGHBOR_TONE', labelHe: 'תו שכן',   labelEn: 'Neighbor tone' },
    ],
  },
  {
    id: 'svgColor',
    labelHe: 'צבע אלמנטים', labelEn: 'Element Color',
    color: '#06b6d4', bgColor: 'rgba(6,182,212,0.15)',
    legend: [
      { color: '#06b6d4', labelHe: 'דינמיקה (p, f, ff...)', labelEn: 'Dynamics (p, f, ff...)' },
      { color: '#22d3ee', labelHe: 'ארטיקולציה', labelEn: 'Articulation' },
      { color: '#67e8f9', labelHe: 'קרשנדו / דקרשנדו', labelEn: 'Hairpin (cresc/decresc)' },
      { color: '#a5f3fc', labelHe: 'פרמטה', labelEn: 'Fermata' },
      { color: '#cffafe', labelHe: 'טמפו / כיוון', labelEn: 'Tempo / Direction' },
    ],
  },
]

export const LAYER_MAP = new Map(LAYERS.map(l => [l.id, l]))

// Note coloring (matches NoteColorAnnotation.colorType)
export const NOTE_COLORS: Record<string, string> = {
  CHORD_TONE:    '#3b82f6',  // blue
  PASSING_TONE:  '#a855f7',  // purple
  NEIGHBOR_TONE: '#22c55e',  // green
}

export const FORMAL_SECTION_COLORS: Record<string, string> = {
  Exposition:      '#3b82f6',
  Development:     '#f97316',
  Recapitulation:  '#22c55e',
  Coda:            '#a855f7',
  Introduction:    '#6b7280',
  A:               '#3b82f6',
  'A\'':           '#60a5fa',
  B:               '#f97316',
  C:               '#22c55e',
  Refrain:         '#3b82f6',
  Couplet:         '#f59e0b',
}
