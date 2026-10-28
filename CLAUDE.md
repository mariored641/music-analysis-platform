# MAP — Music Analysis Platform
## CLAUDE.md — Project context for AI sessions

**Source of truth for UX:** [`docs/VISION.md`](docs/VISION.md) (Mario's vision, in his words) → [`docs/UX_REMAKE.md`](docs/UX_REMAKE.md) (how the app implements it). Read both before changing behavior.

**Stack:** React 19 + TypeScript + Vite + Zustand + OSMD + Tone.js + i18next + PWA
**Test files:** `public/DONNALEE.XML` (Donna Lee, Ab major, 100 bars), `public/liszt-test.mxl`, `public/sample-bach-invention1.xml`
**Dev server:** `node node_modules/vite/bin/vite.js --port 3002`
**GitHub:** https://github.com/mariored641/music-analysis-platform · **Vercel:** auto-deploys main/master

---

## Core UX loop (the remake, Oct 2026)

**Select → tag → see it → saved.** Everything else supports that loop.

- Library (`components/library/LibraryView.tsx`) → click a card → Workspace (`components/workspace/Workspace.tsx`). `libraryStore.currentView` switches; the last open piece is restored on reload.
- Workspace = TopBar · LayersPanel (left) · ScoreCanvas (center) + StylusDock · RightPanel (Inspector / research notes) · StatusBar. All UI strings are bilingual pairs: `tr('עברית', 'English')` (`i18n/index.ts`), Hebrew/RTL default.
- **QuickTagBar** (`components/workspace/QuickTagBar.tsx`) floats above any selection: detected chord (one click), chord/degree (H, Enter), melodic role (N, then 1–8), motif (M, then 1–9), form/texture (F), label (T), question (Q), color (K), linked research note. Right-click opens it at the pointer. All tag writes go through `services/tagActions.ts` (one call = one undo step).
- Shortcuts: `hooks/useShortcuts.ts` (cheat sheet: `?`, `components/workspace/ShortcutsHelp.tsx`).

## Score engine (`src/score/`)

| File | Purpose |
|---|---|
| `engine.ts` | `renderScore(xml, host)` — OSMD into a fixed **`PAGE_WIDTH` = 1000px** page (renders serialized). `buildGeometry()` → page-unit geometry + noteId↔notehead map. `?renderer=native` uses the native renderer. |
| `geometry.ts` | `ScoreGeometry` (measures with per-staff rects, systems, note boxes, score order) + helpers |
| `ScoreCanvas.tsx` | Page + zoom (`transform: scale`, fit-to-width default, Ctrl+wheel), pointer input (click / lasso / pen draw / erase / right-click), notehead painting, scroll-to, playback follow |
| `selectionOps.ts` | Word-like selection: click, Shift/Ctrl, arrows, Shift+arrows, systems, select all |
| `AnnotationLayer.tsx` | On-score tag shapes (harmony text + anchor handle, motif blob, form/texture bars, label brackets, questions) — draggable (`visualOffset`), double-click resets |
| `OverlayLayers.tsx` | Selection band, playback band, freehand strokes |
| `paint.ts` / `registry.ts` | Direct DOM coloring of noteheads/elements; current render's elements (`colorables`) for element selection |
| `thumbnail.ts` | First-system WebP thumbnails for library cards (IndexedDB `kv`) |

**Geometry is in page units** (unscaled page px). Strokes and offsets are stored in page units → stable across zoom/window size.

**OSMD mapping facts:** `g.vf-measure` ids are *printed measure numbers* — don't use them; measure indices come from OSMD `MusicSystems[].StaffLines[].Measures[].parentSourceMeasure.measureListIndex` paired with DOM `g.staffline` order. Each OSMD GraphicalNote ↔ one notehead, except chords where every note reports all heads → paired by pitch. Matching levels: exact (measure|staff|pitch, beat) → nearest beat → any staff → any octave (8va). DONNALEE 643/643, Liszt 612/612.

## ID architecture — CRITICAL

- **noteMap IDs** (stored in annotations): `note-m{measureIndex}b{round(beat*100)}-{Step}{Oct}[-s{staff}][-p{part}]`, collisions get `-v{voice}`. `measureIndex` = 1-based position in document order (not the printed number). See `services/xmlParser.ts`.
- `NoteData`: `measureNum` (index), `beat` (1-based quarters), `staff`, `part`, `globalStaff`, `tied`, `grace`. `MeasureData`: `label`, `startQ`, `lengthQ`, effective time/key.
- Annotations never store rendered SVG ids. Score elements (chord symbols, dynamics, ties…) are referenced by `ElementRef {index, tag, x, y}` and re-resolved by `registry.resolveElement`.

## Data model (`types/annotation.ts`)

Layers: `harmony | melody | motif | form | texture | labels | color | freehand`; `questions` is visibility-only (labels with `isQuestion`). `HarmonyAnnotation.noteIds[0]` = anchor note (the chord's real position; Alt+←/→ or drag the orange dot). Melody roles are per-note `melody` annotations (`noteFunction`) — the melody script writes the same layer with `scriptId`. `ColorAnnotation` colors notes (`noteIds`) or an element (`element`). Strokes: `FreehandAnnotation {points, path, color, strokeWidth, opacity, linkedLayer, label}`; a stroke shows when `freehand` or its `linkedLayer` is visible.

Old saved data is upgraded on load by `services/migrate.ts` (`noteColor{colorType}` → `melody`, Verovio-era `svgColor` dropped).

## State (`src/store/`)

`libraryStore` (pieces, persisted `map-library`) · `workspaceStore` (open piece: xml, noteMap, xmlHarmonies, geometry, save state) · `annotationStore` (annotations + undo/redo, `transact`) · `selectionStore` (selection: notes | element, selected annotation, quick-bar section, scroll requests) · `layerStore` (visibility, solo, color overrides `melody:CT` / `motif:A` / `form:B` / `harmony:chord`…) · `stylusStore` (palette, mode select/draw/erase, `penAlwaysDraws`) · `researchStore` · `playbackStore` · `uiStore` (panels, zoom, drawers, toasts).

Dev builds expose `window.__map` (stores) for debugging and browser tests.

## Persistence, sync, export (`src/services/`)

- `pieceService.ts` — the only load/save path: `importPiece`, `openPiece`, `closePiece`, `deletePiece`, `savePiece` / `scheduleSave` / `flushSave`, `importFromFolder`, `refreshFromFolder`.
- `storageService.ts` — IndexedDB `map-storage` v2: `files` (xml + annotations + researchNotes + savedAt), `kv` (sync folder handle, thumbnails).
- `syncService.ts` — File System Access folder: `<base>/<base>.musicxml` + `<base>/<base>.analysis.json`. Written on every save; a newer analysis.json (e.g. edited by Claude Code) wins on open and on window focus; "sync folder" in the library imports pieces that exist only in the folder.
- `analysisExport.ts` — `.analysis.json` v2: `{format, version, savedAt, piece, annotations[], researchNotes[], summary}`. `annotations` round-trips; `summary` is derived/readable only.
- Scripts: `melodyColorScript.ts` (CT/PT/NT → melody layer; manual tags win), `motifScript.ts` (seeds = hand-tagged motifs), `romanNumeralScript.ts` (degrees + functions; chordifies when no chords). UI: `components/workspace/ScriptsDrawer.tsx`.
- `hooks/usePlayback.ts` — Tone.js from the selection, transport ticks (live BPM), loop, cursor via `playbackStore.currentNoteIds`.

---

## Native Renderer — מצב נוכחי

תוכנית מלאה: `NATIVE_RENDERER_PLAN.md` | אלגוריתמים: `RENDERER_ALGORITHMS.md`

| שלב | תוכן | סטטוס |
|-----|------|--------|
| 0 | מחקר webmscore/MuseScore → RENDERER_ALGORITHMS.md | ✅ הושלם |
| 1 | Data model → `src/renderer/types.ts` | ✅ הושלם |
| 2 | MusicXML parser מורחב → `xmlExtractor.ts` + `extractorTypes.ts` | ✅ הושלם |
| 3 | Horizontal layout + דף בדיקה `/renderer-test` | ✅ הושלם — **Checkpoint A** |
| 4 | Vertical layout + stems + beams + accidentals | ✅ הושלם — `verticalLayout.ts` |
| 5 | SVG renderer (Unicode glyphs) | ✅ נבנה — Checkpoint B **לא אושר** — 8 בעיות ויזואליות |
| 5.5 | Bugfix Pass — pixel comparison vs webmscore | 🔄 בעבודה — 0/15 pass, ~99.1–99.8% match. תוקן: noteX=left-edge, noteheadWidth=1.3sp, stemX=right/left edge. **הגישה הנכונה: קרא C++ → תרגם TS.** WYSIWYG confirmed: L1↔L2 = 100% (0 CSS regressions). כל diff שנותר הוא logic bug בלבד. **תוקן: squeeze tolerance ב-collectSystems(), repeat-start direction (leftward from hMeasure.x). 12-barlines: 10,682px (ניסיון הסרת suppression → 11,296px → חזרנו). הבא: לחקור מה גורם ל-10,682px ב-12-barlines (note X positions, repeat-start dot coords).** |
| 5.6 | Dual-layer testing + WYSIWYG fix | ✅ הושלם — `/app-test` route, `app-integration.spec.ts` (Layer 2), `compare-layers.ts`, font-guard + CSS isolation. 15/15 WYSIWYG match. |
| 5.7 | Pipeline test framework — numeric comparison vs webmscore | ✅ הושלם — 214 tests, 139/214 pass (65%). A=100% B=31% C=76% D=92% E=92%. Test fixes: A1 tolerance, A7/A8 field names, C16/C17 position refs, E18 gap tolerance. empFactor investigated+reverted (needs C++ incremental system building). |
| 5.8 | Incremental system building + empFactor/HACK/maxRatio | 🔄 בעבודה — **141/214** (A=29 B=27 C=41 D=21 E=23). ראה `docs/IMPLEMENTATION_PLAN.md`. |
| 6 | אינטגרציה ב-MAP, החלפת OSMD | ⬜ **Checkpoint C** |
| 7 | Classical full support (SATB, tuplets, voltas) | ⬜ |
| 8 | Bravura glyphs | ⬜ |

**checkpoints:** A = layout מספרי, B = ויזואלי (השוואה), C = MAP מלא עם renderer חדש

---

## Dev workflow

```bash
# Start dev server
node node_modules/vite/bin/vite.js --port 3002

# Build check before push
npm run build

# Push to GitHub (auto-deploys via Vercel)
git add . && git commit -m "..." && git push origin master

# Pipeline tests (native renderer vs webmscore)
npm run test:r:pipeline          # all 214 tests
npm run test:r:pipeline:h        # horizontal only (B-tests)
npm run test:r:pipeline:v        # vertical only (C-tests)
npm run test:r:gaps              # gap regression (E-tests)
npx tsx renderer-tests/pipeline/run.ts --case=05-stems --verbose  # specific fixture
npm run test:r:extract           # re-extract reference data (one fixture at a time due to WASM)
```

Always test with DONNALEE.XML ("♩ נסה עם Donna Lee" in the empty library). Also check `public/liszt-test.mxl` (dense, chords, 8va) and `public/sample-bach-invention1.xml`.

**Important:** After HMR, if useEffect deps array changed size — do a full page reload (Ctrl+Shift+R). HMR breaks on deps array size changes in React.

### Pipeline test system (renderer-tests/pipeline/)
- **Reference data:** `renderer-tests/reference-data/*.ref.json` — extracted from webmscore WASM (measures, notes, stems, beams, barlines, staff lines)
- **Extraction quirks:** Node.js 24 needs fetch/navigator/location polyfills for webmscore WASM. One fixture at a time (multi-score WASM corruption).
- **Test categories:** A=extraction(12), B=horizontal(7), C=vertical(17), D=SVG(10), E=gaps(8) — 54 test definitions × 15 fixtures = 214 runs
- **Key finding:** webmscore `measurePositions()` includes system header in measure 1 width/x. Our layout stores headerWidth separately.
- **Stem fix applied:** attachment point sign was flipped (stemUpSE.y = -0.168sp ABOVE center, not +0.168sp below). C++ trace: stem.cpp:103-106.
- **Remaining B5 drift:** ~8px/beat cumulative within measures. Root cause: spring model in `computeStretch()` vs C++ `Segment::computeWidth()`. Needs C++ trace.
- **empFactor investigation (session 7):** C++ empFactor (`str *= 0.4 + 0.6*sqrt(minDur/threshold)`) documented in LayoutMeasure.ts but not applied. clampMinDur() at 0.25qb makes it impossible to trigger. Removing clamp + implementing empFactor scored 115/214 (worse) because empFactor interacts with incremental system building in C++ (system minDur changes as measures are added). Reverted. Next approach: trace C++ `layoutSystem()` to understand incremental width recomputation during system collection.
- **Incremental system building (session 8):** `collectSystemsIncremental()` implemented in LayoutSystem.ts — tracks minTicks/maxTicks across system, recomputes all prior measures when either changes (C++ layoutsystem.cpp:109-245). `computeDurationStretch` expanded to 3-param with HACK (segment.cpp:2832-2834: double minDur when maxDur/minDur≥2 and minDur<0.25qb), maxRatio cap (segment.cpp:2839-2842: linearize when ratio>32), empFactor (segment.cpp:2847-2848: multiply by 0.4+0.6√(minDur/0.25) when minDur>0.25qb). LayoutOrchestrator wired to use incremental result. **Score: 138/214.**
- **Session 9 fixes:** barline clamp consistency (B7: 15/15), BAR_ACC_DIST_SP 0.65→2.0sp, הסרת accidentalPaddingSp, RenderedNote.x → center. **Score: 141/214.** ראה `docs/IMPLEMENTATION_PLAN.md` + `docs/SESSION9_RENDERER.md`.

---
