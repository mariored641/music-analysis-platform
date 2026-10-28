import type { CadenceType, HarmonicFunction, MotifVariant, TextureAnnotation } from '../types/annotation'

export interface Option<T extends string = string> { value: T; he: string; en: string }

export const HARMONIC_FUNCTIONS: Option<HarmonicFunction>[] = [
  { value: 'T', he: 'טוניקה', en: 'Tonic' },
  { value: 'S', he: 'סובדומיננטה', en: 'Subdominant' },
  { value: 'D', he: 'דומיננטה', en: 'Dominant' },
]

export const CADENCE_TYPES: Option<CadenceType>[] = [
  { value: 'PAC', he: 'מושלמת', en: 'Perfect authentic' },
  { value: 'IAC', he: 'לא מושלמת', en: 'Imperfect authentic' },
  { value: 'HC', he: 'חצי קדנצה', en: 'Half cadence' },
  { value: 'PC', he: 'פלגלית', en: 'Plagal' },
  { value: 'DC', he: 'מפתיעה', en: 'Deceptive' },
]

export const MOTIF_VARIANTS: Option<MotifVariant>[] = [
  { value: 'original', he: 'מקור', en: 'Original' },
  { value: 'inversion', he: 'היפוך', en: 'Inversion' },
  { value: 'retrograde', he: 'נסיגה', en: 'Retrograde' },
  { value: 'augmentation', he: 'הגדלה', en: 'Augmentation' },
  { value: 'diminution', he: 'הקטנה', en: 'Diminution' },
  { value: 'sequence', he: 'סקוונצה', en: 'Sequence' },
  { value: 'fragmentation', he: 'פיצול', en: 'Fragment' },
]

export const VARIANT_SHORT: Record<string, string> = {
  original: '', inversion: 'inv', retrograde: 'ret', augmentation: 'aug',
  diminution: 'dim', sequence: 'seq', fragmentation: 'frag', combination: 'comb',
}

export const FORM_SECTIONS = ['A', 'B', 'C', "A'", "B'", 'Intro', 'Coda', 'Bridge', 'Head', 'Solo']
export const FORM_LARGE = ['Exposition', 'Development', 'Recapitulation', 'Theme', 'Variation']
export const FORM_PHRASES = ['Phrase', 'Period', 'Sentence', 'Antecedent', 'Consequent', 'Codetta']

export const TEXTURE_TYPES: Option<NonNullable<TextureAnnotation['textureType']>>[] = [
  { value: 'homophony', he: 'הומופוניה', en: 'Homophony' },
  { value: 'polyphony', he: 'פוליפוניה', en: 'Polyphony' },
  { value: 'monophony', he: 'מונופוניה', en: 'Monophony' },
]

export const DEFAULT_LABEL_SUGGESTIONS = [
  'Arpeggio', 'Enclosure', 'Scale run', 'Chromatic approach', 'Bebop scale', 'Sequence',
  'Chromatic descent', 'Guide tones', 'Quote', 'Pedal figure', 'Alberti bass', 'Circle of fifths',
]
