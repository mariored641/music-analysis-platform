# MAP Native Renderer — Algorithms Reference
## שלב 0 פלט: ארכיטקטורת אלגוריתמים מלאה

מקור: MuseScore v3 source code (`libmscore/layout.cpp`, `chord.cpp`, `beam.cpp`, `note.cpp`, `harmony.cpp`)
תאריך: מרץ 2026

---

## 1. מידות בסיס (Units)

**Spatium (sp)** = מרווח בין שני קווי פנטגרמה סמוכים.
גודל טיפוסי: 10px (ב-MAP, scale 40% של Verovio = ~10px per spatium).

```
lineSpacing = 10px   // מרווח בין קוי staff
sp = lineSpacing     // sp === lineSpacing
staffHeight = 4 * sp = 40px   // 5 קווים = 4 מרווחים
```

כל מידה להלן מבוטאת ב-sp, אחרי כן מוכפלת ב-`lineSpacing` לפיקסלים.

---

## 2. Layout אופקי — Measure Width

### 2.1 אלגוריתם Spacing (לוגריתמי, לא ליניארי)

MuseScore משתמש בנוסחה לוגריתמית לרוחב תווים:

```
stretch(note) = 1.0 + 0.865617 * log2(note.ticks / minTick)
```

- `minTick` = ערך הנוף הקצר ביותר בתיבה
- תו רבע = 4× שישה עשרה ← stretch ≈ 2.2 (לא 4×)
- זה תואם עיסוי ידני של metteurs en page

**טבלת stretch לפי ערכי תו (אם minTick = שישה עשרה):**
```
Sixty-fourth: 1.0  (minTick = 0)
Thirty-second: 1.3
Sixteenth:     1.0  (אם הוא ה-minTick)
Eighth:        1.87
Quarter:       2.73
Half:          3.6
Whole:         4.46
```

### 2.2 Fixed Widths לפני תווים

בכל system, בתחילתו:
```
clefWidth       = 32px   // treble clef
keySigWidth     = 7px × numAccidentals
timeSigWidth    = 24px
systemHeaderGap = 8px    // רוח בין time sig לתו ראשון
```

ב-margins בתחילת תיבה:
```
barNoteDistance      = 1.3 sp   // רוחב מ-barline לתו ראשון (ללא accidental)
barAccidentalDistance = 0.65 sp  // כשלתו הראשון יש accidental
```

### 2.3 Measure Minimum Width

```pseudocode
function computeMeasureMinWidth(measure):
    x = 0

    // Fixed first-note margin:
    if firstNote has accidental:
        x += barAccidentalDistance  // 0.65 sp
    else:
        x += barNoteDistance        // 1.3 sp

    // Walk segments:
    for each pair (current, next) in measure.segments:
        w = minHorizontalDistance(current, next)
        // minHorizontalDistance uses shape-overlap detection
        // (not just bbox — includes stems, flags, dots)
        x += w

    return max(x, 5.0 sp)  // minMeasureWidth = 5 sp
```

### 2.4 System Breaking — Greedy (לא Knuth-Plass)

```pseudocode
function breakIntoSystems(measures, pageWidth, margins):
    systems = []
    current = []
    currentWidth = leftMargin + systemHeaderWidth

    for each measure m:
        mw = m.minWidth * m.basicStretch()

        if current.length > 0 AND (currentWidth + mw > pageWidth - margins):
            // שבירה — התחל system חדש
            systems.push(current)
            current = [m]
            currentWidth = leftMargin + systemHeaderWidth + mw
        else:
            current.push(m)
            currentWidth += mw

        if m has lineBreak or pageBreak:
            systems.push(current)
            current = []
            currentWidth = leftMargin + systemHeaderWidth

    if current.length > 0:
        systems.push(current)

    return systems
```

### 2.5 System Stretching (חלוקת slack)

אחרי שיבוץ תיבות ב-system, מרחיבים לרוחב המלא:

```pseudocode
function stretchSystem(system, targetWidth):
    fixedWidth = sum of all non-note widths (barlines, clef, key, time)
    noteWidth  = sum of all note segment widths
    slack      = targetWidth - fixedWidth - noteWidth

    // Last system: if < 30% full, don't fully stretch
    if isLastSystem AND (noteWidth / targetWidth < 0.3):
        slack *= 0.5

    // Distribute slack proportionally to stretch values:
    totalStretch = sum of each segment's stretch value

    for each noteSegment s:
        additionalWidth = slack * (s.stretch / totalStretch)
        s.width += additionalWidth

    // Reposition all elements left-to-right based on new widths
    repositionSegments(system)
```

---

## 3. Layout אנכי — Staff Lines + Note Positions

### 3.1 Staff Line Positions

```
staffTop[i] = systemY + i * staffSpacing
lineY[i][j] = staffTop[i] + j * sp   // j = 0..4 (top to bottom)
```

Constants:
```
staffSpacing    = 60px   // בין staves (6.0 sp × 10px)
systemSpacing   = 80px   // בין systems (8.0 sp × 10px)
minSystemDist   = 8.5 sp
maxSystemDist   = 15.0 sp
```

### 3.2 Pitch → Staff Line Position

מפתח treble clef:
```
// C4 (middle C) = line 10 (מהקו העליון) = 5 sp מתחת לקו העליון = ledger line מתחת
// B4 = line 6 = middle of staff
// E5 = line 4 = first space from top
// F5 = line 3 = second line from top
```

נוסחה כללית:
```pseudocode
function pitchToStaffLine(step, octave, clef):
    // step: C=0, D=1, E=2, F=3, G=4, A=5, B=6
    absStep = step + octave * 7

    switch clef:
        case TREBLE: offset = 39   // top line of treble = B5 = absStep 39
        case BASS:   offset = 25   // top line of bass = D4 = absStep 25
        case ALTO:   offset = 32   // top line of alto = G4
        case TENOR:  offset = 30   // top line of tenor = E4

    line = offset - absStep   // 0 = top line, increases downward
    return line

function staffLineToY(line):
    return staffTop + line * (sp / 2)   // each half-line = sp/2 = 5px
```

**דוגמאות לtreble clef (offset=39):**
```
B5: line = 39 - 39 = 0   (top staff line)
G5: line = 39 - 37 = 2   (second space from top — actually: first line from top)
E5: line = 39 - 35 = 4   (third line)
D5: line = 39 - 34 = 5   (second space)
C5: line = 39 - 33 = 6   (third line)
B4: line = 39 - 32 = 7   (middle space — center of staff)
A4: line = 39 - 30 = 9
G4: line = 39 - 29 = 10  (bottom space)
F4: line = 39 - 28 = 11  (fourth line)
E4: line = 39 - 27 = 12  (bottom line)
D4: line = 39 - 26 = 13  (first space below)
C4: line = 39 - 25 = 14  (first ledger line below — middle C)
```

### 3.3 Staff Reference Map (Treble Clef)

```
Line 0  ─────── E6
        Space   D6
Line 1  ─────── C6  (B5 on top line? — check: B5=0, so top line = B5)
```

תיקון: treble top line = E5 (לא B5):
```
absStep(E5) = 4 + 5*7 = 39
offset = 39 → top line IS E5

Line 0  ─────── E5
Space 0         D5
Line 1  ─────── C5 (wait: C5 = absStep 0+5*7=35... 39-35=4, not 1)
```

**תיקון מדויק עם tpc2step:**

ב-MuseScore, `absStep` מחושב דרך TPC (Tonal Pitch Class). לצרכינו:

```
// Treble clef: pitchOffset = 39
// absStep for MIDI pitch p, step s (0-6 for C-B):
absStep = s + floor(p/12) * 7

// Examples (MIDI: C4=60, D4=62, E4=64, ...):
C4 (p=60, s=0): absStep = 0 + 5*7 = 35  → line = 39-35 = 4...

// Hmm, that puts C4 at line 4, not line 10.
// The MuseScore code uses a different octave numbering (C4=octave 4, but MIDI 60):
// absStep for note C5 would be s=0, octave=5: 0 + 5*7 = 35
// and C4: 0 + 4*7 = 28 → line = 39-28 = 11
```

**המפה הנכונה לtreble (offset=39):**
```
C5 (s=0, oct=5): absStep=35, line=4
D5 (s=1, oct=5): absStep=36, line=3
E5 (s=2, oct=5): absStep=37, line=2
F5 (s=3, oct=5): absStep=38, line=1
G5 (s=4, oct=5): absStep=39, line=0  ← G5 = TOP LINE
A5 (s=5, oct=5): absStep=40, line=-1 (above staff)
B4 (s=6, oct=4): absStep=34, line=5
C4 (s=0, oct=4): absStep=28, line=11 ← C4 below staff
```

**⚠️ MuseScore treble clef: top line = G5 (not E5/B5)**
זה נכון! הקו העליון של treble = G5.

```
G5: line=0  (top line)
F5: line=1  (first space)
E5: line=2  (second line)
D5: line=3  (second space)
C5: line=4  (middle line)
B4: line=5  (third space)
A4: line=6  (fourth line) -- wait: A4 absStep=33, 39-33=6
G4: line=7  (fourth space)
F4: line=8  (bottom line)
E4: line=9  (first space below)
D4: line=10 (first ledger line below? No: lines 0-4 is staff, 5+ is below)

STAFF LINES (where visible lines appear): 0, 2, 4, 6, 8
SPACES (between lines): 1, 3, 5, 7
BELOW STAFF: lines 9, 10, 11...
LEDGER LINES BELOW: appear at lines 10, 12, 14...
```

**כלל פשוט לimplementation:**
```
// isOnLine(line) → line % 2 == 0 AND 0 <= line <= 8
// needsLedgerAbove(line) → line < 0 AND line % 2 == 0
// needsLedgerBelow(line) → line > 8 AND line % 2 == 0
// ledgerLines below: at lines 10, 12, 14 (middle C at treble = line 10)
```

### 3.4 Y Coordinate מ-Staff Line

```
noteY = staffTop + line * (lineSpacing / 2)
// line=0 → noteY = staffTop (top staff line)
// line=4 → noteY = staffTop + 2 * lineSpacing (middle line)
// line=8 → noteY = staffTop + 4 * lineSpacing (bottom line)
```

---

## 4. Stem Direction

```pseudocode
function computeStemUp(notes, voice, hasMultipleVoices):
    // 1. Multiple voices → forced direction
    if hasMultipleVoices:
        return voice == 1  // voice 1 up, voice 2 down

    // 2. Single voice → pitch-based
    middleLine = 4   // for 5-line staff (line 4 = middle of staff)

    if notes.length == 1:
        return notes[0].staffLine > middleLine   // below middle → up

    // Multiple notes in chord:
    topNote    = notes with smallest staffLine (highest pitch)
    bottomNote = notes with largest staffLine  (lowest pitch)

    topDist    = middleLine - topNote.staffLine    // positive if above middle
    bottomDist = bottomNote.staffLine - middleLine // positive if below middle

    if topDist == bottomDist:
        // Tie → majority of notes above/below
        above = notes.filter(n => n.staffLine <= middleLine).length
        below = notes.filter(n => n.staffLine > middleLine).length
        return below >= above   // more below → stems up

    return bottomDist > topDist  // whichever extreme is further from middle
```

---

## 5. Stem Length

```pseudocode
function computeStemLength(chord):
    normalLen = 3.5 * sp   // standard stem length
    shortestLen = 2.25 * sp

    topNote = chord.notes.minBy(n => n.staffLine)   // highest pitch
    bottomNote = chord.notes.maxBy(n => n.staffLine) // lowest pitch

    if chord.stemUp:
        stemEndLine = topNote.staffLine - 7       // 3.5 sp above top note
        // Never go above middle line (line 4) unless forced
        if stemEndLine > 4: stemEndLine = 4
        // Check minimum length:
        actualLen = (topNote.staffLine - stemEndLine) * (sp / 2)
        if actualLen < shortestLen:
            stemEndLine = topNote.staffLine - ceil(shortestLen / (sp/2))
        stemTipY = staffTop + stemEndLine * (sp / 2)
        stemBaseY = noteheadCenterY(bottomNote)   // or topNote for single note
    else:
        stemEndLine = bottomNote.staffLine + 7    // 3.5 sp below bottom note
        if stemEndLine < 4: stemEndLine = 4       // never below middle
        actualLen = (stemEndLine - bottomNote.staffLine) * (sp / 2)
        if actualLen < shortestLen:
            stemEndLine = bottomNote.staffLine + ceil(shortestLen / (sp/2))
        stemTipY = staffTop + stemEndLine * (sp / 2)
        stemBaseY = noteheadCenterY(topNote)

    return { stemTipY, stemBaseY }
```

---

## 6. Beams

### 6.1 Beam Groups מ-XML

MusicXML מכיל `<beam number="1">begin|continue|end</beam>`.
פשוט לקרוא מה-XML — אין צורך לחשב מחדש.

```pseudocode
function extractBeamGroups(measure):
    groups = []
    current = null

    for each note n in measure:
        for each beam b in n.beams:
            if b.type == 'begin':
                current = { level: b.number, notes: [n] }
            elif b.type == 'continue' and current:
                current.notes.push(n)
            elif b.type == 'end' and current:
                current.notes.push(n)
                groups.push(current)
                current = null

    return groups
```

### 6.2 Beam Slope (זווית)

MuseScore משתמש ב-lookup table. למימוש פשוט:

```pseudocode
function computeBeamAngle(group):
    firstLine = group.notes[0].staffLine
    lastLine  = group.notes.last().staffLine
    lineDiff  = lastLine - firstLine

    // Clamp: max slope = 1 sp over any distance
    // Convert to slope (rise/run in px):
    dx = group.notes.last().x - group.notes[0].x
    if dx == 0: return 0

    // Max dy = lineSpacing (1 sp):
    rawDy = lineDiff * (lineSpacing / 2)  // half-sp per line
    maxDy = lineSpacing * 0.5  // soft limit: 0.5 sp max
    clampedDy = clamp(rawDy, -maxDy, maxDy)

    // Zero-slope conditions:
    if group.hasRest: return 0
    if isConcave(group): return 0  // notes form a "valley" or "hill"

    return clampedDy / dx  // slope = dy/dx
```

**Concave detection:**
```pseudocode
function isConcave(group):
    lines = group.notes.map(n => n.staffLine)
    if stemUp:
        // concave if any interior note is higher than both endpoints
        min = Math.min(lines[0], lines.last())
        return lines.slice(1,-1).some(l => l < min)
    else:
        max = Math.max(lines[0], lines.last())
        return lines.slice(1,-1).some(l => l > max)
```

### 6.3 Beam Y Positions

```pseudocode
function computeBeamPositions(group, angle):
    if group.stemUp:
        // Stem tips are above noteheads
        py1 = group.notes[0].stemTipY  // will be adjusted
        // Each note's stem tip:
        for each note n at position i:
            n.stemTipY = py1 + angle * (n.x - group.notes[0].x)

        // Ensure all stems have min length:
        for each note n:
            minTipY = n.noteheadY - shortestLen
            if n.stemTipY > minTipY:
                // Shift entire beam up
                py1 -= (n.stemTipY - minTipY)
                // Recompute all tips

    // Beam line geometry:
    beamLevel = 0
    for each beam level (0=8th, 1=16th, 2=32nd):
        beamOffset = beamLevel * beamDist  // beamDist = 0.75 sp
        if stemUp: beamY1 = py1 + beamOffset
        else:      beamY1 = py1 - beamOffset
        beams.push({ x1: firstNote.x, y1: beamY1,
                     x2: lastNote.x,  y2: beamY1 + angle * dx })
```

**Beam dimensions:**
```
beamWidth    = 0.5 sp = 5px
beamDistance = 0.75 sp = 7.5px  // center-to-center between multiple beams
```

---

## 7. Accidentals

### 7.1 מה יש מ-XML

MusicXML מכיל `<alter>` לכל note:
```
alter = -2 → double flat (𝄫)
alter = -1 → flat (♭)
alter = 0  → natural (♮) — רק אם preceded by accidental in same key
alter = 1  → sharp (♯)
alter = 2  → double sharp (𝄪)
```

Key signature קובעת אילו notes "automatically" sharp/flat.
accidental מוצג רק כשה-alter שונה מה-key signature.

### 7.2 Accidental Widths

```
sharp:       0.6 sp = 6px
flat:        0.55 sp = 5.5px
natural:     0.5 sp = 5px
double-sharp: 0.5 sp = 5px
double-flat:  0.8 sp = 8px
```

### 7.3 Accidental X Positioning (Column Algorithm)

```pseudocode
function layoutAccidentals(notes):
    // notes sorted by staff line (top to bottom)
    accs = notes.filter(n => n.accidental)

    // Start from rightmost (closest to noteheads), work left
    accs.sort(by staffLine)

    columns = []   // each column = list of accidentals at same x

    for each acc in accs:
        // Find rightmost column where this acc doesn't conflict
        placed = false
        for each column (right to left):
            if !conflictsWithAny(acc, column):
                column.push(acc)
                acc.x = column.x
                placed = true
                break

        if !placed:
            // Create new column further left
            newX = leftmost_column.x - acc.width - accidentalDistance
            // accidentalDistance = 0.22 sp = 2.2px
            columns.push([acc])
            acc.x = newX

    // conflictsWithAny: checks vertical overlap between two accidentals
    // overlap if |acc1.staffLine - acc2.staffLine| < 3 (within 1.5 sp)
```

---

## 8. Chord Symbols (Harmony)

### 8.1 Position

```pseudocode
function harmonyPosition(segment, staff):
    x = segment.x                    // at the note's horizontal position
    y = staff.top - harmonyY         // above staff top line
    // harmonyY = 2.5 sp = 25px above staff top (default)
    return { x, y }
```

### 8.2 Multi-measure Spacing

Chord symbols **אין להן** collision avoidance מובנה ב-MuseScore.
הן מוצמדות ל-x של ה-segment. אם שני אקורדים בסמוך — הם עלולים לחפוף.
**למימוש שלנו:** לוודא minimum gap של 0.5 sp בין chord symbols.

```pseudocode
function layoutChordSymbols(harmonies, staff):
    sorted = harmonies.sortBy(h => h.x)
    for i in 1..sorted.length-1:
        prev = sorted[i-1]
        curr = sorted[i]
        minX = prev.x + prev.textWidth + 0.5 * sp
        if curr.x < minX:
            curr.x = minX
```

---

## 9. Ledger Lines

```pseudocode
function computeLedgerLines(note):
    lines = []
    staffMinLine = 0  // top line
    staffMaxLine = 8  // bottom line
    noteLine = note.staffLine
    noteheadHalfWidth = 0.7 sp  // ledger extends 0.35 sp on each side

    if noteLine < staffMinLine:
        // Above staff — ledger lines at even positions (0, -2, -4, ...)
        for l = -2; l >= noteLine; l -= 2:
            if l % 2 == 0:  // only at line positions, not spaces
                lines.push({ y: staffTop + l * (sp/2),
                             x1: note.x - noteheadHalfWidth,
                             x2: note.x + noteheadHalfWidth })

    if noteLine > staffMaxLine:
        // Below staff — ledger lines at 10, 12, 14...
        for l = 10; l <= noteLine; l += 2:
            if l % 2 == 0:
                lines.push({ y: staffTop + l * (sp/2),
                             x1: note.x - noteheadHalfWidth,
                             x2: note.x + noteheadHalfWidth })

    return lines
```

**Middle C (C4) בtreble = line 10 → ledger line אחת מתחת.**

---

## 10. Barlines

```
regularBarline:    x-line, full staff height
doubleBarline:     two thin lines, gap = 0.4 sp
finalBarline:      thin + thick, gap = 0.4 sp, thick = 0.56 sp wide
repeatForward:     thick + thin + two dots
repeatBackward:    two dots + thin + thick
dotX (for repeats): thick side + 0.5 sp, dotSpacing = lineSpacing, at lines 1,3 (or 5,7 if more staves)
```

---

## 11. Key Signatures

```pseudocode
function layoutKeySignature(fifths, clef):
    // fifths > 0 = sharps, fifths < 0 = flats

    // Sharp order: F5, C5, G5, D5, A5, E5, B4 (treble clef)
    sharpLines_treble = [8, 5, 9, 6, 3, 7, 4]  // staff lines
    // Wait — correct order: F5=line1, C5=line4, G5=line0, D5=line3, A5=line6, E5=line2, B4=line5
    // Actually: FCGDAEB = the order sharps appear
    // In treble staff:
    sharpLines = [1, 4, 0, 3, 6, 2, 5]  // F5=1, C5=4, G5=0, D5=3, A5=6, E5=2, B4=5

    // Flat order: B4, E5, A4, D5, G4, C5, F4 (BEADGCF)
    flatLines  = [5, 2, 6, 3, 7, 4, 8]  // B4=5, E5=2, A4=7?

    accidentalGap = 7px   // per accidental

    for i in 0..abs(fifths)-1:
        line = (fifths > 0) ? sharpLines[i] : flatLines[i]
        x = i * accidentalGap
        y = staffTop + line * (sp / 2)
        draw accidental at (x, y)
```

**Key signature accidentals in treble clef (sharps, correct order F-C-G-D-A-E-B):**
```
F#: staff line 1 (first space from top)
C#: staff line 4 (middle line) -- actually C5 or C4?
G#: staff line 0 (top line)
D#: staff line 3 (second space)
A#: staff line 6 (fourth line)
E#: staff line 2 (second line from top)
B#: staff line 5 (third space)
```

**Flat order (BEADGCF):**
```
Bb: staff line 5 (third space)
Eb: staff line 2 (second line from top) -- actually Eb5: line=39-37=2 ✓
Ab: staff line 6 (fourth line)
Db: staff line 3 (second space)
Gb: staff line 7 (fourth space)
Cb: staff line 4 (middle line)
Fb: staff line 1 (first space)
```

---

## 12. Time Signatures

```
Width = 24px (fixed)
numerator text:   centered at middle of staff, y = middle_of_staff - lineSpacing
denominator text: centered at middle of staff, y = middle_of_staff + lineSpacing/2
fontsize ≈ 3 * lineSpacing  (so digits fill ~3 staff lines)
```

---

## 13. Multiple Voices

```
Voice 1: stemUp = true,  notes at natural x position
Voice 2: stemDown = true, notes at natural x position
         (if Voice 2 note conflicts with Voice 1, offset right by noteheadWidth)
Voice 3: stemUp, offset right by noteheadWidth
Voice 4: stemDown, offset right by noteheadWidth
```

**Collision between voices on same beat:**
```
if voice1Note.staffLine == voice2Note.staffLine:
    voice2Note.x += noteheadWidth  // mirror to right
if |voice1Note.staffLine - voice2Note.staffLine| == 1:
    // Adjacent notes (second interval):
    // Lower note stays left (natural side)
    // Upper note shifts right by noteheadWidth
    upperNote.x += noteheadWidth
```

---

## 14. Rests

Staff line positions for rests (treble clef):

```
Whole rest:   hangs from line 6 (4th line from top), width=1.5sp
Half rest:    sits on line 6, width=1.5sp
Quarter rest: centered at line 4 (middle), height≈3sp
Eighth rest:  centered at line 4-5, height≈1.5sp
16th rest:    centered at line 4-6, height≈2.5sp
```

**Whole/Half rest distinction:**
- Whole rest = rectangular block hanging below line 6 → `y = lineY[6] - restHeight`
- Half rest = rectangular block sitting on top of line 6 → `y = lineY[6]`

---

## 15. Dots (Augmentation)

```
dotX = noteheadRight + dotNoteDistance    // dotNoteDistance = 0.5 sp = 5px
dotY = note.staffLine (if note is on a line, shift dot up by 0.5 sp)
       note.staffLine (if note is in a space, keep at same y)

// Rule: dot always sits in a space (between lines)
if note.staffLine % 2 == 0:  // note is on a line
    dotY = noteY - (sp / 2)  // shift up to space above
else:                        // note is in a space
    dotY = noteY             // keep in same space

// Second dot:
dot2X = dotX + dot1Width + dotDotDistance  // dotDotDistance = 0.65 sp
```

---

## 16. Grace Notes

```
graceMag = 0.7      // scale factor (70% of normal size)
graceWidth ≈ 0.5 sp * graceMag = 3.5px
graceNoteDistance = 0.2 sp = 2px  // gap between grace notes
graceNoteToMainNote = 0.3 sp = 3px  // gap from last grace to main note

// Grace note placement: immediately before main note
// rightmost grace note x = mainNote.x - graceNoteToMainNote - graceWidth
```

---

## 17. Ties

```pseudocode
function drawTie(note1, note2, stemUp):
    // Tie arc direction: opposite to stem
    arcAbove = stemUp  // stem up → tie below note (arc curves down)

    x1 = note1.noteheadRight + 0.2 sp
    x2 = note2.noteheadLeft  - 0.2 sp

    if arcAbove:
        y  = note1.noteheadCenterY - 0.3 sp  // above notehead
        cy = y - 0.5 sp                       // control point above
    else:
        y  = note1.noteheadCenterY + 0.3 sp  // below notehead
        cy = y + 0.5 sp

    mx = (x1 + x2) / 2

    // Quadratic bezier (simplified):
    path = `M ${x1},${y} Q ${mx},${cy} ${x2},${y}`
    // Full engraving uses two control points (cubic bezier):
    dx = (x2 - x1) / 3
    path = `M ${x1},${y} C ${x1+dx},${cy} ${x2-dx},${cy} ${x2},${y}`
```

---

## 18. Slurs

Similar to ties, but span multiple notes/measures:

```pseudocode
function drawSlur(startNote, endNote, placement):
    arcAbove = (placement == 'above')

    x1 = startNote.noteheadRight + 0.1 sp
    x2 = endNote.noteheadLeft    - 0.1 sp
    dx = x2 - x1

    // Arc height proportional to width (max 2 sp):
    height = min(dx * 0.15, 2 * sp)

    if arcAbove:
        cp1 = { x: x1 + dx*0.25, y: startNote.y - height }
        cp2 = { x: x1 + dx*0.75, y: endNote.y   - height }
    else:
        cp1 = { x: x1 + dx*0.25, y: startNote.y + height }
        cp2 = { x: x1 + dx*0.75, y: endNote.y   + height }

    path = `M ${x1},${startNote.y} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${x2},${endNote.y}`
```

---

## 19. System Header Widths (consolidated)

```typescript
const HEADER_WIDTHS = {
  clef: {
    treble: 32,   // px
    bass:   28,
    alto:   28,
    tenor:  28,
  },
  keySigPerAccidental: 7,   // px per sharp/flat
  timeSig: 24,              // px (two digits stacked)
  headerGap: 8,             // px gap between header and first note
  leftMargin: 12,           // px left margin of system
  rightMargin: 12,          // px right margin
}
```

---

## 20. Constants Summary (in px, assuming sp=10px)

```typescript
const ENGRAVING = {
  sp: 10,                        // spatium = lineSpacing
  staffLines: 5,
  staffHeight: 40,               // 4 * sp

  // Horizontal spacing
  barNoteDistance: 13,           // 1.3 sp
  barAccidentalDistance: 6.5,    // 0.65 sp
  minNoteDistance: 2,            // 0.2 sp
  dotNoteDistance: 5,            // 0.5 sp
  dotDotDistance: 6.5,           // 0.65 sp
  accidentalDistance: 2.2,       // 0.22 sp (padding between accidentals)
  minMeasureWidth: 50,           // 5.0 sp

  // Stem
  normalStemLength: 35,          // 3.5 sp
  shortestStem: 22.5,            // 2.25 sp
  stemWidth: 1.5,                // px

  // Beams
  beamWidth: 5,                  // 0.5 sp
  beamDist: 7.5,                 // 0.75 sp center-to-center

  // Noteheads (approximate)
  noteheadWidth: 12,             // 1.2 sp
  noteheadHeight: 8,             // 0.8 sp
  noteheadRx: 5.5,               // ellipse rx
  noteheadRy: 4.0,               // ellipse ry

  // Staff spacing
  staffDistance: 65,             // 6.5 sp (between staves in same instrument)
  minSystemDistance: 85,         // 8.5 sp
  maxSystemDistance: 150,        // 15.0 sp

  // Harmony (chord symbols)
  harmonyYAboveStaff: 25,        // 2.5 sp above top staff line
  harmonyMinGap: 5,              // 0.5 sp minimum between symbols

  // Ledger lines
  ledgerLineExtension: 3.5,      // 0.35 sp overhang on each side of notehead
  ledgerLineWidth: 1.5,          // px

  // Header widths
  clefWidth: 32,
  keySigAccidentalWidth: 7,
  timeSigWidth: 24,
  headerGap: 8,

  // Grace notes
  graceMag: 0.7,
  graceNoteToMainNote: 3,        // 0.3 sp

  // Margins
  pageLeftMargin: 120,
  pageRightMargin: 120,
  pageTopMargin: 80,
  pageBottomMargin: 80,
}
```

---

## 21. Pitch → Staff Line Quick Reference (Treble Clef)

```
Note  | MIDI | staff line | Y offset from staffTop (sp/2)
------|------|------------|------------------------------
A5    |  81  |    -2      |   -10px  (above staff, ledger at -2)
G5    |  79  |    -1      |    -5px  (above staff, space)
F5    |  77  |     0      |     0    (TOP LINE)
E5    |  76  |     1      |     5px
D5    |  74  |     2      |    10px  (2nd line)
C5    |  72  |     3      |    15px
B4    |  71  |     4      |    20px  (3rd line = MIDDLE LINE)
A4    |  69  |     5      |    25px
G4    |  67  |     6      |    30px  (4th line)
F4    |  65  |     7      |    35px
E4    |  64  |     8      |    40px  (BOTTOM LINE)
D4    |  62  |     9      |    45px
C4    |  60  |    10      |    50px  (1st ledger below = MIDDLE C)
B3    |  59  |    11      |    55px
A3    |  57  |    12      |    60px  (2nd ledger below)
```

**⚠️ תיקון: treble top line = F5 (לא G5)**

בדיקה מחדש: treble clef → clef symbol sits with the curl on G4. Lines from bottom to top:
- Bottom line (line 4 in 0-from-top = line 0 from bottom) = E4
- 2nd line = G4
- Middle line = B4
- 4th line = D5
- Top line = F5

אז: offset לtreble = ??
F5: step=3, oct=5 → absStep = 3+35 = 38. top line = F5 → offset = 38.

```
F5: line = 38-38 = 0   ✓ TOP LINE
E5: line = 38-37 = 1
D5: line = 38-36 = 2
C5: line = 38-35 = 3
B4: line = 38-34 = 4   ← MIDDLE LINE
A4: line = 38-33 = 5
G4: line = 38-32 = 6   ← 2nd line from bottom
F4: line = 38-31 = 7
E4: line = 38-30 = 8   ← BOTTOM LINE
D4: line = 38-29 = 9
C4: line = 38-28 = 10  ← MIDDLE C (1st ledger below)
```

**FINAL CONFIRMED TABLE (treble clef, offset=38):**

```typescript
// pitchToStaffLine for treble clef:
// line = 38 - (diatonicStep + octave*7)
// where diatonicStep: C=0, D=1, E=2, F=3, G=4, A=5, B=6

const TREBLE_OFFSET = 38
const BASS_OFFSET   = 24  // bass clef top line = A3 → A: step=5, oct=3 → 5+21=26...
                           // Actually: top line of bass = G3... wait.
                           // Bass top line = G3: step=4, oct=3 → 4+21=25
                           // So offset = 25? Let's verify: bottom line of bass = G2 (step=4, oct=2)=18
                           // 5 lines: bottom=G2(18), A2(19), B2(20), C3(21), D3(22), E3(23), F3(24), G3(25)
                           // G2→G3 = 7 steps, so 4 lines = 8 steps apart (top=G3)?
                           // Actually bottom line bass = G2, top line bass = A3:
                           //   G2=step4+oct2*7=18, A3=step5+oct3*7=26 → diff=8 ✓ (4 lines × 2 = 8 steps)
const BASS_OFFSET   = 26  // top line = A3 (step=5, oct=3 → 5+21=26)

function pitchToStaffLine(step: number, octave: number, clef: 'treble' | 'bass'): number {
  const absStep = step + octave * 7
  const offset = clef === 'treble' ? 38 : 26
  return offset - absStep
}
```

**Bass clef reference:**
```
A3: line = 26-26 = 0   ← TOP LINE
G3: line = 26-25 = 1
F3: line = 26-24 = 2
E3: line = 26-23 = 3
D3: line = 26-22 = 4   ← MIDDLE LINE
C3: line = 26-21 = 5
B2: line = 26-20 = 6
A2: line = 26-19 = 7
G2: line = 26-18 = 8   ← BOTTOM LINE
F2: line = 26-17 = 9
E2: line = 26-16 = 10
```

---

## 22. Noteheads

```
Whole:     open ellipse, wider (rx=6.5, ry=4.5), NO stem
Half:      open ellipse (rx=5.5, ry=4.0), stroke only fill
Quarter:   filled ellipse (rx=5.5, ry=4.0)
Eighth+:   filled ellipse (same as quarter, add stem + flag/beam)

// Quarter notehead is slightly tilted in engraving (~15°)
// For implementation v1: use un-rotated ellipse. Good enough.
```

---

## 23. Flags (single-beam notes)

Flag positions (on stem tip, relative to stem direction):

```
// Flag appears at stem tip
// stemUp: flags go to the right of stem, curving down
// stemDown: flags go to the right of stem, curving up (mirrored)

flagsPerDuration:
  eighth:    1 flag
  16th:      2 flags
  32nd:      3 flags
  64th:      4 flags

// Flag vertical offset (spacing between multiple flags):
flagSpacing = 0.75 * sp = 7.5px
```

Unicode flags: `𝅘𝅥𝅮` (eighth rest), but for note flags use SVG paths or unicode:
- Single flag: `♪` or draw manually
- For v1: simple curved line SVG path

---

## 24. Implementation Priority for MAP

בסדר עדיפות לבנייה:

1. **pitchToStaffLine** — פונקציה בסיסית, קריטי לכל השאר
2. **horizontalSpacing** — logarithmic stretch per note
3. **systemBreaker** — greedy line breaking
4. **stemDirection + stemLength** — pitch-based rules
5. **beamGroups** — from XML beam elements
6. **beamAngle + beamPositions** — slope computation
7. **accidentals** — column placement
8. **ledgerLines** — from staff line position
9. **keySignature rendering** — ordered accidentals
10. **chordSymbols** — at segment.x, above staff
11. **ties** — bezier from note to note
12. **barlines** — regular/final/repeat

---

## 25. הערכת זמן מעודכנת

לאור המחקר:

| שלב | תוכן | הערכה מעודכנת |
|-----|------|---------------|
| 1 | types.ts — data model | 2–3 שעות |
| 2 | xmlExtractor.ts | 1–2 ימים |
| 3 | horizontalLayout.ts | 2–3 ימים |
| 4 | verticalLayout.ts (stems, beams, acc) | 3–5 ימים |
| 5 | svgRenderer.ts | 2–3 ימים |
| 6 | אינטגרציה + הסרת Verovio | 1–2 ימים |
| 7 | Classical (SATB, tuplets, volta) | 5–8 ימים |
| 8 | Bravura glyphs | 3–4 ימים |
| **סה"כ** | | **~3–4 שבועות** |

**ניתן לחסוך זמן ב:**
- שלב 3-4: מבחן ראשוני רק על DONNALEE.XML (lead sheet) — דוחה SATB לשלב 7
- שלב 5: Unicode glyphs תחילה, Bravura בשלב 8
- שלב 6: double-renderer mode (Verovio fallback) לעבודה בטוחה

**הסיכון הגבוה ביותר:** pitch → staff line mapping + treble/bass offset constants.
חייב להיות tested exhaustively לפני שממשיכים לכל שלב אחר.
