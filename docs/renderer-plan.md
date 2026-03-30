# MAP — תכנית בניית מנוע רינדור מותאם
## מבוסס על ניתוח webmscore | נכתב: 2026-03-31

---

## רקע: למה זה נראה טוב ב-webmscore

הסוד אינו באלגוריתם — הוא **בפונט**.

webmscore משתמש בפונט SMuFL (Standard Music Font Layout) בשם **Leland** (פותח ומוחזק ע"י MuseScore).
כל סמל מוזיקלי — ראש תו, מפתח סול, דיאז, פאוזה, טריולה, קשת — הוא **גליף Unicode בתוך הפונט**.
אין SVG paths בקוד. אין תמונות. אין ציור גאומטרי של צורות.

בנוסף לפונט, כל צורה של קו (עובי קו עוגן, עובי שוקת, עובי קו בר, עובי קשת) מוכתבת
מתוך **`engravingDefaults`** שנמצאים בקובץ `metadata.json` של הפונט.

**המסקנה:** אם נשתמש בפונט Leland + ב-`engravingDefaults` שלו, הרינדור ייראה זהה.

---

## ערכי engravingDefaults מ-Leland (יחידות: staff spaces = רווח בין קוי המשבצת)

```
staffLineThickness:       0.11   ← עובי קו משבצת
stemThickness:            0.10   ← עובי גבעול
beamThickness:            0.50   ← עובי שוקת
beamSpacing:              0.25   ← רווח בין שוקות
legerLineThickness:       0.16   ← עובי קו עוגן
legerLineExtension:       0.35   ← הארכת קו עוגן מעבר לראש התו
thinBarlineThickness:     0.18   ← קו בר דק
thickBarlineThickness:    0.55   ← קו בר עבה (בסוף)
barlineSeparation:        0.37   ← מרווח בין קו בר כפול
slurEndpointThickness:    0.07   ← עובי קצה קשת
slurMidpointThickness:    0.21   ← עובי מרכז קשת
tieEndpointThickness:     0.07
tieMidpointThickness:     0.21
tupletBracketThickness:   0.10   ← עובי סוגר טריולה
hairpinThickness:         0.12
textFontFamily:           ["Edwin", "serif"]  ← פונט טקסט (אקורדים, מילים)
```

---

## פונטים שיש להעתיק מ-webmscore

מיקום מקור: `C:\Users\DELL\Documents\webmscore\fonts\`

| קובץ | תפקיד | עדיפות |
|------|--------|--------|
| `leland/Leland.woff2` | פונט סמלים מוזיקליים ראשי | **חובה** |
| `leland/leland_metadata.json` | עוגנים + engraving defaults | **חובה** |
| `edwin/Edwin-Roman.woff2` | פונט טקסט (אקורדים, מספרי מידות) | **חובה** |
| `edwin/Edwin-Italic.woff2` | טקסט נטוי | מומלץ |
| `bravura/Bravura.woff2` | fallback עבור גליפים חסרים ב-Leland | מומלץ |
| `smufl/glyphnames.json` | מיפוי שם → codepoint Unicode | **חובה** |

---

## ארכיטקטורת הרינדור המוצעת

```
MusicXML string
      │
      ▼
[1] xmlParser (קיים) → NoteMap + HarmonyMap
      │
      ▼
[2] LayoutEngine (חדש)
    ├── חישוב מערכות (systems)
    ├── חישוב מידות לכל מערכת
    ├── מיקום כל אלמנט (x, y) ביחס לדף
    └── פלט: LayoutResult[]
      │
      ▼
[3] SVGRenderer (חדש)
    ├── טוען Leland.woff2 + Edwin
    ├── ממיר SymId → Unicode codepoint (מתוך glyphnames.json)
    ├── מצייר כל אלמנט כ-<text> עם הפונט
    ├── מצייר קווים (stems, beams, barlines, staff lines) כ-<line>/<rect>/<path>
    └── פלט: SVG string[] (דף אחד לכל פריט)
      │
      ▼
[4] ScoreView.tsx (קיים, שינוי מינימלי)
    └── dangerouslySetInnerHTML כמו היום
```

---

## שלבי הבנייה

---

### שלב 1 — תשתית פונטים ו-SMuFL
**קבצים ליצור:** `src/renderer/fonts/`, `src/renderer/smufl.ts`

**מה לעשות:**
1. להעתיק מ-webmscore לתיקיית `public/fonts/`:
   - `Leland.woff2`
   - `Edwin-Roman.woff2`
   - `Edwin-Italic.woff2`
   - `Bravura.woff2` (fallback)
   - `leland_metadata.json`
   - `glyphnames.json` (של SMuFL)

2. להוסיף ל-CSS (או `index.html`):
```css
@font-face {
  font-family: 'Leland';
  src: url('/fonts/Leland.woff2') format('woff2');
}
@font-face {
  font-family: 'Edwin';
  src: url('/fonts/Edwin-Roman.woff2') format('woff2');
}
```

3. לכתוב `src/renderer/smufl.ts`:
```typescript
// טוען glyphnames.json ומחזיר codepoint לפי שם גליף
// למשל: getCodepoint("noteheadBlack") → "\uE0A4"
export async function loadSmufl(): Promise<SmuflMap>
export function getCodepoint(map: SmuflMap, glyphName: string): string
```

4. לכתוב `src/renderer/engravingDefaults.ts`:
```typescript
// טוען leland_metadata.json ומייצא את ערכי engravingDefaults
// + פונקציית sp(n) שממירה staff-spaces לפיקסלים
export const ENGRAVING = { stemThickness, beamThickness, ... }
export function sp(staffSpaces: number, spatium: number): number
```

**בדיקה:** רנדר עמוד ריק עם 5 קוי משבצת בעובי הנכון.

---

### שלב 2 — Layout Engine: מבנה בסיסי
**קבצים ליצור:** `src/renderer/layout/`

**מה לעשות:**

#### 2a — מודל נתוני layout
```typescript
// src/renderer/layout/types.ts
interface StaffLayout {
  x: number; y: number; width: number;
  lines: 5; // תמיד 5
}
interface MeasureLayout {
  index: number;
  x: number; width: number;
  systemIndex: number;
  clef?: LayoutElement;
  keySignature?: LayoutElement;
  timeSignature?: LayoutElement;
  notes: NoteLayout[];
  barline: BarlineLayout;
}
interface NoteLayout {
  noteMapId: string;
  x: number;
  staffY: number; // מרחק ב-staff-spaces מקו ראשון
  symId: string;  // e.g. "noteheadBlack"
  stem?: StemLayout;
  accidental?: string; // symId
  ledgerLines: number[]; // staffY של כל קו עוגן
  beam?: BeamGroup;
  flag?: string; // symId
  dot?: boolean;
}
```

#### 2b — חישוב גובה תו
```typescript
// מחשב staffY מתוך pitch + clef + key
// staffY=0 → קו ראשון (E4 בסול), staffY=1 → רווח ראשון (F4), וכו'
function pitchToStaffY(step, octave, clef): number
```

#### 2c — חלוקת מידות למערכות (line breaking)
- קבע רוחב עמוד (למשל 1800px)
- לכל מידה: חשב רוחב מינימלי לפי מספר תווים × spacing
- מלא מערכת עד שנגמר המקום → פתח מערכת חדשה
- justify: מרווח את המידות לכסות את מלוא הרוחב

**⚠️ נקודה קריטית מ-webmscore:**
מיקום x של תווים בתוך מידה חייב להיות proportional לערך duration,
לא שווה. תו שלם תופס יותר מקום מתו שמינית.
נוסחה בסיסית: `x = measureX + noteSpacing * beatPosition`

---

### שלב 3 — SVG Renderer: קווי משבצת, מפתחות, גוש ציר
**קבצים ליצור:** `src/renderer/svg/`

#### 3a — staff lines
```typescript
function drawStaff(x, y, width, spatium, engraving): string {
  // 5 קווים, כל אחד: <line x1=x y1=y+i*spatium x2=x+width ...>
  // stroke-width = engraving.staffLineThickness * spatium
}
```

#### 3b — clef (מפתח)
```typescript
function drawClef(x, y, spatium, type: 'treble'|'bass'|'alto'): string {
  // treble → גליף "gClef" (U+E050)
  // bass   → גליף "fClef" (U+E062)
  // <text font-family="Leland" font-size="..." x=x y=y>גליף</text>
}
```

**⚠️ גודל פונט עבור גליפי SMuFL:**
`fontSize = spatium * 4` (4 staff-spaces = גובה גליף מלא)

#### 3c — time signature
```typescript
// גליף "timeSig4" = U+E084, "timeSig3" = U+E083, וכו'
// שניים מוצבים אחד מעל השני במרכז המשבצת
```

#### 3d — key signature
```typescript
// דיאזים: "accidentalSharp" U+E262, בסדר E/B/F#/C#/G#/D#/A# לפי מיקום קו
// במולים: "accidentalFlat" U+E260, בסדר B/E/A/D/G/C/F
```

---

### שלב 4 — SVG Renderer: תווים
**הגליפים החשובים:**

| symId | Unicode | תיאור |
|-------|---------|-------|
| `noteheadWhole` | U+E0A2 | שלם |
| `noteheadHalf` | U+E0A3 | חצי |
| `noteheadBlack` | U+E0A4 | שחור (רבע ומטה) |
| `accidentalSharp` | U+E262 | דיאז |
| `accidentalFlat` | U+E260 | במול |
| `accidentalNatural` | U+E261 | בקר |
| `restWhole` | U+E4E3 | פאוזה שלמה |
| `restHalf` | U+E4E4 | פאוזה חצי |
| `restQuarter` | U+E4E5 | פאוזה רבע |
| `restEighth` | U+E4E6 | פאוזה שמינית |
| `flag8thUp` | U+E240 | דגל שמינית למעלה |
| `flag8thDown` | U+E241 | דגל שמינית למטה |
| `augmentationDot` | U+E1E7 | נקודה |

#### 4a — ראש תו + דיאז/במול/בקר
```typescript
function drawNotehead(x, y, symId, accidental?, spatium): string
// accidental מוצב x - accidentalWidth - gap ממיקום הראש
```

#### 4b — גבעול (stem)
```typescript
function drawStem(x, noteY, stemEndY, spatium, engraving): string {
  // <line x1=x y1=noteY x2=x y2=stemEndY stroke-width=stemThickness*spatium>
  // x מתוך SMuFL anchor: stemUpSE / stemDownNW מה-metadata.json של Leland
}
```

**⚠️ חשוב ביותר — anchor points:**
metadata.json מכיל לכל גליף את `glyphsWithAnchors`:
```json
"noteheadBlack": {
  "stemUpSE":   [1.18,  -0.168],
  "stemDownNW": [0.0,    0.168]
}
```
יחידות: staff-spaces. זה קובע בדיוק היכן הגבעול מתחבר לראש התו.
**חייבים להשתמש בזה** — בלי זה הגבעול ייראה לא מחובר.

#### 4c — קווי עוגן (ledger lines)
```typescript
// לכל תו שמחוץ ל-5 הקווים: ציור <line> אופקי
// אורך = noteheadWidth + 2 * legerLineExtension * spatium
// עובי = legerLineThickness * spatium
```

#### 4d — נקודה (augmentation dot)
```typescript
// מוצבת ימינה לראש התו + gap קטן
// אם התו על קו → dot עולה חצי space למעלה
```

---

### שלב 5 — שוקות (Beams)
שוקות הן הדבר הוויזואלי המורכב ביותר. יש לבצע בשלב נפרד.

#### 5a — קיבוץ beam groups
מ-MusicXML: `<beam number="1">begin</beam>` / `continue` / `end`

#### 5b — חישוב נטיית השוקת
```
slope = (stemEndY_last - stemEndY_first) / (x_last - x_first)
// עם הגבלה: max slope = 0.5 staff-spaces per staff-space
```

#### 5c — ציור
```typescript
function drawBeam(notes: BeamedNote[], spatium, engraving): string {
  // <polygon> עם 4 נקודות (parallelogram)
  // עובי = beamThickness * spatium
  // רווח בין שוקות כפולות = beamSpacing * spatium
}
```

---

### שלב 6 — קשתות ו-Ties
קשתות הן עקומות Bézier.

```typescript
function drawSlurOrTie(x1, y1, x2, y2, direction: 'up'|'down', spatium, engraving): string {
  // עקומת Bézier מסדר 3:
  // נקודת שליטה 1: (x1 + dx*0.3, y1 + curve_height)
  // נקודת שליטה 2: (x2 - dx*0.3, y2 + curve_height)
  // <path d="M x1,y1 C cx1,cy1 cx2,cy2 x2,y2" ...>
  // stroke-width משתנה: endpointThickness בקצות, midpointThickness במרכז
  // פתרון: שתי paths: אחת outer, אחת inner (fill="white") ← טריק fill
}
```

---

### שלב 7 — אקורדים (Chord Symbols)
פונט: **Edwin-Roman** (לא Leland)

```typescript
function drawChordSymbol(x, y, root, quality, bass?, spatium): string {
  // root: "C", "F#", "Bb" וכו'
  // quality: "m", "7", "maj7", "dim", "aug" וכו'
  // <text font-family="Edwin" font-size="...">
  //   root + superscript(quality)
  // </text>
  // superscript: font-size קטן יותר + vertical-align
}
```

---

### שלב 8 — אינטגרציה עם ScoreView.tsx

**מה לשנות ב-ScoreView.tsx:**
```typescript
// במקום:
import VrvWorker from '../../workers/verovio.worker?worker'
// להשתמש ב:
import MAPRenderWorker from '../../workers/maprender.worker?worker'
```

**ה-worker החדש:**
```
src/workers/maprender.worker.ts
  ← מקבל: { type: 'render', xml: string, id: number }
  ← מחזיר: { type: 'result', svgs: string[], id: number }
  ← תהליך: xmlParser → LayoutEngine → SVGRenderer
```

**מה לא לשנות:**
- `buildVrvNoteIdMap()` — צריך לעדכן את ה-CSS class names (Verovio משתמש ב-`g.note`, אנחנו נגדיר משלנו)
- `elementMap` / `NoteElement` — שמר מבנה
- כל ה-overlay system (annotation, selection, freehand) — לא נוגעים

**מיפוי IDs:**
ב-SVG שלנו כל תו יקבל: `<g id="map-note-{noteMapId}" class="map-note">`
זה יחליף את Verovio's `g.note` ויאפשר שמירה על כל לוגיקת הצביעה הקיימת.

---

### שלב 9 — אופטימיזציה ויזואלית

#### 9a — spacing משופר
Optical spacing: תווים עם accidentals צריכים יותר מקום שמאלה.
לפי ידי הקפ המסורתית: `noteSpacing = baseSpacing * sqrt(duration/quarterDuration)`

#### 9b — justification אופקית
לאחר חישוב רוחב כל מידה → להפיץ מרווח עודף proportionally בין המידות.

#### 9c — stem direction לפי קול / מיקום ממוצע
```
if (averageStaffY > 2) → stems up
else → stems down
// (staffY=2 = מרכז המשבצת = B4 בסול)
```

---

## סדר ביצוע מומלץ

```
שלב 1  → fonts + smufl.ts + engravingDefaults.ts     [תשתית]
שלב 2  → layout types + pitchToStaffY + line-breaking [layout]
שלב 3  → staff lines + clef + time/key sig            [ציור בסיסי]
שלב 4  → noteheads + stems + ledger + dots            [תווים]
שלב 8  → אינטגרציה ראשונית עם ScoreView              [↑ בדיקה ראשונה]
שלב 5  → beams                                        [קיבוצי שמיניות]
שלב 6  → slurs/ties                                   [קשתות]
שלב 7  → chord symbols                                [אקורדים]
שלב 9  → fine-tuning                                  [ליטוש]
```

---

## קבצים שיש ליצור (סיכום)

```
public/fonts/
  Leland.woff2
  Bravura.woff2
  Edwin-Roman.woff2
  Edwin-Italic.woff2

src/renderer/
  smufl.ts              ← codepoint lookup
  engravingDefaults.ts  ← Leland metrics
  layout/
    types.ts
    layoutEngine.ts     ← entry point
    lineBreaker.ts
    pitchPosition.ts
    spacingEngine.ts
  svg/
    svgRenderer.ts      ← entry point
    drawStaff.ts
    drawClef.ts
    drawTimeSig.ts
    drawKeySig.ts
    drawNote.ts
    drawStem.ts
    drawBeam.ts
    drawSlur.ts
    drawChord.ts
    drawBarline.ts

src/workers/
  maprender.worker.ts   ← מחליף את verovio.worker.ts
```

---

## קבצים שלא לגעת בהם

- `src/services/xmlParser.ts` — עובד מצוין
- `src/services/xmlSanitizer.ts` — נשמור לצורך ניקוי MusicXML
- `src/components/score/AnnotationOverlay.tsx`
- `src/components/score/HarmonyOverlay.tsx`
- `src/components/score/SelectionOverlay.tsx`
- `src/components/score/FreehandCanvas.tsx`
- כל ה-stores

---

## מקורות לעיון בזמן הבנייה

| שאלה | לאן ללכת |
|------|----------|
| איזה SymId משמש לגליף X | `webmscore/fonts/smufl/glyphnames.json` |
| anchor points של גליף | `webmscore/fonts/leland/leland_metadata.json` → `glyphsWithAnchors` |
| מה engravingDefault ל-X | `webmscore/fonts/leland/leland_metadata.json` → `engravingDefaults` |
| איך webmscore מחשב layout | `webmscore/src/engraving/layout/layoutmeasure.cpp` |
| איך webmscore מצייר גבעול | `webmscore/src/engraving/libmscore/chord.cpp` |
| איך webmscore מצייר שוקות | `webmscore/src/engraving/layout/layoutbeams.cpp` |
| איך webmscore מצייר קשתות | `webmscore/src/engraving/libmscore/slurtie.cpp` |
