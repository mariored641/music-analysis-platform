# GAP_ANALYSIS.md — Full Parity Plan: MAP → webmscore 1:1

> **מטרה:** MAP renderer מייצר output זהה ל-webmscore — pixel-perfect.
> **תאריך:** 2026-04-09
> **מקורות:** 15 delta tables (MAP doc), 47 critical differences (C++ doc), Appendix B, sessions A–K known gaps

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Total gaps identified | 147 |
| Implementation domains | A–O (15 domains) |
| Current test pass rate | 138/214 (65%) |
| Goal | 1:1 parity with webmscore |

---

## 2. Master Gap List

Format: `G-NNN` | Domain | Source | TS File | Current State → Required State

### Domain A: Style System (~310 missing Sid constants)

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-001 | Delta 1, CritDiff לט | ~310 Sid constants missing | `StyleDef.ts` | ~40 compile-time constants → ~350 runtime-configurable Sid values |
| G-002 | Delta 1 | Style access is compile-time `as const` — not per-score overridable | `StyleDef.ts` | Static `Sid.X` → runtime `score.styleD(Sid.X)` with per-score overrides |
| G-003 | CritDiff לט | No spatium precomputation — SPATIUM-typed Sids not auto-converted to mm | `StyleDef.ts` | Manual × spatium → `precomputeValues()` on spatium change |
| G-004 | CritDiff מ | Font engraving defaults don't override style | `StyleDef.ts` + font system | Leland hardcoded → `loadEngravingDefaults()` overrides 20 Sid values per font |
| G-005 | Delta 1 | Missing Sid categories: lyrics (~15), tuplet (~8), slur/tie (~20), hairpin/dynamic (~15), text styles (~40), articulation (~10), ottava (~5), figured bass (~5), TAB (~10), repeat barline (~5), measure/MMRest (~5), system header (~5), bracket/brace (~3) | `StyleDef.ts` | Add all ~310 constants with C++ default values |

### Domain B: XML Import

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-006 | Delta 3, AppB.1 | Single-pass import — no multi-part support | `xmlExtractor.ts` | Single `<part>` → 2-pass import, all `<part>` elements |
| G-007 | Delta 3, AppB.1 | Transposing instruments not handled | `xmlExtractor.ts` | Concert pitch only → apply `<transpose>` element |
| G-008 | Delta 3, AppB.1 | Lyrics not extracted | `xmlExtractor.ts` | Not parsed → extract `<lyric>` per syllable |
| G-009 | Delta 3, AppB.1 | Figured bass not extracted | `xmlExtractor.ts` | Not parsed → extract `<figured-bass>` |
| G-010 | Delta 3 | Chord diagrams (`<frame>`) not extracted | `xmlExtractor.ts` | Not parsed → extract guitar chord diagrams |
| G-011 | Delta 3 | Print elements (`<print>`, page/system breaks) not extracted | `xmlExtractor.ts` | Not parsed → extract break hints |
| G-012 | Delta 3 | Encoded repeats (D.C., D.S., Fine) not extracted | `xmlExtractor.ts` | Not parsed → extract repeat signs |
| G-013 | Delta 3 | Part-specific attributes (transpose, staves per part) not parsed | `xmlExtractor.ts` | Single-part → per-part `<attributes>` |
| G-014 | Delta 3 | Beat positions use float instead of Fraction | `xmlExtractor.ts` | `number` (float) → `Fraction` (exact rational) |
| G-015 | Delta 3 | Tie/slur as boolean flags instead of spanner objects | `extractorTypes.ts` | `tieStart/tieStop` booleans → `Tie`/`Slur` spanner objects with endpoints |

### Domain C: Duration Stretch Formula

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-016 | CritDiff א | Duration stretch formula completely different | `horizontalLayout.ts` | `log10(1 + durRatio × 9)` → `pow(slope, log2(ratio))` where `slope = Sid.measureSpacing` |
| G-017 | CritDiff ב | HACK: dMinTicks×2 when maxTicks/minTicks ≥ 2.0 (fuzzy) and minTicks < 1/16 | `LayoutMeasure.ts` | Implemented in full port but not used by main pipeline → wire into main pipeline |
| G-018 | CritDiff ג | empFactor: long note compensation `str *= (0.4 + 0.6 * sqrt(dMinTicks / 0.0625))` | `LayoutMeasure.ts` | Implemented in full port but not used by main pipeline → wire into main pipeline |
| G-019 | CritDiff יב | maxRatio cap: linear interpolation when maxTicks/minTicks > 32 | `horizontalLayout.ts` | Not implemented → add linear interpolation for extreme ratios |
| G-020 | Delta 4 | Two stretch implementations coexist — simplified (main) vs full port (unused) | `horizontalLayout.ts`, `LayoutMeasure.ts` | Unify: use full C++ port (`computeDurationStretch`) as single implementation |

### Domain D: System Breaking

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-021 | CritDiff ד | No incremental system building — minTicks/maxTicks not tracked across measures | `LayoutSystem.ts` | Full layout from scratch → incremental collectSystem() with min/max tracking |
| G-022 | CritDiff ה | squeezableSpace clamp: simple version misses `min(squeezable, mWidth - minMeasureWidth)` | `LayoutSystem.ts` | `computeMeasureSqueezable` without clamp → add clamp per C++ |
| G-023 | Delta 5 | Two system breaking implementations coexist (simple + incremental) | `LayoutSystem.ts` | Unify: use `collectSystemsIncremental` as sole implementation |
| G-024 | Delta 5 | `layoutSystemElements()` 25-phase pipeline not implemented | Multiple files | Separate stages → unified 25-phase pipeline in fixed order (CritDiff י) |
| G-025 | Delta 5 | Empty staff hiding not implemented | `LayoutSystem.ts` | No hiding → `hideEmptyStaves()` removes staves with no content |
| G-026 | Delta 5 | Cross-staff beam updates after system layout not implemented | `LayoutSystem.ts` | No cross-staff → `updateCrossBeams()` post-system-layout |

### Domain E: Measure Spacing

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-027 | CritDiff ז | Minimum note space formula differs | `horizontalLayout.ts` | Fixed value → `noteHeadWidth + 1.2 × Sid.minNoteDistance` (spacingMultiplier=1.2) |
| G-028 | CritDiff ו | Spring model: do-while loop, preTension on next spring, strict `>` in phase 2 | `horizontalLayout.ts` | Verify `placeSystem()` matches exactly → fix loop structure if needed |
| G-029 | CritDiff יא | No fuzzy float comparisons (ε=1e-9 relative) | Multiple files | `>=`/`<=` → `RealIsEqualOrMore`/`RealIsEqualOrLess` with ε=1e-9 |
| G-030 | CritDiff יג | `extraLeadingSpace` from MusicXML not read | `xmlExtractor.ts`, `horizontalLayout.ts` | Not parsed → read `<leadingSpace>` and add `val × spatium` |
| G-031 | CritDiff יד | Cross-beam spacing adjustment not implemented | `horizontalLayout.ts` | No cross-beam detection → `computeCrossBeamType()` + displacement |
| G-032 | Delta 4 | Accidental spacing: flat 0.7sp padding instead of shape-based collision | `horizontalLayout.ts` | Flat padding → `minHorizontalDistance()` shape-based collision |
| G-033 | Delta 4 | Inline key/time sig: width-based approximation instead of segment-level shapes | `horizontalLayout.ts` | Approximate → full segment-level shape spacing |
| G-034 | Delta 4 | Multi-measure rests not supported | `horizontalLayout.ts` | Not implemented → MMRest support |
| G-035 | Delta 4 | Note spacing 1.68sp empirical vs 1.78sp theoretical | `horizontalLayout.ts` | Calibrated value → derive from `noteHeadWidth + 1.2 × minNoteDistance` |

### Domain F: Page Layout

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-036 | Delta 6, AppB.1 | VerticalGapData not implemented (3-phase, maxPasses=20) | `LayoutPage.ts` | Fixed spacing → iterative `distributeStaves()` with VerticalGapData |
| G-037 | Delta 6 | Skyline-based system-to-system distance not used | `LayoutPage.ts` | Pre-computed constant → `System::minDistance()` via Skyline collision |
| G-038 | Delta 6 | VBox (vertical frames) between systems not supported | `LayoutPage.ts` | Not implemented → VBox support |
| G-039 | Delta 6 | Spacers (SpacerUp/SpacerDown) not supported | `LayoutPage.ts` | Not implemented → per-system manual spacing |
| G-040 | Delta 6 | System dividers not supported | `LayoutPage.ts` | Not implemented → `checkDivider()` left/right symbols |
| G-041 | Delta 6 | Staff spacing uses fixed 6.5sp for all staves | `LayoutPage.ts` | Fixed → `staffDistance` vs `akkoladeDistance` + Skyline collision |

### Domain G: Stem & Hook

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-042 | CritDiff ח/כב, Delta 7/8/10 | Stem direction: 3 rules instead of 9-priority chain. Note: C++ uses `track % 2 == 0` (track-based, not voice number) | `chordLayout.ts`, `verticalLayout.ts` | 3 rules → 9 priorities: user override, mirror, beam, cross-staff, TAB, drum, user default, auto, fallback |
| G-043 | Delta 8, CritDiff יז | Stem length: fixed 3.5sp instead of 12-step algorithm | `Stem.ts`, `verticalLayout.ts` | Fixed → base + beam addition + chord spread + min overlap + shortening table + optical adjust + 4-beam exception + middle line extension |
| G-044 | CritDiff יז | `maxReductions[4][5]` shortening table not implemented | `Stem.ts` or new | Not implemented → add table: `{1.0,0.5,0,0,0; 0.5,0.25,0,0,0; 0.5,0,0,0,0; 0,0,0,0,0}` (qs units) |
| G-045 | Delta 8 | Min stem overlap with staff not implemented | `Stem.ts` | Not implemented → `minStaffOverlap()` ensures stem reaches middle |
| G-046 | Delta 8 | Beam width subtraction from stem length missing | `Stem.ts` | Not implemented → `y2 -= beamWidth × 0.5 × mag` |
| G-047 | Delta 8 | Chord spread not added to stem length | `Stem.ts` | Not implemented → `chordHeight / 4.0 × spatium` |
| G-048 | Delta 8 | Hook glyphs only ±1..±5, curved only | `Hook.ts` | ±5 curved → ±1..±8 curved + straight variants |
| G-049 | CritDiff כא | Hook anchor uses wrong SMuFL anchor type | `Hook.ts` | Direct placement → `stemUpNW`/`stemDownSW` (not SE/NW like noteheads) |
| G-050 | Delta 8 | Grace note stem scaling (0.7×) not implemented | `Stem.ts`, `Hook.ts` | Not scaled → `graceNoteMag = 0.7` applied to stem/hook |
| G-051 | CritDiff ט | stemUpSE/stemDownNW anchors may differ between Bravura and Leland | `chordLayout.ts` | Hardcoded → live font metrics per glyph |

### Domain H: Beam

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-052 | Delta 9, CritDiff יח | Dictator/pointer system not implemented | `LayoutBeams.ts` | First-to-last linear → dictator (furthest from beam) / pointer (other end) |
| G-053 | CritDiff יט | Quarter-space grid snapping not implemented | `LayoutBeams.ts` | Free positioning → grid snap: inside staff=straddle, outside=line-or-straddle |
| G-054 | Delta 9 | Collision avoidance not implemented | `LayoutBeams.ts` | Not implemented → `offsetBeamToRemoveCollisions()` with `minStemLengths = {11,13,15,18,21,24,27,30}` qs |
| G-055 | Delta 9 | Anchor shortening not implemented | `LayoutBeams.ts` | Not implemented → `offsetBeamWithAnchorShortening()` |
| G-056 | Delta 9 | Concave detection (`isSlopeConstrained`) — simplified | `LayoutBeams.ts` | Simplified → full concave detection forces flat beam |
| G-057 | Delta 9 | Middle line slant (`addMiddleLineSlant`) not implemented | `LayoutBeams.ts` | Not implemented → force slant when pointer at middle line |
| G-058 | Delta 9 | 8th-space micro-adjustment not implemented | `LayoutBeams.ts` | Not implemented → `add8thSpaceSlant()` 0.125sp for 3-beam groups |
| G-059 | CritDiff כ, Delta 9 | Cross-staff beam layout not implemented | `LayoutBeams.ts` | Not implemented → `layout2Cross()` (beam.cpp:1591-1803) |
| G-060 | Delta 9 | Beam segments (breaks, beamlets, sub-groups) not implemented | `LayoutBeams.ts` | External rendering → `createBeamSegments()` with beat subdivision |
| G-061 | Delta 9 | Grace note beams not implemented | `LayoutBeams.ts` | Not implemented → `beamGraceNotes()` |
| G-062 | Delta 9 | Beam breaks (manual + default + tuplet) not implemented | `LayoutBeams.ts` | Continuous beams → `calcBeamBreaks()` |
| G-063 | Delta 9 | Wide beams style (`Sid::useWideBeams`, 4qs spacing) not supported | `LayoutBeams.ts` | Hardcoded 3qs → configurable via Sid |
| G-064 | Delta 9 | Feathered beams (`grow1`/`grow2`) not implemented | `LayoutBeams.ts` | Not implemented → accelerando/ritardando beams |
| G-065 | CritDiff יח | `_maxSlopes` values — verify correct `{0,1,2,3,4,5,6,7}` and short-beam reduction | `LayoutBeams.ts` | Verify current implementation matches C++ exactly |

### Domain I: Chord, Note & Accidental

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-066 | CritDiff טו | Inter-voice conflict resolution: 10 separation cases not implemented | `LayoutChords.ts` | Simplified → full `layoutChords1()` 7-phase with 10 conflict sub-cases |
| G-067 | Delta 7 | Cluster detection simplified — missing 8 sub-cases, precise spacing constants | `chordLayout.ts` | Alternating flip → C++ centering + 8 conflict sub-cases (0.1/0.15/0.2/0.3sp) |
| G-068 | CritDiff טז | Accidental column resolution: no octave matching (zig-zag) | `LayoutChords.ts` | Greedy columns → `resolveAccidentals()` with octave zig-zag + `layoutChords3()` |
| G-069 | Delta 7 | Accidental sizes hardcoded (Leland-only) | `chordLayout.ts` | `ACC_HEIGHTS_SP`/`ACC_WIDTHS_SP` tables → live glyph bbox from font |
| G-070 | Delta 7 | Dot Y: only even staffLine → -0.5sp, missing voice-based displacement | `chordLayout.ts` | Simplified → voice-based (odd/even), UP/DOWN override, multi-dot collision |
| G-071 | Delta 7 | Chord bbox simplified — missing arpeggio + hook accumulation | `chordLayout.ts` | Pre-computed bounds → `layoutPitched()` lll/rrr accumulation |
| G-072 | Delta 7 | Only 5 clef offsets (treble, bass, alto, tenor, percussion) | `Note.ts`, `verticalLayout.ts` | 5 clefs → 35 clef types via `ClefInfo::lines[14]` |
| G-073 | Delta 7 | Notehead geometry: constant NOTEHEAD_RX/RY instead of per-type | `chordLayout.ts` | Fixed 0.59/0.36 → `symBbox(noteHead())` + `symWidth()` per type |
| G-074 | Delta 7 | Grace notes not handled in chord layout | `chordLayout.ts` | Not handled → full recursion + grace handling in `layoutPitched()` |
| G-075 | Delta 7 | Note mirroring: no user override (AUTO/LEFT/RIGHT) | `Note.ts` | Simple interval-1 check → user override support |
| G-076 | Delta 12 | Notehead types: only 4 glyphs instead of 80+ (Group × Type matrix) | `atomicElements.ts` | 4 glyphs → full `NoteHead::Group × Type` matrix |
| G-077 | AppB.3, Session J | `pitchToStaffLine()` duplicated in verticalLayout.ts AND atomicElements.ts | Both files | Deduplicate to single source |
| G-078 | AppB.3, Session J | `CLEF_OFFSET` and `STEP_TO_DIATONIC` duplicated | Both files | Deduplicate |
| G-079 | AppB.3, Session J | Accidental width discrepancy: flat=0.65 (atomicElements) vs 1.2 (verticalLayout) | Both files | Resolve conflict — use live font metric |

### Domain J: Barlines, Clefs, Key/Time Signatures

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-080 | CritDiff כו | Barline width: single value instead of 11 distinct cases | `atomicElements.ts`, `verticalLayout.ts` | Single width → full `layoutWidth()` switch with 11 cases |
| G-081 | CritDiff כז | Barline two-phase layout not implemented | `verticalLayout.ts` | Single-pass → `layout()` temporary + `layout2()` after system layout |
| G-082 | CritDiff כח | Key sig: no SMuFL cutout anchors (cutOutSW/NW/NE/SE) | `verticalLayout.ts` | Simple spacing → `addLayout()` with cutout anchors for tight spacing |
| G-083 | CritDiff כט | Key sig: line positions not clef-dependent | `verticalLayout.ts` | Treble-only → `ClefInfo::lines[14]` per clef type |
| G-084 | CritDiff ל | Time sig: vertical center formula missing for non-standard staves | `verticalLayout.ts` | Standard only → `yoff = sp × (numOfLines-1) × 0.5 × lineDist` + even/odd displacement |
| G-085 | CritDiff לא | Clef mid-measure right-alignment not implemented | `verticalLayout.ts` | Left-align all → `x = -r.right()` when `rtick != 0` |
| G-086 | CritDiff לב | Accidental single vs multi-glyph: no combined SMuFL glyphs | `atomicElements.ts` | Multi-glyph only → prefer `accidentalFlatParens` combined glyphs |
| G-087 | Delta 10 | Only basic barline types (regular/final/repeat) | `verticalLayout.ts` | 3 types → 14 `BarLineType` enum values (double, dotted, short, tick, winged) |
| G-088 | Delta 10 | Key sig spacing uses fixed strides (sharp/flat/natural) | `verticalLayout.ts` | Fixed strides → SMuFL cutout-based dynamic spacing |
| G-089 | Delta 12 | Rest types: only 7 (whole–64th), no multi-measure rests | `atomicElements.ts` | 7 types → full rest repertoire + MMRest |
| G-090 | Delta 12 | Multi-voice rest positioning: only voice 1+2 | `atomicElements.ts` | 2 voices → precise per-voice (1–4) positioning |
| G-091 | Delta 12 | Accidental types: only 8 instead of 110 | `atomicElements.ts` | 8 types → full `accList[]` (110 types) |
| G-092 | Delta 12 | Ledger lines: per-note, no chord merging/coalescence | `atomicElements.ts`, `LedgerLine.ts` | Per-note → `addLedgerLines()` with multi-note chord coalescence |
| G-093 | Delta 12 | Staff lines: fixed 5 lines, fixed spatium | `atomicElements.ts` | 5 fixed → per-staff count (1–5) + custom line distances |
| G-094 | Delta 15 | Barline types: 10 union values instead of 14 enum | `types.ts` | 10 → 14 (add BROKEN, SHORT, TICK, WINGED variants) |
| G-095 | Delta 15 | Notehead types: 7 values instead of ~20 | `types.ts` | 7 → ~20 (add cross, circleX, withX, plus, etc.) |

### Domain K: Special Elements

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-096 | CritDiff לג | Slur bezier: shoulder depends on distance (0.5–0.7 range) | New/existing | Fixed → distance-dependent lookup + `shoulderH = sqrt(d/4) × sp` |
| G-097 | CritDiff לד | Tie: fixed shoulderW=0.6, separate bezier from slurs | New/existing | Shared with slur → separate computation with `tieWidthInSp × 0.4 × 0.38` clamped |
| G-098 | CritDiff לה | Slur collision avoidance: no iterative adjustment | New/existing | Not implemented → 30-iteration max with 0.25sp step |
| G-099 | CritDiff מא | Tie adjustY: 4/3 height factor not implemented | New/existing | Not implemented → `4 × shoulderH / 3` throughout adjustY |
| G-100 | CritDiff לו | Hairpin-dynamic alignment: bidirectional search not implemented | New/existing | Type-only → full layout with extendThreshold=3.0sp, ddiff=0.5sp |
| G-101 | CritDiff לז | Dynamic optical center: no SMuFL anchor | New/existing | No centering → `opticalCenter` anchor for asymmetric glyphs |
| G-102 | AppB.1 | Hairpin rendering: no wedge SVG | `svgRenderer.ts` | Type-only → full hairpin wedge rendering |
| G-103 | AppB.1 | Dynamics rendering: SMuFL glyphs available but unused | `svgRenderer.ts` | Not rendered → full dynamic glyph rendering |
| G-104 | AppB.1 | Articulation rendering: type-only, no glyph placement | `svgRenderer.ts` | Not rendered → glyph placement with autoplace |
| G-105 | CritDiff מב | Articulation close-to-note rule not implemented | New/existing | Not implemented → staccato/tenuto between note and slur |
| G-106 | CritDiff לח | Tuplet direction: simple majority instead of weighted voting | `verticalLayout.ts` | Simple majority → weight 1000 (explicit) vs 1 (auto) + upward bias |
| G-107 | AppB.1 | Tuplet layout (advanced): basic bracket only | `verticalLayout.ts` | Basic → nested tuplets, custom placement, full geometry |
| G-108 | AppB.1 | Lyrics layout not implemented | New file | Not implemented → `layoutlyrics.cpp` port |
| G-109 | Delta 10 | Chord symbol placement: simplified row alignment | `verticalLayout.ts` | Simplified → full autoplace via Skyline |
| G-110 | Delta 10 | Tuplet brackets: simplified majority + fixed offsets | `verticalLayout.ts` | Simplified → full tuplet.cpp direction voting + bracket geometry |
| G-111 | Delta 10 | Tie bezier: simplified makeTieArc with fixed shoulderW=0.6 | `verticalLayout.ts` | Simplified → full `computeBezier()` with endpoint refinement |

### Domain L: Autoplace

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-112 | Delta 11, AppB.1 | `autoplaceSegmentElement()` not implemented | New/`Shape.ts` | Shape/Skyline ported but autoplace not called → implement full algorithm |
| G-113 | Delta 11, AppB.1 | `autoplaceMeasureElement()` not implemented | New/`Shape.ts` | Not implemented → shape-based variant (for tuplets) |
| G-114 | Delta 11 | `rebaseMinDistance()` not implemented | New | Not implemented → drag handling (relative/absolute offset modes) |
| G-115 | Delta 11 | No kerning types — all elements treated equally | `Shape.ts` | No kerning → 7 kerning types (clef, timeSig, keySig, barline, note, stem, grace) |
| G-116 | Delta 11 | Shape has no item pointer — no item-specific collision rules | `Shape.ts` | Plain objects → `ShapeElement` with `EngravingItem*` pointer |

### Domain M: SVG Output

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-117 | CritDiff מג | No two-phase buffering (header + body) | `SVGPainter.ts` | Direct string → separate header/body buffers, flush at end |
| G-118 | CritDiff מד | No transform optimization (translation vs matrix) | `SVGPainter.ts` | All absolute → inline dx/dy for translation-only, matrix for complex |
| G-119 | CritDiff מה | No CSS class from element type | `svgRenderer.ts` | No class attr → `class="TypeName"` on every element |
| G-120 | CritDiff מו | Rendering order: no 3-pass (staff lines → beat coloring → elements) | `svgRenderer.ts` | Single pass → 3-pass rendering order |
| G-121 | CritDiff מז | No state isolation in command buffer | `SVGPainter.ts` | Not implemented → `editableState()` creates new Data on state change |
| G-122 | Delta 13 | No transform stack (save/restore, translate, scale, rotate) | `SVGPainter.ts`, `Painter.ts` | All absolute coords → transform stack with save/restore |
| G-123 | Delta 13 | Missing drawing primitives: drawArc, drawEllipse, drawPolyline | `SVGPainter.ts` | Subset → add missing primitives |
| G-124 | Delta 13 | No per-element color, no alpha | `svgRenderer.ts` | Fixed `INK = '#1a1a1a'` → per-element `color()` with alpha support |
| G-125 | Delta 13 | DPI/scaling: no device-pixel-ratio awareness | `svgRenderer.ts` | Fixed spatium → `MScore::pixelRatio` device-dependent scaling |
| G-126 | Delta 13 | Tie/slur rendering: filled lune vs stroked path | `svgRenderer.ts` | Two-arc lune → `PainterPath` Bezier with varying width `QPen` |

### Domain N: Font & Glyph System

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-127 | Delta 14, AppB.1 | Leland-only rendering — no multi-font support | `leland.ts` | Leland only → `ScoreFont` class supporting Bravura, Petaluma, Gonville, MuseJazz |
| G-128 | Delta 14 | Glyph metrics: compile-time constants instead of runtime lookup | `leland.ts`, `anchors.ts` | Hardcoded → `ScoreFont::bbox()`, `advance()`, `stemUpSE()` runtime lookup |
| G-129 | Delta 14 | Only ~40 named codepoints instead of 350+ SymId values | `leland.ts` | ~40 → full `symNames[]` (350+ values) |
| G-130 | Delta 14 | Anchor data: only 6 notehead + 8 flag types | `anchors.ts` | 14 types → hundreds of glyphs from `glyphsWithAnchors` |
| G-131 | Delta 14 | Engr. defaults: hardcoded Leland, 15 properties only | `leland.ts` | 15 Leland → full `engravingDefaults` from font metadata JSON, runtime selected |

### Domain O: Architecture

| ID | Source | Description | TS File | Current → Required |
|----|--------|-------------|---------|-------------------|
| G-132 | Delta 2/3/4, CritDiff יא | Float beat positions instead of Fraction (exact rational) | `extractorTypes.ts`, multiple | `number` → `Fraction` class with exact arithmetic |
| G-133 | Delta 2 | No incremental layout — always full from scratch | `LayoutOrchestrator.ts` | Full rebuild → incremental `doLayoutRange()` from changed tick |
| G-134 | Delta 2 | No linear mode | `LayoutOrchestrator.ts` | Page mode only → `LayoutOptions::isLinearMode()` support |
| G-135 | Delta 2 | No multi-measure rest (MMRest) support | Multiple | Not implemented → `createMultiMeasureRests()` + `Measure::mmRest()` |
| G-136 | Delta 2 | No cautionary elements (courtesy keysigs, clefs at end of previous system) | Multiple | Not implemented → cautionary element layout |
| G-137 | Delta 2 | No section breaks, volta layout breaks | Multiple | Not implemented → section/volta break handling |
| G-138 | Delta 15 | Flat interfaces — no inheritance, no virtual dispatch | `types.ts` | Flat → class hierarchy with `EngravingItem` base |
| G-139 | Delta 15 | All coordinates absolute pixels from start | Multiple | Absolute → local coords with `pagePos()` composition |
| G-140 | Delta 15 | Immutable output — no incremental re-layout | Multiple | Immutable → mutable in-place layout (multiple passes) |
| G-141 | Delta 2 | `CmdStateLocker` (RAII concurrent access) not implemented | Multiple | Not needed in single-threaded TS — skip or add mutex for workers |
| G-142 | Delta 6 | Staff spacing: fixed 6.5sp for all staves | `LayoutPage.ts` | Fixed → per-instrument `staffDistance` vs `akkoladeDistance` |
| G-143 | Delta 10 | Multi-staff: single effective staff (activeStaffIndices) | `verticalLayout.ts` | Single staff → full grand staff with cross-staff elements |
| G-144 | Delta 10 | System y computation: fixed systemStride instead of layoutPage() 3-phase | `LayoutPage.ts` | Fixed → `layoutPage()` 3-phase with VerticalGapData |
| G-145 | Delta 12 | Flag types: only ±1..±3 (8th/16th/32nd) in atomicElements | `atomicElements.ts` | ±3 → full flag range |
| G-146 | Session J | atomicElements `layoutLedgerLines()` uses simplified loop rounding | `atomicElements.ts` | Loop rounding → faithful C++ bitwise `(l+1)&~1` / `l&~1` |
| G-147 | Session B | `_maxSlopes` beam-width-based usage in `getMaxSlope()` not documented | `LayoutBeams.ts` | Verify short-beam slope reduction: `≤2 → maxSlope/2`, `≤3 → maxSlope×2/3` |

---

## 3. Domain Plans (Implementation Order)

### Phase 1: Foundation (Domains O + A)

**Dependencies:** None — these are prerequisites for everything else.

**Domain O — Architecture:**
- G-132: Implement `Fraction` class (numerator/denominator, exact arithmetic)
- G-138: Consider class hierarchy (can be deferred if interfaces work)
- G-139, G-140: Consider local coord system (can be deferred)
- G-141: Skip (not needed in single-threaded JS)

**Domain A — Style System:**
- G-001 through G-005: Expand `StyleDef.ts` to ~350 Sid constants
- G-002: Make style per-score configurable (runtime object, not `as const`)
- G-003: Add `precomputeValues()` for SPATIUM-typed Sids
- G-004: Add `loadEngravingDefaults()` from font metadata

### Phase 2: Input (Domain B)

**Dependencies:** Phase 1 (Fraction for beat positions, Style for all Sid constants)

- G-006: 2-pass XML import for multi-part
- G-007: Transposing instruments
- G-008: Lyrics extraction
- G-014: Fraction beat positions (depends on G-132)
- G-015: Tie/slur spanner objects
- G-009 through G-013: Lower priority extractions

### Phase 3: Horizontal Core (Domains C + D + E)

**Dependencies:** Phase 1 (Style, Fraction), Phase 2 (improved extraction)

**Domain C — Duration Stretch:**
- G-016: Replace log10 formula with `pow(slope, log2(ratio))`
- G-017: Wire HACK into main pipeline
- G-018: Wire empFactor into main pipeline
- G-019: Add maxRatio cap
- G-020: Unify to single implementation

**Domain D — System Breaking:**
- G-021: Implement incremental system building with min/max tracking
- G-022: Add squeezable clamp
- G-023: Unify to single implementation
- G-024: Implement 25-phase `layoutSystemElements()` (long-term)

**Domain E — Measure Spacing:**
- G-027: Fix minimum note space formula
- G-028: Verify spring model loop
- G-029: Add fuzzy float comparisons
- G-030: Parse extraLeadingSpace
- G-032: Shape-based accidental spacing

### Phase 4: Page Layout (Domain F)

**Dependencies:** Phase 3 (horizontal layout complete), Domain L partial (Skyline)

- G-036: VerticalGapData implementation
- G-037: Skyline-based system distance
- G-041: Per-instrument staff spacing
- G-038 through G-040: VBox, spacers, dividers (lower priority)

### Phase 5: Vertical Elements (Domains G + H)

**Dependencies:** Phase 1 (Style), Phase 3 (measure layout)

**Domain G — Stem/Hook:**
- G-042: 9-priority stem direction
- G-043: 12-step stem length algorithm
- G-044: maxReductions shortening table
- G-045 through G-047: Min overlap, beam width subtraction, chord spread
- G-048: Extended hook glyphs
- G-050: Grace note scaling

**Domain H — Beam:**
- G-052: Dictator/pointer system
- G-053: Quarter-space grid snapping
- G-054: Collision avoidance
- G-055: Anchor shortening
- G-056: Full concave detection
- G-060 through G-062: Beam segments, grace beams, beam breaks

### Phase 6: Elements (Domains I + J)

**Dependencies:** Phase 5 (stems/beams), Phase 1 (Style, Font)

**Domain I — Chord/Note/Accidental:**
- G-066: Inter-voice conflict resolution (10 cases)
- G-067: Full cluster detection
- G-068: Octave-matching accidental columns
- G-072: 35 clef types
- G-076: Full notehead type matrix
- G-077 through G-079: Deduplication + resolve discrepancies

**Domain J — Barlines/Clefs/KeySig/TimeSig:**
- G-080: 11-case barline width
- G-082: SMuFL cutout key sig spacing
- G-083: Clef-dependent key sig lines
- G-087: All 14 barline types
- G-091: Full 110 accidental types
- G-092: Ledger line chord coalescence

### Phase 7: Special Elements (Domain K)

**Dependencies:** Phase 6, Domain L (autoplace)

- G-096 through G-099: Slur/tie bezier (distance-dependent shoulder, collision avoidance)
- G-100 through G-103: Hairpin, dynamics rendering
- G-104 through G-105: Articulation placement
- G-106 through G-107: Tuplet direction + advanced layout
- G-108: Lyrics layout

### Phase 8: Autoplace (Domain L)

**Dependencies:** Shape/Skyline already ported, Phase 6-7 elements exist

- G-112: `autoplaceSegmentElement()`
- G-113: `autoplaceMeasureElement()`
- G-114: `rebaseMinDistance()`
- G-115: Kerning types
- G-116: Item pointer in shapes

### Phase 9: Output (Domains M + N)

**Dependencies:** All layout phases complete

**Domain M — SVG Output:**
- G-117: Two-phase buffering
- G-119: CSS class attributes
- G-120: 3-pass rendering order
- G-124: Per-element color

**Domain N — Font/Glyph:**
- G-127: Multi-font support
- G-128: Runtime font metrics
- G-129: Full SymId coverage

---

## 4. Test Strategy

### Existing Pipeline Tests (214 tests)

| Category | Tests | Gaps Covered |
|----------|-------|-------------|
| A (extraction) | 29 | G-006 through G-015 (import) |
| B (horizontal) | 85 | G-016 through G-035 (stretch, breaking, spacing) |
| C (vertical) | 51 | G-042 through G-079 (stems, beams, chords) |
| D (SVG) | 24 | G-117 through G-126 (SVG output) |
| E (gaps) | 25 | Regression tests for known issues |

### Test Coverage Mapping

**Most impactful gaps for test pass rate (B-tests: 57/85 failing):**
- G-016 (duration stretch formula) → affects ALL B1 (measureWidths) tests
- G-021 (incremental system building) → affects ALL B3 (systemBreaks) tests
- G-022 (squeezable clamp) → affects B3 for 03-rests, 07-time-signatures
- G-027 (min note space) → affects B2 (measureXPositions)
- G-029 (fuzzy comparisons) → affects edge cases across all B tests

**C-tests (14/51 failing):**
- G-042 (stem direction) → C3 (stemDirections)
- G-043 (stem length) → C4 (stemLengths), C5 (stemEndpoints)
- G-052 (beam dictator/pointer) → C7 (beamYPositions)
- G-068 (accidental stacking) → C8 (accidentalXOffsets)

### New Tests Needed

| Domain | Test Category | Description |
|--------|--------------|-------------|
| K (Special) | E-series | Slur/tie bezier accuracy, hairpin rendering, dynamics placement |
| L (Autoplace) | E-series | Element collision detection, autoplace displacement |
| B (Import) | A-series | Multi-part extraction, lyrics, transposing instruments |
| J (Barlines) | C-series | All 14 barline types width, 2-phase layout |
| N (Font) | E-series | Multi-font rendering comparison |

---

## 5. Already Ported (No Gap)

The following critical differences are **already correctly implemented** in MAP and do NOT appear as gaps:

| CritDiff | Description | Verification |
|----------|-------------|--------------|
| כג | verticalClearance = 0.2 × spatium | Shape.ts implements identical threshold (Delta 11 confirms) |
| כד | Zero-width shape walls — collide with everything | Shape.ts preserves `r1.width === 0 \|\| r2.width === 0` check (Delta 11 confirms) |
| כה | Skyline epsilon 1e-7 | Skyline.ts uses same `1e-7` at lines 126, 134, 156 (Delta 11 confirms) |
| — | verticalClearance (Appendix B.3) | Marked "Functional" — already implemented |
| — | SkylineLine 6-case add algorithm | Faithful port (Delta 11 confirms) |
| — | Spring model `placeSystem()` | Faithful port of progressive spring activation (Delta 4 confirms) |
| — | preStretch = 1 - SQUEEZABILITY | Same formula (Delta 2 confirms) |
| — | Last system justification limit 0.3 | Same: `shouldJustifyLastSystem()` (Delta 2 confirms) |
| — | First system indent 5.0sp | Same: `FIRST_SYSTEM_INDENT_SP × sp` (Delta 2 confirms) |
| — | Font size formula 4 × spatium | Identical (Delta 14 confirms) |
| — | MAX_SYSTEM_DISTANCE_SP = 15.0sp | Implemented in `layoutPageSystems` Phase 3 (Delta 6 confirms) |

---

## 6. Known Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| Float→Fraction migration | Changing beat positions from float to Fraction affects entire pipeline | Gradual migration with adapter layer; keep float in hot paths initially |
| Dual implementation cleanup | Removing simplified versions may break existing passing tests | Keep both during transition; switch after validation |
| Accidental width conflict | flat=0.65 vs 1.2 — which is correct? | Measure from font bbox at runtime; hardcoded values are approximations |
| Style system scale | ~310 new constants — risk of typos in default values | Extract defaults directly from webmscore source with extractor tool |
| Cross-staff complexity | Beam, note, and layout cross-staff handling is deeply intertwined | Implement as separate opt-in feature behind flag |
| 25-phase pipeline order | Strict ordering — one mistake cascades | Port phases incrementally; test after each addition |

---

## 6. Checkpoint Log

| Step | Status | Gaps | Notes |
|------|--------|------|-------|
| 3.1 — Read 15 delta tables | ✅ Done | — | All 15 tables extracted |
| 3.2 — Read 47 critical differences | ✅ Done | — | Items א–מז extracted |
| 3.3 — Read Appendix B + known gaps | ✅ Done | — | B.1 (13), B.2 (8), B.3 (5) + sessions A–K |
| 3.4 — Consolidate and categorize | ✅ Done | 147 | 15 domains (A–O) |
| 3.5 — Write GAP_ANALYSIS.md | ✅ Done | 147 | This document |
| Verification | ✅ Done | — | 4 "missing" CritDiffs are already ported (כג,כד,כה + ח merged into G-042). verticalClearance (B.3) also ported. |
