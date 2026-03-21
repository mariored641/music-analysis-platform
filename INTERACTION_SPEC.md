# MAP — Interactive Selection & Visual Feedback

## Goal

Implement a complete, polished selection and visual feedback system for the score view.  
The user needs to clearly see what they have selected at all times, be able to select via click or drag-lasso, and receive immediate visual confirmation before any annotation menu appears.

---

## Current State (What Exists)

- `ScoreView.tsx` handles `onClick` and `onContextMenu`
- `buildElementMap()` produces a `Map<"measure-N", NoteElement>` with screen-space `DOMRect` per measure
- `findMeasureAtPoint()` returns a measure number from screen coords
- `AnnotationOverlay.tsx` renders annotations as SVG rects over the score
- `selectionStore.ts` holds `selection: Selection | null` and `contextMenu` state
- Shift+click nominally extends a range, but nothing highlights the selection visually

### Key constraint
`webmscore` renders the score as opaque SVGs injected via `dangerouslySetInnerHTML`.  
We **cannot** add CSS classes to individual notes inside the SVG — there are no stable note IDs.  
All visual feedback must be done via **overlay SVG elements** drawn on top of the score,  
or via a transparent `<canvas>` layer sitting above the `.wm-svg` div.

---

## What Needs to Be Built

### 1. Selection Highlight Overlay

**Where:** New file `src/components/score/SelectionOverlay.tsx`

**What it renders:**
- A semi-transparent colored rect over every selected measure
- Style: `fill: rgba(124, 106, 247, 0.18)`, `stroke: #7c6af7`, `strokeWidth: 2`, `rx: 4`
- When a **single measure** is selected → highlight that measure's bbox
- When a **range of measures** is selected → highlight each measure's bbox individually  
  (not one big hull, because measures wrap across lines)
- The highlight is **always visible** as long as `selection !== null`, regardless of whether the context menu is open

**How to get bboxes:**  
`elementMap` keys are `"measure-N"` where N = `measureNum - 1` (0-based id).  
Correct lookup: `` elementMap.get(`measure-${measureNum - 1}`) ``

---

### 2. Drag-Lasso Selection

**Behavior:**
1. User presses mouse button on the score canvas and starts dragging (without shift)
2. A **rubber-band rect** appears immediately — a thin dashed rectangle following the cursor
3. On mouse release: find all measures whose bboxes **intersect** the lasso rect
4. If ≥1 measure found: set `selection` to the full range (min–max measureNum) and show context menu at release point
5. If 0 measures found: clear selection

**Rubber-band rect style:**
- `fill: rgba(124, 106, 247, 0.08)`
- `stroke: #7c6af7`
- `strokeDasharray: "5 3"`
- `strokeWidth: 1.5`
- Rendered inside the **same overlay SVG** as the selection highlight

**State to add in `ScoreView.tsx`:**

```typescript
interface DragState {
  active: boolean
  startX: number   // client coords
  startY: number
  currentX: number
  currentY: number
}

const [dragState, setDragState] = useState<DragState | null>(null)
```

Wire up on the `.score-container` div:
- `onMouseDown` → start drag (store start coords, set `dragState.active = true`)
- `onMouseMove` → update `dragState.currentX/Y` (only if `dragState.active`)
- `onMouseUp` → compute lasso rect, find intersecting measures, commit selection, clear `dragState`
- `onMouseLeave` → cancel drag (clear `dragState`)

**Distinguishing click vs. drag:**  
Only activate lasso if the mouse has moved > 5px from the start point. Otherwise treat as a regular click.

**Coordinate system note:**  
`elementMap` bboxes are in **screen/client coords** (from `getBoundingClientRect()`).  
`mousedown` events give `clientX/clientY`. Use these directly for the intersection check.  
For drawing the rubber-band rect inside the overlay SVG (`position: absolute` inside `.score-container`), subtract `containerRect.left` and `containerRect.top` to get SVG-local coords.

---

### 3. Click Behavior (Revised)

| Action | Result |
|---|---|
| Click on a measure | Select that measure, **show highlight**, open context menu |
| Click on empty space | Clear selection, hide context menu |
| Shift+click on measure | Extend range from `anchorMeasure` to clicked measure |
| Click and drag | Rubber-band lasso selection |
| Right-click on measure | Select that measure (if not already), open context menu |
| Escape key | Clear selection, hide context menu |

**Fix current shift+click bug:**  
`selectionStore` has `anchorMeasure?: number` on the `Selection` type.  
When first selecting a measure (non-shift click), set `anchorMeasure = measureNum`.  
When shift-clicking, build range from `anchorMeasure` (not from `measureStart`).

---

### 4. Visual State Summary

| State | Visual |
|---|---|
| Nothing selected | Score looks normal |
| Single measure selected | Purple tinted rect over that measure |
| Range selected | Purple tinted rect over each measure in range |
| Dragging lasso | Dashed purple rubber-band rect following cursor |
| Annotation exists on measure | Colored annotation rect (existing behavior — unchanged) |
| Playback active | Blue tinted rect over current measure (existing behavior — unchanged) |

Selection highlight renders **above** annotation rects (higher z-order in SVG), so it's always visible.

---

### 5. Status Bar / Selection Indicator

Update `StatusBar.tsx` to show current selection clearly:

- Nothing selected: show key + time signature (existing)
- 1 measure: `"Measure 5"`
- Range: `"Measures 3–9 (7 measures)"`

Read `selection` from `useSelectionStore`.

---

### 6. Context Menu Trigger

Keep the existing behavior of opening context menu on click, but ensure the **highlight renders first** (before the menu appears). Since both happen in the same event handler synchronously this should already be the case — the bug is that the highlight is not rendering at all.

After a **lasso drag** → open context menu at mouse-up position.

---

## Files to Create / Modify

### NEW: `src/components/score/SelectionOverlay.tsx`

```typescript
interface Props {
  selection: Selection | null
  dragState: DragState | null          // null when not dragging
  elementMap: Map<string, NoteElement>
  containerRef: RefObject<HTMLDivElement | null>
  scrollRef: RefObject<HTMLDivElement | null>  // for scroll sync
}
```

Renders:
1. **Selection rects** — one per selected measure (iterates `measureStart` to `measureEnd`)
2. **Rubber-band rect** — when `dragState.active && hasMoved > 5px`

The component re-reads `containerRect` via `ResizeObserver` + scroll listener (same pattern as `AnnotationOverlay`).

---

### MODIFY: `src/components/score/ScoreView.tsx`

1. Add `DragState` interface and `dragState` state
2. Add `onMouseDown`, `onMouseMove`, `onMouseUp`, `onMouseLeave` handlers on `.score-container`
3. Fix `handleScoreClick`: use `selection.anchorMeasure` (not `selection.measureStart`) for shift+click range
4. On fresh click (no shift): include `anchorMeasure: measureNum` in the selection object
5. Import and render `<SelectionOverlay>` **after** `<AnnotationOverlay>` in JSX (so it renders on top)
6. Pass `dragState`, `selection`, `elementMap`, `containerRef`, `scrollRef` to `SelectionOverlay`
7. Add `className={dragState?.active ? 'dragging' : ''}` on `.score-container`

**Lasso commit logic (in `onMouseUp`):**
```typescript
const lassoRect = {
  left:   Math.min(dragState.startX, dragState.currentX),
  top:    Math.min(dragState.startY, dragState.currentY),
  right:  Math.max(dragState.startX, dragState.currentX),
  bottom: Math.max(dragState.startY, dragState.currentY),
}
const hits = [...elementMap.values()].filter(el => lassoIntersects(el.bbox, lassoRect))
if (hits.length > 0) {
  const minM = Math.min(...hits.map(el => el.measureNum))
  const maxM = Math.max(...hits.map(el => el.measureNum))
  setSelection({ type: 'measures', measureStart: minM, measureEnd: maxM, noteIds: [], anchorMeasure: minM })
  showContextMenu(dragState.currentX, dragState.currentY)
} else {
  clearSelection()
}
setDragState(null)
```

---

### MODIFY: `src/store/selectionStore.ts`

No changes needed to the store itself — `anchorMeasure` is already in the `Selection` type.  
Just ensure every call to `setSelection` in `ScoreView.tsx` includes `anchorMeasure`.

Add Escape key handler in `useKeyboard.ts`:
```typescript
case 'Escape':
  useSelectionStore.getState().clearSelection()
  useSelectionStore.getState().hideContextMenu()
  break
```

---

### MODIFY: `src/components/layout/StatusBar.tsx`

Add selection info display:
```typescript
const selection = useSelectionStore(s => s.selection)

// In JSX:
{selection && (
  <span className="status-selection">
    {selection.measureStart === selection.measureEnd
      ? `Measure ${selection.measureStart}`
      : `Measures ${selection.measureStart}–${selection.measureEnd} (${selection.measureEnd - selection.measureStart + 1} measures)`
    }
  </span>
)}
```

---

### MODIFY: `src/components/score/ScoreView.css`

Remove dead CSS rules that reference SVG classes that don't exist (webmscore constraint):
```css
/* DELETE these — webmscore SVG has no accessible note IDs */
.wm-svg .map-selected path,
.wm-svg .map-selected use { ... }
.wm-svg .map-playing { ... }
.wm-svg .map-sel { ... }
```

Add cursor styles:
```css
.score-container { cursor: default; }
.score-container.dragging { cursor: crosshair; }
```

---

## Utility Functions (add to `ScoreView.tsx` or a new `selectionUtils.ts`)

### Lasso intersection
```typescript
function lassoIntersects(
  bbox: DOMRect,
  lasso: { left: number; top: number; right: number; bottom: number }
): boolean {
  return (
    bbox.left   < lasso.right  &&
    bbox.right  > lasso.left   &&
    bbox.top    < lasso.bottom &&
    bbox.bottom > lasso.top
  )
}
```

### Measure bbox lookup (1-based measureNum → elementMap)
```typescript
function getMeasureBbox(measureNum: number, elementMap: Map<string, NoteElement>): DOMRect | null {
  return elementMap.get(`measure-${measureNum - 1}`)?.bbox ?? null
}
```

### Coordinate conversion (client → SVG-local)
```typescript
// In SelectionOverlay, convert client coords to overlay SVG-local coords:
const toLocal = (clientX: number, clientY: number, containerRect: DOMRect) => ({
  x: clientX - containerRect.left,
  y: clientY - containerRect.top,
})
```

---

## Scroll Handling

`AnnotationOverlay` already uses `ResizeObserver` to refresh `containerRect`, but does NOT listen to scroll events. This causes overlay rects to drift when the user scrolls down.

Fix: add a scroll listener on `scrollRef` (the `.score-scroll` div) in both `AnnotationOverlay` and `SelectionOverlay`:

```typescript
useEffect(() => {
  const el = scrollRef.current
  if (!el) return
  const onScroll = () => {
    if (containerRef.current) setContainerRect(containerRef.current.getBoundingClientRect())
  }
  el.addEventListener('scroll', onScroll, { passive: true })
  return () => el.removeEventListener('scroll', onScroll)
}, [scrollRef, containerRef])
```

Pass `scrollRef` from `ScoreView` to both overlay components.

---

## What NOT to Change

- `buildElementMap()` — it works correctly, do not modify
- `renderWithWebMscore()` — do not modify
- `HarmonyOverlay` chord rendering — do not touch
- `AnnotationOverlay` annotation shapes — do not touch
- `annotationStore` undo/redo logic — do not touch
- Existing layer toggle system

---

## Testing Checklist

Use `public/DONNALEE.XML` (click "♩ Donna Lee" in the empty state).

- [ ] Click measure 1 → purple highlight appears over measure 1
- [ ] Shift+click measure 8 → measures 1–8 all highlighted individually
- [ ] Click empty space → highlight disappears
- [ ] Click and drag across measures 10–15 → rubber-band rect appears during drag
- [ ] On release → measures 10–15 highlighted, context menu appears
- [ ] StatusBar shows `"Measures 10–15 (6 measures)"`
- [ ] Press Escape → clears selection and highlight
- [ ] Right-click on a measure → context menu appears, measure is highlighted
- [ ] Scroll down → overlay rects stay aligned with their measures
- [ ] Annotations still render correctly (not broken by SelectionOverlay)
- [ ] Playback highlight still works (blue rect on current measure)
