# WebMScore Layout Engine — Call Graph Map
## יומן עבודה חי לפרויקט ה-Renderer ב-TypeScript/SVG

**תאריך:** 2026-04-03
**מצב:** ניתוח אנליטי בלבד — אין תרגום קוד
**מקור:** `C:\Users\DELL\Documents\webmscore\src\engraving\layout\` + `src\engraving\libmscore\`

---

## ⚠️ כלל עבודה מוחלט — MANDATORY WORKFLOW

**הפלואו היחיד המותר לסשן של renderer:**

```
1. זהה את הבעיה / הפיצ'ר הבא לפי RENDERER_MAP.md
2. קרא את קובץ ה-C++ המקביל (ע"פ הטבלה "Call Graph")
3. ציין בדיוק: שמות הקבועים (Sid::...), הנוסחאות, סדר הפעולות
4. רק אחרי שווידאת שהבנת את המקור — תרגם ל-TypeScript
5. חזור על 1-4 לתכונה הבאה
```

**אסור לעשות:**
- ❌ לרוץ pixel tests בלופ ולנסות לתקן ע"פ מספרים (זה לא debugging, זה guessing)
- ❌ לנחש קבועים בלי לקרוא `styledef.cpp` / קובץ C++ רלוונטי
- ❌ לשנות קוד TypeScript לפני שקראת את קובץ ה-C++ המקביל

**מותר לעשות:**
- ✅ לרוץ `npm run test:r` פעם אחת בסוף שלב כדי לוודא שלא שברנו משהו
- ✅ לקרוא קבצי C++ כדי להבין מנגנון — זה הצעד הראשון תמיד
- ✅ להשתמש ב-pixel diff רק לאבחנה ולא כמדד הצלחה

**הסדר הנכון לשכפול מלא:**
קרא C++ → תרגם TS → קרא C++ → תרגם TS → … → בדוק pixels

---

## סיכום אדריכלי — "נתיב הזהב" (The Golden Path)

### המסלול הקריטי מ-Score עד ל-Element הבודד:

```
Score::doLayoutRange()
  └─► Layout::doLayoutRange()                    [layout.cpp:74]
        └─► LayoutMeasure::getNextMeasure()       [layoutmeasure.cpp:582]
              └─► [per segment] Chord::layout()   [chord.cpp:2023]
                    └─► layoutPitched()           [chord.cpp:2083]
                          └─► Note::layout()
        └─► LayoutSystem::collectSystem()         [layoutsystem.cpp:62]
              └─► System::layoutSystem()          [system.cpp:422]
              └─► justifySystem()                 [layoutsystem.cpp:496]
              └─► m->layoutMeasureElements()      [measure.cpp:3233]
              └─► m->layoutStaffLines()           [measure.cpp:231]
              └─► layoutSystemElements()          [layoutsystem.cpp:670]
                    ├─► LayoutBeams::layoutNonCrossBeams()
                    ├─► [skylines per staff]
                    ├─► Chord::layoutArticulations()
                    ├─► LayoutTuplets::layout()
                    └─► doLayoutTies()
        └─► Layout::doLayout()                   [layout.cpp:222]
              └─► LayoutPage::getNextPage()       [layoutpage.cpp:60]
              └─► LayoutPage::collectPage()       [layoutpage.cpp:103]
                    └─► System::layout2()         [system.cpp:884]
```

### סדר מומלץ לתרגום (Bottom-Up):
1. **Note / Notehead** — יחידת הבסיס, תלויה בשורה (line) ו-pitch בלבד
2. **Stem** — `layoutStem()`, תלוי בכיוון (up/down) ובגובה ה-note
3. **Hook / Flag** — מיקום יחסי ל-stem
4. **LedgerLine** — חישוב על פי `note->line()` ו-spatium
5. **Chord** (pitchedLayout) — מרכז את ה-notes, מחשב bbox
6. **Rest** — דומה ל-Chord אבל פשוט יותר
7. **Beam** — `LayoutBeams::layoutNonCrossBeams()` לאחר stem
8. **Segment** — מיכל לכל ChordRest בנקודת זמן נתונה
9. **Measure** — `computeWidth()`, `layoutMeasureElements()`, `layoutStaffLines()`
10. **System** — `layoutSystem()` + `layout2()` לחישוב מרחקי staves
11. **Page** — `collectPage()` + vertical justification
12. **Score** — `doLayoutRange()` — orchestration כוללת

---

## רשימת ה-Styles (Sid) המשפיעים ביותר על ה-Layout

| Sid | תיאור | נמצא ב |
|-----|--------|--------|
| `spatium` | יחידת המידה הבסיסית (sp) | כל מקום — בסיס כל החישובים |
| `pagePrintableWidth` | רוחב הדף הזמין לתווים | `layoutsystem.cpp:90` — targetSystemWidth |
| `staffUpperBorder` | שוליים עליונים מעל ה-staff | `layout.cpp:521`, `layoutpage.cpp:151` |
| `staffLowerBorder` | שוליים תחתונים מתחת ל-staff | `layout.cpp:523`, `layoutpage.cpp:107` |
| `staffDistance` | מרחק בין staves של parts שונים | `system.cpp:909` |
| `akkoladeDistance` | מרחק בין staves באותו part | `system.cpp:910` |
| `minVerticalDistance` | מרחק מינימלי אנכי | `system.cpp:908` |
| `dotNoteDistance` | מרחק מנקודה לתו | `chord.cpp:2095`, `layoutchords.cpp:466` |
| `accidentalDistance` | מרחק בין תאונות | `layoutchords.cpp:1032` |
| `accidentalNoteDistance` | מרחק מתאונה לתו | `layoutchords.cpp:1033` |
| `lastSystemFillLimit` | יחס מינימלי למילוי שורה אחרונה | `layoutsystem.cpp:430` |
| `staffHeaderFooterPadding` | ריפוד header/footer | `layoutpage.cpp:111` |
| `instrumentNameOffset` | מרחק שמות כלים | `system.cpp:429` |
| `lyricsMinTopDistance` | מרחק מינימלי של מילים מ-staff | `layoutlyrics.cpp:47` |
| `multiMeasureRestMargin` | שוליים של rest מרובה תיבות | `measure.cpp:3280` |
| `smallNoteMag` | מקדם גודל של תו קטן | `layoutmeasure.cpp:700` |
| `graceNoteMag` | מקדם גודל של grace note | `layoutmeasure.cpp:707` |
| `maxStaffSpread` | פיזור מקסימלי בין staves | `verticalgapdata.cpp:42` |
| `maxSystemSpread` | פיזור מקסימלי בין systems | `verticalgapdata.cpp:78` |

---

## פונקציות מפורטות — Call Graph

---

## Layout::doLayoutRange()
- **קובץ:** `src/engraving/layout/layout.cpp` שורה 74
- **קוראת ל:**
  - `LayoutMeasure::getNextMeasure()` — מוציא את התיבה הבאה לעיבוד
  - `LayoutSystem::collectSystem()` — אוסף תיבות לשורה
  - `Layout::doLayout()` — לולאת דפים ראשית
  - `Layout::layoutLinear()` — עבור מצב continuous view
- **שימוש ב-Spatium:** לא ישיר — מעביר options
- **Property Updates:** מאתחל `LayoutContext` עם `endTick`, `curSystem`, `nextMeasure`
- **Constants:** אין hardcoded — משתמש ב-`LayoutOptions`
- **הערה:** נקודת הכניסה הראשית. מבצע routing בין page mode ל-linear mode
- **סטטוס:** ממתין לתרגום

---

## Layout::doLayout()
- **קובץ:** `src/engraving/layout/layout.cpp` שורה 222
- **קוראת ל:**
  - `LayoutPage::getNextPage()` — מתקדם לדף הבא
  - `LayoutPage::collectPage()` — מאסף systems לדף
- **שימוש ב-Spatium:** לא ישיר
- **Property Updates:** מנקה systems שלא נדרשים עוד מ-`lc.systemList`
- **לולאות:** לולאה `do...while` עד שמגיע לסוף הפרטיטורה או שהדף מתייצב
- **סטטוס:** ממתין לתרגום

---

## LayoutMeasure::getNextMeasure()
- **קובץ:** `src/engraving/layout/layoutmeasure.cpp` שורה 582
- **קוראת ל:**
  - `createMMRest()` — יוצר multi-measure rest אם נדרש
  - `measure->connectTremolo()` — מחבר tremolo בין אקורדים
  - `chord->cmdUpdateNotes()` — מעדכן accidentals
  - `chord->computeUp()` — מחשב כיוון גבעול
  - `chord->layoutStem()` — מחשב גבעול ראשוני
  - `layoutDrumsetChord()` — מיקום תווי תופים
  - `ks->layout()` — מפרש key signature
  - `e->layout()` — מפרש clef / timesig / ambitus
- **שימוש ב-Spatium:** ב-`layoutDrumsetChord()`: `note->setPosY((line + off*2.0) * spatium * .5 * ld)`
- **Property Updates:**
  - `ctx.prevMeasure`, `ctx.curMeasure`, `ctx.nextMeasure`
  - `chord->setMag()` — מקדם גודל
  - `stem->setBaseLength()` — כאשר יש tremolo
- **Constants:** `m * score()->styleD(Sid::smallNoteMag)`, `score()->styleD(Sid::graceNoteMag)`
- **לולאות:** לולאה על כל staffIdx, על כל segment, על כל track ב-segment
- **סטטוס:** ממתין לתרגום

---

## LayoutSystem::collectSystem()
- **קובץ:** `src/engraving/layout/layoutsystem.cpp` שורה 62
- **קוראת ל:**
  - `getNextSystem()` — מוציא/יוצר System ריק
  - `system->setInstrumentNames()` — מגדיר שמות כלים
  - `LayoutMeasure::computePreSpacingItems()` — מחשב מרחקים מקדימים
  - `m->shortestChordRest()` — מוצא את ה-note הקצר ביותר בתיבה
  - `system->layoutSystem()` — [System::layoutSystem] מיקום staves ו-brackets
  - `m->addSystemHeader()` — מוסיף clef/keysig בתחילת שורה
  - `m->computeWidth()` — מחשב רוחב תיבה
  - `LayoutBeams::breakCrossMeasureBeams()` — שובר beams בין תיבות
  - `hideEmptyStaves()` — מסתיר staves ריקות
  - `justifySystem()` — מפזר תיבות לכל רוחב הדף
  - `m->layoutMeasureElements()` — מפרש אלמנטים בתיבה
  - `m->layoutStaffLines()` — מפרש קווי חמשה
  - `layoutSystemElements()` — beams, skylines, slurs
  - `System::layout2()` — מרחקים אנכיים בין staves
- **שימוש ב-Spatium:** `targetSystemWidth = score()->styleD(Sid::pagePrintableWidth) * DPI`
- **Property Updates:** `system->setWidth()`, `mb->setPos()`, `mb->setParent()`
- **Constants:** `squeezability = 0.3` — מקדם דחיסה של system לפני שבירה
- **לולאות:**
  - לולאת איסוף תיבות: עובדת על `ctx.curMeasure` עד שהשורה מתמלאת
  - לולאת עדכון תיבות קודמות כאשר `minTicks`/`maxTicks` משתנים
- **הערה:** אלגוריתם Greedy עם backtracking: מוסיף תיבות עד גבול, מסיר אחרונה אם חורגת
- **סטטוס:** ממתין לתרגום

---

## LayoutSystem::justifySystem()
- **קובץ:** `src/engraving/layout/layoutsystem.cpp` שורה 496
- **קוראת ל:**
  - `Segment::stretchSegmentsToWidth()` — מחלק את הרווח הנותר בין segments
  - `m->respaceSegments()` — מחשב מחדש מיקומי segments לאחר stretch
- **שימוש ב-Spatium:** לא ישיר
- **Property Updates:** `s->setWidth()` דרך `stretchSegmentsToWidth`
- **מנגנון:** Spring model — כל segment הוא "קפיץ" עם `springConst = 1/stretch`
- **לולאות:** לולאה על כל segments מסוג ChordRest הנראים
- **סטטוס:** ממתין לתרגום

---

## LayoutSystem::layoutSystemElements()
- **קובץ:** `src/engraving/layout/layoutsystem.cpp` שורה 670
- **קוראת ל:**
  - `m->layoutMeasureNumber()` — מספרי תיבות
  - `m->layoutMMRestRange()` — טווח multi-measure rest
  - `LayoutBeams::layoutNonCrossBeams()` — beams לא cross-staff
  - `s->createShapes()` — בניית collision shapes
  - [בניית skyline] `ss->skyline().add()` — הוספת shapes ל-skyline
  - `Beam::addSkyline()` — beam מוסיף את עצמו ל-skyline
  - `Fingering::layout()` — מיקום אצבועות
  - `Chord::layoutArticulations()` — מיקום ארטיקולציות
  - `Chord::layoutArticulations2()` — שלב שני
  - `LayoutTuplets::layout()` — פריסת tuplets
  - `doLayoutTies()` — פריסת ties
  - [spanners] Volta, Slur, Tie, Hairpin וכד'
- **שימוש ב-Spatium:** `0.65 * system->spatium()` ל-slur offsets
- **Property Updates:** `Fingering::setPos()`, shapes, skyline
- **לולאות:**
  - לולאה על כל segment ב-sl (רשימת ChordRest segments)
  - לולאה על כל staff לבניית skyline
  - לולאה על spanners (slurs, ties, hairpins)
- **הערה קריטית:** הסדר חשוב — beams לפני skyline, skyline לפני fingering/articulation
- **סטטוס:** ממתין לתרגום

---

## System::layoutSystem()
- **קובץ:** `src/engraving/libmscore/system.cpp` שורה 422
- **קוראת ל:**
  - `layoutBrackets()` — מיקום brackets
  - `totalBracketOffset()` — חישוב רוחב brackets
  - `instrumentNamesWidth()` — רוחב שמות כלים
  - `InstrumentName::layout()` — מפרש שם כלי
  - `setBracketsXPosition()` — מיקום אופקי של brackets
- **שימוש ב-Spatium:**
  - `spatium()` לחישוב גובה staff: `h = (staffLines-1) * lineDistance * staffMag * spatium()`
  - `styleP(Sid::firstSystemIndentationValue) * mag()` להזחה
- **Property Updates:**
  - `s->bbox().setRect(_leftMargin + xo1, 0.0, 0.0, h)` — bbox של כל SysStaff
  - `_leftMargin` — שוליים שמאליים של המערכת
- **Constants:**
  - `Sid::instrumentNameOffset` — מרחק שמות כלים מה-staff
  - `Sid::firstSystemIndentationValue` — הזחה ראשונה
- **סטטוס:** ממתין לתרגום

---

## System::layout2()
- **קובץ:** `src/engraving/libmscore/system.cpp` שורה 884
- **קוראת ל:**
  - [בניית רשימת staves נראים]
  - [חישוב dist בין staves]
  - `Spacer::layout()` — פריסת spacers
  - `Skyline` — חישוב מרחק מינימלי
- **שימוש ב-Spatium:**
  - `_spatium = spatium()`
  - `dist += akkoladeDistance * mag` / `staffDistance`
  - `yOffset = _spatium * BARLINE_SPAN_1LINESTAFF_TO * 0.5` (קבוע: 0.5)
- **Property Updates:**
  - `ss->bbox().setRect(_leftMargin, y - yOffset, width()-_leftMargin, h)` — bbox של SysStaff
  - `ss->setYOff(yOffset)`
  - `ss->saveLayout()`
- **Constants:**
  - `Sid::minVerticalDistance` — מרחק מינימלי בין staves
  - `Sid::staffDistance` / `Sid::akkoladeDistance`
  - `BARLINE_SPAN_1LINESTAFF_TO`, `BARLINE_SPAN_1LINESTAFF_FROM` — קבועים לחמשה חד-קווית
- **סטטוס:** ממתין לתרגום

---

## Chord::layout()
- **קובץ:** `src/engraving/libmscore/chord.cpp` שורה 2023
- **קוראת ל:**
  - `calcRelativeMag()` — מחשב מקדם גודל יחסי
  - `layoutTablature()` — אם tablature staff
  - `layoutPitched()` — אם pitched staff (הנפוץ)
- **שימוש ב-Spatium:** עקיף — קורא ל-`layoutPitched()` שמשתמש ב-spatium
- **סטטוס:** ממתין לתרגום

---

## Chord::layoutPitched()
- **קובץ:** `src/engraving/libmscore/chord.cpp` שורה 2083
- **קוראת ל:**
  - `c->layoutPitched()` — רקורסיבי על grace notes
  - `note->layout()` — מפרש כל note
  - `layoutStem()` — מפרש גבעול
  - `addLedgerLines()` — מוסיף ledger lines
  - `_arpeggio->setPos()` — מיקום arpeggio
  - `_hook->setPos()` — מיקום flag/hook
- **שימוש ב-Spatium:**
  - `double _spatium = spatium()`
  - `double dotNoteDistance = score()->styleMM(Sid::dotNoteDistance) * mag_`
  - `note->setPos(x, y)` — y מחושב מ-`line * _spatium * .5`
  - `_arpeggio->setPos(-(lll + extraX), y1)` / `setHeight(h)`
- **Property Updates:**
  - `note->setPos(x, y)` — מיקום כל note
  - `_stem->setPos()` — מיקום גבעול
  - `_hook->setPos()` — מיקום flag
  - `_arpeggio->setPos()`, `_arpeggio->setHeight()`
  - `ledgerLine->setPos()` — ledger lines
  - `setbbox(bb)` — bbox כולל של האקורד
- **Constants:**
  - `_spatium * .5` — חצי spatium לחישוב שורה
  - `Sid::dotNoteDistance` — מרחק נקודה
- **לולאות:** לולאה על `_notes`, לולאה על grace notes, לולאה על לידגר ליינים
- **סטטוס:** ממתין לתרגום

---

## Measure::layoutMeasureElements()
- **קובץ:** `src/engraving/libmscore/measure.cpp` שורה 3233
- **קוראת ל:**
  - `LayoutChords::repositionGraceNotesAfter()` — מיקום grace notes-after
  - `mmrest->layout()` — מפרש multi-measure rest (ממרכז בחלל)
  - `mmrest->setPosX()` — מיקום אופקי
  - `e->layout()` — מפרש אלמנטים כלליים
  - `e->setPosX((x2-x1-e->width())*.5 + x1 - s.x() - e->bbox().x())` — מרכוז rest/repeat
  - `Tremolo::layout()` — מפרש tremolo
  - `s.createShape()` — בניית shape של segment
- **שימוש ב-Spatium:**
  - `score()->styleMM(Sid::multiMeasureRestMargin)` — שוליים
  - `styleP(Sid::barWidth) * 0.5` — חצי עובי קו
- **Property Updates:**
  - `e->setPosX()` — מיקום אופקי של אלמנטים
  - `mmrest->setWidth(w)` — רוחב multi-measure rest
- **Constants:**
  - `Sid::multiMeasureRestMargin` — שוליים בצדדי rest
  - ClickCoords = x1, x2 מחושבים מ-`s1->x() + s1->minRight()`, `s2->x() - s2->minLeft()`
- **סטטוס:** ממתין לתרגום

---

## Measure::layout2()
- **קובץ:** `src/engraving/libmscore/measure.cpp` שורה 711
- **קוראת ל:**
  - `sp->layout()` — מפרש spacers
  - `sp->setPos()` — מיקום spacer
  - `MeasureBase::layout()` — layout breaks
  - `c->layoutSpanners()` — ties/slurs בתוך המידה
  - `layoutCrossStaff()` — אלמנטים cross-staff
- **שימוש ב-Spatium:**
  - `double _spatium = spatium()`
  - `sp->setPos(_spatium * .5, y + n * _spatium * staff->staffMag(tick()))` — מיקום spacer
- **Property Updates:** `sp->setPos()` — מיקום Spacers
- **סטטוס:** ממתין לתרגום

---

## LayoutChords::layoutChords1()
- **קובץ:** `src/engraving/layout/layoutchords.cpp` שורה 64
- **קוראת ל:**
  - `layoutChords2()` — מיקום noteheads (up/down)
  - `layoutChords3()` — יישור נוסף של אקורדים עם accidentals
  - `layoutSegmentElements()` — מפרש כל element בסגמנט
- **שימוש ב-Spatium:** `double sp = staff->spatium(tick)` — spatium מותאם ל-staff scale
- **Property Updates:**
  - מיקום noteheads ביחס אחד לשני (overlap handling)
  - מחשב `maxUpWidth`, `maxDownWidth` — רוחב noteheads לכל כיוון
- **Constants:**
  - `nominalWidth = score()->noteHeadWidth() * staff->staffMag(tick)` — רוחב ראש תו
  - `Sid::stemWidth`, `Sid::dotNoteDistance`, `Sid::accidentalDistance`, `Sid::accidentalNoteDistance`
- **לולאות:**
  - מיין up/down notes
  - חישוב overlap בין up-stem ו-down-stem notes
- **סטטוס:** ממתין לתרגום

---

## LayoutBeams::layoutNonCrossBeams()
- **קובץ:** `src/engraving/layout/layoutbeams.cpp`
- **קוראת ל:** `Beam::layout()` — על כל beam ראשון
- **שימוש ב-Spatium:** דרך `Beam::layout()`
- **סטטוס:** ממתין לתרגום

---

## LayoutPage::getNextPage()
- **קובץ:** `src/engraving/layout/layoutpage.cpp` שורה 60
- **קוראת ל:** `Factory::createPage()` — יוצר דף חדש אם נדרש
- **שימוש ב-Spatium:** לא ישיר
- **Property Updates:**
  - `lc.page->bbox().setRect(0.0, 0.0, options.loWidth, options.loHeight)` — גודל דף
  - `lc.page->setNo(lc.curPage)` — מספר דף
  - `lc.page->setPos(x, y)` — מיקום דף בזרם הצפייה
- **Constants:**
  - `MScore::verticalPageGap` — רווח אנכי בין דפים (בצפייה אנכית)
  - `MScore::horizontalPageGapOdd/Even` — רווח אופקי בין דפים (עמוד זוגי/אי-זוגי)
- **סטטוס:** ממתין לתרגום

---

## LayoutPage::collectPage()
- **קובץ:** `src/engraving/layout/layoutpage.cpp` שורה 103
- **קוראת ל:**
  - `ctx.prevSystem->minDistance(ctx.curSystem)` — מרחק מינימלי בין systems
  - `ctx.curSystem->setPos(ctx.page->lm(), y)` — מיקום system בדף
  - `ctx.curSystem->restoreLayout2()` — שחזור layout קיים
  - `ctx.page->appendSystem()` — מוסיף system לדף
  - `LayoutSystem::collectSystem()` — אוסף system חדש אם נדרש
  - `distributeSystemsAndStavesToPages()` — פיזור אנכי ב-justification
- **שימוש ב-Spatium:**
  - `ctx.score()->styleMM(Sid::staffLowerBorder)` — שוליים תחתונים
  - `ctx.score()->styleMM(Sid::staffHeaderFooterPadding)` — ריפוד
  - `ctx.score()->styleMM(Sid::staffUpperBorder)` — שוליים עליונים
- **Property Updates:**
  - `ctx.curSystem->setPos(page->lm(), y)` — מיקום אנכי של system
  - `ctx.page->appendSystem()` — רשימת systems בדף
- **לולאות:** לולאה עד שהדף מלא או אין systems נוספים
- **סטטוס:** ממתין לתרגום

---

## מבני נתונים מפתח להמרה ל-TypeScript

### LayoutContext (layoutcontext.h)
```typescript
interface LayoutContext {
  score: Score;
  page: Page;
  curPage: number;
  curSystem: System | null;
  prevSystem: System | null;
  curMeasure: MeasureBase | null;
  prevMeasure: MeasureBase | null;
  nextMeasure: MeasureBase | null;
  startTick: Fraction;
  endTick: Fraction;
  tick: Fraction;
  measureNo: number;
  firstSystem: boolean;
  firstSystemIndent: boolean;
  startWithLongNames: boolean;
  rangeDone: boolean;
  systemList: System[];
  pageOldMeasure: MeasureBase | null;
  systemOldMeasure: MeasureBase | null;
}
```

### היררכיית האובייקטים
```
Score (MasterScore)
  └─► Page[]
        └─► System[]
              └─► Measure[] (דרך System::ml)
                    └─► Segment[]
                          └─► EngravingItem[] (indexed by track)
                                └─► Chord / Rest
                                      └─► Note[]
                                      └─► Stem
                                      └─► Hook
                                      └─► LedgerLine[]
                                      └─► Articulation[]
```

### מושגי Spatium
- `spatium` = המרחק בין שני קווים סמוכים בחמשה
- ברירת מחדל: 1.5mm (כ-5.67px ב-96dpi)
- כל חישוב = מכפלה של spatium: `y = line * spatium * 0.5`
- חשוב: כל staff יכול לקנן גודל שונה (`staffMag`)

---

## זיהוי לולאות איטרטיביות קריטיות

### 1. חישוב רוחב תיבות בלולאה (collectSystem - שורה 125-152)
**בעיה:** הוספת תיבה שמכילה note קצר יותר גורמת לחישוב מחדש של רוחב כל התיבות הקודמות.  
**לולאה:** כל פעם שמשתנה `minTicks` או `maxTicks`, עוברים על כל התיבות שכבר נאספו.  
**השלכה ל-TypeScript:** יש לשמור `prevMinTicks`/`prevMaxTicks` לגיבוי מהיר.

### 2. Spring Model ב-justifySystem (שורה 496-532)
**בעיה:** החלוקה של הרווח הנותר בין segments היא iterative.  
**אלגוריתם:** מדרגת springs: `springConst = 1/stretch`, ממיין לפי `preTension`.  
**השלכה ל-TypeScript:** לממש `stretchSegmentsToWidth()` כאלגוריתם iterative.

### 3. Skyline collision detection (layoutSystemElements - שורה 720-814)
**בעיה:** לכל staff יש Skyline — profile עליון ותחתון המייצג גובה אלמנטים.  
**שימוש:** לחישוב מרחקים בין systems, ולמניעת התנגשויות.  
**השלכה ל-TypeScript:** Skyline = מבנה נתונים חיוני (מערך intervals).

### 4. Accidental stacking (layoutChords3)
**בעיה:** תאונות (accidentals) של notes באותו segment מוערמות משמאל ללא התנגשות.  
**לולאה:** bubble sort of accidentals by vertical position, then horizontal stacking.  
**השלכה ל-TypeScript:** יש לממש stack algorithm לפני ציור accidentals.

---

## הערות על מבנה הקבצים בפועל

**תיקיית layout נפרדת:** בניגוד לניתוח ה-Gemini, קוד ה-Layout **אינו** ב-`libmscore/` אלא ב-**`src/engraving/layout/`**:
- `layout.cpp` — orchestration ראשית
- `layoutmeasure.cpp` — עיבוד תיבות
- `layoutsystem.cpp` — עיבוד שורות
- `layoutpage.cpp` — עיבוד דפים
- `layoutchords.cpp` — יישור תווים ואקורדים
- `layoutbeams.cpp` — פריסת beams
- `layoutlyrics.cpp` — פריסת מילים
- `layouttremolo.cpp` — פריסת tremolo
- `layouttuplets.cpp` — פריסת tuplets
- `verticalgapdata.cpp` — נתוני ריווח אנכי

**libmscore** מכיל את ה-`layout()` method של כל element (Chord, System, Measure וכד').

---

## סטטוס עדכון

| קובץ | נסרק | מצב |
|------|------|-----|
| `layout/layout.cpp` | ✅ | מלא |
| `layout/layoutcontext.cpp` | ✅ | מלא |
| `layout/layoutmeasure.cpp` | ✅ | חלקי (getNextMeasure + createMMRest) |
| `layout/layoutsystem.cpp` | ✅ | חלקי (collectSystem + layoutSystemElements) |
| `layout/layoutpage.cpp` | ✅ | חלקי (getNextPage + collectPage) |
| `layout/layoutchords.cpp` | ✅ | חלקי (layoutChords1) |
| `layout/layoutbeams.cpp` | ✅ | חלקי (isTopBeam, notTopBeam) |
| `layout/layoutlyrics.cpp` | ✅ | Sid constants בלבד |
| `layout/verticalgapdata.cpp` | ✅ | Sid constants בלבד |
| `libmscore/chord.cpp` | ✅ | layout() + layoutPitched() |
| `libmscore/system.cpp` | ✅ | layoutSystem() + layout2() |
| `libmscore/measure.cpp` | ✅ | layoutMeasureElements() + layout2() |
| `libmscore/segment.cpp` | ⬜ | טרם נסרק |
| `libmscore/note.cpp` | ⬜ | טרם נסרק |
| `libmscore/rest.cpp` | ⬜ | טרם נסרק |
| `libmscore/beam.cpp` | ⬜ | טרם נסרק |
| `libmscore/stem.cpp` | ⬜ | טרם נסרק |
| `style/styledef.h` | ✅ | Sid enum — רשימת constants |

---

*עדכון אחרון: 2026-04-03 | הסשן הבא — המשך מ-segment.cpp ו-note.cpp*
