# MAP — Scripts Specification
## אפיון סקריפטים לניתוח מוזיקלי

---

## ⚠️ שאלה פתוחה קריטית — יש לענות לפני כתיבת קוד

**איפה הסקריפטים כותבים את התוצאות שלהם?**

כרגע `annotationStore` שומר Annotation objects ב-IndexedDB (JavaScript only, לא ב-XML עצמו).
יש שלוש אפשרויות:

### אפשרות A — הסקריפט כותב Annotations חדשים ל-annotationStore
- הסקריפט מריץ ניתוח → יוצר Annotation objects → מוסיף ל-store
- יתרון: עקבי עם המערכת הקיימת, AnnotationOverlay מציג אוטומטית
- חיסרון: האם `noteColor` layer מספיק לצביעה מלודית? יש לבדוק

### אפשרות B — הסקריפט כותב custom attribute ב-XML עצמו
- פורמט: `<note>` עם namespace מותאם, למשל `<notations><technical><other-technical value="map:passing-tone"/></technical></notations>`
- יתרון: הניתוח "נסע" עם הקובץ אם יוצאים XML
- חיסרון: מסובך יותר, צריך לשנות את prepareMusicXML ו-xmlParser

### אפשרות C — הסקריפט שומר ב-analysis.json נפרד
- יתרון: נקי, קל לקלוד קוד לקרוא
- חיסרון: עוד קובץ לנהל

**המלצה לדון עם Mario:** כנראה A היא הכי פשוטה ועקבית. יש לבדוק שה-`noteColor` layer עם tag per note עובד טכנית.

---

## סקריפט 1 — צביעת תפקידים מלודיים

### מטרה
לכל תו ביצירה, זהה את תפקידו ביחס לאקורד ברקע וסמן אותו בצבע.

### קלט
- `noteMap` מ-scoreStore (כל התווים עם pitch, beat, measureNum)
- annotations של layer `harmony` מ-annotationStore (אקורדים מסומנים ידנית)
- key signature מה-XML (דרך scoreStore.metadata)
- תיוגי מעבר סולם: annotations של layer `form` עם tag `KEY_CHANGE` + שדה `toKey` (יש לוודא שהשדה הזה קיים ב-Annotation type)

### לוגיקה

**שלב 1 — בנה מפת סקלות לפי measure**
```
לכל measure: מה הסקלה הפעילה?
- ברירת מחדל: key signature מה-metadata
- אם יש KEY_CHANGE annotation שמתחיל ב-measure זה: החלף סקלה
```

**שלב 2 — בנה מפת אקורדים לפי (measure, beat)**
```
מה-harmony annotations: לכל נקודה (measureNum, beat) → chord tones
chord tones = שלוש/ארבע תווים לפי סוג האקורד
```

**שלב 3 — סווג כל תו**
```
לכל note ב-noteMap:
  chord_tones = getChordTones(measure, beat)
  scale_notes = getScale(measure)

  if pitch ∈ chord_tones → CHORD_TONE
  else if pitch ∈ scale_notes → DIATONIC_NON_CHORD
    → בדוק passing/neighbor:
       prev_note, next_note = השכנים הזמניים
       if prev_note ∈ chord_tones AND next_note ∈ chord_tones:
         if prev_pitch ≠ next_pitch → PASSING_TONE
         if prev_pitch = next_pitch → NEIGHBOR_TONE
       else → AMBIGUOUS (לא ניתן להחליט)
  else → CHROMATIC
```

**טיפול ב-edge cases:**
- תו ראשון/אחרון בפרזה (אין שכן) → AMBIGUOUS
- תו ארוך (half note ומעלה) → לא passing/neighbor, תמיד CHORD_TONE או DIATONIC
- rest לא מקבל תפקיד

### פלט
Annotation אחד לכל תו עם:
```typescript
{
  layer: 'noteColor',
  noteIds: [noteId],
  colorType: 'CHORD_TONE' | 'PASSING_TONE' | 'NEIGHBOR_TONE' | 'CHROMATIC' | 'AMBIGUOUS'
}
```

### צבעים מוצעים
| תפקיד | צבע |
|--------|-----|
| CHORD_TONE | כחול |
| PASSING_TONE | ירוק |
| NEIGHBOR_TONE | צהוב/כתום |
| CHROMATIC | אדום |
| AMBIGUOUS | אפור |

### תנאי הפעלה
הסקריפט **דורש** שיהיו harmony annotations — אם אין, יציג הודעה: "אין אקורדים מסומנים. סמן אקורדים לפני הרצת הסקריפט."

---

## סקריפט 2 — זיהוי מוטיבים

### מטרה
המשתמש מסמן X תווים ומגדיר אותם כ"מוטיב A". הסקריפט מחלץ פרופיל ומחפש מופעים ביצירה.

### קלט
- selection נוכחי (noteIds) — התווים המסומנים כמוטיב
- שם המוטיב (A, B, C...) — נבחר ב-UI
- פרמטרי חיפוש (ראה למטה)
- `noteMap` מלא מ-scoreStore

### פרופיל המוטיב
מהתווים המסומנים, הסקריפט מחלץ:
```
intervals[] = הפרשי pitch (בחצאי טונות) בין תווים עוקבים
durations[] = ערכי משך (quarter=1, eighth=0.5, etc.)
contour[] = [UP, DOWN, SAME] לכל אינטרוול
```

### פרמטרי חיפוש

**מצב אינטרוולי:**
- `EXACT` — התאמה מדויקת בחצאי טונות (+ טרנספוזיציה חופשית)
- `CATEGORICAL` — התאמה לפי סוג: second/third/fourth/fifth/sixth/seventh/octave
  - אפשרות: האם גדולה/קטנה/מוגדלת = אותו סוג? (checkbox)

**טרנספורמציות (כל אחת checkbox נפרד):**
- `INVERSION` — כל אינטרוול מתהפך (UP↔DOWN, אותו גודל)
- `RETROGRADE` — סדר התווים הפוך
- `AUGMENTATION` — כל המשכים מוכפלים פי 2
- `DIMINUTION` — כל המשכים מחולקים ב-2

**סף התאמה:**
- slider: 60% / 70% / 80% / 90% / 100%
- משמעות: אחוז האינטרוולים שחייבים להתאים

### אלגוריתם חיפוש
```
לכל מיקום אפשרי ביצירה (sliding window באורך המוטיב):
  חלץ window_intervals[]
  לכל טרנספורמציה מופעלת:
    compare(motif_intervals, transformed_window_intervals)
    חשב match_score = אחוז האינטרוולים התואמים
    if match_score >= threshold:
      רשום מופע: {measureStart, noteIds, transformation, score}
```

### פלט
- Annotation לכל מופע עם:
```typescript
{
  layer: 'motif',
  motifId: 'A',
  noteIds: [...],
  matchScore: 0.85,
  transformation: 'INVERSION' | 'EXACT' | ...
}
```
- RightPanel מציג: "נמצאו X מופעים של מוטיב A"
- כל מופע מוצבע בצבע ייחודי לפי motifId (A=כתום, B=סגול, C=ירוק...)

---

## אינטגרציה ב-UI

### כפתור הרצה
מוסיף ל-TopBar (או LeftPanel) כפתור "🔬 הרץ סקריפט" שפותח modal לבחירת סקריפט.

### Modal הגדרות
- שם הסקריפט
- הפרמטרים הרלוונטיים לסקריפט שנבחר
- כפתור "הרץ"
- progress indicator בזמן ריצה

### תוצאות
- מוצגות על גבי הפרטיטורה (AnnotationOverlay הקיים)
- ניתן לבטל (Ctrl+Z רגיל)
- ניתן לשמור כ-layer נפרד

---

## סדר בנייה מומלץ

1. **קודם** — ודא שצביעה ברמת תו בודד עובדת ב-noteColor layer (בדוק עם annotation ידני)
2. **סקריפט 2 (מוטיבים)** — לא תלוי בהרמוניה, לוגיקה נקייה, תחושת הצלחה מהירה
3. **סקריפט 1 (מלודי)** — תלוי בהרמוניה, יש לוודא שה-harmony annotations נגישים לסקריפט

---

## שאלות לקלוד קוד לפני התחלה

1. **annotation storage** — האם הגיוני לכתוב תוצאות סקריפטים כ-Annotations ל-annotationStore? או עדיף מבנה נפרד?
2. **noteColor per note** — בדוק שאפשר ליצור Annotation עם noteIds של תו בודד ו-colorType. האם `NoteColorMenu` ו-`AnnotationOverlay` כבר תומכים בזה?
3. **note neighbors** — `noteMap` מכיל מידע על תו קודם/הבא? אם לא, צריך לבנות index ממוין לפי (measure, beat)
4. **harmony annotations** → chord tones: האם יש כבר פונקציה שממירה label של אקורד (נגיד "G7") לרשימת pitch classes? אם לא, צריך לבנות.
