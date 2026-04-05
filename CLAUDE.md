# MAP — Music Analysis Platform
## CLAUDE.md — Project context for AI sessions

**Stack:** React 18 + TypeScript + Vite + Zustand + Tone.js + i18next + PWA
**Location:** `C:\Users\DELL\Documents\MAP - Music Analysis Platform`
**Test file:** `public/DONNALEE.XML` — Donna Lee, Charlie Parker, Ab major, 4/4, 100 measures
**Dev server:** `node node_modules/vite/bin/vite.js --port 3002` (or next available port)
**GitHub:** https://github.com/mariored641/music-analysis-platform
**Vercel:** https://map-music-analysis-platform.vercel.app (auto-deploys on push to main/master)

---

## Views

**Two-view app — `currentView` in `libraryStore` controls routing in `App.tsx`:**

### Library View (`src/views/LibraryView.tsx`)
- Home screen — shown on startup (or when `currentView === 'library'`)
- Grid of `LibraryCard` components (`src/components/library/LibraryCard.tsx`)
- Upload button → file picker → MetaForm modal → loads piece → switches to Analysis view
- Sort: lastModified / lastOpened / dateAdded / title / composer / genre
- Filter: by genre, by composer; text search
- Delete piece (with confirm) — removes from IndexedDB + libraryStore

### Analysis View (default layout)
Three-panel fixed layout:
```
┌──────────┬────────────────────┬──────────┐
│LeftPanel │    ScoreView       │RightPanel│
│  180px   │  (flex, scrolls)   │  180px   │
└──────────┴────────────────────┴──────────┘
│              StatusBar                    │
└───────────────────────────────────────────┘
```
- **TopBar** — ← back-to-library button, title, language toggle, play button, BPM, JSON export, 🔬 Scripts button
- **FormalStrip** — horizontal colored strip above score (form annotations)
- **ScoreView** — main score rendering area with overlays
- **LeftPanel** — layer toggles with collapsible legends + freehand color palette
- **RightPanel** — selection details, tag count, open questions, analysis summary
- **StatusBar** — key, time sig, selection info, shortcut hints

---

## Renderer: Verovio (current, working)

**Renderer history (do not re-litigate):**
1. webmscore — chord symbol root letters missing (Edwin font absent from WASM). Replaced.
2. OSMD — wrong chord positions for some measures. Replaced.
3. **Verovio** ← current. npm ESM + WASM. Chord symbols render natively. Fully working.

**How it loads:** npm package, imported in `ScoreView.tsx`:
```typescript
import createVerovioModule from 'verovio/wasm'
import { VerovioToolkit } from 'verovio/esm'
```

**API (confirmed working):**
```typescript
const mod = await createVerovioModule()
const tk = new VerovioToolkit(mod)
tk.setOptions({ pageWidth: 2100, scale: 40, adjustPageHeight: true, breaks: 'auto', ... })
tk.loadData(preparedXml)           // preprocessed MusicXML
const pageCount = tk.getPageCount()
const svg = tk.renderToSVG(i, false)  // 1-based page index
```

**Multi-staff fix:** `prepareMusicXML()` in `src/services/xmlSanitizer.ts`
- Rebuilds each measure: preamble (harmony/attrs) → staff-1 notes → one backup → staff-2 notes
- Injects `<voice>1</voice>` into all notes
- Fixes DONNALEE.XML where staff-2 notes appear before any `<backup>` (Verovio rule: staff tag only honored after backup)

**Verovio reference book:** `docs/verovio-reference-book.md` (1611 lines, 11 chapters)

---

## ScoreView rendering flow

```
xmlString → prepareMusicXML() → renderWithVerovio() → svgs[]
         → dangerouslySetInnerHTML (.vrv-svg div)
         → requestAnimationFrame → buildElementMap() + buildVrvNoteIdMap()
         → setElementMap(Map<"measure-N", NoteElement>)
         → setToVrv(Map<noteMapId, verovioSvgId>)
```

**`buildElementMap(container)`**
- Queries `container.querySelectorAll('g.measure')` — Verovio class for measure groups
- `elementMap` key: `"measure-N"` where N = index (0-based)
- `NoteElement.measureNum` = index + 1 (1-based)
- DONNALEE.XML: 100 measures, 643 notes, each `g.note` has a unique Verovio ID

**`buildVrvNoteIdMap(container, noteMap)`**
- Positional matching: sorts Verovio `g.note` elements by x-position within each measure's first `g.staff`, sorts noteMap notes by beat — zips them 1:1
- Returns `{ toVrv: Map<noteMapId, vrvId>, fromVrv: Map<vrvId, noteMapId> }`
- `toVrv` stored in scoreStore (for overlays + scripts). `fromVrv` kept in `fromVrvRef` in ScoreView only (for click handlers)
- DONNALEE.XML: builds 643 entries after clean page load

**Click detection:**
- Note click: `e.target.closest('g.note')` → translate via `fromVrvRef` → noteMap ID stored in `selection.noteIds`
- Measure click: `findMeasureAtPoint(clientX, clientY, elementMap)` — bbox hit test

---

## ID architecture — CRITICAL

**Two separate ID spaces:**
- **Verovio SVG IDs** — random strings like `f1gw3d3i`, assigned at render time, ephemeral
- **noteMap IDs** — stable format `note-m{measureNum}b{Math.round(beat*100)}-{step}{octave}`, e.g. `note-m4b300-E5`

**Rule:** `annotation.noteIds` and `selection.noteIds` always store **noteMap IDs**.
`toVrv` is a one-way rendering translation layer only — never stored in annotations.

**Translation points:**
- Click → `fromVrvRef.current.get(vrvId)` → noteMap ID → stored in selection/annotation
- Overlay/color → `toVrv.get(noteMapId)` → vrvId → `document.getElementById(vrvId)`

**Verovio `g.note` SVG structure:**
```
g.note
  g.stem > rect
  g.notehead > use   ← color only this for note head coloring
  g.accid (optional)
  g.dots (optional)
```
Note: Verovio `g.note` elements have NO `pname`/`oct` attributes — positional matching is the only way.

---

## Selection system

| Action | Result |
|--------|--------|
| Click note | Purple highlight on note, StatusBar: `Note — m.N` |
| Click measure (non-note area) | Purple highlight on measure, StatusBar: `Measure N` |
| Shift+click | Extends range from anchorMeasure |
| Drag lasso | Rubber-band rect → selects **notes** (`type: 'notes'`) intersecting the rect |
| Escape | Clears selection |

`selection.noteIds` always contains **noteMap IDs** (translated at click time via `fromVrvRef`).

**Context menu positioning:** uses `useLayoutEffect` to measure actual rendered height after each open, clamps to viewport on all four sides. Never goes off-screen.

**Tag button tooltips:** `title` attribute on tag chips shows `עברית / English` on hover.

**SelectionOverlay.tsx** — translates noteMap IDs → Verovio IDs via `toVrv` prop for DOM lookup.

---

## Source files

### `src/components/score/`
| File | Purpose |
|------|---------|
| `ScoreView.tsx` | Main renderer — Verovio, elementMap, buildVrvNoteIdMap, click/drag handling, applyNoteColors |
| `ScoreView.css` | Score layout styles |
| `SelectionOverlay.tsx` | SVG overlay — note + measure highlight, lasso rect. Accepts `toVrv` prop |
| `AnnotationOverlay.tsx` | SVG overlay for annotations (colored rects + labels). Accepts `toVrv` prop |
| `HarmonyOverlay.tsx` | Legacy file — imported but not rendered (Verovio renders chord symbols natively) |
| `FormalStrip.tsx` | Horizontal strip above score for form annotations |
| `FreehandCanvas.tsx` | Canvas layer for freehand drawing |

### `src/components/layout/`
`TopBar.tsx`, `LeftPanel.tsx`, `RightPanel.tsx`, `StatusBar.tsx`

### `src/components/stylus/`
| File | Purpose |
|------|---------|
| `ColorPalette.tsx` | Color circles for freehand layer — click circle → popover (color picker, width, opacity, link to layer, label). Reads/writes `stylusStore` |
| `ColorPalette.css` | Palette + popover styles |

### `src/components/menus/`
`ContextMenu.tsx` — dispatcher
`HarmonyMenu.tsx`, `MelodyMenu.tsx`, `FormMenu.tsx`, `MotifMenu.tsx`, `LabelMenu.tsx`, `NoteColorMenu.tsx`

### `src/components/scripts/`
`ScriptPanel.tsx` — floating panel opened by 🔬 button. Lists scripts, runs on click, clears+reruns on second click. Auto-enables noteColor layer when melodyColor runs.
`ScriptPanel.css`

### `src/store/`
| Store | State |
|-------|-------|
| `scoreStore.ts` | `xmlString`, `metadata`, `noteMap`, `toVrv: Map<noteMapId, vrvId>` (ephemeral, set after each render) |
| `annotationStore.ts` | `annotations: Record<id, Annotation>`, undo stack (immer) |
| `selectionStore.ts` | `selection` (type, measureStart, measureEnd, noteIds=noteMapIds, anchorMeasure), `contextMenu` |
| `playbackStore.ts` | `isPlaying`, `currentMeasure`, `bpm` |
| `layerStore.ts` | `visible: Record<layerId, boolean>`, `legendColors: Record<string,string>` (key: `"layerId:itemIndex"`). Methods: `toggle`, `setVisible`, `setAll`, `setLegendColor`. Exports `getEffectiveNoteColors(legendColors)` |
| `libraryStore.ts` | `pieces[]`, `activePieceId`, `currentView: 'library'\|'analysis'`, `setView()` |
| `stylusStore.ts` | `palette: PaletteEntry[]` (color/width/opacity/linkedLayer/label), `activeColorId`. Persisted to localStorage |

### `src/views/`
| File | Purpose |
|------|---------|
| `LibraryView.tsx` | Home/library screen — cards grid, sort/filter, upload+metadata modal |
| `LibraryView.css` | Library view styles |

### `src/components/library/`
| File | Purpose |
|------|---------|
| `LibraryCard.tsx` | Individual piece card — title, composer, genre, year, key, measures, last opened |
| `LibraryCard.css` | Card styles |

### `src/services/`
| File | Purpose |
|------|---------|
| `xmlParser.ts` | `parseMusicXml()` → NoteMap. `parseHarmonies()` → HarmonyItem[]. Handles `<backup>/<forward>`, staff filtering |
| `xmlSanitizer.ts` | `prepareMusicXML()` — fixes multi-staff ordering for Verovio |
| `storageService.ts` | IndexedDB — `saveFile()`, `loadFile()` |
| `jsonExporter.ts` | Exports `.analysis.json` |
| `melodyColorScript.ts` | Script 1 — colors notes by melodic role. Uses XML harmonies + user harmony annotations. 3-pass: chord tone → passing (run-based, monotone+stepwise) → neighbor (same MIDI prev/next). Returns `{ annotations, count }`. |
| `motifScript.ts` | Script 2 — finds motif occurrences. Reads user MotifAnnotations as seeds. Searches EXACT/INVERSION/RETROGRADE. |
| `chordParser.ts` | `parseChordSymbol()` → pitch class Set. `noteNameToPc()` |

### `src/hooks/`
`useAutoSave.ts` — 1.5s debounce → IndexedDB
`useKeyboard.ts` — H/M/F/T/Q/Space/Ctrl+Z/Escape shortcuts
`usePlayback.ts` — Tone.js synthesis from NoteMap
`useRestoreSession.ts` — loads last piece on startup

### `src/types/`
`score.ts` — `NoteMap`, `MeasureData`, `NoteData`, `ScoreMetadata`
`annotation.ts` — `Annotation` type, `NoteColorAnnotation` (colorType: CHORD_TONE | PASSING_TONE | NEIGHBOR_TONE | CHROMATIC | AMBIGUOUS), `SelectionType`
`analysis.ts` — `.analysis.json` export format

### `src/constants/`
`layers.ts` — 8 layer definitions (harmony, melody, form, motif, noteColor...)
`tags.ts` — tag definitions per layer

---

## `xmlParser.ts` key facts

- `parseMusicXml()` iterates measure children in order — handles `<backup>` (rewinds beat), `<forward>` (advances beat), skips `staff ≠ 1`
- Note IDs: `note-m{measureNum}b{Math.round(beat*100)}-{step}{octave}`
- `parseHarmonies()` → `HarmonyItem[]` with `{ measureNum, beatFraction, label }` — label = rootStep + accidental (♭/♯) + kindText

---

## Annotation system

```typescript
interface Annotation {
  id: string
  layer: string        // 'harmony' | 'melody' | 'form' | 'motif' | 'label' | 'noteColor' | 'svgColor' | ...
  measureStart: number
  measureEnd?: number
  noteIds?: string[]   // ALWAYS noteMap IDs — never Verovio IDs
  scriptId?: string    // set when created by a script (e.g. 'melodyColor', 'motifFinder')
  visualOffset?: { x: number; y: number }  // drag-to-reposition offset in SVG pixels
  // layer-specific fields: chordFunction, cadenceType, colorType, formLabel, label, variantType, ...
}
```

**`SvgColorAnnotation`** (`layer: 'svgColor'`) — colors non-note SVG elements (dynamics, articulation, hairpins, fermatas, etc.):
```typescript
{ layer: 'svgColor', color: string, svgClass: string, positionIndex: number, measureStart: number }
```
- `svgClass`: Verovio element class (`dynam` | `artic` | `hairpin` | `tempo` | `fermata` | `trill` | `turn` | `mordent` | `ornament` | `dir`)
- `positionIndex`: index among elements of same class within the measure (stable across re-renders)
- Applied by `applySvgColors()` in ScoreView — stroke-only for hairpins (`fill="none"` → only `stroke` changed), fill for glyphs/text

Annotations stored in `annotationStore`. Auto-saved to IndexedDB. Rendered by `AnnotationOverlay`.

---

## Script system (`src/components/scripts/ScriptPanel.tsx`)

- Opened by 🔬 button in TopBar
- Clicking a script: clears previous results → re-runs
- `clearScript(id)` reads fresh state via `useAnnotationStore.getState()` (avoids stale closure)
- After melodyColor runs: auto-calls `useLayerStore.getState().setVisible('noteColor', true)`

### Script 1 — Melody Colors (`melodyColorScript.ts`)
- Chord source: XML harmonies (`parseHarmonies`) merged with user harmony annotations
- Beat-precise chord lookup via `beatFraction`
- colorTypes: `CHORD_TONE` (blue), `PASSING_TONE` (purple), `NEIGHBOR_TONE` (green) — NO CHROMATIC, NO AMBIGUOUS
- All non-chord tones go through the same algorithm (no special chromatic treatment)
- **Algorithm — 3 passes:**
  1. **Pass 1:** mark chord tones (pitch class ∈ current chord set)
  2. **Pass 2 (passing):** find runs of consecutive non-chord-tones bounded by chord tones on both sides; full sequence (prevChord → run → nextChord) must be monotone (all ascending or all descending) AND step-wise (each consecutive interval ≤2 semitones)
  3. **Pass 3 (neighbor):** single non-chord-tone whose immediate prev AND next are both chord tones with the EXACT SAME MIDI pitch
- Stores `noteIds: [noteMapId]` — renderer-agnostic
- ScriptPanel shows completion message: `✓ סיים — N תווים נצבעו` / `✓ Done — N notes colored`

### Script 2 — Motif Finder (`motifScript.ts`)
- Seeds: user-created `MotifAnnotation` objects without `scriptId`
- Groups by label (A/B/C), picks one seed per label (prefers `variantType === 'original'`)
- Sliding window over staff-1 notes (sorted by measure+beat)
- Transformations: EXACT → 'original', INVERSION, RETROGRADE (default threshold 80%)
- Re-emits seed as confirmed original + all found occurrences
- Error if no motif seeds: `'NO_MOTIF_ANNOTATIONS'`

### Note color rendering (`ScoreView.tsx`)
- `applyNoteColors`: translates noteMapId → vrvId via `toVrv`, then targets `g.notehead > use` (or `use` fallback) — colors only the note head, not stem/flag/accidentals
- `clearNoteColors`: clears only `.notehead` elements
- Color map: `CHORD_TONE=#3b82f6` (blue), `PASSING_TONE=#a855f7` (purple), `NEIGHBOR_TONE=#22c55e` (green)
- Same colors defined in `src/constants/layers.ts` → `NOTE_COLORS` export
- `AnnotationOverlay.tsx` skips noteColor annotations entirely (returns null) — no overlay rect, coloring is DOM-direct only
- RightPanel shows color dot + colored text for noteColor annotations (uses NOTE_COLORS import)

---

## RightPanel — Analysis display

- Shows annotations for selected measure range
- For `noteColor` annotations with a note selection: filters by `selection.noteIds` (noteMap IDs) — shows only the annotation for the exact selected note
- `getAnnotationSummary` for noteColor shows human-readable labels: "Chord Tone", "Passing Tone", "Neighbor Tone"

---

## What's done ✅

- Verovio rendering (npm ESM, multi-page SVG)
- elementMap (g.measure → screen-space bboxes)
- Multi-staff rendering fixed (prepareMusicXML in xmlSanitizer.ts)
- Chord symbols render natively (no overlay needed)
- **Note-level selection** — click g.note → purple highlight + context menu
- **Measure-level selection** — click, shift+click range, lasso drag
- Annotation system with undo
- Library (IndexedDB, left panel)
- JSON export
- Layer toggles
- i18n Hebrew/English
- Keyboard shortcuts (incl. Escape)
- Tone.js playback hook — **fixed timing** (sixteenth subdivision in Tone.js Part events)
- Auto-save + **annotations load on piece open** (IndexedDB load fixed)
- **toVrv/fromVrv ID mapping** — positional matching, 643 entries on DONNALEE.XML
- **Script 1: Melody Colors** — chord tone (blue) / passing tone (purple) / neighbor tone (green). Note head coloring only. Auto-enables noteColor layer. Completion message in ScriptPanel.
- **Script 2: Motif Finder** — sliding window, EXACT/INVERSION/RETROGRADE, summary alert
- **ScriptPanel UI** — 🔬 button, bilingual, clear+rerun on click
- **RightPanel analysis** — readable labels per note, filtered to selected note
- **Note color display fixed** — ref-managed div replaces `dangerouslySetInnerHTML`, React re-renders no longer wipe inline styles
- **`annotation.ts` types cleaned** — `NoteColorAnnotation.colorType` is `CHORD_TONE | PASSING_TONE | NEIGHBOR_TONE` only
- **שלב 1: Library View** — cards grid, sort/filter/search, metadata form modal, back-to-library button in TopBar, two-view routing via `currentView` in libraryStore
- **שלב 2: StatusBar חכם** — `chordDetector.ts` (pitch-class matching, jazz flat names), StatusBar מציג note names מ-noteMap, זיהוי אקורד אוטומטי, לחיצה על שם האקורד → HarmonyAnnotation. RightPanel pitch מ-noteMap.
- **שלב 3: סלקציה מלאה** — ר' פירוט בסעיף "Stage 3" למטה.
- **שלב 4: LeftPanel מחודש + Legend** — ר' פירוט בסעיף "Stage 4" למטה.
- **שלב 4.5: Annotation Visuals Redesign** — ר' פירוט בסעיף "Stage 4.5" למטה.
- **שלב 5: Stylus / Freehand Drawing** — ר' פירוט בסעיף "Stage 5" למטה.
- **שלב 6: Research Notes** — ר' פירוט בסעיף "Stage 6" למטה.
- **שלב 7: File System Sync** — syncService, 📁 Sync button in TopBar, auto-write + read-back on open.
- **שלב 8: Export** — JSON מעודכן (researchNotes + palette + full freehand strokes), `pdfExporter.ts` (window.print + CSS print), כפתור 🖨 PDF ב-TopBar.
- **שלב 10: Playback משופר** — cursor נע (PlaybackHighlightShape תוקן), auto-scroll תיבה פעילה, נגינה מהסלקציה, Pause/Resume/Stop controls, Loop section (🔁). `playbackStore`: isPaused/startMeasure/loop. Space = play→pause→resume.
- **שלב 9: Roman Numeral Analysis** — `romanNumeralScript.ts`. 3 מצבים אוטומטיים: (A) עדכון harmony annotations קיימים בסטור, (A-XML) יצירה מ-`<harmony>` elements ב-XML (lead sheets / jazz), (B) chordify כל הסולמות (קלאסי). מנגנון RN: diatonic degrees, secondary dominants (V7/X), secondary leading tones (viiø7/X), chromatic degrees (bVI, bVII, #IV), harmonic function T/S/D. HarmonyShape מציג chord symbol + RN מוערמים. `detectChordFromPcs()` הופרד מ-`detectChord()`. `parseAllStavesNotes()` נוסף ל-xmlParser. `scriptId` הועבר ל-BaseAnnotation.

## What's pending ⬜

- **שלב 9 המשך** — ניתוח הרמוני מלא (voice leading, modulations)
- **FormalStrip** — needs measure-range annotations to render
- **Mobile/touch** — not started

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
| 6 | אינטגרציה ב-MAP, הסרת Verovio | ⬜ **Checkpoint C** |
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
```

Always test with DONNALEE.XML (click "♩ Donna Lee" button on empty state).

**Important:** After HMR, if useEffect deps array changed size — do a full page reload (Ctrl+Shift+R). HMR breaks on deps array size changes in React.

---

## Stage 3 — Full Selection (completed March 2026)

### Selection — `anchorNoteId`
`Selection` in `selectionStore.ts` now has `anchorNoteId?: string` — the "fixed" end for Shift+arrow extend/shrink:
- Shift+→: anchor at start → extend right; anchor at end → shrink from left
- Shift+←: anchor at end → extend left; anchor at start → shrink from right

### `data-notemap-id` attribute
`buildVrvNoteIdMap` stamps `data-notemap-id` on every `g.note` SVG element. All keyboard navigation reads this attribute — **never** uses ephemeral Verovio IDs in `getDomOrderedNoteIds` / `getMeasureNumForNote`.

### Shift+↑/↓ — system navigation
Detects `g.system` elements in Verovio SVG. Shift+↑ extends measureStart to the first measure of the system row above; Shift+↓ extends measureEnd to the last measure of the system row below.

### SVG element coloring
- Click `g.dynam`, `g.artic`, `g.hairpin`, `g.tempo`, `g.fermata`, `g.trill`, `g.turn`, `g.mordent`, `g.ornament`, `g.dir` → color picker popover
- Proximity-based hit detection: `SVG_HIT_PADDING = 8px` around bbox — handles thin hairpins and small glyphs
- Notes/harmony checked **first** — clicking a note never opens color picker by mistake
- **Smart coloring**: elements with `fill="none"` (hairpins, slurs) → only `stroke` changed; glyph/text elements → `fill` changed
- Stored as `SvgColorAnnotation` identified by `svgClass + positionIndex + measureStart` (stable across re-renders)
- Verovio class names: `fermata` (not `ferm`), `dir` for text directions

### Drag annotations
`AnnotationOverlay` → each annotation shape is draggable (`pointerEvents: 'all'`, `cursor: 'move'`). Drag commits `visualOffset: {x,y}` to `annotationStore.updateAnnotation` on mouseup. Live preview during drag via local `useState`.

---

## Stage 4 — LeftPanel Redesign + Legend (completed March 2026)

### LeftPanel layout
Each layer row: `[checkbox] [label] [▸ expand]`
- Clicking the **checkbox area** → toggles layer visibility (`layerStore.toggle`)
- Clicking **▸** → collapses/expands the legend inline (local `Set<LayerId>` state)
- Legend persists open while working — no auto-close

### Legend items
`layers.ts` — each `LayerConfig` has `legend?: LegendItem[]` with `{ color, colorKey?, labelHe, labelEn }`.
- `colorKey` (on noteColor layer items) links the item to `NOTE_COLORS` key (`CHORD_TONE` / `PASSING_TONE` / `NEIGHBOR_TONE`)
- Legend dots are `<label>` wrapping a hidden `<input type="color">` → click dot → native color picker

### Editable legend colors
`layerStore.legendColors: Record<string, string>` — key `"${layerId}:${itemIndex}"`, persisted.
- `setLegendColor(layerId, itemIndex, color)` saves override
- `getEffectiveNoteColors(legendColors)` (exported) → merges defaults with user overrides
- `ScoreView` subscribes via `useLayerStore.subscribe` (NOT in deps array — avoids HMR deps-array-size error) → calls `applyNoteColors` with new colors immediately when any noteColor legend item changes

### ColorPalette (freehand layer)
`stylusStore.ts` — `palette: PaletteEntry[]` (id/color/width/opacity/linkedLayer/label), `activeColorId`. Persisted.
`ColorPalette.tsx` — rendered inside freehand layer's expanded legend:
- Colored circles + `+` add / `×` remove (on hover)
- Click circle → marks active + opens inline popover (color picker, width slider, opacity slider, text label, link-to-layer select)
- Popover closes on outside click

---

## Stage 4.5 — Annotation Visuals Redesign (completed March 2026)

### Visual shapes per layer

| Layer | Shape |
|-------|-------|
| **harmony** | Floating text above staff — chord function + degree (e.g. "T I") in small pill |
| **melody** | Note head recoloring — direct DOM via `applyNoteColors` (no SVG overlay rect) |
| **motif** | Metaball blob — organic capsule connecting selected notes, semi-transparent fill |
| **form** | Thick colored bar below all staves in the measure range |
| **labels** | Zigzag polyline above the selection range |
| **freehand** | Free canvas (no overlay shape) |
| **texture** | Skipped (no shape rendered) |

### `elementMap` — container-relative positions (critical fix)
`buildElementMap` in `ScoreView.tsx` now stores **container-relative** bboxes by subtracting `containerRect` at build time:
```typescript
const containerRect = container.getBoundingClientRect()
const bbox = new DOMRect(
  absBox.left - containerRect.left, absBox.top - containerRect.top,
  absBox.width, absBox.height
)
```
All helper functions in `AnnotationOverlay.tsx` (`getStaffTopY`, `getMeasureXRange`, `getRowBottomY`) use positions as-is — **no further subtraction** needed.
`findMeasureAtPoint` now accepts `containerRect` param and converts clientX/Y to container-relative before hit-testing.

### Motif metaball shape
Catmull-Rom spline connecting note centers with constant radius capsule:
- Backbone = smoothed spline through `{cx, cy}` points (sorted by measure+beat)
- Endcaps = semicircle arcs (left cap: sweep `0 0 1`, right cap: sweep `0 0 0`)
- Multi-row support: cuts between rows at row boundary, draws a segment per row

### Harmony annotation click → context menu
Clicking a harmony annotation shape:
1. `onClick={e => e.stopPropagation()}` — prevents propagation to score container (which would clear selection)
2. `onMouseDown` → calls `setSelection` + `showContextMenu(x, y, 'harmony')` directly
3. Opens context menu pre-set to harmony tab for editing

### Melody colors from legend
`getEffectiveMelodyColors(legendColors)` (exported from `layerStore.ts`) merges hardcoded defaults with user legend overrides for CT/PT/NT/SUS/APP/ESC/ANT/PED.
`AnnotationOverlay` subscribes to `legendColors` and passes `melodyColors` through `ShapeProps` to `MelodyShape`.

### All context menu tabs always visible
`getTabsForSelection` always returns all 7 tabs — just reorders them so the most relevant tab for the selection type is first.

---

## Stage 5 — Stylus / Freehand Drawing (completed March 2026)

### FreehandAnnotation type
Added `opacity?: number` and `linkedLayer?: string` to `FreehandAnnotation` in `annotation.ts`.

### drawMode in stylusStore
`stylusStore` now holds `drawMode: 'off' | 'draw' | 'erase'` (not persisted — resets on reload).
`setDrawMode(mode)` exported. FreehandCanvas reads mode from store (no local state).

### FreehandCanvas — full rewrite
- **PointerEvents** (`onPointerDown/Move/Up/Cancel` + `setPointerCapture`) — supports pen, touch, mouse
- **No floating toolbar** — mode controls live in LeftPanel (ColorPalette)
- Color/width/opacity read from `stylusStore.activeEntry`
- `touchAction: none` when drawing (prevents scroll interference on touch screens)
- **Erase mode**: `onPointerDown` → finds nearest stroke via segment-distance test (threshold 14px) → `removeAnnotation`
- **linkedLayer visibility**: stroke hidden if its `linkedLayer` is toggled off in layerStore
- Strokes saved to `annotationStore` → auto-saved to IndexedDB; Ctrl+Z undoes

### ColorPalette — draw/erase buttons
Two buttons added above the palette circles: `✏️ ציור` / `◻ מחק`.
Active draw button shows the active palette color as background.
Buttons call `setDrawMode` on click (toggle: click active mode → 'off').

---

## Stage 6 — Research Notes (completed March 2026)

### researchStore (`src/store/researchStore.ts`)
`ResearchNote { id, text, links: ResearchLink[] }` — `ResearchLink { type: 'measures'|'notes', measureStart, measureEnd?, noteIds?, label }`.
Actions: `addNote`, `updateNote`, `addLink(noteId, link)`, `removeLink(noteId, index)`, `removeNote`, `loadNotes`, `clearAll`.

### RightPanel tabs
Two tabs at the top of RightPanel: **תיוגים / Tags** (existing content) | **פתקים / Notes** (ResearchNotes component).
Tab state is local `useState` in RightPanel. Tab underline uses `#6366f1`.

### ResearchNotes (`src/components/panels/ResearchNotes.tsx`)
- List of `NoteCard` components (one per research note)
- Each card: textarea (3 rows, resizable) + link chips row + "🔗 Link selection" button + delete (×) in header
- **Link to selection**: reads current `selection` from `selectionStore` → creates `ResearchLink` with label `"m.5"` / `"m.5–8"` / `"note m.5"` → `addLink(noteId, link)`
- **Link chip click**: calls `setSelection` with the stored range/noteIds + `setScrollToMeasure(link.measureStart)`
- "🔗 Link selection" button disabled (greyed) when no selection active
- "+ New note" button at bottom with dashed border

### Scroll-to-measure (`selectionStore` + `ScoreView`)
- `selectionStore` gains `scrollToMeasure: number | null` + `setScrollToMeasure`
- `ScoreView` has `useEffect([scrollToMeasure, elementMap])` → looks up `elementMap.get('measure-${m-1}')` → `scrollRef.current.scrollTop = bbox.top - 48` → resets to null

### Persistence
- `storageService.saveFile()` accepts optional `researchNotes?: ResearchNote[]`, stores alongside annotations in IndexedDB (DB version stays at 1 — field is optional)
- `useAutoSave` subscribes to both `annotations` and `researchNotes`
- All load sites (`useRestoreSession`, `LibraryView`, `ScoreView` OpenFile/LoadSample) call `useResearchStore.getState().loadNotes(saved.researchNotes ?? [])`
