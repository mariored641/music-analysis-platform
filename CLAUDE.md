# MAP — Music Analysis Platform
## CLAUDE.md — Project context for AI sessions

**Stack:** React 18 + TypeScript + Vite + Zustand + Tone.js + i18next + PWA
**Location:** `C:\Users\DELL\Documents\MAP - Music Analysis Platform`
**Test file:** `public/DONNALEE.XML` — Donna Lee, Charlie Parker, Ab major, 4/4, 100 measures
**Dev server:** `node node_modules/vite/bin/vite.js --port 3002` (or next available port)
**GitHub:** https://github.com/mariored641/music-analysis-platform
**Vercel:** https://map-music-analysis-platform.vercel.app (auto-deploys on push to main/master)

---

## Layout

Three-panel fixed layout:
```
┌──────────┬────────────────────┬──────────┐
│LeftPanel │    ScoreView       │RightPanel│
│  180px   │  (flex, scrolls)   │  180px   │
└──────────┴────────────────────┴──────────┘
│              StatusBar                    │
└───────────────────────────────────────────┘
```
- **TopBar** — title, language toggle, play button, BPM, JSON export
- **FormalStrip** — horizontal colored strip above score (form annotations)
- **ScoreView** — main score rendering area with overlays
- **LeftPanel** — library list + layer toggles
- **RightPanel** — selection details, tag count, open questions
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
         → requestAnimationFrame → buildElementMap()
         → setElementMap(Map<"measure-N", NoteElement>)
```

**`buildElementMap(container)`**
- Queries `container.querySelectorAll('g.measure')` — Verovio class for measure groups
- `elementMap` key: `"measure-N"` where N = index (0-based)
- `NoteElement.measureNum` = index + 1 (1-based)
- DONNALEE.XML: 100 measures, 643 notes, each `g.note` has a unique Verovio ID

**Click detection:**
- Note click: `e.target.closest('g.note')` → gets note ID + parent measure index
- Measure click: `findMeasureAtPoint(clientX, clientY, elementMap)` — bbox hit test

---

## Selection system

| Action | Result |
|--------|--------|
| Click note | Purple highlight on note, StatusBar: `Note — m.N` |
| Click measure (non-note area) | Purple highlight on measure, StatusBar: `Measure N` |
| Shift+click | Extends range from anchorMeasure |
| Drag lasso | Rubber-band rect → selects **notes** (`type: 'notes'`) intersecting the rect, not measures |
| Escape | Clears selection |

**Context menu positioning:** uses `useLayoutEffect` to measure actual rendered height after each open, clamps to viewport on all four sides (no hardcoded height). Never goes off-screen.

**Tag button tooltips:** `title` attribute on tag chips shows `עברית / English` on hover — covers HARMONY_FUNCTIONS, CADENCE_TYPES, MOTIF_VARIANTS, MELODY_NOTE_FUNCTIONS, CHROMATICISM.

**SelectionOverlay.tsx** — note bbox from `document.getElementById(noteId).getBoundingClientRect()`, measure bbox from elementMap.

---

## Source files

### `src/components/score/`
| File | Purpose |
|------|---------|
| `ScoreView.tsx` | Main renderer — Verovio, elementMap, click/drag handling |
| `ScoreView.css` | Score layout styles |
| `SelectionOverlay.tsx` | SVG overlay — note + measure highlight, lasso rect |
| `AnnotationOverlay.tsx` | SVG overlay for annotations (colored rects + labels) |
| `HarmonyOverlay.tsx` | Legacy file — imported but not rendered (Verovio renders chord symbols natively) |
| `FormalStrip.tsx` | Horizontal strip above score for form annotations |
| `FreehandCanvas.tsx` | Canvas layer for freehand drawing |

### `src/components/layout/`
`TopBar.tsx`, `LeftPanel.tsx`, `RightPanel.tsx`, `StatusBar.tsx`

### `src/components/menus/`
`ContextMenu.tsx` — dispatcher
`HarmonyMenu.tsx`, `MelodyMenu.tsx`, `FormMenu.tsx`, `MotifMenu.tsx`, `LabelMenu.tsx`, `NoteColorMenu.tsx`

### `src/store/`
| Store | State |
|-------|-------|
| `scoreStore.ts` | `xmlString`, `metadata`, `noteMap` |
| `annotationStore.ts` | `annotations: Record<id, Annotation>`, undo stack (immer) |
| `selectionStore.ts` | `selection` (type, measureStart, measureEnd, noteIds, anchorMeasure), `contextMenu` |
| `playbackStore.ts` | `isPlaying`, `currentMeasure`, `bpm` |
| `layerStore.ts` | `visible: Record<layerId, boolean>` — 8 layers, persisted to localStorage |
| `libraryStore.ts` | `pieces[]` — saved piece list |

### `src/services/`
| File | Purpose |
|------|---------|
| `xmlParser.ts` | `parseMusicXml()` → NoteMap. `parseHarmonies()` → HarmonyItem[]. Handles `<backup>/<forward>`, staff filtering |
| `xmlSanitizer.ts` | `prepareMusicXML()` — fixes multi-staff ordering for Verovio |
| `storageService.ts` | IndexedDB — `saveFile()`, `loadFile()` |
| `jsonExporter.ts` | Exports `.analysis.json` |

### `src/hooks/`
`useAutoSave.ts` — 1.5s debounce → IndexedDB
`useKeyboard.ts` — H/M/F/T/Q/Space/Ctrl+Z/Escape shortcuts
`usePlayback.ts` — Tone.js synthesis from NoteMap
`useRestoreSession.ts` — loads last piece on startup

### `src/types/`
`score.ts` — `NoteMap`, `MeasureData`, `NoteData`, `ScoreMetadata`
`annotation.ts` — `Annotation` type, `SelectionType = 'note' | 'notes' | 'measure' | 'measures'`
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
  layer: string        // 'harmony' | 'melody' | 'form' | 'motif' | 'label' | 'noteColor' | ...
  measureStart: number
  measureEnd: number
  noteIds?: string[]   // Verovio element IDs (g.note id attributes)
  // layer-specific fields: chordFunction, cadenceType, colorType, formLabel, motifId, ...
}
```

Annotations stored in `annotationStore`. Auto-saved to IndexedDB. Rendered by `AnnotationOverlay` (colored rects based on elementMap bboxes).

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
- Tone.js playback hook
- Auto-save

## What's pending ⬜

- **Playback bug** — notes play simultaneously (parse fix done, needs re-test)
- **FormalStrip** — needs measure-range annotations to render
- **Annotations persistence** — load from IndexedDB on piece open (save works, load missing)
- **Right panel** — show selection data (note pitch, chord analysis)
- **Python scripts** — 6 analysis scripts (harmony, melody, motifs, tessitura, etc.)
- **Mobile/touch** — not started

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
