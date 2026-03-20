# MAP — Music Analysis Platform
## CLAUDE.md — Project context for AI sessions

**Stack:** React 18 + TypeScript + Vite + Zustand + Tone.js + i18next + PWA
**Location:** `C:\Users\DELL\Documents\MAP - Music Analysis Platform`
**Test file:** `public/DONNALEE.XML` — Donna Lee, Charlie Parker, Ab major, 4/4, 100 measures
**Dev server:** `node node_modules/vite/bin/vite.js --port 3002` (or next available port)

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
- **StatusBar** — key, time sig, measure info, shortcut hints

---

## Renderer: webmscore (current, working)

**Renderer history (do not re-litigate):**
1. Verovio — wrong chord symbol positions (linked to bass clef rest). Replaced.
2. OSMD — wrong chord positions for some measures. Replaced.
3. **webmscore** ← current. MuseScore 4 WASM via CDN. Fully working.

**How it loads:** `<script>` tag in `index.html`:
```html
<script src="https://cdn.jsdelivr.net/npm/webmscore/webmscore.js"></script>
```

**API (confirmed working):**
```typescript
declare const WebMscore: any   // global from CDN
await WebMscore.ready
const score = await WebMscore.load('musicxml', uint8array)
const meta  = await score.metadata()        // { pages, title, measures, ... }
const svg   = await score.saveSvg(i, false) // SVG string per page
const pos   = await score.savePositions(false) // JSON string
const midi  = await score.saveMidi()        // Uint8Array
score.destroy()   // ← NOT score.close() (doesn't exist)
```

**Known webmscore bug:** Chord symbol root letters (Ab, Bb, F#...) are NOT rendered by webmscore — the Edwin font is missing from the WASM binary. Only the quality/suffix (m7, Maj7, 7...) renders as `path.Harmony` elements.
**Fix:** `HarmonyOverlay.tsx` parses `<harmony>` from MusicXML and overlays complete chord labels. CSS hides the partial webmscore paths: `.wm-svg path.Harmony { visibility: hidden }`.

---

## ScoreView rendering flow

```
xmlString → renderWithWebMscore() → { svgs[], positions }
         → dangerouslySetInnerHTML (.wm-svg div)
         → requestAnimationFrame → buildElementMap()
         → setElementMap(Map<"measure-N", NoteElement>)
```

**`buildElementMap(container, positions)`**
- `positions.elements`: `[{ id, page, x, y, sx, sy }]` — SVG coords, 0-based measure index
- For each measure: gets page SVG's `getBoundingClientRect()`, applies scale, builds screen-space DOMRect
- `elementMap` key: `"measure-N"` where N = id (0-based)
- `NoteElement.measureNum` = id + 1 (1-based, matches MusicXML `<measure number="...">`)

**`savePositions()` format:**
```json
{
  "elements": [{ "id": 0, "page": 0, "x": 336.6, "y": 634.2, "sx": 555.7, "sy": 306.4 }],
  "events":   [{ "elid": 0, "position": 0 }],
  "pageSize": { "width": 2977.2, "height": 4208.4 }
}
```
- DONNALEE.XML: 4 pages, A4 size, ~268×379px rendered on screen, scale ≈ 0.09

**Click detection:** `findMeasureAtPoint(clientX, clientY, elementMap)` — checks screen coords against measure bboxes (coordinate-based, no DOM class selectors).

---

## Source files

### `src/components/score/`
| File | Purpose |
|------|---------|
| `ScoreView.tsx` | Main renderer — webmscore, elementMap, click handling |
| `ScoreView.css` | Includes `.wm-svg path.Harmony { visibility: hidden }` |
| `AnnotationOverlay.tsx` | SVG overlay for annotations (colored rects + labels) |
| `HarmonyOverlay.tsx` | SVG overlay for chord symbol labels (workaround for webmscore font bug) |
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
| `selectionStore.ts` | `selection`, `showContextMenu`, `hideContextMenu` |
| `playbackStore.ts` | `isPlaying`, `currentMeasure`, `bpm` |
| `layerStore.ts` | `visible: Record<layerId, boolean>` — 8 layers, persisted to localStorage |
| `libraryStore.ts` | `pieces[]` — saved piece list |

### `src/services/`
| File | Purpose |
|------|---------|
| `xmlParser.ts` | `parseMusicXml()` → NoteMap. `parseHarmonies()` → HarmonyItem[]. Handles `<backup>/<forward>`, staff filtering |
| `storageService.ts` | IndexedDB — `saveFile()`, `loadFile()` |
| `jsonExporter.ts` | Exports `.analysis.json` |

### `src/hooks/`
`useAutoSave.ts` — 1.5s debounce → IndexedDB
`useKeyboard.ts` — H/M/F/T/Q/Space/Ctrl+Z shortcuts
`usePlayback.ts` — Tone.js synthesis from NoteMap
`useRestoreSession.ts` — loads last piece on startup

### `src/types/`
`score.ts` — `NoteMap`, `MeasureData`, `NoteData`, `ScoreMetadata`
`annotation.ts` — `Annotation` type
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
  noteIds?: string[]
  // layer-specific fields: chordFunction, cadenceType, colorType, formLabel, motifId, ...
}
```

Annotations stored in `annotationStore`. Auto-saved to IndexedDB. Rendered by `AnnotationOverlay` (colored rects based on elementMap bboxes).

---

## What's done ✅

- webmscore rendering (4 pages, MuseScore quality)
- elementMap (measure bboxes, click detection)
- Chord symbol overlay (HarmonyOverlay — full Ab6/Bbm7/etc.)
- Annotation system with undo
- Library (IndexedDB, left panel)
- JSON export
- Layer toggles
- i18n Hebrew/English
- Keyboard shortcuts
- Tone.js playback hook
- Auto-save

## What's pending ⬜

- **Playback bug** — notes play simultaneously (parse fix done, needs re-test)
- **FormalStrip** — needs measure-range annotations to render
- **Annotations persistence** — load from IndexedDB on piece open (save works, load missing)
- **Right panel** — show selection data (measure details, chord analysis)
- **Note-level highlighting** — webmscore SVG has no note IDs, needs position-based lookup
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
git add . && git commit -m "..." && git push origin main
```

Always test with DONNALEE.XML (click "♩ Donna Lee" button on empty state).
