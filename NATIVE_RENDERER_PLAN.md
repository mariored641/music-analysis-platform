# MAP Native Renderer — תוכנית בנייה מלאה

## מטרה

להחליף את Verovio בـ**renderer מוזיקלי נייטיב**, כתוב ב-TypeScript/SVG, שרץ לחלוטין בתוך MAP. אין תלות ב-WASM חיצוני, אין קופסה שחורה — כל רכיב גאומטרי, כל SVG element, שייך לנו ונמצא תחת שליטתנו המלאה.

### מה מניע את ההחלטה

- Verovio הוא WASM — אין גישה ל-internal geometry, IDs אפמריים, positional matching שבריר
- כל בעיה ויזואלית דורשת workarounds מחוץ לשליטתנו
- אנחנו רוצים: לכל תו — `{x, y, width, height, svgElement, noteId}` — ישירות, ללא תרגום
- הניסיון עם JJazzLab הוכיח: שיכפול ל-native = שליטה אמיתית

### scope מלא

- Lead sheets וג'אז (treble + chord symbols) — DONNALEE.XML ודומים
- יצירות קלאסיות — SATB, פסנתר (treble + bass), multiple voices, ties, slurs
- כל מה ש-MAP תומך בו עכשיו ובעתיד

---

## שלב 0 — מחקר ארכיטקטורה (Claude Code)

**מטרה:** להבין את האלגוריתמים של MuseScore / webmscore לפני שכותבים שורת קוד.

### משימות

1. **הורד את webmscore source** מ-GitHub (`webmscore` repo + `MuseScore` v3 source)
2. **סרוק קבצים מרכזיים:**
   - `libmscore/layout.cpp` — measure width, system breaking, vertical spacing
   - `libmscore/chord.cpp` — stem direction, beam grouping
   - `libmscore/beam.cpp` — beam angle, beam levels
   - `libmscore/note.cpp` — notehead position, accidental offset
   - `libmscore/harmony.cpp` — chord symbol layout
   - `importmxl/importmxl.cpp` — MusicXML parsing (להבין מה הם עושים שאנחנו לא)
3. **בנה מסמך `RENDERER_ALGORITHMS.md`** עם:
   - פסאודוקוד של כל אלגוריתם מרכזי
   - אילו פרמטרים מחשבים measure width
   - כיצד system breaking עובד (Knuth-Plass style?)
   - כיצד beams מחושבים (angle, stem length)
   - כיצד accidentals מוזזים כדי למנוע collision
   - כיצד voices מרובות מטופלות (offset בין voice 1 ו-2)

### פלט שלב 0

- `RENDERER_ALGORITHMS.md` — מסמך ארכיטקטורה מפורט
- הערכת זמן מעודכנת לשלבים הבאים

---

## שלב 1 — Core Architecture + Data Model ✅ הושלם

**מטרה:** להגדיר את ה-data model המלא של ה-renderer לפני שמצייר שורה אחת.

### `RendererModel` — המבנה הפנימי

```typescript
// הפלט של Layout Engine — input ל-Renderer
interface RenderedScore {
  pages: RenderedPage[]
  metadata: ScoreMetadata
}

interface RenderedPage {
  width: number
  height: number
  systems: RenderedSystem[]
}

interface RenderedSystem {
  y: number
  staves: RenderedStaff[]
  measures: RenderedMeasure[]
}

interface RenderedStaff {
  staffIndex: number    // 0 = treble, 1 = bass, etc.
  y: number             // top of staff (5 lines)
  lineSpacing: number   // מרווח בין שורות (בפיקסלים)
}

interface RenderedMeasure {
  measureNum: number
  x: number
  width: number
  staffIndex: number
  notes: RenderedNote[]
  chordSymbols: RenderedChordSymbol[]
  beams: RenderedBeam[]
  barlines: RenderedBarline[]
}

interface RenderedNote {
  noteId: string            // noteMap ID — אותו פורמט: note-m4b300-E5
  x: number                 // center of notehead
  y: number                 // center of notehead
  staffLine: number         // 0 = top line, 4 = bottom line, fractions = spaces
  stemUp: boolean
  stemX: number
  stemYTop: number
  stemYBottom: number
  noteheadType: 'whole' | 'half' | 'quarter' | 'x' | 'diamond'
  accidental?: 'sharp' | 'flat' | 'natural' | 'dsharp' | 'dflat'
  accidentalX?: number
  dotted: boolean
  dotX?: number
  voice: number             // 1–4
  svgId: string             // = noteId — יציב, לא אפמרי
}

interface RenderedChordSymbol {
  measureNum: number
  beat: number
  x: number
  y: number
  text: string
  svgId: string
}

interface RenderedBeam {
  notes: string[]           // noteIds
  angle: number
  levels: number            // כמה beam lines (1=eighth, 2=16th...)
  points: { x1: number; y1: number; x2: number; y2: number }[]
}

interface RenderedBarline {
  x: number
  type: 'regular' | 'double' | 'final' | 'repeat-start' | 'repeat-end'
}
```

### פלט שלב 1 ✅

- `src/renderer/types.ts` — כל ה-interfaces (נוצר)
- אין קוד rendering עדיין

---

## שלב 2 — MusicXML Parser מורחב

**מטרה:** להרחיב את `xmlParser.ts` הקיים כדי לשלוף את כל המידע שה-renderer צריך.

### מה מוסיפים (מעבר ל-parser הקיים)

- **Multiple voices** — voice 1–4 לכל note
- **Beaming** — `<beam>` elements מ-XML (begin/continue/end)
- **Ties** — start/stop, לאיזה note מחובר, flag `crossSystem` אם חוצה שורה
- **Slurs** — start/stop + placement (above/below), flag `crossSystem`
- **Courtesy accidentals** — accidental שמוצג מחדש לאחר שהפך לטבעי, או כתזכורת בתחילת תיבה אחרי שינוי
- **Grace notes** — `<grace/>` flag
- **Multiple staves** — staff index לכל note (חלקית קיים)
- **Tuplets** — `<tuplet>` + `<time-modification>`
- **Dynamics** — `<dynamics>` + placement
- **Articulations** — staccato, accent, tenuto, etc.
- **Fermatas**
- **Trills, ornaments**
- **Repeat signs** — `<barline>` עם `<repeat direction="forward/backward">`
- **Volta brackets** — `<ending>`
- **Clef changes** — mid-score clef changes
- **Key changes** — mid-score key changes
- **Tempo markings** — `<metronome>` + `<words>`

### פלט שלב 2

- `src/renderer/xmlExtractor.ts` — parser מורחב שבונה `ExtractedScore`
- `src/renderer/extractorTypes.ts` — types של ה-extracted data (לפני layout)
- test: DONNALEE.XML + לפחות יצירה קלאסית אחת עם SATB

---

## שלב 3 — Layout Engine: Horizontal

**מטרה:** לחשב את הגיאומטריה האופקית — כמה רחב כל תיבה, היכן יושב כל תו.

### 3a — Note Spacing

**עיקרון:** כל note value מקבל רוחב proportional לפי logarithm — **additive, לא multiplicative**.

```
// ✅ נכון — מבוסס MuseScore v3 source (RENDERER_ALGORITHMS.md §2.1)
stretch(note) = 1.0 + 0.865617 * log2(note.ticks / minTick)
// minTick = ערך הנוף הקצר ביותר בתיבה
// דוגמה: אם minTick=16th, אז quarter → stretch=2.73 (לא 4×)
```

- Minimum measure width = sum of segment widths + padding
- Accidentals מוסיפים רוחב לשמאל

### 3b — Measure Width Normalization

לאחר חישוב minimum widths, ה-system צריך להתמלא לרוחב המלא:
- חשב sum של minimum widths בשורה
- חלק את ה-slack בין כל התיבות proportionally

### 3c — System Breaking

**אלגוריתם greedy (בשלב ראשון):**
1. צבור תיבות בשורה עד שהרוחב עולה על `pageWidth - margins`
2. כשחורג — שבור שורה, התחל system חדש
3. אם תיבה אחת לא נכנסת לשום שורה — reduce scale

**שיפור עתידי (שלב 7):** Knuth-Plass (dynamic programming) לתוצאות יותר יפות.

### 3e — Page Breaking

לאחר חישוב כל ה-systems, עוברים לדף חדש כשהגובה הנצבר עולה על `pageHeight - margins`:

```
currentY = pageTopMargin
pages = [[]]

for each system:
    systemHeight = system.staves * staffHeight + system.staves * staffDistance
                   + dynamicsSpace  // אם יש dynamics/text מתחת

    if currentY + systemHeight > pageHeight - pageBottomMargin:
        pages.push([])          // דף חדש
        currentY = pageTopMargin

    pages.last().push(system)
    currentY += systemHeight + systemSpacing
```

- הראשון בכל דף מקבל system header (clef + key + time) מחדש
- `pageHeight` = 1122px (A4 portrait @ 96dpi), configurable

### 3f — Key & Time Signature + Clef

- Clef: רוחב קבוע (32px), מופיע בתחילת כל system
- Key signature: 7px per accidental
- Time signature: רוחב קבוע (24px)
- אלה מחוסרים מהרוחב הפנוי לתווים

### פלט שלב 3

- `src/renderer/horizontalLayout.ts`
- test: layout נכון של DONNALEE.XML (אפשר לבדוק vs Verovio)

---

## שלב 4 — Layout Engine: Vertical

**מטרה:** לחשב את הגיאומטריה האנכית — מיקום כל תו על הסולם, stems, beams, מרווחים בין staves.

### 4a — Staff Line Positions

```
staffTop = systemY + staffIndex * staffSpacing
lineY[i] = staffTop + i * lineSpacing   // lineSpacing ≈ 10px
```

### 4b — Note Vertical Position

```
// ✅ נכון — מבוסס MuseScore v3 source (RENDERER_ALGORITHMS.md §21)
// diatonicStep: C=0, D=1, E=2, F=3, G=4, A=5, B=6
staffLine = clefOffset - (diatonicStep + octave * 7)

// clefOffset מאומת:
//   treble: offset=38  (top line = F5, middle C = line 10)
//   bass:   offset=26  (top line = A3, middle C = line -4 — above staff)

noteY = staffTop + staffLine * (lineSpacing / 2)
// line=0 → top staff line, line=8 → bottom staff line
// lineSpacing/2 = 5px (כל half-step = 5px אנכית)
```

### 4c — Stem Direction

**כלל בסיסי:**
- Note above middle of staff (line 3) → stem down
- Note below middle → stem up
- לכמה תווים ב-chord: לפי הרחוק ביותר מהאמצע

**Multiple voices:**
- Voice 1: stems always up
- Voice 2: stems always down
- Voice 3: stems up (offset ימינה)
- Voice 4: stems down (offset ימינה)

### 4d — Stem Length

- Standard: 3.5 spaces (35px אם lineSpacing=10)
- Beamed notes: stem מתארך/מתקצר לפי beam angle

### 4e — Ledger Lines

- כל note מחוץ ל-5 lines → חשב כמה ledger lines נדרשות ומיקומן
- ledger line width = notehead width + 4px padding משני הצדדים

### 4f — Beam Calculation

```
// המיקום של ה-beam נקבע לפי הnote הראשון והאחרון ב-group
beamY_start = firstNote.stemTip
beamY_end = lastNote.stemTip
angle = (beamY_end - beamY_start) / (lastNote.x - firstNote.x)
// Clamp angle: max ±0.1 (כ-6 מעלות)
// כל note ב-group: stem tip = beamY at note's x position
```

### 4g — Accidental Collision Avoidance

- מיין accidentals לפי pitch (מלמטה למעלה)
- stack אותם ימינה כאשר overlapping vertically
- Standard algorithm: column-based stacking (כמו MuseScore)

### 4h — Courtesy Accidentals

accidental מוצג כשמתקיים אחד מהתנאים:
1. ה-`<alter>` שונה מה-key signature (accidental "אמיתי")
2. ה-`<alter>` חוזר לטבעי אחרי שהיה altered באותה תיבה (natural sign)
3. אותה note מופיעה שוב באותה תיבה עם `<alter>` שונה ממה שהיה לפניה
4. MusicXML מכיל `<accidental>` element מפורש — תמיד מציגים (courtesy/cautionary)

```
// State per measure, per pitch-class:
accidentalState: Map<pitchClass, alter>  // מתאפס בכל תיבה

for each note:
  expectedAlter = keySignature.alterFor(note.step)
  if note.alter != accidentalState.get(note.pitchClass) ?? expectedAlter:
      note.showAccidental = true
      accidentalState.set(note.pitchClass, note.alter)
  elif note.hasExplicitAccidentalElement:
      note.showAccidental = true  // courtesy — מוצג בסוגריים
```

### 4h — Vertical System Spacing

- מרווח בין staves בתוך system: `staffSpacing` (constant, ≈ 60px)
- מרווח בין systems: `systemSpacing` (≈ 80px)
- גדל אוטומטית אם יש הרבה dynamics/text מעל/מתחת

### פלט שלב 4

- `src/renderer/verticalLayout.ts`
- פלט: `RenderedScore` מלא עם כל הקואורדינטות

---

## שלב 5 — SVG Renderer

**מטרה:** להפוך את `RenderedScore` ל-SVG בפועל.

### 5a — Glyphs

**גרסה ראשונה:** Unicode music symbols — פשוט, עובד בכל browser.

**גרסה מתקדמת (שלב 8):** Bravura SVG paths — איכות engraving אמיתית.

| רכיב | Unicode | גרסה מתקדמת |
|------|---------|------------|
| Whole notehead | `𝅝` | bravura path |
| Half notehead | `𝅗` | bravura path |
| Quarter notehead | ellipse | bravura path |
| Treble clef | `𝄞` | bravura path |
| Sharp | `♯` | bravura path |
| Flat | `♭` | bravura path |

### 5b — SVG Structure (קריטי — זה ה-breakthrough)

כל `RenderedNote` מקבל SVG ID שהוא **אותו noteMap ID**:

```xml
<g class="note" id="note-m4b300-E5" data-measure="4" data-beat="3.0" data-voice="1">
  <ellipse class="notehead" cx="142" cy="87" rx="5.5" ry="4.2" />
  <line class="stem" x1="147" y1="87" x2="147" y2="57" />
  <text class="accidental" x="133" y="91">♭</text>
</g>
```

**זה מה שנותן לנו שליטה מלאה:**
- `document.getElementById('note-m4b300-E5')` — ישיר, ללא תרגום
- `toVrv` map — **לא נדרש יותר**
- `fromVrv` map — **לא נדרש יותר**
- `buildVrvNoteIdMap` positional matching — **נמחק לחלוטין**

### 5c — Layers ב-SVG

```xml
<svg class="map-score">
  <g class="layer-staff-lines" />
  <g class="layer-barlines" />
  <g class="layer-clefs" />
  <g class="layer-key-signatures" />
  <g class="layer-time-signatures" />
  <g class="layer-notes" />           <!-- כל note עם id=noteMapId -->
  <g class="layer-beams" />
  <g class="layer-ties" />
  <g class="layer-slurs" />
  <g class="layer-chord-symbols" />
  <g class="layer-dynamics" />
  <g class="layer-articulations" />
  <g class="layer-ornaments" />
  <!-- Overlays שלנו מעל הכל — ללא שינוי -->
  <g class="layer-selection-overlay" />
  <g class="layer-annotation-overlay" />
</svg>
```

### 5d — Ties & Slurs

Bezier curves:
```
// Tie: מ-notehead אחד לשני
// stem up → tie below note; stem down → tie above note
<path d="M x1,y1 C cx1,cy1 cx2,cy2 x2,y2"
      class="tie" fill="none" stroke="black" stroke-width="1.5"/>
```

### 5e — Cross-System Ties & Slurs

Tie/slur שמתחיל בסוף שורה אחת ומסתיים בתחילת השורה הבאה — מצייר **שני חצאי קשת נפרדים**:

```
// חצי ראשון: מה-note בסוף שורה עד קצה ה-system
tie_part1:
  x1 = startNote.noteheadRight + padding
  x2 = system.rightEdge
  // control points: קשת פתוחה ימינה (אין נקודת סיום אמיתית)
  cp1 = { x: x1 + (x2-x1)*0.4, y: arcY }
  cp2 = { x: x2,               y: arcY }

// חצי שני: מתחילת ה-system הבא עד ה-note
tie_part2:
  x1 = nextSystem.leftEdge + afterHeaderWidth
  x2 = endNote.noteheadLeft - padding
  cp1 = { x: x1,               y: arcY }
  cp2 = { x: x1 + (x2-x1)*0.6, y: arcY }
```

זיהוי: ב-xmlExtractor, note עם `<tie type="start">` שה-target שלו נמצא ב-system אחר → מסומן `crossSystem: true`.
אותו עיקרון ל-slurs.

### פלט שלב 5

- `src/renderer/svgRenderer.ts`
- פלט: SVG string מלא עם IDs יציבים

---

## שלב 6 — אינטגרציה ב-MAP

**מטרה:** להחליף את Verovio ב-renderer שלנו ב-ScoreView, מבלי לשבור שום דבר אחר.

### 6a — ScoreView Refactor

```typescript
// לפני:
import createVerovioModule from 'verovio/wasm'
const svg = tk.renderToSVG(page, false)

// אחרי:
import { renderScore } from './renderer/index'
const { svg, renderedNotes } = renderScore(xmlString, options)
```

### 6b — elementMap — ישירות מה-renderer

```typescript
// לפני: buildElementMap סורק SVG אחרי render
// אחרי: renderer מחזיר geometry ישירות
const elementMap = new Map(
  renderedNotes.map(n => [`measure-${n.measureNum - 1}`, n.bbox])
)
// toVrv / fromVrv — לא נדרשים יותר
```

### 6c — Click Detection — פשוט הרבה יותר

```typescript
// לפני: e.target.closest('g.note') → fromVrv lookup → noteMapId
// אחרי:
const noteEl = e.target.closest('g.note')
const noteId = noteEl?.id  // ישירות 'note-m4b300-E5' — זהו
```

### 6d — מה לא משתנה (כלום)

| רכיב | שינוי |
|------|-------|
| `annotationStore` | ✅ ללא שינוי |
| `selectionStore` | ✅ ללא שינוי |
| `AnnotationOverlay` | ✅ ללא שינוי (עובד על noteMapIds) |
| `SelectionOverlay` | ✅ פשטות — אין צורך בתרגום toVrv |
| כל ה-scripts | ✅ ללא שינוי |
| `LeftPanel`, `RightPanel` | ✅ ללא שינוי |
| `libraryStore`, IndexedDB | ✅ ללא שינוי |
| `FormalStrip` | ✅ ללא שינוי |
| `FreehandCanvas` | ✅ ללא שינוי |

### פלט שלב 6

- `ScoreView.tsx` מעודכן — פחות קוד, פחות complexity
- MAP עובד end-to-end עם ה-renderer החדש
- Verovio dependency — מסיר מ-package.json

---

## שלב 7 — Full Classical Support

**מטרה:** לטפל בכל ה-edge cases שמופיעים ביצירות קלאסיות.

### 7a — Multiple Voices

- Voice 1+2 על אותו staff — notes על אותה עמודה עם stems בכיוונים שונים
- Offset אופקי קטן כשפיצ'ים זהים
- Rest positioning לפי voice (voice 1 rests למעלה, voice 2 למטה)

### 7b — Grand Staff (Treble + Bass)

- שני staves, bracket/brace שמאל
- Notes שמתפרסות בין staves (cross-staff beaming)
- Pedal markings (`𝄌`)

### 7c — Tuplets

- `<time-modification>` מ-XML
- Bracket מעל/מתחת עם מספר (3, 5, 6, 7)
- Horizontal centering של ה-number

### 7d — Volta Brackets & Repeats

- Repeat barlines (thick + thin + dots)
- Prima/seconda volta brackets עם קו מעל
- Dal Segno / Da Capo text

### 7e — Text Elements

- Tempo markings (Allegro, ♩=120)
- Rehearsal marks (A, B, C — boxed)
- Lyrics — תחת staff, syllable-by-syllable, melisma lines
- Fingerings — מעל/מתחת notes, אוטומטי לפי stem direction

### 7f — Advanced Articulations

- Hairpins (crescendo/decrescendo) — bezier-aligned לכיוון ה-staff
- Ottava brackets (8va, 8vb) עם dotted line
- Trill extensions
- Glissandos

### 7g — System Breaking משופר (Knuth-Plass)

Dynamic programming במקום greedy — מחלק measures לשורות ב-optimal balance.

### פלט שלב 7

- Support מלא ל-SATB, פסנתר, ועוד
- Test suite מול לפחות 5 קבצי XML קלאסיים שונים

---

## שלב 8 — Glyph Quality Upgrade (Bravura)

**מטרה:** להחליף Unicode symbols בـBravura glyphs לאיכות engraving אמיתית.

### הגישה

- [Bravura](https://github.com/steinbergmedia/bravura) — Standard Music Font Layout (SMuFL), קוד פתוח מ-Steinberg
- כל glyph = SVG path קבוע (לא תלוי ב-font rendering)
- `src/renderer/glyphs/bravura.ts` — `Map<glyphName, svgPathD>`
- ה-renderer קורא `getGlyph('noteheadBlack')` — לא יודע ולא אכפת לו מהמקור

### תוצאה

- איכות ויזואלית ברמת Sibelius / Finale
- No font dependencies — הכל embedded ב-bundle
- Consistent rendering בכל browser ו-OS

---

## ארכיטקטורת קבצים סופית

```
src/
  renderer/
    index.ts                 — public API: renderScore(xml, options) → {svg, notes, elementMap}
    types.ts                 — RenderedScore, RenderedNote, RenderedMeasure, etc.
    extractorTypes.ts        — ExtractedScore (pre-layout, pure MusicXML data)
    xmlExtractor.ts          — MusicXML → ExtractedScore
    horizontalLayout.ts      — measure widths, system breaking, note x-positions
    verticalLayout.ts        — staff lines, note y-positions, stems, beams
    svgRenderer.ts           — RenderedScore → SVG string
    glyphs/
      index.ts               — getGlyph(name) → SVG path or unicode char
      unicode.ts             — גרסה ראשונה (fast, good enough)
      bravura.ts             — גרסה מלאה (שלב 8)
    utils/
      pitchToStaffLine.ts    — pitch name + octave → staff line number
      durationToWidth.ts     — note duration → proportional width
      beamCalculator.ts      — beam groups → beam geometry
      accidentalStack.ts     — collision avoidance for accidentals
      bezier.ts              — ties, slurs, hairpins as bezier curves
      systemBreaker.ts       — greedy / Knuth-Plass system breaking
```

---

## שלב 5.5 — Bugfix Pass (אחרי Checkpoint B)

> **סטטוס:** ⬜ הבא לביצוע
>
> Checkpoint B הושלם, אך הביקורת הויזואלית גילתה 8 בעיות קריטיות.
> יש לתקן אותן לפני שממשיכים לשלב 6.
> **מטרה:** RendererTestView יראה כמו Verovio / MuseScore.

---

### BUG 1 — חמשה כפולה (phantom staff)

**תסמין:** כל system מציג 2 staves — אחת עם תווים ואחת ריקה מתחת.
אקורדים של השורה הבאה נתקעים בתוך החמשה הריקה.

**אבחנה:** `score.metadata.staffCount = 2` ב-DONNALEE.XML כי ה-XML מכיל `<staves>2</staves>`.
ב-`verticalLayout.ts` לולאת staves רצה על `score.metadata.staffCount`, יוצרת 2 staves/system.

**תיקון — `verticalLayout.ts`:**
```typescript
// במקום: Math.max(1, score.metadata.staffCount)
// מצא אילו staffIndex בפועל יש לנו בתווים:
const activeStaffIndices = new Set(
  score.measures.flatMap(m => m.notes.filter(n => !n.isRest).map(n => n.staffIndex))
)
const effectiveStaffCount = Math.max(1, activeStaffIndices.size)
// רנדר רק staves שיש להם תווים
```

---

### BUG 2 — שקטים מצוירים כתווים (ghost half-notes)

**תסמין:** בכל תיבה יש תו-חצי פתוח על אותה גובה — אלה שקטים שמצוירים כ-noteheads.
גם: אין סימני שקט ויזואליים על תיבות ריקות.

**אבחנה:**
- `RenderedNote` אין לו שדה `isRest`
- ב-`svgRenderer.ts` כל note מצויר כ-ellipse (open/filled) ללא הבחנה
- שקטים מקבלים `noteheadType='whole'/'half'/'quarter'` → מצוירים כ-noteheads

**תיקון — 3 שלבים:**

**1. `types.ts` — הוסף `isRest`:**
```typescript
interface RenderedNote {
  // ... existing fields
  isRest: boolean   // ADD THIS
}
```

**2. `verticalLayout.ts` — העבר `isRest`:**
```typescript
noteList.push({
  // ...
  isRest: en.isRest,
  // ...
})
```

**3. `svgRenderer.ts` — render rests as symbols:**
```typescript
function renderNote(rn: RenderedNote, sp: number): string {
  if (rn.isRest) return renderRest(rn, sp)
  // ... existing notehead code
}

function renderRest(rn: RenderedNote, sp: number): string {
  const staffTop = rn.y - rn.staffLine * (sp / 2)  // reconstruct staff top
  // מיקומי שקטים לפי MuseScore:
  switch (rn.noteheadType) {
    case 'whole': {
      // Whole rest: filled rectangle hanging BELOW 2nd staff line from top
      // y = staffTop + 1*sp (2nd line), hangs down by restH
      const restW = sp * 1.4, restH = sp * 0.55
      const ry = staffTop + sp - restH   // hang below line
      return `<g class="rest" id="${esc(rn.noteId)}"><rect x="${n(rn.x - restW/2)}" y="${n(ry)}" width="${n(restW)}" height="${n(restH)}" fill="${FILL_COLOR}"/></g>`
    }
    case 'half': {
      // Half rest: filled rectangle sitting ON 3rd line from top
      const restW = sp * 1.4, restH = sp * 0.55
      const ry = staffTop + 2*sp          // sits on 3rd line
      return `<g class="rest" id="${esc(rn.noteId)}"><rect x="${n(rn.x - restW/2)}" y="${n(ry)}" width="${n(restW)}" height="${n(restH)}" fill="${FILL_COLOR}"/></g>`
    }
    case 'quarter': {
      // Quarter rest: Unicode ‛𝄽' or simple zigzag
      // Use Unicode for now (U+1D13D)
      return `<g class="rest" id="${esc(rn.noteId)}"><text x="${n(rn.x)}" y="${n(staffTop + 3*sp)}" text-anchor="middle" font-size="${n(sp*3.5)}" font-family='"Segoe UI Symbol","Symbola",serif' fill="${FILL_COLOR}">\u{1D13D}</text></g>`
    }
    default: {
      // Eighth/16th rest: Unicode 𝄾/𝄿
      const glyphs: Record<string, string> = { quarter: '\u{1D13D}', eighth: '\u{1D13E}', '16th': '\u{1D13F}', '32nd': '\u{1D140}' }
      const g = glyphs[rn.noteheadType === 'quarter' ? 'quarter' : 'eighth'] || '\u{1D13E}'
      return `<g class="rest" id="${esc(rn.noteId)}"><text x="${n(rn.x)}" y="${n(staffTop + 2.5*sp)}" text-anchor="middle" font-size="${n(sp*2.5)}" font-family='"Segoe UI Symbol","Symbola",serif' fill="${FILL_COLOR}">${g}</text></g>`
    }
  }
}
```

---

### BUG 3 — אקסידנטלס: מוסתרים, מעוכים, צד לא נכון

**תסמין:** ♭♯♮ נדחסים לתוך התו, מוצגים מתחת (לא מיושרים), ולפעמים משמאל לקו-תיבה.

**אבחנה:**
- `accidentalW = sp * 0.8` — קטן מדי; font glyph אמיתי: ♭≈1.2sp, ♯≈1.0sp
- anchor y: `rn.y + sp * 0.5` — ירוד מדי, גורם לחפיפה
- אין בדיקה שה-accidentalX לא חורג מגבול התיבה

**תיקון — `verticalLayout.ts`:**
```typescript
const ACCIDENTAL_WIDTH: Record<string, number> = {
  'sharp': 1.0,    // × sp
  'flat':  1.2,
  'natural': 0.9,
  'double-sharp': 1.1,
  'double-flat':  1.4,
  'courtesy-sharp': 1.4,
  'courtesy-flat':  1.6,
  'courtesy-natural': 1.3,
}

// בחישוב accidentalX:
const accW = (ACCIDENTAL_WIDTH[accidentalType] ?? 1.0) * sp
const accGap = sp * 0.2
accidentalX = noteX - noteheadRx - accGap - accW
// clamp: never left of measure start + small padding
accidentalX = Math.max(hMeasure.x + 2, accidentalX)
```

**תיקון anchor y — `svgRenderer.ts`:**
```typescript
// במקום: y="${n(rn.y + sp * 0.5)}"
// anchor y שמיישר את ה-glyph למרכז ה-notehead:
y="${n(rn.y + sp * 0.35)}"  // ♭ and ♯ need different offsets
// לכל גליף בנפרד:
const yOffsets: Record<AccidentalType, number> = {
  'flat': 0.7, 'sharp': 0.45, 'natural': 0.45,
  'double-sharp': 0.35, 'double-flat': 0.7, ...
}
```

---

### BUG 4 — Tie קשת משולשת/חדה

**תסמין:** קשת ה-Tie נראית כמו משולש מחודד, לא קשת עגולה.

**אבחנה:** שתי נקודות הבקרה של bezier במקום אחד (midpoint x):
```typescript
// קוד נוכחי — שגוי:
{ cx1: mid, cy1: arcY, cx2: mid, cy2: arcY }
// זה יוצר עקומה S/triangle כי שתי נקודות בקרה זהות
```

**תיקון — `verticalLayout.ts` פונקציה `buildTies`:**
```typescript
const spread = (x2 - x1) * 0.35   // 35% מהרוחב
const path: BezierArc = {
  x1, y1: a.y,
  cx1: x1 + spread, cy1: arcY,    // נקודת בקרה ראשונה — שליש מהדרך
  cx2: x2 - spread, cy2: arcY,    // נקודת בקרה שניה — שני-שלישים
  x2, y2: b.y,
}
// arcHeight: שלילי = מעל, חיובי = מתחת
const arcHeight = above ? -sp * 1.5 : sp * 1.5
const arcY = a.y + arcHeight
```

---

### BUG 5 — פרופורציות תווים (notehead shapes)

**תסמין:** התווים נראים "כתב יד" — אליפסות ישרות, לא דומים ל-MuseScore.

**שורש:** MuseScore/Bravura noteheads הם:
1. **מוטות** (tilted) ~20° שמאלה (נגד השעון)
2. **שטוחים יותר**: ry/rx ≈ 0.68 (אנחנו: 0.42/0.55 ≈ 0.76 — עגול מדי)
3. **Filled notehead**: שוליים חדים (ellipse ממולא), לא soft

**תיקון — `svgRenderer.ts` פונקציה `renderNote`:**
```typescript
// במקום <ellipse .../>:
// שים transform="rotate(-20, cx, cy)" על ה-ellipse

// Whole note (open, no tilt, wider):
`<ellipse cx="${n(rn.x)}" cy="${n(rn.y)}" rx="${n(rx*1.2)}" ry="${n(ry*0.9)}" fill="white" stroke="${STROKE_COLOR}" stroke-width="1.8"/>`
// ובתוכה חור לבן מוטה (whole note middle hole):
`<ellipse cx="${n(rn.x)}" cy="${n(rn.y)}" rx="${n(rx*0.55)}" ry="${n(ry*0.5)}" fill="white" transform="rotate(-30, ${n(rn.x)}, ${n(rn.y)})"/>`

// Half note (open, tilted):
`<ellipse cx="${n(rn.x)}" cy="${n(rn.y)}" rx="${n(rx)}" ry="${n(ry*0.9)}" fill="white" stroke="${STROKE_COLOR}" stroke-width="1.5" transform="rotate(-20, ${n(rn.x)}, ${n(rn.y)})"/>`

// Quarter / shorter (filled, tilted):
`<ellipse cx="${n(rn.x)}" cy="${n(rn.y)}" rx="${n(rx)}" ry="${n(ry*0.9)}" fill="${FILL_COLOR}" transform="rotate(-20, ${n(rn.x)}, ${n(rn.y)})"/>`

// קבועים מעודכנים:
const NOTEHEAD_RX_SP = 0.55   // ללא שינוי
const NOTEHEAD_RY_SP = 0.38   // מ-0.42 ← שטוח יותר
```

**הערה:** Stem position עם tilt: אם notehead מוטה, גבעול צריך להצמד לנקודת הקצה של האליפסה המוטה, לא לקצה האופקי. להשתמש ב-`stemX = rn.x ± rx * cos(20°)`, `stemY_start = rn.y ∓ ry * sin(20°)`.

---

### BUG 6 — מפתח סול: גליף מוכחל ולא מיושר

**תסמין:** מפתח סול (𝄞) נראה קטן, מוסט, ולא מיושר לחמשה.

**אבחנה:**
1. Unicode U+1D11E תלוי בפונט שמותקן — `"Segoe UI Symbol"` ב-Windows מציג את ה-glyph אחרת מ-Mac/Linux
2. Anchor point: הגליף מיושר ל-`baseline` של `<text>` — לא לנקודה מוגדרת על הגליף
3. `clef.y = primaryStaffTop + 2*sp`, `yAdj = clef.y + sp*2.5` — לא מדויק

**תיקון — `svgRenderer.ts`:**
```typescript
// Treble clef: הקרל של ה-G צריך לעטוף את קו G (second line from bottom = staffTop + 3*sp)
// הגליף ב-Segoe UI Symbol: bottom of glyph ≈ staffBottom + 2sp
// הגבה האמיתית של הגליף ≈ 7×sp

function renderClef(clef: RenderedClefSymbol, sp: number): string {
  if (clef.clef === 'treble') {
    const staffBottom = clef.y + sp * 2  // clef.y = anchor = 3rd staff line
    // יישור: גבעול ה-clef יוצא מ-staffBottom + sp
    const yAnchor = staffBottom + sp * 1.2
    const fontSize = sp * 7.0  // גדול יותר
    return `<text x="${n(clef.x)}" y="${n(yAnchor)}" font-size="${fontSize}" font-family='"Segoe UI Symbol","Symbola","FreeSerif",serif' fill="${FILL_COLOR}" class="map-clef">${GLYPH_TREBLE_CLEF}</text>`
  }
  // Bass clef...
}
```

**הערה לשלב 8:** להחליף באמת ב-SVG path של Bravura. עד אז, calibration של fontSize + yAnchor לפי הפונט הספציפי.

---

### BUG 7 — אין סימני טריולה (tuplets)

**תסמין:** שלישיות ומחומשות לא מסומנות.

**אבחנה:** `RenderedMeasure.tuplets` נבנה ריק. `verticalLayout.ts` לא מחשב tuplets.

**תיקון — שני קבצים:**

**`verticalLayout.ts` — הוסף לפונקציה buildMeasure:**
```typescript
// Collect tuplet groups
const tupletGroups = new Map<string, RenderedNote[]>()
for (const rn of noteList) {
  const en = extNotes.find(n => n.id === rn.noteId)
  if (en?.tupletId) {
    if (!tupletGroups.has(en.tupletId)) tupletGroups.set(en.tupletId, [])
    tupletGroups.get(en.tupletId)!.push(rn)
  }
}

const tuplets: RenderedTuplet[] = []
for (const [tid, tnotes] of tupletGroups) {
  if (tnotes.length < 2) continue
  tnotes.sort((a,b) => a.x - b.x)
  const first = tnotes[0], last = tnotes[tnotes.length-1]
  const en = extNotes.find(n => n.id === first.noteId)
  const num = en?.tupletActual ?? 3
  const above = first.stemUp  // bracket above if stems down

  const bracketY = above
    ? Math.min(...tnotes.map(n => n.stemYTop)) - sp * 1.2
    : Math.max(...tnotes.map(n => n.stemYBottom)) + sp * 0.8

  tuplets.push({
    tupletId: tid,
    noteIds: tnotes.map(n => n.noteId),
    number: num,
    numberX: (first.x + last.x) / 2,
    numberY: bracketY,
    above,
    bracket: {
      x1: first.x - sp * 0.5, y1: bracketY,
      x2: last.x  + sp * 0.5, y2: bracketY,
      hookHeight: sp * 0.8,
    },
  })
}
```

**`svgRenderer.ts` — הוסף renderTuplet:**
```typescript
function renderTuplet(t: RenderedTuplet, sp: number): string {
  const parts: string[] = []
  if (t.bracket) {
    const { x1, y1, x2, y2, hookHeight } = t.bracket
    const dir = t.above ? 1 : -1
    // Main bracket line with gap in middle for number
    const mid = (x1 + x2) / 2, gapW = sp * 1.8
    parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(mid - gapW/2)}" y2="${n(y1)}" stroke="${STROKE_COLOR}" stroke-width="1"/>`)
    parts.push(`<line x1="${n(mid + gapW/2)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y1)}" stroke="${STROKE_COLOR}" stroke-width="1"/>`)
    // Hooks
    parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x1)}" y2="${n(y1 + dir * hookHeight)}" stroke="${STROKE_COLOR}" stroke-width="1"/>`)
    parts.push(`<line x1="${n(x2)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y1 + dir * hookHeight)}" stroke="${STROKE_COLOR}" stroke-width="1"/>`)
  }
  // Number
  parts.push(`<text x="${n(t.numberX)}" y="${n(t.numberY + sp*0.35)}" text-anchor="middle" font-size="${n(sp*1.3)}" font-family="serif" font-style="italic" fill="${STROKE_COLOR}">${t.number}</text>`)
  return parts.join('\n')
}

// בתוך renderMeasure: הוסף לאחר ties
for (const tup of measure.tuplets) parts.push(renderTuplet(tup, sp))
```

---

### BUG 8 — Time signature font

**תסמין:** ה-4/4 נראה כמו Arial רגיל, לא כמו בתוכנות מוזיקה.

**תיקון — `svgRenderer.ts` renderTimeSig:**
```typescript
// שנה: font-family="serif" → font-family='"Century","Times New Roman",serif'
// font-weight: 700 → 900 (bolder)
// הוסף letter-spacing="-1" (ספרות צמודות)
// הגדל font-size: lineSpacing * 1.6 → lineSpacing * 1.8
```

---

### סדר ביצוע מומלץ לסשן הבא

1. **BUG 1** (double staff) — הכי גדול, פותר את רוב הבלאגן הוויזואלי
2. **BUG 2** (rests) — כל השקטים הפנטומיים נעלמים
3. **BUG 5** (notehead tilt) — הפרש ויזואלי הכי דרמטי vs MuseScore
4. **BUG 4** (tie bezier) — קל, שורה אחת
5. **BUG 3** (accidentals) — חשוב לדייקנות
6. **BUG 7** (tuplets) — חשוב לדונה לי
7. **BUG 6** (clef) — calibration
8. **BUG 8** (time sig font) — cosmetic

---

## טבלת שלבים וזמנים

| שלב | תוכן | זמן משוער | סטטוס |
|-----|------|-----------|--------|
| 0 | מחקר webmscore/MuseScore, מסמך אלגוריתמים | 1–2 ימים | ✅ |
| 1 | Data model מלא (`types.ts`) | 1 יום | ✅ |
| 2 | MusicXML parser מורחב | 2–3 ימים | ✅ |
| 3 | Horizontal layout + `/renderer-test` | 3–5 ימים | ✅ |
| 4 | Vertical layout + beams + accidentals | 5–7 ימים | ✅ |
| 5 | SVG renderer בסיסי + Unicode glyphs | 3–4 ימים | ✅ **Checkpoint B (נכשל ויזואלית)** |
| **5.5** | **Bugfix Pass — 8 בעיות קריטיות** | **1–2 ימים** | **⬜ הבא** |
| 6 | אינטגרציה ב-MAP, הסרת Verovio | 2–3 ימים | ⬜ |
| 7 | Classical support מלא | 5–10 ימים | ⬜ |
| 8 | Bravura glyphs | 3–5 ימים | ⬜ |
| **סה"כ** | | **~4–6 שבועות** | |

הזמנים מניחים עבודה עם Claude Code sessions מלאים, iterative — לא consecutive days.

---

## Checkpoints — מתי ניתן לבדוק ולתת פידבק

| Checkpoint | אחרי שלב | מה רואים |
|------------|----------|----------|
| **A** | שלב 3 | דף `/renderer-test` — measure widths, note x-positions. השוואה **מספרית** vs Verovio. מגלה בעיות spacing מוקדם. |
| **B** | שלב 5 | **השוואה ויזואלית** — Verovio מצד שמאל, renderer שלנו מצד ימין. גובה תווים, beams, chord symbols. זהו ה-gate לפני אינטגרציה. |
| **C** | שלב 6 | MAP מלא עם renderer חדש — click, selection, overlays, scripts. |

**כלל:** לא ממשיכים מ-Checkpoint B עד שהמשתמש מאשר שהתוצאה הויזואלית מקובלת.

---

## עקרונות עבודה עם Claude Code

1. **שלב 0 קודם כל** — אל תתחיל לקודד בלי RENDERER_ALGORITHMS.md. שלב 0 הוא ה-ROI הכי גבוה.

2. **Test file מרכזי** — DONNALEE.XML הוא benchmark ראשי. כל שלב חייב לרנדר אותו נכון לפני שממשיכים.

3. **Visual diff** — בכל שלב: השווה screenshot של Verovio output מול renderer שלנו. הפערים מנחים את ה-iteration הבאה.

4. **אל תנגע ב-annotationStore** — ה-renderer הוא הבידוד. כל שאר MAP נשאר ללא שינוי עד שלב 6.

5. **Renderer חייב להיות renderer-agnostic עבור שאר MAP** — כל מה שהוא מייצא הוא: `{ svg: string, notes: RenderedNote[], elementMap: Map }`. שאר MAP לא יודע שום דבר על internals של ה-renderer.

6. **CLAUDE.md updates** — בסוף כל שלב, עדכן את CLAUDE.md עם מה שנבנה.

7. **עדכן תוכנית זו לאורך כל הדרך** — כשהמימוש מגלה שמשתנה, קבוע, או משוואה בתוכנית שגויים — תקן אותם כאן לפני שממשיכים. לא עדכון ארכיטקטורה שלמה, רק תיקון הפרט הספציפי (כמו נוסחת spacing בשלב 3a, offset בשלב 4b). RENDERER_ALGORITHMS.md הוא המקור המאומת — כשיש סתירה, הוא גובר.

---

## מה אנחנו מרוויחים בסוף

| לפני (Verovio) | אחרי (Native) |
|----------------|---------------|
| `toVrv` map — תרגום ephemeral IDs | לא קיים — noteMapId IS ה-SVG id |
| `fromVrv` map | לא קיים |
| `buildVrvNoteIdMap` — positional matching שבריר | לא קיים |
| `prepareMusicXML` — workaround ל-Verovio quirks | לא קיים |
| WASM loading time | אפס — pure JS |
| Bug ויזואלי = פתיחת issue ל-Verovio | Bug ויזואלי = תיקון קוד שלנו |
| geometry לא נגיש | `note.x, note.y, note.bbox` — ישיר מה-renderer |
| dependency שמשתדרג ושובר | אין dependency חיצוני |
