# Renderer C++ → TypeScript Gap Audit

Comprehensive audit of MuseScore layout systems not yet ported to our native renderer.
Based on analysis of `webmscore/src/engraving/` C++ source.

**Last updated:** 2026-04-05

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Critical — affects all scores, causes visual bugs |
| **P1** | Important — affects many scores, degrades readability |
| **P2** | Moderate — affects specific notation, noticeable but not broken |
| **P3** | Low — rare notation or polish features |

| Effort | Meaning |
|--------|---------|
| **S** | Small — < 100 lines, straightforward port |
| **M** | Medium — 100-500 lines, some complexity |
| **L** | Large — 500+ lines, complex algorithms |

---

## Gap Table

| # | System | C++ Source Files | What It Does | Donna Lee Impact | General Impact | Effort | Priority |
|---|--------|-----------------|-------------|-----------------|----------------|--------|----------|
| 1 | **Shape system** | `shape.cpp/h` (380 lines) | Bounding box collection per element. `minHorizontalDistance()`, `minVerticalDistance()`, `intersects()`. Foundation for collision detection. | HIGH | CRITICAL | M | **P0** |
| 2 | **Skyline system** | `skyline.cpp/h` (374+122 lines) | North/south contour lines per staff. `add(shape)`, `minDistance()`. Tracks vertical extent of placed elements for collision avoidance. | HIGH | CRITICAL | M | **P0** |
| 3 | **Autoplace** | `engravingitem.cpp` lines 2504-2570 | `autoplaceSegmentElement()`, `autoplaceMeasureElement()`, `autoplaceSpannerSegment()`. Uses skyline to detect collisions and automatically reposition elements. | HIGH | CRITICAL | M | **P0** |
| 4 | **Rest vertical positioning** | `rest.cpp` `layout()` + `layoutDots()` | Vertical rest position on staff (ledger line variants, multi-voice offsets). Rest symbol selection (restWholeLegerLine etc). | MED — Donna Lee has rests | HIGH | S | **P1** |
| 5 | **Dot avoidance** | `notedot.cpp` `layout()` | Dots avoid staff lines: if dot lands on a line, shift up 0.5sp. Also handles double-dot spacing. | MED — Donna Lee has dotted notes | HIGH | S | **P1** |
| 6 | **Accidental stacking (full)** | `layoutchords.cpp` lines 1036-1200 | Full zig-zag column algorithm for chords spanning > 1 octave. Per-accidental-type cutout optimization. Our port handles simple cases only. | LOW — single notes | HIGH (for chord-heavy scores) | M | **P1** |
| 7 | **Padding table** | `score.cpp` paddingTable, `segment.cpp` | Element-type-specific horizontal padding. Different spacing between note-note, note-rest, rest-rest, clef-note, keysig-note, etc. | MED | HIGH | S | **P1** |
| 8 | **Key sig spacing** | `keysig.cpp` `layout()` + `addLayout()` | Key signature accidental arrangement and spacing within the symbol group. | MED | MED | S | **P2** |
| 9 | **Time sig layout** | `timesig.cpp` `layout()` | Time signature digit positioning and special symbols (common time, cut time). | MED | MED | S | **P2** |
| 10 | **Articulation placement** | `chord.cpp` `layoutArticulations()` 1/2/3 | 3-phase articulation positioning: (1) above/below stem, (2) secondary adjustment, (3) slur interaction. Complex vertical stacking. | NONE — Donna Lee has no articulations | HIGH (for classical) | L | **P2** |
| 11 | **Harmony alignment** | `layoutharmonies.cpp` | Cross-system harmony symbol alignment. Ensures chord symbols at the same row have consistent y-position. | MED — has chords | MED | M | **P2** |
| 12 | **Beam slope constraints** | `beam.cpp` lines 505+ | `isSlopeConstrained()` — forces flat beams when middle notes are more extreme than endpoints. Our port implements only steps 2 and 5 of the algorithm. | LOW | MED | S | **P2** |
| 13 | **empFactor / HACK** | `measure.cpp` line 4174+ | Duration stretch factor adjustments for extreme note duration ratios. Intentionally disabled in our port (worsened pixel tests). | UNKNOWN | UNKNOWN | S | **P2** |
| 14 | **Grace note layout** | `layoutchords.cpp` | `updateGraceNotes()`, `repositionGraceNotesAfter()`, `appendGraceNotes()`. Complex spacing relative to main notes. | NONE | MED | M | **P3** |
| 15 | **Slur curves** | `slur.cpp` `layoutSegment()` + `layoutSystem()` | Bezier path calculation with collision avoidance against notes, stems, and other slurs. | NONE | HIGH (for classical) | L | **P3** |
| 16 | **Volta brackets** | `volta.cpp` | First/second ending bracket positioning, line drawing, text placement. | NONE | MED | M | **P3** |
| 17 | **Cross-staff layout** | `measure.cpp` `layoutCrossStaff()` | Cross-staff note and beam collision avoidance. Multi-voice overlap detection. | NONE | MED (for piano) | L | **P3** |
| 18 | **Staff distribution** | `verticalgapdata.cpp` + `layoutpage.cpp` | `distributeStaves()` — vertical spacing between staves using spring model. Section spacing, bracket spacing. | LOW | MED (for multi-staff) | M | **P3** |
| 19 | **Lyrics positioning** | `layoutlyrics.cpp` | `layoutLyrics()`, `findLyricsMaxY/MinY()`. Uses skyline for collision avoidance. | NONE | MED (for vocal music) | M | **P3** |
| 20 | **Figured bass** | `figuredbass.cpp` | `layoutLines()` — figured bass number positioning. | NONE | LOW | M | **P3** |
| 21 | **Cross-measure beams** | `layoutbeams.cpp` `breakCrossMeasureBeams()` | Beams that span barlines. | NONE | LOW | M | **P3** |

---

## What We Have (already ported)

| System | TS File | Coverage | Notes |
|--------|---------|----------|-------|
| Note layout | `engine/libmscore/Note.ts` | ~90% | Missing: multi-glyph accidentals |
| Stem layout | `engine/libmscore/Stem.ts` | ~95% | |
| Hook/Flag layout | `engine/libmscore/Hook.ts` | ~95% | Fixed in session 5 (flag glyph selection) |
| Ledger lines | `engine/libmscore/LedgerLine.ts` | ~90% | |
| Beam layout | `engine/layout/LayoutBeams.ts` | ~80% | Missing: slope constraints (item 12) |
| Chord layout | `engine/layout/LayoutChords.ts` + `chordLayout.ts` | ~60% | Missing: full zig-zag algorithm (item 6) |
| Measure width | `engine/layout/LayoutMeasure.ts` | ~95% | Missing: empFactor (item 13) |
| System layout | `engine/layout/LayoutSystem.ts` | ~95% | |
| Page layout | `engine/layout/LayoutPage.ts` | ~95% | |
| Horizontal spacing | `horizontalLayout.ts` | ~90% | Missing: padding table (item 7) |
| Vertical layout | `verticalLayout.ts` | ~85% | Missing: skyline integration |
| Tie rendering | `verticalLayout.ts` | ~90% | Fixed in session 5 (arc formula + cross-system) |
| Tuplet rendering | `verticalLayout.ts` | ~85% | Fixed in session 5 (bracket direction) |
| XML extraction | `xmlExtractor.ts` | ~95% | |
| SVG rendering | `svgRenderer.ts` | ~95% | |
| Style constants | `style/StyleDef.ts` | ~80% | Some hardcoded, should reference Sid enum |

---

## Recommended Porting Order

### Phase A — Collision Prevention (P0)
1. Port Shape class (foundation)
2. Port Skyline class (depends on Shape)
3. Integrate autoplace for chord symbols (most impactful for Donna Lee)

### Phase B — Spacing Polish (P1)
4. Dot avoidance (quick fix)
5. Rest positioning (quick fix)
6. Padding table (consistent spacing between element types)

### Phase C — Notation Completeness (P2)
7. Key/time signature spacing
8. Articulation placement
9. Harmony alignment
10. Beam slope constraints

### Phase D — Advanced Features (P3)
11. Slur curves
12. Grace notes
13. Volta brackets
14. Cross-staff layout
15. Lyrics

---

## C++ File Locations

All paths relative to `C:\Users\DELL\Documents\webmscore\`:

```
src/engraving/libmscore/
├── shape.cpp/h              — Shape system (P0)
├── skyline.cpp/h            — Skyline system (P0)
├── engravingitem.cpp        — Autoplace (P0) — lines 2504-2570
├── rest.cpp                 — Rest layout (P1)
├── notedot.cpp              — Dot avoidance (P1)
├── accidental.cpp           — Multi-glyph accidentals (P1)
├── chord.cpp                — Articulation placement (P2)
├── keysig.cpp               — Key signature layout (P2)
├── timesig.cpp              — Time signature layout (P2)
├── slur.cpp                 — Slur curves (P3)
├── volta.cpp                — Volta brackets (P3)

src/engraving/layout/
├── layoutchords.cpp         — Full accidental stacking (P1)
├── layoutharmonies.cpp      — Harmony alignment (P2)
├── layoutlyrics.cpp         — Lyrics positioning (P3)
├── layoutbeams.cpp          — Cross-measure beams (P3)
```
