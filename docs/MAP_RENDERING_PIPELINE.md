# MAP Rendering Pipeline — TypeScript Reference Document

> **Purpose:** Document-vs-document comparison with `WEBMSCORE_RENDERING_PIPELINE.md` (C++ reference, 8,732 lines).
> Each chapter mirrors a C++ chapter, documenting the MAP TypeScript implementation at the same level of detail.
>
> **Source root:** `src/renderer/`
> **Generated:** Session G (2026-04-09) — Chapters 1–3; Session H (2026-04-09) — Chapters 4–6

---

## Table of Contents

| Ch | Title | TS Files | C++ Ref | Session |
|----|-------|----------|---------|---------|
| 1 | Style Constants (Sid Registry) | `style/StyleDef.ts` | Ch 1, 15 | G |
| 2 | Pipeline Orchestration | `index.ts`, `engine/LayoutOrchestrator.ts` | Ch 2 | G |
| 3 | XML Import → ExtractedScore | `xmlExtractor.ts`, `extractorTypes.ts` | Ch 1 (XML), Ch 3 | G |
| 4 | Measure Layout & Segment Widths | `horizontalLayout.ts`, `LayoutMeasure.ts` | Ch 3–4 | H |
| 5 | System Breaking & Justification | `LayoutSystem.ts` | Ch 5 | H |
| 6 | Page Layout & Vertical Distribution | `LayoutPage.ts` | Ch 9 | H |
| 7 | Note & Chord Positioning | `chordLayout.ts`, `LayoutChords.ts`, `Note.ts` | Ch 6 | I |
| 8 | Stem & Hook | `Stem.ts`, `Hook.ts` | Ch 7 | I |
| 9 | Beam Layout | `LayoutBeams.ts` | Ch 8 | I |
| 10 | Vertical Layout (Full Pipeline) | `verticalLayout.ts` | Ch 9 | J |
| 11 | Shape & Skyline | `Shape.ts`, `Skyline.ts` | Ch 9B | J |
| 12 | Atomic Elements | `LedgerLine.ts`, `atomicElements.ts` | Ch 6 (part) | J |
| 13 | SVG Rendering & Painter | `svgRenderer.ts`, `Painter.ts`, `SVGPainter.ts` | Ch 17 | K |
| 14 | Glyphs, Anchors & Font System | `leland.ts`, `anchors.ts` | Ch 16 | K |
| 15 | Types & Data Structures | `types.ts`, `extractorTypes.ts`, `spatium.ts` | — | K |

---

## פרק 1: Style Constants (Sid Registry)

> **File:** `src/renderer/style/StyleDef.ts` (159 lines)
> **C++ Ref:** WEBMSCORE Ch 1 (§1.1–1.8), Ch 15 (full Sid registry)
> **Source:** `src/engraving/style/styledef.cpp` (lines 40–650)

### 1.1 Internal DPI Constants

```
MUSESCORE_DPI = 360.0          StyleDef.ts:19   // 72 × 5 — MuseScore internal DPI
INCH_MM       = 25.4           StyleDef.ts:20   // 1 inch = 25.4mm
DPMM          = 360.0 / 25.4  StyleDef.ts:21   // ≈ 14.173 dots per mm
```

> These are NOT exported — used internally by conversion functions.
> C++ equivalent: `mscore.h` defines `DPI = 72.0 * DPI_F` where `DPI_F = 5`.

---

### 1.2 `sidInchToMm(inchValue)` — Inch-to-Millimetre Conversion
**Signature:** `export function sidInchToMm(inchValue: number): number` — `StyleDef.ts:27`

```
Input:   inchValue — raw value from C++ styledef (page dimensions stored as mm / 25.4 = inches)
Output:  millimetres
Algorithm:  return inchValue × INCH_MM     // × 25.4
```

> C++ equivalent: `style.styleD(Sid::pageWidth) * INCH` where `INCH = 25.4`.

---

### 1.3 `sidInchToSp(inchValue, spatiumPx, screenDpi)` — Inch-to-Spatium Conversion
**Signature:** `export function sidInchToSp(inchValue: number, spatiumPx: number, screenDpi = 96): number` — `StyleDef.ts:37`

```
Input:
  inchValue  — raw page dimension in inches
  spatiumPx  — pixels per spatium for current rendering
  screenDpi  — screen DPI (default 96 for browser)

Algorithm:
  px       = inchValue × MUSESCORE_DPI           // convert to 360 DPI printer pixels
  screenPx = px × (screenDpi / MUSESCORE_DPI)    // scale to screen DPI
  return screenPx / spatiumPx                     // convert to spatium units
```

> C++ equivalent: `style.styleD(Sid::X) * DPI` converts to printer pixels. MAP adds an extra step to convert from 360 DPI to screen DPI (typically 96).

---

### 1.4 `getPagePrintableWidthSp(spatiumPx, screenDpi)` — Printable Width in Spatium
**Signature:** `export function getPagePrintableWidthSp(spatiumPx: number, screenDpi = 96): number` — `StyleDef.ts:151`

```
Input:
  spatiumPx  — pixels per spatium
  screenDpi  — screen DPI (default 96)

Algorithm:
  printerPx = Sid.pagePrintableWidthMm × DPMM    // 180 × 14.173 ≈ 2551.2 printer dots
  screenPx  = printerPx × (screenDpi / MUSESCORE_DPI)  // scale to screen
  return screenPx / spatiumPx                     // to spatium units

C++ equivalent:
  targetSystemWidth = score()->styleD(Sid::pagePrintableWidth) * DPI
  (layout.cpp / layoutsystem.cpp — computes usable width for system breaking)
```

---

### 1.5 Type: `SidKey`
**Signature:** `export type SidKey = keyof typeof Sid` — `StyleDef.ts:141`

Union type of all property names in the `Sid` object. Used for type-safe style lookups.

---

### 1.6 `Sid` Object — Complete Constant Registry

**Signature:** `export const Sid = { ... } as const` — `StyleDef.ts:50–139`

The `Sid` object maps MuseScore style IDs to their default values. All values read verbatim from `styledef.cpp`.

#### 1.6.1 Page Geometry

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `pagePrintableWidthMm` | `180.0` | mm | styledef.cpp:43 | A4 (210mm) minus 15mm margins each side |

> Page width/height/margins are COMMENTED OUT in MAP (lines 52–60) — MAP uses `RenderOptions` for page dimensions instead of `Sid`. Only `pagePrintableWidthMm` is active.

#### 1.6.2 Staff & System Vertical Spacing

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `staffUpperBorder` | `7.0` | sp | styledef.cpp:52 | Margin above first staff on page |
| `staffLowerBorder` | `7.0` | sp | styledef.cpp:53 | Margin below last staff on page |
| `staffDistance` | `6.5` | sp | styledef.cpp:55 | Between staves of different parts |
| `akkoladeDistance` | `6.5` | sp | styledef.cpp:57 | Between staves of same part (brace) |
| `maxAkkoladeDistance` | `6.5` | sp | styledef.cpp:70 | Max stretch inside curly bracket |
| `staffHeaderFooterPadding` | `1.0` | sp | styledef.cpp:54 | |
| `minSystemDistance` | `8.5` | sp | styledef.cpp:58 | Minimum gap between systems |
| `maxSystemDistance` | `15.0` | sp | styledef.cpp:59 | Maximum gap (vertical justify) |
| `minVerticalDistance` | `0.5` | sp | styledef.cpp:622 | |
| `maxSystemSpread` | `32.0` | sp | styledef.cpp:67 | |
| `maxStaffSpread` | `20.0` | sp | styledef.cpp:69 | |
| `spreadSystem` | `2.5` | factor | styledef.cpp:63 | Space growth factor between sections |
| `spreadSquareBracket` | `1.2` | factor | styledef.cpp:64 | Space factor for square bracket group |
| `spreadCurlyBracket` | `1.1` | factor | styledef.cpp:65 | Space factor for curly bracket group |

#### 1.6.3 Spatium (Base Unit)

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `spatiumDefault` | `24.8` | printer dots | styledef.cpp:624 | 24.8 / 360 inches = 1.75mm |

#### 1.6.4 System Layout

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `lastSystemFillLimit` | `0.3` | ratio | styledef.cpp:228 | Don't justify last system if < 30% full |
| `instrumentNameOffset` | `1.0` | sp | styledef.cpp:56 | |
| `enableIndentationOnFirstSystem` | `true` | bool | styledef.cpp:447 | |
| `firstSystemIndentationValue` | `5.0` | sp | styledef.cpp:449 | First system shifts right by 5sp |
| `systemFrameDistance` | `7.0` | sp | styledef.cpp:128 | |
| `frameSystemDistance` | `7.0` | sp | styledef.cpp:129 | |

#### 1.6.5 Barlines

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `barWidth` | `0.18` | sp | styledef.cpp:131 | Normal thin barline width |
| `repeatBarlineDotSeparation` | `0.37` | sp | styledef.cpp:137 | |

#### 1.6.6 Staff Lines

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `staffLineWidth` | `0.11` | sp | styledef.cpp:196 | |
| `ledgerLineWidth` | `0.16` | sp | styledef.cpp:197 | Was 0.1875 |
| `ledgerLineLength` | `0.33` | sp | styledef.cpp:198 | Notehead width + this overhang |

#### 1.6.7 Note / Stem

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `stemWidth` | `0.10` | sp | styledef.cpp:175 | |
| `stemLength` | `3.5` | sp | styledef.cpp:177 | Quarter and shorter |
| `stemLengthSmall` | `2.25` | sp | styledef.cpp:178 | Grace notes |

#### 1.6.8 Note Spacing

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `minNoteDistance` | `0.5` | sp | styledef.cpp:184 | Minimum note-to-note |
| `barNoteDistance` | `1.3` | sp | styledef.cpp:185 | Barline to first note (was 1.2) |
| `noteBarDistance` | `1.5` | sp | styledef.cpp:188 | Last note to barline |
| `measureSpacing` | `1.5` | raw | styledef.cpp:189 | Logarithmic stretch factor |

#### 1.6.9 Dots

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `dotNoteDistance` | `0.5` | sp | styledef.cpp:216 | Note to augmentation dot |
| `dotDotDistance` | `0.65` | sp | styledef.cpp:218 | Dot to dot (double-dotted) |
| `dotMag` | `1.0` | factor | styledef.cpp:215 | Dot size multiplier |

#### 1.6.10 Accidentals

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `accidentalDistance` | `0.22` | sp | styledef.cpp:202 | Accidental to accidental |
| `accidentalNoteDistance` | `0.25` | sp | styledef.cpp:203 | Accidental to notehead |

#### 1.6.11 Beams

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `beamWidth` | `0.5` | sp | styledef.cpp:209 | Was 0.48 |
| `beamMinLen` | `1.1` | sp | styledef.cpp:211 | Minimum beam length |
| `beamNoSlope` | `false` | bool | styledef.cpp:212 | Force flat beams |
| `useWideBeams` | `false` | bool | styledef.cpp:210 | 4-quarter-space beam spacing |

#### 1.6.12 Grace / Small Notes

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `smallNoteMag` | `0.7` | factor | styledef.cpp:399 | Cue/small note magnification |
| `graceNoteMag` | `0.7` | factor | styledef.cpp:400 | Grace note magnification |

#### 1.6.13 Clef / Key / Time Signature Spacing

| Key | Value | Unit | C++ Source | Notes |
|-----|-------|------|------------|-------|
| `clefBarlineDistance` | `0.5` | sp | styledef.cpp:172 | |
| `timesigBarlineDistance` | `0.5` | sp | styledef.cpp:173 | |
| `keysigAccidentalDistance` | `0.3` | sp | styledef.cpp:206 | |

---

### 1.7 Delta from C++

**Coverage:** MAP implements ~40 Sid constants out of ~350 in C++ (`styledef.cpp` lines 40–650).

**Missing categories (not needed for current renderer scope):**

| Category | C++ Sid Count | Notes |
|----------|--------------|-------|
| Lyrics spacing | ~15 | lyricsDashXXX, lyricsMinTopDistance, etc. |
| Tuplet brackets | ~8 | tupletXXX |
| Slur/Tie geometry | ~20 | slurXXX, tieXXX |
| Hairpin/Dynamic | ~15 | hairpinXXX, dynamicXXX |
| Text styles | ~40 | titleFontSize, subtitleFontSize, etc. |
| Articulation positions | ~10 | articulationXXX |
| Ottava | ~5 | ottavaXXX |
| Figured bass | ~5 | fbXXX |
| TAB staff | ~10 | tabXXX |
| Repeat barline variants | ~5 | endBarWidth, doubleBarWidth, etc. |
| Measure/MMRest | ~5 | minMeasureWidth, minMMRestWidth, etc. |
| System header distances | ~5 | systemHeaderDistance, systemHeaderTimeSigDistance, etc. |
| Bracket/brace | ~3 | bracketWidth, accoladeWidth |

**Values in MAP but NOT in Sid object:**
- `BAR_ACC_DIST_SP = 0.65` (in LayoutOrchestrator.ts:59) — C++ `Sid::barAccidentalDistance`
- System header constants (in `horizontalLayout.ts`) — `CLEF_LEFT_MARGIN_SP`, `CLEF_GLYPH_WIDTH_SP`, etc.
- Padding table constants (in `LayoutOrchestrator.ts`) — `KEYSIG_LEFT_MARGIN_SP`, `TIMESIG_LEFT_MARGIN_SP`, etc.

**Design difference:** C++ accesses style values dynamically via `score->styleD(Sid::X)`. MAP uses a static `const` object — values are compile-time constants, not runtime-configurable. This means MAP cannot change style values per score (e.g., custom note spacing). For current scope (single rendering configuration), this is sufficient.

---

## פרק 2: Pipeline Orchestration

> **Files:** `src/renderer/index.ts` (53 lines), `src/renderer/engine/LayoutOrchestrator.ts` (543 lines)
> **C++ Ref:** WEBMSCORE Ch 2 (§2.1–2.4) — `layout.cpp`, `layoutsystem.cpp`, `layoutmeasure.cpp`

### 2.1 Public API: `renderScore()`
**Signature:** `export function renderScore(xmlString: string, options?: RenderOptions): RenderResult` — `index.ts:38`

```
Input:
  xmlString  — raw MusicXML string
  options    — optional RenderOptions (page size, spatium, margins)

Output:
  RenderResult {
    svg:           string              — complete SVG markup
    notes:         RenderedNote[]      — geometry for every note
    elementMap:    Map<string, DOMRectLike>  — "measure-N" → bbox
    renderedScore: RenderedScore       — full structure for advanced consumers
  }

Algorithm:
  1. extracted      = extractScore(xmlString)                    // xmlExtractor.ts
  2. hLayout        = orchestrateHorizontalLayout(extracted, options)  // LayoutOrchestrator.ts
  3. renderedScore  = computeVerticalLayout(extracted, hLayout, options) // verticalLayout.ts
  4. svg            = renderToSVG(renderedScore, options)        // svgRenderer.ts
  5. return { svg, notes: renderedScore.allNotes, elementMap: renderedScore.elementMap, renderedScore }
```

**Re-exports (index.ts:20–30):**
```
extractScore                         from xmlExtractor
orchestrateHorizontalLayout as computeHorizontalLayout   from LayoutOrchestrator
computeVerticalLayout                from verticalLayout
renderToSVG                          from svgRenderer
RenderOptions, RenderResult          from types
```

> **C++ equivalent:** `Score::doLayout()` → `Layout::doLayoutRange()` (layout.cpp:74). C++ uses a monolithic entry point that handles incremental relayout, linear mode, and full layout. MAP uses a pure functional pipeline with no mutable score state.

---

### 2.2 Pipeline Architecture Comparison

```
C++ (webmscore):
  Score::doLayout()
    → Layout::doLayoutRange()         // handles incremental + full + linear
      → LayoutMeasure::getNextMeasure()   // per-measure prep (accidentals, stems, etc.)
      → LayoutSystem::collectSystem()     // greedy break
      → LayoutSystem::justifySystem()     // spring model
      → LayoutPage::collectPage()         // page fill
      → LayoutPage::layoutPage()          // vertical distribution

MAP (TypeScript):
  renderScore()
    → extractScore()                  // MusicXML → ExtractedScore (no C++ equivalent — C++ reads from Score object)
    → orchestrateHorizontalLayout()   // segments + system breaking + justification (all in one)
    → computeVerticalLayout()         // note y, stems, beams → RenderedScore
    → renderToSVG()                   // SVG generation
```

**Key architectural difference:** C++ mutates a shared `Score` object in-place; MAP uses immutable data flowing through pure functions. C++ supports incremental relayout (only rebuild changed measures); MAP always does full layout from scratch.

---

### 2.3 `orchestrateHorizontalLayout()` — Main Orchestrator
**Signature:** `export function orchestrateHorizontalLayout(score: ExtractedScore, renderOptions?: RenderOptions): HorizontalLayout` — `LayoutOrchestrator.ts:80`

```
Input:
  score         — ExtractedScore from xmlExtractor
  renderOptions — optional RenderOptions

Output:
  HorizontalLayout {
    opts:     Required<RenderOptions>
    systems:  HLayoutSystem[]
    pages:    HLayoutPage[]
    measures: Map<number, HLayoutMeasure>
    noteX:    Map<string, number>           // noteId → x coordinate
  }

Algorithm (6 steps):

  // ── Step 1: Merge options with defaults ──────────────────────────────────
  opts = { ...DEFAULT_RENDER_OPTIONS, ...renderOptions }          // :84
  sp   = opts.spatium

  // ── Step 2: Pre-compute key/time state at start of each measure ──────────
  measureStartState = computeMeasureStates(extMeasures, metadata)  // :90
  // → MeasureState[] — running fifths, beats, beatType per measure

  // ── Step 3: Build MeasureSegments and firstNotePads ──────────────────────
  for each measure i:                                              // :96-103
    allSegments[m.num]   = buildMeasureSegments(m, state.beats)
    firstNotePads[m.num] = computeFirstNotePad(m, state, hasTimeChange, sp)

  // ── Step 4: Per-measure min/max durations ────────────────────────────────
  for each (mNum, segs) in allSegments:                            // :108-121
    measureMinDurs[mNum] = min(seg.durationQb for seg in segs where > 0)
    measureMaxDurs[mNum] = max(seg.durationQb for seg in segs where > 0)
    fallback: minD = 1.0, maxD = 1.0

  // ── Step 5: Incremental greedy system breaking ───────────────────────────
  headerWidth         = computeHeaderWidth(metadata.fifths, sp)    // :124
  usableWidth         = opts.pageWidth - opts.marginLeft - opts.marginRight
  firstSysIndentPx    = FIRST_SYSTEM_INDENT_SP × sp               // :130
  firstSysUsableWidth = usableWidth - firstSysIndentPx             // :131

  { systemGroups, systemMinDurs, systemMaxDurs } =
    collectSystemsIncremental(                                     // :135-138
      allSegments, firstNotePads, measureMinDurs, measureMaxDurs,
      headerWidth, usableWidth, sp, firstSysUsableWidth
    )
  // C++ equivalent: layoutsystem.cpp:109-245 — collectSystem() with incremental recomputation

  // ── Step 6: Page geometry ────────────────────────────────────────────────
  sysH          = (4 + opts.systemSpacingSp) × sp                  // :141
  usablePageH   = opts.pageHeight - opts.marginTop - opts.marginBottom
  maxSysPerPage = max(1, floor(usablePageH / sysH))               // :143

  // ── Step 7: Per-system justification and note placement ──────────────────
  for each sysIdx in systemGroups:                                 // :154-337

    // Page break when system count exceeds maxSysPerPage           // :158-162

    // Re-compute segment widths with per-system minDur/maxDur      // :170-195
    for each measure in system:
      // First measure of non-initial system: hasTimeChange=false (sys header handles it)
      sysSegWidths[mNum]     = computeSegmentWidths(segs, sysMinDur, sp, sysMaxDur)
      sysMeasureWidths[mNum] = computeMeasureWidth(pad, segWs, sp)

    // Per-system header width (key/time at system start)           // :200-206
    sysHeaderWidth = computeHeaderWidth(sysDisplayFifths, sp)

    // Target width for spring model                                // :215
    targetWidth = sysUsableWidth - sysHeaderWidth

    // ── Pre-stretch compression ──────────────────────────────────
    // C++: layoutsystem.cpp:415-425 — if system overflows, compress by (1 - SQUEEZABILITY)
    if totalMeasureWidth > targetWidth:                            // :224
      preStretch = 1 - SQUEEZABILITY    // = 0.7                   // :225
      for each measure: segWs[i] *= preStretch                     // :229
      recompute sysMeasureWidths

    // ── Spring model justification ───────────────────────────────
    // C++: layoutsystem.cpp:496 — justifySystem()
    springs = [ { stretch: noteArea, currentWidth: measureWidth } for each measure ]
    if !isLastSystem OR shouldJustifyLastSystem():                  // :249
      finalMeasureWidths = justifySystem(springs, targetWidth, totalMeasureWidth)
    else:
      finalMeasureWidths = springs.map(s => s.currentWidth)        // no stretch for sparse last system

    // ── Place measures and notes ──────────────────────────────────
    measureX = sysX + sysHeaderWidth                               // :277
    for each measure:
      // Distribute justified width into note area                  // :289-292
      rawNoteArea    = sum(segWs)
      trailingPx     = NOTE_BAR_DIST_SP × sp
      targetNoteArea = finalW - pad - trailingPx
      noteScale      = targetNoteArea / rawNoteArea

      // Build HLayoutSegments with page-relative x positions       // :298-308
      for each segment:
        scaledW = segWs[si] × noteScale
        segments.push({ beat, duration, stretch, x: segX, width: scaledW })
        segX += scaledW

      // Map each note to its nearest beat segment x                // :321-333
      for each non-grace note in measure:
        noteXMap[note.id] = closest segment x to note.beat

  return { opts, systems, pages, measures: measureMap, noteX: noteXMap }
```

---

### 2.4 `computeMeasureStates()` — Running Key/Time State
**Signature:** `function computeMeasureStates(extMeasures: ExtractedMeasure[], metadata: {...}): MeasureState[]` — `LayoutOrchestrator.ts:348`

```
Interface: MeasureState { fifths: number; beats: number; beatType: number }

Algorithm:
  runFifths   = metadata.fifths
  runBeats    = metadata.beats
  runBeatType = metadata.beatType
  for each measure m:
    states.push({ fifths: runFifths, beats: runBeats, beatType: runBeatType })
    if m.keyChange  → runFifths   = m.keyChange.fifths
    if m.timeChange → runBeats    = m.timeChange.beats
                      runBeatType = m.timeChange.beatType
  return states
```

> **C++ equivalent:** `Staff::keySigEvent(tick)` and `Staff::timeSig(tick)` — computed lazily from the staff's key/time signature event list. MAP pre-computes a flat array for O(1) lookup.

---

### 2.5 `buildMeasureSegments()` — Collect Beat Positions
**Signature:** `function buildMeasureSegments(m: ExtractedMeasure, beatsPerMeasure: number): MeasureSegment[]` — `LayoutOrchestrator.ts:370`

```
Interface: MeasureSegment { beat: number; durationQb: number; hasAccidental: boolean }

Algorithm:
  // Collect unique beat positions from non-grace notes                // :372-376
  beatSet = Set<number>
  for n in m.notes where !n.isGrace && n.duration > 0:
    beatSet.add(snapBeat(n.beat))

  // Track beats with visible accidentals                              // :379-384
  beatsWithAccidentals = Set<number>
  for n in m.notes where !n.isGrace && n.duration > 0 && n.showAccidental:
    beatsWithAccidentals.add(snapBeat(n.beat))

  sortedBeats = [...beatSet].sort()                                    // :386
  if sortedBeats.length === 0 → sortedBeats = [1]  // empty measure   // :387

  measureEndBeat = 1 + beatsPerMeasure                                 // :389

  // Each segment: from this beat to the next beat (or measure end)    // :391-395
  return sortedBeats.map((beat, i) => {
    nextBeat   = sortedBeats[i+1] ?? measureEndBeat
    durationQb = nextBeat - beat
    return { beat, durationQb, hasAccidental: beatsWithAccidentals.has(beat) }
  })
```

> **C++ equivalent:** `Measure::shortestChordRest()` (measure.cpp:4679) iterates `ChordRest` segments. MAP doesn't have segments as objects — it builds them from note beat positions.

---

### 2.6 `computeFirstNotePad()` — Barline-to-First-Note Distance
**Signature:** `function computeFirstNotePad(m: ExtractedMeasure, state: MeasureState, hasTimeChange: boolean, sp: number): number` — `LayoutOrchestrator.ts:414`

```
Constants (defined inline):                                           // :432-435
  KEYSIG_LEFT_MARGIN_SP  = 0.5    // Sid::keysigLeftMargin
  TIMESIG_LEFT_MARGIN_SP = 0.63   // Sid::timesigLeftMargin
  KEYSIG_NOTE_PAD_SP     = 1.75   // paddingTable[KEYSIG][NOTE]
  TIMESIG_NOTE_PAD_SP    = 1.35   // paddingTable[TIMESIG][NOTE]

Algorithm:
  if m.keyChange AND hasTimeChange:                                    // :437
    cancels = compute cancelled accidentals (old key vs new key)
    kSigW   = inlineKeySigWidthSp(cancels, newFifths)
    return (0.5 + kSigW + KEY_TIMESIG_DIST_SP + TIMESIG_GLYPH_WIDTH_SP + 1.35) × sp

  if m.keyChange:                                                      // :447
    cancels = compute cancelled accidentals
    kSigW   = inlineKeySigWidthSp(cancels, newFifths)
    return (0.5 + kSigW + 1.75) × sp

  if hasTimeChange:                                                    // :456
    return (0.63 + TIMESIG_GLYPH_WIDTH_SP + 1.35) × sp

  // Regular measure (no key/time change):                             // :461-479
  // Check if first note has accidental
  firstBeat = min beat of non-grace notes
  firstNoteHasAcc = any note at firstBeat with showAccidental?
  return (firstNoteHasAcc ? BAR_ACC_DIST_SP : BAR_NOTE_DIST_SP) × sp
  //      BAR_ACC_DIST_SP = 0.65sp              BAR_NOTE_DIST_SP = 1.3sp
```

> **C++ equivalent:** `Measure::computeWidth()` (measure.cpp:4421) — `computeFirstSegmentXPosition()`. Uses `paddingTable` for element-to-element gaps. MAP hardcodes the specific padding combos that actually occur.
>
> **Important:** barWidth (0.18sp) cancels out in C++ (`minLeft - minRight`), so MAP does NOT add it separately.

---

### 2.7 `computeHeaderWidth()` — System Header Width
**Signature:** `function computeHeaderWidth(fifths: number, sp: number): number` — `LayoutOrchestrator.ts:488`

```
Algorithm:
  hasFifths  = |fifths| > 0
  kSigWidth  = keySigWidthSp(fifths)                      // from horizontalLayout.ts
  gapAfterClef = hasFifths
    ? CLEF_KEY_DIST_SP + kSigWidth + KEY_TIMESIG_DIST_SP
    : CLEF_TIMESIG_DIST_SP

  return (CLEF_LEFT_MARGIN_SP + CLEF_GLYPH_WIDTH_SP + gapAfterClef + TIMESIG_GLYPH_WIDTH_SP) × sp

  // NOTE: SYS_HDR_TIMESIG_SP (2.0sp) is NOT added here.
  // firstNotePad of the first measure provides this gap.
```

> **C++ equivalent:** `System::layout()` (system.cpp) — computes header element positions.
> **Constants** imported from `horizontalLayout.ts`: `CLEF_LEFT_MARGIN_SP`, `CLEF_GLYPH_WIDTH_SP`, `CLEF_KEY_DIST_SP`, `CLEF_TIMESIG_DIST_SP`, `KEY_TIMESIG_DIST_SP`, `TIMESIG_GLYPH_WIDTH_SP`.

---

### 2.8 `findGlobalMinDur()` / `findSystemMinDur()` — Duration Extremes
**Signatures:**
- `function findGlobalMinDur(allSegments: Map<number, MeasureSegment[]>): number` — `LayoutOrchestrator.ts:507`
- `function findSystemMinDur(mNums: number[], allSegments: Map<number, MeasureSegment[]>): number` — `LayoutOrchestrator.ts:517`

```
Algorithm (both): iterate segments, find min durationQb > 0.
```

> **C++ equivalent:** `Measure::shortestChordRest()` (measure.cpp:4679) returns shortest ticks per measure. System-level min is computed during `collectSystem()`.

---

### 2.9 `clampMinDur()` — Duration Clamping
**Signature:** `function clampMinDur(minDur: number): number` — `LayoutOrchestrator.ts:533`

```
Algorithm:
  if !isFinite(minDur) or minDur <= 0 → return 0.125       // :534
  return min(minDur, 0.25)                                   // :535 — cap at quarter note
```

> **C++ equivalent:** measure.cpp:4196 — `longNoteThreshold` check. Prevents extreme stretching when score has very short notes.

---

### 2.10 `snapBeat()` — Beat Rounding
**Signature:** `function snapBeat(beat: number): number` — `LayoutOrchestrator.ts:541`

```
Algorithm:  return round(beat × 1000) / 1000                // :542
```

> Eliminates floating-point noise in beat positions. No C++ equivalent — C++ uses `Fraction` (exact rational arithmetic).

---

### 2.11 Constants Defined in LayoutOrchestrator

| Constant | Value | Location | C++ Source | Notes |
|----------|-------|----------|------------|-------|
| `BAR_ACC_DIST_SP` | `0.65` | :59 | `Sid::barAccidentalDistance` | Barline→first note with accidental |
| `KEYSIG_LEFT_MARGIN_SP` | `0.5` | :432 | `paddingTable[BAR_LINE][KEYSIG]` | |
| `TIMESIG_LEFT_MARGIN_SP` | `0.63` | :433 | `paddingTable[BAR_LINE][TIMESIG]` | |
| `KEYSIG_NOTE_PAD_SP` | `1.75` | :434 | `paddingTable[KEYSIG][NOTE]` | |
| `TIMESIG_NOTE_PAD_SP` | `1.35` | :435 | `paddingTable[TIMESIG][NOTE]` | |

---

### 2.12 Interface: `MeasureState`
**Signature:** `interface MeasureState` — `LayoutOrchestrator.ts:63`

```typescript
{
  fifths:   number     // key signature (positive = sharps, negative = flats)
  beats:    number     // time signature numerator
  beatType: number     // time signature denominator
}
```

---

### 2.13 Delta from C++

| Aspect | C++ (webmscore) | MAP (TypeScript) |
|--------|-----------------|------------------|
| **Entry point** | `Score::doLayout()` → `Layout::doLayoutRange()` | `renderScore()` → `orchestrateHorizontalLayout()` |
| **Data model** | Mutable `Score` object with linked `Measure/Segment/ChordRest` tree | Immutable `ExtractedScore` → pure function pipeline |
| **Incremental layout** | Yes — only rebuilds from changed tick range | No — always full layout from scratch |
| **Linear mode** | Yes (`LayoutOptions::isLinearMode()`) | No — page mode only |
| **MMRest** | `createMultiMeasureRests` → `Measure::mmRest()` | Not supported |
| **Multi-staff/multi-part** | Full support, cross-staff beams | Single-part only (grand staff supported) |
| **Segment model** | `Segment` objects in `Measure` linked list | `MeasureSegment[]` built from note beats |
| **Tick representation** | `Fraction` (exact rational) | `number` (float, snapped to 3 decimals) |
| **Style access** | Runtime `score->styleD(Sid::X)` (per-score) | Compile-time `Sid.X` (global constant) |
| **Pre-stretch** | `layoutsystem.cpp:415` — preStretch = 1 - squeezability | Same formula: `preStretch = 1 - SQUEEZABILITY` (:225) |
| **Last system justification** | `lastSystemFillLimit = 0.3` | Same: `shouldJustifyLastSystem()` |
| **Page breaking** | `collectPage()` with system stacking | Simple `maxSysPerPage` from page height |
| **First system indent** | `Sid::firstSystemIndentationValue = 5.0sp` | Same: `FIRST_SYSTEM_INDENT_SP × sp` (:130) |

**Not implemented in MAP:**
- `CmdStateLocker` (RAII lock for concurrent access)
- Cautionary elements (courtesy keysigs, clefs at end of previous system)
- Section breaks, volta layout breaks
- Cross-staff beam handling in layout
- `LayoutMeasure::getNextMeasure()` full pipeline (accidentals, stems computed separately in `computeVerticalLayout`)

---

## פרק 3: XML Import → ExtractedScore

> **Files:** `src/renderer/xmlExtractor.ts` (843 lines), `src/renderer/extractorTypes.ts` (313 lines)
> **C++ Ref:** WEBMSCORE Ch 1 (Score creation), Ch 3 (Measure processing)
> **C++ Source:** `importexport/musicxml/importmusicxmlpass1.cpp`, `importmusicxmlpass2.cpp`

### 3.1 Architecture: Single-Pass vs Multi-Pass

**C++ (webmscore):**
```
Pass 1 (importmusicxmlpass1.cpp):
  - Parse part-list, score header
  - Build Part/Staff structure
  - Determine tick positions, key/time/clef events
  - Create Measure objects

Pass 2 (importmusicxmlpass2.cpp):
  - Fill measures with ChordRest/Note objects
  - Compute accidentals via AccidentalState
  - Create beams, ties, slurs, tuplets
  - Layout elements (stems, articulations)
  - Result: fully populated Score object
```

**MAP (TypeScript):**
```
Single pass (xmlExtractor.ts):
  - DOMParser → Document
  - extractParts() → part list
  - extractMetadata() → title, composer, key, time, tempo
  - extractMeasures() → all measures with all content
  - Result: ExtractedScore (data only, no geometry)
```

> MAP produces a flat data structure with no object graph. All geometry computation is deferred to the layout engine (chapters 4–12).

---

### 3.2 `extractScore()` — Main Entry Point
**Signature:** `export function extractScore(xmlString: string): ExtractedScore` — `xmlExtractor.ts:45`

```
Input:   xmlString — raw MusicXML string
Output:  ExtractedScore { metadata, parts, measures }

Algorithm:
  doc      = new DOMParser().parseFromString(xmlString, 'application/xml')  // :47
  parts    = extractParts(doc)         // :49 — parse <part-list>
  metadata = extractMetadata(doc, parts) // :50 — parse header
  measures = extractMeasures(doc, metadata) // :51 — parse all <measure> elements
  return { metadata, parts, measures }
```

---

### 3.3 `extractParts()` — Part List
**Signature:** `function extractParts(doc: Document)` — `xmlExtractor.ts:60`

```
Algorithm:
  partListEls = doc.querySelectorAll('part-list > score-part')         // :61
  parts = Array.from(partListEls).map(el => ({
    id:         el.getAttribute('id') || 'P1',                         // :63
    name:       el.querySelector('part-name')?.textContent?.trim() || '',
    staffCount: 1,                                                     // updated by metadata
  }))
  if parts.length === 0 → push default { id: 'P1', name: '', staffCount: 1 }
  return parts
```

> C++ equivalent: `importmusicxmlpass1.cpp` — builds `Part` objects with staff information.

---

### 3.4 `extractMetadata()` — Score Header
**Signature:** `function extractMetadata(doc: Document, parts: ...): ExtractedMetadata` — `xmlExtractor.ts:75`

```
Algorithm:
  title = doc.querySelector('work-title')                              // :79
       ?? doc.querySelector('movement-title')
       ?? doc.querySelector('credit-words')
       ?? 'Untitled'

  composer = doc.querySelector('creator[type="composer"]')              // :85

  firstMeasure = doc.querySelector('measure')                          // :88
  fifths   = firstMeasure > attributes > key > fifths     || 0         // :93
  mode     = firstMeasure > attributes > key > mode       || 'major'   // :94
  beats    = firstMeasure > attributes > time > beats     || 4         // :95
  beatType = firstMeasure > attributes > time > beat-type || 4         // :96
  staffCount = firstMeasure > attributes > staves         || 1         // :97

  tempo     = firstMeasure > sound[tempo]                              // :105-106
  tempoText = firstMeasure > direction > direction-type > words        // :107-108

  measureCount = doc.querySelectorAll('measure').length                // :110

  return { title, composer, fifths, mode, beats, beatType, tempo, tempoText, measureCount, staffCount }
```

---

### 3.5 `extractMeasures()` — Full Measure Extraction
**Signature:** `function extractMeasures(doc: Document, meta: ExtractedMetadata): ExtractedMeasure[]` — `xmlExtractor.ts:119`

This is the core function — 411 lines (:119–530). It processes every `<measure>` element, extracting all musical content.

#### Running State (across measures):

```
divisions: number = 1                              // :123 — XML divisions per quarter note
currentKey: { fifths, mode }                       // :124 — current key signature
currentTime: { beats, beatType }                   // :125 — current time signature
currentClefs: Record<staffIndex, ExtractedClef>    // :126 — current clef per staff
accidentalState: Record<staffIndex, Map<pitchKey, alter>>  // :134 — resets each measure
tupletCounter: number = 0                          // :138 — generates unique tuplet IDs
activeTuplets: Record<voice, tupletId>             // :141 — currently open tuplets per voice
```

#### Per-Measure Processing:

```
for each measureEl:                                                    // :145
  num = measureEl.getAttribute('number')                               // :146

  // ── Reset accidental state ───────────────────────────────────────
  for each staff: accidentalState[s].clear()                           // :149-152

  // ── Parse <attributes> ────────────────────────────────────────────
  if attribEl:                                                         // :159
    divisions  = attribEl > divisions  (if present)                    // :161-162
    keyChange  = attribEl > key        (if changed from current)       // :164-170
    timeChange = attribEl > time       (if changed from current)       // :174-180
    clefChange = attribEl > clef[]     (per staff)                     // :184-194

  // ── Parse <barline> ───────────────────────────────────────────────
  for each barlineEl:                                                  // :216-244
    location = 'left' or 'right'
    style = from <bar-style> or <repeat direction="...">
    volta = from <ending type="start/stop" number="N">

  // ── Parse children (backup, forward, harmony, direction, note) ────
  for each child element:                                              // :257
    if backup:  runningBeat -= dur/divisions                           // :262
    if forward: runningBeat += dur/divisions                           // :268
    if harmony: harmonies.push(parseHarmony(...))                      // :274-278
    if direction: { dynamics, directions } = parseDirection(...)       // :282-288
    if note:    → full note extraction (see §3.6)                      // :292-505

  // Build measure record                                              // :507-527
  measure = { num, divisions, notes, harmonies, dynamics, directions }
  attach optional: keyChange, timeChange, clefChange, barlineLeft/Right, voltaStart/End,
                   rehearsalMark, tempoText, tempo
```

---

### 3.6 Note Extraction (inside `extractMeasures`)
**Location:** `xmlExtractor.ts:292–505`

For each `<note>` element:

```
  // ── Basic properties ──────────────────────────────────────────────
  voice      = note > voice                     || 1                   // :295
  staffIndex = note > staff                     - 1                    // :296-297
  isChord    = !!note > chord                                          // :299
  isRest     = !!note > rest                                           // :300
  isGrace    = !!note > grace                                          // :301
  duration   = (note > duration) / divisions                           // :304-305

  // ── Beat position ─────────────────────────────────────────────────
  noteBeat = isChord ? beatByVoice[voice] : runningBeat                // :309
  if !isChord && !isGrace:
    runningBeat += duration                                            // :313
    beatByVoice[voice] = runningBeat                                   // :314

  // ── Pitch ─────────────────────────────────────────────────────────
  if !isRest:                                                          // :323
    step   = pitch > step                                              // :326
    octave = pitch > octave                                            // :327
    alter  = pitch > alter       || 0                                  // :328-329
    midi   = stepOctaveAlterToMidi(step, octave, alter)                // :330

  // ── noteMap ID ────────────────────────────────────────────────────
  id = `note-m${num}b${Math.round(noteBeat * 100)}-${step}${octave}`  // :335-337
  // or: `note-m${num}b${Math.round(noteBeat * 100)}-rest`

  // ── Duration type & dots ──────────────────────────────────────────
  type     = note > type    || durationToType(durationDivisions, divisions) // :341
  dotCount = note > dot[].length                                        // :342

  // ── Explicit accidental ───────────────────────────────────────────
  explicitAccidental = note > accidental  → mapAccidentalText()         // :346-353
  isCourtesy = accidental[cautionary|courtesy|parentheses] === 'yes'

  // ── Computed accidental (§4h algorithm) ────────────────────────────
  if !isRest && step && alter defined:                                  // :359-376
    expectedAlter = keySignatureAlterFor(step, currentKey.fifths)
    stateAlter    = accidentalState[staffIndex][pitchKey] ?? expectedAlter
    if explicitAccidental:
      showAccidental = true; accidentalToShow = explicitAccidental
      update state
    else if alter !== stateAlter:
      showAccidental = true; accidentalToShow = alterToAccidentalSign(alter)
      update state

  // ── Beam ──────────────────────────────────────────────────────────
  beamStates = note > beam[] → { level: number, value: BeamValue }[]   // :379-384

  // ── Tie ───────────────────────────────────────────────────────────
  tieStart/tieStop = note > tie[type="start|stop"]                     // :387-393

  // ── Slur ──────────────────────────────────────────────────────────
  slurStart/slurStop = note > notations > slur[type="start|stop"]      // :396-407
  slurPlacement = slur > placement                                     // :403

  // ── Tuplet ────────────────────────────────────────────────────────
  tupletEl = note > notations > tuplet                                 // :416
  if type="start": tupletStart=true; new tupletId                      // :419-422
  if type="stop":  tupletStop=true; delete activeTuplets[voice]        // :424-436
  tupletActual/Normal = note > time-modification > actual/normal-notes // :429-434

  // ── Articulations ─────────────────────────────────────────────────
  articulations = note > notations > articulations > *  → mapArticulation()  // :440-447
  if note > notations > fermata → push 'fermata'                             // :449-451

  // ── Ornaments ─────────────────────────────────────────────────────
  ornaments = note > notations > ornaments > *  → mapOrnament()        // :454-461

  // ── Fingering ─────────────────────────────────────────────────────
  fingering = note > notations > technical > fingering                  // :464-465
```

---

### 3.7 `parseHarmony()` — Chord Symbol Extraction
**Signature:** `function parseHarmony(el: Element, measureNum: number, currentBeat: number, divisions: number, beatsPerMeasure: number): ExtractedHarmony | null` — `xmlExtractor.ts:536`

```
Algorithm:
  rootStep  = el > root > root-step                                    // :543
  if !rootStep → return null
  rootAlter = el > root > root-alter  || 0                             // :547
  kind      = el > kind                                                // :548
  kindText  = el > kind[text]  ?? kindToDisplay(kind)                  // :549
  acc       = rootAlter → '♭' | '♯' | '𝄫' | '𝄪' | ''                 // :551
  label     = rootStep + acc + kindText                                // :552

  // Beat position with offset                                         // :555-557
  offsetDivisions = el > offset
  beat = currentBeat + offsetDivisions / divisions

  // beatFraction for melody-color compatibility                       // :560-562
  beatFraction = (beat - 1) / beatsPerMeasure

  // Bass note (slash chords)                                          // :564-568
  bassStep  = el > bass > bass-step
  bassAlter = el > bass > bass-alter

  return { measureNum, beat, beatFraction, rootStep, rootAlter, kind, kindText, label, bassStep?, bassAlter? }
```

---

### 3.8 `parseDirection()` — Dynamics, Words, Wedge, Metronome, etc.
**Signature:** `function parseDirection(el: Element, measureNum: number, currentBeat: number): { dynamics: ExtractedDynamic[]; directions: ExtractedDirection[] }` — `xmlExtractor.ts:588`

```
Algorithm:
  placement = el > placement  || 'below'                               // :596-597
  staffIndex = el > staff     - 1                                      // :598-599

  for each direction-type child:                                       // :601

    if dynamics element:                                               // :603-611
      → push { measureNum, beat, staffIndex, placement, value: firstElementChild.tagName }

    if words element:                                                  // :615-624
      → push direction { type: 'words', text: words.textContent }

    if metronome element:                                              // :628-641
      unit = metronome > beat-unit
      bpm  = metronome > per-minute
      → push direction { type: 'metronome', metronomeUnit, metronomeBpm }

    if wedge element:                                                  // :644-658
      wedgeType → 'wedge-crescendo' | 'wedge-decrescendo' | 'wedge-stop'
      → push direction { type: dirType, wedgeNumber }

    if dashes element:                                                 // :662-665
      → push direction { type: 'dashes-start' | 'dashes-stop' }

    if octave-shift element:                                           // :669-675
      → push direction { type: 'octave-shift-up' | 'octave-shift-down' | 'octave-shift-stop' }

    if segno element → push { type: 'segno' }                         // :679
    if coda element  → push { type: 'coda' }                          // :682
```

---

### 3.9 Pitch Helpers

#### `stepOctaveAlterToMidi()`
**Signature:** `function stepOctaveAlterToMidi(step: string, octave: number, alter: number): number` — `xmlExtractor.ts:698`

```
STEP_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }    // :694-696
return (octave + 1) × 12 + STEP_SEMITONES[step] + alter              // :699
```

#### `keySignatureAlterFor()`
**Signature:** `function keySignatureAlterFor(step: string, fifths: number): number` — `xmlExtractor.ts:709`

```
SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']                   // :706
FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F']                   // :707

if fifths > 0 → return SHARP_ORDER.slice(0, fifths).includes(step) ? 1 : 0
if fifths < 0 → return FLAT_ORDER.slice(0, -fifths).includes(step) ? -1 : 0
return 0
```

> C++ equivalent: `AccidentalState::init(keySigEvent)` — initializes per-step accidental defaults.

#### `alterToAccidentalSign()`
**Signature:** `function alterToAccidentalSign(alter: number): AccidentalSign` — `xmlExtractor.ts:718`

```
 1 → 'sharp'
-1 → 'flat'
 0 → 'natural'
 2 → 'double-sharp'
-2 → 'double-flat'
else → alter > 0 ? 'sharp' : 'flat'
```

---

### 3.10 Duration Helpers

#### `durationToType()`
**Signature:** `function durationToType(durationDivisions: number, divisions: number): string` — `xmlExtractor.ts:731`

```
beats = durationDivisions / divisions
if beats >= 4   → 'whole'
if beats >= 2   → 'half'
if beats >= 1   → 'quarter'
if beats >= 0.5 → 'eighth'
if beats >= 0.25 → '16th'
if beats >= 0.125 → '32nd'
else → '64th'
```

> Fallback when `<type>` element is missing from MusicXML. C++ uses `TDuration` enum with exact fraction mapping.

---

### 3.11 Mapping Helpers

#### `mapBarStyle()`
**Signature:** `function mapBarStyle(style: string): BarlineStyle` — `xmlExtractor.ts:747`

| MusicXML `bar-style` | MAP `BarlineStyle` |
|----------------------|-------------------|
| `regular` | `regular` |
| `dotted` | `dotted` |
| `dashed` | `dashed` |
| `heavy` | `final` |
| `light-light` | `double` |
| `light-heavy` | `final` |
| `heavy-light` | `repeat-start` |
| `heavy-heavy` | `heavy-heavy` |
| `none` | `none` |

#### `mapAccidentalText()`
**Signature:** `function mapAccidentalText(text: string): AccidentalSign | undefined` — `xmlExtractor.ts:762`

| MusicXML `<accidental>` | MAP `AccidentalSign` |
|--------------------------|---------------------|
| `sharp` | `sharp` |
| `flat` | `flat` |
| `natural` | `natural` |
| `double-sharp` / `sharp-sharp` | `double-sharp` |
| `flat-flat` / `double-flat` | `double-flat` |
| `natural-sharp` | `sharp` |
| `natural-flat` | `flat` |
| unknown non-empty | `natural` |

#### `mapArticulation()`
**Signature:** `function mapArticulation(tagName: string): ArticulationMark | undefined` — `xmlExtractor.ts:777`

Maps MusicXML `<articulations>` child tags: `staccato`, `staccatissimo`, `tenuto`, `accent`, `strong-accent`, `stress`, `unstress`, `snap-pizzicato`, `fermata`.

#### `mapOrnament()`
**Signature:** `function mapOrnament(tagName: string): OrnamentMark | undefined` — `xmlExtractor.ts:792`

Maps MusicXML `<ornaments>` child tags: `trill-mark`, `turn`, `inverted-turn`, `mordent`, `inverted-mordent`, `tremolo`, `wavy-line`.

#### `kindToDisplay()`
**Signature:** `function kindToDisplay(kind: string): string` — `xmlExtractor.ts:806`

Maps MusicXML `<kind>` values to display strings (29 entries):

| Kind | Display | Kind | Display |
|------|---------|------|---------|
| `major` | `` | `minor` | `m` |
| `dominant` | `7` | `major-seventh` | `maj7` |
| `minor-seventh` | `m7` | `diminished` | `dim` |
| `diminished-seventh` | `dim7` | `augmented` | `aug` |
| `augmented-seventh` | `aug7` | `half-diminished` | `ø7` |
| `major-minor` | `mMaj7` | `major-sixth` | `6` |
| `minor-sixth` | `m6` | `dominant-ninth` | `9` |
| `major-ninth` | `maj9` | `minor-ninth` | `m9` |
| `dominant-11th` | `11` | `major-11th` | `maj11` |
| `minor-11th` | `m11` | `dominant-13th` | `13` |
| `major-13th` | `maj13` | `minor-13th` | `m13` |
| `suspended-second` | `sus2` | `suspended-fourth` | `sus4` |
| `Neapolitan` | `N` | `Italian` | `It` |
| `French` | `Fr` | `German` | `Ger` |
| `pedal` | `ped` | `power` | `5` |
| `Tristan` | `Tristan` | `other` / `none` | `` |

---

### 3.12 Data Types (extractorTypes.ts)

> **File:** `src/renderer/extractorTypes.ts` (313 lines)

#### Interfaces

| Interface | Line | Fields | Description |
|-----------|------|--------|-------------|
| `ExtractedScore` | :14 | `metadata`, `parts`, `measures` | Top-level extraction result |
| `ExtractedMetadata` | :21 | `title`, `composer`, `fifths`, `mode`, `beats`, `beatType`, `tempo?`, `tempoText?`, `measureCount`, `staffCount` | Score header |
| `ExtractedPart` | :36 | `id`, `name`, `staffCount` | Part info |
| `ExtractedMeasure` | :46 | `num`, `divisions`, `notes[]`, `harmonies[]`, `dynamics[]`, `directions[]`, `keyChange?`, `timeChange?`, `clefChange?`, `barlineLeft/Right?`, `voltaStart/End?`, `rehearsalMark?`, `tempoText?`, `tempo?` | Complete measure |
| `ExtractedNote` | :85 | 30+ fields — see §3.6 | Full note with all attributes |
| `BeamState` | :173 | `level`, `value` | Per-level beam state |
| `ExtractedHarmony` | :204 | `measureNum`, `beat`, `beatFraction`, `rootStep`, `rootAlter`, `kind`, `kindText`, `label`, `bassStep?`, `bassAlter?` | Chord symbol |
| `ExtractedDynamic` | :225 | `measureNum`, `beat`, `staffIndex`, `placement`, `value` | Dynamic mark |
| `ExtractedDirection` | :252 | `measureNum`, `beat`, `staffIndex`, `placement`, `type`, `text?`, `metronomeUnit?`, `metronomeBpm?`, `wedgeNumber?` | Direction |
| `ExtractedBarline` | :283 | `style`, `location` | Barline |
| `ExtractedVolta` | :293 | `number`, `text`, `openRight` | Volta bracket |
| `ExtractedClef` | :306 | `sign`, `line`, `octaveChange?`, `staffIndex` | Clef |

#### Type Aliases

| Type | Line | Values |
|------|------|--------|
| `AccidentalSign` | :164 | `'sharp'` \| `'flat'` \| `'natural'` \| `'double-sharp'` \| `'double-flat'` |
| `BeamValue` | :171 | `'begin'` \| `'continue'` \| `'end'` \| `'forward hook'` \| `'backward hook'` |
| `ArticulationMark` | :179 | `'staccato'` \| `'staccatissimo'` \| `'tenuto'` \| `'accent'` \| `'strong-accent'` \| `'stress'` \| `'unstress'` \| `'snap-pizzicato'` \| `'fermata'` \| `'fermata-square'` |
| `OrnamentMark` | :191 | `'trill-mark'` \| `'turn'` \| `'inverted-turn'` \| `'mordent'` \| `'inverted-mordent'` \| `'tremolo'` \| `'wavy-line'` |
| `DirectionType` | :238 | `'words'` \| `'metronome'` \| `'wedge-crescendo'` \| `'wedge-decrescendo'` \| `'wedge-stop'` \| `'dashes-start'` \| `'dashes-stop'` \| `'octave-shift-up'` \| `'octave-shift-down'` \| `'octave-shift-stop'` \| `'segno'` \| `'coda'` |
| `BarlineStyle` | :271 | `'regular'` \| `'double'` \| `'final'` \| `'heavy-heavy'` \| `'repeat-start'` \| `'repeat-end'` \| `'repeat-both'` \| `'dashed'` \| `'dotted'` \| `'none'` |
| `ClefSign` | :304 | `'G'` \| `'F'` \| `'C'` \| `'percussion'` \| `'TAB'` |

---

### 3.13 Constants in xmlExtractor

| Constant | Value | Location | Notes |
|----------|-------|----------|-------|
| `STEP_SEMITONES` | `{C:0, D:2, E:4, F:5, G:7, A:9, B:11}` | :694 | MIDI pitch class mapping |
| `SHARP_ORDER` | `['F','C','G','D','A','E','B']` | :706 | Order of sharps in key signatures |
| `FLAT_ORDER` | `['B','E','A','D','G','C','F']` | :707 | Order of flats in key signatures |
| Default tempo | `120` | :106, :203, :287 | Fallback BPM when `<sound tempo>` absent |

---

### 3.14 Delta from C++

| Aspect | C++ (webmscore) | MAP (TypeScript) |
|--------|-----------------|------------------|
| **Import architecture** | 2-pass: `importmusicxmlpass1.cpp` (structure) + `importmusicxmlpass2.cpp` (content) | Single pass: `extractScore()` does everything |
| **XML parser** | `pugixml` (C++ XML library) | Browser `DOMParser` API |
| **Result type** | Mutable `Score` object graph (Measure→Segment→ChordRest→Note) | Flat `ExtractedScore` struct (arrays of records) |
| **Accidental algorithm** | `AccidentalState` class with `init()` + per-step tracking | Same algorithm reimplemented: per-staff, per-pitchKey Map (:359-376) |
| **Note ID** | Internal sequential IDs, ephemeral | Stable noteMap ID: `note-m{M}b{beat*100}-{step}{octave}` |
| **Beaming** | Created as `Beam` objects linking multiple `Chord`s | Extracted as `BeamState[]` per note (level + begin/continue/end) |
| **Tuplets** | `Tuplet` object linked to `ChordRest` children | Flat: `tupletId` string shared by all notes in group |
| **Ties/Slurs** | `Tie`/`Slur` spanner objects with endpoints | Boolean flags: `tieStart`/`tieStop`, `slurStart`/`slurStop` |
| **Divisions** | `Fraction` (exact rational) for all durations | Float `number` (beat position as decimal) |
| **Multi-part** | Full multi-part with part-of staves | Single-part extraction (all measures from first `<part>`) |
| **Transposing instruments** | `<transpose>` element applied to sounding pitch | Not handled — concert pitch only |
| **Figured bass** | `<figured-bass>` extraction | Not extracted |
| **Lyrics** | `<lyric>` extraction per syllable | Not extracted |
| **Chord diagrams** | `<frame>` guitar chord diagrams | Not extracted |

**Not extracted by MAP (but present in C++ import):**
- Print elements (`<print>`, page/system breaks)
- Encoded repeat signs (D.C., D.S., Fine)
- Sound playback attributes beyond tempo
- Part-specific `<attributes>` (transpose, staves per part)
- Cue notes (extracted as regular notes with `isGrace`)
- Forward/backward repeats as playback markers (only barline style is extracted)

---

## Extraction Summary — Session G

| File | Functions | Constants | Interfaces | Type Aliases | Total Items |
|------|-----------|-----------|------------|--------------|-------------|
| `StyleDef.ts` | 3 | 3 (+ Sid object with ~40 keys) | 0 | 1 | ~47 |
| `index.ts` | 1 | 0 | 0 | 0 | 1 |
| `LayoutOrchestrator.ts` | 9 | 5 (named) | 1 | 0 | 15 |
| `xmlExtractor.ts` | 15 | 5 (named lookup tables) | 0 | 1 | 21 |
| `extractorTypes.ts` | 0 | 0 | 12 | 7 | 19 |
| **Total** | **28** | **~53** | **13** | **9** | **~103** |

---

# Chapter 4: Measure Layout & Segment Widths

> **Files:** `horizontalLayout.ts` (711 lines), `engine/layout/LayoutMeasure.ts` (191 lines)
> **C++ Ref:** Chapters 3–4 (Measure Processing Pipeline, Segment Width Computation)
> **Session:** H

This chapter documents the horizontal spacing engine: how MAP converts note durations into pixel widths for each measure, following MuseScore's logarithmic duration-stretch formula.

---

## 4.1 Spacing Constants Registry

All constants live in `horizontalLayout.ts` unless noted otherwise. Values are in **staff-spaces** (sp).

### 4.1.1 Note Spacing

| Constant | Value | Line | Source | Description |
|----------|-------|------|--------|-------------|
| `NOTE_BASE_WIDTH_SP` | 1.68 | horizontalLayout.ts:53 | Empirical calibration | Minimum note space (notehead width + min distance). C++ theoretical = 1.78sp (1.18 + 1.2×0.5), but 1.68 matches output better |
| `BAR_NOTE_DIST_SP` | 1.3 | horizontalLayout.ts:56 | Sid::barNoteDistance (styledef.cpp:185) | Barline → first note distance (no accidental) |
| `BAR_ACC_DIST_SP` | 0.65 | horizontalLayout.ts:59 | Empirical | Barline → first note distance (with accidental) |
| `TRAILING_SP` | 1.5 | horizontalLayout.ts:62 | Sid::noteBarDistance (styledef.cpp:186) | Trailing space at measure end before barline |
| `MIN_MEASURE_WIDTH_SP` | 2.0 | horizontalLayout.ts:65 | Floor value | Minimum measure width (prevents tiny measures) |
| `MEASURE_SPACING_SLOPE` | 1.5 | horizontalLayout.ts:526 | Sid::measureSpacing (styledef.cpp:189) | Slope for logarithmic stretch: `pow(1.5, log2(ratio))` |

### 4.1.2 System Header Constants

| Constant | Value | Line | Source | Description |
|----------|-------|------|--------|-------------|
| `CLEF_LEFT_MARGIN_SP` | 0.75 | horizontalLayout.ts:70 | Sid::clefLeftMargin | Padding from opening barline to clef left edge |
| `CLEF_GLYPH_WIDTH_SP` | 2.560 | horizontalLayout.ts:77 | Leland.otf gClef xMax | G-clef glyph right edge |
| `CLEF_KEY_DIST_SP` | 1.0 | horizontalLayout.ts:80 | Sid::clefKeyDistance | Gap: clef right → key-sig start |
| `CLEF_TIMESIG_DIST_SP` | 1.0 | horizontalLayout.ts:83 | Sid::clefTimesigDistance | Gap: clef right → time-sig (when no key sig) |
| `KEY_SHARP_STRIDE_SP` | 1.096 | horizontalLayout.ts:96 | keysig.cpp addLayout() | Per-sharp stride: 0.976 + 0.3 − 0.18 (cutout) |
| `KEY_FLAT_STRIDE_SP` | 1.112 | horizontalLayout.ts:97 | keysig.cpp addLayout() | Per-flat stride: 0.812 + 0.3 (no cutout) |
| `KEY_SHARP_WIDTH_SP` | 0.976 | horizontalLayout.ts:98 | Leland accidentalSharp.xMax | Sharp glyph width |
| `KEY_FLAT_WIDTH_SP` | 0.812 | horizontalLayout.ts:99 | Leland accidentalFlat.xMax | Flat glyph width |
| `KEY_ACC_STRIDE_SP` | 0.812 | horizontalLayout.ts:101 | Deprecated | Legacy: use type-specific strides |
| `KEY_TIMESIG_DIST_SP` | 1.0 | horizontalLayout.ts:104 | Sid::keyTimesigDistance | Gap: key-sig right → time-sig left |
| `TIMESIG_GLYPH_WIDTH_SP` | 1.768 | horizontalLayout.ts:110 | Leland timeSig4 xMax | Time-sig digit width |
| `SYS_HDR_TIMESIG_SP` | 2.0 | horizontalLayout.ts:113 | Sid::systemHeaderTimeSigDistance | Gap: time-sig right → first note |
| `FIRST_SYSTEM_INDENT_SP` | 5.0 | horizontalLayout.ts:167 | Sid::firstSystemIndentationValue (styledef.cpp:449) | First-system indent (system 0 only) |

### 4.1.3 Key Signature Inline Constants (local to `inlineKeySigWidthSp`)

| Constant | Value | Line | Source | Description |
|----------|-------|------|--------|-------------|
| `KEY_NATURAL_WIDTH_SP` | 0.556 | horizontalLayout.ts:139 | Leland accidentalNatural.cutOutSW.x | Natural glyph width |
| `KEY_NATURAL_STRIDE_SP` | 0.956 | horizontalLayout.ts:140 | 0.556 + 0.4 (keysigNaturalDistance) | Per-natural stride |

### 4.1.4 LayoutMeasure.ts Constants

| Constant | Value | Line | Source | Description |
|----------|-------|------|--------|-------------|
| `SPACING_MULTIPLIER` | 1.2 | LayoutMeasure.ts:27 | measure.cpp:4174 | `minNoteSpace = noteHeadWidth + 1.2 × minNoteDistance` |
| `MIN_NOTE_DIST_SP` | 0.5 | LayoutMeasure.ts:33 | Sid::minNoteDistance (styledef.cpp:184) | Via `Sid.minNoteDistance` |
| `MEASURE_SPACING_SLOPE` | 1.5 | LayoutMeasure.ts:40 | Sid::measureSpacing | Same as horizontalLayout.ts:526 (re-declared) |
| `BAR_NOTE_DIST_SP` | 1.3 | LayoutMeasure.ts:46 | Sid::barNoteDistance | Same as horizontalLayout.ts:56 (re-exported) |
| `NOTE_BAR_DIST_SP` | 1.5 | LayoutMeasure.ts:52 | Sid::noteBarDistance (styledef.cpp:186) | Trailing space after last note |
| `noteHeadWidthSp` | 1.18 | LayoutMeasure.ts:152 | 2 × NOTEHEAD_RX_SP | Notehead width (local to `computeSegmentWidths`) |
| `accidentalPaddingSp` | 0.7 | LayoutMeasure.ts:159 | Empirical (~0.45sp width + ~0.25sp clearance) | Accidental extra padding (local) |
| `longNoteThreshold` | 0.25 | LayoutMeasure.ts:82 | segment.cpp:2832 | Sixteenth note in quarter-beat units |
| `maxRatio` | 32.0 | LayoutMeasure.ts:92 | segment.cpp:2839 | Maximum stretch ratio cap |
| `empFactor` | 0.6 | LayoutMeasure.ts:105 | segment.cpp:2847 | Emphasis factor for long-note systems |

---

## 4.2 `keySigWidthSp(fifths)` — Key Signature Width

**Signature:** `export function keySigWidthSp(fifths: number): number` — horizontalLayout.ts:121
**C++ Ref:** Ch 12A §1 — keysig.cpp `addLayout()`
**Input:** `fifths` — key signature (positive=sharps, negative=flats, 0=no key sig)
**Output:** total key-sig width in staff-spaces

**Algorithm:**
```
n = abs(fifths)
if n == 0 → return 0
if fifths > 0 (sharps):
  width = (n-1) × KEY_SHARP_STRIDE_SP + KEY_SHARP_WIDTH_SP
          = (n-1) × 1.096 + 0.976
if fifths < 0 (flats):
  width = (n-1) × KEY_FLAT_STRIDE_SP + KEY_FLAT_WIDTH_SP
          = (n-1) × 1.112 + 0.812
```

**C++ formula:** `total = (N-1) × stride + symWidth(last)` — last glyph adds only its own width, no trailing gap.

**Delta from C++:** Identical formula. C++ uses SMuFL cutouts per-accidental pair; MAP uses pre-computed stride constants that include the cutout adjustment.

---

## 4.3 `inlineKeySigWidthSp(cancels, newFifths)` — Inline Key Change Width

**Signature:** `export function inlineKeySigWidthSp(cancels: number, newFifths: number): number` — horizontalLayout.ts:138
**C++ Ref:** Ch 12A — keysig.cpp `addLayout()` (naturals + type-switch logic)
**Input:** `cancels` — number of naturals to cancel old key; `newFifths` — new key signature
**Output:** total inline key-change width in staff-spaces

**Algorithm:**
```
if cancels > 0:
  width += (cancels-1) × 0.956 + 0.556          // naturals block
  if newAccCount > 0:
    width += 0.6                                   // type-switch gap
    if newFifths > 0:
      width += KEY_SHARP_WIDTH_SP + (newAccCount-1) × KEY_SHARP_STRIDE_SP
    else:
      width += KEY_FLAT_WIDTH_SP  + (newAccCount-1) × KEY_FLAT_STRIDE_SP
else if newAccCount > 0:
  width += keySigWidthSp(newFifths)
```

**Constants:** Type-switch gap = 0.6sp (C++: gap doubles from 0.3 to ~0.6 when switching accidental type).

---

## 4.4 `computeHorizontalLayout(score, renderOptions?)` — Main Entry Point

**Signature:** `export function computeHorizontalLayout(score: ExtractedScore, renderOptions?: RenderOptions): HorizontalLayout` — horizontalLayout.ts:246
**C++ Ref:** Ch 2 — Layout Orchestration (measure → system → page pipeline)
**Input:** `ExtractedScore` (from xmlExtractor), optional `RenderOptions`
**Output:** `HorizontalLayout` with systems, pages, measures, noteX map

**Algorithm (7 phases):**

```
Phase 1 — Build measure work data:
  for each measure:
    track running key/time state (measureStartState[])
    buildMeasureWork() → MeasureWork (segments, firstNotePad)

Phase 2 — Header width helper:
  computeHeaderWidth(fifths):
    hasFifths? → clefLeftMargin + clefGlyphWidth + clefKeyDist + keySigWidth + keyTimesigDist + timeSigWidth
    no fifths → clefLeftMargin + clefGlyphWidth + clefTimesigDist + timeSigWidth
    NOTE: SYS_HDR_TIMESIG_SP NOT added — firstNotePad provides that gap

Phase 3 — Usable width:
  usableWidth = pageWidth - marginLeft - marginRight
  firstSystemUsableWidth = usableWidth - (FIRST_SYSTEM_INDENT_SP × sp)

Phase 4 — Initial global stretch:
  applySystemStretch(ALL measures, workData, sp)  // global min duration

Phase 5 — Greedy system breaking:
  greedyBreak(workData, usableWidth, headerWidth, firstSystemUsableWidth)

Phase 6 — Rough page breaking:
  sysH = (4 + systemSpacingSp) × sp
  maxSysPerPage = floor(usablePageH / sysH)

Phase 7 — Assign systems, pages, note x-positions:
  for each system:
    re-apply stretch (per-system min duration)
    compute per-system headerWidth (key-dependent)
    first system: x = marginLeft + indent, smaller usable width
    placeSystem() → spring model distribution + note x coordinates
  collect pages by maxSysPerPage
```

**Call graph:**
```
computeHorizontalLayout()
  ├── buildMeasureWork()      [per measure]
  │     └── snapBeat()
  ├── computeHeaderWidth()    [closure]
  │     └── keySigWidthSp()
  ├── applySystemStretch()    [global, then per-system]
  │     └── computeStretch()
  ├── greedyBreak()
  └── placeSystem()           [per system]
        └── snapBeat()
```

---

## 4.5 `buildMeasureWork(measure, beatsPerMeasure, sp, prevFifths, hasTimeChange)` — Measure Work Data

**Signature:** `function buildMeasureWork(measure, beatsPerMeasure, sp, prevFifths?, hasTimeChange?): MeasureWork` — horizontalLayout.ts:402
**C++ Ref:** Ch 3 §6 — `Measure::computeWidth()` initial segment collection

**Algorithm:**
```
1. Collect unique beats from non-grace, non-zero-duration notes → beatSet
2. Sort beats ascending; empty measure → [1]
3. measureEndBeat = 1 + beatsPerMeasure
4. Build SegWork[] — each segment: { beat, duration=nextBeat-beat, hasAccidental }
5. Compute firstNotePad based on:
   - keyChange + timeChange: BAR_NOTE_DIST + totalAcc×KEY_ACC_STRIDE + KEY_TIMESIG_DIST + TIMESIG_WIDTH + SYS_HDR_TIMESIG
   - keyChange only: BAR_NOTE_DIST + totalAcc×KEY_ACC_STRIDE + KEY_TIMESIG_DIST
   - timeChange only: BAR_NOTE_DIST + TIMESIG_WIDTH + SYS_HDR_TIMESIG
   - default: BAR_ACC_DIST (if accidental) or BAR_NOTE_DIST
6. Cancel count: prevFifths>0 → max(0, prevFifths - max(0, newFifths)); analogous for flats
```

**Mutations:** Returns `MeasureWork` with `minWidth=0`, `rawWidth=0` (placeholders — filled by `applySystemStretch`).

---

## 4.6 `applySystemStretch(systemMNums, workData, sp)` — System-Wide Stretch

**Signature:** `function applySystemStretch(systemMNums: number[], workData: MeasureWork[], sp: number): void` — horizontalLayout.ts:485
**C++ Ref:** Ch 5 §1 — `collectSystem()` passes minSysTicks/maxSysTicks to `computeWidth()`

**Algorithm:**
```
1. Find globalMinDuration across ALL segments in system measures
   fallback: 0.125 (32nd note)
   cap: min(globalMinDuration, 0.25)    // ≤ quarter note prevents over-stretching
2. For each measure's segments:
   seg.stretch   = computeStretch(seg.duration, globalMinDuration)
   seg.baseWidth = seg.stretch × NOTE_BASE_WIDTH_SP × sp
   if NEXT segment has accidental:
     seg.baseWidth += 0.7 × sp          // extra room for accidental
3. md.totalBaseNoteWidth = sum(seg.baseWidth)
4. md.rawWidth = firstNotePad + totalBaseNoteWidth + TRAILING_SP × sp
5. md.minWidth = max(rawWidth, MIN_MEASURE_WIDTH_SP × sp)
```

**Mutations:** Modifies `workData[].segments[].stretch`, `.baseWidth`, and `workData[].totalBaseNoteWidth`, `.rawWidth`, `.minWidth` in-place.

**Delta from C++:** C++ computes stretch per-system with minSysTicks/maxSysTicks passed through the call chain. MAP does an initial global stretch (Phase 4), then re-applies per-system (Phase 7) — the per-system run is the authoritative one.

---

## 4.7 `computeStretch(duration, minDuration)` — Duration Stretch (Simplified)

**Signature:** `function computeStretch(duration: number, minDuration: number): number` — horizontalLayout.ts:545
**C++ Ref:** Ch 4 §3 — `Segment::computeDurationStretch()` (segment.cpp:2812)

**Algorithm:**
```
if minDuration ≤ 0 OR duration ≤ minDuration + 1e-9 → return 1.0
ratio = min(duration / minDuration, 32.0)
return pow(1.5, log2(ratio))
```

**Delta from C++:** Simplified — omits empFactor and the HACK for minTicks < sixteenth. These were tested and made pixel comparisons worse due to unit system differences (quarter-beat vs Ticks).

---

## 4.8 `computeDurationStretch(durationQb, minDurationQb, maxDurationQb)` — Full C++ Formula

**Signature:** `export function computeDurationStretch(durationQb: number, minDurationQb: number, maxDurationQb?: number): number` — LayoutMeasure.ts:71
**C++ Ref:** Ch 4 §3 — segment.cpp:2812 `Segment::computeDurationStretch()`

**Algorithm (full C++ port):**
```
if minDurationQb ≤ 0 → return 1.0
dMin = minDurationQb
dMax = maxDurationQb

// HACK: segment.cpp:2832-2834
if dMax/dMin ≥ 2.0 AND dMin < 0.25 (sixteenth):
  dMin *= 2.0

ratio = durationQb / dMin
if ratio ≤ 1.0 + 1e-9 → ratio = 1.0

// Cap for extreme ranges: segment.cpp:2839-2842
maxRatio = 32.0
maxSysRatio = dMax / dMin
if maxSysRatio > 32.0:
  A = dMin×(32-1) / (dMax-dMin)
  B = (dMax - 32×dMin) / (dMax-dMin)
  ratio = A×ratio + B

str = ratio ≤ 1.0 ? 1.0 : pow(1.5, log2(ratio))

// empFactor: segment.cpp:2847-2848
if dMin > 0.25:
  empFactor = 0.6
  str *= (1 - 0.6 + 0.6 × sqrt(dMin / 0.25))

return str
```

**Constants:** `longNoteThreshold=0.25` (sixteenth note in qb), `maxRatio=32.0`, `empFactor=0.6`.

**Delta from C++:** Direct port. Uses quarter-beat units instead of Ticks, but the formulas are equivalent since they're ratio-based.

---

## 4.9 `computeSegmentWidths(segments, minSysDurQb, sp, maxSysDurQb)` — Segment Width Array

**Signature:** `export function computeSegmentWidths(segments: MeasureSegment[], minSysDurQb: number, sp: number, maxSysDurQb?: number): number[]` — LayoutMeasure.ts:146
**C++ Ref:** Ch 4 §2 — measure.cpp:4174-4221 core of `computeWidth()`

**Algorithm:**
```
noteHeadWidthSp = 1.18                              // 2 × NOTEHEAD_RX_SP
minNoteSpaceSp = 1.18 + 1.2 × 0.5 = 1.78           // noteHeadWidth + SPACING_MULTIPLIER × MIN_NOTE_DIST_SP
accidentalPaddingSp = 0.7

for each segment:
  stretch = computeDurationStretch(seg.durationQb, minSysDurQb, maxSysDurQb)
  minWidthSp = minNoteSpaceSp × stretch
  if seg.hasAccidental:
    minWidthSp += 0.7                                // accidentalPaddingSp
  segmentWidth = minWidthSp × sp
```

**C++ equivalent:** `max(w, minNoteSpace × durStretch × usrStretch × stretchCoeff)` — MAP sets `usrStretch=1.0`, `stretchCoeff=1.0` (handled by system justification).

---

## 4.10 `computeMeasureWidth(firstNotePadPx, segmentWidths, sp)` — Total Measure Width

**Signature:** `export function computeMeasureWidth(firstNotePadPx: number, segmentWidths: number[], sp: number): number` — LayoutMeasure.ts:182
**C++ Ref:** Ch 4 §1 — measure.cpp:4165-4362

**Algorithm:**
```
totalNoteArea = sum(segmentWidths)
trailingSp = NOTE_BAR_DIST_SP × sp       // 1.5 × sp
return firstNotePadPx + totalNoteArea + trailingSp
```

---

## 4.11 `snapBeat(beat)` — Float Noise Suppression

**Signature:** `function snapBeat(beat: number): number` — horizontalLayout.ts:552

**Algorithm:** `Math.round(beat × 1000) / 1000` — snaps to 3 decimal places.

**Delta from C++:** C++ uses `Fraction` (exact rational arithmetic). MAP uses float beats — `snapBeat` compensates for float noise (e.g., 2.9999999 → 3.000).

---

## 4.12 `greedyBreak(workData, usableWidth, headerWidth, firstSystemWidth)` — Simple System Breaking

**Signature:** `function greedyBreak(workData: MeasureWork[], usableWidth: number, headerWidth: number, firstSystemWidth: number): number[][]` — horizontalLayout.ts:560
**C++ Ref:** Ch 5 §1 — `LayoutSystem::collectSystem()` (simplified)

**Algorithm:**
```
for each measure:
  maxW = (system 0) ? firstSystemWidth : usableWidth
  if current.length > 0 AND currentWidth + rawWidth > maxW:
    close system, start new one
  else:
    add to current system
```

**Delta from C++:** No squeeze tolerance (no `SQUEEZABILITY × squeezableSpace`). Uses `rawWidth` (actual spacing) not `minWidth` (clamped) — `minWidth` enforced later in `placeSystem`. The full squeeze-aware algorithm is in `LayoutSystem.ts` (Chapter 5).

---

## 4.13 `placeSystem(...)` — Spring Model Width Distribution

**Signature:** `function placeSystem(system, mNums, workData, extMeasures, usableWidth, headerWidth, opts, measureMap, noteXMap): void` — horizontalLayout.ts:594
**C++ Ref:** Ch 4 §6 — segment.cpp:2785 `stretchSegmentsToWidth()` + Ch 5 §3 — `justifySystem()`

**Algorithm:**
```
1. Compute slack = usableWidth - headerWidth - totalMinWidth

2. Build springs from all segments across system:
   for each segment:
     springConst = 1 / stretch
     width = baseWidth
     preTension = width × springConst

3. Progressive spring activation (C++: stretchSegmentsToWidth):
   sort springs by preTension ascending
   for each spring (ascending tension):
     inverseSpringConst += 1 / springConst
     accWidth += width
     force = (accWidth + slack) / inverseSpringConst
     if force < next spring's preTension → stop

4. Apply new widths:
   for each spring:
     if force > preTension:
       width = force / springConst = force × stretch

5. Assign page-relative x-coordinates:
   measureX starts at system.x + headerWidth
   for each measure:
     segX = measureX + firstNotePad
     for each segment: x = segX, segX += finalWidth
     finalMeasureWidth = firstNotePad + noteArea + TRAILING_SP×sp
     measureX += finalMeasureWidth

6. Map note IDs to nearest segment x:
   for each non-grace note:
     find closest beat in beatToX map → noteXMap.set(note.id, bestX)
```

**Mutations:** Populates `measureMap` and `noteXMap` (output maps).

**Delta from C++:** C++ uses the identical progressive spring activation algorithm from `Segment::stretchSegmentsToWidth()`. MAP port is faithful — the only difference is spring data comes from `MeasureWork.segments` instead of C++ `Segment` objects.

---

## 4.14 `computeHeaderWidth(fifths)` — System Header Width

**Signature:** `function computeHeaderWidth(fifths: number): number` — horizontalLayout.ts:287 (closure inside `computeHorizontalLayout`)

**Algorithm:**
```
hasFifths = abs(fifths) > 0
kSigWidth = keySigWidthSp(fifths)
gapAfterClef = hasFifths
  ? CLEF_KEY_DIST_SP + kSigWidth + KEY_TIMESIG_DIST_SP
  : CLEF_TIMESIG_DIST_SP
return (CLEF_LEFT_MARGIN_SP + CLEF_GLYPH_WIDTH_SP + gapAfterClef + TIMESIG_GLYPH_WIDTH_SP) × sp
```

**Important:** `SYS_HDR_TIMESIG_SP` is NOT added here — `firstNotePad` (via `BAR_NOTE_DIST_SP`) provides that gap. Including both would double-count ~2sp.

**Verification:** Reference first note at 7.42sp = (0.75 + 2.560 + 1.0 + 1.768) + 1.3 = 7.378sp ≈ 7.42sp ✓

---

## 4.15 Interfaces

### `HorizontalLayout` — horizontalLayout.ts:173
```typescript
interface HorizontalLayout {
  opts:     Required<RenderOptions>
  systems:  HLayoutSystem[]
  pages:    HLayoutPage[]
  measures: Map<number, HLayoutMeasure>    // 1-based measureNum → layout data
  noteX:    Map<string, number>            // noteId → page-relative notehead center x
}
```

### `HLayoutPage` — horizontalLayout.ts:183
```typescript
interface HLayoutPage {
  pageIndex:     number
  systemIndices: number[]
}
```

### `HLayoutSystem` — horizontalLayout.ts:188
```typescript
interface HLayoutSystem {
  systemIndex:     number
  pageIndex:       number
  measureNums:     number[]      // 1-based, in order
  x:               number        // marginLeft (+ indent for sys 0)
  y:               number        // 0; filled by verticalLayout
  width:           number        // usable content width
  headerWidth:     number        // clef + key + time + gap
  currentFifths:   number        // key sig at system start
  currentBeats:    number        // time sig numerator at system start
  currentBeatType: number        // time sig denominator at system start
}
```

### `HLayoutMeasure` — horizontalLayout.ts:204
```typescript
interface HLayoutMeasure {
  measureNum:  number
  systemIndex: number
  x:           number    // page-relative left edge
  width:       number    // final assigned width
  minWidth:    number    // minimum computed width
  segments:    HLayoutSegment[]
}
```

### `HLayoutSegment` — horizontalLayout.ts:213
```typescript
interface HLayoutSegment {
  beat:     number    // 1-based beat position
  duration: number    // in beats
  stretch:  number    // stretch factor (≥ 1.0)
  x:        number    // page-relative notehead x
  width:    number    // final segment width in px
}
```

### `MeasureWork` (internal) — horizontalLayout.ts:225
```typescript
interface MeasureWork {
  num:                number
  segments:           SegWork[]
  minWidth:           number    // max(rawWidth, MIN_MEASURE_WIDTH_SP)
  rawWidth:           number    // actual spacing width (for greedy breaking)
  firstNotePad:       number    // px
  totalBaseNoteWidth: number    // sum of segment baseWidths
}
```

### `SegWork` (internal) — horizontalLayout.ts:234
```typescript
interface SegWork {
  beat:          number
  duration:      number
  stretch:       number
  baseWidth:     number    // px (NOTE_BASE_WIDTH_SP × stretch × sp)
  hasAccidental: boolean
}
```

### `MeasureSegment` — LayoutMeasure.ts:119
```typescript
interface MeasureSegment {
  beat:           number      // 1-based
  durationQb:     number      // quarter-beat units
  hasAccidental?: boolean
}
```

### `Spring` (internal) — horizontalLayout.ts:615
```typescript
interface Spring {
  springConst: number     // 1 / stretch
  width:       number     // stretchable width (px)
  preTension:  number     // width × springConst
  mIdx:        number     // measure index
  sIdx:        number     // segment index
}
```

---

## 4.16 `DEFAULT_RENDER_OPTIONS` — Default Page Geometry

**Location:** horizontalLayout.ts:23
**Type:** `Required<RenderOptions>`

| Field | Value | Source |
|-------|-------|--------|
| `pageWidth` | 2978 | A4: ceil(8.27 × 360) = 2978px |
| `pageHeight` | 4209 | A4: ceil(11.69 × 360) = 4209px |
| `spatium` | 24.8 | 1.75mm × (360/25.4) = 24.8 px/sp |
| `marginTop` | 212.6 | 15mm: (15.0/25.4)×360 = 212.598 |
| `marginBottom` | 212.6 | Same as top |
| `marginLeft` | 212.6 | Same as top |
| `marginRight` | 212.6 | Same as top |
| `staffSpacingSp` | 6.0 | Between staves in grand staff |
| `systemSpacingSp` | 9.5 | Empirical: minSystemDistance 8.5 + page stretch ≈ +1sp |

---

## 4.17 Delta from C++ — Chapter 4

| Aspect | C++ (webmscore) | MAP (TypeScript) | Impact |
|--------|----------------|------------------|--------|
| **Duration units** | Ticks (Fraction, exact rational) | Float quarter-beats | `snapBeat()` compensates; ratio-based formulas unaffected |
| **Stretch formula** | Full: HACK + maxRatio cap + empFactor | `horizontalLayout.ts`: simplified (no HACK/empFactor); `LayoutMeasure.ts`: full port | Two implementations coexist — `horizontalLayout.ts` used by main pipeline |
| **Spring model** | `Segment::stretchSegmentsToWidth()` progressive activation | Faithful port in `placeSystem()` | Equivalent algorithm |
| **System breaking** | Squeeze tolerance (`SQUEEZABILITY × squeezableSpace`) | `greedyBreak()`: none; `collectSystems()`: full squeeze | `greedyBreak` is simpler — `collectSystems` is the full port |
| **Header width** | Computed per-system from actual element widths | Pre-computed from glyph constants per key signature | Verified ≈ match (7.378 vs 7.42sp) |
| **Note spacing** | 1.78sp theoretical (1.18 + 1.2×0.5) | 1.68sp empirical | Calibrated to match output; difference is compensated by other factors |
| **Accidental spacing** | Shape-based collision (`minHorizontalDistance`) | Flat 0.7sp padding on preceding segment | Approximation — works for common cases |
| **Multi-measure rests** | Full MMRest support | Not implemented | No impact on Donna Lee test case |
| **Inline key/time** | Full segment-level spacing with shapes | Width-based approximation (stride × count) | Approximate — accurate for common key sigs |

---

# Chapter 5: System Breaking & Justification

> **File:** `engine/layout/LayoutSystem.ts` (424 lines)
> **C++ Ref:** Chapter 5 (System Collection & Breaking)
> **Session:** H

This chapter documents how MAP collects measures into systems (line breaking) and distributes slack space to justify system widths. Two system-breaking algorithms are provided: a simple greedy one (Chapter 4's `greedyBreak`), and a full incremental one mirroring C++'s `collectSystem()`.

---

## 5.1 Constants

| Constant | Value | Line | Source | Description |
|----------|-------|------|--------|-------------|
| `LAST_SYSTEM_FILL_LIMIT` | 0.3 | LayoutSystem.ts:31 | Sid::lastSystemFillLimit (styledef.cpp:228) | Last system must be ≥ 30% full to justify |
| `PAGE_PRINTABLE_WIDTH_MM` | 180.0 | LayoutSystem.ts:39 | Sid::pagePrintableWidth (styledef.cpp:43) | Printable page width in mm |
| `SQUEEZABILITY` | 0.3 | LayoutSystem.ts:119 | layoutsystem.cpp:98 | Squeeze tolerance: system can overflow by `0.3 × squeezableSpace` |
| `MIN_HORIZ_DIST_SP` | 1.68 | LayoutSystem.ts:127 | measure.cpp:4259 | Absolute minimum note distance (1.18 + 0.5 sp) — floor for squeeze |
| `minMeasureWidthPx` | 8.0 × sp | LayoutSystem.ts:390 | Sid::minMeasureWidth = Spatium(8.0) | Minimum measure width clamp (in `computeSystemSqueezableIncremental`) |

---

## 5.2 `justifySystem(springs, targetWidth, curWidth)` — Spring Model Slack Distribution

**Signature:** `export function justifySystem(springs: SystemSpring[], targetWidth: number, curWidth: number): number[]` — LayoutSystem.ts:81
**C++ Ref:** Ch 5 §3 — layoutsystem.cpp:496-531 `LayoutSystem::justifySystem()`

**Input:** `springs` — per-segment stretch + current width; `targetWidth` — full system width; `curWidth` — current total content width
**Output:** new widths array (one per spring)

**Algorithm:**
```
rest = targetWidth - curWidth
if rest ≤ 0 → return current widths (no stretching needed)

totalStretch = sum(spring.stretch)
if totalStretch ≤ 0 → distribute rest equally

for each spring:
  extra = rest × (spring.stretch / totalStretch)
  newWidth = currentWidth + extra
```

**C++ equivalent:** `Segment::stretchSegmentsToWidth()` — segments with higher stretch get more extra space (proportional to stretch factor).

**Delta from C++:** C++ uses progressive spring activation with preTension ordering (identical to `placeSystem` in Chapter 4). This `justifySystem` is a simplified linear-proportional version. Both converge to the same result when all springs activate.

---

## 5.3 `collectSystems(measureWidths, headerWidth, usableWidth, firstSystemWidth?, measureSqueezable?)` — Greedy System Breaking

**Signature:** `export function collectSystems(measureWidths: Map<number, number>, headerWidth: number, usableWidth: number, firstSystemWidth?: number, measureSqueezable?: Map<number, number>): number[][]` — LayoutSystem.ts:150
**C++ Ref:** Ch 5 §1 — layoutsystem.cpp:62-470 `LayoutSystem::collectSystem()`

**Algorithm:**
```
mNums = sorted keys of measureWidths

for each measure mNum:
  mw = measureWidths[mNum]
  mSqueezable = measureSqueezable?[mNum] ?? 0
  maxW = (first system && firstSystemWidth) ? firstSystemWidth : usableWidth

  if currentSystem is empty:
    always include (first measure of system)
  else:
    // C++: acceptance range includes candidate measure
    tentativeSqueezable = currentSqueezable + mSqueezable
    acceptanceRange = SQUEEZABILITY × tentativeSqueezable

    if currentWidth + mw ≤ maxW + acceptanceRange:
      add to current system
    else:
      start new system
```

**Key detail:** The acceptance range is computed with the **tentative** (candidate-included) squeezable space — matches C++ behavior where the candidate measure is appended before checking the overflow condition.

---

## 5.4 `computeMeasureSqueezable(segmentWidths, sp)` — Per-Measure Squeezable Space

**Signature:** `export function computeMeasureSqueezable(segmentWidths: number[], sp: number): number` — LayoutSystem.ts:212
**C++ Ref:** measure.cpp — `squeezableSpace = minStretchedWidth - minHorizontalDist`

**Algorithm:**
```
minHorizPx = MIN_HORIZ_DIST_SP × sp        // 1.68 × sp
return sum(max(0, segWidth - minHorizPx) for each segment)
```

Each segment's squeezable contribution is the difference between its stretched width and the absolute minimum (notehead + minNoteDistance).

---

## 5.5 `collectSystemsIncremental(...)` — Incremental System Breaking

**Signature:** `export function collectSystemsIncremental(allSegments, firstNotePads, measureMinDurs, measureMaxDurs, headerWidth, usableWidth, sp, firstSystemWidth?): IncrementalSystemResult` — LayoutSystem.ts:253
**C++ Ref:** Ch 5 §1 — layoutsystem.cpp:109-245

This is the **full C++ port** of `collectSystem()`, including incremental recomputation when adding a measure changes the system's min/max durations.

**Algorithm:**
```
for each measure mNum (sorted):
  curMinDur = measureMinDurs[mNum]
  curMaxDur = measureMaxDurs[mNum]

  // Track whether min/max changed
  if curMinDur < minTicks:
    prevMinTicks = minTicks; minTicks = curMinDur; changed = true
  if curMaxDur > maxTicks:
    prevMaxTicks = maxTicks; maxTicks = curMaxDur; changed = true

  // C++: recompute ALL prior measures when min/max changes
  if (minChanged OR maxChanged) AND currentSystem not empty:
    curSysWidth = recomputeSystemWidth()     // recalculates all segment widths

  // Compute current measure width with system min/max
  segWs = computeSegmentWidths(segs, minTicks, sp, maxTicks)
  ww = computeMeasureWidth(pad, segWs, sp)

  if currentSystem is empty:
    always include
  else:
    tentativeSqueezable = computeSystemSqueezableIncremental(
      [...currentSystem, mNum], allSegments, firstNotePads, minTicks, maxTicks, sp)
    acceptanceRange = SQUEEZABILITY × tentativeSqueezable
    doBreak = (curSysWidth + ww) > maxW + acceptanceRange

    if doBreak:
      // Restore min/max if the candidate caused the change
      if minChanged: minTicks = prevMinTicks
      if maxChanged: maxTicks = prevMaxTicks
      recompute with restored values
      finalize current system → systemGroups.push()
      start new system with this measure alone
    else:
      add to current system
```

**Key insight:** When a line break is forced AND the candidate measure was the one that changed min/max, the min/max are **rolled back** to their previous values and the entire system is recomputed. This ensures the final system widths are consistent.

**Call graph:**
```
collectSystemsIncremental()
  ├── recomputeSystemWidth()          [closure]
  │     ├── computeSegmentWidthsLocal()
  │     └── computeMeasureWidthLocal()
  ├── computeSegmentWidthsLocal()     [per candidate measure]
  ├── computeMeasureWidthLocal()      [per candidate measure]
  └── computeSystemSqueezableIncremental()
        ├── computeSegmentWidthsLocal()
        └── computeMeasureWidthLocal()
```

---

## 5.6 `computeSystemSqueezableIncremental(mNums, allSegments, firstNotePads, minDur, maxDur, sp)` — System-Level Squeezable

**Signature:** `function computeSystemSqueezableIncremental(mNums, allSegments, firstNotePads, minDur, maxDur, sp): number` — LayoutSystem.ts:380
**C++ Ref:** measure.cpp:4220 + measure.cpp:4307

**Algorithm:**
```
minHorizPx = 1.68 × sp
minMeasureWidthPx = 8.0 × sp

for each measure:
  segWs = computeSegmentWidths(segs, minDur, sp, maxDur)
  mSqueezable = sum(max(0, w - minHorizPx) for each segment)
  mWidth = computeMeasureWidth(pad, segWs, sp)
  // C++: clamp to measureWidth - minMeasureWidth
  mSqueezable = max(0, min(mSqueezable, mWidth - minMeasureWidthPx))
  total += mSqueezable
```

**Delta from C++:** Adds the `min(squeezable, mWidth - minMeasureWidth)` clamp from measure.cpp:4307, which `computeMeasureSqueezable` (§5.4) does not include.

---

## 5.7 `shouldJustifyLastSystem(curWidth, targetWidth)` — Last System Fill Check

**Signature:** `export function shouldJustifyLastSystem(curWidth: number, targetWidth: number): boolean` — LayoutSystem.ts:421
**C++ Ref:** Ch 5 §3 — layoutsystem.cpp:428-431

**Algorithm:**
```
if targetWidth ≤ 0 → return false
return (curWidth / targetWidth) ≥ LAST_SYSTEM_FILL_LIMIT    // ≥ 0.3
```

If the last system is less than 30% full, it is NOT justified (stretched). This prevents overly sparse last systems.

---

## 5.8 Interfaces

### `SystemSpring` — LayoutSystem.ts:49
```typescript
interface SystemSpring {
  stretch:      number    // from computeDurationStretch
  currentWidth: number    // current segment width in px
}
```

### `IncrementalSystemResult` — LayoutSystem.ts:225
```typescript
interface IncrementalSystemResult {
  systemGroups:  number[][]    // array of measure-number arrays
  systemMinDurs: number[]      // per-system final minDur (qb)
  systemMaxDurs: number[]      // per-system final maxDur (qb)
}
```

---

## 5.9 Delta from C++ — Chapter 5

| Aspect | C++ (webmscore) | MAP (TypeScript) | Impact |
|--------|----------------|------------------|--------|
| **System breaking** | Single `collectSystem()` with incremental min/max tracking | Two versions: `collectSystems()` (simple) + `collectSystemsIncremental()` (full port) | Incremental version is faithful to C++ |
| **Justification** | Progressive spring activation in `stretchSegmentsToWidth()` | `justifySystem()`: linear proportional; `placeSystem()` (Ch 4): progressive | Two implementations — `placeSystem` is the C++ match |
| **Squeeze tolerance** | `SQUEEZABILITY × squeezableSpace` in overflow check | Implemented in both `collectSystems` and `collectSystemsIncremental` | Faithful port |
| **Squeezable clamp** | `min(squeezable, measureWidth - minMeasureWidth)` | `computeSystemSqueezableIncremental`: yes; `computeMeasureSqueezable`: no | Simple version may over-squeeze narrow measures |
| **Min/max rollback** | Restores min/maxSysTicks on line break if candidate caused change | Implemented in `collectSystemsIncremental` | Faithful port |
| **Layout elements** | `layoutSystemElements()` — beams, ties, tuplets, lyrics, harmonies | Not in system breaker — done in separate layout stages | Different architecture |
| **Empty staff hiding** | `hideEmptyStaves()` removes staves with no content | Not implemented | Single-staff scores unaffected |
| **Cross-staff beams** | `updateCrossBeams()` after system layout | Not implemented | No cross-staff support yet |

---

# Chapter 6: Page Layout & Vertical Distribution

> **File:** `engine/layout/LayoutPage.ts` (323 lines)
> **C++ Ref:** Chapter 9 (Page Layout & System Stacking)
> **Session:** H

This chapter documents how MAP distributes systems vertically across pages and positions staves within systems. The C++ original uses Skyline collision detection and VerticalGapData for iterative gap distribution; MAP uses a simplified spring model.

---

## 6.1 Constants

| Constant | Value | Line | Source | Description |
|----------|-------|------|--------|-------------|
| `STAFF_UPPER_BORDER_SP` | 7.0 | LayoutPage.ts:26 | Sid::staffUpperBorder (styledef.cpp:52) | Top of page → first staff top |
| `STAFF_LOWER_BORDER_SP` | 7.0 | LayoutPage.ts:33 | Sid::staffLowerBorder (styledef.cpp:53) | Last staff bottom → page bottom |
| `MAX_SYSTEM_DISTANCE_SP` | 15.0 | LayoutPage.ts:40 | Sid::maxSystemDistance (styledef.cpp:59) | Maximum inter-system distance cap |
| `MAX_STAFF_SPREAD_SP` | 20.0 | LayoutPage.ts:47 | Sid::maxStaffSpread (styledef.cpp:69) | Maximum intra-system staff spread |
| `MAX_SYSTEM_SPREAD_SP` | 32.0 | LayoutPage.ts:54 | Sid::maxSystemSpread (styledef.cpp:67) | Maximum system-to-system spread |
| `SPREAD_SYSTEM` | 2.5 | LayoutPage.ts:61 | Sid::spreadSystem (styledef.cpp:63) | Growth factor between bracket sections |
| `MIN_SYSTEM_DISTANCE_SP` | 8.5 | LayoutPage.ts:68 | Sid::minSystemDistance (styledef.cpp:58) | Minimum system distance (bottom → top of next) |

---

## 6.2 `collectPages(systems, pageHeightPx, topMarginPx, sp)` — Greedy Page Collection

**Signature:** `export function collectPages(systems: SystemLayout[], pageHeightPx: number, topMarginPx: number, sp: number): number[][]` — LayoutPage.ts:108
**C++ Ref:** Ch 9 §2 — layoutpage.cpp:103-249 `LayoutPage::collectPage()`

**Input:** `systems` — ordered array with height + min-distance data; page dimensions
**Output:** array of pages, each containing system indices

**Algorithm:**
```
upperBorder = STAFF_UPPER_BORDER_SP × sp        // 7.0 × sp
lowerBorder = STAFF_LOWER_BORDER_SP × sp        // 7.0 × sp
usableHeight = pageHeightPx - topMarginPx - lowerBorder

y = upperBorder

for each system:
  if currentPage is empty:
    always place (first system on page)
    y += sys.minHeightPx
  else:
    nextY = y + sys.minDistanceToNextPx + sys.minHeightPx
    if nextY ≤ usableHeight:
      add to current page
      y += sys.minDistanceToNextPx + sys.minHeightPx
    else:
      start new page
      y = upperBorder + sys.minHeightPx
```

**Delta from C++:** C++ checks system breaks, vboxes, spacers, and uses Skyline-based `System::minDistance()` for actual bottom-to-top collision distance. MAP uses pre-computed `minDistanceToNextPx` (typically `MIN_SYSTEM_DISTANCE_SP × sp`).

---

## 6.3 `layoutPageSystems(systems, pageUsableHeight, topMarginPx, sp)` — Vertical Justification

**Signature:** `export function layoutPageSystems(systems: SystemLayout[], pageUsableHeight: number, topMarginPx: number, sp: number): SystemPlacement[]` — LayoutPage.ts:176
**C++ Ref:** Ch 9 §3 — layoutpage.cpp:361-476 `LayoutPage::layoutPage()` + §5 — `distributeStaves()`

**Input:** systems on a single page with height/distance data; page dimensions
**Output:** `SystemPlacement[]` — final Y positions for each system

**Algorithm (3 phases):**

```
Phase 1 — Initial packed placement:
  y = upperBorder (7.0 × sp)
  for each system:
    placement.yPx = y
    y += sys.minHeightPx
    y += nextSystem.minDistanceToNextPx  (if not last)
  totalContent = y
  restHeight = pageUsableHeight - lowerBorder - totalContent

Phase 2 — Normalize upward (C++: layoutpage.cpp:424-449):
  Build gap distances: gapDists[i] = systems[i].minDistanceToNextPx
  Sort gaps by distance (shortest first)

  for k from 1 to N-1:
    fill = sortedGap[k].distance - sortedGap[k-1].distance
    totalFill = fill × k        // fill all shorter gaps to match this one
    if totalFill > remaining:
      partialFill = remaining / k
      apply partialFill to all shorter gaps
      remaining = 0; break
    else:
      apply fill to all shorter gaps
      remaining -= totalFill

Phase 3 — Equal distribution (C++: layoutpage.cpp:451-459):
  if remaining > 0:
    equalShare = remaining / gapCount
    for each gap:
      maxAdd = MAX_SYSTEM_DISTANCE_SP×sp - (gapDist + adjustment)
      adjustment += min(equalShare, max(0, maxAdd))

Apply adjustments:
  offset = 0
  for each system:
    yPx = upperBorder + offset
    offset += minHeight + gapDist + adjustment
```

**Key detail:** Phase 2 normalizes shorter gaps to match longer ones before distributing equally. This prevents the shortest gap from getting disproportionately more space.

---

## 6.4 `layoutStaves(staffCount, staffHeightPx, sp)` — Intra-System Staff Positions

**Signature:** `export function layoutStaves(staffCount: number, staffHeightPx: number, sp: number): number[]` — LayoutPage.ts:291
**C++ Ref:** Ch 9 §6 — system.cpp `System::layout2()` (vertical staff positioning)

**Algorithm:**
```
staffDistPx = Sid.staffDistance × sp     // 6.5 × sp
positions = []
y = 0
for i from 0 to staffCount-1:
  positions.push(y)
  y += staffHeightPx + staffDistPx
```

**Constants:** `Sid.staffDistance = 6.5` (styledef.cpp:55). Same value for both `staffDistance` (different parts) and `akkoladeDistance` (same part) — MAP treats all staves the same.

**Delta from C++:** C++ distinguishes `staffDistance` from `akkoladeDistance` and uses Skyline collision for actual inter-staff distances. MAP uses a fixed distance regardless of content.

---

## 6.5 `systemHeight(staffCount, staffHeightPx, sp)` — Total System Height

**Signature:** `export function systemHeight(staffCount: number, staffHeightPx: number, sp: number): number` — LayoutPage.ts:315

**Algorithm:**
```
if staffCount ≤ 0 → return 0
staffDistPx = Sid.staffDistance × sp     // 6.5 × sp
return staffCount × staffHeightPx + (staffCount - 1) × staffDistPx
```

For single-staff: `systemHeight = staffHeightPx = 4 × lineSpacing = 4sp` (standard 5-line staff has 4 gaps).
For 2 staves (grand staff): `2 × staffHeightPx + 6.5 × sp`.

---

## 6.6 Interfaces

### `SystemLayout` — LayoutPage.ts:74
```typescript
interface SystemLayout {
  index:               number    // 0-based system index
  minHeightPx:         number    // staff lines + stems + staves
  minDistanceToNextPx: number    // bottom of this → top of next
}
```

### `SystemPlacement` — LayoutPage.ts:83
```typescript
interface SystemPlacement {
  index: number    // matching input system index
  yPx:   number    // Y position of system top (from page top)
}
```

---

## 6.7 Delta from C++ — Chapter 6

| Aspect | C++ (webmscore) | MAP (TypeScript) | Impact |
|--------|----------------|------------------|--------|
| **Page collection** | Skyline-based `System::minDistance()` for actual collision distance | Pre-computed `minDistanceToNextPx` (fixed constant) | Adequate for single-staff; would need Skyline for complex multi-staff |
| **Vertical justification** | `VerticalGapData` iterative (3-phase, maxPasses=20) with staff/system gap classification | Simplified 3-phase: pack → normalize → equal distribute | Visually acceptable; no adaptive per-gap-type stretching |
| **Skyline collision** | Full SkylineLine sweep for inter-system and inter-staff distances | Not used — fixed distances | Stems/dynamics may overlap in multi-staff scores |
| **Staff spacing** | `staffDistance` vs `akkoladeDistance` + Skyline collision | Fixed `staffDistance = 6.5sp` for all staves | Correct for single-part; wrong for different instruments |
| **Vboxes** | Vertical frames (`VBox`) between systems | Not implemented | No impact on standard scores |
| **Spacers** | `SpacerUp`/`SpacerDown` for per-system manual spacing | Not implemented | No user-adjustable spacing |
| **System dividers** | `checkDivider()` for left/right divider symbols | Not implemented | Visual-only; no impact on positioning |
| **Cross-staff beams/tuplets** | Post-layout recalculation in `collectPage()` | Not implemented | No cross-staff support |
| **Max distance cap** | `MAX_SYSTEM_DISTANCE_SP = 15.0sp` | Implemented in `layoutPageSystems` Phase 3 | Faithful port |
| **Max spread constants** | `MAX_STAFF_SPREAD_SP=20.0`, `MAX_SYSTEM_SPREAD_SP=32.0`, `SPREAD_SYSTEM=2.5` | Exported but not used in current algorithms | Available for future VerticalGapData port |

---

## Extraction Summary — Session H

| File | Functions | Constants (named) | Interfaces | Total Items |
|------|-----------|-------------------|------------|-------------|
| `horizontalLayout.ts` | 10 (3 exported + 7 internal) | 32 (15 exported + 17 local/internal) | 8 (5 exported + 3 internal) | 50 |
| `LayoutMeasure.ts` | 3 (all exported) | 10 (3 exported + 7 local) | 1 (exported) | 14 |
| `LayoutSystem.ts` | 7 (5 exported + 2 internal) | 9 (3 exported + 6 local) | 2 (exported) | 18 |
| `LayoutPage.ts` | 4 (all exported) | 7 (exported via Sid) + 4 local | 2 (exported) | 17 |
| **Total** | **24** | **~62** | **13** | **~99** |

---

# Chapter 7: Note & Chord Positioning

> **Files:** `engine/libmscore/Note.ts` (186 lines), `chordLayout.ts` (315 lines), `engine/layout/LayoutChords.ts` (202 lines)
> **C++ Ref:** פרק 6 — Chord & Note Positioning (layoutchords.cpp, chord.cpp, note.cpp)

---

## 7.1 Constants — Note Geometry

### `NOTEHEAD_RX_SP` — Note.ts:25
```typescript
export const NOTEHEAD_RX_SP = 0.59
```
Notehead half-width in staff-spaces.
**C++ Ref:** note.cpp:1088 — `symWidth(noteHead())`. Leland noteheadBlack advance ≈ 1.18sp → half = 0.59sp.

### `NOTEHEAD_RY_SP` — Note.ts:32
```typescript
export const NOTEHEAD_RY_SP = 0.36
```
Notehead half-height in staff-spaces.
**C++ Ref:** note.cpp:1138 — `symHeight(noteHead())`. Leland noteheadBlack height ≈ 0.72sp → half = 0.36sp.

### `DOT_NOTE_DIST_SP` — Note.ts:39
```typescript
export const DOT_NOTE_DIST_SP: number = Sid.dotNoteDistance   // 0.5
```
Notehead right edge → first augmentation dot.
**C++ Ref:** note.cpp:2343 — `score()->point(score()->styleS(Sid::dotNoteDistance))`. styledef.cpp:216 → `Spatium(0.5)`.

### `DOT_DOT_DIST_SP` — Note.ts:46
```typescript
export const DOT_DOT_DIST_SP: number = Sid.dotDotDistance     // 0.65
```
Center-to-center distance between consecutive augmentation dots.
**C++ Ref:** note.cpp:2344 — `dd = score()->point(score()->styleS(Sid::dotDotDistance))`. styledef.cpp:218 → `Spatium(0.65)`.

### `CLEF_OFFSET` — Note.ts:70–76
```typescript
const CLEF_OFFSET: Record<string, number> = {
  treble:     38,   // G4 on line 2 → C4 at line 10
  bass:       26,   // F3 on line 6 → C4 at line -2
  alto:       32,   // C4 at line 4 (middle)
  tenor:      30,   // C4 at line 6
  percussion: 38,
}
```
Staff-line value of middle C (C4) per clef type.
**C++ Ref:** note.cpp via `Pitch::line()` — `line = offset - (diatonic + octave * 7)`. Offset varies per `ClefInfo`.

### `STEP_TO_DIATONIC` — Note.ts:78–80
```typescript
const STEP_TO_DIATONIC: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
}
```
Maps MusicXML pitch step to diatonic number (0–6).

---

## 7.2 Constants — Accidental Layout

### `ACC_NOTE_GAP_SP` — atomicElements.ts:83 (imported by chordLayout.ts)
```typescript
export const ACC_NOTE_GAP_SP = 0.25    // Sid::accidentalNoteDistance
```
Gap from accidental right edge to notehead left edge.
**C++ Ref:** layoutchords.cpp:1033 — `pnd = style.styleMM(Sid::accidentalNoteDistance)`. styledef.cpp:203 → `Spatium(0.25)`.

### `ACC_ACC_GAP_SP` — atomicElements.ts:90 (imported by chordLayout.ts)
```typescript
export const ACC_ACC_GAP_SP = 0.22     // Sid::accidentalDistance
```
Gap between accidental columns (vertical clearance).
**C++ Ref:** layoutchords.cpp:1032 — `pd = style.styleMM(Sid::accidentalDistance)`. styledef.cpp:202 → `Spatium(0.22)`.

### `ACC_NOTE_DIST_SP` — LayoutChords.ts:31
```typescript
export const ACC_NOTE_DIST_SP: number = Sid.accidentalNoteDistance   // 0.25
```
Same Sid value as `ACC_NOTE_GAP_SP` — duplicate export used by `layoutChords3Accidentals()`.

### `ACC_ACC_DIST_SP` — LayoutChords.ts:38
```typescript
export const ACC_ACC_DIST_SP: number = Sid.accidentalDistance        // 0.22
```
Same Sid value as `ACC_ACC_GAP_SP` — duplicate export used by `layoutChords3Accidentals()`.

### `SPACING_MULTIPLIER` — LayoutChords.ts:44
```typescript
export const SPACING_MULTIPLIER = 1.2
```
Applied to `minNoteDistance` for note spacing computation.
**C++ Ref:** measure.cpp:4174 — `static constexpr double spacingMultiplier = 1.2`.

### `MIN_NOTE_DIST_SP` — LayoutChords.ts:50
```typescript
export const MIN_NOTE_DIST_SP: number = Sid.minNoteDistance          // 0.5
```
Minimum note-to-note distance.
**C++ Ref:** styledef.cpp:184 → `Spatium(0.5)`.

### `ACC_HEIGHTS_SP` — chordLayout.ts:142–151
```typescript
const ACC_HEIGHTS_SP: Record<string, number> = {
  sharp:               2.8,
  flat:                3.2,
  natural:             2.8,
  'double-sharp':      1.4,
  'double-flat':       3.2,
  'courtesy-sharp':    2.8,
  'courtesy-flat':     3.2,
  'courtesy-natural':  2.8,
}
```
Accidental heights in staff-spaces for overlap detection. Derived from Leland glyph bounding boxes.
**C++ Ref:** No direct equivalent — C++ uses live `Accidental::bbox()` from symbol font.

### `ACC_WIDTHS_SP` — chordLayout.ts:154–163
```typescript
const ACC_WIDTHS_SP: Record<string, number> = {
  sharp:               1.0,
  flat:                0.65,
  natural:             0.9,
  'double-sharp':      1.1,
  'double-flat':       1.4,
  'courtesy-sharp':    1.0,
  'courtesy-flat':     0.65,
  'courtesy-natural':  0.9,
}
```
Accidental widths in staff-spaces for x-position computation. Derived from Leland glyph advances.
**C++ Ref:** No direct equivalent — C++ uses live `Accidental::width()`.

---

## 7.3 `pitchToStaffLine()` — Note.ts:82

**Signature:** `export function pitchToStaffLine(step: string, octave: number, clef: string): number`

**C++ Ref:** §6.9 — `Note::layout()` sets `_line` via `Pitch::line()`.

**Algorithm:**
```
diatonic = STEP_TO_DIATONIC[step] ?? 0          // C=0, D=1, ..., B=6
offset   = CLEF_OFFSET[clef] ?? CLEF_OFFSET.treble  // 38 for treble
return offset - (diatonic + octave * 7)
```

**Output:** Staff line number (0 = top, even = on line, odd = in space, negative = above staff, > 8 = below staff).

**Example:** `pitchToStaffLine('E', 5, 'treble')` → `38 - (2 + 5*7)` = `38 - 37` = `1` (first space from top).

---

## 7.4 `noteY()` — Note.ts:102

**Signature:** `export function noteY(staffLine: number, staffTopPx: Px, sp: Px): Px`

**C++ Ref:** note.cpp — `y = line * spatium() * 0.5` (MuseScore uses half-space units).

**Algorithm:**
```
return lineToY(staffLine, staffTopPx, sp)
// = staffTopPx + staffLine * sp * 0.5
```

**Output:** Y position in pixels of the note center (= staff line center).

---

## 7.5 `stemUp()` — Note.ts:123

**Signature:** `export function stemUp(staffLine: number, voice: number, isMultiVoice: boolean): boolean`

**C++ Ref:** §7.1 — `Chord::computeUp()` (chord.cpp:978–1116).

**Algorithm:**
```
if voice === 2: return false            // voice 2 always down
if voice === 1 && isMultiVoice: return true   // voice 1 in multi always up
return staffLine >= 4                   // on/below middle line → stem up
```

**Delta from C++:** MAP implements only 3 rules. C++ has 9-priority chain: TAB, custom direction, UI item, beam membership, multi-voice, grace, cross-staff, small staff, auto direction with `computeAutoStemDirection()` balanced algorithm.

---

## 7.6 `hasStem()` — Note.ts:137

**Signature:** `export function hasStem(type: NoteheadType): boolean`

**Algorithm:**
```
return type !== 'whole' && type !== 'double-whole'
```

**C++ Ref:** chord.cpp:1757 — `Chord::shouldHaveStem()`.

---

## 7.7 `layoutNote()` — Note.ts:169

**Signature:** `export function layoutNote(noteX, step, octave, clef, staffTopPx, sp, voice, isMultiVoice, nhType): NoteLayout`

**C++ Ref:** §6.9 — `Note::layout()` (note.cpp:2257–2329).

**Algorithm:**
```
line = pitchToStaffLine(step, octave, clef)     // §7.3
y    = noteY(line, staffTopPx, sp)              // §7.4
up   = stemUp(line, voice, isMultiVoice)        // §7.5
x    = noteX - NOTEHEAD_RX_SP * sp              // left edge of notehead bbox

return { x, y, staffLine: line, stemUp: up, hasStem: hasStem(nhType) }
```

**Output:** `NoteLayout` — position + stem direction + stem presence.

**Delta from C++:** C++ sets bbox via `symBbox(noteHead())` from live font metrics. MAP uses constant `NOTEHEAD_RX_SP`.

---

## 7.8 `layoutChords1()` — chordLayout.ts:58

**Signature:** `export function layoutChords1(notes: ChordNote[], spatiumPx: Px): void`

**C++ Ref:** §6.1 — `layoutChords1()` (layoutchords.cpp:64–523).

**Algorithm:**
```
Phase 1 — RESET:
  for each note: n.xOffset = 0
  if notes.length <= 1: return

Phase 2 — NOMINAL WIDTH:
  nominalWidthPx = NOTEHEAD_RX_SP * 2 * spatiumPx   // full notehead width

Phase 3 — SEPARATE BY STEM DIRECTION:
  upNotes   = notes.filter(stemUp).sort(staffLine ascending)
  downNotes = notes.filter(!stemUp).sort(staffLine descending)

Phase 4 — SINGLE-VOICE CLUSTER DETECTION:
  detectAndFlipCluster(upNotes, nominalWidthPx, true)      // §7.9
  detectAndFlipCluster(downNotes, nominalWidthPx, false)    // §7.9

Phase 5 — CROSS-DIRECTION CLUSTER:
  if upNotes.length > 0 && downNotes.length > 0:
    upBottom   = max(upNotes staffLines)
    downTop    = min(downNotes staffLines)
    if |upBottom - downTop| <= 1:                           // overlap!
      for each downNote: xOffset += nominalWidthPx          // shift right
```

**Mutations:** `ChordNote.xOffset` is set for each note.

**Delta from C++:** C++ has 7 phases including centering adjustments (`headDiff`, `headDiff2`), 8 conflict sub-cases with precise spacing constants (0.1sp, 0.15sp, 0.2sp, 0.3sp), dot adjustment loop, and grace note recursion. MAP implements a simplified 2-case model (cluster flip + cross-direction shift).

---

## 7.9 `detectAndFlipCluster()` — chordLayout.ts:93

**Signature:** `function detectAndFlipCluster(notes: ChordNote[], nominalWidthPx: Px, stemUp: boolean): void`

**C++ Ref:** §6.2 — `layoutChords2()` (layoutchords.cpp:534–621) — note mirroring.

**Algorithm:**
```
if notes.length < 2: return

flipNext = false
for i = 0 to notes.length - 2:
  interval = |notes[i+1].staffLine - notes[i].staffLine|
  if interval <= 1:                               // unison or 2nd
    if stemUp:
      if !flipNext:
        notes[i].xOffset += nominalWidthPx        // flip higher note right
        flipNext = true
      else:
        flipNext = false                           // alternating pattern
    else:
      if !flipNext:
        notes[i+1].xOffset += nominalWidthPx      // flip lower note right
        flipNext = true
      else:
        flipNext = false
  else:
    flipNext = false
```

**Delta from C++:** C++ `layoutChords2()` uses `mirror` flag per note with user-override (AUTO/LEFT/RIGHT), tracks `lvisible`, `lStaffIdx` for cross-staff, returns `maxWidth`. MAP uses simple alternating flip with `nominalWidthPx` shift.

---

## 7.10 `layoutAccidentals()` — chordLayout.ts:176

**Signature:** `export function layoutAccidentals(notes: ChordNote[]): AccidentalSlot[]`

**C++ Ref:** §6.5 — `layoutChords3()` Phase 1 + Phase 3 (layoutchords.cpp:804–1222).

**Algorithm:**
```
1. FILTER: notesWithAcc = notes with accidental, sorted by staffLine ascending (top→bottom)
   if empty: return []

2. COLUMN TRACKING:
   columns: Array<Array<{top, bot}>> = []     // columns[c] = placed accidentals
   slots: AccidentalSlot[] = []

3. FOR EACH NOTE WITH ACCIDENTAL (top to bottom):
   accType = n.accidental
   heightSp = ACC_HEIGHTS_SP[accType] ?? 2.8
   top = staffLine - heightSp/2
   bot = staffLine + heightSp/2

   // Try rightmost column (smallest index) first:
   for col = 0 to columns.length-1:
     lastItem = columns[col].last
     if top >= lastItem.bot + ACC_ACC_GAP_SP:    // fits without overlap
       columns[col].push({top, bot})
       record slot at column=col
       placed = true; break

   if !placed:
     // New column to the left:
     col = columns.length
     columns.push([{top, bot}])
     record slot at column=col
```

**Output:** Array of `AccidentalSlot` with column assignment (0 = rightmost, increases leftward).

**Delta from C++:** C++ uses a zig-zag octave-column matching algorithm for chords spanning ≥ 7 lines (layoutchords.cpp:1036–1170), `resolveAccidentals()` with descent/ascent overlap detection, ledger line adjustment. MAP uses simple greedy column placement with fixed heights.

---

## 7.11 `accidentalXForColumn()` — chordLayout.ts:240

**Signature:** `export function accidentalXForColumn(noteX, column, accType, maxAccWidthSp, spatiumPx): Px`

**C++ Ref:** §6.4 — `layoutAccidental()` final positioning (layoutchords.cpp:788–794).

**Algorithm:**
```
accWidthSp  = ACC_WIDTHS_SP[accType] ?? 1.0
colStrideSp = maxAccWidthSp + ACC_ACC_GAP_SP          // column-to-column width

rightEdge = noteX
  - NOTEHEAD_RX_SP * spatiumPx                         // notehead left edge
  - ACC_NOTE_GAP_SP * spatiumPx                        // note-to-acc gap
  - column * colStrideSp * spatiumPx                   // skip past earlier columns

return rightEdge - accWidthSp * spatiumPx              // left edge of this accidental
```

**C++ formula:** `x = lx - pnd - accWidth - acc->bbox().x()` with per-accidental conflict resolution. MAP uses uniform column stride.

---

## 7.12 `maxAccWidthSp()` — chordLayout.ts:265

**Signature:** `export function maxAccWidthSp(accTypes: string[]): number`

**Algorithm:**
```
return Math.max(0, ...accTypes.map(t => ACC_WIDTHS_SP[t] ?? 1.0))
```

Returns the widest accidental width in staff-spaces for a set of accidental types.

---

## 7.13 `computeChordBBox()` — chordLayout.ts:288

**Signature:** `export function computeChordBBox(params: {...}): ChordBBox`

**C++ Ref:** §6.7 — `Chord::layoutPitched()` Phase 4 (chord.cpp:2141–2174) — lll/rrr tracking.

**Algorithm:**
```
noteheadLeft  = noteX - NOTEHEAD_RX_SP * spatiumPx
noteheadRight = noteX + NOTEHEAD_RX_SP * spatiumPx

left  = hasAccidentals && accMinX? min(noteheadLeft, accMinX) : noteheadLeft
right = dotsMaxX? max(noteheadRight, dotsMaxX) : noteheadRight
top    = min(stemTopPx, stemBottomPx)
bottom = max(stemTopPx, stemBottomPx)

return { left, right, top, bottom }
```

**Input fields:** `noteX`, `stemXPx`, `stemTopPx`, `stemBottomPx`, `spatiumPx`, `hasAccidentals`, `accMinX?`, `dotsMaxX?`.

**Delta from C++:** C++ accumulates `lll` (left), `rrr` (right), `lhead` across all notes in the chord + arpeggio + hook. MAP takes pre-computed stem bounds and optional acc/dot extents.

---

## 7.14 `layoutChords3Accidentals()` — LayoutChords.ts:97

**Signature:** `export function layoutChords3Accidentals(accs: AccidentalInput[], sp: number): number[]`

**C++ Ref:** §6.5 — `layoutChords3()` (layoutchords.cpp:804–1222).

**Algorithm:**
```
if accs.length === 0: return []

pnd = ACC_NOTE_DIST_SP * sp       // note-to-accidental gap (px)
pd  = ACC_ACC_DIST_SP * sp        // accidental-to-accidental gap (px)

columns: Array<{top, bottom, width}> = []
result: number[] = new Array(accs.length).fill(0)

for each acc (top to bottom):
  accWidthPx  = acc.widthSp * sp
  accTopPx    = acc.topSp * sp
  accBottomPx = acc.bottomSp * sp

  // Try existing columns (rightmost first):
  for col = 0 to columns.length-1:
    colEntry = columns[col]
    if accTopPx - colEntry.bottom >= pd && colEntry.top - accBottomPx >= pd:
      // No vertical conflict → place here
      update colEntry min/max
      xOffset = -pnd - accWidthPx
      for c = 0 to col-1: xOffset -= columns[c].width + pd
      result[i] = xOffset
      placed = true; break

  if !placed:
    // New column further left:
    col = columns.length
    columns.push({top: accTopPx, bottom: accBottomPx, width: accWidthPx})
    xOffset = -pnd - accWidthPx
    for c = 0 to col-1: xOffset -= columns[c].width + pd
    result[i] = xOffset
```

**Output:** Array of x-offsets from notehead left edge (negative = left of note), in pixels.

**C++ formula:** layoutchords.cpp ≈ line 1170+: `x = -pnd - accWidth - (col * (maxAccWidth + pd))`.

**Delta from C++:** Same core algorithm. C++ adds: octave column matching (zig-zag), per-accidental `resolveAccidentals()` with ascent/descent overlap, ledger line clearance, left-note clearance, `Sid::alignAccidentalsLeft` option.

---

## 7.15 `noteNeedsMirror()` — LayoutChords.ts:173

**Signature:** `export function noteNeedsMirror(staffLine, adjacentLine, stemUp): boolean`

**C++ Ref:** §6.2 — `layoutChords2()` (layoutchords.cpp:534–621).

**Algorithm:**
```
interval = |staffLine - adjacentLine|
if interval !== 1: return false            // only seconds need mirroring
return stemUp ? staffLine > adjacentLine   // lower note mirrored for stem-up
              : staffLine < adjacentLine   // upper note mirrored for stem-down
```

---

## 7.16 `dotYAdjust()` — LayoutChords.ts:199

**Signature:** `export function dotYAdjust(staffLine: number, _sp: number): number`

**C++ Ref:** §6.11 — `Note::setDotY()` (note.cpp:2183–2251).

**Algorithm:**
```
return (staffLine % 2 === 0) ? -0.5 : 0   // in staff-spaces
```

Rule: if the note is on a staff line (even staffLine), the augmentation dot shifts up by 0.5sp into the space above.

**Delta from C++:** C++ has voice-based displacement (odd voice → +0.5, even voice → -0.5), explicit UP/DOWN direction override, special TAB handling, and multi-dot collision detection between up/down chords. MAP uses simplified even/odd check only.

---

## 7.17 Types

### `NoteheadType` — Note.ts:133
```typescript
export type NoteheadType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd' | '64th'
  | 'double-whole' | 'x' | 'diamond' | 'slash'
```
**C++ Ref:** note.h — `NoteHeadGroup` enum + `NoteHeadType` enum. MAP collapses both into a single union type.

### `NoteLayout` — Note.ts:145
```typescript
export interface NoteLayout {
  x: Px           // left edge of notehead bbox (noteX - NOTEHEAD_RX_SP * sp)
  y: Px           // center y (= staff line center)
  staffLine: number
  stemUp: boolean
  hasStem: boolean
}
```

### `ChordNote` — chordLayout.ts:24
```typescript
export interface ChordNote {
  staffLine: number           // 0=top, increasing down
  noteX: Px                   // center x before layout adjustment
  stemUp: boolean
  accidental?: string
  xOffset?: Px               // OUTPUT: x offset after layout
  accidentalColumn?: number  // OUTPUT: column (0=rightmost)
}
```

### `AccidentalSlot` — chordLayout.ts:132
```typescript
export interface AccidentalSlot {
  noteIndex: number
  staffLine: number
  accType: string
  top: number      // staffLine - accHeightSp/2
  bot: number      // staffLine + accHeightSp/2
  column: number   // 0 = rightmost, increases leftward
}
```

### `ChordBBox` — chordLayout.ts:273
```typescript
export interface ChordBBox {
  left: Px
  right: Px
  top: Px
  bottom: Px
}
```

### `AccidentalInput` — LayoutChords.ts:56
```typescript
export interface AccidentalInput {
  staffLine: number          // 0=top, 8=bottom, negative/above
  widthSp: number            // glyph width in sp
  topSp: number              // vertical extent top (relative to note y)
  bottomSp: number           // vertical extent bottom
}
```

### `AccidentalXResult` — LayoutChords.ts:66
```typescript
export interface AccidentalXResult {
  xFromNoteSp: number        // x offset from notehead left edge (negative = left)
  column: number             // 0=closest, 1=further left, etc.
}
```

---

## 7.18 Delta from C++ — Chapter 7

| Aspect | C++ (webmscore) | MAP (TypeScript) | Impact |
|--------|----------------|------------------|--------|
| **Stem direction** | 9-priority chain: TAB, custom, UI, beam, multi-voice, grace, cross-staff, small staff, auto | 3 rules: voice 2→down, voice 1+multi→up, staffLine≥4→up | Incorrect for beamed groups, grace notes, cross-staff |
| **Cluster detection** | `layoutChords1()` 7-phase with centering, 8 conflict sub-cases, dot adjustment | Simplified: alternating flip + cross-direction shift | Missing precise spacing (0.1/0.15/0.2/0.3 sp constants) |
| **Note mirroring** | `layoutChords2()` with user override (AUTO/LEFT/RIGHT), cross-staff tracking | Simple interval-1 check | No user mirror override |
| **Accidental placement** | Octave column matching (zig-zag), `resolveAccidentals()` with descent/ascent, ledger adjustment | Greedy column assignment with fixed height/width tables | Good for ≤1 octave; wrong for multi-octave chords |
| **Accidental sizes** | Live glyph bbox from symbol font | Hardcoded `ACC_HEIGHTS_SP`/`ACC_WIDTHS_SP` tables | Correct for Leland; wrong for other fonts |
| **Dot Y** | Voice-based (odd/even), UP/DOWN override, TAB, multi-dot collision | Even staffLine → -0.5sp | Missing voice-based displacement |
| **Chord bbox** | `layoutPitched()` accumulates lll/rrr across all notes + arpeggio + hook | Pre-computed stem bounds + optional acc/dot extents | Adequate for rendering; less precise for collision |
| **Pitch→line** | `Pitch::line()` via `ClefInfo` with 35 clef types | 5 clef offsets (treble, bass, alto, tenor, percussion) | Missing: soprano, mezzo-soprano, baritone, TAB clefs |
| **Notehead geometry** | Live `symBbox(noteHead())` + `symWidth()` from font | Constant `NOTEHEAD_RX_SP=0.59`, `NOTEHEAD_RY_SP=0.36` | Correct for Leland black; wrong for half/whole/special |
| **Grace notes** | Full recursion in `layoutPitched()` + `layoutChords1()` grace handling | Not handled in chord layout | Grace note collisions unresolved |

---

# Chapter 8: Stem & Hook

> **Files:** `engine/libmscore/Stem.ts` (94 lines), `engine/libmscore/Hook.ts` (99 lines)
> **C++ Ref:** פרק 7 — Stem Layout (chord.cpp, stem.cpp, hook.cpp)

---

## 8.1 Constants — Stem

### `STEM_LENGTH_SP` — Stem.ts:21
```typescript
export const STEM_LENGTH_SP: number = Sid.stemLength           // 3.5
```
Default stem length in staff-spaces.
**C++ Ref:** styledef.cpp:177 → `Spatium(3.5)`. chord.cpp:1627 — `defaultStemLength = score()->styleD(Sid::stemLength) * 4` (quarter-spaces = 14 qs).

### `STEM_WIDTH_SP` — Stem.ts:27
```typescript
export const STEM_WIDTH_SP: number = Sid.stemWidth             // 0.10
```
Stem line thickness in staff-spaces.
**C++ Ref:** styledef.cpp:175 → `Spatium(0.10)`.

---

## 8.2 `layoutStem()` — Stem.ts:66

**Signature:** `export function layoutStem(noteX, noteY, stemUp, sp, hasFlag, attachDx, attachDy): StemLayout`

**C++ Ref:** §7.8 — `Chord::calcDefaultStemLength()` (chord.cpp:1612–1729) + §7.10 — `Stem::layout()` (stem.cpp:68–130).

**Input:**
| Param | Type | Meaning |
|-------|------|---------|
| `noteX` | Px | Center x of notehead |
| `noteY` | Px | Center y of notehead |
| `stemUp` | boolean | True = stem points upward |
| `sp` | Px | Spatium in pixels |
| `hasFlag` | boolean | Whether note has a flag (no beam) |
| `attachDx` | number | X offset from note center to stem edge (from Bravura anchor) |
| `attachDy` | number | Y offset from note center to stem base (from Bravura anchor) |

**Algorithm:**
```
1. STEM ATTACHMENT POINT:
   stemX = noteX + attachDx                    // stem.cpp:103–106 — stemUpSE/stemDownNW
   yBase = noteY + attachDy

2. BASE LENGTH:
   baseLengthPx = STEM_LENGTH_SP * sp          // = 3.5 * sp
   // C++: chord.cpp:1627 — defaultStemLength = styleD(Sid::stemLength) * 4 [qs]
   //      chord.cpp:1692 — finalStemLength = stemLength/4.0 * spatium

3. FLAG EXTRA:
   extraPx = hasFlag ? 0.5 * sp : 0           // stem.cpp:112 — hook->smuflAnchor().y()

4. TOTAL:
   totalLength = baseLengthPx + extraPx

5. TIP POSITION:
   yTip = stemUp ? yBase - totalLength : yBase + totalLength
```

**Output:** `StemLayout { x, yTip, yBase }`.

**Call graph:**
- Called by: rendering pipeline (after `layoutNote()`)
- Uses: `STEM_LENGTH_SP`

**Delta from C++:** C++ `calcDefaultStemLength()` (§7.8) is a 12-step algorithm: base length + beam addition (§7.4) + chord height + min stem length for tremolo/hook/beam (§7.3) + staff overlap check (§7.5) + shortening table (§7.6) + optical adjustment (§7.7) + 4-beam exception + middle line extension. MAP uses fixed `3.5sp` + 0.5sp for flags. Missing: chord spread (multi-note), beam interaction, min overlap, reduction table, TAB scaling, relativeMag.

---

## 8.3 Constants — Hook/Flag

### `HOOK_GLYPH` — Hook.ts:27–41
```typescript
const HOOK_GLYPH: Partial<Record<HookIndex, string>> = {
  1:    '\u{E240}',   // flag8thUp       — U+E240
  2:    '\u{E242}',   // flag16thUp      — U+E242
  3:    '\u{E244}',   // flag32ndUp      — U+E244
  4:    '\u{E246}',   // flag64thUp      — U+E246
  5:    '\u{E248}',   // flag128thUp     — U+E248
  [-1]: '\u{E241}',   // flag8thDown     — U+E241
  [-2]: '\u{E243}',   // flag16thDown    — U+E243
  [-3]: '\u{E245}',   // flag32ndDown    — U+E245
  [-4]: '\u{E247}',   // flag64thDown    — U+E247
  [-5]: '\u{E249}',   // flag128thDown   — U+E249
}
```
SMuFL glyph mapping for curved flags (Leland font).

**C++ Ref:** §7.11 — `Hook::symIdForHookIndex()` (hook.cpp:73–117). C++ supports indices ±1 through ±8 (up to 1024th) + straight variants. MAP covers ±1 through ±5 (up to 128th), curved only.

### `baseIndex` — Hook.ts:53–59
```typescript
const baseIndex: Partial<Record<string, number>> = {
  'eighth': 1, '16th': 2, '32nd': 3, '64th': 4, '128th': 5,
}
```
Maps duration type string to hook base index.

---

## 8.4 `hookGlyph()` — Hook.ts:44

**Signature:** `export function hookGlyph(index: HookIndex): string | null`

**Algorithm:**
```
return HOOK_GLYPH[index] ?? null
```

Returns the SMuFL glyph character for a given hook index, or null if index is 0.

---

## 8.5 `durationToHookIndex()` — Hook.ts:52

**Signature:** `export function durationToHookIndex(type: string, stemUp: boolean): HookIndex`

**C++ Ref:** `Chord::hookIndex()` — computes from `beams()` count.

**Algorithm:**
```
base = baseIndex[type] ?? 0            // 'eighth'→1, '16th'→2, etc.
if base === 0: return 0                // no hook (quarter or longer)
return stemUp ? base : -base           // positive=up, negative=down
```

---

## 8.6 `layoutHook()` — Hook.ts:85

**Signature:** `export function layoutHook(stemX, stemTipY, hookIndex, fontSize): HookLayout | null`

**C++ Ref:** §7.9 — `Chord::layoutStem()` step 8 (chord.cpp:1828–1869) + §7.11 — hook positioning.

**Algorithm:**
```
glyph = hookGlyph(hookIndex)           // §8.4
if !glyph: return null                 // no flag needed

return { x: stemX, y: stemTipY, glyph, fontSize }
```

**C++ positioning:** stem.cpp:144–148 — `Stem::flagPosition() = pos() + PointF(bbox.left(), ±length())`. hook.cpp:68 — `Hook::smuflAnchor()` aligns with `stemUpNW` / `stemDownSW`. MAP places flag directly at stem tip.

**Delta from C++:** C++ uses SMuFL anchor points (`stemUpNW`, `stemDownSW`) for precise flag attachment. MAP assumes glyph origin aligns with stem tip — sufficient for Leland but may need anchor offsets for other fonts.

---

## 8.7 Types

### `HookIndex` — Hook.ts:21
```typescript
export type HookIndex = -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
```
Signed integer: positive = stem up flags, negative = stem down flags, 0 = no flag.
**C++ Ref:** hook.cpp:44–48 — same convention.

### `StemLayout` — Stem.ts:33
```typescript
export interface StemLayout {
  x: Px           // x-center of stem line
  yTip: Px        // tip (farthest from notehead)
  yBase: Px       // base (at notehead attach point)
}
```

### `HookLayout` — Hook.ts:69
```typescript
export interface HookLayout {
  x: number       // = stemX
  y: number       // = stemTipY
  glyph: string   // SMuFL character
  fontSize: number
}
```

---

## 8.8 Delta from C++ — Chapter 8

| Aspect | C++ (webmscore) | MAP (TypeScript) | Impact |
|--------|----------------|------------------|--------|
| **Stem length** | 12-step algorithm: base + beam addition + chord height + min length (tremolo/hook/beam) + staff overlap + shortening table + optical adjustment + 4-beam exception + middle line extension | Fixed `3.5sp` + 0.5sp extra for flags | Stems may be too short for beamed notes, too long for notes far from staff |
| **Stem attach** | SMuFL anchors `stemUpSE` / `stemDownNW` from live font | Passed as params (`attachDx`, `attachDy`) | Correct if caller provides proper anchors |
| **Min stem overlap** | `minStaffOverlap()` ensures stem reaches middle of staff | Not implemented | Stems on notes at staff edge may not reach middle |
| **Stem shortening** | `maxReduction[]` table by beam count × extension | Not implemented | Stems above staff always 3.5sp, never shortened |
| **Beam width subtraction** | stem.cpp:113 — `y2 -= beamWidth * 0.5 * mag` for beamed stems | Not implemented | Stem tip inside beam instead of at edge |
| **Chord spread** | `chordHeight / 4.0 * spatium` added to stem length | Not implemented — single-note model | Multi-note chord stems too short |
| **TAB stems** | 1.5× scaling, stem-through positioning | Not implemented | TAB rendering not supported |
| **Hook glyphs** | ±1 through ±8, curved + straight variants | ±1 through ±5, curved only | Missing 256th–1024th flags and straight flags |
| **Hook SMuFL anchor** | `hook->smuflAnchor()` with `stemUpNW`/`stemDownSW` | Direct placement at stem tip | May have small positioning offset |
| **Grace note scaling** | `graceNoteMag = 0.7` applied to stem/hook | Not implemented | Grace stems not scaled |

---

# Chapter 9: Beam Layout

> **Files:** `engine/layout/LayoutBeams.ts` (254 lines)
> **C++ Ref:** פרק 8 — Beam Layout (beam.cpp, beam.h, layoutbeams.cpp)

---

## 9.1 Constants

### `BEAM_WIDTH_SP` — LayoutBeams.ts:27
```typescript
export const BEAM_WIDTH_SP: number = Sid.beamWidth   // 0.5
```
Width (thickness) of a single beam stroke in staff-spaces.
**C++ Ref:** styledef.cpp:209 → `Spatium(0.5)`. beam.cpp:1462 — `_beamWidth = point(styleS(Sid::beamWidth)) * mag()`.

### `BEAM_MIN_LEN_SP` — LayoutBeams.ts:33
```typescript
export const BEAM_MIN_LEN_SP: number = Sid.beamMinLen   // 1.1
```
Minimum beam length (end-to-end) in staff-spaces.
**C++ Ref:** styledef.cpp:211 → `Spatium(1.1)`.

### `BEAM_SPACING_QS` — LayoutBeams.ts:41
```typescript
export const BEAM_SPACING_QS = 3   // quarter-spaces; 4 if Sid::useWideBeams
```
Inter-beam spacing in quarter-spaces. Default 3 qs = 0.75sp.
**C++ Ref:** beam.h:69 — `int _beamSpacing { 3 }`. beam.cpp:1461 — `_beamSpacing = styleB(Sid::useWideBeams) ? 4 : 3`.

### `MAX_SLOPES` — LayoutBeams.ts:56
```typescript
export const MAX_SLOPES = [0, 1, 2, 3, 4, 5, 6, 7] as const
```
Maximum slope indexed by interval (in staff-line half-spaces). Also used by `getMaxSlope()` for beam-width-based constraint.
**C++ Ref:** beam.h:238 — `static constexpr std::array _maxSlopes = { 0, 1, 2, 3, 4, 5, 6, 7 }`.

---

## 9.2 `beamDistPx()` — LayoutBeams.ts:47

**Signature:** `export function beamDistPx(sp: number, mag = 1.0): number`

**Algorithm:**
```
return (BEAM_SPACING_QS / 4.0) * sp * mag
// = (3 / 4.0) * sp * 1.0 = 0.75 * sp (default)
```

**C++ Ref:** beam.cpp:1462 — `_beamDist = (_beamSpacing / 4.0) * spatium() * mag()`.

---

## 9.3 `getMaxSlope()` — LayoutBeams.ts:109

**Signature:** `export function getMaxSlope(startX: number, endX: number, sp: number): number`

**C++ Ref:** §8.5 — `Beam::getMaxSlope()` (beam.cpp:613–641).

**Algorithm:**
```
beamWidth = (endX - startX) / sp           // beam horizontal span in sp

if beamWidth < 3.0:  return MAX_SLOPES[1]  // = 1
if beamWidth < 5.0:  return MAX_SLOPES[2]  // = 2
if beamWidth < 7.5:  return MAX_SLOPES[3]  // = 3
if beamWidth < 10.0: return MAX_SLOPES[4]  // = 4
if beamWidth < 15.0: return MAX_SLOPES[5]  // = 5
if beamWidth < 20.0: return MAX_SLOPES[6]  // = 6
return MAX_SLOPES[7]                        // = 7
```

**Faithful port** of C++ thresholds: `<3→1, <5→2, <7.5→3, <10→4, <15→5, <20→6, ≥20→7`.

---

## 9.4 `computeBeamSlope()` — LayoutBeams.ts:145

**Signature:** `export function computeBeamSlope(startLine, endLine, startX, endX, stemUp, sp): number`

**C++ Ref:** §8.5 — `computeDesiredSlant()` (beam.cpp:505–538).

**Algorithm:**
```
1. FLAT CHECK:
   if startLine === endLine: return 0

2. INTERVAL:
   interval = min(|endLine - startLine|, MAX_SLOPES.length - 1)  // cap at 7

3. MAX SLOPE:
   maxSlopeByDist = getMaxSlope(startX, endX, sp)               // §9.3
   slant = min(maxSlopeByDist, MAX_SLOPES[interval])

4. SIGN:
   if stemUp:
     sign = endLine < startLine ? 1 : -1    // ascending note → slant up
   else:
     sign = endLine > startLine ? -1 : 1    // descending note → slant down

5. return slant * sign                       // quarter-space units
```

**C++ Ref:** beam.cpp:537 — `return min(maxSlope, _maxSlopes[interval]) * (_up ? 1 : -1)`.

**Delta from C++:** C++ has `isSlopeConstrained()` (beam.cpp:540–611) that returns 0 (forced flat) when inner notes are more extreme than endpoints ("concave" detection), or returns 1 (±0.25 quarter-space) when neighbor matches endpoint. MAP skips slope constraint entirely.

---

## 9.5 `layoutBeam()` — LayoutBeams.ts:190

**Signature:** `export function layoutBeam(chords: BeamChord[], sp: number): BeamGeometry | null`

**C++ Ref:** §8.3 — `Beam::layout2()` (beam.cpp:1437–1589).

**Algorithm:**
```
1. VALIDATION:
   if chords.length < 2: return null

2. SETUP:
   first = chords[0], last = chords[last]
   stemUp = first.stemUp
   quarterSpace = sp / 4

3. DESIRED SLANT:
   slantQS = computeBeamSlope(                               // §9.4
     first.noteLine, last.noteLine,
     first.stemTipX, last.stemTipX,
     stemUp, sp)

4. CONVERT TO PIXELS:
   dx = last.stemTipX - first.stemTipX
   dyPx = slantQS * quarterSpace                             // total y-change

5. DICTATOR ANCHOR:
   startY = first.stemTipY                                   // beam starts at first stem tip

6. SLOPE:
   slope = dx !== 0 ? dyPx / dx : 0
   // C++: beam.cpp:1580 — _slope = (_endAnchor.y() - _startAnchor.y()) / (...)

7. RETURN:
   { startY,
     endY: startY + dyPx,
     slope,
     beamWidthPx: BEAM_WIDTH_SP * sp,
     beamDistPx: beamDistPx(sp) }
```

**Call graph:**
- Uses: `computeBeamSlope()` (§9.4), `beamDistPx()` (§9.2)
- Constants: `BEAM_WIDTH_SP`

**Delta from C++:** C++ `layout2()` (§8.3) is a multi-phase process: dictator/pointer system selection (furthest note from beam controls), `setValidBeamPositions()` (quarter-space grid snapping), `offsetBeamToRemoveCollisions()` (inner chord collision avoidance), `offsetBeamWithAnchorShortening()`, `addMiddleLineSlant()`, `add8thSpaceSlant()`, cross-staff handling (`layout2Cross()`), user-modified beam positions, beam segment creation. MAP uses simplified model: first stem tip as anchor, linear slope from note interval.

---

## 9.6 `secondaryBeamY()` — LayoutBeams.ts:245

**Signature:** `export function secondaryBeamY(primaryY, level, stemUp, sp): number`

**C++ Ref:** beam.cpp:800 — `verticalOffset = _beamDist * (level - extraBeamAdjust) * upValue`.

**Algorithm:**
```
upValue = stemUp ? -1 : 1                    // beam.cpp:778
dist = beamDistPx(sp)                        // §9.2 — 0.75sp default
return primaryY - dist * level * upValue
```

For stem-up: secondary beams stack ABOVE primary (negative y direction).
For stem-down: secondary beams stack BELOW primary (positive y direction).

**Delta from C++:** C++ has `extraBeamAdjust` for overlapping beam subgroups and `_grow1`/`_grow2` factors for feathered beams. MAP assumes `extraBeamAdjust=0`, `grow=1.0`.

---

## 9.7 Types

### `BeamChord` — LayoutBeams.ts:62
```typescript
export interface BeamChord {
  stemTipX: number      // x center of stem tip (anchor) in pixels
  stemTipY: number      // y of stem tip — set BEFORE beam layout
  noteLine: number      // staff line of note used for slope
  beamCount: number     // 1=8th, 2=16th, 3=32nd, ...
  stemUp: boolean
}
```

### `BeamGeometry` — LayoutBeams.ts:75
```typescript
export interface BeamGeometry {
  startY: number        // y of primary beam at start chord's stem
  endY: number          // y of primary beam at end chord's stem
  slope: number         // px/px (Δy/Δx)
  beamWidthPx: number   // beam stroke thickness in px
  beamDistPx: number    // distance between beam levels in px
}
```

---

## 9.8 Delta from C++ — Chapter 9

| Aspect | C++ (webmscore) | MAP (TypeScript) | Impact |
|--------|----------------|------------------|--------|
| **Dictator/pointer** | Beam position controlled by furthest note from beam (dictator); other end (pointer) follows with constraints | First stem tip = anchor, linear slope to last | May produce suboptimal beam positions for asymmetric chords |
| **Position validation** | Quarter-space grid snapping (`setValidBeamPositions`), "floater" rejection, line/space direction rules | Not implemented | Beams may land on invalid grid positions |
| **Collision avoidance** | `offsetBeamToRemoveCollisions()` checks all inner chords | Not implemented | Inner chord stems may intersect beam |
| **Anchor shortening** | `offsetBeamWithAnchorShortening()` with min stem lengths table `{11,13,15,18,21,24,27,30}` | Not implemented | Stems may be shorter than minimum |
| **Slope constraint** | `isSlopeConstrained()` — concave detection forces flat beam | Not implemented | Beams may slope when middle notes are higher/lower than endpoints |
| **Middle line slant** | `addMiddleLineSlant()` — force slant when pointer at middle line | Not implemented | Flat beams at middle line when slight slant would be better |
| **8th-space slant** | `add8thSpaceSlant()` — 0.125sp micro-adjustment for 3-beam groups | Not implemented | Visual refinement only |
| **Cross-staff** | `layout2Cross()` full algorithm (beam.cpp:1591–1803) | Not implemented | Cross-staff beams not supported |
| **Beam segments** | `createBeamSegments()` with beam breaks, beamlets, sub-groups | Not implemented (external rendering) | Secondary beams drawn externally |
| **Grace beams** | `beamGraceNotes()` with separate beam groups | Not implemented | Grace note beams not created |
| **Beam breaks** | `calcBeamBreaks()` — manual + default (beat subdivision) + tuplet | Not implemented | All beams are continuous |
| **User-modified** | `_userModified` stored beam positions from editing | Not implemented | No interactive beam editing |
| **Wide beams** | `Sid::useWideBeams` → spacing 4 qs instead of 3 | Hardcoded `BEAM_SPACING_QS = 3` | Wide beam style not supported |
| **Feathered beams** | `_grow1`/`_grow2` factors for accelerando/ritardando beams | Not implemented | No feathered beams |

---

## Extraction Summary — Session I

| File | Functions | Constants (named) | Interfaces/Types | Total Items |
|------|-----------|-------------------|------------------|-------------|
| `Note.ts` | 5 (all exported) | 4 (2 exported + 2 local) | 1 interface + 1 type alias | 11 |
| `chordLayout.ts` | 6 (5 exported + 1 internal) | 2 local (ACC_HEIGHTS_SP, ACC_WIDTHS_SP) | 3 interfaces | 11 |
| `LayoutChords.ts` | 3 (all exported) | 4 (all exported) | 2 interfaces | 9 |
| `Stem.ts` | 1 (exported) | 2 (exported via Sid) | 1 interface | 4 |
| `Hook.ts` | 3 (all exported) | 2 local (HOOK_GLYPH, baseIndex) | 1 interface + 1 type alias | 7 |
| `LayoutBeams.ts` | 5 (all exported) | 4 (2 exported + MAX_SLOPES + BEAM_SPACING_QS) | 2 interfaces | 11 |
| **Total** | **23** | **~18** | **10 interfaces + 2 types** | **~53** |

---

# Chapter 10 — Vertical Layout (Full Pipeline)

**File:** `verticalLayout.ts` (1,347 lines)
**C++ Cross-ref:** Ch 6 (Chord/Note), Ch 7 (Stem), Ch 8 (Beam), Ch 9 (Page Layout), Ch 9B (Shape/Skyline)

> The vertical layout engine is the largest single file in the renderer. It takes
> `ExtractedScore` + `HorizontalLayout` and produces `RenderedScore` — the final
> output containing all coordinates in SVG pixels.

---

## 10.1 `computeVerticalLayout()` — Main Orchestrator

**Signature:** `export function computeVerticalLayout(score: ExtractedScore, hLayout: HorizontalLayout, renderOptions?: RenderOptions): RenderedScore` — `verticalLayout.ts:832`

**Input:**
- `score: ExtractedScore` — parsed MusicXML data (measures, notes, metadata)
- `hLayout: HorizontalLayout` — x-positions for every note, measure widths, system breaks
- `renderOptions?: RenderOptions` — optional overrides (spatium, margins, page size)

**Output:** `RenderedScore` — pages → systems → staves → measures → notes/beams/ties/barlines/chords/tuplets, plus `allNotes[]` flat list and `elementMap` (noteId → DOMRectLike)

**Algorithm (pseudocode):**
```
1. Merge renderOptions with DEFAULT_RENDER_OPTIONS
2. Compute pixel constants:
   sp = opts.spatium (default 10px)
   halfSp = sp/2
   staffHeight = 4 * sp = 40px
   noteheadWidth = 1.3 * sp (Leland stemUpSE.x)
   noteheadRy = 0.168 * sp (stem attach offset)
   stemLength = 3.5 * sp
   beamThickness = 0.5 * sp
   beamGap = 0.25 * sp
3. Determine clef (hardcoded 'treble' for now)
4. Compute systemY[] positions:
   staffUpperBorder = 7.0 * sp
   staffLowerBorder = 7.0 * sp
   systemStride = staffUpperBorder + staffHeight + staffLowerBorder + systemSpacingSp*sp
   titleHeight = title ? 10.0*sp : 0
   For each system: y = pageOffset + marginTop + staffUpperBorder + titleOffset + sysOnPage * systemStride
5. Pre-compute prevFifthsPerMeasure map (running key state)
6. Detect active staff indices (skip phantom staves)
7. For each system:
   a. Build RenderedStaff[] (staffTop + lineSpacing + lineYs)
   b. For each measure:
      i.   assignBeamGroupIds()
      ii.  Detect multi-voice (hasVoice2)
      iii. For each note: pitchToStaffLine → noteY, stemDirection, noteheadType, stemXY, accidentalX, dots, ledgerLines, bbox → RenderedNote
      iv.  fixChordGrouping() — fix stem dirs/positions for chords
      v.   buildBeams() — beam geometry
      vi.  Build Skyline from note shapes → chordSymbol collision avoidance
      vii. buildBarlines()
      viii.buildTies()
      ix.  Build tuplet brackets
      x.   Header elements: clef, keySig, timeSig (first measure of system)
8. Cross-barline ties: iterate sequential measure pairs → buildCrossBarlineTies()
9. Group systems into RenderedPage[]
10. Return RenderedScore { pages, metadata, allNotes, elementMap }
```

**Key Constants (declared inside function):**
| Constant | Value | C++ Equivalent |
|----------|-------|----------------|
| `noteheadWidth` | `1.3 * sp` | Leland stemUpSE.x = 1.3sp |
| `noteheadRx` | `0.65 * sp` | noteheadWidth / 2 |
| `noteheadRy` | `0.168 * sp` | Leland stemDownNW.y / stemUpSE.y |
| `stemLength` | `3.5 * sp` | Sid::stemLength |
| `beamThickness` | `0.5 * sp` | Sid::beamWidth |
| `beamGap` | `0.25 * sp` | Sid::beamDistance |
| `staffUpperBorder` | `7.0 * sp` | Sid::staffUpperBorder |
| `staffLowerBorder` | `7.0 * sp` | Sid::staffLowerBorder |
| `titleHeight` | `10.0 * sp` (if title) | Title frame height |
| `accW` (chord sym shape) | `1.0 * sp` | Approximate accidental width for skyline |
| `accH` (chord sym shape) | `2.5 * sp` | Approximate accidental height for skyline |
| `baseChordY` | `staffTop - 2.2*sp` | Chord symbol base y |
| `chordGap` | `0.8 * sp` | Min gap below chord symbol |
| `chordHeight` | `1.5 * sp` | Approximate chord symbol height |

---

## 10.2 `pitchToStaffLine()` — Pitch → Staff Line

**Signature:** `function pitchToStaffLine(step: string, octave: number, clef: ClefType): number` — `verticalLayout.ts:90`

**Algorithm:**
```
diatonic = STEP_TO_DIATONIC[step] ?? 0
return (CLEF_OFFSET[clef] ?? 38) - (diatonic + octave * 7)
```

**C++ Ref:** Ch 6 §6.1 — `Note::line()`, `ClefInfo::line()`. Same formula: `clefOffset - (diatonic + octave * 7)`.

**Constants:**

`STEP_TO_DIATONIC` (`verticalLayout.ts:72`):
```
{ C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }
```

`CLEF_OFFSET` (`verticalLayout.ts:82`):
| Clef | Offset | Meaning |
|------|--------|---------|
| treble | 38 | F5=line 0, C4=line 10 (ledger below) |
| bass | 26 | A3=line 0, C4=line -2 (ledger above) |
| alto | 32 | C4=line 4 (middle) |
| tenor | 30 | C4=line 6 |
| percussion | 38 | Same as treble |

---

## 10.3 `getKeySigLines()` — Key Signature Accidental Positions

**Signature:** `function getKeySigLines(fifths: number, clef: ClefType): number[]` — `verticalLayout.ts:106`

**Algorithm:**
```
if fifths === 0 → return []
count = |fifths|
isSharp = fifths > 0
if clef === 'bass': return BASS_SHARP/FLAT_LINES.slice(0, count)
else: return TREBLE_SHARP/FLAT_LINES.slice(0, count)
```

**Constants:**
| Array | Line | Values | C++ Ref |
|-------|------|--------|---------|
| `TREBLE_SHARP_LINES` | 98 | `[0, 3, -1, 2, 5, 1, 4]` | keysig.cpp — sharp order F♯,C♯,G♯,D♯,A♯,E♯,B♯ |
| `TREBLE_FLAT_LINES` | 101 | `[4, 1, 5, 2, 6, 3, 7]` | keysig.cpp — flat order B♭,E♭,A♭,D♭,G♭,C♭,F♭ |
| `BASS_SHARP_LINES` | 103 | `[2, 5, 1, 4, 7, 3, 6]` | Same order, shifted +2 |
| `BASS_FLAT_LINES` | 104 | `[6, 3, 7, 4, 8, 5, 9]` | Same order, shifted +2 |

**C++ Ref:** Ch 12A §12A.1 — `KeySig::addLayout()`. C++ supports all clef types via `ClefInfo::lines[14]`; MAP only supports treble/bass.

---

## 10.4 `noteheadFromType()` — Duration → Notehead Type

**Signature:** `function noteheadFromType(type: string): NoteheadType` — `verticalLayout.ts:131`

**Algorithm:**
```
'whole' → 'whole'
'half'  → 'half'
else    → 'quarter'   // eighth, 16th, 32nd, 64th all use filled notehead
```

**C++ Ref:** Ch 6 §6.2 — `Note::noteHead()` selects from `NoteHead::Group` + `NoteHead::Type` matrix. MAP collapses to 3 types.

---

## 10.5 `computeAutoStemDirection()` — Pair-wise Outer→Inner

**Signature:** `function computeAutoStemDirection(staffLines: number[]): boolean` — `verticalLayout.ts:140`

**Algorithm:**
```
distances = staffLines.map(sl → sl - 4)   // distance from middle line
sort distances ascending (most negative = highest pitch first)
left = 0, right = length - 1
while left ≤ right:
  net = distances[left] + distances[right]
  if net === 0: left++; right--; continue
  return net > 0  // positive = lower notes dominate → stem up
return true  // symmetric → default up
```

**C++ Ref:** Ch 6 §6.5 — `Chord::computeAutoStemDirection()` (`chord.cpp:1119-1136`). Identical algorithm: pair-wise outer-to-inner comparison on sorted staffLines.

---

## 10.6 `fixChordGrouping()` — Beat+Voice Grouping & Stem Fix

**Signature:** `function fixChordGrouping(noteList: RenderedNote[], extNotes: ExtractedNote[], stemLength: number, noteheadRy: number, noteheadWidth: number, sp: number): void` — `verticalLayout.ts:160`

**Algorithm:**
```
1. Group notes by key = `${beat.toFixed(4)}_v${voice}` → groups Map
2. For each group with > 1 note:
   a. stemUp = computeAutoStemDirection(staffLines)
   b. Sort by staffLine → find topIdx, bottomIdx
   c. Compute shared stemX:
      stemUp → bottomNote.x + noteheadWidth - stemLWCorr
      stemDown → topNote.x + stemLWCorr
      where stemLWCorr = (0.10/2) * sp  [Sid::stemWidth/2]
   d. Compute shared stemLen:
      chordHeightQS = (bottom.staffLine - top.staffLine) * 2
      finalStemLen = chordHeightQS/4.0*sp + stemLength
   e. Apply stemX, stemYTop, stemYBottom to all chord members
      Only stemOwner (opposite-side note from stem tip) gets hasStem = true
   f. Handle 2nd intervals (notehead flip):
      For adjacent notes (interval ≤ 1):
        stemUp → flip HIGHER note to RIGHT of stem
        stemDown → flip LOWER note to LEFT of stem
   g. Accidental stacking via layoutAccidentals() from chordLayout.ts
```

**Mutations:** `rn.stemUp`, `rn.stemX`, `rn.stemYTop`, `rn.stemYBottom`, `rn.hasStem`, `rn.x` (flip), `rn.accidentalX`

**C++ Ref:** Ch 6 §6.5–6.8 — `Chord::computeUp()`, `Chord::layoutStem()`, `layoutChords1()` (notehead flip), `layoutChords3()` (accidental stacking).

---

## 10.7 `accidentalTypeFrom()` — String → AccidentalType

**Signature:** `function accidentalTypeFrom(sign: string): AccidentalType` — `verticalLayout.ts:270`

**Mapping:**
```
'sharp'        → 'sharp'
'flat'         → 'flat'
'natural'      → 'natural'
'double-sharp' → 'double-sharp'
'double-flat'  → 'double-flat'
default        → 'natural'
```

`ACCIDENTAL_WIDTH_SP` (`verticalLayout.ts:118`):
| Type | Width (sp) |
|------|-----------|
| sharp | 1.0 |
| flat | 1.2 |
| natural | 0.9 |
| double-sharp | 1.1 |
| double-flat | 1.4 |
| courtesy-sharp | 1.4 |
| courtesy-flat | 1.6 |
| courtesy-natural | 1.3 |

**C++ Ref:** Ch 13 §13.1 — `Accidental::accList[]` (110 types). MAP supports 8 types.

---

## 10.8 `assignBeamGroupIds()` — Note → BeamGroup Mapping

**Signature:** `function assignBeamGroupIds(notes: ExtractedNote[]): Map<string, string>` — `verticalLayout.ts:287`

**Algorithm:**
```
for each note (skip rests, graces, notes without beamStates):
  find primary beamState (level === 1)
  if value === 'begin': currentGroupId = `beam-m${measureNum}b${round(beat*100)}`
  if currentGroupId: map.set(noteId, currentGroupId)
  if value === 'end': currentGroupId = null
return map
```

**Output:** `Map<noteId, beamGroupId>` — used to group notes into beam groups for `buildBeams()`.

---

## 10.9 `computeLedgerLines()` — Ledger Line Positions

**Signature:** `function computeLedgerLines(staffLine: number, noteX: number, noteheadWidth: number, halfSp: number, staffTop: number): RenderedLedgerLine[]` — `verticalLayout.ts:308`

**Algorithm:**
```
ledgerPad = 0.33 * halfSp * 2   // Sid::ledgerLineLength = 0.33sp
x1 = noteX - ledgerPad
x2 = noteX + noteheadWidth + ledgerPad
if staffLine < 0 (above staff):
  lowestNeeded = staffLine+1 rounded to even via (staffLine+1) & ~1
  for sl = -2; sl >= lowestNeeded; sl -= 2:
    lines.push({ y: staffTop + sl * halfSp, x1, x2 })
if staffLine > 8 (below staff):
  highestNeeded = staffLine rounded to even via staffLine & ~1
  for sl = 10; sl <= highestNeeded; sl += 2:
    lines.push({ y: staffTop + sl * halfSp, x1, x2 })
```

**C++ Ref:** Ch 6 §6.11 — `Chord::addLedgerLines()` (`chord.cpp:845-968`). C++ uses `(l+1)&~1` and `l&~1` for rounding to even lines — same bitwise approach in LedgerLine.ts but simplified rounding here.

---

## 10.10 `buildBeams()` — Beam Geometry

**Signature:** `function buildBeams(renderedNotes: RenderedNote[], extNotes: ExtractedNote[], beamThickness: number, beamGap: number, sp: number): RenderedBeam[]` — `verticalLayout.ts:349`

**Algorithm:**
```
1. Index renderedNotes and extNotes by noteId
2. Group renderedNotes by beamGroupId
3. For each group (≥ 2 notes):
   a. Sort by x position
   b. avgStaffLine → group stem direction (≥4 = up)
   c. Normalize stem direction for all notes in group
   d. Compute beam anchors:
      y1anchor = stemTip + beamThickness/2 * (stemUp ? +1 : -1)
      y2anchor = same for last note
   e. MuseScore slope algorithm:
      interval = |startLine - endLine|
      beamWidthSp = dx / sp
      maxSlopeFromWidth: <3→1, <5→2, <7.5→3, <10→4, <15→5, <20→6, else→7
      isSlopeConstrained: any middle note more extreme than both endpoints → forceFlat
      if forceFlat: y1=y2 = min/max anchor
      else: slopeQS = min(maxSlopeFromWidth, BEAM_MAX_SLOPES[min(interval,7)])
            rise = slopeQS * sp/4
            dictator (most extreme note) determines beam position
   f. beamY(x) = linear interpolation y1→y2
   g. Primary segment: full span first→last stemX
   h. Secondary/tertiary via buildSubBeams() for levels 2..maxLevels
   i. Minimum stem length enforcement:
      MIN_STEM_QS = [11,13,15,18,21,24,27,30] (C++ beam.cpp:1192)
      minStemPx = MIN_STEM_QS[maxLevels-1] * sp/4
      beamShift = max deficit across all notes
   j. If beamShift > 0: shift entire beam away, recompute beamYFinal
   k. Adjust stem tips to sit on primary beam
   l. Push RenderedBeam { groupId, noteIds, stemUp, levels, segments[][] }
```

**Constants:**
| Constant | Line | Value | C++ Ref |
|----------|------|-------|---------|
| `BEAM_MAX_SLOPES` | 456 | `[0,1,2,3,4,5,6,7]` | `beam.h: _maxSlopes` |
| `MIN_STEM_QS` | 492 | `[11,13,15,18,21,24,27,30]` | `beam.cpp:1192` |
| `maxSlopeFromWidth` | 425-432 | Width-based 7-tier lookup | `beam.cpp:624-638 getMaxSlope()` |

**C++ Ref:** Ch 8 §8.1–8.9 — `Beam::layout()`, `computeDesiredSlant()`, `getMaxSlope()`, `isSlopeConstrained()`.

---

## 10.11 `getMaxBeamLevel()` — Max Beam Depth

**Signature:** `function getMaxBeamLevel(gNotes: RenderedNote[], eNoteMap: Map<string, ExtractedNote>): number` — `verticalLayout.ts:547`

**Algorithm:**
```
max = 1
for each note: scan beamStates → track highest level
return max
```

---

## 10.12 `buildSubBeams()` — Secondary/Tertiary Beam Segments

**Signature:** `function buildSubBeams(gNotes: RenderedNote[], eNoteMap: Map<string, ExtractedNote>, level: number, beamY: (x: number) => number, extraOffset: number, sp: number): BeamSegment[]` — `verticalLayout.ts:562`

**Algorithm:**
```
beamYLevel(x) = beamY(x) + extraOffset
for each note:
  find beamState at this level
  if not found → close any open sub-group
  if 'forward hook' → hookW=1.1*sp, segment from stemX to stemX+hookW
  if 'backward hook' → segment from stemX-hookW to stemX
  if 'begin' → subStart = note
  if 'continue' → extend
  if 'end' → segment from subStart.stemX to note.stemX
return segments
```

**Constants:** `hookW = 1.1 * sp` — `Sid::beamMinLen` (`beam.cpp:949`, `styledef.cpp:211`)

**C++ Ref:** Ch 8 §8.7 — beam sub-groups: begin/continue/end/forward hook/backward hook per level.

---

## 10.13 `makeTieArc()` — Bezier Arc from MuseScore Control Points

**Signature:** `function makeTieArc(ax, ay, bx, by, above, noteheadWidth, noteheadRy, sp): BezierArc` — `verticalLayout.ts:620`

**Algorithm:**
```
tieGap = 0.1 * sp
x1 = ax + noteheadWidth + tieGap   // right edge of note A
x2 = bx - tieGap                    // left edge of note B
yOff = above ? -0.185*sp : +0.185*sp   // tie.cpp:975 noteHeadOffset
y1 = ay + yOff
y2 = by + yOff
tieWidthInSp = max(x2-x1, sp) / sp
h = clamp(tieWidthInSp * 0.4 * 0.38 * sp, 0.4*sp, 1.3*sp)   // tie.cpp:299-302 shoulderH
arcH = above ? -h : h
w = x2 - x1
cx1off = (w - w*0.6) * 0.5   // tie.cpp:306-307 shoulderW=0.6
return { x1, y1, cx1: x1+cx1off, cy1: y1+arcH, cx2: x2-cx1off, cy2: y2+arcH, x2, y2 }
```

**Magic Numbers:**
| Value | Line | C++ Source |
|-------|------|------------|
| `0.1` (tieGap) | 628 | gap from notehead edge |
| `0.185` (yOff) | 633 | `tie.cpp:975` noteHeadOffset |
| `0.4, 0.38` (shoulderH factors) | 638 | `tie.cpp:299-302` |
| `1.3, 0.4` (clamp bounds) | 638 | `tie.cpp:299-302` |
| `0.6` (shoulderW) | 642 | `tie.cpp:306-307` |

**C++ Ref:** Ch 6 (not fully covered in C++ doc) — `Tie::computeBezier()`. MAP implements simplified version without cross-system split or endpoint refinement.

---

## 10.14 `buildTies()` — In-Measure Tie Arcs

**Signature:** `function buildTies(renderedNotes: RenderedNote[], noteheadWidth: number, noteheadRy: number, sp: number): RenderedTie[]` — `verticalLayout.ts:648`

**Algorithm:**
```
for each note with tieStart:
  scan forward for next note with tieEnd at same staffLine
  above = !stemUp (tie opposite to stem)
  push RenderedTie with makeTieArc(a, b)
```

---

## 10.15 `buildCrossBarlineTies()` — Cross-Barline/Cross-System Ties

**Signature:** `function buildCrossBarlineTies(curr: RenderedMeasure, next: RenderedMeasure, noteheadWidth: number, noteheadRy: number, sp: number): RenderedTie[]` — `verticalLayout.ts:682`

**Algorithm:**
```
alreadyTied = Set of fromNoteIds from curr.ties
for each note in curr with tieStart and not alreadyTied:
  find matching note in next (tieEnd + same staffLine)
  if crossSystem (curr.systemIndex !== next.systemIndex):
    split into two half-arcs:
      halfArc1: from note A to right edge of current measure
      halfArc2: from left edge of next measure to note B
    push RenderedTie with halfArcs: [halfArc1, halfArc2]
  else:
    push RenderedTie with single arc
```

**C++ Ref:** Ch 6 — C++ handles cross-system ties via `Tie::slurPos()` with separate paint for each system. MAP implements simplified split with two independent bezier arcs.

---

## 10.16 `buildBarlines()` — Left/Right Barlines

**Signature:** `function buildBarlines(extMeasure: ExtractedMeasure, hMeasure: HLayoutMeasure, staffTop: number, staffHeight: number, isLastMeasure: boolean, nextHasLeftBarline?: boolean): RenderedBarline[]` — `verticalLayout.ts:733`

**Algorithm:**
```
yTop = staffTop
yBottom = staffTop + staffHeight
Left barline: only when extMeasure.barlineLeft exists and style !== 'none'
  x = hMeasure.x
Right barline:
  suppressed if nextHasLeftBarline (C++: stronger barline wins)
  default style = 'regular'
  if isLastMeasure and style === 'regular' → upgrade to 'final'
  x = hMeasure.x + hMeasure.width
```

**C++ Ref:** Ch 11 §11.1–11.2 — `Barline::layout()`, two-phase barline system. MAP simplifies to single-pass.

---

## 10.17 `buildKeySignature()` — Key Sig Accidentals + Cancellation

**Signature:** `function buildKeySignature(fifths: number, clef: ClefType, x: number, staffTop: number, halfSp: number, prevFifths?: number): RenderedKeySignature` — `verticalLayout.ts:771`

**Algorithm:**
```
1. Cancellation naturals (only when prevFifths !== 0):
   cancels = |prevFifths| - |fifths| (when same direction) or |prevFifths| (when switching)
   for each cancel (reverse order):
     place natural at oldLine position
     stride: last natural before new sharps/flats → KEY_NATURAL_WIDTH_SP + CROSS_TYPE_GAP_SP
             otherwise → KEY_NATURAL_STRIDE_SP
2. New key accidentals:
   lines = getKeySigLines(fifths, clef)
   stride = KEY_SHARP_STRIDE_SP or KEY_FLAT_STRIDE_SP
   for each line: push { x: x+xOff, y: staffTop + sl*halfSp, type }
```

**Constants:**
| Constant | Line | Value | C++ Source |
|----------|------|-------|------------|
| `KEY_NATURAL_STRIDE_SP` | 780 | 0.956 | naturalWidth(0.556) + keysigNaturalDist(0.4) |
| `CROSS_TYPE_GAP_SP` | 781 | 0.6 | Doubled gap natural→sharp/flat |
| `KEY_NATURAL_WIDTH_SP` | 800 | 0.556 | Natural glyph advance width |

**C++ Ref:** Ch 12A §12A.1–12A.4 — `KeySig::addLayout()`. C++ uses SMuFL cutouts (cutOutSW/NW/NE/SE) for tighter spacing; MAP uses fixed strides.

---

## 10.18 `makeDOMRect()` — Helper

**Signature:** `function makeDOMRect(x: number, y: number, width: number, height: number): DOMRectLike` — `verticalLayout.ts:824`

Returns `{ x, y, width, height, top: y, left: x, right: x+width, bottom: y+height }`.

---

## 10.δ Delta from C++ — Vertical Layout

| Feature | C++ (webmscore) | MAP (verticalLayout.ts) | Impact |
|---------|-----------------|-------------------------|--------|
| **Clef support** | All 35 clef types via `ClefInfo::lines[14]` | Only treble/bass/alto/tenor/percussion | No transposing instrument support |
| **Stem direction** | 9-priority chain (beam, cross-staff, multi-voice, auto, small staff, override) | 3 rules: voice override, multi-voice, middle-line heuristic | Incorrect stems in complex multi-voice + beamed contexts |
| **Stem length** | 12-step algorithm (beam addition, chord spread, min overlap, shortening table, optical adjustment) | Fixed 3.5sp + chordHeight for chords | Over/under-long stems in edge cases |
| **Notehead types** | Full `NoteHead::Group × NoteHead::Type` matrix (80+ combinations) | 3 types: whole, half, quarter | No special noteheads (x, diamond, slash, etc.) |
| **Beam algorithm** | Dictator/pointer, quarter-space grid snapping, collision avoidance, stem grow | Simplified: anchor from stemTip, maxSlope+interval, minStemLength shift | Beam positions may differ by ~1-2 QS from C++ |
| **isSlopeConstrained** | Full concave detection (`beam.cpp:540`) | Simplified: any middle note more extreme than endpoints | Same concept, slightly different edge cases |
| **Beam sub-levels** | Full fractional beam support (32nd subdivisions etc.) | forward/backward hooks + begin/continue/end | Correct for most standard notation |
| **Tie bezier** | `Tie::computeBezier()` with endpoint refinement, cross-system paint | Simplified makeTieArc with fixed shoulderW=0.6 | Ties may look slightly different, especially for very short/long spans |
| **Barlines** | 11 distinct width cases, two-phase layout, 8+ types | Single-pass, basic types (regular/final/repeat) | Missing: double, dotted, short barlines |
| **Key sig spacing** | SMuFL cutouts (cutOutSW/NW/NE/SE) for tight accidental spacing | Fixed strides (sharp/flat/natural) | Spacing slightly wider than C++ |
| **Chord symbol placement** | Full autoplace via Skyline (Ch 9B) | Skyline collision + row alignment | Simplified but functional |
| **Tuplet brackets** | Full tuplet.cpp: direction voting, number placement, bracket geometry | Simplified: majority vote + fixed offsets | Missing: nested tuplets, custom placement |
| **System y computation** | layoutPage() 3-phase with VerticalGapData | Fixed systemStride formula | No adaptive vertical spacing |
| **Multi-staff** | Full grand staff with cross-staff beams | Single effective staff (activeStaffIndices) | No piano grand staff rendering |

---

# Chapter 11 — Shape & Skyline

**Files:** `engine/libmscore/Shape.ts` (263 lines), `engine/libmscore/Skyline.ts` (286 lines)
**C++ Cross-ref:** Ch 9B (Shape, Skyline & Autoplace)

> The Shape + Skyline system is a faithful port of MuseScore's collision detection
> infrastructure. It is used in MAP for chord symbol placement and inter-element spacing.

---

## 11.1 `ShapeRect` Interface

**Definition:** `export interface ShapeRect` — `Shape.ts:12`

```ts
{
  x: number       // left edge
  y: number       // top edge
  width: number   // horizontal extent
  height: number  // vertical extent
  label?: string  // optional debugging label
}
```

---

## 11.2 `verticalIntersects()` — Vertical Range Overlap

**Signature:** `function verticalIntersects(ay1: number, ay2: number, by1: number, by2: number, verticalClearance: number): boolean` — `Shape.ts:24`

**Algorithm:**
```
if ay1 === ay2 OR by1 === by2 → return false   // zero-height = no intersect
return (ay2 + verticalClearance > by1) AND (ay1 < by2 + verticalClearance)
```

**C++ Ref:** Ch 9B §9B.2 — `shape.h:113-122`. Zero-height elements don't intersect (unlike zero-width which collide with everything).

---

## 11.3 `Shape` Class — Constructor & `add()`

**Class:** `export class Shape` — `Shape.ts:36`
**Field:** `readonly elements: ShapeRect[] = []`

**Constructor:** `constructor(rect?: ShapeRect)` — `Shape.ts:39`
- If `rect` provided, pushes it to `elements`.

**`add()` — Overloaded:** `Shape.ts:43`
```ts
add(rect: ShapeRect): void
add(shape: Shape): void
```
- If arg is Shape: `elements.push(...arg.elements)` (merge)
- If arg is ShapeRect: `elements.push(arg)` (append)

---

## 11.4 `Shape.addHorizontalSpacing()` — Zero-Height Wall

**Signature:** `addHorizontalSpacing(leftEdge: number, rightEdge: number, label?: string): void` — `Shape.ts:58`

**Algorithm:**
```
eps = 1e-10
right = rightEdge
if leftEdge === rightEdge: right += eps   // prevent zero-width
push { x: leftEdge, y: 0, width: right-leftEdge, height: 0, label }
```

Creates a zero-height rectangle that acts as a "wall" — collides with everything in `minHorizontalDistance()` due to the zero-width hack.

**C++ Ref:** Ch 9B §9B.1 — same HACK: `addHorizontalSpacing()` creates wall shapes.

---

## 11.5 `Shape` Bounds Getters

**`left()`** (`Shape.ts:74`): Leftmost extent (negated — returns positive distance from origin).
```
for each rect where height !== 0: track min x → return -min
```

**`right()`** (`Shape.ts:82`): Rightmost extent.
```
for each rect: track max(x + width)
```

**`top()`** (`Shape.ts:91`): Topmost y (smallest y value). Init = 1e6.

**`bottom()`** (`Shape.ts:99`): Bottommost y+height (largest). Init = -1e6.

**`size`** getter (`Shape.ts:69`): `elements.length`
**`empty`** getter (`Shape.ts:70`): `elements.length === 0`

**`clear()`** (`Shape.ts:65`): `elements.length = 0`

---

## 11.6 `Shape` Translation Methods

| Method | Line | Mutation | Description |
|--------|------|----------|-------------|
| `translate(dx, dy)` | 110 | In-place | `r.x += dx; r.y += dy` for all elements |
| `translateX(dx)` | 117 | In-place | `r.x += dx` only |
| `translateY(dy)` | 121 | In-place | `r.y += dy` only |
| `translated(dx, dy)` | 125 | Returns new Shape | Creates copy with offsets applied |

---

## 11.7 `Shape.minHorizontalDistance()` — Minimum Horizontal Gap

**Signature:** `minHorizontalDistance(a: Shape, spatiumPx: number, padding = 0): number` — `Shape.ts:144`

**Algorithm:**
```
dist = -1e6
verticalClearance = 0.2 * spatiumPx
for each r2 in a.elements:
  for each r1 in this.elements:
    if verticalIntersects(r1, r2, verticalClearance) OR r1.width===0 OR r2.width===0:
      dist = max(dist, r1.x+r1.width - r2.x + padding)
return dist
```

**Key behavior:**
- `verticalClearance = 0.2 * spatiumPx` — elements within 0.2sp vertical range collide even without overlap
- Zero-width shapes collide with everything (C++ hack preserved)
- Returns negative if shapes are already clear

**C++ Ref:** Ch 9B §9B.2 — `Shape::minHorizontalDistance()` (`shape.cpp:100-132`). MAP omits kerning types and item-specific padding.

---

## 11.8 `Shape.minVerticalDistance()` — Minimum Vertical Gap

**Signature:** `minVerticalDistance(a: Shape): number` — `Shape.ts:169`

**Algorithm:**
```
if empty or a.empty → return 0
dist = -1e6
for each r2 in a (skip height ≤ 0):
  for each r1 in this (skip height ≤ 0):
    if horizontal overlap (ax2 > bx1 AND ax1 < bx2):
      dist = max(dist, r1.y+r1.height - r2.y)
return dist
```

**C++ Ref:** Ch 9B §9B.2 — `Shape::minVerticalDistance()` (`shape.cpp:140-165`).

---

## 11.9 `Shape` Intersection Tests

**`intersectsRect(rr: ShapeRect)`** (`Shape.ts:192`):
Standard AABB test: `r.x < rr.x+rr.width && r.x+r.width > rr.x && r.y < rr.y+rr.height && r.y+r.height > rr.y`

**`intersectsShape(other: Shape)`** (`Shape.ts:202`):
```
for each rect in other: if intersectsRect(rect) → true
```

---

## 11.10 `Shape` Spatial Query Methods

**`clearsVertically(a: Shape)`** (`Shape.ts:213`):
Checks if all parts of `a` are below all parts of `this` (no vertical overlap where horizontal ranges overlap).
C++ Ref: `shape.cpp:168-181`.

**`topDistance(px, py)`** (`Shape.ts:231`):
Distance from point to top of shape elements that contain the x coordinate. Returns `r.y - py` (negative = overlap).
C++ Ref: `shape.cpp:208-218`.

**`bottomDistance(px, py)`** (`Shape.ts:245`):
Distance from point to bottom: `py - (r.y + r.height)`. C++ Ref: `shape.cpp:224-234`.

**`contains(px, py)`** (`Shape.ts:255`):
Standard point-in-rect test across all elements.

---

## 11.11 Skyline Constants

**`MAXIMUM_Y`** (`Skyline.ts:19`): `1e6` — boundary value for north line (no element above)
**`MINIMUM_Y`** (`Skyline.ts:20`): `-1e6` — boundary value for south line (no element below)

**C++ Ref:** Ch 9B §9B.3 — same sentinel values.

---

## 11.12 `SkylineSegment` Interface

**Definition:** `export interface SkylineSegment` — `Skyline.ts:24`

```ts
{
  x: number        // start x position
  y: number        // contour y value (min for north, max for south)
  w: number        // width of this segment
  staffSpan: number // cross-staff span (0 = same staff)
}
```

---

## 11.13 `SkylineLine.add()` — Core Insertion Algorithm (6 Cases A–F)

**Signature:** `add(x: number, y: number, w: number, span = 0): void` — `Skyline.ts:89`

**Algorithm:**
```
1. Clamp x to ≥ 0 (adjust w accordingly; return if w ≤ 0)
2. Find insertion index via binary search (findIndex)
3. Walk segments from idx forward:
   Case A: new rect ends before current segment → done
   Case B: new rect starts after current segment → skip
   Skip: existing contour already more extreme → skip
   Case E: new rect completely inside segment → split into up to 3 parts
     w1 (before), w2 (new rect), w3 (after)
     Only create segments where width > 1e-7
   Case F: new rect completely covers segment → just update y
   Case C: new rect overlaps start of segment → split and insert
   Case D: new rect starts inside segment → split at intersection
4. Append remaining extent if new rect extends beyond all segments
```

**Constants:** `1e-7` epsilon for width comparisons (`Skyline.ts:126,134,156`)

**C++ Ref:** Ch 9B §9B.3 — `SkylineLine::add()` (`skyline.cpp:137-219`). Same 6-case algorithm. C++ uses epsilon `1e-7` at same check points.

---

## 11.14 `SkylineLine.addShape()` / `addRect()`

**`addShape(s: Shape)`** (`Skyline.ts:67`):
```
for each rect in s.elements: addRect(rect)
```

**`addRect(r: ShapeRect)`** (`Skyline.ts:73`):
```
if north: add(r.x, r.y, r.width, 0)          // top edge
if south: add(r.x, r.y + r.height, r.width, 0)  // bottom edge
```

---

## 11.15 `SkylineLine.max()` — Extreme Contour Value

**Signature:** `max(): number` — `Skyline.ts:53`

```
if north: return min(all seg.y)    // most extreme = lowest y value
if south: return max(all seg.y)    // most extreme = highest y value
```

**Helper:**
- `valid` getter (`Skyline.ts:46`): `seg.length > 0`
- `isValidSegment(s)` (`Skyline.ts:48`): checks `s.y !== MAXIMUM_Y/MINIMUM_Y`

---

## 11.16 `SkylineLine.minDistance()` — Contour Sweep Distance

**Signature:** `minDistance(sl: SkylineLine): number` — `Skyline.ts:188`

**Algorithm:**
```
dist = MINIMUM_Y
x1 = 0, x2 = 0, kIdx = 0
for each iSeg in this.seg:
  skip if staffSpan > 0
  advance kIdx past segments that end before iSeg starts
  check overlapping segments:
    if (x1+iSeg.w > x2) AND (x1 < x2+kSeg.w) AND kSeg.staffSpan ≥ 0:
      dist = max(dist, iSeg.y - kSeg.y)
    advance to next overlapping segment
  x1 += iSeg.w
return dist
```

This computes the minimum distance between `this` (south/above) and `sl` (north/below) skyline lines. Positive = gap needed; negative = already clear.

**C++ Ref:** Ch 9B §9B.4 — `SkylineLine::minDistance()` (`skyline.cpp:242-281`). Same sweep algorithm.

---

## 11.17 `SkylineLine` Private Helpers

**`findIndex(x)`** (`Skyline.ts:228`):
Binary search (upper_bound logic): finds the segment containing or just before position `x`.

**`insertAt(idx, x, y, w, span)`** (`Skyline.ts:239`):
Inserts a new segment at position `idx`. Adjusts next segment's `x` if it would overlap.
```
if idx < seg.length AND x+w > seg[idx].x: seg[idx].x = x+w
splice new segment into array
```

---

## 11.18 `Skyline` Class — North+South Pair

**Class:** `export class Skyline` — `Skyline.ts:251`

**Fields:**
- `_north = new SkylineLine(true)`
- `_south = new SkylineLine(false)`

**Getters:** `north`, `south` → readonly access

**Methods:**
| Method | Line | Description |
|--------|------|-------------|
| `clear()` | 258 | Clear both lines |
| `addShape(s)` | 264 | Add shape to both north and south (extracting top/bottom y) |
| `addRect(r)` | 272 | Add single rect to both lines |
| `minDistance(s)` | 283 | `this._south.minDistance(s._north)` — gap between this (above) and s (below) |

---

## 11.δ Delta from C++ — Shape & Skyline

| Feature | C++ (webmscore) | MAP (Shape.ts + Skyline.ts) | Impact |
|---------|-----------------|----------------------------|--------|
| **Shape class** | `Shape` with `ShapeElement` (inherits from `RectF`, has `EngravingItem*` pointer, `KerningType`) | `Shape` with `ShapeRect[]` (plain objects, no item pointer) | No item-specific collision rules |
| **Kerning types** | 7 kerning types (clef, timeSig, keySig, barline, note, stem, grace) for fine-grained spacing | No kerning — all elements treated equally | Slightly looser spacing in some cases |
| **verticalClearance** | `0.2 * spatium` (shape.cpp:103) | `0.2 * spatiumPx` — **identical** | Correct port |
| **Zero-width hack** | Zero-width shapes collide with everything (shape.cpp:47,120) | Same hack preserved (`r1.width === 0 || r2.width === 0`) | Correct port |
| **Skyline 6-case algorithm** | Cases A–F (skyline.cpp:137-219) | Same 6 cases — faithful port | Correct |
| **Skyline epsilon** | `1e-7` for width comparisons (skyline.cpp:170,180,198) | Same `1e-7` at `Skyline.ts:126,134,156` | Correct port |
| **Autoplace** | `autoplaceSegmentElement()`, `autoplaceMeasureElement()`, `rebaseMinDistance()` | **Not implemented** | Elements that rely on autoplace (dynamics, lyrics, hairpins) are not supported |
| **SkylineLine::max()** | Used in `minTop()`/`minBottom()` for system stacking | Same implementation, used for chord symbol placement | Correct |
| **staffSpan** | Cross-staff elements span >0, used in minDistance to skip | Same field, defaults to 0 | Cross-staff not supported but field exists |

---

# Chapter 12 — Atomic Elements (Noteheads, Stems, Flags, Rests, Accidentals, Dots, Ledger Lines)

**Files:** `atomicElements.ts` (651 lines), `engine/libmscore/LedgerLine.ts` (96 lines)
**C++ Cross-ref:** Ch 6 (Chord/Note), Ch 7 (Stem), Ch 13 (Accidentals), Ch 16 (Font/Glyph)

> `atomicElements.ts` provides layout+paint function pairs for every atomic music element.
> Each element has `layout*()` (compute pixel geometry) and `paint*()` (render via Painter API).
> `LedgerLine.ts` is the engine-side equivalent with C++ fidelity.

---

## 12.0 Exported Constants

All constants are in **staff-spaces** (multiply by `spatiumPx` for pixels).

| Constant | Line | Value | C++ Source |
|----------|------|-------|------------|
| `INK` | 39 | `'#1a1a1a'` | Default ink color for all elements |
| `STEM_LENGTH_SP` | 46 | `3.5` | `Sid::stemLength` |
| `STEM_FLAG_EXTRA_SP` | 49 | `0.5` | Extra stem for flagged notes |
| `NOTEHEAD_RX_SP` | 52 | `0.59` | SMuFL advance/2 ≈ 1.18sp total |
| `NOTEHEAD_RY_SP` | 55 | `0.36` | Notehead half-height |
| `DOT_NOTE_GAP_SP` | 62 | `0.5` | `Sid::dotNoteDistance` (styledef.cpp:216) |
| `DOT_DOT_DIST_SP` | 69 | `0.65` | `Sid::dotDotDistance` (styledef.cpp:218) |
| `LEDGER_OVERRUN_SP` | 76 | `0.33` | `Sid::ledgerLineLength` (styledef.cpp:198) |
| `ACC_NOTE_GAP_SP` | 83 | `0.25` | `Sid::accidentalNoteDistance` (styledef.cpp:203) |
| `ACC_ACC_GAP_SP` | 90 | `0.22` | `Sid::accidentalDistance` (styledef.cpp:202) |

**Internal constants:**
| Constant | Line | Value | Purpose |
|----------|------|-------|---------|
| `CLEF_OFFSET` | 104 | Same as verticalLayout.ts:82 | treble=38, bass=26, alto=32, tenor=30, percussion=38 |
| `STEP_TO_DIATONIC` | 112 | Same as verticalLayout.ts:72 | C=0..B=6 |
| `REST_STAFF_LINES` | 362 | `{ whole:1, half:3, quarter:4, eighth:4, 16th:4, 32nd:4, 64th:4 }` | Default staff-line per rest type |

---

## 12.1 `pitchToStaffLine()` — Pitch → Staff Line

**Signature:** `export function pitchToStaffLine(step: string, octave: number, clef: string): number` — `atomicElements.ts:126`

Same formula as `verticalLayout.ts:90`: `offset - (diatonic + octave * 7)`. Exported for use by external modules.

**Note:** This is a duplicate of the function in `verticalLayout.ts`. Both use the same `CLEF_OFFSET` and `STEP_TO_DIATONIC` tables (defined locally in each file).

---

## 12.2 `computeStemUp()` — Stem Direction

**Signature:** `export function computeStemUp(staffLine: number, voice: number, isMultiVoice: boolean): boolean` — `atomicElements.ts:148`

**Algorithm:**
```
if voice === 2 → false (always down)
if voice === 1 AND isMultiVoice → true (always up)
else → staffLine >= MIDDLE_LINE (4)   // on or below middle → stem up
```

**C++ Ref:** Ch 7 §7.1 — MuseScore's 9-priority chain. MAP implements 3 rules (voice override, multi-voice, middle-line).

---

## 12.3 `noteheadGlyph()` / `hasStem()` — Notehead Utilities

**`noteheadGlyph(type: NoteheadType): string`** — `atomicElements.ts:166`
```
double-whole → LELAND_NOTEHEAD_DOUBLE_WHOLE
whole        → LELAND_NOTEHEAD_WHOLE
half         → LELAND_NOTEHEAD_HALF
default      → LELAND_NOTEHEAD_BLACK
```

**`hasStem(type: NoteheadType): boolean`** — `atomicElements.ts:176`
```
type !== 'whole' AND type !== 'double-whole'
```

**`NoteheadType`** (union type, `atomicElements.ts:162`):
`'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd' | '64th' | 'double-whole' | 'x' | 'diamond' | 'slash'`

---

## 12.4 `layoutNotehead()` / `paintNotehead()` — Notehead Layout + Render

**`layoutNotehead(noteX, staffLine, staffTopPx, spatiumPx, type): NoteheadLayout`** — `atomicElements.ts:195`

```
glyph = noteheadGlyph(type)
fontSize = smuflFontSize(spatiumPx)
y = lineToY(staffLine, staffTopPx, spatiumPx)
x = noteX - NOTEHEAD_RX_SP * spatiumPx   // left edge of glyph
return { x, y, glyph, fontSize }
```

**`NoteheadLayout`** interface (`atomicElements.ts:180`):
```ts
{ x: Px, y: Px, glyph: string, fontSize: Px }
```

**`paintNotehead(painter, layout, meta)`** — `atomicElements.ts:214`
```
painter.beginGroup(noteId)
painter.drawGlyph(x, y, glyph, fontSize, INK)
painter.endGroup()
```

---

## 12.5 `layoutStem()` / `paintStem()` — Stem Geometry + Render

**`layoutStem(noteX, noteY, stemUp, spatiumPx, noteheadType, hasFlag?): StemLayout`** — `atomicElements.ts:245`

**Algorithm:**
```
glyphName = 'noteheadHalf' or 'noteheadBlack'
noteLeftEdge = noteX - NOTEHEAD_RX_SP * spatiumPx
attachDx = stemAttachX(glyphName, stemUp, spatiumPx)   // from Bravura anchors
attachDy = stemAttachY(glyphName, stemUp, spatiumPx)
stemX = noteLeftEdge + attachDx
stemLenPx = (STEM_LENGTH_SP + extraSp) * spatiumPx    // extraSp = 0.5 if hasFlag
stemThickHalf = ENGRAVING.stemThickness * spatiumPx / 2
if stemUp:
  yBottom = noteY + attachDy
  yTop = yBottom - stemLenPx
else:
  yTop = noteY + attachDy
  yBottom = yTop + stemLenPx
return { x: stemX + stemThickHalf, yTop, yBottom }
```

**`StemLayout`** interface (`atomicElements.ts:228`): `{ x: Px, yTop: Px, yBottom: Px }`

**`paintStem(painter, layout, spatiumPx, meta)`** — `atomicElements.ts:292`
```
w = ENGRAVING.stemThickness * spatiumPx
painter.drawLine(x, yTop, x, yBottom, w, INK)
```

**C++ Ref:** Ch 7 §7.2–7.4 — `Stem::layout()`, `stemPosX()`. MAP uses Bravura anchor metadata (`stemAttachX/Y`) instead of hardcoded offsets.

---

## 12.6 `flagInfo()` / `layoutFlag()` / `paintFlag()` — Flag Glyph + Position

**`flagInfo(type, stemUp): { glyph } | null`** — `atomicElements.ts:314`
```
eighth → LELAND_FLAG_8TH_UP/DOWN
16th   → LELAND_FLAG_16TH_UP/DOWN
32nd   → LELAND_FLAG_32ND_UP/DOWN
else   → null (no flag)
```

**`layoutFlag(stem, stemUp, spatiumPx, type): FlagLayout | null`** — `atomicElements.ts:327`
```
info = flagInfo(type, stemUp)
if !info → null
x = stem.x - stemThickHalf
y = stemUp ? stem.yTop : stem.yBottom
return { x, y, glyph, fontSize }
```

**`FlagLayout`** interface (`atomicElements.ts:306`): `{ x: Px, y: Px, glyph: string, fontSize: Px }`

**`paintFlag(painter, layout, meta)`** — `atomicElements.ts:339`
```
painter.drawGlyph(x, y, glyph, fontSize, INK)
```

**C++ Ref:** Ch 7 §7.6 — `Hook::layout()`. C++ supports ±1..±8 + straight variants; MAP supports ±1..±3 (up to 32nd note).

---

## 12.7 `layoutRest()` / `paintRest()` — Rest Position + Render

**`layoutRest(noteX, staffTopPx, spatiumPx, type, voice?, isMultiVoice?): RestLayout`** — `atomicElements.ts:382`

**Algorithm:**
```
staffLine = REST_STAFF_LINES[type] ?? 4
if isMultiVoice:
  voice 2 → staffLine += 2 (shift down)
  voice 1 → staffLine -= 2 (shift up)
glyph = restGlyph(type)
y = lineToY(staffLine, staffTopPx, spatiumPx)
x = noteX - NOTEHEAD_RX_SP * spatiumPx * 0.5   // centered
return { x, y, glyph, fontSize }
```

**`restGlyph(type)`** — internal (`atomicElements.ts:407`):
Maps duration type to Leland glyph: LELAND_REST_WHOLE..LELAND_REST_64TH. Default: LELAND_REST_QUARTER.

**`RestLayout`** interface (`atomicElements.ts:351`): `{ x: Px, y: Px, glyph: string, fontSize: Px }`

**`paintRest(painter, layout, meta)`** — `atomicElements.ts:420`
```
painter.beginGroup(noteId or 'rest-m{N}')
painter.drawGlyph(x, y, glyph, fontSize, INK)
painter.endGroup()
```

---

## 12.8 `layoutAccidental()` / `paintAccidental()` — Accidental Position + Render

**`layoutAccidental(noteX, noteY, accType, spatiumPx): AccidentalLayout`** — `atomicElements.ts:453`

**Algorithm:**
```
glyph = accidentalGlyph(accType)
widthSp = accidentalWidthSp(accType)
widthPx = widthSp * spatiumPx
x = noteX - NOTEHEAD_RX_SP*sp - ACC_NOTE_GAP_SP*sp - widthPx
return { x, y: noteY, glyph, fontSize, widthPx, xColumnOffset: 0 }
```

**`accidentalGlyph(type)`** — internal (`atomicElements.ts:472`):
```
sharp/courtesy-sharp    → LELAND_SHARP
flat/courtesy-flat      → LELAND_FLAT
natural/courtesy-natural → LELAND_NATURAL
double-sharp            → LELAND_DOUBLE_SHARP
double-flat             → LELAND_DOUBLE_FLAT
default                 → ''
```

**`accidentalWidthSp(type)`** — internal (`atomicElements.ts:486`):
```
sharp: 1.0, flat: 0.65, natural: 0.9,
double-sharp: 1.1, double-flat: 1.4,
courtesy-sharp: 1.0, courtesy-flat: 0.65, courtesy-natural: 0.9
```

**`AccidentalLayout`** interface (`atomicElements.ts:434`):
```ts
{ x: Px, y: Px, glyph: string, fontSize: Px, widthPx: Px, xColumnOffset: number }
```

**`paintAccidental(painter, layout, meta)`** — `atomicElements.ts:496`
```
if !glyph → return (no-op)
painter.drawGlyph(x, y, glyph, fontSize, INK)
```

**C++ Ref:** Ch 13 §13.1–13.3 — `Accidental::layout()`. C++ supports 110 accidental types with combined SMuFL parenthesized glyphs; MAP supports 8 types.

---

## 12.9 `layoutDots()` / `paintDots()` — Augmentation Dots

**`layoutDots(noteX, noteY, staffLine, spatiumPx, count): DotLayout[]`** — `atomicElements.ts:527`

**Algorithm:**
```
dotYAdjust = staffLine even (on line) ? -0.5*sp : 0   // shift up into space
dotY = noteY + dotYAdjust
dot1X = noteX + NOTEHEAD_RX_SP*sp + DOT_NOTE_GAP_SP*sp
result = [{ x: dot1X, y: dotY, fontSize }]
if count ≥ 2:
  dot2X = dot1X + DOT_DOT_DIST_SP * sp   // 0.65sp center-to-center
  result.push({ x: dot2X, y: dotY, fontSize })
return result
```

**`DotLayout`** interface (`atomicElements.ts:509`): `{ x: Px, y: Px, fontSize: Px }`

**`paintDots(painter, dots, _meta)`** — `atomicElements.ts:555`
```
for each dot: painter.drawGlyph(x, y, LELAND_AUGMENTATION_DOT, fontSize, INK)
```

**C++ Ref:** Ch 6 — `Note::layout2()` for dot positioning. Same rules: `dotNoteDistance` then `dotDotDistance` for subsequent dots. Same vertical adjustment for notes on lines.

---

## 12.10 `layoutLedgerLines()` / `paintLedgerLines()` — Ledger Lines

### atomicElements.ts version

**`layoutLedgerLines(noteX, staffLine, staffTopPx, spatiumPx): LedgerLineLayout[]`** — `atomicElements.ts:584`

**Algorithm:**
```
halfW = (NOTEHEAD_RX_SP + LEDGER_OVERRUN_SP) * sp
x1 = noteX - halfW
x2 = noteX + halfW
if staffLine < 0: for sl = -2; sl >= staffLine; sl -= 2: push line
if staffLine > 8: for sl = 10; sl <= staffLine; sl += 2: push line
```

**`LedgerLineLayout`** interface (`atomicElements.ts:569`): `{ x1: Px, x2: Px, y: Px, staffLine: number }`

**`paintLedgerLines(painter, lines, spatiumPx, _meta)`** — `atomicElements.ts:614`
```
w = ENGRAVING.legerLineThickness * spatiumPx
for each line: painter.drawLine(x1, y, x2, y, w, INK)
```

### LedgerLine.ts version (engine side)

**File:** `engine/libmscore/LedgerLine.ts` (96 lines)

**Constants:**
| Constant | Line | Value | C++ Source |
|----------|------|-------|------------|
| `LEDGER_OVERRUN_SP` | 27 | `Sid.ledgerLineLength` (= 0.33) | `chord.cpp:851`, `styledef.cpp:198` |
| `LEDGER_LINE_WIDTH_SP` | 34 | `0.16` | `Sid::ledgerLineWidth`, `styledef.cpp:200` |

**`LedgerLineLayout`** interface (`LedgerLine.ts:40`):
```ts
{ x1: Px, x2: Px, y: Px, staffLine: number }
```

**`layoutLedgerLines(noteX, staffLine, staffTopPx, sp): LedgerLineLayout[]`** — `LedgerLine.ts:65`

Higher fidelity than atomicElements version — uses `lineToY()` and bitwise rounding:
```
halfW = (NOTEHEAD_RX_SP + LEDGER_OVERRUN_SP) * sp
x1 = noteX - halfW
x2 = noteX + halfW
if staffLine < 0:
  lowestLedger = (staffLine + 1) & ~1   // C++: (l+1) & ~1 rounds toward 0
  for sl = -2; sl >= lowestLedger; sl -= 2:
    push { x1, x2, y: lineToY(sl, staffTopPx, sp), staffLine: sl }
if staffLine > 8:
  highestLedger = staffLine & ~1   // C++: l & ~1
  for sl = 10; sl <= highestLedger; sl += 2:
    push { x1, x2, y: lineToY(sl, staffTopPx, sp), staffLine: sl }
```

**C++ Ref:** Ch 6 §6.11 — `Chord::addLedgerLines()` (`chord.cpp:845-968`). The bitwise `& ~1` rounding is a faithful port.

---

## 12.11 `paintStaffLines()` — Five Staff Lines

**Signature:** `export function paintStaffLines(painter: Painter, staffTopPx: Px, x1: Px, x2: Px, spatiumPx: Px, measureNum: number, staffIndex: number): void` — `atomicElements.ts:637`

**Algorithm:**
```
w = ENGRAVING.staffLineThickness * spatiumPx
for i = 0..4:
  y = staffTopPx + i * spatiumPx
  painter.drawLine(x1, y, x2, y, w, INK)
```

---

## 12.δ Delta from C++ — Atomic Elements

| Feature | C++ (webmscore) | MAP (atomicElements.ts) | Impact |
|---------|-----------------|-------------------------|--------|
| **Notehead types** | 80+ via `NoteHead::Group × Type` matrix | 11 types in union, 4 glyphs | Missing: x, diamond, slash rendering |
| **Stem direction** | 9-priority chain | 3 rules (voice, multi-voice, middle-line) | Incorrect in complex scenarios |
| **Stem attachment** | Hardcoded per glyph from SMuFL anchors | Uses Bravura `stemAttachX/Y()` | Correct — identical approach |
| **Flag types** | ±1..±8 + straight variants (16 hooks) | ±1..±3 (8th/16th/32nd only) | Missing 64th+ flags |
| **Rest types** | Full rest repertoire + multi-measure rests | 7 types (whole–64th) | No multi-measure rests |
| **Multi-voice rests** | Precise positioning per voice (1–4) | Voice 1 shifts up 2sp, voice 2 shifts down 2sp | Only voice 1+2 |
| **Accidental types** | 110 types in `accList[]` (Ch 13) | 8 types (sharp/flat/natural × regular/courtesy + double) | Missing: quarter-tone, Stein-Zimmermann, etc. |
| **Accidental width** | Per-glyph SMuFL advance width | Hardcoded `accidentalWidthSp()` (Leland-specific) | Correct for Leland only |
| **Dot positioning** | `dotPosX` from chord layout + per-voice adjust | `noteX + NOTEHEAD_RX_SP + DOT_NOTE_GAP_SP` | Correct basic formula |
| **Ledger lines** | Full `Chord::addLedgerLines()` with multi-note chord coalescence, mag scaling | Per-note, no chord merging | Duplicate ledger lines for unisons |
| **Staff lines** | Per-staff count (1–5 lines), custom line distances | Fixed 5 lines, fixed spatium | No tab staffs, percussion single-line, etc. |
| **Ledger line rounding** | `(l+1)&~1` above, `l&~1` below (chord.cpp:887-891) | LedgerLine.ts: same bitwise. atomicElements.ts: loop-based | LedgerLine.ts is faithful; atomicElements.ts is simplified |

---

## Extraction Summary — Session J

| File | Functions | Constants (named) | Classes | Interfaces/Types | Total Items |
|------|-----------|-------------------|---------|-------------------|-------------|
| `verticalLayout.ts` | 18 (1 exported + 17 internal) | 9 named + ~15 inline | 0 | 0 (imports all types) | 42 |
| `Shape.ts` | 1 helper (verticalIntersects) | 0 | 1 (Shape, 16 methods) | 1 (ShapeRect) | 19 |
| `Skyline.ts` | 0 standalone | 2 (MAXIMUM_Y, MINIMUM_Y) | 2 (SkylineLine, Skyline) | 1 (SkylineSegment) | 5 + class methods |
| `LedgerLine.ts` | 1 (layoutLedgerLines) | 2 (LEDGER_OVERRUN_SP, LEDGER_LINE_WIDTH_SP) | 0 | 1 (LedgerLineLayout) | 4 |
| `atomicElements.ts` | 20 (17 exported + 3 internal) | 10 exported + 3 internal | 0 | 7 interfaces + 1 type | 41 |
| **Total** | **~40** | **~41** | **3** | **10 interfaces + 1 type** | **~111** |

---
---

# Chapter 13: SVG Rendering & Painter

> **Files:** `svgRenderer.ts` (558 lines), `painter/Painter.ts` (158 lines), `painter/SVGPainter.ts` (180 lines)
> **C++ parallel:** Chapter 17 (SVG/Drawing Output Pipeline)
> **Role:** Converts `RenderedScore` (output of vertical layout) into an SVG string for display.

## 13.1 Architecture Overview

MAP separates rendering into two layers:

1. **`svgRenderer.ts`** — High-level: walks the `RenderedScore` tree and emits SVG elements directly as string concatenation. Self-contained, single-file renderer with inline `@font-face`.
2. **`painter/Painter.ts` + `painter/SVGPainter.ts`** — Abstract painter interface + SVG implementation. Not currently used by `svgRenderer.ts` (designed for future refactor where layout calls `Painter` methods instead of building strings directly).

The active rendering path is:
```
renderToSVG(renderedScore, opts?)
  → renderPage(page, sp, title, pageWidth, marginTop)
      → renderSystem(system, sp)
          → renderStaffLines(system, sp)
          → renderMeasure(measure, sp)
              → renderClef / renderKeySig / renderTimeSig
              → renderBarline / renderChordSymbol / renderTie / renderTuplet / renderBeam / renderNote
```

---

## 13.2 `renderToSVG()` — Main Entry Point

**Signature:** `export function renderToSVG(renderedScore: RenderedScore, renderOptions?: RenderOptions): string` — `svgRenderer.ts:535`

**Input:**
- `renderedScore: RenderedScore` — full rendered score from vertical layout
- `renderOptions?: RenderOptions` — optional overrides (page size, spatium, margins)

**Algorithm:**
```
opts = merge(DEFAULT_RENDER_OPTIONS, renderOptions)
sp = opts.spatium
totalHeight = pages.length × opts.pageHeight
width = opts.pageWidth
title = renderedScore.metadata.title

parts = [
  <svg> root element (width, totalHeight, viewBox="0 0 width totalHeight", background white),
  renderFontDefs(),   // inline @font-face
  HTML comment with title,
  <g class="score-content">,
]

for each page in renderedScore.pages:
  parts.push(renderPage(page, sp, title, width, opts.marginTop))

parts.push(</g>, </svg>)
return parts.join('\n')
```

**Output:** Complete self-contained SVG string.

---

## 13.3 `renderFontDefs()` — Inline Font Declarations

**Signature:** `function renderFontDefs(): string` — `svgRenderer.ts:67`

Embeds 5 `@font-face` declarations inside `<defs><style>`:

| Font | File | Usage |
|------|------|-------|
| `Leland` | `/fonts/Leland.woff2` | All notation glyphs (SMuFL) |
| `Bravura` | `/fonts/Bravura.woff2` | Fallback notation font |
| `Edwin` (normal) | `/fonts/Edwin-Roman.woff2` | Chord symbols, text markings |
| `Edwin` (italic) | `/fonts/Edwin-Italic.woff2` | Tuplet numbers, italic text |
| `LelandText` | `/fonts/LelandText.woff2` | Text-style notation (dynamics) |

**Design:** Self-contained SVG — renders correctly without external CSS. Fonts referenced via relative URL `/fonts/...`.

---

## 13.4 Helper Functions

### 13.4.1 `esc()` — `svgRenderer.ts:60`
```
function esc(s: string): string
```
XML-escapes `&`, `<`, `>`, `"`. Used for element IDs and text content.

### 13.4.2 `n()` — `svgRenderer.ts:64`
```
function n(x: number, d = 1): string
```
Formats number to `d` decimal places (default 1). All coordinates emitted as `x.toFixed(1)`.

### 13.4.3 `INK` constant — `svgRenderer.ts:57`
```
const INK = '#1a1a1a'
```
Default ink color for all elements (near-black, softer than pure `#000`).

---

## 13.5 `renderStaffLines()` — `svgRenderer.ts:105`

**Signature:** `function renderStaffLines(system: RenderedSystem, sp: number): string`

**Algorithm:**
```
lw = max(1, ENGRAVING.staffLineThickness × sp)   // min 1px to avoid sub-pixel disappearance
for each staff in system.staves:
  for i = 0..4:
    y = staff.lineYs[i]
    emit <line x1=system.x y1=y x2=system.x+system.width y2=y stroke=INK stroke-width=lw>
```

**Constants:**
- `ENGRAVING.staffLineThickness = 0.11` sp (from `leland.ts:125`)

---

## 13.6 `renderClef()` — `svgRenderer.ts:118`

**Signature:** `function renderClef(clef: RenderedClefSymbol, sp: number): string`

**Algorithm:**
```
fs = smuflFontSize(sp)   // = 4 × sp
staffTop = clef.y

switch (clef.clef):
  'treble': glyph = LELAND_G_CLEF, yAnchor = staffTop + 3×sp   // G line (2nd from bottom)
  'bass':   glyph = LELAND_F_CLEF, yAnchor = staffTop + 1×sp   // F line (4th from bottom)
  default:  glyph = LELAND_C_CLEF, yAnchor = staffTop + 2×sp   // middle line

emit <text x=clef.x y=yAnchor font-family=LELAND_FONT font-size=fs fill=INK class="map-clef">
```

**Key insight:** SMuFL clef anchor = the named line (G for treble, F for bass, C for alto/tenor).

---

## 13.7 `renderKeySig()` — `svgRenderer.ts:146`

**Signature:** `function renderKeySig(ks: RenderedKeySignature, sp: number): string`

**Algorithm:**
```
if ks.accidentals empty → return ''
fs = smuflFontSize(sp)
for each acc in ks.accidentals:
  glyph = LELAND_SHARP / LELAND_FLAT / LELAND_NATURAL (by acc.type)
  emit <text x=acc.x y=acc.y font-family=LELAND_FONT font-size=fs>
```

Positions (`acc.x`, `acc.y`) are pre-computed by vertical layout — renderer just places glyphs.

---

## 13.8 `renderTimeSig()` — `svgRenderer.ts:160`

**Signature:** `function renderTimeSig(ts: RenderedTimeSignature, sp: number): string`

**Algorithm:**
```
fs = smuflFontSize(sp)
topGlyph = lelandTimeSigGlyph(ts.beats)       // e.g. 4 → '\uE084'
botGlyph = lelandTimeSigGlyph(ts.beatType)     // e.g. 4 → '\uE084'
emit 2 <text> elements at (ts.x, ts.yNumerator) and (ts.x, ts.yDenominator)
  text-anchor="middle" (centered horizontally)
```

---

## 13.9 `renderBarline()` — `svgRenderer.ts:189`

**Signature:** `function renderBarline(bl: RenderedBarline, sp: number): string`

**Style constants** (from `styledef.cpp:131-137`, verbatim):

| Constant | Sid name | Value (sp) | Variable |
|----------|----------|------------|----------|
| Thin barline width | `Sid::barWidth` | 0.18 | `lw` |
| Thick barline width | `Sid::endBarWidth` | 0.55 | `lw2` |
| End bar distance | `Sid::endBarDistance` | 0.37 | `eDist` |
| Double bar distance | `Sid::doubleBarDistance` | 0.37 | `dDist` |
| Repeat dot separation | `Sid::repeatBarlineDotSeparation` | 0.37 | `dotSep` |
| Repeat dot radius | `symBbox(repeatDot).width()/2` | 0.25 | `dotR` |

**Switch cases:**

| Type | SVG elements | Formula (from C++ `barline.cpp`) |
|------|-------------|----------------------------------|
| `regular` | 1 line | center = ox + lw/2 (`:587-591`) |
| `double` | 2 lines | cx1 = ox + lw/2, cx2 = cx1 + lw/2 + dDist + lw/2 (`:621-628`) |
| `final` | thin + thick | Inverted from right edge: cxThin = ox - lw2 - eDist - lw/2, cxThick = ox - lw2/2 (`:608-618`) |
| `repeat-start` | thick + thin + 2 dots | Draws leftward from ox. cxThick = ox - dotW - dotSep - lw - eDist - lw2/2 (`:661-678`) |
| `repeat-end` | 2 dots + thin + thick | Inverted from right edge. cxThick = ox - lw2/2, dots at ox - total + dotW (`:681-700`) |
| `default` | 1 line | Fallback: center = ox + lw/2 |

**Repeat dots:** Two `LELAND_REPEAT_DOT` glyphs placed at `mid ± 0.5×sp` (2nd and 3rd staff spaces from center).

---

## 13.10 `renderRest()` — `svgRenderer.ts:302`

**Signature:** `function renderRest(rn: RenderedNote, sp: number): string`

**Algorithm:**
```
fs = smuflFontSize(sp)
halfSp = sp / 2
staffTop = rn.y - rn.staffLine × halfSp

switch (rn.noteheadType):
  'whole': glyph at (rn.x, staffTop + sp)      // hangs below 2nd line from top
  'half':  glyph at (rn.x, staffTop + 2×sp)    // sits on middle line
  else:    glyph at (rn.x, staffTop + 2×sp)    // center of staff

Wrapped in <g class="rest" id=noteId data-measure data-beat>
```

---

## 13.11 `renderNote()` — `svgRenderer.ts:324`

**Signature:** `function renderNote(rn: RenderedNote, sp: number): string`

**Algorithm (order of rendering):**

1. **Early return:** if `rn.isRest` → delegate to `renderRest()`
2. **Ledger lines:** `ENGRAVING.legerLineThickness × sp` width, from `rn.ledgerLines[].{x1, y, x2}`
3. **Stem:** if `rn.hasStem` → `<line>` from `(stemX, stemYTop)` to `(stemX, stemYBottom)`, width = `ENGRAVING.stemThickness × sp`
4. **Notehead:** SMuFL glyph at `(rn.x, rn.y)`. Glyph selected by `rn.noteheadType`:
   - `'whole'` → `LELAND_NOTEHEAD_WHOLE` (U+E0A2)
   - `'half'` → `LELAND_NOTEHEAD_HALF` (U+E0A3)
   - else → `LELAND_NOTEHEAD_BLACK` (U+E0A4)
5. **Accidental:** if `rn.accidental && rn.accidentalX` → `lelandAccidentalGlyph()` at `(accidentalX, rn.y)`
6. **Flag:** if `rn.hasStem && !rn.beamGroupId` → `lelandFlagGlyph(durationType, stemUp)` at `(stemX, stemYTop|stemYBottom)`
7. **Augmentation dots:** if `rn.dotted` → `LELAND_AUGMENTATION_DOT` at `(dotX, dotY)`.
   - **Line adjustment:** if `staffLine % 2 === 0` (on a line) → `dotY = rn.y - halfSp` (shift up to space)
   - Second dot at `dot2X` if `doubleDotted`

**Wrapper:** `<g class="note" id=noteId data-measure data-beat data-voice>`

---

## 13.12 `renderBeam()` — `svgRenderer.ts:405`

**Signature:** `function renderBeam(beam: RenderedBeam, sp: number): string`

**Algorithm:**
```
beamH = ENGRAVING.beamThickness × sp    // 0.50 × sp

for each levelSegs in beam.segments:     // beam.segments[level][segIdx]
  for each seg in levelSegs:
    // Compute oriented rectangle as polygon (rotated by beam slope)
    dx = seg.x2 - seg.x1
    dy = seg.y2 - seg.y1
    len = sqrt(dx² + dy²) || 1
    nx = -dy / len                       // unit normal x
    ny =  dx / len                       // unit normal y
    half = beamH / 2
    4 corners = seg endpoints ± normal × half
    emit <polygon class="beam" points="p1 p2 p3 p4" fill=INK>
```

**Key design:** Beam is a filled polygon (not a thick line) to correctly handle sloped beams with uniform thickness perpendicular to slope.

---

## 13.13 `renderChordSymbol()` — `svgRenderer.ts:429`

**Signature:** `function renderChordSymbol(cs: RenderedChordSymbol, sp: number): string`

```
fs = sp × 1.4    // editorial-size text, slightly larger than 1 staff space
emit <text id=svgId class="harmony" x y font-family=EDWIN_FONT font-size=fs>
```

**Constants:** font size = `1.4 × sp` (`svgRenderer.ts:430`)

---

## 13.14 `renderTuplet()` — `svgRenderer.ts:435`

**Signature:** `function renderTuplet(t: RenderedTuplet, sp: number): string`

**Algorithm:**
```
bw = ENGRAVING.tupletBracketThickness × sp    // 0.10 × sp

if t.bracket:
  gapW = sp × 1.8                             // gap in bracket for number
  mid = (bracket.x1 + bracket.x2) / 2
  // Horizontal bracket: two halves with gap for number
  emit <line> from x1 to (mid - gapW/2) at y1
  emit <line> from (mid + gapW/2) to x2 at y1
  // Vertical hooks at both ends (toward staff)
  dir = t.above ? 1 : -1
  emit <line> x1 vertical hook, height = hookHeight × dir
  emit <line> x2 vertical hook

// Number (italic)
numY = t.above ? t.numberY - 0.2×sp : t.numberY + 0.55×sp
emit <text text-anchor="middle" font-family=EDWIN_FONT font-size=1.3×sp font-style="italic">
```

**Constants:**
- Bracket gap: `1.8 × sp` (`svgRenderer.ts:441`)
- Number font size: `1.3 × sp` (`svgRenderer.ts:449`)
- Number Y adjust: `-0.2 × sp` (above) / `+0.55 × sp` (below) (`svgRenderer.ts:448`)

---

## 13.15 `renderTieArc()` and `renderTie()` — `svgRenderer.ts:460, 475`

### `renderTieArc()`
**Signature:** `function renderTieArc(path: BezierArc, above: boolean, sp: number): string`

**Algorithm (filled lune — two bezier arcs):**
```
midT = ENGRAVING.tieMidpointThickness × sp    // 0.21 × sp
signInward = above ? 1 : -1

// Outer arc: path as-is
// Inner arc: same cx1/cx2, inset cy by midT
cy1i = cy1 + signInward × midT
cy2i = cy2 + signInward × midT

d = "M x1,y1 C cx1,cy1 cx2,cy2 x2,y2 C cx2,cy2i cx1,cy1i x1,y1 Z"
emit <path class="tie" d fill=INK stroke="none">
```

**Design:** Creates a filled crescent (lune) shape — the outer bezier arc is the visible curve, the inner arc has reduced curvature creating tapered endpoints and thicker midpoint, characteristic of engraved ties.

### `renderTie()`
**Signature:** `function renderTie(tie: RenderedTie, sp: number): string`

Handles cross-system ties by rendering two separate half-arcs:
```
if tie.crossSystem && tie.halfArcs:
  return halfArcs.map(arc → renderTieArc(arc, tie.above, sp)).join('\n')
else:
  return renderTieArc(tie.path, tie.above, sp)
```

---

## 13.16 Composition Functions

### `renderMeasure()` — `svgRenderer.ts:484`
**Signature:** `function renderMeasure(measure: RenderedMeasure, sp: number): string`

Rendering order within `<g class="measure" data-measure=N>`:
1. `clefDisplay` → `renderClef()`
2. `keySignatureChange` → `renderKeySig()`
3. `timeSignatureDisplay` → `renderTimeSig()`
4. All `barlines` → `renderBarline()`
5. All `chordSymbols` → `renderChordSymbol()`
6. All `ties` → `renderTie()`
7. All `tuplets` → `renderTuplet()`
8. All `beams` → `renderBeam()`
9. All `notes` → `renderNote()`

### `renderSystem()` — `svgRenderer.ts:503`
**Signature:** `function renderSystem(system: RenderedSystem, sp: number): string`

Within `<g class="system" data-system=N>`:
1. `renderStaffLines(system, sp)`
2. For each measure → `renderMeasure(measure, sp)`

### `renderPage()` — `svgRenderer.ts:524`
**Signature:** `function renderPage(page: RenderedPage, sp: number, title: string, pageWidth: number, marginTop: number): string`

Within `<g class="page" data-page=N>`:
1. White background rect at `y = pageIndex × page.height`
2. Title (page 0 only) → `renderTitle()`
3. For each system → `renderSystem(system, sp)`

### `renderTitle()` — `svgRenderer.ts:512`
**Signature:** `function renderTitle(title: string, pageWidth: number, marginTop: number, sp: number): string`

```
if !title → return ''
cx = pageWidth / 2
fontSize = round(22 × (360/72))    // = 110px (22pt at 360dpi)
y = marginTop + 83                 // px — baseline position
emit <text text-anchor="middle" font-family="Edwin, 'Times New Roman', serif" class="score-title">
```

**Constants:** font size = 110px (`svgRenderer.ts:518`), baseline offset = 83px from marginTop (`svgRenderer.ts:519`)

---

## 13.17 `Painter` Interface — `painter/Painter.ts:73`

**Purpose:** Abstract drawing API separating layout logic from physical output. Designed for future use — layout calls `Painter` methods, `SVGPainter` produces SVG, future implementations could target Canvas/WebGL/PDF.

**Type alias:** `ElementType` (`Painter.ts:16`) — union of 22 element type strings:
`'note' | 'rest' | 'measure' | 'barline' | 'clef' | 'keysig' | 'timesig' | 'beam' | 'tie' | 'slur' | 'dynamic' | 'hairpin' | 'chord-symbol' | 'tuplet' | 'articulation' | 'ledger' | 'staff' | 'system' | 'page' | 'title' | 'tempo' | 'rehearsal' | 'volta' | 'grace-note'`

**Interface:** `ElementMetadata` (`Painter.ts:42`) — connects graphic elements to musical data:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `ElementType` | Element kind for hit-testing |
| `measureNum` | `number` | 1-based measure number |
| `staffIndex` | `number` | 0-based staff index |
| `beat?` | `number` | Fractional beat (1.0 = beat 1) |
| `noteId?` | `string` | Stable noteMap ID (e.g. `"note-m4b300-E5"`) |
| `voice?` | `number` | 1-based voice number |

**`Painter` interface methods:**

| Method | Signature | SVG equivalent |
|--------|-----------|----------------|
| `drawGlyph` | `(x, y, codepoint, fontSize, color?)` | `<text>` with SMuFL char |
| `drawLine` | `(x1, y1, x2, y2, strokeWidth, color?)` | `<line>` |
| `drawFilledPath` | `(d, fill)` | `<path>` |
| `drawText` | `(x, y, text, fontFamily, fontSize, anchor?, color?)` | `<text>` |
| `beginGroup` | `(id, meta: ElementMetadata)` | `<g>` with data-attributes |
| `endGroup` | `()` | `</g>` |
| `setViewport` | `(width, height)` | SVG root dimensions |
| `getOutput` | `(): string` | Complete SVG string |

---

## 13.18 `SVGPainter` Class — `painter/SVGPainter.ts:21`

**Signature:** `export class SVGPainter implements Painter`

**Internal state:**
- `parts: string[]` — accumulated SVG fragments
- `width, height: number` — viewport
- `groupDepth: number` — nesting counter for safety net

### Methods

**`setViewport(width, height)`** (`SVGPainter.ts:31`) — stores dimensions.

**`beginGroup(id, meta)`** (`SVGPainter.ts:40`) — emits `<g>` with data-attributes:
```
attrs = [id="...", data-type, data-measure, data-staff]
if meta.noteId  → data-note-id="..."
if meta.beat    → data-beat="..."
if meta.voice   → data-voice="..."
emit <g ${attrs.join(' ')}>
groupDepth++
```

**`endGroup()`** (`SVGPainter.ts:53`) — emits `</g>`, decrements depth.

**`drawGlyph(x, y, codepoint, fontSize, color?)`** (`SVGPainter.ts:62`) — emits `<text>` with `codepointToChar(codepoint)`. Font = `"Leland"`, text-anchor = `"start"`, dominant-baseline = `"auto"`.

**`drawLine(x1, y1, x2, y2, strokeWidth, color?)`** (`SVGPainter.ts:74`) — emits `<line>` with `stroke-linecap="round"`.

**`drawFilledPath(d, fill)`** (`SVGPainter.ts:82`) — emits `<path d="..." fill="..."/>`.

**`drawText(x, y, text, fontFamily, fontSize, anchor?, color?)`** (`SVGPainter.ts:86`) — emits `<text>` with `escapeText()` content.

**`getOutput()`** (`SVGPainter.ts:109`) — closes any unclosed groups (safety net), wraps body in `<svg>` root, resets state for next page.

**`prependFontFaces(fontFaceCSS)`** (`SVGPainter.ts:135`) — unshifts `<defs><style>` to parts array. Called on first page only.

### Helper functions (module-level)

| Function | Line | Purpose |
|----------|------|---------|
| `r(n)` | `SVGPainter.ts:145` | Round to 2 decimal places: `Math.round(n * 100) / 100` |
| `escapeAttr(s)` | `SVGPainter.ts:150` | Escape `&`, `"`, `<` for XML attributes |
| `escapeText(s)` | `SVGPainter.ts:155` | Escape `&`, `<`, `>` for XML text content |
| `codepointToChar(cp)` | `SVGPainter.ts:163` | Convert codepoint string to Unicode char. Accepts: `\uE0A4`, `&#xE0A4;`, `E0A4` (hex), or already a char. Uses `String.fromCodePoint(parseInt(hex, 16))` |

**Constant:** `DEFAULT_COLOR = '#1a1a1a'` (`SVGPainter.ts:19`) — same as `INK` in svgRenderer.

---

## 13.19 Delta from C++ (Chapter 17)

| Aspect | C++ (webmscore) | MAP TS | Impact |
|--------|----------------|--------|--------|
| **Rendering API** | `Painter` abstract class with `drawSymbol()`, `drawLine()`, `drawArc()`, `translate()`, `save()/restore()` | `svgRenderer.ts` builds SVG strings directly; `Painter` interface exists but unused | No transform stack, no coordinate push/pop |
| **Font system** | `ScoreFont` class with `bbox()`, `advance()`, `stemUpSE()` — supports Bravura, Leland, Petaluma, etc. | Hardcoded Leland codepoints + Bravura anchor data | Leland-only rendering |
| **Glyph rendering** | `drawSymbol()` → `QPainter::drawText()` with ScoreFont | `<text>` element with font-family="Leland" | Functionally equivalent for SVG output |
| **Transform stack** | `Painter::save()/restore()`, `translate()`, `scale()`, `rotate()` | None — all coordinates are absolute pixels | Simpler but no local coordinate frames |
| **Drawing primitives** | `drawLine()`, `drawPolyline()`, `drawArc()`, `drawRect()`, `drawEllipse()`, `drawPath()`, `drawPolygon()` | `<line>`, `<polygon>`, `<path>`, `<text>` | Subset — missing drawArc, drawEllipse, drawPolyline |
| **DPI/scaling** | Painter scales via `MScore::pixelRatio` (device-dependent) | Single fixed rendering at opts.spatium pixels per sp | No device-pixel-ratio awareness |
| **Element iteration** | `Score::scanElements()` + `EngravingItem::draw(Painter*)` — each element draws itself | Top-down tree walk: page→system→measure→element | Same result, different dispatch model |
| **Tie/slur rendering** | `SlurTie::draw()` with `PainterPath` Bezier curves + `QPen` with varying width | Two-arc filled lune via `<path>` with `C` commands | Visually similar; MAP uses filled shape instead of stroked path |
| **Color system** | Per-element `color()` from `EngravingItem`, supports alpha | Fixed `INK = '#1a1a1a'` for all elements | No per-element color, no alpha |
| **Viewbox** | Coordinate system defined by `Score::spatium()` and `MScore::DPI` | `viewBox="0 0 width height"` in pixels | Direct pixel coordinates, no separate coordinate system |

---

## Extraction Summary — Session K (Chapter 13)

| File | Functions | Constants (module-level) | Classes | Interfaces/Types |
|------|-----------|--------------------------|---------|-------------------|
| `svgRenderer.ts` | 20 (1 exported, 19 internal) | 1 (`INK`) + 16 local | 0 | 0 (imports from types.ts) |
| `Painter.ts` | 0 | 0 | 0 | 2 interfaces (`ElementMetadata`, `Painter`) + 1 type (`ElementType`) |
| `SVGPainter.ts` | 4 helpers (r, escapeAttr, escapeText, codepointToChar) | 1 (`DEFAULT_COLOR`) | 1 (`SVGPainter`, 9 methods) | 0 |

---
---

# Chapter 14: Glyphs, Anchors & Font System

> **Files:** `glyphs/leland.ts` (174 lines), `glyphs/index.ts` (46 lines), `bravura/anchors.ts` (188 lines)
> **C++ parallel:** Chapter 16 (Font & Glyph System)
> **Role:** SMuFL glyph codepoints, engraving metrics, notehead anchor data, and accidental collision metrics.

## 14.1 SMuFL Glyph Codepoint Registry — `glyphs/leland.ts`

All codepoints follow the [SMuFL standard](https://www.smufl.org/), implemented in the Leland font (MuseScore's default).

### 14.1.1 Noteheads

| Constant | Codepoint | SMuFL name | Usage |
|----------|-----------|------------|-------|
| `LELAND_NOTEHEAD_WHOLE` | U+E0A2 | noteheadWhole | Whole notes |
| `LELAND_NOTEHEAD_HALF` | U+E0A3 | noteheadHalf | Half notes |
| `LELAND_NOTEHEAD_BLACK` | U+E0A4 | noteheadBlack | Quarter+ notes |
| `LELAND_NOTEHEAD_DOUBLE_WHOLE` | U+E0A0 | noteheadDoubleWhole | Breve |

### 14.1.2 Clefs

| Constant | Codepoint | Anchor line |
|----------|-----------|-------------|
| `LELAND_G_CLEF` | U+E050 | 2nd from bottom (G4), y = staffTop + 3×sp |
| `LELAND_F_CLEF` | U+E062 | 4th from bottom (F3), y = staffTop + sp |
| `LELAND_C_CLEF` | U+E05C | Middle line, y = staffTop + 2×sp |

### 14.1.3 Accidentals

| Constant | Codepoint | Line |
|----------|-----------|------|
| `LELAND_SHARP` | U+E262 | `leland.ts:31` |
| `LELAND_FLAT` | U+E260 | `leland.ts:32` |
| `LELAND_NATURAL` | U+E261 | `leland.ts:33` |
| `LELAND_DOUBLE_SHARP` | U+E263 | `leland.ts:34` |
| `LELAND_DOUBLE_FLAT` | U+E264 | `leland.ts:35` |

### 14.1.4 Rests

| Constant | Codepoint | Anchor position | Line |
|----------|-----------|-----------------|------|
| `LELAND_REST_WHOLE` | U+E4E3 | Hangs below 2nd line from top (staffTop + sp) | `leland.ts:39` |
| `LELAND_REST_HALF` | U+E4E4 | Sits on middle line (staffTop + 2×sp) | `leland.ts:41` |
| `LELAND_REST_QUARTER` | U+E4E5 | Center of staff | `leland.ts:42` |
| `LELAND_REST_EIGHTH` | U+E4E6 | Center of staff | `leland.ts:43` |
| `LELAND_REST_16TH` | U+E4E7 | Center of staff | `leland.ts:44` |
| `LELAND_REST_32ND` | U+E4E8 | Center of staff | `leland.ts:45` |
| `LELAND_REST_64TH` | U+E4E9 | Center of staff | `leland.ts:46` |

### 14.1.5 Flags

| Constant | Codepoint | Direction | Line |
|----------|-----------|-----------|------|
| `LELAND_FLAG_8TH_UP` | U+E240 | Stem up | `leland.ts:50` |
| `LELAND_FLAG_8TH_DOWN` | U+E241 | Stem down | `leland.ts:52` |
| `LELAND_FLAG_16TH_UP` | U+E242 | Stem up | `leland.ts:53` |
| `LELAND_FLAG_16TH_DOWN` | U+E243 | Stem down | `leland.ts:54` |
| `LELAND_FLAG_32ND_UP` | U+E244 | Stem up | `leland.ts:55` |
| `LELAND_FLAG_32ND_DOWN` | U+E245 | Stem down | `leland.ts:56` |

### 14.1.6 Dots & Repeats

| Constant | Codepoint | Usage | Line |
|----------|-----------|-------|------|
| `LELAND_AUGMENTATION_DOT` | U+E1E7 | Augmentation dots | `leland.ts:59` |
| `LELAND_REPEAT_DOT` | U+E044 | Repeat barline dots | `leland.ts:63` |

### 14.1.7 Time Signatures

| Constant | Value | Line |
|----------|-------|------|
| `LELAND_TIME_SIG` | `Record<0-9, string>`: U+E080..U+E089 | `leland.ts:67` |
| `LELAND_TIME_SIG_COMMON` | U+E08A | `leland.ts:71` |
| `LELAND_TIME_SIG_CUT_COMMON` | U+E08B | `leland.ts:72` |

### 14.1.8 Dynamics

| Constant | Codepoint | Meaning | Line |
|----------|-----------|---------|------|
| `LELAND_DYNAMIC_P` | U+E520 | piano | `leland.ts:76` |
| `LELAND_DYNAMIC_M` | U+E521 | mezzo | `leland.ts:80` |
| `LELAND_DYNAMIC_F` | U+E522 | forte | `leland.ts:78` |
| `LELAND_DYNAMIC_R` | U+E523 | rinforzando | `leland.ts:82` |
| `LELAND_DYNAMIC_S` | U+E524 | sforzando | `leland.ts:84` |
| `LELAND_DYNAMIC_Z` | U+E525 | sforzato | `leland.ts:86` |
| `LELAND_DYNAMIC_N` | U+E526 | niente | `leland.ts:88` |

---

## 14.2 Font Family Strings

| Constant | Value | Usage | Line |
|----------|-------|-------|------|
| `LELAND_FONT` | `'Leland, Bravura, serif'` | All notation glyphs | `leland.ts:91` |
| `LELAND_TEXT_FONT` | `'LelandText, Leland, serif'` | Text-style notation | `leland.ts:92` |
| `EDWIN_FONT` | `'"Edwin", "Edwin-Roman", Georgia, "Times New Roman", serif'` | Chord symbols, titles, tuplet numbers | `leland.ts:93` |

---

## 14.3 `ENGRAVING` Constants — `leland.ts:124`

**Source:** `webmscore/fonts/leland/leland_metadata.json → engravingDefaults`

All values in **staff-spaces** (multiply by spatium for pixels):

| Property | Value (sp) | Usage |
|----------|-----------|-------|
| `staffLineThickness` | 0.11 | Staff line stroke width |
| `stemThickness` | 0.10 | Stem stroke width |
| `beamThickness` | 0.50 | Beam polygon height |
| `beamSpacing` | 0.25 | Gap between stacked beams |
| `legerLineThickness` | 0.16 | Ledger line stroke width |
| `legerLineExtension` | 0.35 | Ledger line overhang beyond notehead |
| `thinBarlineThickness` | 0.18 | Regular/double barline width |
| `thickBarlineThickness` | 0.55 | Final/repeat barline thick line |
| `barlineSeparation` | 0.37 | Gap between barline elements |
| `slurEndpointThickness` | 0.07 | Slur taper at endpoints |
| `slurMidpointThickness` | 0.21 | Slur maximum thickness at midpoint |
| `tieEndpointThickness` | 0.07 | Tie taper at endpoints |
| `tieMidpointThickness` | 0.21 | Tie maximum thickness at midpoint |
| `tupletBracketThickness` | 0.10 | Tuplet bracket line width |
| `repeatBarlineDotSep` | 0.37 | Gap between repeat dots and barline |

Declared as `as const` for type safety.

---

## 14.4 Glyph Lookup Functions

### `smuflFontSize(spatium)` — `leland.ts:100`
```typescript
export function smuflFontSize(spatium: number): number {
  return spatium * 4    // SMuFL convention: 1 em = 4 staff-spaces
}
```

### `sp(staffSpaces, spatium)` — `leland.ts:143`
```typescript
export function sp(staffSpaces: number, spatium: number): number {
  return staffSpaces * spatium
}
```

### `lelandAccidentalGlyph(type)` — `leland.ts:105`
Maps `AccidentalType` string to Leland codepoint. Courtesy accidentals map to same glyph as regular (sharp/flat/natural). Returns `''` for unknown types.

### `lelandTimeSigGlyph(num)` — `leland.ts:148`
```typescript
export function lelandTimeSigGlyph(num: number): string {
  return String(num).split('').map(d => LELAND_TIME_SIG[Number(d)] ?? d).join('')
}
```
Converts multi-digit number to concatenated time signature glyphs (e.g. `12` → U+E081 + U+E082).

### `lelandRestGlyph(noteheadType)` — `leland.ts:153`
Maps duration string (`'whole'`..`'64th'`) to rest glyph codepoint. Default: quarter rest.

### `lelandFlagGlyph(noteheadType, stemUp)` — `leland.ts:167`
Maps duration + stem direction to flag glyph. Returns `null` for durations without flags (quarter and longer).

---

## 14.5 `glyphs/index.ts` — Barrel Export + Legacy API

**File:** `glyphs/index.ts` (46 lines)

Re-exports all constants and functions from `leland.ts`. Additionally provides **legacy re-export aliases** for backward compatibility:

| Legacy name | Maps to | Line |
|-------------|---------|------|
| `clefFontSize` | `smuflFontSize` | `index.ts:42` |
| `accFontSize` | `smuflFontSize` | `index.ts:43` |
| `timeSigFontSize` | `smuflFontSize` | `index.ts:44` |
| `dynamFontSize` | `smuflFontSize` | `index.ts:45` |
| `accidentalGlyph` | `lelandAccidentalGlyph` | `index.ts:46` |

All map to the same function — unified under `smuflFontSize()` since SMuFL convention is uniform `4 × spatium` for all glyph types.

---

## 14.6 `GlyphAnchor` Interface — `anchors.ts:19`

```typescript
export interface GlyphAnchor {
  stemUpNW?:   readonly [number, number]   // stem-up attachment point
  stemDownSW?: readonly [number, number]   // stem-down attachment point
  cutOutNW?:   readonly [number, number]   // upper-left cutout for flag
  cutOutSW?:   readonly [number, number]   // lower-left cutout for flag
  opticalCenter?: readonly [number, number] // for centering (e.g. rests)
}
```

**Coordinate system:** SMuFL — x positive = right, y positive = UP. Negate y when converting to screen coordinates.

---

## 14.7 `NOTEHEAD_ANCHORS` — `anchors.ts:44`

**Source:** Bravura 1.392 `bravura_metadata.json § glyphsWithAnchors`

**Mapping convention** (Bravura → MAP):
- `stemUpSE.x` → `stemUpNW.x` (right edge of notehead)
- `stemUpSE.y` → `stemUpNW.y` (y below center in SMuFL)
- `stemDownNW.x` → `stemDownSW.x` (left edge = 0)
- `stemDownNW.y` → `stemDownSW.y` (y above center in SMuFL)

| Glyph name | stemUpNW [x,y] | stemDownSW [x,y] | Usage |
|------------|---------------|-------------------|-------|
| `noteheadBlack` | [1.18, -0.168] | [0.0, 0.168] | Quarter, eighth, 16th+ |
| `noteheadHalf` | [1.18, -0.14] | [0.0, 0.14] | Half notes |
| `noteheadWhole` | [0, 0] | [0, 0] | Whole notes (no stem, spacing ref) |
| `noteheadXBlack` | [-0.168, 0.168] | [-0.168, -0.168] | Percussion |
| `noteheadDiamondBlack` | [0, 0.5] | [0, -0.5] | Harmonics |
| `noteheadSlashHorizontalEnds` | [0, 0.5] | [0, -0.5] | Rhythm notation |

---

## 14.8 `FLAG_ANCHORS` — `anchors.ts:88`

All flag anchors have cutout at `[0, 0]` (flag meets stem tip with no offset):

Entries: `flag8thUp`, `flag8thDown`, `flag16thUp`, `flag16thDown`, `flag32ndUp`, `flag32ndDown`, `flag64thUp`, `flag64thDown`.

---

## 14.9 Accidental Metric Tables — `anchors.ts:104, 118`

### `ACCIDENTAL_WIDTHS_SP` — `anchors.ts:104`
Used for horizontal stacking when multiple accidentals appear in one chord.

| Type | Width (sp) |
|------|-----------|
| `sharp` | 1.0 |
| `flat` | 0.65 |
| `natural` | 0.9 |
| `double-sharp` | 1.1 |
| `double-flat` | 1.4 |
| `courtesy-sharp` | 1.0 |
| `courtesy-flat` | 0.65 |
| `courtesy-natural` | 0.9 |

### `ACCIDENTAL_HEIGHTS_SP` — `anchors.ts:118`
Used for vertical collision detection during stacking.

| Type | Height (sp) |
|------|------------|
| `sharp` | 3.0 |
| `flat` | 3.5 |
| `natural` | 3.0 |
| `double-sharp` | 1.5 |
| `double-flat` | 3.5 |
| `courtesy-sharp` | 3.0 |
| `courtesy-flat` | 3.5 |
| `courtesy-natural` | 3.0 |

---

## 14.10 Anchor Utility Functions

### `getNoteheadAnchor(glyphName)` — `anchors.ts:137`
```typescript
export function getNoteheadAnchor(glyphName: string): GlyphAnchor {
  return NOTEHEAD_ANCHORS[glyphName] ?? NOTEHEAD_ANCHORS.noteheadBlack
}
```
Fallback to `noteheadBlack` if glyph not found.

### `anchorToPx(anchor, spatiumPx)` — `anchors.ts:149`
```typescript
export function anchorToPx(
  anchor: readonly [number, number], spatiumPx: number
): readonly [number, number] {
  return [anchor[0] * spatiumPx, -anchor[1] * spatiumPx]
}
```
**Key:** Negates y to convert SMuFL (y-up) → screen (y-down).

### `stemAttachX(glyphName, stemUp, spatiumPx)` — `anchors.ts:164`
Returns pixel offset from notehead LEFT EDGE to stem X position.
```
up-stem:   stemUpNW.x × sp  = 1.18 × sp (right edge)
down-stem: stemDownSW.x × sp = 0.0 (left edge)
```
Fallback: `[1.18, -0.168]` for up, `[0.0, 0.168]` for down.

### `stemAttachY(glyphName, stemUp, spatiumPx)` — `anchors.ts:182`
Returns pixel offset from notehead CENTER to stem Y position (screen coords, positive = down).
```
up-stem:   anchorToPx(stemUpNW)   → +0.168×sp below center
down-stem: anchorToPx(stemDownSW) → -0.168×sp above center
```

---

## 14.11 Delta from C++ (Chapter 16)

| Aspect | C++ (webmscore) | MAP TS | Impact |
|--------|----------------|--------|--------|
| **Font support** | `ScoreFont` class supporting Bravura, Leland, Petaluma, Gonville, MuseJazz + any SMuFL font | Hardcoded Leland codepoints only | Leland-only rendering |
| **Glyph metrics** | `ScoreFont::bbox()`, `advance()`, `stemUpSE()`, `stemDownNW()` — runtime lookup from font metadata JSON | Compile-time constants in `NOTEHEAD_ANCHORS`, `ACCIDENTAL_WIDTHS_SP` | No runtime font metric lookup |
| **Anchor source** | Full `glyphsWithAnchors` from font metadata (hundreds of glyphs) | 6 notehead types + 8 flag types | Missing: rest anchors, dynamics anchors, articulation anchors |
| **Codepoint count** | ~350+ SymId values in `symNames[]` | ~40 named constants | Subset — covers core notation |
| **Font size formula** | `ScoreFont::pixelSize(spatium) = 20.0 × spatium / 5.0 = 4 × spatium` | `smuflFontSize = 4 × spatium` | Identical formula |
| **Engr. defaults** | From font metadata JSON (`engravingDefaults`), selected at runtime | `ENGRAVING` const object, 15 properties from Leland metadata | Hardcoded, Leland-only values |
| **Accidental metrics** | Per-glyph from `ScoreFont::bbox()` — exact advance widths | Hardcoded `ACCIDENTAL_WIDTHS_SP` / `HEIGHTS_SP` (8 types) | Leland-specific; some values differ from bbox-derived (see Session I gaps) |

---

## Extraction Summary — Session K (Chapter 14)

| File | Functions | Constants (exported) | Classes | Interfaces/Types |
|------|-----------|----------------------|---------|-------------------|
| `leland.ts` | 6 (`smuflFontSize`, `lelandAccidentalGlyph`, `sp`, `lelandTimeSigGlyph`, `lelandRestGlyph`, `lelandFlagGlyph`) | 37 (noteheads×4 + clefs×3 + accidentals×5 + rests×7 + flags×6 + dots×2 + timeSig×3 + dynamics×7 + fonts×3 + ENGRAVING) | 0 | 0 |
| `index.ts` | 0 (re-exports only) | 0 | 0 | 0 |
| `anchors.ts` | 4 (`getNoteheadAnchor`, `anchorToPx`, `stemAttachX`, `stemAttachY`) | 4 (`NOTEHEAD_ANCHORS`, `FLAG_ANCHORS`, `ACCIDENTAL_WIDTHS_SP`, `ACCIDENTAL_HEIGHTS_SP`) | 0 | 1 (`GlyphAnchor`) |

---
---

# Chapter 15: Types & Data Structures

> **Files:** `types.ts` (494 lines), `spatium.ts` (66 lines)
> **C++ parallel:** No direct equivalent — C++ uses classes with inheritance (`EngravingItem`, `Note`, `Chord`, etc.)
> **Role:** Output type definitions of the layout engine → input to SVG renderer. All coordinates in pixels.

## 15.1 Unit System — `spatium.ts`

### Type Aliases

| Type | Definition | Usage | Line |
|------|-----------|-------|------|
| `Sp` | `number` | Staff-space units (layout calculations) | `spatium.ts:13` |
| `Px` | `number` | Pixel units (final output / painting) | `spatium.ts:16` |

### Constants

| Constant | Value | Source | Line |
|----------|-------|--------|------|
| `DEFAULT_SPATIUM_MM` | `1.75` | MuseScore standard (1 spatium = 1.75mm) | `spatium.ts:19` |
| `STAFF_HEIGHT_SP` | `4.0` | 4 intervals between 5 lines × 1sp each | `spatium.ts:60` |
| `MIDDLE_LINE` | `4` | Staff line index of B4 in treble clef (stem direction threshold) | `spatium.ts:66` |

### Functions

**`spToPx(sp, spatiumPx)`** — `spatium.ts:26`
```typescript
export function spToPx(sp: Sp, spatiumPx: Px): Px {
  return sp * spatiumPx
}
```

**`pxToSp(px, spatiumPx)`** — `spatium.ts:35`
```typescript
export function pxToSp(px: Px, spatiumPx: Px): Sp {
  return px / spatiumPx
}
```

**`lineToY(staffLine, staffTopPx, spatiumPx)`** — `spatium.ts:52`
```typescript
export function lineToY(staffLine: number, staffTopPx: Px, spatiumPx: Px): Px {
  return staffTopPx + staffLine * spatiumPx * 0.5
}
```
Staff lines numbered from 0 (top): lines 0,2,4,6,8 are the 5 staff lines; spaces 1,3,5,7; ledger above: -2,-4,...; ledger below: 10,12,...

---

## 15.2 Score Hierarchy

### `RenderedScore` — `types.ts:13`
```typescript
export interface RenderedScore {
  pages: RenderedPage[]
  metadata: ScoreRenderMetadata
  allNotes: RenderedNote[]                    // flat array for fast lookup
  elementMap: Map<string, DOMRectLike>        // "measure-N" (0-based) → bbox
}
```

### `ScoreRenderMetadata` — `types.ts:22`
```typescript
export interface ScoreRenderMetadata {
  title: string
  composer: string
  keySignature: string
  timeSignature: string
  tempo?: number
  measureCount: number
  pageCount: number
}
```

### `DOMRectLike` — `types.ts:32`
```typescript
export interface DOMRectLike {
  x: number; y: number; width: number; height: number
  top: number; left: number; right: number; bottom: number
}
```
Compatible with browser `DOMRect` — used as drop-in for existing MAP code that reads Verovio element bboxes.

---

## 15.3 Page & System

### `RenderedPage` — `types.ts:47`
| Field | Type | Description |
|-------|------|-------------|
| `pageIndex` | `number` | 0-based |
| `width` | `number` | Page width (px) |
| `height` | `number` | Page height (px) |
| `systems` | `RenderedSystem[]` | Systems on this page |

### `RenderedSystem` — `types.ts:58`
| Field | Type | Description |
|-------|------|-------------|
| `systemIndex` | `number` | 0-based within score |
| `pageIndex` | `number` | Which page |
| `x` | `number` | Left edge (after margin) |
| `y` | `number` | Top of first staff |
| `width` | `number` | Usable width (after margins) |
| `staves` | `RenderedStaff[]` | Staff definitions |
| `measures` | `RenderedMeasure[]` | Measures in this system |
| `headerWidth` | `number` | Width of clef+keySig+timeSig header |

### `RenderedStaff` — `types.ts:74`
| Field | Type | Description |
|-------|------|-------------|
| `staffIndex` | `number` | 0 = top staff |
| `y` | `number` | Top of staff (first line) |
| `lineSpacing` | `number` | px between lines (= spatium) |
| `height` | `number` | = 4 × lineSpacing |
| `clef` | `ClefType` | Active clef |
| `lineYs` | `[5 numbers]` | Y of each staff line, top→bottom |

### `ClefType` — `types.ts:84`
`'treble' | 'bass' | 'alto' | 'tenor' | 'percussion'`

---

## 15.4 Measure

### `RenderedMeasure` — `types.ts:90`

| Field | Type | Description |
|-------|------|-------------|
| `measureNum` | `number` | 1-based |
| `staffIndex` | `number` | Staff index |
| `x` | `number` | Left edge (after barline) |
| `width` | `number` | Measure width (px) |
| `y` | `number` | Top of staff |
| `systemIndex` | `number` | Parent system |
| `notes` | `RenderedNote[]` | All notes+rests |
| `chordSymbols` | `RenderedChordSymbol[]` | Chord labels |
| `beams` | `RenderedBeam[]` | Beam groups |
| `barlines` | `RenderedBarline[]` | Barlines |
| `ties` | `RenderedTie[]` | Ties |
| `slurs` | `RenderedSlur[]` | Slurs |
| `dynamics` | `RenderedDynamic[]` | Dynamic markings |
| `articulations` | `RenderedArticulation[]` | Articulations |
| `ornaments` | `RenderedOrnament[]` | Ornaments |
| `tuplets` | `RenderedTuplet[]` | Tuplets |
| `keySignatureChange?` | `RenderedKeySignature` | If key changes |
| `timeSignatureDisplay?` | `RenderedTimeSignature` | If time sig shown |
| `clefDisplay?` | `RenderedClefSymbol` | If clef shown |
| `volta?` | `RenderedVolta` | Volta bracket |
| `repeatStart` | `boolean` | Has repeat start |
| `repeatEnd` | `boolean` | Has repeat end |
| `rehearsalMark?` | `string` | "A", "B", etc. |
| `tempoText?` | `string` | e.g. "Allegro ♩=120" |

---

## 15.5 Note & Related Types

### `RenderedNote` — `types.ts:127`

| Field | Type | Description |
|-------|------|-------------|
| `noteId` | `string` | Stable noteMap ID (also SVG element id) |
| `measureNum` | `number` | 1-based |
| `beat` | `number` | 1.0, 1.5, 2.0... |
| `staffIndex` | `number` | Staff index |
| `voice` | `number` | 1–4 |
| `x` | `number` | Center of notehead (px) |
| `y` | `number` | Center of notehead (px) |
| `bbox` | `DOMRectLike` | Bounding box of entire note group |
| `staffLine` | `number` | 0 = top line, increases downward |
| `noteheadType` | `NoteheadType` | Glyph shape |
| `durationType` | `string` | MusicXML duration: 'whole'..'64th' |
| `stemUp` | `boolean` | Stem direction |
| `hasStem` | `boolean` | false for whole notes |
| `stemX` | `number` | Stem X position (px) |
| `stemYTop` | `number` | Stem top Y (px) |
| `stemYBottom` | `number` | Stem bottom Y (px) |
| `accidental?` | `AccidentalType` | Accidental type |
| `accidentalX?` | `number` | Accidental left edge (px) |
| `dotted` | `boolean` | Has augmentation dot |
| `doubleDotted` | `boolean` | Has two dots |
| `dotX?` | `number` | First dot X (px) |
| `dot2X?` | `number` | Second dot X (px) |
| `ledgerLines` | `RenderedLedgerLine[]` | Ledger lines |
| `isRest` | `boolean` | Is a rest |
| `isGrace` | `boolean` | Is grace note |
| `graceScale?` | `number` | 0.65 typical |
| `beamGroupId?` | `string` | Beam group reference |
| `tieStart?` / `tieEnd?` | `boolean` | Tie membership |
| `slurStart?` / `slurEnd?` | `boolean` | Slur membership |
| `tupletId?` | `string` | Tuplet reference |

### `NoteheadType` — `types.ts:184`
`'whole' | 'half' | 'quarter' | 'x' | 'diamond' | 'triangle' | 'slash'`

### `AccidentalType` — `types.ts:193`
`'sharp' | 'flat' | 'natural' | 'double-sharp' | 'double-flat' | 'courtesy-sharp' | 'courtesy-flat' | 'courtesy-natural'`

### `RenderedLedgerLine` — `types.ts:203`
`{ y: number; x1: number; x2: number }`

---

## 15.6 Chord Symbol

### `RenderedChordSymbol` — `types.ts:213`
| Field | Type | Description |
|-------|------|-------------|
| `measureNum` | `number` | 1-based |
| `beat` | `number` | Beat position |
| `x` | `number` | Position (px) |
| `y` | `number` | Baseline (px) |
| `text` | `string` | Display text (may include Unicode ♭♯) |
| `svgId` | `string` | e.g. "chord-m4b300" |

---

## 15.7 Beam Types

### `RenderedBeam` — `types.ts:226`
| Field | Type | Description |
|-------|------|-------------|
| `groupId` | `string` | Group identifier |
| `noteIds` | `string[]` | noteMap IDs in order |
| `stemUp` | `boolean` | Stem direction |
| `levels` | `number` | 1=eighth, 2=16th, 3=32nd, 4=64th |
| `segments` | `BeamSegment[][]` | Per-level segment arrays |

### `BeamSegment` — `types.ts:239`
`{ x1: number; y1: number; x2: number; y2: number }`

---

## 15.8 Barline Types

### `RenderedBarline` — `types.ts:250`
`{ x: number; yTop: number; yBottom: number; type: BarlineType }`

### `BarlineType` — `types.ts:257`
`'regular' | 'double' | 'final' | 'heavy-heavy' | 'repeat-start' | 'repeat-end' | 'repeat-both' | 'dashed' | 'dotted' | 'none'`

---

## 15.9 Tie & Slur Types

### `RenderedTie` — `types.ts:273`
| Field | Type | Description |
|-------|------|-------------|
| `fromNoteId` / `toNoteId` | `string` | Endpoint noteMap IDs |
| `path` | `BezierArc` | Bezier control points |
| `above` | `boolean` | Arc direction |
| `crossSystem` | `boolean` | Spans system break |
| `halfArcs?` | `[BezierArc, BezierArc]` | Two halves for cross-system |

### `RenderedSlur` — `types.ts:288`
Same structure as `RenderedTie`.

### `BezierArc` — `types.ts:297`
`{ x1, y1, cx1, cy1, cx2, cy2, x2, y2: number }` — cubic Bezier: M x1,y1 C cx1,cy1 cx2,cy2 x2,y2

---

## 15.10 Key/Time/Clef Display Types

### `RenderedKeySignature` — `types.ts:312`
| Field | Type | Description |
|-------|------|-------------|
| `fifths` | `number` | Positive=sharps, negative=flats |
| `x` | `number` | Position (px) |
| `staffIndex` | `number` | Staff |
| `accidentals` | `Array<{x, y, type}>` | Individual accidental positions |

### `RenderedTimeSignature` — `types.ts:325`
| Field | Type | Description |
|-------|------|-------------|
| `beats` / `beatType` | `number` | Numerator / denominator |
| `x` | `number` | Center X (px) |
| `staffIndex` | `number` | Staff |
| `yNumerator` / `yDenominator` | `number` | Baseline Y (px) |

### `RenderedClefSymbol` — `types.ts:340`
| Field | Type | Description |
|-------|------|-------------|
| `clef` | `ClefType` | Clef kind |
| `x` | `number` | Position (px) |
| `y` | `number` | Anchor point (px) |
| `staffIndex` | `number` | Staff |
| `isChange` | `boolean` | Mid-score change (smaller) |

---

## 15.11 Expression Types

### `RenderedDynamic` — `types.ts:352`
`{ measureNum, beat, text, x, y, svgId, placement: 'above'|'below' }`

### `RenderedArticulation` — `types.ts:366`
`{ noteId, type: ArticulationType, x, y, svgId }`

### `ArticulationType` — `types.ts:374`
`'staccato' | 'staccatissimo' | 'tenuto' | 'accent' | 'strong-accent' | 'stress' | 'unstress' | 'snap-pizzicato'`

### `RenderedOrnament` — `types.ts:388`
`{ noteId, type: OrnamentType, x, y, svgId }`

### `OrnamentType` — `types.ts:396`
`'trill' | 'trill-extension' | 'turn' | 'mordent' | 'inverted-mordent' | 'tremolo' | 'wavy-line' | 'fermata' | 'fermata-square'`

### `RenderedHairpin` — `types.ts:411`
| Field | Type | Description |
|-------|------|-------------|
| `svgId` | `string` | SVG id |
| `type` | `'crescendo'|'decrescendo'` | Direction |
| `x1` / `x2` | `number` | Start/end X (px) |
| `y` | `number` | Center Y (px) |
| `openingHeight` | `number` | Half-height at wide end (px) |
| `placement` | `'above'|'below'` | Position |

---

## 15.12 Structural Types

### `RenderedTuplet` — `types.ts:425`
| Field | Type | Description |
|-------|------|-------------|
| `tupletId` | `string` | Identifier |
| `noteIds` | `string[]` | Member notes |
| `number` | `number` | 3=triplet, 5=quintuplet |
| `bracket?` | `TupletBracket` | Bracket geometry |
| `numberX` / `numberY` | `number` | Center of number text |
| `above` | `boolean` | Bracket position |

### `TupletBracket` — `types.ts:437`
`{ x1, y1, x2, y2, hookHeight: number }`

### `RenderedVolta` — `types.ts:450`
`{ number, text, x1, x2, y, openRight: boolean }`

---

## 15.13 API Types

### `RenderOptions` — `types.ts:463`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pageWidth?` | `number` | 794 | A4 portrait @96dpi |
| `pageHeight?` | `number` | 1123 | A4 portrait @96dpi |
| `spatium?` | `number` | 10 | Pixels per spatium |
| `marginTop?` | `number` | 48 | Page margin (px) |
| `marginBottom?` | `number` | 48 | Page margin (px) |
| `marginLeft?` | `number` | 48 | Page margin (px) |
| `marginRight?` | `number` | 48 | Page margin (px) |
| `staffSpacingSp?` | `number` | 6.0 | Inter-staff spacing (sp) |
| `systemSpacingSp?` | `number` | 8.0 | Inter-system spacing (sp) |

### `RenderResult` — `types.ts:485`

| Field | Type | Description |
|-------|------|-------------|
| `svg` | `string` | Complete SVG markup |
| `notes` | `RenderedNote[]` | All notes (for overlays, scripts) |
| `elementMap` | `Map<string, DOMRectLike>` | Drop-in for existing MAP code |
| `renderedScore` | `RenderedScore` | Full structure (for advanced consumers) |

---

## 15.14 `extractorTypes.ts` Cross-Reference

`extractorTypes.ts` (313 lines) defines the **input** types — pre-layout data extracted from MusicXML. Fully documented in **Chapter 3** (Session G). Key distinction:

| Aspect | `extractorTypes.ts` (Ch 3) | `types.ts` (Ch 15) |
|--------|---------------------------|---------------------|
| **Stage** | Input (XML → data) | Output (layout → SVG) |
| **Coordinates** | None (musical positions only) | All in pixels |
| **Hierarchy** | `ExtractedScore → ExtractedPart → ExtractedMeasure → ExtractedNote` | `RenderedScore → RenderedPage → RenderedSystem → RenderedMeasure → RenderedNote` |
| **Bboxes** | None | `DOMRectLike` on notes, `elementMap` on measures |
| **IDs** | None (created by layout) | `noteId` (stable noteMap IDs) |

---

## 15.15 Delta from C++ (Architecture)

| Aspect | C++ (webmscore) | MAP TS | Impact |
|--------|----------------|--------|--------|
| **Type system** | Class hierarchy: `EngravingItem` → `Note`, `Chord`, `Measure`, etc. with virtual dispatch | Flat interfaces — no inheritance, no methods | Simpler but no polymorphic `draw()` |
| **Coordinate ownership** | Each element stores local coords; `pagePos()` computes absolute on demand | All coords are absolute pixels from the start | No transform composition needed |
| **Mutability** | Elements mutated in-place during layout (multiple passes) | Immutable output — layout produces final `RenderedScore` | No incremental re-layout |
| **Element identity** | Pointer-based (each element is a heap object) | String IDs (`noteId`, `groupId`, `svgId`) | Serializable, no pointer lifetime issues |
| **Score traversal** | `Score::scanElements()` + visitor pattern | Direct array iteration on hierarchy | Simpler, no visitor overhead |
| **Memory layout** | Tree of heap-allocated objects with parent/child pointers | Nested arrays of plain objects | JSON-serializable, GC-friendly |
| **Barline types** | 14 `BarLineType` enum values | 10 `BarlineType` union values | Missing: BROKEN, SHORT, TICK, WINGED variants |
| **Notehead types** | ~20 `NoteHeadType` values | 7 `NoteheadType` values | Missing: cross, circleX, withX, plus, etc. |

---

## Extraction Summary — Session K (Chapter 15)

| File | Functions | Constants (exported) | Classes | Interfaces | Type Aliases |
|------|-----------|----------------------|---------|------------|--------------|
| `types.ts` | 0 | 0 | 0 | 28 | 6 (`ClefType`, `NoteheadType`, `AccidentalType`, `BarlineType`, `ArticulationType`, `OrnamentType`) |
| `spatium.ts` | 3 (`spToPx`, `pxToSp`, `lineToY`) | 3 (`DEFAULT_SPATIUM_MM`, `STAFF_HEIGHT_SP`, `MIDDLE_LINE`) | 0 | 0 | 2 (`Sp`, `Px`) |

---
---

# Appendix A: Cross-Reference Table — C++ ↔ MAP

| C++ Chapter | C++ Topic | MAP Chapter | MAP Topic | TS Files |
|-------------|-----------|-------------|-----------|----------|
| Ch 1 | Score Object Creation & XML Import | Ch 1 + Ch 3 | Style Constants + XML Import | `StyleDef.ts`, `xmlExtractor.ts`, `extractorTypes.ts` |
| Ch 2 | Layout Orchestration | Ch 2 | Pipeline Orchestration | `index.ts`, `LayoutOrchestrator.ts` |
| Ch 3 | Measure Layout | Ch 4 | Measure Layout & Segment Widths | `horizontalLayout.ts`, `LayoutMeasure.ts` |
| Ch 4 | Segment Width Computation | Ch 4 | (merged with Measure Layout) | `horizontalLayout.ts` |
| Ch 5 | System Collection & Breaking | Ch 5 | System Breaking & Justification | `LayoutSystem.ts` |
| Ch 6 | Chord & Note Positioning | Ch 7 + Ch 12 | Note/Chord + Atomic Elements | `chordLayout.ts`, `LayoutChords.ts`, `Note.ts`, `atomicElements.ts` |
| Ch 7 | Stem Layout | Ch 8 | Stem & Hook | `Stem.ts`, `Hook.ts` |
| Ch 8 | Beam Layout | Ch 9 | Beam Layout | `LayoutBeams.ts` |
| Ch 9 | Page Layout & System Stacking | Ch 6 + Ch 10 | Page Layout + Vertical Layout | `LayoutPage.ts`, `verticalLayout.ts` |
| Ch 9B | Shape, Skyline & Autoplace | Ch 11 | Shape & Skyline | `Shape.ts`, `Skyline.ts` |
| Ch 11 | Barlines | Ch 13 (§13.9) | (rendered in SVG) | `svgRenderer.ts` |
| Ch 12 | Key/Time Sigs & Clefs | Ch 13 (§13.6-8) | (rendered in SVG) | `svgRenderer.ts` |
| Ch 13 | Accidentals | Ch 7 (§7 delta) + Ch 14 (§14.9) | Accidental metrics | `LayoutChords.ts`, `anchors.ts` |
| Ch 14 | Special Elements | — | Not yet implemented | — |
| Ch 15 | Style System (Sid) | Ch 1 | Style Constants | `StyleDef.ts` |
| Ch 16 | Font & Glyph System | Ch 14 | Glyphs, Anchors & Font | `leland.ts`, `anchors.ts` |
| Ch 17 | SVG/Drawing Output | Ch 13 | SVG Rendering & Painter | `svgRenderer.ts`, `Painter.ts`, `SVGPainter.ts` |

---

# Appendix B: Consolidated Delta Summary

Key gaps between C++ (webmscore) and MAP TS renderer, aggregated from all chapter deltas:

## B.1 Missing Features (not implemented)

| Feature | C++ Source | MAP Status | Priority |
|---------|-----------|------------|----------|
| Multi-part / multi-staff | importmusicxml pass 1+2 | Single-part only | High for orchestral scores |
| Transposing instruments | `Score::cmdConcertPitchChanged()` | Not implemented | Medium |
| Lyrics layout | `layoutlyrics.cpp` | Not extracted from XML | Medium |
| Figured bass | XML import pass 2 | Not parsed | Low |
| Tuplet layout (advanced) | `layouttuplets.cpp` | Basic bracket only | Medium |
| Slur/Tie (advanced) | `slur.cpp`, `tie.cpp` — Bezier with grip points | Simple Bezier from endpoints | Medium |
| Hairpin rendering | `hairpin.cpp` | Type-only, no wedge SVG | Medium |
| Dynamics rendering | `dynamic.cpp` | SMuFL glyphs available but unused | Low |
| Articulation rendering | `articulation.cpp` | Type-only, no glyph placement | Low |
| Autoplace | `autoplaceSegmentElement()`, `autoplaceMeasureElement()`, `rebaseMinDistance()` | Shape/Skyline ported but autoplace not called | High for collision-free output |
| Cross-staff beams | `beam.cpp` cross-staff detection | Not supported | Low |
| VerticalGapData | `verticalgapdata.cpp` (3-phase, maxPasses=20) | Not implemented | Low |
| Multi-font support | `ScoreFont` class (Bravura, Leland, Petaluma, Gonville, MuseJazz) | Leland-only | Medium |

## B.2 Simplifications (implemented with reduced fidelity)

| Feature | C++ complexity | MAP simplification |
|---------|---------------|-------------------|
| Stem direction | 9-priority chain | 3 rules (position, multi-voice, beam) |
| Stem length | 12-step algorithm | Fixed 3.5sp + 0.5sp per flag |
| Accidental stacking | Zig-zag octave column matching | Linear left-to-right placement |
| Beam slope | Dictator/pointer + quarter-space grid snapping + concave detection | getMaxSlope + linear slope only |
| System breaking | Incremental with min/max rollback | Greedy + squeeze-aware |
| Key sig layout | SMuFL cutout anchors (cutOutSW/NW/NE/SE) | Simple accidental spacing |
| Beat positions | `Fraction` (exact rational arithmetic) | `float` with `snapBeat()` 3-decimal rounding |
| Style system | ~350 Sid values, per-score overridable | ~40 compile-time constants |

## B.3 Known Discrepancies

| Item | C++ value | MAP value | Location |
|------|-----------|-----------|----------|
| `accidentalWidthSp('flat')` | Per-glyph from `ScoreFont::bbox()` | `0.65` (anchors.ts), `1.2` (verticalLayout.ts) | atomicElements vs verticalLayout conflict |
| `ACCIDENTAL_WIDTH_SP` | Runtime font metric | Hardcoded Leland-specific | anchors.ts:104 |
| `verticalClearance` | 0.2 × spatium (shape.cpp:103) | Implemented in Shape.ts | Functional |
| `empFactor` | `computeDurationStretch()` HACK line | Implemented in LayoutMeasure.ts but not used in main path | Two stretch implementations coexist |
| `pitchToStaffLine()` | Single implementation | Duplicated in verticalLayout.ts AND atomicElements.ts | Same logic, should be deduplicated |

---

# Appendix C: Full Extraction Summary

| Session | Files | Functions | Constants | Classes | Interfaces/Types | Doc Lines Added |
|---------|-------|-----------|-----------|---------|-------------------|-----------------|
| G (Ch 1–3) | 5 | 28 | 42 | 0 | 20 | ~650 |
| H (Ch 4–6) | 4 | 24 | 52 | 0 | 13 | ~987 |
| I (Ch 7–9) | 6 | 23 | 14 | 0 | 14 | ~1,008 |
| J (Ch 10–12) | 5 | 40 | 41 | 3 | 11 | ~1,224 |
| K (Ch 13–15) | 8 | 37 | 67 | 1 | 40 | ~1,229 |
| **Total** | **28** | **152** | **216** | **4** | **98** | **~5,098** |

**Document total:** ~5,608 lines (from 0, across 5 sessions).

---

*Document complete. Stage 2 (MAP TS Documentation) finished 2026-04-09.*
*Next: Stage 3 — Gap Analysis → TS fix plan.*
