# MAP Renderer — Visual Test Guide

## מבנה תיקיות

```
renderer-tests/
  reference/       ← PNGs מwebmscore (אל תגע!)
  current/         ← PNGs מהרנדרר שלנו (מחולפים בכל ריצה)
  diff/            ← diff overlays (אדום = הבדל)
  fixtures/ →      public/renderer-tests/fixtures/ (15 XMLs)
  scripts/
    generate-refs-playwright.ts  ← מייצר reference מwebmscore (דרך דפדפן)
    generate-refs-webmscore.ts   ← מייצר reference מwebmscore (Node WASM ישיר)
    compare.ts                   ← pixelmatch diff
    report.ts                    ← HTML report
    update-refs.ts               ← מקדם current→reference (לאחר אישור)
  compare-result.json            ← תוצאות ריצה אחרונה
  TESTS.md                       ← קובץ זה
```

---

## פקודות

```bash
# שלב 1 — ייצור reference מwebmscore (פעם אחת, שמור כפי שהוא)
npx tsx renderer-tests/scripts/generate-refs-playwright.ts
# או: npx tsx renderer-tests/scripts/generate-refs-webmscore.ts

# שלב 2 — צלם פלט מהרנדרר שלנו
npm run test:r:capture

# שלב 3 — השוואה
npm run test:r:compare

# שלב 1+2+3 (capture + compare)
npm run test:r

# HTML report (פתח browser/report.html)
npm run test:r:report

# אישור טסט — קדם current→reference (לאחר תיקון)
npx tsx renderer-tests/scripts/update-refs.ts --id=01-noteheads
npx tsx renderer-tests/scripts/update-refs.ts --all
```

---

## איך ה-compare עובד

- pixelmatch, threshold 0.1, ignoreAA
- גדלים שונים: מרפד לבן עד מקסימום, אז משווה
- ⚠ SIZE MISMATCH: מזוהה ומדווח כשref≠cur — תמיד צריך להיות 0 אחרי rebuild
- diffPixels=0 → pass; כל שאר → fail

---

## טסט קייסים

| ID | תוכן | XML fixture |
|----|------|-------------|
| 01-noteheads | note heads, stems, flags, beams | public/renderer-tests/fixtures/01-noteheads.xml |
| 02-accidentals | sharps, flats, naturals, double | public/renderer-tests/fixtures/02-accidentals.xml |
| 03-rests | all rest durations | public/renderer-tests/fixtures/03-rests.xml |
| 04-beams | beam slopes, thickness, 2nd beams | public/renderer-tests/fixtures/04-beams.xml |
| 05-stems | direction by pitch, length | public/renderer-tests/fixtures/05-stems.xml |
| 06-key-signatures | C,G,D,A,F,Bb,Ab major | public/renderer-tests/fixtures/06-key-signatures.xml |
| 07-time-signatures | 4/4, 3/4, 2/4, 6/8, 5/4, 2/2 | public/renderer-tests/fixtures/07-time-signatures.xml |
| 08-ledger-lines | 1-3 ledgers above/below | public/renderer-tests/fixtures/08-ledger-lines.xml |
| 09-tuplets | triplets, quintuplets, brackets | public/renderer-tests/fixtures/09-tuplets.xml |
| 10-ties | single, cross-barline, chord ties | public/renderer-tests/fixtures/10-ties.xml |
| 11-chord-symbols | maj/min/7/maj7/dim/alt | public/renderer-tests/fixtures/11-chord-symbols.xml |
| 12-barlines | regular/double/repeat/final | public/renderer-tests/fixtures/12-barlines.xml |
| 13-dots | augmentation, double-dot | public/renderer-tests/fixtures/13-dots.xml |
| 14-chords | dyads, triads, 7ths, close 2nds | public/renderer-tests/fixtures/14-chords.xml |
| 15-mixed | jazz excerpt — integration | public/renderer-tests/fixtures/15-mixed.xml |

webmscore vtest scores: `C:\Users\DELL\Documents\webmscore\vtest\scores\` (357 mscx/mscz)

---

## מצב נוכחי

**ריצה אחרונה:** 2026-04-03 (סשן 3 — baseline rebuild + orchestrator) | **Pass: 0/15**

**BASELINE נקי:** ref=cur=2978×4209px, SIZE MISMATCH=0. כל הבדל הוא layout בלבד.

| ID | Match% | px differ | Δ מסשן קודם | עדיפות | הערות עיקריות |
|----|--------|-----------|------------|--------|----------------|
| 01-noteheads | 99.3% | 90,355 | −17K ✓ | גבוהה | title font, notes x-positions |
| 02-accidentals | 99.6% | 47,099 | same | בינונית | |
| 03-rests | 99.4% | 71,310 | +3K | בינונית | |
| 04-beams | 99.1% | 113,649 | same | גבוהה | beam geometry |
| 05-stems | 99.7% | 34,355 | same | בינונית | |
| 06-key-signatures | 99.3% | 83,356 | same | גבוהה | clef + key-sig x-position |
| 07-time-signatures | 99.3% | 92,669 | +1K | גבוהה | time-sig x-position |
| 08-ledger-lines | 99.6% | 45,752 | same | נמוכה | |
| 09-tuplets | 99.6% | 48,191 | −52K ✓✓ | נמוכה | |
| 10-ties | 99.7% | 38,890 | −34K ✓✓ | נמוכה | |
| 11-chord-symbols | 99.6% | 45,170 | same | בינונית | |
| 12-barlines | 99.8% | 29,458 | same | נמוכה | |
| 13-dots | 99.5% | 60,298 | same | נמוכה | |
| 14-chords | 99.5% | 61,015 | −37K ✓✓ | נמוכה | |
| 15-mixed | 99.1% | 115,293 | −3K ✓ | בינונית | |

---

## 🎯 הבאים בתור (סדר עדיפויות)

### 1. Note/glyph x-positions ← הבא!
ה-diff bands הגדולים ב-01-noteheads:
- `y=1250-1445` (max 690px/row) — system 2, כל התוים מוזזים
- `y=636-773` — system 1 staff area (note heads, stems)
סיבה סבירה: `BAR_NOTE_DIST_SP`, barline width, או header-width שגוי קצת.
בדוק: `placeSystem()` ב-horizontalLayout.ts, ו-x של note heads ב-svgRenderer.ts.

### 2. Title font rendering
Title band עדיין מופיע בdiff (y=214-295, max=142px/row).
אנו מציירים SVG `<text>` עם Leland, webmscore מציאר paths של Edwin.
הy-position תוקן (marginTop+83), ה-font-size תוקן (110px).
מה שנשאר: הבדל visual בין Edwin (paths) לבין Edwin/Leland (SVG text) — לא קל לתקן ב-100%.

### 3. Clef + time-sig x-position
ב-06-key-signatures ו-07-time-signatures עדיין offset.
בדוק: `svgRenderer.ts` → `renderClef()`, `renderTimeSig()` — האם headerWidth מחושב נכון?

### 4. Beam geometry (04-beams — 114,019 px differ)
הbeams הם ה-worst case. slope, thickness, position — כולם שונים מ-webmscore.

---

## ידע מצטבר — ממצאי תיקונים

### סשן 2026-04-01 (סשן 1)

| # | בעיה | ערך ישן | ערך חדש | קובץ | השפעה |
|---|------|---------|---------|------|-------|
| 1 | spatium שגוי (×5 גדול מדי) | 124 | 24.8 | `horizontalLayout.ts` | מ-~60% ל-~98% בכל הטסטים |
| 2 | NOTE_BASE_WIDTH_SP קטן מדי | 0.16 | 1.68 (1.18+0.5) | `horizontalLayout.ts` | תווים חופפים → מרווח נכון |
| 3 | stretch גלובלי במקום לוקלי | per-measure local | global (כל המזורות ביחד) | `horizontalLayout.ts` | מערכת אחת → 2 מערכות נכון |
| 4 | staffUpperBorder קטן | 2sp | 7sp | `verticalLayout.ts` | y ראשון של המערכת נכון |
| 5 | staffLowerBorder חסר לחלוטין | (לא היה) | 7sp | `verticalLayout.ts` | stride נכון |
| 6 | titleHeight קטן | 3sp | 10sp | `verticalLayout.ts` | מיקום מערכת 1 נכון |
| 7 | title font-size | 1.7sp | 2.0sp | `svgRenderer.ts` | |
| 8 | title y-position | marginTop + 1.2sp | marginTop + 9.0sp | `svgRenderer.ts` | |

### סשן 2026-04-03 (סשן 3 — Baseline Rebuild + LayoutOrchestrator)

| # | בעיה | ערך ישן | ערך חדש | קובץ | השפעה |
|---|------|---------|---------|------|-------|
| 12 | pageWidth: A4 metric (2976px) vs webmscore imperial (2978px) | 2976px | 2978px (`ceil(8.27×360)`) | `horizontalLayout.ts` | SIZE MISMATCH 15/15 → 0/15. כל diffs עכשיו layout בלבד |
| 13 | generate-refs viewport קטן מדי (1000×1400) | 1000×1400 | 2980×4220 | `generate-refs-playwright.ts` | viewport מכיל A4 מלא לפני resize |
| 14 | compare.ts: גדלים שונים בשקט | padding ללא דיווח | SIZE MISMATCH warning + refW/H/curW/H | `compare.ts` | אבחון מיידי של אי-התאמת גדלים |
| 15 | LayoutOrchestrator — מחבר engine לpipeline | `computeHorizontalLayout()` בלבד | `orchestrateHorizontalLayout()` ב-engine/ | `index.ts`, `engine/LayoutOrchestrator.ts` | 5 טסטים השתפרו (9→48K, 10→38K, 14→61K) |

**C++ drill — pageWidth:**
- `mscore/papersize.cpp`: `{ "A4", 8.27, 11.69 }` (inches — rounded imperial)
- `ceil(8.27 × 360 DPI) = ceil(2977.2) = 2978px` ← **webmscore actual output**
- שלנו היה: `floor(210/25.4 × 360) = floor(2976.38) = 2976px` ← שגוי

### סשן 2026-04-01 (סשן 2)

| # | בעיה | ערך ישן | ערך חדש | קובץ | השפעה |
|---|------|---------|---------|------|-------|
| 9 | instrument name "Piano" ב-system 1 מזיז הכל +123px | (לא היה) | הוסף `print-object="no"` לכל 15 fixtures + רגנרציה של references | fixtures/*.xml | System 1 x-positions תואמות עכשיו |
| 10 | title font-size קטן מדי | 2.0sp (49.6px) | 110px (22pt × 5px/pt at 360dpi) | `svgRenderer.ts` | title גדול יותר — עדיין שונה (font path vs SVG text) |
| 11 | title y-position נמוך מדי | marginTop + 9sp (436px) | marginTop + 83px (296px) | `svgRenderer.ts` | title baseline תואם webmscore |

**מקורות webmscore שנבדקו:**
- `src/engraving/libmscore/mscore.h`: `DPI=360`, `SPATIUM20=25.0`
- `src/engraving/style/styledef.cpp`: `staffUpperBorder=7sp`, `staffLowerBorder=7sp`, `minNoteDistance=0.5sp`, `barNoteDistance=1.3sp`, `minSystemDistance=8.5sp`, `measureSpacing=1.5`

---

## כלל עבודה: עדכן TESTS.md כל ~5 ניסיונות

**כשאתה עובד על תיקונים, עדכן את הקובץ הזה כל ~5 ניסיונות (capture+compare) או בסיום כל בעיה מרכזית — גם אם הסשן לא נגמר. כך אם הסשן נקטע, הסשן הבא יכול להמשיך מאיפה שנעצרת.**

בכל עדכון:
- עדכן את שורת "ריצה אחרונה"
- עדכן Match% בטבלה
- הוסף שורה לטבלת "ממצאי תיקונים"
- עדכן "הבאים בתור"

---

## סדר עבודה מומלץ

1. התחל מ-**06-key-signatures** / **07-time-signatures** (clef + time-sig positioning)
2. לאחר מכן **01-noteheads** (title + system-2 stride + note x)
3. לאחר מכן **04-beams** (beam geometry)
4. צפה ב-`diff/XX-name.diff.png` — אדום = הבדל
5. פתח `renderer-tests/current/XX.png` לצד `reference/XX.png`
6. זהה את ההבדל → חפש בקוד webmscore מה אחראי
7. תקן בקוד הרנדרר שלנו
8. `npm run test:r:capture && npm run test:r:compare`
9. **כל ~5 ניסיונות — עדכן TESTS.md**
10. כש-pass → עדכן טבלה → עבור לטסט הבא
