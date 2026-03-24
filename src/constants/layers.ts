import type { LayerId } from '../types/annotation'

export interface LayerConfig {
  id: LayerId
  labelHe: string
  labelEn: string
  color: string
  bgColor: string
}

export const LAYERS: LayerConfig[] = [
  { id: 'harmony',   labelHe: 'הרמוניה',   labelEn: 'Harmony',    color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)' },
  { id: 'melody',    labelHe: 'מלודיה',    labelEn: 'Melody',     color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)'  },
  { id: 'form',      labelHe: 'מבנה',      labelEn: 'Form',       color: '#f97316', bgColor: 'rgba(249,115,22,0.15)' },
  { id: 'motif',     labelHe: 'מוטיב',     labelEn: 'Motif',      color: '#a855f7', bgColor: 'rgba(168,85,247,0.15)' },
  { id: 'labels',    labelHe: 'תוויות',    labelEn: 'Labels',     color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)' },
  { id: 'texture',   labelHe: 'מרקם',      labelEn: 'Texture',    color: '#14b8a6', bgColor: 'rgba(20,184,166,0.15)' },
  { id: 'freehand',  labelHe: 'ציור חופשי', labelEn: 'Freehand',  color: '#ec4899', bgColor: 'rgba(236,72,153,0.15)' },
  { id: 'noteColor', labelHe: 'צבע תוים',  labelEn: 'Note Color', color: '#6b7280', bgColor: 'rgba(107,114,128,0.15)' },
  { id: 'svgColor',  labelHe: 'צבע אלמנטים', labelEn: 'Element Color', color: '#06b6d4', bgColor: 'rgba(6,182,212,0.15)' },
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
