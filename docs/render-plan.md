# MAP — תכנית בנייה: מערכת רינדור בסגנון webmscore
**נוצר:** 2026-03-30
**מטרה:** בנות renderer ב-TypeScript/SVG שנראה כמו webmscore (MuseScore)
**מקור ההתייחסות:** `C:\Users\DELL\Documents\webmscore`

---

## תגלית מרכזית — מה גורם ל-webmscore להראות טוב

**תשובה קצרה: גופנים.**

כל הצורות המוזיקליות — מפתח סול, ראשי תווים, שוקות, עיגולים, קשתות, סימני accidental, articulation — הן **גלייפים של פונט מוזיקלי** שנקרא **SMuFL** (Standard Music Font Layout).

webmscore משתמש בפונטים הבאים:
- **Leland** (ברירת מחדל — הפונט של MuseScore, נראה הכי נקי)
- **Bravura** (fallback — הפונט הסטנדרטי של SMuFL, של Steinberg)

**כלומר:** אין כאן SVG paths מקודדים, אין תמונות. יש Unicode codepoints בתוך פונט OTF/WOFF2.
כשרוצים לצייר ראש תו שחור, שולחים תו Unicode `\uE0A4` מהפונט Leland.
הפונט עצמו מכיל את הגאומטריה המושלמת.

### קבצי הפונטים (open source, ניתן לשימוש):
```
webmscore/fonts/leland/Leland.woff2          ← PRIMARY — כל הסימנים
webmscore/fonts/leland/LelandText.woff2      ← טקסטים מוזיקליים
webmscore/fonts/bravura/Bravura.woff2        ← fallback
webmscore/fonts/bravura/BravuraText.woff2
webmscore/fonts/smufl/glyphnames.json        ← מיפוי שם → Unicode (3500+ סימנים)
webmscore/fonts/leland/leland_metadata.json  ← עוגנים + engraving defaults
webmscore/fonts/bravura/metadata.json        ← אותו דבר לבravura
```

### metadata.json — הסוד של האיכות הויזואלית:
כל פונט SMuFL מגיע עם metadata שמכיל:
- `engravingDefaults` — עובי קו קווים (staffLineWidth), עובי גבעול (stemThickness), עובי קורה (beamThickness), עובי קשת (slurMidpointThickness)... 20+ פרמטרים
- `glyphsWithAnchors` — נקודות עיגון מדויקות לכל גלייף (stemDownNW, stemUpSE, cutOutNE) — לחיבור גבעולים מדויק
- כל הפרמטרים האלה **יחסיים ל-staff space** (מרחק בין קווי מוסיקה)

---

## ארכיטקטורת ה-Renderer החדש

```
MusicXML
   │
   ▼
[1] XML Parser (קיים?)
   │  → מבנה נתונים פנימי: Measures[], Notes[], Chords[]
   ▼
[2] Layout Engine
   │  → מחשב x,y לכל אלמנט ביחס ל-staffSpace
   ▼
[3] SVG Renderer
   │  → מייצר <text> / <line> / <path> SVG elements
   │  → גופן = Leland/Bravura (SMuFL)
   ▼
[4] React Component
      → dangerouslySetInnerHTML או inline SVG
```

---

## שלבי הבנייה

---

### שלב 1 — הבאת הגופנים לפרויקט
**קבצים לעתיק:**
```
webmscore/fonts/leland/Leland.woff2          → public/fonts/
webmscore/fonts/leland/LelandText.woff2      → public/fonts/
webmscore/fonts/bravura/Bravura.woff2        → public/fonts/ (fallback)
webmscore/fonts/leland/leland_metadata.json  → src/renderer/data/
webmscore/fonts/smufl/glyphnames.json        → src/renderer/data/
```

**CSS:**
```css
@font-face {
  font-family: 'Leland';
  src: url('/fonts/Leland.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'Bravura';
  src: url('/fonts/Bravura.woff2') format('woff2');
}
```

**תוצאה מצופה:** כבר עכשיו אם נשתמש בפונטים האלה בתצוגה כלשהי, הצורות יראו כמו MuseScore.

---

### שלב 2 — SMuFL Symbol Map (TypeScript)
**מה בונים:** `src/renderer/symbols.ts`

מיפוי SymId → Unicode codepoint, מבוסס על `glyphnames.json`.

```typescript
// src/renderer/symbols.ts
export const SYMBOLS = {
  // Clefs
  gClef:             '\uE050',
  fClef:             '\uE062',
  cClef:             '\uE05C',
  // Noteheads
  noteheadWhole:     '\uE0A2',
  noteheadHalf:      '\uE0A3',
  noteheadBlack:     '\uE0A4',
  // Accidentals
  accidentalFlat:    '\uE260',
  accidentalSharp:   '\uE262',
  accidentalNatural: '\uE261',
  // Rests
  restWhole:         '\uE4E3',
  restHalf:          '\uE4E4',
  restQuarter:       '\uE4E5',
  rest8th:           '\uE4E6',
  rest16th:          '\uE4E7',
  // Time signatures
  timeSig0: '\uE080', timeSig1: '\uE081', timeSig2: '\uE082',
  timeSig3: '\uE083', timeSig4: '\uE084', timeSig5: '\uE085',
  timeSig6: '\uE086', timeSig7: '\uE087', timeSig8: '\uE088',
  timeSig9: '\uE089',
  timeSigCommon: '\uE08A',
  timeSigCutCommon: '\uE08B',
  // Flags
  flag8thUp:    '\uE240',
  flag8thDown:  '\uE241',
  flag16thUp:   '\uE242',
  flag16thDown: '\uE243',
  // Articulations
  articAccentAbove: '\uE4A0',
  articStaccatoAbove: '\uE4A2',
  articTenutoAbove: '\uE4A4',
  // Dots
  augmentationDot: '\uE1E7',
  // Barlines - built with SVG lines (לא גלייפים)
  // Tuplets - numbers drawn as text
} as const;

export type SymbolKey = keyof typeof SYMBOLS;
```

**לאחר מכן לקרוא:** `glyphnames.json` לאימות כל codepoint + הוספת סימנים נוספים לפי צורך.

---

### שלב 3 — Engraving Constants (מ-metadata.json)
**מה בונים:** `src/renderer/engravingDefaults.ts`

```typescript
// src/renderer/engravingDefaults.ts
// ערכים מ: leland_metadata.json → engravingDefaults
// כל הערכים ביחידות staff-spaces (sp)
// staffSpace = מרחק בין 2 קווים = fontSize / 4

export const ENGRAVING = {
  staffLineWidth:        0.13,   // עובי קו קווים
  stemThickness:         0.12,   // עובי גבעול
  beamThickness:         0.5,    // עובי קורה
  beamSpacing:           0.25,   // רווח בין קורות
  slurMidpointThickness: 0.22,   // עובי קשת באמצע
  slurEndpointThickness: 0.07,   // עובי קשת בקצה
  barlineSeparation:     0.4,    // רווח בין קווי גדר כפולים
  thinBarlineThickness:  0.16,
  thickBarlineThickness: 0.5,
  ledgerLineThickness:   0.16,   // עובי קו לדר
  ledgerLineExtension:   0.4,    // כמה הקו לדר בולט מכל צד
  staffLineCount:        5,
} as const;

// ANCHOR POINTS לגלייפים נבחרים (מ-glyphsWithAnchors)
// stemDownNW = מיקום חיבור גבעול למטה (צד ימין עליון)
// stemUpSE   = מיקום חיבור גבעול למעלה (צד שמאל תחתון)
export const ANCHORS = {
  noteheadBlack: {
    stemUpSE:   [1.18, -0.168],   // [x, y] ב-sp
    stemDownNW: [0.0,   0.168],
  },
  noteheadHalf: {
    stemUpSE:   [1.06, -0.204],
    stemDownNW: [0.0,   0.204],
  },
  noteheadWhole: {
    stemUpSE:   [1.468, -0.3],
    stemDownNW: [0.0,   0.3],
  },
};
```

---

### שלב 4 — מבנה נתונים פנימי (Score Model)
**מה בונים:** `src/renderer/model.ts`

```typescript
// src/renderer/model.ts

export interface ScoreModel {
  parts: Part[];
  measures: Measure[];
  metadata: ScoreMetadata;
}

export interface Part {
  id: string;
  name: string;
  staffCount: number;  // 1 = single staff, 2 = grand staff (פסנתר)
  clef: ClefType;
}

export interface Measure {
  index: number;       // 0-based
  number: number;      // 1-based (מוצג)
  staves: Staff[];
  timeSignature?: TimeSignature;
  keySignature?: KeySignature;
  barlineStart: BarlineType;
  barlineEnd: BarlineType;
  width?: number;      // מחושב בשלב layout
  x?: number;          // מחושב בשלב layout
}

export interface Staff {
  clef: ClefType;
  voices: Voice[];
}

export interface Voice {
  voiceIndex: number;
  elements: MusicElement[];  // notes, rests, chords
}

export type MusicElement = NoteElement | RestElement | ChordElement;

export interface NoteElement {
  type: 'note';
  pitch: Pitch;
  duration: Duration;
  dots: number;
  accidental?: AccidentalType;
  ties?: TieType;      // 'start' | 'stop' | 'both'
  slurs?: SlurInfo[];
  articulations: ArticulationType[];
  beamState?: BeamState;
  graceNote?: boolean;
  // layout (מחושב):
  x?: number; y?: number; headWidth?: number;
  stemX?: number; stemY?: number; stemEndY?: number;
}

export interface ChordElement {
  type: 'chord';
  notes: NoteElement[];
  duration: Duration;
  dots: number;
  text?: string;       // chord symbol (C7, Dm, etc.)
  beamState?: BeamState;
}

export interface Pitch {
  step: 'C'|'D'|'E'|'F'|'G'|'A'|'B';
  octave: number;
  alter: -2|-1|0|0.5|1|2;  // flat/sharp/natural/quarter
}

export type Duration = 'whole'|'half'|'quarter'|'eighth'|'16th'|'32nd'|'64th';
export type ClefType = 'treble'|'bass'|'alto'|'tenor'|'percussion';
export type AccidentalType = 'flat'|'sharp'|'natural'|'doubleFlat'|'doubleSharp';
export type BarlineType = 'normal'|'double'|'final'|'repeat-start'|'repeat-end';
export type BeamState = 'begin'|'continue'|'end'|'none';
```

---

### שלב 5 — XML Parser
**מה בונים:** `src/renderer/xmlParser.ts`

מקבל MusicXML string → מחזיר `ScoreModel`.

**נקודות קריטיות לפיתוח:**
- לא לשכוח `<backup>` / `<forward>` בתוך measure (שני קולות/staffs)
- `<stem>` direction חשובה לגבעולים
- `<beam number="1">` = קורות אחוד
- chord symbols ב-`<harmony>` — להיכנס לרמת `<root-step>`, `<root-alter>`, `<kind>`
- `<tied>` vs `<tie>` — שניהם קיימים ב-MusicXML, שונים

**שימוש בפונקציה הקיימת:**
`src/services/xmlSanitizer.ts` קיים ועושה preprocessing — לבדוק אם ניתן לשלב.

---

### שלב 6 — Layout Engine
**מה בונים:** `src/renderer/layout.ts`

קלט: `ScoreModel` + רוחב עמוד
פלט: `ScoreModel` עם x,y לכל אלמנט

**פרמטרים בסיסיים:**
```typescript
const STAFF_SPACE = 8;    // px — מרחק בין קווי מוסיקה (sp)
const STAFF_HEIGHT = STAFF_SPACE * 4;  // 4 intervals between 5 lines
const SYSTEM_MARGIN_LEFT = 60;
const SYSTEM_MARGIN_RIGHT = 20;
```

**חישוב גובה תו:**
```typescript
function noteY(pitch: Pitch, clef: ClefType, staffTop: number): number {
  // מיפוי step+octave → מיקום על קווים
  // ב-treble clef: E4 = קו 1, G4 = קו 2, B4 = קו 3...
  const staffPos = getStaffPosition(pitch, clef);  // 0 = קו 1, 1 = חלל 1...
  return staffTop + (8 - staffPos) * (STAFF_SPACE / 2);
}
```

**חלוקת מידות בשורה:**
- מחשבים רוחב מינימלי לכל מידה (כמות אלמנטים × רוחב בסיס)
- מחלקים שוויונית ולאחר מכן justify לרוחב עמוד
- מידות עם יותר תווים → יותר רוחב (proportional spacing)

---

### שלב 7 — SVG Renderer
**מה בונים:** `src/renderer/svgRenderer.ts`

קלט: `ScoreModel` אחרי layout
פלט: string של SVG

**עיקרון מרכזי:** כל סימן מוזיקלי = `<text>` SVG עם `font-family="Leland"`.

```typescript
function renderSymbol(x: number, y: number, sym: SymbolKey, fontSize: number): string {
  return `<text x="${x}" y="${y}" font-family="Leland,Bravura" font-size="${fontSize}" fill="black">${SYMBOLS[sym]}</text>`;
}

// דוגמה — ציור ראש תו שחור:
// fontSize = STAFF_SPACE * 4 (SMuFL glyphs designed at 4sp em-size)
renderSymbol(noteX, noteY, 'noteheadBlack', STAFF_SPACE * 4);
```

**ציור קווי staff:**
```typescript
function renderStaff(x: number, y: number, width: number): string {
  const lw = ENGRAVING.staffLineWidth * STAFF_SPACE;
  return Array.from({length: 5}, (_, i) =>
    `<line x1="${x}" y1="${y + i * STAFF_SPACE}" x2="${x + width}" y2="${y + i * STAFF_SPACE}" stroke="black" stroke-width="${lw}"/>`
  ).join('');
}
```

**ציור גבעול (stem):**
```typescript
function renderStem(x: number, yTop: number, yBottom: number): string {
  const sw = ENGRAVING.stemThickness * STAFF_SPACE;
  return `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBottom}" stroke="black" stroke-width="${sw}"/>`;
}
```

**ציור קשת (slur/tie) — Bezier:**
```typescript
function renderSlur(x1: number, y1: number, x2: number, y2: number, above: boolean): string {
  const mid = (x1 + x2) / 2;
  const height = Math.min(2 * STAFF_SPACE, (x2 - x1) * 0.15);
  const cy = above ? y1 - height : y1 + height;
  return `<path d="M${x1},${y1} Q${mid},${cy} ${x2},${y2}" fill="none" stroke="black" stroke-width="${ENGRAVING.slurMidpointThickness * STAFF_SPACE}"/>`;
}
```

---

### שלב 8 — React Component
**מה מעדכנים:** `src/components/score/ScoreView.tsx` (או קומפוננט חדש)

```typescript
// src/components/score/MAPScoreRenderer.tsx
import { useMemo } from 'react';
import { parseXML } from '../../renderer/xmlParser';
import { applyLayout } from '../../renderer/layout';
import { renderToSVG } from '../../renderer/svgRenderer';

interface Props {
  xmlString: string;
  pageWidth: number;
}

export function MAPScoreRenderer({ xmlString, pageWidth }: Props) {
  const svgPages = useMemo(() => {
    const model = parseXML(xmlString);
    const laid = applyLayout(model, pageWidth);
    return renderToSVG(laid);
  }, [xmlString, pageWidth]);

  return (
    <div className="score-container">
      {svgPages.map((svg, i) => (
        <div
          key={i}
          className="score-page"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ))}
    </div>
  );
}
```

---

### שלב 9 — Chord Symbol Text
**מה בונים:** `src/renderer/chordSymbols.ts`

Chord symbols (C7, Dm, Eb maj7) משתמשים ב-**LelandText** (לא Leland).

```typescript
function renderChordSymbol(x: number, y: number, text: string): string {
  // root note — גדול, LelandText
  // quality (m, maj, dim) — קטן יותר, superscript
  // example: "Dm7" → "D" normal + "m7" smaller/raised
  return `<text x="${x}" y="${y}" font-family="LelandText,BravuraText,serif" font-size="${STAFF_SPACE * 2}">${escapeXML(text)}</text>`;
}
```

---

## סדר עדיפויות לפיתוח

| # | שלב | קריטי לויזואל? | תלויות |
|---|-----|----------------|--------|
| 1 | הכנסת פונטים (Leland/Bravura) | **כן — מיידי** | אין |
| 2 | SYMBOLS map | כן | glyphnames.json |
| 3 | ENGRAVING constants | כן | metadata.json |
| 4 | Score model | לא (architecture) | אין |
| 5 | XML Parser | לא | model |
| 6 | Layout engine | חלקי | model |
| 7 | SVG Renderer (noteheads, staff, stems) | **כן** | symbols, engraving |
| 8 | React component | לא | renderer |
| 9 | Chord symbols | כן | LelandText |

**המלצה:** שלב 1 בלבד יכול כבר להוכיח את הרעיון — אם קיים renderer, החלפת הגופן לLeland תשנה מיד את הויזואל.

---

## קבצים לפתוח בסשן הבא

**לקרוא לפני פיתוח:**
1. `src/renderer/` — תיקייה קיימת? מה בתוכה?
2. `src/components/score/ScoreView.tsx` — מה ה-renderer הנוכחי עושה?
3. `webmscore/fonts/leland/leland_metadata.json` — לחלץ ערכים ל-ENGRAVING
4. `webmscore/fonts/smufl/glyphnames.json` — לאמת codepoints

**לא צריך לקרוא:**
- קוד C++ של webmscore (הבנו את המנגנון)
- שאר קבצי webmscore

---

## הערות חשובות

- **SMuFL fontSize:** גלייפים של SMuFL מתוכננים כך ש-1em = 4 staff-spaces. אז אם `STAFF_SPACE=8px`, אז `fontSize=32px`.
- **SVG text baseline:** ב-SVG, y של `<text>` הוא baseline. גלייפים של SMuFL יושבים על baseline. לנקודת ייחוס: מרכז ראש תו = baseline + (glyph height / 2). יש לכוונן.
- **Ligatures:** חלק מהסימנים (כמו tremolo) הם combination של גלייפים עם anchors — ניתן לטפל בשלב מאוחר.
- **לדר ליינס:** `ledgerLineExtension` מ-metadata — כמה הקו בולט מכל צד של ראש התו.
- **Verovio כהשוואה:** ה-SVG שVerovio מייצר כבר משתמש ב-Bravura/Leipzig — אפשר לבדוק מה font הוא שולח ולמה זה לא נראה טוב אצלנו (ייתכן font לא נטען).
