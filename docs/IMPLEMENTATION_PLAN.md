# תכנית יישום: 147 Gap Fixes — MAP Renderer 1:1 עם webmscore

> **המשך ל:** `C:\Users\DELL\.claude\plans\giggly-watching-shannon.md` (שלבים 1-3 הושלמו)
> **מטרה:** 214/214 pipeline tests (100%) + unit tests מיקרוסקופיים לכל אלגוריתם
> **מצב נוכחי (session 9):** 141/214 (66%) — 73 failing tests
> **סיכום session 9:** `docs/SESSION9_RENDERER.md`
>
> **מה בוצע מחוץ לתכנית (ad-hoc בסשן 8-9):**
> - ✅ Bug1: barline clamp consistency — B7 passes 15/15
> - ✅ Bug2: BAR_ACC_DIST_SP 0.65→2.0sp
> - ✅ הסרת accidentalPaddingSp מ-computeSegmentWidths
> - ✅ RenderedNote.x convention: left edge → center
>
> **עיקר הכשלים שנותרו:**
> - ❌ System breaks שגויים (01/06/07) — Phase 2 סשן 2.2
> - ❌ firstNotePad דינמי לפי accidental type — Phase 4
> - ❌ B-tests: 27/85 בלבד (32%)

---

## חוקי טעינת Context — חובה בכל סשן

### אל תקרא (NEVER READ):
| קובץ | שורות | סיבה |
|------|--------|------|
| `WEBMSCORE_RENDERING_PIPELINE.md` | 8,732 | יותר מדי גדול. חפש בו עם Grep רק את הפונקציה/קבוע הספציפי |
| `MAP_RENDERING_PIPELINE.md` | 5,608 | אותו דבר — Grep only |
| `GAP_ANALYSIS.md` | ~3,000 | אל תקרא את כולו. קרא רק את ה-Domain הרלוונטי לסשן |
| `giggly-watching-shannon.md` (תכנית-אם) | ~600 | **אל תקרא כלל** — כל מה שרלוונטי כבר בתכנית זו |

### מה כן לקרא (READ per session):
1. **תכנית זו** — רק את ה-Phase + Session הנוכחי (לא את כל התכנית)
2. **קבצי TS שמשתנים** — קרא את הקובץ לפני עריכה (חובה)
3. **GAP_ANALYSIS.md** — רק את ה-Domain הרלוונטי (Grep `### DOMAIN X`)
4. **C++ source** — רק את הפונקציה הספציפית (Grep → Read lines X-Y)

### כלל אצבע:
- **Grep, לא Read** — לכל מסמך מעל 500 שורות, חפש קודם
- **Read lines X-Y** — כשמצאת, קרא רק את הטווח הרלוונטי (offset + limit)
- **לעולם אל תקרא קובץ שלם מעל 1,000 שורות** — תמיד עם offset/limit
- **verticalLayout.ts (1,347 שורות)** — הקובץ הגדול ביותר ב-renderer. חפש בו עם Grep, קרא פונקציות ספציפיות

### דפוס עבודה לכל סשן:
```
1. קרא את ה-Session הנוכחי מתכנית זו (20-30 שורות)
2. Grep את ה-gap IDs ב-GAP_ANALYSIS.md → קרא רק את הפסקאות הרלוונטיות
3. קרא את קבצי ה-TS שצריך לשנות
4. Grep את הפונקציה ב-C++ doc אם צריך reference
5. כתוב קוד + טסטים
6. הרץ טסטים
```

---

## סדר ביצוע

```
Phase 0  →  תשתית טסטים (Vitest)
Phase 1  →  Foundation: Fraction + Style System          ← מאפשר הכל
Phase 2  →  Horizontal Core: stretch + breaking + spacing ← ROI הכי גבוה (~+27 tests)
Phase 3  →  Stems, Hooks, Beams                          ← ~+20 tests
Phase 4  →  Chord/Note/Accidental                        ← ~+7 tests
Phase 5  →  Barlines, Clefs, Key/Time Sigs               ← ~+8 tests
Phase 6  →  Page Layout + Autoplace                      ← ~+7 tests
Phase 7  →  Special Elements (slurs, ties, dynamics...)   ← ~+4 tests
Phase 8  →  SVG Output + Font System                     ← ~+3 tests
Phase 9  →  Architecture Polish                          ← איכות קוד
```

---

## Phase 0: תשתית טסטים

**סשן 0 — Vitest setup + test pattern**

**משימות:**
1. `npm install -D vitest`
2. הוסף `test` config ב-`vite.config.ts`
3. צור `src/renderer/__tests__/` עם קובץ template
4. הוסף scripts: `"test:unit": "vitest run"`, `"test:unit:watch": "vitest"`
5. צור helper: `__tests__/helpers/loadReference.ts` — טוען reference JSON מ-`renderer-tests/reference-data/`

**קבצים:**
- `package.json`
- `vite.config.ts`
- `src/renderer/__tests__/helpers/loadReference.ts` (NEW)

**מבנה טסטים:**
```
src/renderer/__tests__/
├── helpers/
│   └── loadReference.ts          ← shared fixture loader
├── foundation/
│   ├── fraction.test.ts          ← G-132
│   └── style-system.test.ts     ← G-001..G-005
├── horizontal/
│   ├── duration-stretch.test.ts  ← G-016..G-020
│   ├── system-breaking.test.ts   ← G-021..G-023
│   └── measure-spacing.test.ts   ← G-027..G-035
├── vertical/
│   ├── stem-direction.test.ts    ← G-042
│   ├── stem-length.test.ts       ← G-043..G-047
│   ├── beam-layout.test.ts       ← G-052..G-058
│   └── beam-segments.test.ts     ← G-060..G-062
├── chord/
│   ├── voice-conflicts.test.ts   ← G-066..G-067
│   └── accidentals.test.ts       ← G-068..G-079
├── elements/
│   ├── barlines.test.ts          ← G-080..G-088
│   └── extended-types.test.ts    ← G-089..G-095
├── page/
│   ├── vertical-gaps.test.ts     ← G-036..G-041
│   └── autoplace.test.ts         ← G-112..G-116
├── special/
│   ├── tie-slur-bezier.test.ts   ← G-096..G-099
│   └── hairpin-dynamics.test.ts  ← G-100..G-105
└── svg/
    ├── svg-output.test.ts        ← G-117..G-126
    └── font-system.test.ts       ← G-127..G-131
```

---

## Phase 1: Foundation (G-132, G-001..G-005)

### סשן 1.1 — Fraction class (G-132) [CRITICAL]

**בעיה:** beat positions הם float → שגיאות מצטברות. C++ משתמש ב-Fraction מדויק.

**יישום:**
- NEW: `src/renderer/Fraction.ts` — class עם `numerator`, `denominator`, אריתמטיקה מדויקת
- עדכון `extractorTypes.ts` — type alias `Beat = Fraction` (בינתיים backward-compat עם number)

**טסטים:** `__tests__/foundation/fraction.test.ts`
```
Fraction(1,4) + Fraction(1,8) === Fraction(3,8)
Fraction(3,4).ticks(480) === 360
Fraction.fromFloat(0.25, 480) === Fraction(1,4)
Edge: zero, negative, unreduced, overflow
```

**אסטרטגיה:** בונים את ה-class, לא מעבירים את כל ה-pipeline — המיגרציה ב-Phase 2 (XML import).

### סשן 1.2 — Style System (G-001..G-005)

**בעיה:** ~40 Sid constants מתוך ~350. קבועים compile-time, לא per-score.

**יישום:**
- שכתוב `src/renderer/style/StyleDef.ts`:
  - class `ScoreStyle` עם `styleD(key)` / `styleB(key)` / `styleS(key)`
  - כל ~350 Sid constants עם defaults מ-C++
  - `precomputeValues()` — המרת SPATIUM-typed Sids לפיקסלים
  - `loadEngravingDefaults(fontName)` — override 20 Sids per font
- Singleton default: `Sid.X` ← proxy ל-default instance (zero breakage)

**טסטים:** `__tests__/foundation/style-system.test.ts`
```
default Sid.staffSpace === 1.764 (Leland)
scoreStyle.set('minNoteDistance', 0.8) → styleD('minNoteDistance') === 0.8
precomputeValues() with spatium=20px → staffDistance converts correctly
loadEngravingDefaults('Leland') overrides 20 values
```

---

## Phase 2: Horizontal Core (G-016..G-035) — ROI הכי גבוה

> **57 מתוך 85 B-tests כושלים.** תיקון ה-stretch formula לבד אמור לתקן רבים.

### סשן 2.1 — Duration Stretch Formula (G-016..G-020) [CRITICAL]

**בעיה:** `log10(1 + durRatio * 9)` vs `pow(slope, log2(ratio))`. הנוסחה הנכונה **כבר קיימת** ב-`LayoutMeasure.ts:computeDurationStretch()` אבל ה-pipeline הראשי ב-`horizontalLayout.ts` משתמש בגרסה שונה.

**יישום:**
- `horizontalLayout.ts` — הסר/בטל את הפונקציה הישנה
- `LayoutMeasure.ts` — וודא HACK + empFactor + maxRatio cap פעילים
- `LayoutOrchestrator.ts` — וודא שזו נקודת הכניסה היחידה

**טסטים:** `__tests__/horizontal/duration-stretch.test.ts`
```
computeDurationStretch(quarter, eighth) ≈ C++ reference
HACK: minTicks < 1/16 && maxTicks/minTicks >= 2 → minTicks doubles
empFactor: all notes > 1/16 → stretch widens by sqrt factor
maxRatio cap: max/min > 32 → linear interpolation
10+ reference pairs extracted from C++ source
```

### סשן 2.2 — System Breaking + Squeezable Clamp (G-021..G-023) [CRITICAL]

**בעיה:** מדידה אינקרמנטלית חסרה — כשמוסיפים measure שמשנה min/max, צריך לחשב מחדש.

**יישום:**
- `LayoutSystem.ts` — תקן squeezable clamp: `min(squeezable, mWidth - minMeasureWidth)`
- וודא `collectSystemsIncremental` הוא הנתיב היחיד
- הסר `collectSystems` הפשוט אם עדיין קיים כנתיב אלטרנטיבי

**טסטים:** `__tests__/horizontal/system-breaking.test.ts`
```
3 measures [quarter, whole, half]: min/max tracked correctly
Adding measure triggers recompute of prior widths
Squeezable clamp: measures near minimum get clamped
Compare breaks for fixtures 03, 07, 15 against reference
```

### סשן 2.3 — Measure Spacing (G-027..G-035)

**בעיה:** min note space, spring model, fuzzy comparisons, accidental spacing.

**יישום:**
- `LayoutMeasure.ts` — G-027: `noteHeadWidth + 1.2 * Sid.minNoteDistance`
- `LayoutSystem.ts` — G-028: verify spring model do-while loop
- NEW: `src/renderer/utils/realCompare.ts` — G-029: `RealIsEqualOrMore/Less` (epsilon=1e-9)
- `horizontalLayout.ts` — G-032: shape-based accidental spacing via `minHorizontalDistance()`

**טסטים:** `__tests__/horizontal/measure-spacing.test.ts`
```
minNoteSpace formula verification
Spring model loop iteration count matches C++
RealIsEqualOrMore(1.0, 1.0 - 1e-10) === true
Per-fixture measure widths match webmscore reference (tight tolerance: ±0.5px)
```

**צפי אחרי Phase 2:** ~165/214 (77%)

---

## Phase 3: Stems, Hooks, Beams (G-042..G-065)

### סשן 3.1 — Stem Direction 9-Priority (G-042) [CRITICAL]

**בעיה:** 3 כללים במקום 9-priority chain.

**יישום ב-** `verticalLayout.ts` + `chordLayout.ts`:
```
Priority 1: User override (Stem.UP / Stem.DOWN)
Priority 2: Mirror (cross-voice)
Priority 3: Beam membership (beam dictates)
Priority 4: Cross-staff
Priority 5: TAB (always DOWN)
Priority 6: Drum
Priority 7: User default stem direction
Priority 8: Auto (middle line rule)
Priority 9: Fallback UP
```

**טסטים:** `__tests__/vertical/stem-direction.test.ts`
```
Voice 1 (track%2==0): UP. Voice 2: DOWN.
Auto: note on B4 (middle line treble) → DOWN
Auto: note on A4 (below middle) → UP
Beam group: all share direction
Reference from fixtures 05-stems, 04-beams
```

### סשן 3.2 — Stem Length 12-Step (G-043..G-047)

**בעיה:** קבוע 3.5sp במקום 12 שלבים.

**יישום ב-** `Stem.ts`:
```
1. Base = 3.5sp (normal) / 2.5sp (small staff)
2. + beam addition (0.5sp per additional beam level)
3. + chord spread (chordHeight / 4.0 * spatium)
4. - shortening table maxReductions[4][5]
5. Check min staff overlap
6. - beam width subtraction (beamWidth * 0.5 * mag)
7. Middle line extension
8. 4-beam exception
9. Optical adjustment
10-12. Grace note scaling, cross-staff, absolute limits
```

**טסטים:** `__tests__/vertical/stem-length.test.ts`
```
Single note middle line: 3.5sp
Note below staff: longer stem
Chord spread 2sp: stem += 0.5sp
Beam subtraction: verify formula
maxReductions table: {1.0,0.5,0,0,0; 0.5,0.25,0,0,0; ...}
All stems in fixture 05-stems match webmscore ±0.25sp
```

### סשן 3.3 — Beam Dictator/Pointer + Grid (G-052..G-058) [CRITICAL]

**בעיה:** linear first-to-last במקום dictator/pointer + quarter-space grid.

**יישום ב-** `LayoutBeams.ts` — שכתוב `layoutBeam()`:
```
1. Find dictator (furthest chord from beam)
2. Find pointer (other end chord)
3. Compute ideal positions on quarter-space grid
4. Apply maxSlope constraint
5. Grid snap: inside staff → straddle, outside → line-or-straddle
6. Collision avoidance: offsetBeamToRemoveCollisions()
7. Anchor shortening: offsetBeamWithAnchorShortening()
8. Concave detection → force flat if needed
9. Middle line slant
```

**טסטים:** `__tests__/vertical/beam-layout.test.ts`
```
Ascending 3 notes: dictator = lowest, pointer = highest
Quarter-space snap examples
Collision: no notehead closer than minStemLengths[beamCount] qs
Concave: {C4, E4, C4} → flat beam
All beam positions in fixture 04-beams match webmscore ±0.5px
```

### סשן 3.4 — Beam Segments + Breaks (G-060..G-062)

**יישום ב-** `LayoutBeams.ts` — `createBeamSegments()`:
- secondary beams, beamlets, beat-based breaks
- manual beam breaks, tuplet breaks

**טסטים:** `__tests__/vertical/beam-segments.test.ts`

**צפי אחרי Phase 3:** ~185/214 (86%)

---

## Phase 4: Chord/Note/Accidental (G-066..G-079)

### סשן 4.1 — Inter-Voice Conflicts (G-066..G-067)

**יישום:** `layoutChords1()` 7-phase ב-`LayoutChords.ts` + `chordLayout.ts`
- 10 separation sub-cases עם מרחקים מדויקים (0.1/0.15/0.2/0.3sp)
- cluster detection with 8 sub-cases

**טסטים:** `__tests__/chord/voice-conflicts.test.ts`

### סשן 4.2 — Accidental Stacking + Dedup (G-068..G-079)

**יישום:**
- Zig-zag octave column matching ב-`LayoutChords.ts`
- Runtime font metrics (לא hardcoded)
- Dedup: `pitchToStaffLine()`, `CLEF_OFFSET`, `STEP_TO_DIATONIC` → single source
- Expand to 35 clef types
- Fix: flat=0.65 vs 1.2 discrepancy → use live font metric

**טסטים:** `__tests__/chord/accidentals.test.ts`

**צפי אחרי Phase 4:** ~192/214 (90%)

---

## Phase 5: Barlines, Clefs, Key/Time Sigs (G-080..G-095)

### סשן 5.1 — Barline Types + Key Sig (G-080..G-088)

**יישום:**
- `atomicElements.ts` — 11 barline width cases (switch)
- `verticalLayout.ts` — clef-dependent key sig line positions via `ClefInfo::lines[14]`
- `types.ts` — expand `BarLineType` to 14 values

### סשן 5.2 — Extended Types (G-089..G-095)

**יישום:**
- 110 accidental types (from `accList[]`)
- ~20 notehead types (Group x Type matrix)
- Full rest repertoire + MMRest
- Multi-voice rest positioning (voices 1-4)

**צפי אחרי Phase 5:** ~200/214 (93%)

---

## Phase 6: Page Layout + Autoplace (G-036..G-041, G-112..G-116)

### סשן 6.1 — Skyline System Distance (G-037, G-041)

**יישום ב-** `LayoutPage.ts`:
- `System::minDistance()` via Skyline collision (לא קבוע)
- Per-instrument `staffDistance` vs `akkoladeDistance`

### סשן 6.2 — VerticalGapData (G-036)

**יישום:** 3-phase iterative `distributeStaves()`, maxPasses=20

### סשן 6.3 — Autoplace (G-112..G-116)

**יישום:**
- `autoplaceSegmentElement()` — full algorithm with Skyline collision + drag rebase
- `autoplaceMeasureElement()` — shape-based variant
- 7 kerning types ב-`Shape.ts`

**צפי אחרי Phase 6:** ~207/214 (97%)

---

## Phase 7: Special Elements (G-096..G-111)

### סשן 7.1 — Tie/Slur Bezier (G-096..G-099, G-111)

- Distance-dependent shoulder (0.5-0.7 range)
- Separate tie vs slur computation
- 30-iteration collision avoidance
- adjustY with 4/3 height factor

### סשן 7.2 — Hairpin, Dynamics, Articulation (G-100..G-105)

- Hairpin-dynamic bidirectional alignment
- Dynamic optical center via SMuFL anchor
- Articulation close-to-note rule
- Wedge SVG rendering

### סשן 7.3 — Tuplet, Chord Symbol, Lyrics (G-106..G-110)

- Weighted tuplet direction voting
- Full autoplace for chord symbols
- Lyrics layout (new file)

**צפי אחרי Phase 7:** ~211/214 (99%)

---

## Phase 8: SVG Output + Font System (G-117..G-131)

### סשן 8.1 — SVG Rendering (G-117..G-126)

- Two-phase buffering (header + body)
- Transform stack (save/restore/translate/scale/rotate)
- Per-element color + alpha
- 3-pass rendering order
- Tie/slur as PainterPath bezier (not two-arc lune)

### סשן 8.2 — Font System (G-127..G-131)

- `ScoreFont` class — multi-font (Bravura, Petaluma, Gonville, MuseJazz)
- Runtime `bbox()`, `advance()`, `stemUpSE()` lookup
- 350+ SymId values
- Expanded anchor data

**צפי אחרי Phase 8:** 214/214 (100%)

---

## Phase 9: Architecture Polish (G-133..G-147)

**לא חוסם טסטים — שיפורי איכות:**
- G-133: Incremental layout (`doLayoutRange`)
- G-135: Multi-measure rests
- G-136: Cautionary elements
- G-138: Class hierarchy with `EngravingItem` base
- G-139: Local coords with `pagePos()` composition
- G-146: Ledger line bitwise rounding

---

## פרוטוקול אימות — כל סשן

```
1. BEFORE: npm run test:r:pipeline → record baseline
2. FIX: implement gap(s)
3. UNIT: npx vitest run → all new tests pass
4. PIPELINE: npm run test:r:pipeline → pass count ≥ baseline
5. BUILD: npm run build → success
6. RECORD: update pass count below
```

## מעקב התקדמות

| Phase | סשנים | Gaps | צפי Tests | בפועל |
|-------|--------|------|-----------|-------|
| 0: Vitest | 1 | — | 138/214 | ✅ (4 smoke tests, 138/214 pipeline intact) |
| 1: Foundation | 2 | G-001..G-005, G-132 | 138/214 | ✅ (92 unit tests, 138/214 pipeline intact) |
| Pre-2: Spring model | 1 | — | 144/214 | ✅ (per-segment force-equilibrium justification, B7 fix, fixture fix) |
| 2: Horizontal | 3 | G-016..G-035 | ~165/214 | ⬜ |
| 3: Stems/Beams | 4 | G-042..G-065 | ~185/214 | ⬜ |
| 4: Chord/Note | 2 | G-066..G-079 | ~192/214 | ⬜ |
| 5: Barlines/Clefs | 2 | G-080..G-095 | ~200/214 | ⬜ |
| 6: Page/Autoplace | 3 | G-036..G-041, G-112..G-116 | ~207/214 | ⬜ |
| 7: Special | 3 | G-096..G-111 | ~211/214 | ⬜ |
| 8: SVG/Font | 2 | G-117..G-131 | 214/214 | ⬜ |
| 9: Architecture | ongoing | G-133..G-147 | 214/214 | ⬜ |
| **סה"כ** | **~22 סשנים** | **147 gaps** | | |

---

## קבצים קריטיים לשינוי

| קובץ | Gaps עיקריים | Phase |
|------|-------------|-------|
| `style/StyleDef.ts` | G-001..G-005 | 1 |
| `Fraction.ts` (NEW) | G-132 | 1 |
| `horizontalLayout.ts` | G-016, G-027, G-032 | 2 |
| `engine/layout/LayoutMeasure.ts` | G-017..G-020, G-027 | 2 |
| `engine/layout/LayoutSystem.ts` | G-021..G-023, G-028 | 2 |
| `engine/LayoutOrchestrator.ts` | G-020, G-023 | 2 |
| `verticalLayout.ts` | G-042, G-043, G-072, G-083 | 3-5 |
| `engine/libmscore/Stem.ts` | G-043..G-047 | 3 |
| `engine/layout/LayoutBeams.ts` | G-052..G-065 | 3 |
| `chordLayout.ts` | G-042, G-066..G-067, G-073 | 3-4 |
| `engine/layout/LayoutChords.ts` | G-066, G-068 | 4 |
| `atomicElements.ts` | G-076, G-080, G-089..G-091 | 5 |
| `types.ts` | G-094, G-095 | 5 |
| `engine/layout/LayoutPage.ts` | G-036..G-041, G-144 | 6 |
| `engine/libmscore/Shape.ts` | G-115..G-116 | 6 |
| `svgRenderer.ts` | G-102..G-104, G-120, G-124, G-126 | 7-8 |
| `painter/SVGPainter.ts` | G-117..G-118, G-121..G-123 | 8 |
| `glyphs/leland.ts` | G-127..G-131 | 8 |
| `bravura/anchors.ts` | G-130 | 8 |

---

## סשן Pre-2: Spring Model + Debugging (144/214)

**מה שונה:**
1. **Per-segment force-equilibrium justification** — `LayoutSystem.ts:justifySystem()` שוכתב עם C++ `stretchSegmentsToWidth()` algorithm (do-while preTension + force equilibrium). Springs per-segment במקום per-measure.
2. **B7 fix** (session 9) — `sys.width = actualSystemWidth` עבור last systems לא justified.
3. **07-time-signatures fixture** — `divisions=4` (fixed from 8) in measure 4.

**ממצאים קריטיים לסשן הבא (Phase 2):**

1. **Trailing space (37.2px/measure)**: `computeMeasureWidth()` מוסיף `NOTE_BAR_DIST_SP * sp = 1.5sp` כ-trailing. ב-C++, הרווח מהנוטה האחרונה לbarline הוא חלק מרוחב הsegment האחרון (`max(minHorizontalDist, minStretchedWidth)`), לא תוספת נפרדת. זה מוסיף ~36px/measure מיותרים. אי אפשר להסיר בלי לתקן system breaking במקביל.

2. **Pre-justification segment widths** הם הגורם העיקרי לשגיאות, לא ה-justification model. ב-03-rests: m2 pre-just=365.7 vs ref justified=307.1 (הref JUSTIFIED קטן יותר מ-pre-just שלנו!).

3. **C++ `minHorizontalDistance()`** — בC++ כל segment width הוא `max(minHorizontalDistance(next), minStretchedWidth)`. `minHorizontalDistance` מבוסס על shape collision (G-032). אנחנו משתמשים רק ב-`minStretchedWidth`.

**אסטרטגיה לPhase 2:**
- תקן את segment width formula + trailing **יחד** כדי לא לשבור system breaks
- יישם `minHorizontalDistance()` פשוט (noteHead-based) לפני collision-based version
- קודם 01-noteheads ו-07-time-signatures (דלתות קטנות), אח"כ 03-rests (דלתות גדולות)

---

## מיקומים

| מה | איפה |
|----|------|
| תכנית זו | `C:\Users\DELL\.claude\plans\proud-dancing-lollipop.md` |
| תכנית-אם | `C:\Users\DELL\.claude\plans\giggly-watching-shannon.md` |
| Gap Analysis | `MAP - Music Analysis Platform\docs\GAP_ANALYSIS.md` |
| מסמך C++ | `MAP - Music Analysis Platform\docs\WEBMSCORE_RENDERING_PIPELINE.md` |
| מסמך TS | `MAP - Music Analysis Platform\docs\MAP_RENDERING_PIPELINE.md` |
| Renderer source | `MAP - Music Analysis Platform\src\renderer\` |
| Pipeline tests | `MAP - Music Analysis Platform\renderer-tests\pipeline\` |
| Reference data | `MAP - Music Analysis Platform\renderer-tests\reference-data\` |
| Fixtures | `MAP - Music Analysis Platform\public\renderer-tests\fixtures\` |
