export const MELODY_NOTE_FUNCTIONS = [
  { value: 'CT',  labelEn: 'Chord Tone',    labelHe: 'צליל הסכמה' },
  { value: 'PT',  labelEn: 'Passing Tone',  labelHe: 'צליל מעבר' },
  { value: 'NT',  labelEn: 'Neighbor Tone', labelHe: 'צליל שכן' },
  { value: 'SUS', labelEn: 'Suspension',    labelHe: 'השהיה' },
  { value: 'ANT', labelEn: 'Anticipation',  labelHe: 'ציפייה' },
  { value: 'APP', labelEn: 'Appoggiatura',  labelHe: 'אפוג\'יאטורה' },
  { value: 'ESC', labelEn: 'Escape Tone',   labelHe: 'צליל בריחה' },
  { value: 'PED', labelEn: 'Pedal Tone',    labelHe: 'פדל' },
]

export const CHROMATICISM = [
  { value: 'diatonic',  labelEn: 'Diatonic',    labelHe: 'דיאטוני' },
  { value: 'chromatic', labelEn: 'Chromatic',    labelHe: 'כרומטי' },
  { value: 'outside',   labelEn: 'Outside key',  labelHe: 'מחוץ לטונאליות' },
]

export const SCALE_DEGREES = [
  'I', 'i', 'II', 'ii', 'III', 'iii', 'IV', 'iv', 'V', 'V7', 'vi', 'vii°',
  'N6', 'It+6', 'Fr+6', 'Ger+6', 'V/ii', 'V/IV', 'V/V', 'V/vi',
]

export const HARMONIC_FUNCTIONS = [
  { value: 'T', labelEn: 'Tonic',       labelHe: 'טוניקה' },
  { value: 'S', labelEn: 'Subdominant', labelHe: 'סובדומיננטה' },
  { value: 'D', labelEn: 'Dominant',    labelHe: 'דומיננטה' },
]

export const CADENCE_TYPES = [
  { value: 'PAC', labelEn: 'Perfect Authentic', labelHe: 'קדנצה מושלמת' },
  { value: 'IAC', labelEn: 'Imperfect Authentic', labelHe: 'קדנצה לא מושלמת' },
  { value: 'HC',  labelEn: 'Half Cadence',       labelHe: 'קדנצה חצי' },
  { value: 'PC',  labelEn: 'Plagal Cadence',      labelHe: 'קדנצה פלאגלית' },
  { value: 'DC',  labelEn: 'Deceptive Cadence',   labelHe: 'קדנצה מפתיעה' },
]

export const FORMAL_HIGH = [
  'Sonata', 'Rondo', 'ABA', 'Theme & Variations', 'Fugue', 'Binary', 'Ternary', 'Through-composed'
]

export const FORMAL_MID = [
  'Exposition', 'Development', 'Recapitulation', 'Coda', 'Introduction',
  'A', 'B', "A'", 'C', 'Refrain', 'Couplet'
]

export const FORMAL_LOW = [
  'Period', 'Sentence', 'Phrase', 'Sub-phrase', 'Extension', 'Codetta'
]

export const MOTIF_VARIANTS = [
  { value: 'original',      labelEn: 'Original',      labelHe: 'מקורי' },
  { value: 'inversion',     labelEn: 'Inversion',     labelHe: 'היפוך' },
  { value: 'retrograde',    labelEn: 'Retrograde',    labelHe: 'נסיגה' },
  { value: 'augmentation',  labelEn: 'Augmentation',  labelHe: 'הגדלה' },
  { value: 'diminution',    labelEn: 'Diminution',    labelHe: 'הקטנה' },
  { value: 'sequence',      labelEn: 'Sequence',      labelHe: 'רצף' },
  { value: 'fragmentation', labelEn: 'Fragmentation', labelHe: 'פיצול' },
  { value: 'combination',   labelEn: 'Combination',   labelHe: 'שילוב' },
]

export const TEXTURE_TYPES = [
  { value: 'homophony', labelEn: 'Homophony', labelHe: 'הומופוניה' },
  { value: 'polyphony', labelEn: 'Polyphony', labelHe: 'פוליפוניה' },
  { value: 'monophony', labelEn: 'Monophony', labelHe: 'מונופוניה' },
]

export const COUNTERPOINT_TYPES = [
  { value: 'strict',    labelEn: 'Strict',    labelHe: 'מחמיר' },
  { value: 'free',      labelEn: 'Free',      labelHe: 'חופשי' },
  { value: 'imitative', labelEn: 'Imitative', labelHe: 'חיקוי' },
]

export const DEFAULT_LABEL_SUGGESTIONS = [
  'Arpeggio', 'Enclosure', 'Scale run', 'Tremolo', 'Alberti bass',
  'Pedal figure', 'Sequence', 'Chromatic descent', 'Chromatic ascent',
  'Circle of fifths', 'Lament bass', 'Omnibus', 'Faux-bourdon',
]
