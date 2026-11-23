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

// ── Roman-numeral quick buttons ─────────────────────────────────────────────

export interface DegreeOption { value: string; he: string; en: string }

const ORD_HE = ['ראשונה', 'שנייה', 'שלישית', 'רביעית', 'חמישית', 'שישית', 'שביעית']
const ORD_EN = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']
const diatonic = (values: string[]): DegreeOption[] =>
  values.map((value, i) => ({ value, he: `דרגה ${ORD_HE[i]}`, en: `${ORD_EN[i]} degree` }))

export const DEGREES_MAJOR = diatonic(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
export const DEGREES_MINOR = diatonic(['i', 'ii°', 'III', 'iv', 'V', 'VI', 'vii°'])

const applied = (value: string): DegreeOption => {
  const [chord, target] = value.split('/')
  const lt = chord.startsWith('vii')
  return {
    value,
    he: `${lt ? 'אקורד צליל מוביל' : 'דומיננטה'} של ${target}`,
    en: `${lt ? 'leading-tone chord' : 'dominant'} of ${target}`,
  }
}
export const APPLIED_MAJOR = ['V/V', 'V/ii', 'V/iii', 'V/IV', 'V/vi', 'vii°/V'].map(applied)
export const APPLIED_MINOR = ['V/V', 'V/III', 'V/iv', 'V/VI', 'V/VII', 'vii°/V'].map(applied)

export const CHROMATIC_DEGREES: DegreeOption[] = [
  { value: 'N6', he: 'נפוליטני (♭II6)', en: 'Neapolitan (♭II6)' },
  { value: 'It+6', he: 'סקסטה מוגדלת איטלקית', en: 'Italian augmented sixth' },
  { value: 'Fr+6', he: 'סקסטה מוגדלת צרפתית', en: 'French augmented sixth' },
  { value: 'Ger+6', he: 'סקסטה מוגדלת גרמנית', en: 'German augmented sixth' },
  { value: '♭VI', he: 'דרגה שישית מונמכת (שאולה)', en: 'flat six (borrowed)' },
  { value: '♭VII', he: 'דרגה שביעית מונמכת (שאולה)', en: 'flat seven (borrowed)' },
  { value: 'Cad64', he: 'קוורט-סקסט קדנציאלי', en: 'cadential six-four' },
]

/** Inversion / seventh figures that can be added to a degree. */
export const DEGREE_FIGURES: DegreeOption[] = [
  { value: '7', he: 'ספטאקורד', en: 'seventh chord' },
  { value: '6', he: 'היפוך ראשון', en: 'first inversion' },
  { value: '64', he: 'היפוך שני', en: 'second inversion' },
  { value: '65', he: 'ספט — היפוך ראשון', en: 'seventh, first inversion' },
  { value: '43', he: 'ספט — היפוך שני', en: 'seventh, second inversion' },
  { value: '42', he: 'ספט — היפוך שלישי', en: 'seventh, third inversion' },
]

const FIGURE_RE = /(65|64|43|42|7|6|2)$/

/** Figure currently on a degree ("V65/V" → "65"), or ''. */
export function degreeFigure(degree: string): string {
  return FIGURE_RE.exec(degree.split('/')[0])?.[1] ?? ''
}

/** Put a figure on a degree, before any "/target" ("V/V" + 7 → "V7/V"); the same figure again removes it. */
export function withFigure(degree: string, fig: string): string {
  const slash = degree.indexOf('/')
  const base = slash >= 0 ? degree.slice(0, slash) : degree
  const target = slash >= 0 ? degree.slice(slash) : ''
  const current = FIGURE_RE.exec(base)?.[1] ?? ''
  const bare = current ? base.slice(0, -current.length) : base
  return `${bare}${current === fig ? '' : fig}${target}`
}
