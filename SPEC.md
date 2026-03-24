# MAP — Music Analysis Platform
## SPEC.md — Vision, Workflow & Implementation Roadmap

## 1. תיאור הוויז'ן המקורי — במילים של מריו

אני פותח את האפליקציה ויש מולי ספריה של כל היצירות שכבר העלתי לאפליקציה, אני יכול למיין/לסנן את הספריה על ידי ז'אנר, א-ב, מהישן לחדש, האחרון שהשתנה/נפתח, מחבר.

אני בוחר אחת מהיצירות שלי, היא נטענת עם כל הניתוחים שכבר עשיתי. בצד שמאל של המסך יש את כל הקטגוריות של הניתוח (מלודיה, הרמוניה, מוטיבים וכו') כשאני יכול להציג/להסתיר כל אחת בלחיצת כפתור את כל הניתוחים של השכבה המדוברת, בלחיצה על החץ הקטן של כל קטגוריה נפתח גם סרגל שמציג את הרכיבים השונים של הקטגוריה והצבעים שלהם, כמו מדריך-קריאה נשלף שיכול להישאר ולהעלם בצד לאורך הניתוח.

צד ימין מוקדש לאיגום הידע הניתוחי. בלחיצה על תו או תפיסה של קבוצת תווים אני יכול לראות בצד ימין את כל התיוגים שחלים על התו המדובר.

אני יכול להעביר את צד ימין למצב טקסט, שבו אני יכול לכתוב טקסט חופשי עם אפשרות לחבר כל משפט לתו/תיבה/רצף תווים/תיבות ביצירה, כך שכשאני קורא משפט אני יכול בלחיצה על הלינק שהתצוגה במרכז תקפוץ לתו/ים או התיבה/ות שמחוברות לאותו משפט.

תוך כדי הניתוח עצמו אני בוחר תווים בודדים, קבוצות, תיבות ורצפי תיבות, מתייג אותם, וכותב עליהם. כל תיוג שנוסף מוצג מיד על המסך ונשמר לפתיחה עתידית של היצירה ולהמשך עבודה.

תוך כדי עבודה אני גם מריץ סקריפטים שמנתחים אלמנטים מסוימים לבד. ניתוח מלודיה, זיהוי חזרות של מוטיבים, מציאת אקורדים, ניתוח הרמוני ודרגות הרמוניות של אקורדים קיימים, וכו'...

אני גם מקשקש בצורה חופשית עם העט שלי (יש לי מסך מגע) עם יכולת בחירת צבעים קלה לתפעול ולהתאמה אישית (למטה מימין יש לי עיגולים צבעוניים, אני יכול בקלות להוריד עיגול או להוסיף עיגול חדש ולשייך לו צבע. בלחיצה על עיגול צבע אני יכול להגדיר עובי, רמת אטימות וצבע בחלוני נשלפת נעלמת ושומר את השינויים שלי ברגע שאני לוחץ על מקום מחוצה לה על המסך). אני יכול בצד שמאל לפתוח את הקטגוריה 'סטיילוס' (או כל שם אחר שנראה מתאים) ולשייך צבע מסויים לטקסט מסויים ולקשר אותו לקטגוריה אחרת, למשל, אני מסמן קו אדום על רצף תווים, הולך לקטגוריה שבצד שמאל, ומוסיף לצבע האדום (שנמצא שם אוטומטית אחרי הסימון הראשון עם הצבע האדום, ונשאר שם כל עוד יש איזה סימון אדום ביצירה) טקסט 'אולי מוטיב A?', ומשייך אותו לקטגוריה 'מוטיב'. ככה כשאני בוחר לראות רק את הקטגוריה 'מוטיב' (על ידי לחיצה עליה בצד שמאל), הסימונים בצבע אדום עדיין מוצגים ואני יכול לראות אותם כחלק מסשן ניתוח שמתמקד במוטיב, למשל.

כל הניתוחים נשמרים, ומהווים בסיס לניתוחים ולסקריפטים אחרים (למשל, חלק מהיצירות מגיעות עם אקורדים, אבל חלק לא. לאלו שלא אני מצרף סימני אקורדים, ואלו בתורם מהווים בסיס להרצת הסקריפט של דרגות הרמוניות או ניתוח מלודי של תווי אקורד).

אני יכול בכל רגע נתון לבחור תו/תיבה, ללחוץ על 'נגן', ולשמוע את היצירה החל מהתו/תיבה שבחרתי.

אני יכול לבחור כל רכיב על הדף (כל מה שיש ביצירה, כולל סימני דינמיקה, סימני הדגשה, ארטיקולציה וכו') ולצבוע אותו בצבע כלשהו לבחירתי.

כל אינטראקציית הבחירה היא אינטואיטיבית, אני יכול לתפוס תו, ללחוץ שיפט+חץ ולהרחיב/לצמצם את הבחירה, כמו כל אפליקציה אחרת (אני חושב על וורד, לצורך העניין) כולל חיצים למטה להרחבה לחמשה שמתחת או חיצים למעלה להרחבה כלפי מעלה.

למטה, בסרגל בתחתית העמוד, אפשר לראות את שמות התווים שבחרתי בכל רגע נתון, כשאני בוחר מספר תווים רואים את השמות של כולם, ואם זה מצרף לאקורד מופיע האקורד. בלחיצה עליו הוא מצטרף מעל לתו הראשון מהקבוצה כתיוג של אקורד.

כל תיוג/רכיב שאני מוסיף, אני יכול לגרור, להעביר ולשנות את המיקום הויזואלי שלו על הנייר, ואם צריך — גם את המיקום ה'אמיתי' שלו, נגיד, אני יכול לגרור סימון של אקורד סתם כי הוא מתנגש עם סימון אחר, אבל אני יכול גם לבחור מאיזה תו נכנס סימון של אקורד, ולהזיז את נקודת ההתחלה שלו, לצורך הסקריפט שמנתח תווי אקורד, למשל.

אחרי כל שינוי אני יכול לראות למעלה (מן הסתם אחרי כמה שניות) אישור קטן שמציין שהיצירה עם השינויים שלה נשמרה. ככה שאם אני יוצא (או אפילו אם המחשב שלי קורס) היצירה והניתוחים נשמרים לשימוש עתידי.

כשאני מעלה יצירה חדשה היא עולה, ואני יכול למלא את השדות של מחבר, ז'אנר וכו' בשביל הסינון של הספריה.

אני יכול לייצא בכל שלב כ-PDF, או כקובץ קל לניתוח (JSON?), והתיקייה-ספריה מסתנכרנת עם תיקייה על המחשב שלי (ואני יכול ליצור תיקיות מסונכרנות גם על מחשבים אחרים). ככה שאני יכול לתת לקלוד קוד גישה ליצירות ולניתוחים שלי, ולבקש ממנו לעזור לי בניתוחים, לזהות דפוסים, להריץ סקריפטים על מספר יצירות וכאלה. קלוד יוכל לשנות דברים בקבצי הניתוח או היצירה עצמם (אולי זה אותו קובץ?) ככה שכשאפתח אותם בתוך האפליקציה — הם יופיעו ולא אצטרך להכניס אותם ידנית אחד אחד.

---

## 2. מה MAP הוא

**MAP = כלי ניתוח מוזיקלי אישי** לחוקר יחיד (מריו).

הוא **לא** notation editor (לא MuseScore). הוא **לא** player בלבד.

הוא **ה-layer האנליטי מעל הפרטיטורה** — notebook, canvas, סקריפט-IDE, וכלי-תיוג, הכל על גבי score. (MuseScore לרנדור + Notion לטקסט + Obsidian לקישורים + Procreate לציור)

---

## 3. User Journey המלא

### 3.1 פתיחת האפליקציה — Library View
- מסך ראשי: **ספריית יצירות** (לא score מיד)
- כל יצירה מוצגת כ-card: שם, מחבר, ז'אנר, תאריך עדכון אחרון
- **מיון:** א-ב / מחבר / ז'אנר / תאריך יצירה / תאריך פתיחה אחרונה / תאריך שינוי אחרון
- **סינון:** לפי ז'אנר, לפי מחבר
- **כפתור:** העלאת יצירה חדשה (MusicXML)
  - בעת העלאה: מילוי שדות מטא-דטה (שם, מחבר, ז'אנר, שנה, הערות)
- לחיצה על יצירה → טעינת Analysis View

### 3.2 Analysis View — המבנה הכללי

```
┌─────────────────────────────────────────────────────────┐
│                        TopBar                            │
│  [שם יצירה] [▶ נגן] [BPM] [📄 PDF] [📦 JSON] [🔬]    │
├──────────┬────────────────────────┬──────────────────────┤
│          │                        │                      │
│LeftPanel │      ScoreView         │    RightPanel        │
│  200px   │  (scrollable, center)  │      300px           │
│          │                        │                      │
├──────────┴────────────────────────┴──────────────────────┤
│                      StatusBar                           │
│  [שמות תווים נבחרים] [אקורד מזוהה] [מיקום] [shortcuts] │
└─────────────────────────────────────────────────────────┘
```

### 3.3 LeftPanel — ניווט שכבות

כל שכבת ניתוח מוצגת כ-row עם:
- **checkbox להצגה/הסתרה** של כל annotations של השכבה
- **חץ להרחבה** → נפתח legend (מדריך-קריאה נשלף):
  - רשימת רכיבים + צבעים של השכבה
  - ניתן להשאיר פתוח תוך כדי עבודה

**שכבות:**
| שכבה | תיאור |
|------|--------|
| 🎵 מלודיה | תווי אקורד / מעבר / שכן |
| 🎹 הרמוניה | סימני אקורד, קדנצות, פונקציה הרמונית |
| 🔷 מוטיבים | מוטיבים ווריאציות |
| 📐 צורה | חלקים פורמליים (A, B, פתיחה...) |
| 🖊️ ציור חופשי (Stylus) | שכבת קווקוו עם ניהול צבעים |
| 🏷️ תוויות | תוויות טקסט חופשיות |
| 🎨 צביעת תווים | noteColor annotations |
| ❓ שאלות פתוחות | notes לחקירה עתידית |

**שכבת Stylus — ניהול צבעים:**
- בתחתית הפאנל: שורת עיגולי צבע
- לחיצה / קליק על עיגול → חלונית נשלפת: עובי, אטימות, צבע (color picker). נסגרת בלחיצה מחוץ לה ושומרת אוטומטית.
- + להוספת עיגול חדש, × להסרה
- עיגול צבע מופיע אוטומטית בפאנל אחרי השימוש הראשון בו, ונשאר כל עוד יש סימון באותו צבע ביצירה
- צבע ניתן לשיוך לשכבה אחרת + תיאור טקסטואלי ("אולי מוטיב A?")
- כשרואים שכבת מוטיבים — מוצגים גם קווקווים של הצבע המשויך

### 3.4 ScoreView — פרטיטורה וסלקציה

**רנדור:** Verovio (קיים ועובד)

**סלקציה — אינטואיטיבית כמו Word:**
| פעולה | תוצאה |
|--------|--------|
| Click על תו | בחירת תו בודד |
| Click על תיבה (לא-תו) | בחירת תיבה |
| Shift+Click | הרחבת טווח |
| Shift+→/← | הרחבה/צמצום לפי תו |
| Shift+↑/↓ | הרחבה לחמשה מעלה/מטה |
| Drag | lasso — בחירת טווח תווים |
| Escape | ביטול בחירה |

**בחירת כל רכיב — לא רק תווים:**
- דינמיקה (p, f, ff, cresc...)
- ארטיקולציה (staccato, accent, tenuto...)
- פרמטות, ליגות, סימני tempo
- כל `g.*` ב-SVG של Verovio ניתן לבחירה וצביעה בצבע חופשי

**Freehand drawing (Stylus layer):**
- Canvas שקוף מעל הפרטיטורה
- pen input ממסך מגע (PointerEvents)
- צבע פעיל נלקח מהעיגול הנבחר ב-LeftPanel

### 3.5 RightPanel — ידע ניתוחי

**מצב Tags (ברירת מחדל):**
- בחירת תו/תיבה → מוצגים כל annotations שחלים עליהם
- תיוגים מאורגנים לפי שכבה
- כפתור "הוסף תיוג" → context menu לפי שכבה

**מצב טקסט (Research Notes):**
- עורך טקסט חופשי (rich text בסיסי)
- כל משפט/פסקה ניתן לקישור ל:
  - תו ספציפי
  - תיבה / טווח תיבות
  - רצף תווים
- בלחיצה על הלינק: ScoreView קופץ + מדגיש את הרכיב המקושר
- הטקסט נשמר כחלק מה-analysis.json

### 3.6 StatusBar — תחתית

- שמות תווים נבחרים (note names) מה-noteMap
- זיהוי אקורד אוטומטי מהתווים הנבחרים
- בלחיצה על שם האקורד המזוהה → נוסף כ-harmony annotation מעל התו הראשון
- מיקום (תיבה, beat)
- hints לקיצורי מקלדת

### 3.7 Playback

- נגינה מהתו/תיבה הנבחר/ת
- BPM ב-TopBar
- עצירה בכל עת
- Cursor זזה בפרטיטורה תוך כדי נגינה

### 3.8 תיוגים — גרירה ומיקום

- כל תיוג/רכיב שנוסף ניתן לגרור ולשנות מיקום ויזואלי על הדף
- ניתן גם לשנות מיקום "אמיתי" — למשל, לקבוע מאיזה תו מתחיל סימן אקורד (משפיע על הסקריפטים)

### 3.9 Auto-save וסנכרון

- שמירה אוטומטית: debounce ~2s → IndexedDB
- אינדיקטור "נשמר ✓" ב-TopBar אחרי כל שמירה
- **סנכרון לתיקייה מקומית (File System Access API):**
  - כל יצירה = תיקייה עם שני קבצים:
    - `[name].musicxml` — הקובץ המקורי
    - `[name].analysis.json` — כל הניתוחים, annotations, notes, strokes
  - סנכרון דו-כיווני: שינוי ב-`.analysis.json` על ידי Claude Code → נטען ב-MAP בפתיחה הבאה
  - ניתן להגדיר תיקיות sync על מחשבים נוספים

### 3.10 ייצוא

- **PDF:** פרטיטורה עם כל annotations כ-overlay
- **JSON:** `analysis.json` מלא — annotations, strokes, research notes, palette

---

## 4. Analysis JSON Format

```json
{
  "version": "1.0",
  "piece": {
    "id": "uuid",
    "title": "Donna Lee",
    "composer": "Charlie Parker",
    "genre": "bebop",
    "year": 1947,
    "key": "Ab major",
    "timeSignature": "4/4",
    "measures": 100,
    "addedDate": "2026-01-01",
    "lastModified": "2026-03-24",
    "lastOpened": "2026-03-24"
  },
  "annotations": [
    {
      "id": "ann-uuid",
      "layer": "harmony|melody|form|motif|noteColor|label|stylus|question",
      "measureStart": 1,
      "measureEnd": 4,
      "noteIds": ["note-m1b100-C4"],
      "colorType": "CHORD_TONE",
      "label": "ii-V-I",
      "scriptId": "melodyColor",
      "visualOffset": { "x": 0, "y": 0 },
      "anchorNoteId": "note-m1b100-C4",
      "createdAt": "2026-03-24T10:00:00Z"
    }
  ],
  "stylusStrokes": [
    {
      "id": "stroke-uuid",
      "color": "#ff0000",
      "opacity": 0.8,
      "width": 3,
      "points": [[120, 340], [125, 345]],
      "linkedLayer": "motif",
      "label": "אולי מוטיב A?"
    }
  ],
  "researchNotes": [
    {
      "id": "note-uuid",
      "text": "הרצף בתיבות 5-8 מזכיר את הפתיחה של All The Things...",
      "links": [
        { "type": "measures", "measureStart": 5, "measureEnd": 8 }
      ]
    }
  ],
  "colorPalette": [
    {
      "id": "c1",
      "color": "#ff0000",
      "width": 3,
      "opacity": 0.8,
      "linkedLayer": "motif",
      "label": "מוטיב A?"
    }
  ]
}
```

---

## 5. ארכיטקטורה טכנית

### 5.1 Stack
- **React 18 + TypeScript + Vite** (קיים)
- **Zustand** לstate management (קיים)
- **Verovio** לרנדור פרטיטורה (קיים, עובד)
- **Tone.js** לפלייבק (קיים, צריך תיקון)
- **i18next** לעברית/אנגלית (קיים)
- **IndexedDB** לשמירה מקומית (קיים)
- **File System Access API** לסנכרון תיקייה (חדש)
- **Canvas API** לשכבת ציור (קיים skeleton ב-FreehandCanvas.tsx)

### 5.2 Store Architecture
| Store | מה הוא מחזיק |
|-------|--------------|
| `libraryStore` | רשימת יצירות + מטא-דטה מלא |
| `scoreStore` | xmlString, noteMap, toVrv, metadata |
| `annotationStore` | כל annotations + undo stack |
| `selectionStore` | selection הנוכחי + context menu |
| `playbackStore` | isPlaying, currentMeasure, bpm |
| `layerStore` | visibility לכל שכבה |
| `stylusStore` | **חדש** — strokes, palette, activeColor |
| `researchStore` | **חדש** — research notes + links |

### 5.3 קבצים קיימים שצריך לשנות (שלבים 1–3)
| קובץ | מה צריך |
|------|---------|
| `ScoreView.tsx` | Shift+חצים, מיפוי dynamics/articulation |
| `LeftPanel.tsx` | legend נשלף + stylus palette |
| `RightPanel.tsx` | מצב Tags + מצב Research Notes |
| `StatusBar.tsx` | note names + chord detection + הוספת אקורד |

### 5.4 קבצים חדשים שצריך ליצור
| קובץ | מה הוא עושה |
|------|------------|
| `src/views/LibraryView.tsx` | מסך ספריה ראשי ✅ |
| `src/components/library/LibraryCard.tsx` | card יצירה ✅ |
| `src/store/stylusStore.ts` | state לציור חופשי + palette |
| `src/store/researchStore.ts` | state ל-research notes + links |
| `src/services/syncService.ts` | File System Access API — סנכרון תיקייה |
| `src/services/chordDetector.ts` | זיהוי אקורד מ-noteIds |
| `src/services/pdfExporter.ts` | ייצוא PDF עם overlays |
| `src/components/library/LibraryCard.tsx` | card של יצירה בספריה |
| `src/components/panels/ResearchNotes.tsx` | עורך research notes עם קישורים |
| `src/components/stylus/ColorPalette.tsx` | ניהול עיגולי צבע + חלונית הגדרות |

---

## 6. שלבי הקמה — Roadmap

---

### שלב 0 — תיקוני יסוד ✅ (הושלם מרץ 2026)
**מטרה:** גרום לאפליקציה לעבוד ללא באגים בסיסיים.

- [x] **תיקון באג צביעת תווים** — `dangerouslySetInnerHTML` הוחלף ב-ref-managed div (`vrvDivRef` + `prevSvgRef`). React לא נוגע ב-SVG DOM על re-renders לא קשורים.
- [x] **תיקון playback** — הוספת sixteenth subdivision בחישוב ה-timestamp ל-Tone.js Part. `${bars}:${beatsInBar}:${sixteenths}` במקום `${bars}:${beatsInBar}:0`.
- [x] **טעינת annotations מ-IndexedDB** — כל נתיבי טעינת piece (`OpenFileButton`, `handleOpenFile` ב-LeftPanel) מנקים AnnotationStore ומטעינים annotations שמורות. IndexedDB נבדק לפני שמירה חדשה.
- [x] **ניקוי annotation.ts** — `NoteColorAnnotation.colorType` = `CHORD_TONE | PASSING_TONE | NEIGHBOR_TONE` בלבד. הוסר מ-RightPanel ומ-annotation.ts.

---

### שלב 1 — Library View ✅ (הושלם מרץ 2026)
**מטרה:** מסך ביתי שמציג את הספריה לפני הפרטיטורה.

- [x] `LibraryView.tsx` — רשת cards של יצירות (`src/views/LibraryView.tsx`)
- [x] `LibraryCard.tsx` — card בודד עם שם, מחבר, ז'אנר, שנה, מפתח, מספר תיבות, תאריך פתיחה
- [x] metadata fields: שם, מחבר, ז'אנר, שנה, הערות (טופס modal בעת העלאה)
- [x] מיון: א-ב, מחבר, ז'אנר, lastModified, lastOpened, dateAdded
- [x] סינון: ז'אנר, מחבר; חיפוש טקסט חופשי
- [x] העלאת יצירה חדשה + טופס metadata pre-filled מה-XML
- [x] ניווט חלק: Library ↔ Analysis View — `currentView` ב-`libraryStore`, "← חזרה לספריה" ב-TopBar
- [x] עדכון `libraryStore` — fields חדשים: `genre`, `year`, `notes`, `dateAdded`, `lastModified`
- [x] מחיקת יצירה מהספריה + IndexedDB

---

### שלב 2 — StatusBar חכם + chord detection
**מטרה:** StatusBar מציג note names + מזהה אקורדים ומאפשר הוספתם.

- [ ] `chordDetector.ts` — מ-noteIds (pitch classes) לשם אקורד
- [ ] StatusBar מציג שמות תווים מה-noteMap (לא מ-Verovio attr)
- [ ] כשמספר תווים נבחרים → זיהוי אקורד אוטומטי + כפתור "הוסף אקורד"
- [ ] לחיצה → harmony annotation נוסף מעל תו ראשון
- [ ] תיקון הצגת pitch ב-RightPanel מה-noteMap

---

### שלב 3 — סלקציה מלאה
**מטרה:** בחירה אינטואיטיבית של כל רכיב בפרטיטורה.

- [ ] Shift+→/← הרחבת/צמצום בחירה תו אחד
- [ ] Shift+↑/↓ הרחבה לחמשה מעלה/מטה
- [ ] מיפוי dynamics, articulation, ligatures, tempo ב-buildElementMap
- [ ] בחירת כל רכיב SVG → צביעה בצבע חופשי
- [ ] גרירת annotations לשינוי מיקום ויזואלי (drag to reposition)
- [ ] שינוי anchor note של annotation (מיקום "אמיתי")

---

### שלב 4 — LeftPanel מחודש + Legend
**מטרה:** LeftPanel עם legend נשלף ו-palette ציור.

- [ ] עיצוב מחדש של שורות שכבות (checkbox + חץ + legend)
- [ ] Legend נשלף עם צבעים ותיאורים לכל שכבה, ניתן להשאיר פתוח
- [ ] `ColorPalette.tsx` — עיגולי צבע + חלונית הגדרות (עובי, אטימות, צבע)
- [ ] `stylusStore.ts` — activeColor, strokes, palette
- [ ] שיוך צבע ל-layer + label טקסטואלי

---

### שלב 5 — Stylus / Freehand Drawing
**מטרה:** ציור חופשי עם עט מגע.

- [ ] שכבת Canvas שקופה מעל ScoreView
- [ ] pen/touch input (PointerEvents)
- [ ] שמירת strokes ב-analysis.json
- [ ] שיוך stroke לשכבה + label
- [ ] הצגת strokes לפי visibility של שכבה
- [ ] מחיקת stroke בודד

---

### שלב 6 — RightPanel: Research Notes
**מטרה:** עורך טקסט עם קישורים חיים לפרטיטורה.

- [ ] `researchStore.ts`
- [ ] `ResearchNotes.tsx` — עורך עם כפתור "קשר לבחירה הנוכחית"
- [ ] לחיצה על לינק → scroll + highlight ב-ScoreView
- [ ] שמירה ב-analysis.json

---

### שלב 7 — File System Sync
**מטרה:** סנכרון דו-כיווני עם תיקייה מקומית לשיתוף עם Claude Code.

- [ ] `syncService.ts` — File System Access API
- [ ] בחירת תיקיית sync (בהגדרות)
- [ ] כתיבת `.analysis.json` אוטומטית בכל שמירה
- [ ] טעינת `.analysis.json` חיצוני בפתיחת יצירה (קריאת שינויים מ-Claude Code)
- [ ] אינדיקטור "נשמר ✓" ב-TopBar

---

### שלב 8 — Export
**מטרה:** ייצוא PDF ו-JSON מלא.

- [ ] JSON export מעודכן (כולל strokes + research notes + palette)
- [ ] `pdfExporter.ts` — פרטיטורה + overlays
- [ ] כפתורי ייצוא ב-TopBar

---

### שלב 9 — Scripts נוספים
**מטרה:** הרחבת מנגנון הסקריפטים לניתוחים מתקדמים.

- [ ] ניתוח דרגות הרמוניות / Roman numerals (דורש harmony annotations)
- [ ] מציאת אקורדים אוטומטית
- [ ] ניתוח הרמוני מלא
- [ ] הרצת סקריפטים על מספר יצירות (דורש sync service — שלב 7)

---

### שלב 10 — Playback משופר
**מטרה:** נגינה עם cursor נע + התחלה מנקודה.

- [ ] cursor נע ב-ScoreView תוך כדי נגינה
- [ ] נגינה מהתו/תיבה הנבחרת
- [ ] transport controls (עצירה, pause, loop section)

---

## 7. חוקי עבודה עם Claude Code

1. פתח CLAUDE.md + SPEC.md בתחילת כל סשן
2. **שלב אחד בכל פעם** — לא מתחילים שלב חדש לפני שהנוכחי עובד ונבדק עם DONNALEE.XML
3. שינויים ב-`.analysis.json` ע"י Claude Code → נטענים ב-MAP בפתיחה הבאה (אחרי שלב 7)

---

## 8. מצב נוכחי (מרץ 2026)

✅ **עובד:**
- Verovio rendering (multi-page, chord symbols נטיביים)
- elementMap + toVrv/fromVrv ID mapping (643 entries on Donna Lee)
- Multi-staff fix (prepareMusicXML)
- Note + measure selection (click, shift+click, lasso)
- Annotation system + undo
- Library (basic, IndexedDB)
- JSON export (partial)
- Layer toggles
- i18n Hebrew/English
- Keyboard shortcuts (H/M/F/T/Q/Space/Ctrl+Z/Escape)
- Script 1: Melody Colors (chord/passing/neighbor)
- Script 2: Motif Finder
- ScriptPanel UI
- Auto-save (שמירה עובדת, טעינה חסרה)

✅ **שלב 0 הושלם (מרץ 2026):**
- צביעת תווים תוקנה — ref-managed div, React לא מוחק inline styles
- Playback תוקן — sixteenth subdivision, notes מתנגנים בזמן הנכון
- Annotations נטענים מ-IndexedDB בכל נתיב פתיחה
- annotation.ts נוקה — CHROMATIC/AMBIGUOUS הוסרו

✅ **שלב 1 הושלם (מרץ 2026):**
- LibraryView — cards grid, sort/filter/search, metadata modal
- LibraryCard — title, composer, genre, year, key, measures, lastOpened
- libraryStore — genre/year/notes/dateAdded/lastModified + currentView + setView
- ניווט Library ↔ Analysis View, כפתור "← חזרה לספריה" ב-TopBar

⬜ **חסר לחלוטין:**
- StatusBar חכם (note names, chord detection) — **שלב 2**
- Shift+חצים (סלקציה מורחבת) — **שלב 3**
- מיפוי dynamics/articulation/ligatures — **שלב 3**
- Freehand drawing (קיים skeleton בלבד) — **שלב 5**
- Research Notes — **שלב 6**
- File System Sync — **שלב 7**
- PDF export — **שלב 8**
- Scripts נוספים (הרמוניה, דרגות) — **שלב 9**
