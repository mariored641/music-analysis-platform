# webmscore Rendering Pipeline — Complete Reference
## סשן A: פרקים 1–9 (Horizontal + Vertical Layout Core)

> **מטרה:** מסמך reference מלא של כל שלב, כל פונקציה, כל קבוע, כל if/else ב-C++ של webmscore.
> כל constant מתועד עם ה-`Sid::` שלו וה-file:line המקורי.
> 
> **קבצי מקור שנסרקו:**
> - `src/engraving/layout/layout.cpp` (531 lines)
> - `src/engraving/layout/layoutcontext.h/.cpp` (80+46 lines)
> - `src/engraving/layout/layoutoptions.h` (83 lines)
> - `src/engraving/layout/layoutmeasure.cpp` (890 lines)
> - `src/engraving/layout/layoutsystem.cpp` (1506 lines)
> - `src/engraving/layout/layoutpage.cpp` (~950 lines)
> - `src/engraving/libmscore/measure.cpp` (~4716 lines, relevant sections)
> - `src/engraving/libmscore/segment.cpp` (~2873 lines, relevant sections)
> - `src/engraving/libmscore/chord.cpp` (~4226 lines, relevant sections)
> - `src/engraving/libmscore/stem.cpp` (358 lines)
> - `src/engraving/libmscore/beam.cpp` (~2456 lines, relevant sections)
> - `src/engraving/style/styledef.cpp` (relevant Sid definitions)

---

## פרק 1: Style Constants Registry (Sid)

> קובץ: `src/engraving/style/styledef.cpp`
> כל ה-Sid constants הרלוונטיים ל-layout עם default values.

### 1.1 Page Geometry
```
Sid::spatium                    = 24.8 (pixels at default DPI = 360dpi)
                                  = 1.75mm at 360dpi
Sid::pageWidth                  = 210.0 / INCH    (A4: 8.27")
Sid::pageHeight                 = 297.0 / INCH    (A4: 11.69")
Sid::pagePrintableWidth         = 180.0 / INCH    (A4 minus margins: ~7.09")
```
> Note: `INCH = 25.4` (mm per inch). Values stored as inches, converted to pixels via `DPI`.
> `loWidth = style.styleD(Sid::pageWidth) * DPI` → pixels

### 1.2 Staff & System Vertical Spacing
```
Sid::staffUpperBorder           = Spatium(7.0)    // margin above first staff on page
Sid::staffLowerBorder           = Spatium(7.0)    // margin below last staff on page
Sid::staffDistance              = Spatium(6.5)    // between staves of same instrument (grand staff gap)
Sid::akkoladeDistance           = Spatium(6.5)    // between staves with bracket
Sid::minSystemDistance          = Spatium(8.5)    // minimum gap between two systems
Sid::maxSystemDistance          = Spatium(15.0)   // maximum gap (with vertical justify)
Sid::staffHeaderFooterPadding   = (see layoutpage.cpp)
```

### 1.3 Horizontal Note Spacing
```
Sid::minNoteDistance            = Spatium(0.5)    // minimum note-to-note distance
Sid::barNoteDistance            = Spatium(1.3)    // barline → first note (no accidental)
Sid::barAccidentalDistance      = Spatium(0.65)   // barline → first note (has accidental)
Sid::noteBarDistance            = Spatium(1.5)    // last note → end barline
Sid::measureSpacing             = 1.5             // slope coefficient for duration stretch
Sid::minMeasureWidth            = Spatium(8.0)    // absolute minimum measure width
Sid::minMMRestWidth             = Spatium(4.0)    // minimum multi-measure rest width
Sid::lastSystemFillLimit        = 0.3             // fill last system if > 30% full
```

### 1.4 System Header Spacing
```
Sid::systemHeaderDistance       = Spatium(2.5)    // last header element → first note (gould: 2.5sp)
Sid::systemHeaderTimeSigDistance = Spatium(2.0)   // if last header is time sig (gould: 2.0sp)
Sid::clefBarlineDistance        = Spatium(0.5)    // clef → following barline
Sid::clefKeyDistance            = Spatium(1.0)    // clef → key signature (gould: 1–1.25sp)
Sid::clefTimesigDistance        = Spatium(1.0)    // clef → time signature (no key sig)
Sid::keyTimesigDistance         = Spatium(1.0)    // key sig → time signature (gould: 1–1.5sp)
Sid::keyBarlineDistance         = Spatium(1.0)    // key sig → barline
Sid::clefKeyRightMargin         = Spatium(0.8)    // min right margin after clef/key before notes
Sid::systemTrailerRightMargin   = Spatium(0.5)    // space after last element in system trailer
Sid::HeaderToLineStartDistance  = Spatium(1.0)    // minimum tie length at system start ("headerSlurTieDistance")
```

### 1.5 Barline Widths & Distances
```
Sid::barWidth                   = Spatium(0.18)   // normal thin barline width
Sid::doubleBarWidth             = Spatium(0.18)   // double barline thin line width
Sid::endBarWidth                = Spatium(0.55)   // thick line in final/repeat barline
Sid::doubleBarDistance          = Spatium(0.37)   // gap between double-bar lines
Sid::endBarDistance             = Spatium(0.37)   // gap between thin and thick in final barline
```

### 1.6 Stem & Beam
```
Sid::stemWidth                  = Spatium(0.10)   // stem stroke width
Sid::stemLength                 = 3.5             // default stem length in spatiums (= 14 quarter-spaces)
Sid::stemLengthSmall            = 2.25            // stem length for small notes
Sid::beamWidth                  = Spatium(0.5)    // beam stroke thickness
Sid::beamMinLen                 = Spatium(1.1)    // minimum beam end-to-end length
Sid::useWideBeams               = false           // if true: beamSpacing=4, else beamSpacing=3
                                                  // beamDist = (beamSpacing/4.0) * spatium * mag
```
> `beamSpacing = 3` → `beamDist = 0.75 * spatium`
> `beamSpacing = 4` → `beamDist = 1.0 * spatium` (wide beams)

### 1.7 Augmentation Dots
```
Sid::dotNoteDistance            = Spatium(0.5)    // notehead right edge → first dot center
Sid::dotDotDistance             = Spatium(0.65)   // center-to-center between dots
```

### 1.8 Note Magnification
```
Sid::smallNoteMag               = 0.7             // scale factor for small noteheads
Sid::graceNoteMag               = 0.7             // scale factor for grace notes
```

---

## פרק 2: Layout Orchestration

> קבצים: `layout.cpp` (531 שורות), `layoutcontext.h` (80), `layoutcontext.cpp` (46), `layoutoptions.h` (83)
> כל שורה נקראה ותועדה מול C++ source.

### 2.1 CmdStateLocker
**file:** `layout.cpp:60-67`

```cpp
class CmdStateLocker {
    Score* m_score;
    CmdStateLocker(Score* s) : m_score(s) { m_score->cmdState().lock(); }
    ~CmdStateLocker()                     { m_score->cmdState().unlock(); }
};
```
> RAII lock — prevents concurrent layout modifications. Created on stack at entry of `doLayoutRange()`.

---

### 2.2 Entry Point: `Layout::doLayoutRange()`
**file:** `layout.cpp:74-220`

```
Signature:
  void Layout::doLayoutRange(const LayoutOptions& options, const Fraction& st, const Fraction& et)

Input:
  options: LayoutOptions  (mode, page dimensions, showVBox)
  st: Fraction            (start tick of range to relayout)
  et: Fraction            (end tick; -1 = end of score)

Algorithm:

  // --- Step 0: Lock + Context ---
  CmdStateLocker cmdStateLocker(m_score)        // layout.cpp:76
  LayoutContext ctx(m_score)                     // layout.cpp:77

  // --- Step 1: Empty score early exit ---      // layout.cpp:83-91
  if !m_score->last()
     OR (options.isLinearMode() && !m_score->firstMeasure()):
    LOGD("empty score")
    DeleteAll(m_score->_systems)
    m_score->_systems.clear()
    DeleteAll(m_score->pages())
    m_score->pages().clear()
    LayoutPage::getNextPage(options, ctx)     // creates one empty page
    RETURN

  // --- Step 2: Determine layoutAll + normalize tick range ---  // layout.cpp:93-101
  layoutAll = (stick <= 0) && (etick < 0 || etick >= masterScore.last().endTick())
  if stick < 0 → stick = 0
  if etick < 0 → etick = score.last().endTick()
  ctx.endTick = etick

  // --- Step 3: Layout flags (pre-layout prep) ---   // layout.cpp:103-110
  if cmdState().layoutFlags & LayoutFlag::REBUILD_MIDI_MAPPING:
    if score.isMaster() → masterScore.rebuildMidiMapping()
  if cmdState().layoutFlags & LayoutFlag::FIX_PITCH_VELO:
    score.updateVelo()

  // --- Step 4: Find starting measure ---             // layout.cpp:116-137
  m = score.tick2measure(stick)
  if m == null → m = score.first()
  // Walk ONE measure back (for cautionary elements — clefs, courtesy keysigs):
  if m.prevMeasureMM() exists → m = m.prevMeasureMM()
  else if m.prev() exists    → m = m.prev()
  // Skip non-measures (VBox, TBox, HBox):
  while !m.isMeasure() && m.prev() → m = m.prev()
  // Handle MMRest: if m has no system but is part of an MMRest → jump to MMRest:
  if !m.system() && m.isMeasure() && toMeasure(m).hasMMRest():
    m = toMeasure(m).mmRest()

  // --- Step 5: BRANCH on mode ---

  // ----- LINEAR MODE (continuous view) -----         // layout.cpp:139-144
  if options.isLinearMode():
    ctx.prevMeasure = null
    ctx.nextMeasure = m
    ctx.startTick   = m.tick()
    layoutLinear(layoutAll, options, ctx)     // → see 2.4
    RETURN

  // ----- PAGE MODE (default) -----

  // --- Step 6A: Partial relayout (reuse existing system) ---  // layout.cpp:147-186
  if !layoutAll && m.system() exists:
    system = m.system()
    systemIndex = indexOf(m_score._systems, system)      // layout.cpp:149
    ctx.page    = system.page()
    ctx.curPage = score.pageIdx(ctx.page)
    if ctx.curPage == nidx → ctx.curPage = 0             // fallback
    ctx.curSystem  = system
    ctx.systemList = mid(m_score._systems, systemIndex)  // systems from systemIndex onward

    // Determine starting measure for re-layout:
    if systemIndex == 0:                                  // layout.cpp:158
      ctx.nextMeasure = showVBox ? score.first() : score.firstMeasure()
    else:
      prevSystem = m_score._systems[systemIndex - 1]
      ctx.nextMeasure = prevSystem.measures().back().next()

    // Remove systems from systemIndex onward (they'll be rebuilt):
    m_score._systems.erase(begin + systemIndex, end)     // layout.cpp:165

    // Recalculate measureNo and tick:
    if !ctx.nextMeasure.prevMeasure():                    // layout.cpp:166-185
      ctx.measureNo = 0
      ctx.tick = Fraction(0, 1)
    else:
      mb = ctx.nextMeasure.prev()
      if mb → mb = mb.findPotentialSectionBreak()
      layoutBreak = mb.sectionBreakElement()
      if layoutBreak && layoutBreak.startWithMeasureOne():
        ctx.measureNo = 0                                 // reset after section break
      else:
        ctx.measureNo = nextMeasure.prevMeasure().no()
                        + (prevMeasure.irregular() ? 0 : 1)
      ctx.tick = ctx.nextMeasure.tick()

  // --- Step 6B: Full relayout (from scratch) ---              // layout.cpp:186-212
  else:
    // Save bracket selection state before deleting systems:
    for s in m_score._systems:                            // layout.cpp:187-198
      for b in s.brackets():
        if b.selected():
          m_score._selection.remove(b)
          b.bracketItem().setSelected(true)
          m_score.setSelectionChanged(true)
      s.resetExplicitParent()

    // Reset all measure parents:
    for mb in m_score (first to last):                    // layout.cpp:199-204
      mb.resetExplicitParent()
      if mb.isMeasure() && toMeasure(mb).mmRest():
        toMeasure(mb).mmRest().moveToDummy()              // park MMRests

    // Delete everything:
    DeleteAll(m_score._systems)
    m_score._systems.clear()
    DeleteAll(m_score.pages())
    m_score.pages().clear()

    ctx.nextMeasure = showVBox ? score.first() : score.firstMeasure()

  // --- Step 7: Kickstart page layout ---                      // layout.cpp:214-219
  ctx.prevMeasure = null
  LayoutMeasure::getNextMeasure(options, ctx)                   // process first measure
  ctx.curSystem = LayoutSystem::collectSystem(options, ctx, score)  // first system
  doLayout(options, ctx)                                        // page loop → see 2.3
```

---

### 2.3 `Layout::doLayout()` — Page Loop
**file:** `layout.cpp:222-264`

```
Signature:
  void Layout::doLayout(const LayoutOptions& options, LayoutContext& lc)

Algorithm:

  MeasureBase* lmb
  do {
    LayoutPage::getNextPage(options, lc)       // create/reuse page
    LayoutPage::collectPage(options, lc)       // fill page with systems

    // Get last measure of last system on this page:
    if lc.page && !lc.page.systems().empty():   // layout.cpp:229
      lmb = lc.page.systems().back().measures().back()
    else:
      lmb = nullptr                             // layout.cpp:232

  } while (lc.curSystem                         // layout.cpp:244
           && !(lc.rangeDone && lmb == lc.pageOldMeasure))

  // Termination conditions (from comment lines 235-243):
  // Stop when:
  //   1) curSystem == null → reached end of score
  //   2) rangeDone == true AND this page ends with same measure as previous layout
  //      (pageOldMeasure = last measure from previous layout if range completed
  //       on or before this page; nullptr if page never laid out or system spilled)

  // --- Cleanup ---
  if !lc.curSystem:                              // layout.cpp:247-256
    // End of score — delete surplus systems + pages
    DeleteAll(lc.systemList)
    lc.systemList.clear()
    while score.npages() > lc.curPage:
      delete score.pages().back()
      score.pages().pop_back()
  else:                                          // layout.cpp:257-262
    // Mid-score stop — invalidate BSP tree if page changed
    p = lc.curSystem.page()
    if p && p != lc.page → p.invalidateBspTree()

  // Merge remaining systems back into score:
  score.systems().insert(end, systemList.begin, systemList.end)  // layout.cpp:263
```

---

### 2.4 `Layout::layoutLinear()` — Orchestrator (Continuous View)
**file:** `layout.cpp:270-277`

> **IMPORTANT:** There are TWO functions named `layoutLinear`. This one is the orchestrator.
> It delegates to three sub-functions:

```
Signature:
  void Layout::layoutLinear(bool layoutAll, const LayoutOptions& options, LayoutContext& lc)

Algorithm:
  1. resetSystems(layoutAll, options, lc)     // → see 2.5
  2. collectLinearSystem(options, lc)          // → see 2.6
  3. layoutLinear(options, lc)                 // → see 2.7 (DIFFERENT overload!)
```

---

### 2.5 `Layout::resetSystems()` — Linear Mode Setup
**file:** `layout.cpp:285-326`

```
Signature:
  void Layout::resetSystems(bool layoutAll, const LayoutOptions& options, LayoutContext& lc)

Purpose: In linear mode there is only ONE page containing ONE system.

Algorithm:

  if layoutAll:                                   // layout.cpp:288-315
    // Reset spanner segments (detach from old systems):
    for s in m_score._systems:
      for ss in s.spannerSegments():
        ss.resetExplicitParent()

    DeleteAll(m_score._systems)
    m_score._systems.clear()
    DeleteAll(m_score.pages())
    m_score.pages().clear()

    if !m_score.firstMeasure() → LOGD("no measures"); RETURN

    // Detach all measures:
    for mb in m_score (first→last):
      mb.resetExplicitParent()

    // Create single page:
    page = Factory::createPage(score.rootItem())
    score.pages().push_back(page)
    page.bbox = (0, 0, options.loWidth, options.loHeight)    // layout.cpp:309
    page.setNo(0)

    // Create single system:
    system = Factory::createSystem(page)
    score._systems.push_back(system)
    page.appendSystem(system)
    system.adjustStavesNumber(score.nstaves())

  else (partial):                                 // layout.cpp:316-324
    if score.pages().empty() → RETURN
    page = score.pages().front()
    system = score.systems().front()
    system.clear()                                // keep existing system, clear measures
    system.adjustStavesNumber(score.nstaves())

  lc.page = page
```

---

### 2.6 `Layout::collectLinearSystem()` — Build Single Infinite System
**file:** `layout.cpp:333-441`

```
Signature:
  void Layout::collectLinearSystem(const LayoutOptions& options, LayoutContext& ctx)

Algorithm:

  // --- Build visible parts list ---                // layout.cpp:335-340
  visibleParts = []
  for partIdx in 0..score.parts().size():
    if score.parts()[partIdx].show():
      visibleParts.push_back(partIdx)

  system = score.systems().front()
  system.setInstrumentNames(ctx, longNames=true)     // layout.cpp:343

  PointF pos                                         // accumulates x-position
  bool firstMeasure = true

  // Initialize traversal:
  ctx.nextMeasure = score._measures.first()          // layout.cpp:350
  ctx.tick = Fraction(0, 1)
  LayoutMeasure::getNextMeasure(options, ctx)

  // Fixed duration assumptions (CAUTION: linear view, not real analysis):
  static constexpr minTicks = Fraction(1, 16)        // layout.cpp:354
  static constexpr maxTicks = Fraction(4, 4)         // layout.cpp:355

  // --- Main loop: append all measures ---          // layout.cpp:361-441
  while ctx.curMeasure:
    double ww = 0.0

    // Skip VBox and TBox (not included in linear system):
    if ctx.curMeasure.isVBox() || ctx.curMeasure.isTBox():   // layout.cpp:363
      ctx.curMeasure.resetExplicitParent()
      LayoutMeasure::getNextMeasure(options, ctx)
      continue

    system.appendMeasure(ctx.curMeasure)             // layout.cpp:368

    if ctx.curMeasure.isMeasure():                   // layout.cpp:369
      Measure* m = toMeasure(ctx.curMeasure)

      // Park MMRest:
      if m.mmRest() → m.mmRest().resetExplicitParent()    // layout.cpp:371-373

      if firstMeasure:                               // layout.cpp:374-384
        system.layoutSystem(ctx, pos.rx())           // compute system header
        // Enable start-repeat barline if needed:
        if m.repeatStart():
          s = m.findSegmentR(SegmentType::StartRepeatBarLine, Fraction(0,1))
          if !s.enabled() → s.setEnabled(true)
        m.addSystemHeader(true)
        pos.rx() += system.leftMargin()
        firstMeasure = false

      else if m.header():                            // layout.cpp:385-387
        m.removeSystemHeader()                       // non-first measures lose header

      if m.trailer():                                // layout.cpp:388-390
        m.removeSystemTrailer()                      // no trailers in linear mode

      // --- BRANCH: in-range vs out-of-range ---
      if m.tick() >= ctx.startTick && m.tick() <= ctx.endTick:   // layout.cpp:391

        if options.isMode(LayoutMode::HORIZONTAL_FIXED):         // layout.cpp:393-397
          // Practice mode — fixed horizontal grid:
          m.createEndBarLines(true)
          m.layoutSegmentsInPracticeMode(visibleParts)
          ww = m.width()
          m.stretchMeasureInPracticeMode(ww)
        else:                                                     // layout.cpp:398-403
          // Normal linear mode:
          m.createEndBarLines(false)
          m.computeWidth(minTicks, maxTicks, 1)      // stretchCoeff = 1.0
          ww = m.width()
          m.layoutMeasureElements()

      else:                                          // layout.cpp:404-427
        // Out-of-range: reuse existing layout
        ww = m.width()
        if m.pos() != pos:
          // Fix beam positions (full beam relayout is expensive):
          PointF p = pos - m.pos()
          for s in m.segments():
            if !s.isChordRestType() → continue
            for track in 0..score.ntracks():
              e = s.element(track)
              if e:
                cr = toChordRest(e)
                if cr.beam() && cr.beam().elements().front() == cr:
                  cr.beam().movePos(p)               // shift beam delta

      m.setPos(pos)                                  // layout.cpp:428
      m.layoutStaffLines()                           // layout.cpp:429

    else if ctx.curMeasure.isHBox():                 // layout.cpp:430-433
      ctx.curMeasure.setPos(pos + PointF(toHBox(curMeasure).topGap(), 0))
      ctx.curMeasure.layout()
      ww = ctx.curMeasure.width()

    pos.rx() += ww                                   // layout.cpp:435
    LayoutMeasure::getNextMeasure(options, ctx)       // layout.cpp:437

  system.setWidth(pos.x())                           // layout.cpp:440
```

---

### 2.7 `Layout::layoutLinear()` — Worker (Element Layout + Page Geometry)
**file:** `layout.cpp:447-530`

> **DIFFERENT overload** from 2.4. This is called by the orchestrator AFTER collectLinearSystem.

```
Signature:
  void Layout::layoutLinear(const LayoutOptions& options, LayoutContext& ctx)

Algorithm:

  system = ctx.score().systems().front()

  // --- Phase 1: Layout all system-level elements ---
  LayoutSystem::layoutSystemElements(options, ctx, score, system)   // layout.cpp:451
  system.layout2(ctx)                                // compute staff distances  // layout.cpp:453

  // --- Phase 2: Per-measure element layout ---     // layout.cpp:455-518
  for mb in system.measures():
    if !mb.isMeasure() → continue
    m = toMeasure(mb)

    for track in 0..score.ntracks():
      for segment in m.first()→next():
        e = segment.element(track)
        if !e → continue

        if e.isChordRest():
          // Skip out-of-range measures:
          if m.tick() < ctx.startTick || m.tick() > ctx.endTick → continue
          // Skip hidden staves:
          if !score.staff(track2staff(track)).show() → continue

          cr = toChordRest(e)

          // a. Cross-staff beam layout:              // layout.cpp:475-476
          if LayoutBeams::notTopBeam(cr):
            cr.beam().layout()

          // b. Tuplet layout (recursive):            // layout.cpp:478-486
          if LayoutTuplets::notTopTuplet(cr):
            de = cr
            while de.tuplet() && de.tuplet().elements().front() == de:
              t = de.tuplet()
              t.layout()
              de = de.tuplet()

          // c. Chord-specific: grace notes, arpeggios, spanners, tremolo:
          if cr.isChord():                            // layout.cpp:488-511
            c = toChord(cr)
            for cc in c.graceNotes():                 // grace note beam + slur layout
              if cc.beam() && cc.beam().elements().front() == cc:
                cc.beam().layout()
              cc.layoutSpanners()
              for element in cc.el():
                if element.isSlur() → element.layout()

            c.layoutArpeggio2()                       // layout.cpp:501
            c.layoutSpanners()                        // layout.cpp:502

            if c.tremolo():                           // layout.cpp:503-510
              t = c.tremolo()
              c1 = t.chord1(); c2 = t.chord2()
              // Only relayout two-note tremolo with cross-staff:
              if t.twoNotes() && c1 && c2 && (c1.staffMove() || c2.staffMove()):
                t.layout()

        else if e.isBarLine():                        // layout.cpp:512-513
          toBarLine(e).layout2()

    m.layout2()                                       // layout.cpp:517 — ties, spacers

  // --- Phase 3: Page geometry ---                   // layout.cpp:520-529
  lm = ctx.page.lm()
  tm = ctx.page.tm() + score.styleMM(Sid::staffUpperBorder)
  rm = ctx.page.rm()
  bm = ctx.page.bm() + score.styleMM(Sid::staffLowerBorder)

  ctx.page.setPos(0, 0)
  system.setPos(lm, tm)
  ctx.page.setWidth(lm + system.width() + rm)
  ctx.page.setHeight(tm + system.height() + bm)
  ctx.page.invalidateBspTree()
```

---

### 2.8 LayoutContext — Full State
**file:** `layoutcontext.h:38-76`, `layoutcontext.cpp:30-45`

```cpp
class LayoutContext {
public:
    LayoutContext(Score* s);
    LayoutContext(const LayoutContext&) = delete;         // no copy
    LayoutContext& operator=(const LayoutContext&) = delete;
    ~LayoutContext();

    Score* score() const { return m_score; }             // layoutcontext.h:46

    // --- Public fields ---
    bool startWithLongNames = true;      // use long instrument names
    bool firstSystem = true;             // first system after section break?
    bool firstSystemIndent = true;       // indent first system (from style)
    Page* page = nullptr;
    page_idx_t curPage = 0;              // index into Score.pages[] (NOT int — page_idx_t)
    Fraction tick{ 0, 1 };               // current position in score

    std::vector<System*> systemList;     // reusable systems from previous layout
    std::set<Spanner*> processedSpanners; // spanners that need cleanup

    System* prevSystem = nullptr;        // previous system (for page layout distance)
    System* curSystem = nullptr;         // system being built

    MeasureBase* systemOldMeasure = nullptr;  // last measure of system in PREVIOUS layout
    MeasureBase* pageOldMeasure = nullptr;    // last measure of PAGE in previous layout
    bool rangeDone = false;                   // range completely processed?

    MeasureBase* prevMeasure = nullptr;
    MeasureBase* curMeasure = nullptr;
    MeasureBase* nextMeasure = nullptr;
    int measureNo = 0;
    Fraction startTick;
    Fraction endTick;

    double totalBracketsWidth = -1.0;

private:
    Score* m_score = nullptr;                 // layoutcontext.h:75

    // Constructor (layoutcontext.cpp:30-34):
    //   firstSystemIndent = score && score->styleB(Sid::enableIndentationOnFirstSystem)
    //   Note: null-checks score before accessing style

    // Destructor (layoutcontext.cpp:36-45):
    //   for s in processedSpanners → s.layoutSystemsDone()   // cleanup spanner layout state
    //   for v in score().getViewer() → v.layoutChanged()     // notify all views of layout change
};
```

> **`systemOldMeasure`** — last measure of the system in the PREVIOUS layout pass. Used by `collectSystem` to detect "point of stability" where re-layout can stop.
> **`pageOldMeasure`** — last measure of the PAGE in the PREVIOUS layout pass. Used by `doLayout` loop termination to detect when pages are stable.

---

### 2.9 LayoutOptions — Full Definition
**file:** `layoutoptions.h:38-82`

```cpp
// LayoutMode descriptions (from comment at layoutoptions.h:31-36):
//   PAGE   — normal page view, honors page and line breaks
//   FLOAT  — "reflow" mode, ignore page and line breaks
//   LINE   — panoramic view, one long system
//   SYSTEM — "never ending page", page breaks → line breaks
//   HORIZONTAL_FIXED — practice mode, fixed horizontal grid

enum class LayoutMode : char {                   // layoutoptions.h:38
    PAGE, FLOAT, LINE, SYSTEM, HORIZONTAL_FIXED
};

// VerticalAlignRange (defined in styledef.h):
enum class VerticalAlignRange {
    SEGMENT,    // align elements within segment
    MEASURE,    // align elements within measure
    SYSTEM      // align elements within system
};

struct LayoutOptions {                            // layoutoptions.h:42
    LayoutMode mode = LayoutMode::PAGE;           // layout.cpp:44
    bool showVBox = true;                         // include VBox frames

    // From style (populated by updateFromStyle):
    double loWidth = 0;                           // page width in pixels
    double loHeight = 0;                          // page height in pixels
    bool firstSystemIndent = true;                // indent first system

    double maxChordShiftAbove = 0;                // collision avoidance
    double maxChordShiftBelow = 0;
    double maxFretShiftAbove = 0;
    double maxFretShiftBelow = 0;

    VerticalAlignRange verticalAlignRange = VerticalAlignRange::SEGMENT;

    // Helper methods:
    bool isMode(LayoutMode m) const { return mode == m; }         // layoutoptions.h:61
    bool isLinearMode() const {                                    // layoutoptions.h:62
        return mode == LayoutMode::LINE || mode == LayoutMode::HORIZONTAL_FIXED;
    }

    void updateFromStyle(const MStyle& style) {                   // layoutoptions.h:64-78
        loWidth  = style.styleD(Sid::pageWidth) * DPI;
        loHeight = style.styleD(Sid::pageHeight) * DPI;
        firstSystemIndent = style.styleB(Sid::enableIndentationOnFirstSystem);
        maxChordShiftAbove = style.styleMM(Sid::maxChordShiftAbove);
        maxChordShiftBelow = style.styleMM(Sid::maxChordShiftBelow);
        maxFretShiftAbove  = style.styleMM(Sid::maxFretShiftAbove);
        maxFretShiftBelow  = style.styleMM(Sid::maxFretShiftBelow);
        verticalAlignRange = VerticalAlignRange(style.styleI(Sid::autoplaceVerticalAlignRange));
    }
};
```

---

## פרק 3: Measure Processing Pipeline

> קבצים: `layoutmeasure.cpp` (~890 שורות), `measure.cpp` (~4716 שורות — relevant sections)
> כל פונקציה נקראה מול C++ source ומתועדה שורה-אחר-שורה.

### 3.1 `LayoutMeasure::getNextMeasure()` — Complete Step-by-Step
**file:** `layoutmeasure.cpp:582-833`
**Called by:** `doLayoutRange()` once, then by `collectSystem()` for each measure

```
Input: options, ctx (mutates ctx.prevMeasure, ctx.curMeasure, ctx.nextMeasure, ctx.tick)

Algorithm:

  // Step 1: Advance measures                            // layoutmeasure.cpp:584-591
  ctx.prevMeasure = ctx.curMeasure
  ctx.curMeasure  = ctx.nextMeasure
  ctx.nextMeasure = (showVBox ? cur.next() : cur.nextMeasure())
  if !curMeasure → return

  // Step 2: Measure number                              // layoutmeasure.cpp:596
  adjustMeasureNo(ctx, curMeasure)                       // → see 3.5

  // Step 3: Multi-measure rest creation                 // layoutmeasure.cpp:598-636
  IF curMeasure.isMeasure() && score.styleB(Sid::createMultiMeasureRests):
    nm = m; lm = nm; n = 0; len = Fraction(0,1)
    while validMMRestMeasure(ctx, nm):                   // → see 3.2
      mb = nm.next() / nm.nextMeasure()
      if breakMultiMeasureRest(ctx, nm) && n > 0 → break  // → see 3.3
      if nm != m → adjustMeasureNo(ctx, nm)
      n++; len += nm.ticks(); lm = nm
      if !mb || !mb.isMeasure() → break
      nm = toMeasure(mb)
    if n >= styleI(Sid::minEmptyMeasures):               // default = 2
      createMMRest(options, score, m, lm, len)
      ctx.curMeasure = m.mmRest()
      ctx.nextMeasure = lm.next() or lm.nextMeasure()
    else:
      undo(new ChangeMMRest(m, 0))                       // clear existing MMRest
      m.setMMRestCount(0)
      ctx.measureNo = mno                                // restore number

  // Step 3b: MMRest without createMultiMeasureRests     // layoutmeasure.cpp:633-636
  ELSE IF curMeasure.isMMRest() && !createMultiMeasureRests:
    ctx.measureNo += mmRestCount - 1

  // Step 4: Non-measure (VBox/TBox/HBox)                // layoutmeasure.cpp:638-641
  IF !curMeasure.isMeasure():
    curMeasure.setTick(ctx.tick)
    RETURN

  // Step 5: Cast + sync tick position                   // layoutmeasure.cpp:647-648
  measure = toMeasure(curMeasure)
  measure.moveTicks(ctx.tick - measure.tick())           // → see 3.10

  // Step 5b: Linear mode skip optimization              // layoutmeasure.cpp:650-656
  IF score.linearMode() && (measure.tick() < ctx.startTick || measure.tick() > ctx.endTick):
    ctx.tick += measure.ticks()
    RETURN                                               // skip out-of-range measures

  // Step 6: Connect tremolos                            // layoutmeasure.cpp:658
  measure.connectTremolo()                               // → see 3.9

  // Step 7 (A): Accidentals + stems per staff           // layoutmeasure.cpp:664-754
  for each staffIdx:
    as = AccidentalState()
    as.init(staff.keySigEvent(measure.tick()))

    for each segment in measure:
      if KeySig segment:
        ks.layout(); as.init(staff.keySigEvent(seg.tick()))

      if ChordRest segment:
        for each track (voice) in staff:
          cr = segment.cr(track)
          // cross-staff check, mag computation
          mag = staff.staffMag(segment)
          if cr.isSmall() → mag *= styleD(Sid::smallNoteMag)  // 0.7

          if cr.isChord():
            chord.cmdUpdateNotes(&as)                    // compute accidentals
            for each graceNote:                          // grace notes first
              grace.setMag(mag * styleD(Sid::graceNoteMag))  // 0.7
              grace.computeUp()
              grace.layoutStem()
            IF drumset → layoutDrumsetChord(chord, drumset, staff, spatium)
            chord.computeUp()                            // stem direction
            chord.layoutStem()                           // create stem, set baseLength
            // Tremolo stem extension:
            if chord == tremolo.chord2() && tremolo.twoNotes():
              extLen = LayoutTremolo.extendedStemLenWithTwoNoteTremolo(...)
              stem1.setBaseLength(extLen.first)
              stem2.setBaseLength(extLen.second)

          cr.setMag(mag)

      if Clef segment: clef.setSmall(true); clef.layout()
      if TimeSig/Ambitus/HeaderClef: e.layout()

  // Step 8 (B): Create beams                            // layoutmeasure.cpp:756-767
  LayoutBeams::createBeams(score, ctx, measure)
  for each ChordRest segment:
    LayoutBeams::layoutNonCrossBeams(segment)
    // NOTE: DUMMY beams for spacing only. Real beam layout in layoutSystemElements()

  // Step 9 (C): layoutChords1 + lyrics                  // layoutmeasure.cpp:769-785
  for each staffIdx:
    for each ChordRest segment:
      LayoutChords::layoutChords1(score, &segment, staffIdx)
      for each voice: for each lyric in cr.lyrics → lyric.layout()

  // Step 10 (D): Breath + symbol annotations            // layoutmeasure.cpp:787-801
  for each segment:
    if Breath: breath.layout()
    else if ChordRest: for each Symbol annotation → symbol.layout()

  // Step 11 (E): Start repeat barlines                  // layoutmeasure.cpp:803-818
  if measure.repeatStart():
    seg = find/create StartRepeatBarLine segment
    measure.barLinesSetSpan(seg)
    for each staff: barline.setBarLineType(START_REPEAT); barline.layout()
  else if segment exists: remove it

  // Step 12 (F): Create shapes                          // layoutmeasure.cpp:820-825
  for each segment (except EndBarLine):
    segment.createShapes()

  // Step 13 (G): Grace note updates                     // layoutmeasure.cpp:827
  LayoutChords::updateGraceNotes(measure)

  // Step 14 (H): Compute segment ticks                  // layoutmeasure.cpp:829-830
  measure.computeTicks()                                 // → see 3.8  (MUST be after createShapes)

  // Step 15: Advance tick                               // layoutmeasure.cpp:832
  ctx.tick += measure.ticks()
```

---

### 3.2 `validMMRestMeasure()` — Conditions for MMRest inclusion
**file:** `layoutmeasure.cpp:396-440`

```
Returns false (cannot be in MMRest) if:
  - m.irregular()                                        // line 398
  - any annotation that is NOT one of:                   // lines 404-408
    (rehearsalMark|tempoText|harmony|staffText|systemText|tripletFeel|playTech|instrumentChange)
  - any non-rest element in ChordRest segments           // lines 410-437
  - any fermata annotation                               // lines 425-428
  - more than one rest per segment                       // lines 430-436
Returns true otherwise
```

---

### 3.3 `breakMultiMeasureRest()` — Conditions that break MMRest
**file:** `layoutmeasure.cpp:448-557`

```
Returns true if ANY of these conditions hold:

  // User override:
  - m.breakMultiMeasureRest()                            // line 453

  // Repeat/irregular/section:
  - m.repeatStart() || prevMeasure.repeatEnd()           // line 455-456
  - m.isIrregular() || prevMeasure.isIrregular()         // line 458
  - prevMeasure.sectionBreak()                           // line 460

  // Spanners:
  - Any Volta, GradualTempoChange, or TextLine           // line 462-469
    starts or ends at m.tick()

  // Markers/Jumps:
  - Any non-right-aligned Marker in m.el()               // line 471-480
  - Jump or right-aligned Marker in prevMeasure.el()     // line 482-495

  // MeasureRepeat:
  - MeasureRepeat group starts at m or prevMeasure       // line 496-502

  // Annotations (with visibility check):                // lines 504-516
  - RehearsalMark, TempoText in segment annotations
  - Harmony, StaffText, SystemText, TripletFeel, PlayTechAnnotation
    **ONLY IF** staff.show() OR annotation.systemFlag()  // visibility condition!

  // Special segments:
  - StartRepeatBarLine segment exists AND                // line 525-526
    !segment.generated()                                 // non-generated check

  // Key/Time sig at non-measure-start:
  - KeySig or TimeSig segment at non-zero tick           // lines 528-529
    AND m.tick().isNotZero()

  // Mid-measure clef:
  - Clef change where tick != m.endTick()                // lines 531-535
    AND m.tick().isNotZero()                             // boundary condition

  // Previous measure barline:
  - Non-normal barline at end of prevMeasure             // lines 538-556
    (anything except NORMAL, BROKEN, DOTTED)
    **ONLY IF** barline is non-generated (!bl.generated())

  // Clef change at measure boundary:
  - Clef change at m.tick() in prevMeasure               // line 553-554
```

---

### 3.4 `LayoutMeasure::computePreSpacingItems()`
**file:** `layoutmeasure.cpp:861-889`

```
Called BEFORE horizontal spacing, AFTER the system is known.

  LayoutChords::clearLineAttachPoints(m)                 // line 865 — MUST be first!

  bool isFirstChordInMeasure = true
  for each ChordRest segment in m:                       // line 867
    for each Chord e:
      LayoutChords::updateLineAttachPoints(chord, isFirstChordInMeasure)
      for each graceNote:
        LayoutChords::updateLineAttachPoints(grace, false)
      isFirstChordInMeasure = false

      chord.layoutArticulations()                        // line 882
      chord.layoutArticulations2()                       // line 883
      chord.checkStartEndSlurs()                         // line 884
      chord.computeKerningExceptions()                   // line 885

    seg.createShapes()                                   // line 887
```

---

### 3.5 `adjustMeasureNo()`
**file:** `layoutmeasure.cpp:839-852`

```
ctx.measureNo += m.noOffset()                            // user-defined offset
m.setNo(ctx.measureNo)
if !m.irregular():
  ctx.measureNo++
if m.sectionBreakElement() && layoutBreak.startWithMeasureOne():
  ctx.measureNo = 0
return ctx.measureNo
```

---

### 3.6 `Measure::computeWidth()` — **Core Spacing Algorithm**
**file:** `measure.cpp:4321-4363` (wrapper) + `measure.cpp:4165-4319` (internal)

> **CRITICAL:** This is the function that computes horizontal positions for ALL segments in a measure.
> Called by `collectLinearSystem()`, `collectSystem()`, and `removeSystemTrailer()`.

#### 3.6.1 Wrapper Overload
**file:** `measure.cpp:4321-4363`

```
Signature:
  void Measure::computeWidth(Fraction minTicks, Fraction maxTicks, double stretchCoeff)

Algorithm:

  // Skip disabled/invisible segments at the start:
  for s = first(); s && (!s.enabled() || s.allElementsInvisible()); s = s.next():
    s.setPosX(computeFirstSegmentXPosition(s))           // position hidden key/time sigs
    s.setWidth(0)                                        // zero width — don't affect bar

  if !s → setWidth(0); return                            // empty measure

  // Left barrier shape:
  bool first = isFirstInSystem()
  Shape ls = first ? RectF(0, -1000000, 0, 2000000)     // infinite height barrier
                   : RectF(0, 0, 0, spatium() * 4)      // limited barrier

  x = s.minLeft(ls)

  // Start-repeat barline overlap with end-repeat:        // measure.cpp:4343-4352
  if s.isStartRepeatBarLineType():
    pmb = prev()
    if pmb.isMeasure() && pmb.system() == system() && pmb.repeatEnd():
      seg = toMeasure(pmb).last()
      if seg.isEndBarLineType():
        x -= styleMM(Sid::endBarWidth) * mag()           // overlap amount

  LayoutChords::updateGraceNotes(this)                   // measure.cpp:4354

  x = computeFirstSegmentXPosition(s)                    // OVERWRITES x from minLeft!
  isSystemHeader = s.header()

  _squeezableSpace = 0                                   // measure.cpp:4361
  computeWidth(s, x, isSystemHeader, minTicks, maxTicks, stretchCoeff)  // → internal
```

#### 3.6.2 Internal Overload — Segment Iteration Loop
**file:** `measure.cpp:4165-4319`

```
Signature:
  void Measure::computeWidth(Segment* s, double x, bool isSystemHeader,
                              Fraction minTicks, Fraction maxTicks, double stretchCoeff)

Constants:
  spacingMultiplier = 1.2                                // measure.cpp:4174 (static constexpr)
  minNoteSpace = noteHeadWidth + 1.2 * styleMM(Sid::minNoteDistance)  // measure.cpp:4175
  usrStretch = clamp(userStretch(), 0.1, 10.0)           // measure.cpp:4176-4177

Algorithm:

  while s:
    s.setWidthOffset(0.0)
    s.setPosX(x)

    // Skip disabled/invisible:
    if !s.enabled() || !s.visible() || s.allElementsInvisible():
      s.setWidth(0); s = s.next(); continue

    ns = s.nextActive()
    while ns && ns.allElementsInvisible() → ns = ns.nextActive()
    if !ns → ns = s.next(SegmentType::BarLineType)      // end barline fallback

    if ns:
      // System header gap:
      if isSystemHeader && (ns.isStartRepeatBarLine || ns.isChordRest || ns.isClef&!header):
        w = s.minHorizontalDistance(ns, isSystemHeader=true)
        isSystemHeader = false
      else:
        w = s.minHorizontalDistance(ns, false)

        // Duration-based stretch for ChordRest segments:
        if s.isChordRestType():
          ps = s.prevActive()
          durStretch = s.computeDurationStretch(ps, minTicks, maxTicks)  // → chapter 4
          s.setStretch(durStretch * usrStretch)
          minStretchedWidth = minNoteSpace * durStretch * usrStretch * stretchCoeff
          // Squeezable space: the extra beyond collision minimum
          _squeezableSpace += (s.shortestChordRest() == s.ticks()) ? (minStretchedWidth - w) : 0
          w = max(w, minStretchedWidth)

      // Right-justified clefs/breaths:                   // measure.cpp:4217-4222
      if (ns.isClef || ns.isBreathe) && ns.next():
        reduction = max(ns.minHorizontalCollidingDistance(ns.next()),
                        styleMM(Sid::clefKeyRightMargin))
        w -= reduction
        s.setWidthOffset(s.widthOffset() - reduction)

      // Cross-beam displacement:                         // measure.cpp:4225-4237
      s.computeCrossBeamType(ns)
      if crossBeamType.upDown:
        displacement = noteHeadWidth - styleMM(Sid::stemWidth)
        s.setWidthOffset(s.widthOffset() + displacement)
        w += displacement; _squeezableSpace -= noteHeadWidth
      if crossBeamType.downUp:
        w -= displacement; _squeezableSpace -= noteHeadWidth

      // Lookback collision detection:                    // measure.cpp:4240-4290
      if s == fs (first segment):
        w = max(w, ns.minLeft(ls) - s.x())

      n = 1
      for ps = s backward through prevActive:
        ww = ps.minHorizontalCollidingDistance(ns) - (s.x() - ps.x())
        if ps == fs → ww = max(ww, ns.minLeft(ls) - s.x())
        if ww > w:
          // OVERLAP detected → redistribute space:
          d = (ww - w) / n
          xx = ps.x()
          for ss = ps forward to s:
            ns1 = ss.nextActive()
            ww1 = ss.width()
            if ss.isChordRestType() → ww1 += d; ss.setWidth(ww1)
            xx += ww1; ns1.setPosX(xx)
          if s.isChordRestType() → w += d
          x = xx; break
        if ps.isChordRestType() → n++

    else:
      w = s.minRight()                                   // last segment — right margin only

    s.setWidth(w)
    x += w
    s = s.next()

  // Squeezable space clamping:                           // measure.cpp:4302-4308
  if isMMRest():
    _squeezableSpace = max(x - styleMM(Sid::minMMRestWidth), 0)
  else:
    _squeezableSpace = max(0, min(_squeezableSpace, x - styleMM(Sid::minMeasureWidth)))

  setLayoutStretch(stretchCoeff)                         // measure.cpp:4310
  setWidth(x)                                            // measure.cpp:4311

  // Minimum width check:                                // measure.cpp:4313-4319
  minWidth = computeMinMeasureWidth()
  if width() < minWidth:
    stretchToTargetWidth(minWidth)
    setWidthLocked(true)
  else:
    setWidthLocked(false)
```

---

### 3.7 `Measure::addSystemHeader()`
**file:** `measure.cpp:3738-3895`

```
Signature:
  void Measure::addSystemHeader(bool isFirstSystem)

Algorithm:
  for each staff (staffIdx):
    track = staffIdx * VOICES

    // --- CLEF ---                                      // measure.cpp:3745-3800
    if isFirstSystem || styleB(Sid::genClef):
      cl = staff.clefType(tick() - 1)                   // clef at previous tick

      // Check for clef change at end of previous measure:
      if prevMeasure():
        s = prevMeasure().findSegment(SegmentType::Clef, tick())
      else if isMMRest():
        s = mmRestFirst().findFirstR(SegmentType::HeaderClef, Fraction(0,1))
      if s && s.element(track) → cl = clef.clefTypeList()

      // Create/update HeaderClef segment:
      if !cSegment → create SegmentType::HeaderClef, setHeader(true)
      if staff.genClef():
        if !clef → create Clef, setGenerated(true)
        if clef.generated() → clef.setClefType(cl)
        clef.setSmall(false); clef.layout()
      else: remove clef if exists
      cSegment.setEnabled(true)
    else:
      if cSegment → cSegment.setEnabled(false)

    // --- KEY SIGNATURE ---                             // measure.cpp:3801-3890
    needKeysig = isFirstSystem || styleB(Sid::genKeysig)

    // Courtesy key sig suppression (Key::C with courtesy):
    keyIdx = staff.keySigEvent(tick())
    if needKeysig && keyIdx.key() == Key::C:
      pm = prevMeasure()
      if pm.hasCourtesyKeySig():
        ksAnnounce = pm.first(KeySigAnnounce).element(track)
        if ksAnnounce → needKeysig = false               // suppress invisible C keysig

    // Custom/atonal key always shown:
    needKeysig = needKeysig && (keyIdx.key() != Key::C || keyIdx.custom() || keyIdx.isAtonal())

    if needKeysig:
      create/update KeySig segment, layout
    else:
      // Disable, BUT check transposing instruments:
      for each staff i:
        if element exists and non-generated, OR key differs → disable = false
        if generated and key == C → remove element       // prevent wrong display

  cSegment.createShapes()                                // measure.cpp:3892
  kSegment.createShapes()                                // measure.cpp:3895

  createSystemBeginBarLine()                             // → see 3.7b
  checkHeader()                                          // → see 3.7d
```

#### 3.7b `Measure::createSystemBeginBarLine()`
**file:** `measure.cpp:3898-3938`

```
Condition: creates begin barline if:
  - n > 1 (multiple visible staves) AND styleB(Sid::startBarlineMultiple)
  - OR n == 1 AND (styleB(Sid::startBarlineSingle) OR system().brackets().size() > 0)

If condition met:
  Create SegmentType::BeginBarLine segment
  For each track: create BarLine, setBarLineType(NORMAL), setSpanStaff(true), layout()
  seg.setEnabled(true); seg.setHeader(true); measure.setHeader(true)
Else:
  seg.setEnabled(false)
```

#### 3.7c `Measure::addSystemTrailer()`
**file:** `measure.cpp:3944-4060`

```
Signature:
  void Measure::addSystemTrailer(Measure* nm)   // nm = next measure

  // --- Courtesy TIME SIGNATURE ---                     // measure.cpp:3953-3995
  if nm && genCourtesyTimesig && !isFinalMeasure && !FLOAT mode:
    tss = nm.findSegmentR(SegmentType::TimeSig, Fraction(0,1))
    if tss:
      find first TimeSig in tss across staves
      if ts.showCourtesySig():
        create/update TimeSigAnnounce segment (setTrailer=true)
        for each track: create TimeSig, setFrom(nts), layout()
        s.createShapes()
  if !showCourtesySig && s exists → s.setEnabled(false)

  // --- Courtesy KEY SIGNATURE ---                      // measure.cpp:4004-4044
  show = hasCourtesyKeySig()
  for each staff:
    if show:
      create/update KeySigAnnounce segment (setTrailer=true)
      key2 = staff.keySigEvent(endTick())
      create KeySig, setKeySigEvent(key2), layout()
    else:
      if s → s.setEnabled(false)

    // --- CLEF smallification ---                       // measure.cpp:4045-4050
    if clefSegment:
      clef = clefSegment.element(track)
      if clef → clef.setSmall(true)                     // end-of-measure clef → small

  s.createShapes()
  clefSegment.createShapes()
  checkTrailer()                                         // → see 3.7d
```

#### 3.7d `checkHeader()` / `checkTrailer()`
**file:** `measure.cpp:4106-4128`

```
checkHeader():
  for seg from first():
    if seg.enabled() && seg.header() → setHeader(true); break

checkTrailer():
  for seg from last() backward:
    if seg.enabled() && seg.trailer() → setTrailer(true); break
```

#### 3.7e `removeSystemHeader()` / `removeSystemTrailer()`
**file:** `measure.cpp:4066-4100`

```
removeSystemHeader():                                    // measure.cpp:4066-4078
  if !header() → return
  for seg from first() while seg.header():
    seg.setEnabled(false)
  setHeader(false)

removeSystemTrailer():                                   // measure.cpp:4084-4100
  changed = false
  for seg from last() backward while seg.trailer():
    seg.setEnabled(false); changed = true
  setTrailer(false)
  if system() && changed:
    computeWidth(system().minSysTicks(), system().maxSysTicks(), layoutStretch())
    // NOTE: removing trailer triggers width recomputation!
```

---

### 3.8 `Measure::computeTicks()`
**file:** `measure.cpp:3372-3396`

```
Signature:
  Fraction Measure::computeTicks()
  Returns: minimum non-zero tick distance between consecutive enabled segments

Algorithm:
  minTick = ticks()                                      // measure duration
  assert(minTick > 0)

  ns = first enabled segment
  while ns:
    s = ns; ns = s.nextActive()
    nticks = (ns ? ns.rtick() : ticks()) - s.rtick()
    if nticks > 0:
      if nticks < minTick → minTick = nticks
    s.setTicks(nticks)                                   // set duration for each segment

  return minTick

Modified state: Each segment gets setTicks() = distance to next active segment
MUST be called AFTER createShapes() (comment in layoutmeasure.cpp:829)
```

---

### 3.9 `Measure::connectTremolo()`
**file:** `measure.cpp:2192-2232`

```
For each ChordRest segment, for each track:
  if element is Chord with twoNotes tremolo:
    c.setDurationType(tremolo.durationType())

    // If chord1 not set → set to current chord:
    if !tremolo.chord1() → tremolo.setChords(c, chord2)
    else if tremolo.chord1() != c || tremolo.chord2() → continue

    // Find second chord on same track:
    for ls = s.next(ChordRest) onward:
      if element exists on track:
        nc = toChord(element)
        tremolo.setChords(c, nc)
        nc.setTremolo(tremolo)
        break
```

---

### 3.10 `Measure::moveTicks()`
**file:** `measure.cpp:1181-1209`

```
Adjusts measure's tick position to match system's tick:
  delta = ctx.tick - measure.tick()
  measure.setTick(measure.tick() + delta)
  Also adjusts tuplet tick positions
```

---

### 3.11 `Measure::layoutMeasureElements()`
**file:** `measure.cpp:3233-3331`

```
For each enabled segment:
  LayoutChords::repositionGraceNotesAfter(&s)

  for each element in segment:
    // --- Full Measure Rest / MMRest / MeasureRepeat ---
    if isFullMeasureRest() || isMMRest() || isMeasureRepeat():
      // Center in free space between surrounding segments:
      x1 = prevActive segment → x + minRight  (or 0)
      x2 = nextActive segment → x - minLeft   (or width)

      if isMMRest():
        // Modern: find next non-ChordRest element
        // Classic: use EndBarLine position
        d = styleMM(Sid::multiMeasureRestMargin)
        w = x2 - x1 - 2*d
        // Header exception: if has header && prev != StartRepeatBarLine
        if headerException → x1 = s1.x + s1.width; w = x2 - x1 - d
        mmrest.setWidth(w); mmrest.layout(); mmrest.setPosX(...)

      else if isMeasureRepeat() && numMeasures is even:
        // Center on following barline
        measureWidth = x2 - s.x + .5 * barWidth
        e.setPosX(measureWidth - .5 * e.width())

      else:
        // Full measure rest: center within measure
        e.layout(); e.setPosX((x2-x1-e.width)*.5 + x1 - s.x - e.bbox.x)

      s.createShape(staffIdx)

    // --- Regular Rest ---
    else if isRest(): e.setPosX(0)

    // --- Chord ---
    else if isChord():
      // Layout tremolo (if not cross-staff two-note):
      if c.tremolo() && (!twoNotes || (!c1.staffMove && !c2.staffMove)):
        tremolo.layout()
      // Same for grace note tremolos

    // --- BarLine ---
    else if isBarLine():
      e.setPosY(0); if not EndBarLine → e.setPosX(0)
```

---

### 3.12 Segment Data Model
> **Not a function — structural documentation.**

```
Segments form a doubly-linked list within a Measure:
  _prev, _next pointers                                  // segment.h:93-94

Storage per segment:
  _elist: vector<EngravingItem*>    // one per track (staves * VOICES)
  _annotations: vector<EngravingItem*>
  _shapes: vector<Shape>           // one per staff
  _preAppendedItems: vector<EngravingItem*>  // grace notes (staves * VOICES)

Key fields:
  _tick (Fraction):    relative tick within measure (rtick)
  _ticks (Fraction):   duration until next segment (set by computeTicks)
  _segmentType:        Clef|KeySig|TimeSig|ChordRest|EndBarLine|... (SegmentType enum)
  _header (bool):      true = part of system header (clef/key/time at start)
  _trailer (bool):     true = part of system trailer (courtesy key/time at end)
  _enabled (bool):     visible in layout (header/trailer segments can be disabled)

Traversal:
  next() / prev():       within same measure
  next1() / prev1():     ACROSS measure boundaries
  nextActive():          next enabled segment
  prevActive():          prev enabled segment
  next(SegmentType):     next of specific type

Position:
  setPosX(x):            horizontal position within measure
  setWidth(w):           allocated width for this segment
  setWidthOffset(d):     additional offset (clef justification, cross-beam displacement)
  setStretch(s):         duration-based stretch factor
```

---

## פרק 4: Segment Width Computation — הליבה של ה-Spacing

> קבצים: `segment.cpp` (~2873 שורות), `measure.cpp` (~4716 שורות)
> `realfn.h` (fuzzy float comparisons)

**הערה חשובה — Fuzzy Float Comparisons:**
קוד ה-spacing משתמש ב-`RealIsEqualOrMore`/`RealIsEqualOrLess` (file: `framework/global/realfn.h:72-80`):
```cpp
constexpr double COMPARE_DOUBLE_EPSILON(1000000000.0);
inline bool RealIsEqual(double p1, double p2) {
    return std::abs(p1 - p2) * COMPARE_DOUBLE_EPSILON <= std::min(std::abs(p1), std::abs(p2));
}
inline bool RealIsEqualOrMore(double p1, double p2) { return p1 > p2 || RealIsEqual(p1, p2); }
inline bool RealIsEqualOrLess(double p1, double p2) { return p1 < p2 || RealIsEqual(p1, p2); }
```
> ε = 1e-9 relative. כל השוואת `>=` בקוד spacing עוברת דרך הפונקציות האלו — אי אפשר להשתמש ב-`>=` רגיל.

### 4.1 `Measure::computeWidth()` — Main Entry (Wrapper)
**file:** `measure.cpp:4321`

```
Input: minTicks: Fraction, maxTicks: Fraction, stretchCoeff: double

Algorithm:
  s = first enabled non-invisible segment

  // skip disabled/invisible leading segments:
  for (s = first(); s && (!s.enabled() || s.allElementsInvisible()); s = s.next()):
    s.setPosX(computeFirstSegmentXPosition(s))  // position hidden key/time sigs
    s.setWidth(0)

  if !s: setWidth(0); return

  // Left barrier shape:
  first = isFirstInSystem()
  ls = first ? Shape(0, -1000000, 0, 2000000) : Shape(0, 0, 0, spatium*4)
  // ↑ infinite height barrier if first in system (prevents anything from crossing left edge)
  //   Non-first measures: barrier is 4sp tall (covers staff only)

  x = s.minLeft(ls)   // minimum starting x based on left barrier

  // Special case: start repeat barline overlap
  if s.isStartRepeatBarLineType():
    pmb = prev()
    if pmb.isMeasure() && same system && pmb.repeatEnd():
      seg = pmb.last()
      if seg.isEndBarLineType():
        x -= score.styleMM(Sid::endBarWidth) * mag()
        // ↑ overlap end repeat with start repeat barline

  LayoutChords::updateGraceNotes(this)   // grace note positions

  isSystemHeader = s.header()
  _squeezableSpace = 0
  computeWidth(s, x, isSystemHeader, minTicks, maxTicks, stretchCoeff)
```

### 4.2 `Measure::computeWidth(Segment* s, x, isSystemHeader, minTicks, maxTicks, stretchCoeff)` — Core Loop
**file:** `measure.cpp:4165`

```
CONSTANTS (computed once):
  spacingMultiplier = 1.2  (HARDCODED at line 4174)
  minNoteSpace = noteHeadWidth + spacingMultiplier * styleMM(Sid::minNoteDistance)
               = noteHeadWidth + 1.2 * Spatium(0.5)
               = noteHeadWidth + 0.6sp
  usrStretch = clamp(measure.userStretch(), 0.1, 10.0)

LOOP (segment by segment):
  while s:
    s.setWidthOffset(0)
    s.setPosX(x)

    // SKIP: disabled/invisible segments
    if !s.enabled() || !s.visible() || s.allElementsInvisible():
      s.setWidth(0); s = s.next(); continue

    ns = s.nextActive()  // next enabled, non-all-invisible segment
    while ns && ns.allElementsInvisible(): ns = ns.nextActive()
    if !ns: ns = s.next(BarLineType)  // end barline even if disabled

    // COMPUTE WIDTH w:
    if ns:
      if isSystemHeader && (ns.isStartRepeatBarLine || ns.isChordRest || (ns.isClef && !ns.header())):
        // system header gap: special handling
        w = s.minHorizontalDistance(ns, true)   // systemHeaderGap = true
        isSystemHeader = false
      else:
        w = s.minHorizontalDistance(ns, false)

        if s.isChordRest:
          ps = s.prevActive()
          durStretch = s.computeDurationStretch(ps, minTicks, maxTicks)
          s.setStretch(durStretch * usrStretch)
          minStretchedWidth = minNoteSpace * durStretch * usrStretch * stretchCoeff

          // Track squeezable space:
          if s.shortestChordRest() == s.ticks():
            _squeezableSpace += minStretchedWidth - w

          w = max(w, minStretchedWidth)

      // Clef/Breath: right-justify (they move left, not next segment moves right)
      if (ns.isClef || ns.isBreath) && ns.next():
        reduction = max(ns.minHorizontalCollidingDistance(ns.next()),
                        styleMM(Sid::clefKeyRightMargin))
        w -= reduction
        s.setWidthOffset(s.widthOffset() - reduction)

      // Cross-beam spacing adjustment (ר' סעיף 4.12):
      s.computeCrossBeamType(ns)
      displacement = noteHeadWidth - styleMM(Sid::stemWidth)
      if crossBeamType.upDown:
        s.setWidthOffset(s.widthOffset() + displacement)
        w += displacement
        _squeezableSpace -= noteHeadWidth
      if crossBeamType.downUp:
        s.setWidthOffset(s.widthOffset() - displacement)
        w -= displacement
        _squeezableSpace -= noteHeadWidth

      // Look-back collision check (previous segments):
      if s == fs (first segment):
        w = max(w, ns.minLeft(ls) - s.x())

      n = 1
      for ps = s downto firstEnabled:
        ww = ps.minHorizontalCollidingDistance(ns) - (s.x() - ps.x())
        if ps == fs: ww = max(ww, ns.minLeft(ls) - s.x())
        if ww > w:
          // OVERLAP: distribute extra space across chord-rest segments
          _squeezableSpace -= (ww - w)
          d = (ww - w) / n
          xx = ps.x()
          for ss = ps to s (exclusive):
            ns1 = ss.nextActive()
            ww1 = ss.width()
            if ss.isChordRest: ww1 += d; ss.setWidth(ww1)
            xx += ww1
            ns1.setPosX(xx)
            ss = ns1
          if s.isChordRest: w += d
          x = xx
          break
        if ps.isChordRest: n++

    else: // last segment (no next)
      w = s.minRight()

    s.setWidth(w)
    x += w
    s = s.next()

  // POST-LOOP: squeezable space clamping
  if isMMRest:
    _squeezableSpace = max(x - styleMM(Sid::minMMRestWidth), 0)
  else:
    _squeezableSpace = max(0, min(_squeezableSpace, x - styleMM(Sid::minMeasureWidth)))

  setLayoutStretch(stretchCoeff)
  setWidth(x)

  // Minimum width check:
  minWidth = computeMinMeasureWidth()
  if width() < minWidth:
    stretchToTargetWidth(minWidth)
    setWidthLocked(true)
  else:
    setWidthLocked(false)
```

### 4.3 `Segment::computeDurationStretch()` — Duration-Based Spacing
**file:** `segment.cpp:2812`

```
INNER LAMBDA doComputeDurationStretch(curTicks: Fraction) -> double:
  slope = score.styleD(Sid::measureSpacing)    // default = 1.5
  static constexpr longNoteThreshold = Fraction(1,16).toDouble()  // = 0.0625

  // MMRest: use measure count as duration proxy
  if measure.isMMRest() && isChordRest:
    count = measure.mmRestCount()
    timeSig = measure.timesig()
    curTicks = timeSig + Fraction(count, timeSig.denominator())

  // Prevent extreme ratios:
  static constexpr maxRatio = 32.0
  dMinTicks = minTicks.toDouble()
  dMaxTicks = maxTicks.toDouble()
  maxSysRatio = dMaxTicks / dMinTicks

  // HACK (segment.cpp:2831-2834):
  //   if maxTicks/minTicks >= 2 AND minTicks < 1/16:
  //   pretend minTicks is doubled ("ignore the shortest note, use 'next' shortest")
  //   Uses fuzzy comparison: RealIsEqualOrMore(dMaxTicks/dMinTicks, 2.0)
  if RealIsEqualOrMore(dMaxTicks/dMinTicks, 2.0) && dMinTicks < longNoteThreshold:
    dMinTicks *= 2.0

  ratio = curTicks.toDouble() / dMinTicks

  // maxRatio cap — linear interpolation when system ratio > 32 (segment.cpp:2837-2841):
  //   Maps ratio linearly so that minTicks→1 and maxTicks→maxRatio
  if maxSysRatio > maxRatio:
    A = (dMinTicks * (maxRatio - 1)) / (dMaxTicks - dMinTicks)
    B = (dMaxTicks - (maxRatio * dMinTicks)) / (dMaxTicks - dMinTicks)
    ratio = A * ratio + B

  str = pow(slope, log2(ratio))
  //      ↑ THIS IS THE CORE FORMULA:
  //        str = slope^(log2(ratio))
  //        With slope=1.5: ratio=1 → str=1.0
  //                        ratio=2 → str=1.5
  //                        ratio=4 → str=2.25
  //                        ratio=8 → str=3.375

  // empFactor (segment.cpp:2846-2848):
  //   Compensates when ALL notes in system are long (minTicks > 1/16).
  //   Makes long-note-only systems NOT too narrow.
  if dMinTicks > longNoteThreshold:
    empFactor = 0.6    // HARDCODED
    str = str * (1 - empFactor + empFactor * sqrt(dMinTicks / longNoteThreshold))
    //        = str * (0.4 + 0.6 * sqrt(dMinTicks / 0.0625))

  return str

MAIN LOGIC (segment.cpp:2854-2871):
  hasAdjacent = isChordRestType() && (shortestChordRest() == ticks())
  // hasAdjacent: true when this segment's duration == its shortest note
  //   (no other voice creates a shorter segment boundary)
  prevHasAdjacent = prevSeg && (prevSeg.isChordRestType() && prevSeg.shortestChordRest() == prevSeg.ticks())

  if hasAdjacent || measure.isMMRest():
    durStretch = doComputeDurationStretch(ticks())   // normal case
  else:
    // Polyrhythm: segment duration != shortest note (another voice is shorter)
    curShortest = shortestChordRest()
    prevShortest = prevSeg ? prevSeg.shortestChordRest() : Fraction(0, 1)
    if prevSeg && !prevHasAdjacent && prevShortest < curShortest:
      // Previous segment also polyrhythmic with even shorter notes — use that duration
      durStretch = doComputeDurationStretch(prevShortest) * (ticks() / prevShortest).toDouble()
    else:
      durStretch = doComputeDurationStretch(curShortest) * (ticks() / curShortest).toDouble()

  return durStretch
```

### 4.4 `Segment::minHorizontalDistance()` — Collision-Aware Minimum Distance
**file:** `segment.cpp:2609`

```
Input: ns (next segment or null), systemHeaderGap: bool
Output: double — minimum horizontal distance from this segment to ns

// Phase 1: Shape-based collision distance
ww = -1000000.0   // can remain negative (e.g., mid-system clefs)
for staffIdx in 0.._shapes.size():
  d = ns ? staffShape(staffIdx).minHorizontalDistance(ns.staffShape(staffIdx), score) : 0
  if systemHeaderGap:
    d = max(d, staffShape(staffIdx).right())  // header must clear its own right edge per staff
  ww = max(ww, d)
w = max(ww, 0.0)   // ensure non-negative

// Phase 2: Clef → ChordRest minimum margin
if isClefType() && ns && ns.isChordRestType():
  w = max(w, double(styleMM(Sid::clefKeyRightMargin)))   // default = Spatium(0.8)

// Phase 3: System header special distance rules
absoluteMinHeaderDist = 1.5 * spatium()   // HARDCODED
if systemHeaderGap:
  if isTimeSigType():
    w = max(w, minRight() + styleMM(Sid::systemHeaderTimeSigDistance))  // default = Spatium(2.0)
  else:
    w = max(w, minRight() + styleMM(Sid::systemHeaderDistance))          // default = Spatium(2.5)

  // Start repeat barline alignment: thin barline aligns to header
  if ns && ns.isStartRepeatBarLineType():
    w -= styleMM(Sid::endBarWidth) + styleMM(Sid::endBarDistance)

  // Enforce absoluteMinHeaderDist gap between header right edge and first note left edge
  diff = w - minRight() - ns.minLeft()
  if diff < absoluteMinHeaderDist:
    w += absoluteMinHeaderDist - diff

// Phase 4: Tie at system start — ensure minimum tie length for dangling ties
if systemHeaderGap && ns && ns.isChordRestType():
  for e in ns.elist():
    if !e || !e.isChord(): continue
    headerTieMargin = styleMM(Sid::HeaderToLineStartDistance)
    for note in toChord(e).notes():
      if !note.tieBack() || note.lineAttachPoints().empty(): continue
      tieStartPointX = minRight() + headerTieMargin
      notePosX = w + note.pos().x() + toChord(e).pos().x() + note.headWidth() / 2
      tieEndPointX = notePosX + note.lineAttachPoints().at(0).pos().x()
      tieLength = tieEndPointX - tieStartPointX
      if tieLength < styleMM(Sid::MinTieLength):
        w += styleMM(Sid::MinTieLength) - tieLength   // extend to ensure minimum tie length

// Phase 5: Extra leading space (user-defined per-segment custom spacing)
if ns:
  w += ns.extraLeadingSpace().val() * spatium()
  // extraLeadingSpace is a Spatium value stored per segment,
  // read from <leadingSpace> XML tag (segment.cpp:958-963, 977-978)

return w
```

### 4.5 `Segment::minRight()` and `Segment::minLeft()`
**file:** `segment.cpp:2363–2406`

```
minRight() (segment.cpp:2363):
  distance = 0
  for each Shape sh in shapes():
    distance = max(distance, sh.right())
  if isClefType():
    distance += styleMM(Sid::clefBarlineDistance)   // default = Spatium(0.5)
  if trailer():
    distance += styleMM(Sid::systemTrailerRightMargin)  // default = Spatium(0.5)
  return distance

minLeft(sl: const Shape&) (segment.cpp:2384):
  // returns minimum left space needed given barrier shape sl
  // Uses Shape::minHorizontalDistance — collision-aware, takes score context
  distance = 0
  for each Shape sh in shapes():
    d = sl.minHorizontalDistance(sh, score)
    distance = max(distance, d)
  return distance

minLeft() (segment.cpp:2396):
  // returns maximum left extent of own shapes (no collision check)
  distance = 0
  for each Shape sh in shapes():
    distance = max(distance, sh.left())
  return distance
```

### 4.6 `Segment::stretchSegmentsToWidth()` — Spring-Rod Method
**file:** `segment.cpp:2785`

```
static void stretchSegmentsToWidth(vector<Spring>& springs, double width)

// Spring structure:
struct Spring { springConst, width, preTension, segment* }
// springConst = 1 / segment.stretch()
// preTension  = width * springConst   (the force at which this spring starts to stretch)

// Early exit:
if springs.empty() || RealIsEqualOrLess(width, 0.0): return
                      ↑ NOTE: fuzzy comparison, not plain <=

// Sort by preTension ascending (stiffest springs first to be activated):
sort(springs, by preTension ascending)

// Phase 1: Find equilibrium force (DO-WHILE loop, segment.cpp:2796-2802)
//   CRITICAL: this is a do-while, not a for loop.
//   The preTension check is against the NEXT spring (after incrementing the iterator),
//   not the current one. At least one spring is always processed.
inverseSpringConst = 0
force = 0
spring = springs.cbegin()
do:
  inverseSpringConst += 1 / spring.springConst
  width += spring.width          // accumulate total available width
  force = width / inverseSpringConst
  ++spring                        // advance BEFORE the check
while (spring != springs.cend() && !(force < spring.preTension))
//   ↑ Loop CONTINUES while force >= next spring's preTension
//     Loop STOPS when force < next spring's preTension (equilibrium found)
//     or when all springs are consumed

// Phase 2: Apply force to each spring that exceeds its preTension (segment.cpp:2804-2809):
for each spring in springs:
  if force > spring.preTension:     // NOTE: strict >, not >=
    newWidth = force / spring.springConst
    spring.segment.setWidth(newWidth + spring.segment.widthOffset())
```

### 4.7 `Measure::computeFirstSegmentXPosition()`
**file:** `measure.cpp` (called from computeWidth wrapper)

```
s = first enabled segment

if s.isStartRepeatBarLine:
  // start repeat: compute from barline position
  // (complex, involves system and previous measure)

elif s.isHeaderClef or s.isKeySig or s.isTimeSig:
  // header: no extra leading space
  return 0  (or some small value)

else:
  // First note/rest:
  if s.hasAccidentals():     // ר' סעיף 4.11
    return styleMM(Sid::barAccidentalDistance)  // default = Spatium(0.65)
  else:
    return styleMM(Sid::barNoteDistance)         // default = Spatium(1.3)
```

### 4.8 `Measure::computeMinMeasureWidth()`
**file:** `measure.cpp:4365`

```
if isMMRest:
  minWidth = styleMM(Sid::minMMRestWidth)   // default = 4sp
else:
  minWidth = styleMM(Sid::minMeasureWidth)  // default = 8sp

maxWidth = system.width() - system.leftMargin()
if maxWidth <= 0: maxWidth = minWidth   // linear mode: system width not yet known

minWidth = min(minWidth, maxWidth)  // never exceed available width

// Shortened measures (anacrusis):
if ticks() < timesig():
  minWidth *= (ticks() / timesig()).toDouble()

firstCRSeg = findFirstR(ChordRest, 0)
if !firstCRSeg: return minWidth
if firstCRSeg == firstEnabled(): return minWidth

// Account for header before first note:
startPosition = firstCRSeg.x() - firstCRSeg.minLeft()
if firstCRSeg.hasAccidentals():
  startPosition -= styleMM(Sid::barAccidentalDistance)   // = 0.65sp
else:
  startPosition -= styleMM(Sid::barNoteDistance)          // = 1.3sp

minWidth += startPosition
minWidth = min(minWidth, maxWidth)
return minWidth
```

### 4.9 `Measure::stretchToTargetWidth()`
**file:** `measure.cpp:4398`

```
if targetWidth < width(): return   // never shrink

// Build springs from visible ChordRest segments only:
for each ChordRest segment s in measure:
  if s.visible() && s.enabled() && !s.allElementsInvisible():
    springConst = 1 / s.stretch()
    width = s.width() - s.widthOffset()
    preTension = width * springConst
    springs.push_back(Spring(springConst, width, preTension, s))

Segment::stretchSegmentsToWidth(springs, targetWidth - width())
respaceSegments()   // recompute x positions of all segments after width changes
```

### 4.10 `Segment::shortestChordRest()`
**file:** `segment.cpp:2682`

```
// Returns shortest ChordRest duration in this segment.
// NOTE: this is NOT the same as ticks() — ticks() is the segment's time slot,
// but the shortest note in this segment may be longer (e.g., a half note starting
// at the same tick as a quarter note in another voice — the segment ticks = quarter
// but shortestChordRest for this voice's segment = half).
// Invisible ChordRests are SKIPPED, EXCEPT full-measure rests.

shortest = measure.ticks()   // initialize to max (time signature duration)

for elem in elist():
  // Skip condition: null, invisible staff, non-ChordRest, or invisible element
  // EXCEPTION: full-measure rests are included even if invisible
  if (!elem || !elem.staff().show() || !elem.isChordRest() || !elem.visible()):
    if !(elem && elem.isRest() && toRest(elem).isFullMeasureRest()):
      continue

  cur = toChordRest(elem).actualTicks()
  if cur < shortest: shortest = cur

return shortest
```

### 4.11 `Segment::hasAccidentals()`
**file:** `segment.cpp:2700`

```
// Returns true if any chord in this segment has any note with an accidental.
// Used by computeFirstSegmentXPosition to decide barAccidentalDistance vs barNoteDistance.

bool hasAccidentals():
  if !isChordRestType(): return false

  for e in elist():
    if !e || !e.isChord(): continue
    for note in toChord(e).notes():
      if note.accidental():
        return true

  return false
```

### 4.12 `Segment::computeCrossBeamType()`
**file:** `segment.cpp:2726`

```
// Detects beams with alternating stem directions between this segment and next.
// upDown = this chord stem up, next chord stem down (in same beam)
// downUp = this chord stem down, next chord stem up (in same beam)
// Needed for correct horizontal spacing to avoid stem-to-stem collisions.

void computeCrossBeamType(Segment* nextSeg):
  _crossBeamType.reset()   // {upDown: false, downUp: false}

  if !isChordRestType() || !nextSeg || !nextSeg.isChordRestType():
    return

  upDown = false
  downUp = false

  for e in elist():
    if !e || !e.isChordRest() || !e.staff().visible(): continue
    thisCR = toChordRest(e)
    if !thisCR.visible() || thisCR.isFullMeasureRest(): continue
    if !thisCR.beam(): return        // NOT beamed → no cross-beam possible
    beam = thisCR.beam()

    for ee in nextSeg.elist():
      if !ee || !ee.isChordRest() || !ee.staff().visible(): continue
      nextCR = toChordRest(ee)
      if !nextCR.visible() || nextCR.isFullMeasureRest(): continue
      if !nextCR.beam(): return      // next NOT beamed → abort
      if nextCR.beam() != beam: continue   // different beam → skip this pair
      if thisCR.up() == nextCR.up(): return  // same direction → no cross-beam

      if thisCR.up() && !nextCR.up(): upDown = true
      if !thisCR.up() && nextCR.up(): downUp = true

      if upDown && downUp: return    // contradictory → abort

  _crossBeamType.upDown = upDown
  _crossBeamType.downUp = downUp
```

### 4.13 `Segment::minHorizontalCollidingDistance()`
**file:** `segment.cpp:2528`

```
// Like minHorizontalDistance() but simpler — pure shape collision, no header/tie logic.
// Used for look-back collision checks in Measure::computeWidth (the ps→ns distance check).

double minHorizontalCollidingDistance(Segment* ns):
  w = -100000.0   // can remain negative (e.g., mid-system clefs)

  for staffIdx in 0.._shapes.size():
    d = staffShape(staffIdx).minHorizontalDistance(ns.staffShape(staffIdx), score)
    w = max(w, d)

  return w
```

### 4.14 `Segment::createShape()` / `createShapes()` — Shape Building
**file:** `segment.cpp:2244-2345`

```
// Called during layout to build bounding shapes for collision detection.
// Each segment has one Shape per staff (_shapes[staffIdx]).
// Shapes feed into Skyline (north/south contour) and minHorizontalDistance calculations.

void createShapes():
  setVisible(false)
  for staffIdx in 0..score.nstaves():
    createShape(staffIdx)

void createShape(staff_idx_t staffIdx):
  Shape& s = _shapes[staffIdx]
  s.clear()

  // Skip hidden staves in the system:
  if system exists:
    if staffIdx < system.staves().size() && !system.staves()[staffIdx].show():
      return

  // BARLINE SEGMENTS — special handling (segment.cpp:2269-2279):
  if segmentType is BarLine | EndBarLine | StartRepeatBarLine | BeginBarLine:
    setVisible(true)
    bl = toBarLine(element(staffIdx * VOICES))
    if bl:
      s.add(bl.layoutRect() + bl.pos(), bl)
    s.addHorizontalSpacing(bl, 0, 0)
    addPreAppendedToShape(staffIdx, s)
    s.addHorizontalSpacing(SPACING_LYRICS, 0, 0)
    return

  // Skip hidden staves globally:
  if !score.staff(staffIdx).show(): return

  // ELEMENT SHAPES (segment.cpp:2286-2306):
  strack = staffIdx * VOICES
  etrack = strack + VOICES
  for e in _elist:
    if !e: continue
    effectiveTrack = e.vStaffIdx() * VOICES + e.voice()
    if effectiveTrack >= strack && effectiveTrack < etrack:
      setVisible(true)
      // Skip full-measure rest in multi-voice context:
      if e.isRest() && toRest(e).ticks() >= measure.ticks() && measure.hasVoices(e.staffIdx()):
        continue
      // Skip MMRest:
      if e.isMMRest(): continue
      // Add to shape if element participates in skyline:
      if e.addToSkyline():
        s.add(e.shape() + e.pos())

  // ANNOTATION SHAPES (segment.cpp:2308-2341):
  // Only certain annotation types participate in collision detection.
  // The following types are EXCLUDED from shape (they use autoplace instead):
  for e in _annotations:
    if !e || e.staffIdx() != staffIdx: continue
    setVisible(true)
    if !e.addToSkyline(): continue

    // Harmony: special handling — adds horizontal spacing only (not full shape):
    if e.isHarmony():
      toHarmony(e).layout()
      x1 = e.bbox().x() + e.pos().x()
      x2 = e.bbox().x() + e.bbox().width() + e.pos().x()
      s.addHorizontalSpacing(e, x1, x2)

    // EXCLUSION LIST — these 14 annotation types are NOT added to shape:
    //   RehearsalMark, FretDiagram, Harmony (already handled), TempoText,
    //   Dynamic, FiguredBass, Symbol, FSymbol, SystemText, TripletFeel,
    //   InstrumentChange, Articulation, Fermata, StaffText, PlayTechAnnotation
    elif !e.isRehearsalMark() && !e.isFretDiagram() && !e.isHarmony()
      && !e.isTempoText() && !e.isDynamic() && !e.isFiguredBass()
      && !e.isSymbol() && !e.isFSymbol() && !e.isSystemText()
      && !e.isTripletFeel() && !e.isInstrumentChange() && !e.isArticulation()
      && !e.isFermata() && !e.isStaffText() && !e.isPlayTechAnnotation():
      // Remaining annotations (e.g., lyrics) ARE collision candidates:
      s.add(e.shape() + e.pos())

  // Pre-appended items (grace notes etc.):
  addPreAppendedToShape(staffIdx, s)

void addPreAppendedToShape(staffIdx, Shape& s) (segment.cpp:2347):
  for track in (staffIdx*VOICES)..(staffIdx*VOICES+VOICES):
    if !_preAppendedItems[track]: continue
    item = _preAppendedItems[track]
    s.add(item.shape() + item.pos())
```

### 4.15 `Segment::computeCellWidth()` — HORIZONTAL_FIXED / Practice Mode
**file:** `segment.cpp:2408`

```
// Used ONLY in HORIZONTAL_FIXED (practice) layout mode — NOT in PAGE mode.
// Returns (spacing, width) pair. Width is proportional to duration.
// Each segment gets width = widthOfSegmentCell * spatium * (duration / quantum)

pair<double,double> computeCellWidth(const vector<int>& visibleParts):
  if !enabled(): return (0, 0)

  calculateWidth = [measure, masterScore](ChordRest* cr):
    quantum = measure.quantumOfSegmentCell()   // smallest subdivision in measure
    return masterScore.widthOfSegmentCell()
         * masterScore.spatium()
         * cr.globalTicks().numerator() / cr.globalTicks().denominator()
         * quantum.denominator() / quantum.numerator()

  if isChordRestType():
    cr = ChordRestWithMinDuration(this, visibleParts)  // shortest CR across visible parts
    if !cr: return (0, 0)
    width = calculateWidth(cr)
    spacing = 0

    // Grace note collision: add extra spacing if previous segment has short notes
    if cr is Chord && has graceNotes:
      prevSeg = prev()
      if prevSeg.isChordRest:
        prevCR = ChordRestWithMinDuration(prevSeg, visibleParts)
        if prevCR && prevCR.globalTicks() < measure.quantumOfSegmentCell():
          spacing = calculateWidth(prevCR)
          return (spacing, width)

    // Accidental collision: add extra spacing
    if cr is Chord:
      for note in chord.notes():
        if note.accidental():
          prevSeg = prev()
          if prevSeg && prevSeg.isChordRest:
            prevCR = ChordRestWithMinDuration(prevSeg, visibleParts)
            if prevCR: spacing = calculateWidth(prevCR)
          return (spacing, width)

    return (spacing, width)

  // Non-ChordRest segments (clefs, time sigs, etc.): return (0, 0)
  return (0, 0)
```

---

## פרק 5: System Collection & Breaking

> קובץ: `layoutsystem.cpp` (~1506 שורות)

### 5.1 `LayoutSystem::collectSystem()` — The Core System Builder
**file:** `layoutsystem.cpp:62`

```
Input: options: LayoutOptions, ctx: LayoutContext, score: Score*
Output: System* — a fully populated system (or null)

// SECTION BREAK DETECTION (layoutsystem.cpp:66-80):
// Check if the last measure of the last system had a section break,
// which affects first-system indent and long instrument names.
if !ctx.curMeasure: return null
measure = score.systems().empty() ? null : score.systems().back().measures().back()
if measure: measure = measure.findPotentialSectionBreak()
if measure:
  layoutBreak = measure.sectionBreakElement()
  ctx.firstSystem = measure.sectionBreak() && !options.isMode(FLOAT)
  ctx.firstSystemIndent = ctx.firstSystem && options.firstSystemIndent && layoutBreak.firstSystemIndentation()
  ctx.startWithLongNames = ctx.firstSystem && layoutBreak.startWithLongNames()

// INITIALIZATION (layoutsystem.cpp:82-107):
system = getNextSystem(ctx)     // reuse from ctx.systemList or create new (ר' 5.5)
lcmTick = ctx.curMeasure.tick()
system.setInstrumentNames(ctx, ctx.startWithLongNames, lcmTick)

curSysWidth = 0.0
layoutSystemMinWidth = 0.0
firstMeasure = true
createHeader = false
targetSystemWidth = score.styleD(Sid::pagePrintableWidth) * DPI
system.setWidth(targetSystemWidth)

// Save state of current measure for restoration if needed:
curHeader = ctx.curMeasure.header()
curTrailer = ctx.curMeasure.trailer()
breakMeasure = null

// Incremental min/max ticks tracking:
minTicks = Fraction::max()      // shortest note across system
prevMinTicks = Fraction(1,1)    // saved for restoration on measure removal
minSysTicksChanged = false
maxTicks = Fraction(0,1)        // longest note across system
prevMaxTicks = Fraction(1,1)
maxSysTicksChanged = false
static constexpr squeezability = 0.3   // HARDCODED — how much compression is acceptable
oldStretch = 1.0
oldWidth = 0.0
oldSystem = null

MAIN LOOP while ctx.curMeasure (layoutsystem.cpp:109-335):
  oldSystem = ctx.curMeasure.system()
  system.appendMeasure(ctx.curMeasure)

  // Cross-staff beam update (layoutsystem.cpp:112-114):
  if system.hasCrossStaffOrModifiedBeams():
    updateCrossBeams(system, ctx)   // ר' 5.7

  ww = 0  // width of current measure

  if curMeasure.isMeasure() (layoutsystem.cpp:116-198):
    m = toMeasure(curMeasure)

    // PRE-SPACING COMPUTATION:
    LayoutMeasure::computePreSpacingItems(m)

    // UPDATE SYSTEM MIN/MAX TICKS (layoutsystem.cpp:123-151):
    curMinTicks = m.shortestChordRest()
    curMaxTicks = m.maxTicks()

    if curMinTicks < minTicks:
      prevMinTicks = minTicks   // save for restoration if measure is removed
      minTicks = curMinTicks
      minSysTicksChanged = true
    else:
      minSysTicksChanged = false   // IMPORTANT: reset flag each iteration

    if curMaxTicks > maxTicks:
      prevMaxTicks = maxTicks
      maxTicks = curMaxTicks
      maxSysTicksChanged = true
    else:
      maxSysTicksChanged = false

    // RECOMPUTE ALL PREVIOUS MEASURES if min/max changed (layoutsystem.cpp:139-152):
    // This is the core of "incremental system building" — when a new measure brings a
    // shorter/longer note, ALL prior measures must be recomputed with new minTicks/maxTicks.
    if minSysTicksChanged || maxSysTicksChanged:
      for mb in system.measures():
        if mb == m: break   // only previous, not current
        if mb.isMeasure():
          prevWidth = toMeasure(mb).width()
          toMeasure(mb).computeWidth(minTicks, maxTicks, 1)   // stretchCoeff = 1
          newWidth = toMeasure(mb).width()
          curSysWidth += (newWidth - prevWidth)    // adjust running total

    // SYSTEM HEADER — first measure only (layoutsystem.cpp:154-176):
    if firstMeasure:
      layoutSystemMinWidth = curSysWidth
      system.layoutSystem(ctx, curSysWidth, ctx.firstSystem, ctx.firstSystemIndent)
      if system.hasCrossStaffOrModifiedBeams():
        updateCrossBeams(system, ctx)
      curSysWidth += system.leftMargin()
      // Enable start-repeat barline if present but disabled:
      if m.repeatStart():
        s = m.findSegmentR(StartRepeatBarLine, Fraction(0,1))
        if !s.enabled(): s.setEnabled(true)
      m.addSystemHeader(ctx.firstSystem)
      firstMeasure = false
      createHeader = false
    else:
      if createHeader:
        m.addSystemHeader(false)
        createHeader = false
      elif m.header():
        m.removeSystemHeader()

    // BARLINES & TRAILER (layoutsystem.cpp:179-188):
    m.createEndBarLines(true)
    if m.noBreak():
      m.removeSystemTrailer()   // noBreak measures cannot end a system
    else:
      m.addSystemTrailer(m.nextMeasure())

    m.computeWidth(minTicks, maxTicks, 1)
    ww = m.width()

  elif curMeasure.isHBox() (layoutsystem.cpp:189-192):
    curMeasure.computeMinWidth()
    ww = curMeasure.width()
    createHeader = toHBox(curMeasure).createSystemHeader()

  elif curMeasure.isVBox() (layoutsystem.cpp:193-198):
    LayoutMeasure::getNextMeasure(options, ctx)
    system.layout2(ctx)
    return system   // VBox ends system immediately — no justification

  // BREAK DECISION (layoutsystem.cpp:200-245):
  acceptanceRange = squeezability * system.squeezableSpace()
  // squeezableSpace = sum of _squeezableSpace from all measures in system
  // squeezability = 0.3 → accept up to 30% over-width if it can later be squeezed

  doBreak = (system.measures().size() > 1)
            && ((curSysWidth + ww) > targetSystemWidth + acceptanceRange)

  if doBreak:
    breakMeasure = ctx.curMeasure
    system.removeLastMeasure()
    ctx.curMeasure.setParent(oldSystem)

    // Handle noBreak groups — measures that MUST stay together (layoutsystem.cpp:211-225):
    // Remove measures backwards until we find one without noBreak,
    // but never remove all measures from the system.
    while ctx.prevMeasure && ctx.prevMeasure.noBreak() && system.measures().size() > 1:
      ctx.tick -= ctx.curMeasure.ticks()
      ctx.measureNo = ctx.prevMeasure.no()
      ctx.nextMeasure = ctx.curMeasure
      ctx.curMeasure  = ctx.prevMeasure
      ctx.prevMeasure = ctx.curMeasure.prev()
      curSysWidth -= system.lastMeasure().width()
      system.removeLastMeasure()
      ctx.curMeasure.setParent(oldSystem)

    // RESTORE min/max ticks (layoutsystem.cpp:228-243):
    // The removed measure may have been the one that changed minTicks/maxTicks.
    // Restore previous values and recompute all remaining measures.
    if minSysTicksChanged: minTicks = prevMinTicks
    if maxSysTicksChanged: maxTicks = prevMaxTicks
    if minSysTicksChanged || maxSysTicksChanged:
      for mb in system.measures():
        if mb.isMeasure():
          prevWidth = toMeasure(mb).width()
          toMeasure(mb).computeWidth(minTicks, maxTicks, 1)
          curSysWidth += toMeasure(mb).width() - prevWidth
    break   // exit collection loop

  // PREVIOUS MEASURE FINALIZATION (layoutsystem.cpp:247-283):
  // Now that we know prevMeasure is NOT the last in the system,
  // we can finalize its barlines and remove its trailer.
  if ctx.prevMeasure && ctx.prevMeasure.isMeasure() && ctx.prevMeasure.system() == system:
    m = toMeasure(ctx.prevMeasure)

    // Remove trailer from non-last measure (trailer only on last measure):
    if m.trailer():
      ow = m.width()
      m.removeSystemTrailer()
      curSysWidth += m.width() - ow

    // Enable start-repeat barline if cur measure has repeat-start
    // and the barline was previously disabled:
    if ctx.curMeasure.isMeasure():
      m1 = toMeasure(ctx.curMeasure)
      if m1.repeatStart():
        s = m1.findSegmentR(StartRepeatBarLine, Fraction(0,1))
        if !s.enabled():
          s.setEnabled(true)
          m1.computeWidth(minTicks, maxTicks, 1)
          ww = m1.width()

    curSysWidth += m.createEndBarLines(false)  // create final barline (non-last)

  // LINE BREAK CHECK (layoutsystem.cpp:286-298):
  lineBreak = false
  switch options.mode:
    PAGE, SYSTEM: lineBreak = mb.pageBreak() || mb.lineBreak() || mb.sectionBreak()
    FLOAT, LINE, HORIZONTAL_FIXED: lineBreak = false

  // PRESERVE STATE of next measure (layoutsystem.cpp:300-323):
  // Save header/trailer state before getNextMeasure potentially modifies it.
  if ctx.nextMeasure:
    nmb = ctx.nextMeasure
    if nmb.isMeasure() && score.styleB(Sid::createMultiMeasureRests):
      nm = toMeasure(nmb)
      if nm.hasMMRest(): nmb = nm.mmRest()
    if nmb.isMeasure():
      oldStretch = toMeasure(nmb).layoutStretch()
      oldWidth = toMeasure(nmb).width()
    if !ctx.curMeasure.noBreak():
      curHeader = nmb.header()    // next could start a system
    if !nmb.noBreak():
      curTrailer = nmb.trailer()  // next could end a system

  LayoutMeasure::getNextMeasure(options, ctx)
  curSysWidth += ww

  // Terminate if: lineBreak, no more measures, or next is VBox/TBox/FBox:
  mb = ctx.curMeasure
  if lineBreak || !mb || mb.isVBox() || mb.isTBox() || mb.isFBox(): break

// END OF COLLECTION LOOP

// RANGE RESTORATION (layoutsystem.cpp:339-382):
// If we've processed past the end of the relayout range, check if we can stop.
// If this system ends at the same point as the previous layout, restore the
// next measure to its pre-layout state (header, trailer, width, beams).
if ctx.endTick < ctx.prevMeasure.tick():
  if ctx.prevMeasure == ctx.systemOldMeasure:
    // Restore next measure state...
    ctx.rangeDone = true
```

### 5.2 System Finalization (after collection loop)
**file:** `layoutsystem.cpp:384–493`

```
// STEP 1: Break cross-measure beams + create final barline (layoutsystem.cpp:389-395):
if ctx.prevMeasure && ctx.prevMeasure.isMeasure():
  pm = toMeasure(ctx.prevMeasure)
  LayoutBeams::breakCrossMeasureBeams(ctx, pm)
  pm.createEndBarLines(true)

// STEP 2: Hide empty staves (layoutsystem.cpp:397-398):
hideEmptyStaves(score, system, ctx.firstSystem)   // ר' 5.6

// STEP 3: Relayout system to account for hidden staves (layoutsystem.cpp:399-402):
// Must redo leftMargin because staff visibility changed.
curSysWidth -= system.leftMargin()
system.layoutSystem(ctx, layoutSystemMinWidth, ctx.firstSystem, ctx.firstSystemIndent)
curSysWidth += system.leftMargin()

// STEP 4: Add system trailer to last measure (layoutsystem.cpp:404-411):
lm = system.lastMeasure()
if lm:
  nm = lm.nextMeasure()
  if nm:
    lm.addSystemTrailer(nm)   // cautionary key/time sig for next system

// STEP 5: Recompute all measure widths (layoutsystem.cpp:413-425):
// If system is over target (because of acceptanceRange), use reduced pre-stretch
// so justifySystem can squeeze instead of stretch.
preStretch = targetSystemWidth > curSysWidth ? 1.0 : (1 - squeezability)
           = targetSystemWidth > curSysWidth ? 1.0 : 0.7

for mb in system.measures():
  if !mb.isMeasure(): continue
  m = toMeasure(mb)
  oldWidth = m.width()
  m.computeWidth(minTicks, maxTicks, preStretch)
  curSysWidth += m.width() - oldWidth

// STEP 6: JUSTIFY SYSTEM (layoutsystem.cpp:427-433):
// Distribute remaining space across all segments using spring model.
// Skip if: (a) last system of section AND fill ratio < lastSystemFillLimit (default 0.3)
//          (b) MScore::noHorizontalStretch debug flag
skipJustify = (ctx.curMeasure == null || (lm && lm.sectionBreak()))
              && ((curSysWidth / targetSystemWidth) < score.styleD(Sid::lastSystemFillLimit))
if !skipJustify && !MScore::noHorizontalStretch:
  justifySystem(system, curSysWidth, targetSystemWidth)

// STEP 7: POSITION ALL MEASURES (layoutsystem.cpp:436-463):
pos = PointF(0, 0)
firstMeasure = true
createBrackets = false
for mb in system.measures():
  ww = mb.width()
  if mb.isMeasure():
    if firstMeasure:
      pos.rx() += system.leftMargin()
      firstMeasure = false
    mb.setPos(pos)
    mb.setParent(system)
    m = toMeasure(mb)
    m.layoutMeasureElements()    // center rests, layout tremolos, etc.
    m.layoutStaffLines()
    if createBrackets:
      system.addBrackets(ctx, m)
      createBrackets = false
  elif mb.isHBox():
    mb.setPos(pos + PointF(toHBox(mb).topGap(), 0))
    mb.layout()
    createBrackets = toHBox(mb).createSystemHeader()
  elif mb.isVBox():
    mb.setPos(pos)
  pos.rx() += ww

system.setWidth(pos.x())

// STEP 8: LAYOUT SYSTEM ELEMENTS — the big one (layoutsystem.cpp:466):
layoutSystemElements(options, ctx, score, system)   // ר' 5.4

// STEP 9: COMPUTE STAFF DISTANCES (layoutsystem.cpp:467):
system.layout2(ctx)

// STEP 10: CROSS-STAFF LAYOUT (layoutsystem.cpp:468-470):
for mb in system.measures():
  mb.layoutCrossStaff()

// STEP 11: Section break detection for next system (layoutsystem.cpp:472-485):
// Same logic as at top of function — update ctx.firstSystem etc.

// STEP 12: Restore ties (layoutsystem.cpp:487-491):
// We may have modified ties of the next system during layout.
// Restore them to their correct state.
if oldSystem:
  LayoutSystem::restoreTies(oldSystem)   // ר' 5.8

return system
```

### 5.3 `LayoutSystem::justifySystem()` — Spring Model Distribution
**file:** `layoutsystem.cpp:496`

```
Input: system, curSysWidth, targetSystemWidth

rest = targetSystemWidth - curSysWidth
if RealIsNull(rest): return   // already exactly right (fuzzy comparison)
if rest < 0: LOGE("*** System justification error ***"); return

// Collect springs from all visible ChordRest segments across all measures:
// Visibility triple-condition: s.visible() && s.enabled() && !s.allElementsInvisible()
springs = []
for mb in system.measures():
  if !mb.isMeasure(): continue
  for s in toMeasure(mb).segments():
    if s.isChordRestType() && s.visible() && s.enabled() && !s.allElementsInvisible():
      springConst = 1 / s.stretch()
      width = s.width() - s.widthOffset()
      preTension = width * springConst
      springs.push_back(Spring(springConst, width, preTension, &s))

// Distribute extra space using spring-rod model (ר' 4.6):
Segment::stretchSegmentsToWidth(springs, rest)

// Recompute segment x positions for each measure after width changes:
for mb in system.measures():
  if !mb.isMeasure(): continue
  toMeasure(mb).respaceSegments()
```

### 5.4 `LayoutSystem::layoutSystemElements()` — Complete Element Layout
**file:** `layoutsystem.cpp:670-1280`

> **זו הפונקציה הגדולה ביותר בקובץ — ~610 שורות, 23 פעולות בסדר קבוע.**
> הסדר קריטי כי כל שלב בונה על ה-skyline/shapes של השלבים הקודמים.

```
if score.noStaves(): return

// ─── PHASE 1: Build segment list (layoutsystem.cpp:680-699) ───
sl = []   // vector<Segment*> — all ChordRest + annotation-bearing segments
for mb in system.measures():
  if !mb.isMeasure(): continue
  m = toMeasure(mb)
  m.layoutMeasureNumber()     // measure number text above first staff
  m.layoutMMRestRange()       // "1-4" text on multi-measure rests
  // In linear mode, skip measures outside the relayout range:
  if options.isLinearMode() && (m.tick() < lc.startTick || m.tick() > lc.endTick): continue
  for s in m.segments():
    if s.isChordRestType() || !s.annotations().empty():
      sl.push_back(s)

// ─── PHASE 2: Layout beams (layoutsystem.cpp:707-714) ───
// Must happen before skylines because stem lengths may change.
for s in sl:
  if !s.isChordRestType(): continue
  LayoutBeams::layoutNonCrossBeams(s)   // beam slopes, stem lengths
  s.createShapes()   // RECREATE shapes — stem lengths changed!

// ─── PHASE 3: Create skylines (layoutsystem.cpp:720-814) ───
// Skylines are north/south contour lines per staff, used for autoplace collision detection.
for staffIdx in 0..score.nstaves():
  ss = system.staff(staffIdx)
  skyline = ss.skyline()
  skyline.clear()
  for mb in system.measures():
    if !mb.isMeasure(): continue
    m = toMeasure(mb)
    // In linear mode, skip measures outside range:
    if options.isLinearMode() && out of range: continue

    // Add measure number to skyline:
    mno = m.noText(staffIdx)
    if mno && mno.addToSkyline():
      skyline.add(mno.bbox() + m.pos() + mno.pos())

    // Add MM rest range to skyline:
    mmrr = m.mmRangeText(staffIdx)
    if mmrr && mmrr.addToSkyline():
      skyline.add(mmrr.bbox() + m.pos() + mmrr.pos())

    // Add staff lines to skyline:
    if m.staffLines(staffIdx).addToSkyline():
      skyline.add(m.staffLines(staffIdx).bbox() + m.pos())

    // Add segment elements to skyline (layoutsystem.cpp:744-812):
    for seg in m.segments():
      if !seg.enabled() || seg.isTimeSigType(): continue   // HACK: ignore time sig shapes
      p = seg.pos() + m.pos()

      if seg is barline-type:
        bl = toBarLine(seg.element(staffIdx * VOICES))
        if bl && bl.addToSkyline():
          skyline.add(bl.layoutRect() + bl.pos() + p)
      else:
        for e in seg.elist() where track in [staffIdx*VOICES .. staffIdx*VOICES+VOICES):
          // Clear chord-based fingering layouts (will be redone in Phase 4):
          if e.isChord():
            for each note (including grace notes):
              for el in note.el():
                if el.isFingering() && layoutType == CHORD:
                  f.setPos(PointF()); f.setBbox(RectF())

          // Add element to skyline:
          if e.addToSkyline():
            skyline.add(e.shape() + e.pos() + p)

          // Add tremolo to skyline (two-note or single):
          if e.isChord() && toChord(e).tremolo():
            t = toChord(e).tremolo()
            c1 = t.chord1(); c2 = t.chord2()
            if !t.twoNotes() || (c1 && !c1.staffMove() && c2 && !c2.staffMove()):
              if t.chord() == e && t.addToSkyline():
                skyline.add(t.shape() + t.pos() + e.pos() + p)

// ─── PHASE 4: Layout fingerings + add beams to skyline (layoutsystem.cpp:820-875) ───
for s in sl:
  recreateShapes = set<staff_idx_t>()
  for e in s.elist():
    if !e || !e.isChordRest() || !score.staff(e.staffIdx()).show(): continue
    cr = toChordRest(e)

    // Add beam to skyline (if this is the top chord of a beam group):
    if LayoutBeams::isTopBeam(cr):
      b = cr.beam()
      b.addSkyline(system.staff(b.staffIdx()).skyline())

    // Layout chord-based fingerings (above=last, below=first):
    if e.isChord():
      collect all notes (including grace notes)
      for each Note:
        for each Fingering with layoutType == CHORD:
          if placeAbove: fingerings.push_back(f)
          else: fingerings.push_front(f)
      for f in fingerings:
        f.layout()
        if f.addToSkyline():
          system.staff(f.note().chord().vStaffIdx()).skyline().add(f.shape + positions)
        recreateShapes.insert(f.staffIdx())

  // Recreate shapes for staves affected by fingering layout:
  for staffIdx in recreateShapes:
    s.createShape(staffIdx)

// ─── PHASE 5: Layout articulations (layoutsystem.cpp:881-894) ───
for s in sl:
  for e in s.elist():
    if !e || !e.isChordRest() || !staff.show(): continue
    if cr.isChord():
      c = toChord(cr)
      c.layoutArticulations()    // position above/below chord
      c.layoutArticulations2()   // skyline-aware adjustment

// ─── PHASE 6: Layout tuplets (layoutsystem.cpp:900-924) ───
// Recursive — finds top-level tuplet and layouts all nested tuplets at once.
// Uses skipTo map to avoid re-laying out already-processed tuplets.
skipTo = map<track_idx_t, Fraction>()
for s in sl:
  for e in s.elist():
    if !e || !e.isChordRest(): continue
    if skipTo[track] && e.tick() < skipTo[track]: continue
    de = toChordRest(e)
    if !de.tuplet(): continue
    // Walk up to top-level tuplet:
    while de.tuplet(): de = de.tuplet()
    LayoutTuplets::layout(de)   // recursive layout
    skipTo[track] = de.tick() + de.ticks()

// ─── PHASE 7: Drumline sticking (layoutsystem.cpp:930-936) ───
for s in sl:
  for e in s.annotations():
    if e.isSticking(): e.layout()

// ─── PHASE 8: Ties and Slurs (layoutsystem.cpp:938-975) ───
stick = system.measures().front().tick()
etick = system.measures().back().endTick()
spanners = score.spannerMap().findOverlapping(stick.ticks(), etick.ticks())

// 8a: Ties first:
doLayoutTies(system, sl, stick, etick)   // ר' 5.9

// 8b: Slurs (non-cross-staff only):
slurList = []
for interval in spanners:
  sp = interval.value
  sp.computeStartElement(); sp.computeEndElement()
  lc.processedSpanners.insert(sp)
  if sp.tick() < etick && sp.tick2() >= stick:
    if sp.isSlur() && !toSlur(sp).isCrossStaff():
      slurList.push_back(sp)
processLines(system, slurList, false)

// 8c: Articulations after slurs (adjusted for slur shape):
for s in slurList:
  if s.startCR().isChord(): toChord(s.startCR()).layoutArticulations3(toSlur(s))
  if s.endCR().isChord(): toChord(s.endCR()).layoutArticulations3(toSlur(s))

// ─── PHASE 9: Fermata + TremoloBar (layoutsystem.cpp:981-987) ───
for s in sl:
  for e in s.annotations():
    if e.isFermata() || e.isTremoloBar(): e.layout()

// ─── PHASE 10: Dynamics (layoutsystem.cpp:993-1021) ───
dynamics = []
for s in sl:
  for e in s.annotations():
    if e.isDynamic():
      d = toDynamic(e)
      d.layout()
      if d.autoplace():
        d.autoplaceSegmentElement(false)
        dynamics.push_back(d)
    elif e.isFiguredBass():
      e.layout(); e.autoplaceSegmentElement()
// Add dynamics shapes to skyline:
for d in dynamics:
  if d.addToSkyline():
    system.staff(d.staffIdx()).skyline().add(d.shape() + d.pos() + seg.pos() + m.pos())

// ─── PHASE 11: Spanners — hairpins, ottavas, pedals, voltas, tempo lines (layoutsystem.cpp:1028-1061) ───
// Categorize spanners by type:
hairpins = []; ottavas = []; pedal = []; voltas = []; tempoChangeLines = []; other = []
for interval in spanners:
  sp = interval.value
  if sp.tick() < etick && sp.tick2() > stick:   // NOTE: tick2() > stick (strict >)
    if sp.isOttava() && !tabStaff: ottavas.push_back(sp)
    elif sp.isPedal(): pedal.push_back(sp)
    elif sp.isVolta(): voltas.push_back(sp)
    elif sp.isHairpin(): hairpins.push_back(sp)
    elif sp.isGradualTempoChange(): tempoChangeLines.push_back(sp)
    elif !sp.isSlur() && !sp.isVolta(): other.push_back(sp)

processLines(system, hairpins, false)
processLines(system, other, false)
processLines(system, ottavas, false)
processLines(system, pedal, true)   // NOTE: align=true for pedal lines only!

// ─── PHASE 12: Lyrics (layoutsystem.cpp:1066-1074) ───
LayoutLyrics::layoutLyrics(options, score, system)
// Layout lyric dashes and melisma:
for sp in score.unmanagedSpanners():
  if sp.tick() >= etick || sp.tick2() <= stick: continue
  sp.layoutSystem(system)

// ─── PHASE 13: FretDiagram detection (layoutsystem.cpp:1080-1092) ───
hasFretDiagram = any annotation in sl where e.isFretDiagram()

// ─── PHASE 14: Harmony — 1st place (layoutsystem.cpp:1100-1103) ───
// If NO fret diagrams: layout harmonies now (normal case).
// If fret diagrams exist: delay harmony layout to Phase 21 (after fret diagrams + voltas).
if !hasFretDiagram:
  LayoutHarmonies::layoutHarmonies(sl)
  LayoutHarmonies::alignHarmonies(system, sl, true, options.maxChordShiftAbove, options.maxChordShiftBelow)

// ─── PHASE 15: StaffText (layoutsystem.cpp:1109-1115) ───
for s in sl:
  for e in s.annotations():
    if e.isStaffText(): e.layout()

// ─── PHASE 16: InstrumentChange (layoutsystem.cpp:1121-1127) ───
for s in sl:
  for e in s.annotations():
    if e.isInstrumentChange(): e.layout()

// ─── PHASE 17: SystemText + PlayTechAnnotation + TripletFeel (layoutsystem.cpp:1133-1139) ───
for s in sl:
  for e in s.annotations():
    if e.isPlayTechAnnotation() || e.isSystemText() || e.isTripletFeel(): e.layout()

// ─── PHASE 18: Jump (layoutsystem.cpp:1145-1155) ───
// Jumps (D.S., D.C.) are in Measure.el(), not segment annotations.
for mb in system.measures():
  if !mb.isMeasure(): continue
  for e in toMeasure(mb).el():
    if e.isJump(): e.layout()

// ─── PHASE 19: Voltas (layoutsystem.cpp:1161-1203) ───
processLines(system, voltas, false)
// Vertical alignment of adjacent volta segments per staff:
for staffIdx in 0..score.nstaves():
  collect voltaSegments for this staff
  // Group consecutive adjacent voltas (tick2 == next tick) and align to lowest y:
  while !voltaSegments.empty():
    y = 0; idx = 0; prevVolta = null
    for ss in voltaSegments:
      volta = toVolta(ss.spanner())
      if prevVolta && prevVolta != volta:
        if prevVolta.tick2() != volta.tick(): break  // not adjacent
      y = min(y, ss.ypos())
      ++idx; prevVolta = volta
    // Apply uniform y and add to skyline:
    for i in 0..idx:
      if ss.autoplace() && ss.isStyled(Pid::OFFSET): ss.setPosY(y)
      if ss.addToSkyline(): system.staff(staffIdx).skyline().add(ss.shape() + ss.pos())
    voltaSegments.erase(0..idx)

// ─── PHASE 20: FretDiagram (layoutsystem.cpp:1209-1226) ───
if hasFretDiagram:
  for s in sl:
    for e in s.annotations():
      if e.isFretDiagram(): e.layout()

  // ─── PHASE 21: Harmony — 2nd place (layoutsystem.cpp:1224-1226) ───
  // With fret diagrams: use maxFretShift instead of maxChordShift.
  LayoutHarmonies::layoutHarmonies(sl)
  LayoutHarmonies::alignHarmonies(system, sl, false, options.maxFretShiftAbove, options.maxFretShiftBelow)

// ─── PHASE 22: TempoText + tempo change lines (layoutsystem.cpp:1232-1239) ───
for s in sl:
  for e in s.annotations():
    if e.isTempoText(): e.layout()
processLines(system, tempoChangeLines, false)

// ─── PHASE 23: Marker (layoutsystem.cpp:1245-1255) ───
// Markers (Segno, Coda) are in Measure.el(), not segment annotations.
for mb in system.measures():
  if !mb.isMeasure(): continue
  for e in toMeasure(mb).el():
    if e.isMarker(): e.layout()

// ─── PHASE 24: RehearsalMark (layoutsystem.cpp:1261-1267) ───
for s in sl:
  for e in s.annotations():
    if e.isRehearsalMark(): e.layout()

// ─── PHASE 25: Image (layoutsystem.cpp:1273-1279) ───
for s in sl:
  for e in s.annotations():
    if e.isImage(): e.layout()
```

### 5.5 `LayoutSystem::getNextSystem()` — System Reuse/Creation
**file:** `layoutsystem.cpp:538`

```
System* getNextSystem(LayoutContext& ctx):
  score = ctx.score()
  isVBox = ctx.curMeasure.isVBox()

  if ctx.systemList.empty():
    system = Factory::createSystem(score.dummy().page())   // brand new
    ctx.systemOldMeasure = null
  else:
    system = takeFirst(ctx.systemList)                     // reuse existing
    ctx.systemOldMeasure = system.measures().empty() ? null : system.measures().back()
    system.clear()   // remove old measures

  score.systems().push_back(system)

  if !isVBox:
    nstaves = score.nstaves()
    system.adjustStavesNumber(nstaves)
    for i in 0..nstaves:
      system.staff(i).setShow(score.staff(i).show())

  return system
```

### 5.6 `LayoutSystem::hideEmptyStaves()`
**file:** `layoutsystem.cpp:562`

```
// Iterates all staves. Hides staves that have no content in this system
// (respects hideWhenEmpty style, cutaway staves, first system exception).
// After hiding, recreates shapes for all segments to account for changes.
// (layoutsystem.cpp:562-668)

for each staff:
  show = true (default)
  if hideWhenEmpty == ALWAYS: show = false (unless it has content)
  if hideWhenEmpty == INSTRUMENT && staffType.isTab: show depends on parent staff
  // Check if staff has any visible content in any measure...
  system.staff(staffIdx).setShow(show)

// Recreate shapes to reflect newly hidden/unhidden staves:
for mb in system.measures():
  if mb.isMeasure():
    for seg in toMeasure(mb).segments():
      seg.createShapes()
```

### 5.7 `LayoutSystem::updateCrossBeams()`
**file:** `layoutsystem.cpp:1441`

```
// Called when system has cross-staff or user-modified beams.
// Must recompute stem directions because staff distances are needed.

void updateCrossBeams(System* system, const LayoutContext& ctx):
  // First, compute staff distances (needed for cross-staff positions):
  system.layout2(ctx)

  // Update grace note cross beams:
  for mb in system.measures():
    for seg in segments():
      if !seg.isChordRestType(): continue
      for e in seg.elist():
        if !e || !e.isChord(): continue
        for grace in toChord(e).graceNotes():
          if grace.beam() && (grace.beam().cross() || grace.beam().userModified()):
            grace.computeUp()

  // Update normal chord cross beams:
  for mb in system.measures():
    for seg in segments():
      for e in seg.elist():
        if !e || !e.isChord(): continue
        chord = toChord(e)
        if chord.beam() && (chord.beam().cross() || chord.beam().userModified()):
          prevUp = chord.up()
          chord.computeUp()
          if chord.up() != prevUp:
            // Direction changed — re-layout chords and recreate shapes:
            LayoutChords::layoutChords1(chord.score(), &seg, chord.vStaffIdx())
            seg.createShape(chord.vStaffIdx())
```

### 5.8 `LayoutSystem::restoreTies()`
**file:** `layoutsystem.cpp:1490`

```
// Restores tie layout for a system after it may have been modified
// by LayoutChords::updateLineAttachPoints() processing the next system.

void restoreTies(System* system):
  segList = [all ChordRest segments in system's measures]
  stick = system.measures().front().tick()
  etick = system.measures().back().endTick()
  doLayoutTies(system, segList, stick, etick)
```

### 5.9 `LayoutSystem::doLayoutTies()`
**file:** `layoutsystem.cpp:1282`

```
void doLayoutTies(System* system, vector<Segment*> sl, Fraction stick, Fraction etick):
  for s in sl:
    for e in s.elist():
      if !e || !e.isChord(): continue
      c = toChord(e)
      // Layout ties for grace notes first:
      for ch in c.graceNotes():
        layoutTies(ch, system, stick)
      // Then layout ties for main chord:
      layoutTies(c, system, stick)
```

---

## פרק 6: Chord & Note Positioning

> קבצים: `layoutchords.cpp`, `chord.cpp`, `note.cpp`
> נסרקו: layoutchords.cpp (~1300 שורות), chord.cpp (~4226 שורות, relevant sections), note.cpp (~4058 שורות, relevant sections)

### 6.1 `layoutChords1()` — Inter-Voice Conflict Resolution
**file:** `layoutchords.cpp:64–523`

Entry point for positioning up-stem and down-stem chords within a single segment.
Called per segment during `layoutSystemElements()`.

```
Phase 1 — COLLECT CHORDS:
  For each element in segment on this staff:
    Track: upVoices/downVoices count, upStemNotes/downStemNotes (Note* vectors)
    Track: upDots/downDots (max dot count), maxUpMag/maxDownMag
    Track: upHooks/downHooks, upGrace/downGrace
    If crossBeamFound: track cross-staff beams

Phase 2 — GRACE NOTES:
  Call layoutChords2() + layoutChords3() on grace notes separately

Phase 3 — NOTEHEAD WIDTHS:
  nominalWidth = score->noteHeadWidth() * staff->staffMag(tick)
  Sort upStemNotes by line (descending)
  Sort downStemNotes by line (descending)
  maxUpWidth   = layoutChords2(upStemNotes, up=true)   // returns max non-mirrored width
  maxDownWidth = layoutChords2(downStemNotes, up=false)

Phase 4 — CENTERING ADJUSTMENTS (lines 174–237):
  centerThreshold = 0.01 * sp                          // layoutchords.cpp:193
  headDiff  = maxUpWidth - nominalWidth
  headDiff2 = maxUpWidth - nominalWidth * (maxUpMag / staff->staffMag(tick))
  // Adjusts for oversized/undersized noteheads — centers them on the stem

Phase 5 — CONFLICT RESOLUTION (lines 241–448):
  separation = bottomUpNote->line() - topDownNote->line()

  CASE separation == 1 (second interval):                // line 255
    if upDots && !downDots:
      upOffset = maxDownWidth + 0.1 * sp                 // line 258
    else:
      downOffset = maxUpWidth                            // line 260
      if has stem: downOffset -= stem->lineWidth()       // line 263
      else:        downOffset += 0.1 * sp                // line 265

  CASE separation < 1 (overlap/unison):                  // line 268
    Build overlapNotes from both chord sets

    // Check if noteheads can be shared (requires: same line, same tpc,
    // unmirrored, same head group, same size, matching dots/stems)

    Sub-cases (first match wins):
    a. conflict && upDots && !downDots:
       upOffset = maxDownWidth + 0.1 * sp                // line 404
    b. conflictUnison && (!downGrace || upGrace):
       downOffset = maxUpWidth + 0.15 * sp               // line 406
    c. conflictUnison (default):
       upOffset = maxDownWidth + 0.15 * sp               // line 408
    d. conflictSecondUpHigher:
       upOffset = maxDownWidth + 0.15 * sp               // line 410
    e. downHooks && !upHooks && !(upDots && !downDots):
       downOffset = maxUpWidth + 0.3 * sp                // line 412
    f. conflictSecondDownHigher && downDots && !upDots:
       downOffset = maxUpWidth + 0.2 * sp                // line 415
    g. conflictSecondDownHigher (else):
       upOffset = maxDownWidth - 0.2 * sp                // line 417
       if downHooks: upOffset += 0.3 * sp                // line 419
    h. No direct conflict — stem clearance:              // lines 423–447
       clearLeft  = stem->lineWidth() + 0.3 * sp         // line 427 (or 0 if no stem)
       clearRight = stem->lineWidth()
                    + max(maxDownWidth - maxUpWidth, 0)
                    + 0.3 * sp                            // line 430
       upOffset = max(clearLeft, clearRight)
       if downHooks: upOffset = max(upOffset, maxDownWidth + 0.1 * sp)  // line 438

Phase 6 — DOT ADJUSTMENT (lines 451–477):
  dotWidth    = segment->symWidth(SymId::augmentationDot)              // line 464
  dotAdjust   = styleMM(Sid::dotNoteDistance) + dotWidth               // line 466
  dotAdjust  += styleMM(Sid::dotDotDistance) * (dots - 1)              // line 469 (multi-dot)
  dotAdjust  *= mag                                                     // line 471
  dotAdjust   = max(dotAdjust - dotAdjustThreshold, 0.0)              // line 473
  if separation == 1: dotAdjust += 0.1 * sp                            // line 476

Phase 7 — APPLY OFFSETS (lines 481–505):
  For each chord: add upOffset/downOffset + centering + dot adjustment
  Call layoutChords3() for accidentals and dots
  Call layoutSegmentElements()
```

### 6.2 `layoutChords2()` — Note Mirroring
**file:** `layoutchords.cpp:534–621`

Determines which notes within a single stem-direction need mirroring to avoid overlap.

```
Direction:
  UP (upstem):   loop BOTTOM → TOP (startIdx=0, incIdx=+1)       // line 541
  DOWN (downstem): loop TOP → BOTTOM (startIdx=size-1, incIdx=-1) // line 547

For each note in order:
  conflict = abs(ll - line) < 2                                    // line 570
             && lStaffIdx == staffIdx
             && note->visible() && lvisible

  If conflict or opposite stem direction from previous: toggle isLeft
  nmirror = (chord->up() != isLeft)

  Apply user mirror override:
    AUTO → mirror = nmirror
    LEFT → mirror toggled
    RIGHT → mirror = chord->up()

  note->setMirror(mirror)
  If !mirror: maxWidth = max(maxWidth, note->bboxRightPos())

  Track: ll = line, lvisible = visible, lStaffIdx = staffIdx

Return maxWidth  // width of non-mirrored notes
```

### 6.3 `resolveAccidentals()` — Accidental Collision Resolution
**file:** `layoutchords.cpp:646–707`

```
Input: two AcEl* accidentals (left=to be placed, right=already placed), pd (padding)

Determine upper/lower by line position
gap = lower->top - upper->bottom

No conflict if:
  gap >= pd                                                        // line 662
  OR lower->line - upper->line >= 7                                // octave+ apart

allowableOverlap = max(upper->descent, lower->ascent) - pd

CLOSE ACCIDENTALS (|gap| <= 0.33 * sp):                            // line 669
  If -gap <= allowableOverlap: align and return                    // line 672
  (Both can "subsume" the overlap via their descent/ascent)

SIGNIFICANT OVERLAP:
  overlapShift = pd * 1.41                                          // line 683
  (Accounts for vertically overlapping accidental strokes)

  If left == lower && -gap <= allowableOverlap:                    // line 687
    offset = min(left->rightClear, right->leftClear) - overlapShift
    lx = min(lx, right->x + offset)

  If left == lower && -gap <= upper->descent + lower->ascent - pd: // line 696
    Same offset calculation, but only apply if offset > 0

REAL CONFLICT (default):                                            // line 704
  lx = min(lx, right->x - pd)
  return true
```

### 6.4 `layoutAccidental()` — Single Accidental Positioning
**file:** `layoutchords.cpp:713–797`

```
Input: AcEl* me, accidentals above/below, notes to left, colOffset, pd, pnd, sp, tick

Apply magnitude scaling: pnd *= mag, pd *= mag                    // line 727

LEDGER LINE ADJUSTMENT (lines 728–743):
  ledgerAbove = chord->upNote()->line() <= -2                     // line 730
  ledgerBelow = chord->downNote()->line() >= staff->lines(tick)*2 // line 731

  If ledger present and accidental overlaps:
    ledgerAdjust = -styleS(Sid::ledgerLineLength).val() * sp      // line 739
    ledgerVerticalClear = styleS(Sid::ledgerLineWidth).val() * 0.5 * sp  // line 740
    lx = min(lx, ledgerAdjust)                                    // line 741

CLEAR LEFT NOTES (lines 745–776):
  For each note to the left:
    Calculate note vertical extent: lnTop = (lnLine-1) * 0.5 * sp
    If overlap with accidental bbox: push lx left to clear

RESOLVE CONFLICTS WITH OTHER ACCIDENTALS (lines 779–787):
  Call resolveAccidentals() for above and below neighbors
  Track conflictAbove, conflictBelow

FINAL POSITIONING (lines 788–794):
  If conflict:  me->x = lx - acc->width() - acc->bbox().x()
  Elif colOffset != 0: me->x = lx - pd - acc->width() - acc->bbox().x()
  Else:          me->x = lx - pnd - acc->width() - acc->bbox().x()
```

### 6.5 `layoutChords3()` — Accidental + Dot Positioning
**file:** `layoutchords.cpp:804–1222`

```
Phase 1 — COLLECT ACCIDENTALS (lines 833–988):
  For each note from highest to lowest:
    If duplicate accidental (same type, same line): skip

    If accidental visible:
      acc->layout()
      Build AcEl: { note, x, top, bottom, line, width, ascent, descent,
                     rightClear, leftClear }
      pitchClass = (line + 700) % 7                               // line 876
      Track columnBottom[7] per pitch class

    Set note Y position: ny = (note->line() + stepOffset) * stepDistance
    Set note X position:
      If mirrored + up: x = stemPosX - overlapMirror
      If mirrored + down: x = -headBodyWidth + overlapMirror
      If up + !mirrored: x = stemPosX - headBodyWidth
      Else: x = 0
    Track leftmost note: lx = min(lx, sx)
    Determine dot Y position via note->setDotY()

Phase 2 — DOT ALIGNMENT CONFLICT CHECK (lines 996–1025):
  If up/down chords overlap: align all dots to max position

Phase 3 — OCTAVE COLUMN MATCHING (lines 1027–1170):
  Triggers when: nAcc >= 2 && spread >= 7 lines                  // line 1036

  Build columnTop[7] tracking highest accidental per pitch class
  Zig-zag from both ends: match accidentals in octave columns
  Unmatched → umi vector for fallback layout

  Column alignment:
    If Sid::alignAccidentalsLeft: current->x = minX               // line 1164
    Else: current->x = maxX - current->width                      // line 1166

Phase 4 — LAYOUT REMAINING ACCIDENTALS (lines 1177–1212):
  Zig-zag: highest → lowest → alternating toward center
  Call layoutAccidental() for each

Phase 5 — APPLY FINAL POSITIONS (lines 1214–1221):
  For each accidental:
    x = e.x + lx - (note->x() + note->chord()->x())
    note->accidental()->setPos(x, 0)
```

### 6.6 `AcEl` — Accidental Element Data Structure
**file:** `layoutchords.cpp:627–639`

```cpp
struct AcEl {
    Note* note;
    double x;           // actual x position of accidental relative to origin
    double top;         // top of accidental bbox relative to staff
    double bottom;      // bottom of accidental bbox relative to staff
    int line;           // line of note
    int next;           // index of next accidental of same pitch class (ascending list)
    double width;       // width of accidental
    double ascent;      // amount (sp) vertical strokes extend above body
    double descent;     // amount (sp) vertical strokes extend below body
    double rightClear;  // amount (sp) to right of last vertical stroke above body
    double leftClear;   // amount (sp) to left of last vertical stroke below body
};
```

### 6.7 `Chord::layoutPitched()` — Full Chord Layout Pipeline
**file:** `chord.cpp:2083–2278`

```
1. GRACE NOTES RECURSION (lines 2085–2091):
   For each grace note: set graceIndex, recursively call layoutPitched()

2. SETUP (lines 2093–2111):
   _spatium = spatium()
   mag_ = staff() ? staff()->staffMag(this) : 1.0
   dotNoteDistance = styleMM(Sid::dotNoteDistance) * mag_
   chordX = (_noteType == NORMAL) ? ipos().x() : 0.0
   Clear old ledger lines (delete linked list)
   Initialize: lll=0, rrr=0, lhead=0

3. PALETTE HACK (lines 2113–2129):
   If no segment: layout notes → computeUp → layoutStem → addLedgerLines → return

4. PROCESS NOTES (lines 2141–2174):
   For each note:
     note->layout()
     x1 = note->pos().x() + chordX
     x2 = x1 + note->headWidth()
     lll = max(lll, -x1)
     rrr = max(rrr, x2)
     lhead = max(lhead, -x1)
     If accidental visible:
       x = acc->pos().x() + note->pos().x() + chordX
       x -= styleMM(Sid::accidentalDistance) * mag_
       lll = max(lll, -x)

5. LEDGER LINES (line 2180):
   addLedgerLines()

6. ARPEGGIO (lines 2182–2209):
   If _arpeggio:
     arpeggioNoteDistance = styleMM(Sid::ArpeggioNoteDistance) * mag_
     extraX = _arpeggio->width() + gapSize + chordX
     _arpeggio->setPos(-(lll + extraX), y1)
     lll += extraX

7. DOTS (lines 2211–2216):
   x = dotPosX() + dotNoteDistance + (dots-1) * dotDotDistance
   x += symWidth(SymId::augmentationDot)
   rrr = max(rrr, x)

8. HOOK (lines 2218–2229):
   If beam: remove hook
   Else: _hook->layout(), update rrr

9. SET SPACING (lines 2231–2232):
   _spaceLw = lll
   _spaceRw = rrr

10. NOTE PHASE 2 (lines 2234–2236):
    For each note: note->layout2()

11. CHORD ELEMENTS (lines 2238–2254):
    Layout chord-attached elements (except slurs), update spacing for chordlines

12. ALIGN FINGERINGS (lines 2256–2277):
    Find leftmost LH guitar fingering X → align all fingerings to it
```

### 6.8 `Chord::addLedgerLines()` — Ledger Line Creation
**file:** `chord.cpp:822–976`

```
DEFAULTS (palette mode):
  lineBelow = 8                            // (5-1)*2 for 5-line staff    // line 827
  lineDistance = 1                                                         // line 828
  mag = 1                                                                  // line 829

REAL STAFF VALUES (lines 834–842):
  lineBelow = (st->lines(tick) - 1) * 2                                  // line 838

NEED CHECK (line 846):
  if downLine() + stepOffset <= lineBelow + 1
     && upLine() + stepOffset >= -1: return  // all notes within staff

KEY CONSTANT:
  extraLen = styleMM(Sid::ledgerLineLength) * mag                         // line 851

SCANNING — Two passes (bottom→top, then top→bottom):
  For each note outside staff:
    LINE ROUNDING TO EVEN:
      if l < 0: l = (l + 1) & ~1           // round toward 0             // line 888
      else:     l = l & ~1                  // round down to even          // line 890

    hw = max(hw, note->headWidth())
    minX = note->pos().x() + note->bboxXShift() - extraLen * note->mag()
    maxX = note->pos().x() + note->bboxXShift() + hw + extraLen * note->mag()

    Create LedgerLineData entries in steps of 2 (every staff line)

RENDERING (lines 958–975):
  For each LedgerLineData:
    stepDistance = lineDistance * 0.5
    LedgerLine* h = new LedgerLine(score)
    h->setLen(lld.maxX - lld.minX)
    h->setPos(lld.minX, lld.line * _spatium * stepDistance)
```

### 6.9 `Note::layout()` — Notehead Layout
**file:** `note.cpp:2257–2329`

```
TAB BRANCH (lines 2259–2302):
  If DisplayFretOption::Hide: return
  Get tab staff type, mags = magS()

  Fret string formatting:
    Fixed note: fretString = "/"
    Normal: fretString = tab->fretString(fabs(_fret), _string, _deadNote)
    Negative fret: prepend "-"
    Artificial harmonic: format as "%1 <%2>"
    Natural harmonic: format as "<%1>"
    Ghost/parentheses handling

  Bbox: setRect(0, tab->fretBoxY() * mags, w, tab->fretBoxH() * mags)   // line 2296

STANDARD BRANCH (lines 2303–2328):
  If dead note: headGroup = HEAD_CROSS
  If harmonic: headGroup = HEAD_DIAMOND
  nh = noteHead()                                                          // line 2309
  If crossNoteHeadAlwaysBlack: convert X half/whole → X black

  _cachedNoteheadSym = nh                                                  // line 2314

  If isNoteName:
    HEAD_WHOLE → _cachedSymNull = noteEmptyWhole                           // line 2320
    HEAD_HALF  → _cachedSymNull = noteEmptyHalf                            // line 2322
    default    → _cachedSymNull = noteEmptyBlack                           // line 2317
  Else: _cachedSymNull = noSym                                             // line 2325

  setbbox(symBbox(nh))                                                     // line 2327
```

### 6.10 `Note::layout2()` — Dot X Positioning + Element Layout
**file:** `note.cpp:2336–2422`

```
DOT POSITIONING (lines 2341–2377):
  d  = styleS(Sid::dotNoteDistance) * mag()                               // line 2343
  dd = styleS(Sid::dotDotDistance) * mag()                                // line 2344
  x  = chord()->dotPosX() - pos().x() - chord()->pos().x()               // line 2345

  HOOK COLLISION (lines 2347–2355):
    If chord has hook && stem up:
      hookRight  = hook->width() + hook->x() + chord->pos().x()
      hookBottom = hook->height() + hook->y() + chord->pos().y()
                   + 0.25 * spatium()                                      // line 2349
      dotY = top note's dot Y position
      If collision: d = hook->width()

  TAB STEM-THROUGH (lines 2357–2370):
    setDotY(DirectionV::AUTO)
    dd = STAFFTYPE_TAB_DEFAULTDOTDIST_X * spatium()  // = 0.75 * sp       // line 2367
    d  = dd * 0.5                                                          // line 2368

  APPLY DOTS (lines 2372–2376):
    xx = x + d
    For each dot: dot->setPosX(xx); xx += dd

ELEMENT LAYOUT (lines 2380–2421):
  Parenthesis positioning for TAB/pitched
  Fingering layout (if placement type == NOTE)
  Symbol layout with magnitude
```

### 6.11 `Note::setDotY()` — Dot Y Positioning
**file:** `note.cpp:2183–2251`

```
TAB BRANCH (lines 2188–2205):
  If stemThrough && onLines: onLine = true
  If stemThrough && !onLines: y = -0.5                                     // line 2197
  If !stemThrough: return (no dot processing)

STANDARD BRANCH (line 2207):
  onLine = !(line() & 1)          // odd line numbers = between lines      // line 2207

VOICE-BASED DISPLACEMENT (line 2210):
  oddVoice = voice() & 1          // voice 1,3,5 = odd = true

  ON-LINE NOTES (lines 2211–2219):
    AUTO: y = oddVoice ? 0.5 : -0.5                                       // line 2214
    UP:   y = -0.5                                                          // line 2216
    DOWN: y = 0.5                                                           // line 2218

  BETWEEN-LINE NOTES (lines 2220–2226):
    UP && even voice:  y -= 1.0                                            // line 2222
    DOWN && odd voice: y += 1.0                                            // line 2224

SCALE: y *= spatium() * staff()->lineDistance(tick())                      // line 2227

CREATE/DELETE DOTS (lines 2231–2246):
  n = chordDots - noteDots
  If n > 0: create n new NoteDot objects
  If n < 0: remove -n dots

APPLY (lines 2247–2250):
  For each dot: dot->layout(); dot->setPosY(y)
```

### 6.12 SMuFL Anchor Points
**file:** `note.cpp`

```
stemUpSE() — note.cpp:1166                    stemDownNW() — note.cpp:1157
  return symSmuflAnchor(noteHead(),             return symSmuflAnchor(noteHead(),
    SmuflAnchorId::stemUpSE)                      SmuflAnchorId::stemDownNW)
  // Southeast anchor: bottom-right             // Northwest anchor: top-left
  // Used for up-stem attachment                // Used for down-stem attachment
```

**Geometry helpers:**
```
headWidth()       = symWidth(noteHead())                                   // note.cpp:1087
bboxXShift()      = symbolFont->bbox(noteHead(), magS()).bottomLeft().x()  // note.cpp:1097
noteheadCenterX() = symbolFont->width(noteHead(), magS()) / 2 + bboxXShift() // note.cpp:1108
headBodyWidth()   = headWidth() + 2 * bboxXShift()                        // note.cpp:993
bboxRightPos()    = symbolFont->bbox(noteHead(), magS()).right()           // note.cpp:982
stemPosX()        = _up ? noteHeadWidth() : 0.0  // (pitched staff)       // chord.cpp:496
noteHeadWidth()   = score->noteHeadWidth() * mag()                        // chord.cpp:486
```

### 6.13 Other layoutchords.cpp Functions

**`updateGraceNotes()`** — layoutchords.cpp:1229: Clean pre-appended grace notes, re-append to segments, layout groups.

**`repositionGraceNotesAfter()`** — layoutchords.cpp:1306: After horizontal spacing, reposition grace-notes-after with segment X offset.

**`clearLineAttachPoints()`** — layoutchords.cpp:1323: Clear line attachment points from all notes.

**`updateLineAttachPoints()`** — layoutchords.cpp:1349: Pre-layout ties and glissandi to get attachment points. Processes: glissandi → ties back → ties forward.

**`LayoutChords::appendGraceNotes()`** — layoutchords.cpp:1266: Appends grace notes to their parent chord's segment. Creates grace note segments if needed and positions them relative to the parent chord.

---

## פרק 7: Stem Layout

> קבצים: `chord.cpp`, `stem.cpp`, `hook.cpp`
> נסרקו: chord.cpp (stem functions ~700 שורות), stem.cpp (358 שורות), hook.cpp (118 שורות)

### 7.1 `Chord::computeUp()` — Stem Direction Algorithm
**file:** `chord.cpp:978–1116`

```
Priority order (first match wins):

1. TAB STAFF (lines 980–998):
   - If stemless: _up = false; return
   - If !stemThrough:
     - If multiple voices: _up = (track % 2 == 0); return
       // Even tracks (voice 0,2,4) → up; odd tracks (voice 1,3,5) → down
     - Else: _up = !staffType.stemsDown(); return

2. CUSTOM STEM DIRECTION (lines 1000–1003):
   - If _stemDirection != AUTO && !(beam && beam.cross()):
     _up = (_stemDirection == UP); return

3. UI ITEM (line 1005): _up = true; return

4. BEAM MEMBERSHIP (lines 1007–1063):
   - If _beam:
     a. Cross-staff: if staffMove > 0 → _up = true;
                     if staffMove < 0 → _up = (staffMove >= 0) = false
     b. User-modified beam:
        desiredY computed from beam anchor position + angle
        _up = (noteY > desiredY)
     c. Non-cross, non-user-modified: _up = beam.up()
     → beam.layout(); return

5. MULTIPLE VOICES (lines 1065–1070):
   - If measure.hasVoices(staffIdx, tick, actualTicks):
     _up = (track % 2 == 0); return

6. GRACE NOTE (line 1072): _up = true; return

7. CROSS-STAFF (line 1074): _up = (staffMove > 0); return

8. SMALL STAFF STYLE (lines 1076–1085):
   - If staffLineCount < minStaffSizeForAutoStems:
     Get smallStaffStemDirection from style
     If != AUTO: _up = (stemDirection == UP); return

9. AUTO DIRECTION (lines 1087–1116):
   noteDistances = noteDistances()  // see §7.2
   direction = computeAutoStemDirection(noteDistances)
   _up = (direction > 0)
   _usesAutoUp = (direction == 0)
```

### 7.2 `computeAutoStemDirection()` — Balanced Stem Direction
**file:** `chord.cpp:1119–1136`

```cpp
int Chord::computeAutoStemDirection(const std::vector<int>& noteDistances)
{
    int left = 0;
    int right = static_cast<int>(noteDistances.size()) - 1;

    while (left <= right) {
        int leftNote = noteDistances.at(left);     // distance from middle line
        int rightNote = noteDistances.at(right);    // positive = below middle
        int netDirecting = leftNote + rightNote;
        if (netDirecting == 0) {
            left++;
            right--;
            continue;
        }
        return netDirecting > 0 ? 1 : -1;          // line 1133
        // positive net → notes below middle → return 1 → _up = true (stem up)
        // negative net → notes above middle → return -1 → _up = false (stem down)
    }
    return 0;   // all pairs balanced → _usesAutoUp = true (default: stem up)
}
```

**`noteDistances()`** — chord.cpp:240–253:
For each note: `distance = noteLine - staffType->middleLine()`. Positive = below staff middle.

### 7.3 `calcMinStemLength()` — Minimum Stem Length (Tremolo/Hook/Beam)
**file:** `chord.cpp:1422–1484`

```
Returns minimum stem length in QUARTER SPACES.

TREMOLO (if single-note tremolo):
  buzzRollMultiplier = isBuzzRoll ? 2 : 1
  minStemLength += ceil(tremolo->minHeight() / mag * 4.0 * multiplier)
  Get padding from style: tremoloOutSidePadding, tremoloNoteSidePadding
  Calculate outsideStaffOffset from note line vs staff bounds
  minStemLength += outSidePadding + max(noteSidePadding, outsideStaffOffset)

HOOK (if hook exists):
  smuflAnchor = hook->smuflAnchor().y() * (up ? 1 : -1)
  hookOffset = floor((hook->height()/mag + smuflAnchor) / spatium * 4) - (straightFlags ? 0 : 2)
  hookOffset = min(hookOffset, 11)                                         // cap at 11 qs
  cutout:
    Up:   cutout = beams >= 2 ? 3 : 5
    Down: cutout = beams >= 2 ? 5 : 7
    If straightFlags: cutout = 0
  minStemLength += hookOffset - cutout

BEAM:
  static const int minInnerStemLengths[4] = { 10, 9, 8, 7 };             // line 1477
  // Index: min(beamCount, 3). Values in quarter spaces.
  innerStemLength = minInnerStemLengths[min(beams(), 3)]
  beamsHeight = beams() * (useWideBeams ? 4 : 3) - 1
  minStemLength = max(minStemLength, innerStemLength + beamsHeight)
```

### 7.4 `stemLengthBeamAddition()` — Extra Length for Beamed Notes
**file:** `chord.cpp:1487–1503`

```
If hook: return 0
Switch beamCount:
  0, 1, 2 → return 0
  3       → return 2
  4+      → return (beamCount - 3) * (useWideBeams ? 4 : 3)
```

### 7.5 `minStaffOverlap()` — Minimum Stem Overlap with Staff
**file:** `chord.cpp:1505–1521`

```
Parameters: up, staffLines, beamCount, hasHook, beamSpacing, useWideBeams, isFullSize

beamOverlap = 8                                                            // default: 2sp
If isFullSize:
  If 3 beams && !hasHook: beamOverlap = 12                                // 3sp
  Elif >= 4 beams && !hasHook:
    beamOverlap = (beamCount - 4) * beamSpacing
                  + (useWideBeams ? 16 : 14)

staffOverlap = min(beamOverlap, (staffLines - 1) * 4)

If DOWN stem: return staffOverlap                                          // middleLine from top
If UP stem:   return (staffLines - 1) * 4 - staffOverlap                   // middleLine from bottom

// Example (5-line staff, 2 beams, up):
//   beamOverlap = 8, staffOverlap = min(8, 16) = 8
//   return 16 - 8 = 8 qs (= line 4 from top = middle of staff)
```

### 7.6 `maxReduction()` — Stem Shortening Table
**file:** `chord.cpp:1524–1566`

```
static const int maxReductions[4][5] = {                                   // line 1530
//  1sp  1.5sp  2sp  2.5sp  >=3sp   ← extensionOutsideStaff (half-spaces)
  { 1,   2,     3,   4,     4 },    // 0 beams
  { 0,   1,     2,   3,     3 },    // 1 beam
  { 0,   1,     1,   1,     1 },    // 2 beams
  { 0,   0,     0,   1,     1 },    // 3 beams
};

If !shortenStem style: return 0
beamCount = _hook ? 0 : beams()
If beamCount >= 4: return 0
extensionHalfSpaces = min(floor(extensionOutsideStaff / 2.0), 4)
reduction = maxReductions[beamCount][extensionHalfSpaces]

EXCEPTIONS:
  If small note (relativeMag < 1) && has hook: reduction = min(reduction, 1)
  Elif normal size:
    If 1 beam && extension < 1sp: reduction = 2
    If 3 beams && extension == 1.5sp exactly: reduction = 0
    If has hook: reduction = min(reduction, 1)

Return reduction    // in quarter spaces
```

### 7.7 `stemOpticalAdjustment()` + `calc4BeamsException()`
**file:** `chord.cpp:1569–1603`

**stemOpticalAdjustment** (line 1569):
```
If hook: return 0
If 0 beams or > 2 beams: return 0
isOnEvenLine = fmod(stemEndPosition + 4, 4) == 2     // stem end in space
If on even line: return 1                              // add 1 quarter space
Else: return 0
```

**calc4BeamsException** (line 1585):
```
staffLines = (staff->lines(tick) - 1) * 2             // top staff line = 0, bottom = staffLines
If up && upNote->line() > staffLines:
  difference = upNote->line() - staffLines              // extension below staff
If down && downNote->line() < 0:
  difference = abs(downNote->line())                    // extension above staff

Switch difference:
  case 2:   return max(stemLength, 21)                 // 5.25sp minimum
  case 3-4: return max(stemLength, 23)                 // 5.75sp minimum
  default:  return stemLength
```

### 7.8 `Chord::calcDefaultStemLength()` — Full Stem Length Computation
**file:** `chord.cpp:1612–1729`

```
All calculations in QUARTER SPACES (1 sp = 4 qs)

1. BASE LENGTH:
   defaultStemLength = styleD(Sid::stemLength) * 4     // = 3.5 * 4 = 14 qs
   defaultStemLength += stemLengthBeamAddition()        // see §7.4
   if TAB: defaultStemLength *= 1.5

2. EXTRA HEIGHT (SMuFL notehead anchor):
   extraHeight = (up ? upNote->stemUpSE().y() : downNote->stemDownNW().y())
                 / relativeMag / spatium

3. SHORTEST STEM:
   if useWideBeams: shortestStem = 12                  // 3sp
   else: shortestStem = (styleD(Sid::shortestStem) + abs(extraHeight)) * 4

4. CHORD HEIGHT:
   chordHeight = (downLine() - upLine()) * 2           // distance in qs

5. MIN STEM LENGTH: (see §7.3)
   minStemLengthQuarterSpaces = calcMinStemLength()
   _minStemLength = minStemLengthQuarterSpaces / 4.0 * spatium

6. STAFF PARAMETERS:
   staffLineCount = staff->lines(tick)
   shortStemStart = styleI(Sid::shortStemStartLocation) * 2 + 1
   useWideBeams = styleB(Sid::useWideBeams)

7. MIDDLE LINE OVERLAP: (see §7.5)
   middleLine = minStaffOverlap(_up, staffLineCount, beams(), !!_hook,
                                 useWideBeams ? 4 : 3, useWideBeams,
                                 !isGrace() && !isSmall())

8. UPWARD STEM (lines 1647–1665):
   stemEndPosition    = upLine() * 2 - defaultStemLength
   stemEndPositionMag = upLine() * 2.0 - (defaultStemLength * relativeMag)
   idealStemLength    = defaultStemLength

   if stemEndPositionMag <= -shortStemStart:           // extends far above staff
     reduction = maxReduction(|floor(stemEndPositionMag) + shortStemStart|)  // §7.6
     if TAB: reduction *= 2
     idealStemLength = max(idealStemLength - reduction, shortestStem)
   elif stemEndPosition > middleLine:
     // stem doesn't reach middle — handled by min extension below
   else:
     idealStemLength -= stemOpticalAdjustment(stemEndPosition)  // §7.7
     idealStemLength = max(idealStemLength, shortestStem)

   stemLength = max(idealStemLength, minStemLengthQuarterSpaces)

9. DOWNWARD STEM (lines 1666–1687):
   stemEndPosition    = downLine() * 2 + defaultStemLength
   downShortStemStart = (staffLineCount - 1) * 4 + shortStemStart
   // Symmetric logic with +/- inverted

10. 4-BEAM EXCEPTION (line 1690):
    if beams() == 4 && _beam:
      stemLength = calc4BeamsException(stemLength)      // §7.7

11. PHYSICAL CONVERSION (line 1693):
    finalStemLength = (chordHeight / 4.0 * spatium)
                      + ((stemLength / 4.0 * spatium) * relativeMag)

12. MINIMUM EXTENSION TO MIDDLE LINE (lines 1694–1726):
    startNote = _up ? downNote : upNote
    stemStart = startNote.pos().y()
    stemEndMag = stemStart + (finalStemLength * upValue)
    lineDistance = staff->lineDistance(tick) * spatium   // default 1.0
    topLine = 0.0
    bottomLine = lineDistance * (staffLineCount - 1.0)

    Calculate target line:
      If lineDistance >= 1.0:
        If staff very small (< 2sp tall): target = opposite line
        Else: target = middleLine / 4.0 * lineDistance
      Else (compressed):
        If < 3 lines: target = opposite line
        Else: target = second staff line

    extraLength = max(0, stemEndMag - target)  // up stem
    or           max(0, target - stemEndMag)   // down stem

    Return finalStemLength + extraLength
```

### 7.9 `Chord::layoutStem()` — Stem Orchestration
**file:** `chord.cpp:1828–1869`

```
1. _defaultStemLength = calcDefaultStemLength()         // see §7.8
2. If shouldn't have stem: remove stem, remove hook, return
3. calcRelativeMag()
4. Create stem if missing
5. If should have hook: layoutHook()
   Else if hook exists: remove hook
6. _stem->setPosX(stemPosX())                          // see §6.12
7. _stem->setBaseLength(Millimetre(_defaultStemLength))
   → internally calls _stem->layout()                   // see §7.10
8. If hook: _hook->setPos(_stem->flagPosition())
9. Stem slash: add if acciaccatura, else remove
```

### 7.10 `Stem::layout()` — Stem Geometry
**file:** `stem.cpp:68–130`

```
_up = up() ? -1.0 : 1.0                                                   // sign multiplier
y1 = 0.0                                                                   // start displacement
y2 = _up * (m_baseLength + m_userLength)                                   // end displacement

TAB STAFF — STEM THROUGH (lines 84–97):
  y1 = (chord->downString() - chord->upString()) * _up * staffLinesDistance
  If !onLines: y1 -= staffLinesDistance * 0.5
  y1 += _up * staffLinesDistance * 0.7                                     // clearance

STANDARD STAFF (lines 99–109):
  note = up ? chord->downNote() : chord->upNote()
  if (up && !note->mirror()) || (!up && note->mirror()):
    y1 = note->stemUpSE().y()                                             // SMuFL anchor
  else:
    y1 = note->stemDownNW().y()                                           // SMuFL anchor
  setPosY(note->ypos())

BEAM ADJUSTMENT (lines 113–115):
  if chord->beam():
    y2 -= _up * point(styleS(Sid::beamWidth)) * 0.5 * chord->beam()->mag()

HOOK ADJUSTMENT (lines 117–118):
  if chord->hook() && !chord->beam():
    y2 += chord->hook()->smuflAnchor().y()

LINE GEOMETRY (lines 120–129):
  lineWidthCorrection = lineWidthMag() * 0.5
  lineX = isTabStaff ? 0.0 : _up * lineWidthCorrection
  m_line.setLine(lineX, y1, lineX, y2)

  beamCorrection = chord->beam()
    ? _up * styleMM(Sid::beamWidth) * mag() / 2.0 : 0.0
  rect = RectF(m_line.p1(), m_line.p2() + PointF(0, beamCorrection))
  setbbox(rect.normalized().adjusted(-lineWidthCorrection, 0, lineWidthCorrection, 0))
```

### 7.11 Hook Functions
**file:** `hook.cpp`

**`Hook::setHookType(int i)`** — hook.cpp:44:
```
straight = score->styleB(Sid::useStraightNoteFlags)
setSym(symIdForHookIndex(i, straight))
```

**`Hook::smuflAnchor()`** — hook.cpp:68:
```
return symSmuflAnchor(_sym,
  chord->up() ? SmuflAnchorId::stemUpNW : SmuflAnchorId::stemDownSW)
  // Up stems: stemUpNW anchor (northwest — top of flag)
  // Down stems: stemDownSW anchor (southwest — bottom of flag)
```

**`Hook::symIdForHookIndex(int index, bool straight)`** — hook.cpp:73–117:

| Index | Curved Symbol | Straight Symbol |
|-------|--------------|-----------------|
| +1 | flag8thUp | flag8thUpStraight |
| +2 | flag16thUp | flag16thUpStraight |
| +3 | flag32ndUp | flag32ndUpStraight |
| +4 | flag64thUp | flag64thUpStraight |
| +5 | flag128thUp | flag128thUpStraight |
| +6 | flag256thUp | flag256thUpStraight |
| +7 | flag512thUp | flag512thUpStraight |
| +8 | flag1024thUp | flag1024thUpStraight |
| -1 | flag8thDown | flag8thDownStraight |
| -2 | flag16thDown | flag16thDownStraight |
| -3 | flag32ndDown | flag32ndDownStraight |
| -4 | flag64thDown | flag64thDownStraight |
| -5 | flag128thDown | flag128thDownStraight |
| -6 | flag256thDown | flag256thDownStraight |
| -7 | flag512thDown | flag512thDownStraight |
| -8 | flag1024thDown | flag1024thDownStraight |
| 0 | noSym | noSym |

### 7.12 Additional Chord & Stem Helper Functions

**Chord helpers (chord.cpp):**
- **`Chord::stemPosBeam()`** (chord.cpp:519) — Returns stem endpoint position adjusted for beam connection (accounts for beam width and staff scaling).
- **`Chord::maxHeadWidth()`** (chord.cpp:805) — Returns width of the widest notehead in the chord, used for spacing and collision.
- **`Chord::shouldHaveStem()`** (chord.cpp:1757) — Returns true if chord duration requires a stem (quarter note or shorter, or special cases like grace notes). False for whole/half notes, stemless staffs.
- **`Chord::createStem()`** (chord.cpp:1777) — Factory: creates a new Stem child element and adds it to the chord.
- **`Chord::removeStem()`** (chord.cpp:1786) — Removes the stem and its associated hook from the chord.
- **`Chord::underBeam()`** (chord.cpp:1875) — Returns true if this chord is part of a beam group.
- **`Chord::layoutTablature()`** (chord.cpp:2284) — Tab-specific chord layout: sets fret positions, suppresses accidentals, handles tab stem direction.
- **`Chord::setStemDirection(Direction d)`** (chord.cpp:2914) — Sets manual stem direction (AUTO/UP/DOWN). Triggers relayout.
- **`Chord::toGraceAfter()`** (chord.cpp:3396) — Converts a grace-before chord to grace-after by updating chord type and repositioning.
- **`Chord::articulationSymbolIds()`** (chord.cpp:4084) — Returns list of SymIds for all articulations attached to this chord.

**Note helpers (note.cpp):**
- **`Note::tabHeadWidth()`** (note.cpp:1116) — Notehead width for tab staff rendering (may differ from standard notehead).
- **`Note::headHeight()`** (note.cpp:1136) — Standard notehead height from symbol font metrics.
- **`Note::tabHeadHeight()`** (note.cpp:1145) — Tab-specific notehead height.
- **`Note::updateAccidental()`** (note.cpp:2455) — Recalculates accidental type based on key signature and current pitch context.
- **`Note::setAccidentalType()`** (note.cpp:3885) — Sets explicit accidental type, creating accidental object if needed.

**Note constants:**
- `MODE_TRANSITION_LIMIT_DEGREES = 15.0` (note.cpp:1812) — Maximum pitch change angle for glissando mode transition detection.
- `negativeFret` (note.cpp:2273) — `(_fret < 0) && engravingConfiguration()->negativeFretsAllowed`. Guards negative fret rendering.
- `minGlissandoLength = 1.2 * spatium()` (note.cpp:4002) — Minimum visual length for glissando lines.

**Stem constant:**
- `isTablature` (stem.cpp:164) — `staffType && staffType->isTabStaff()`. Tab detection flag in stem layout.

---

## פרק 8: Beam Layout

> קבצים: `beam.cpp`, `beam.h`, `layoutbeams.cpp`
> נסרקו: beam.cpp (~2456 שורות), beam.h (הגדרות), layoutbeams.cpp (~507 שורות)

### 8.1 `Beam::layout()` — Entry Point
**file:** `beam.cpp:437–488`

```
system = elements.front().measure().system()
setParent(system)

// GROUP ELEMENTS BY SYSTEM (cross-system beams):
crl = []
n = 0
for cr in elements:
  if cr.measure().system() != system:
    st = (n == 0) ? BEGIN : MIDDLE
    n++
    if fragments.size() < n: fragments.push_back(new BeamFragment)
    layout2(crl, st, n - 1)
    crl.clear()
    system = cr.measure().system()
  crl.push_back(cr)

// FINAL FRAGMENT:
setbbox(RectF())
if !crl.empty():
  st = (n == 0) ? SINGLE : END
  if fragments.size() < n + 1: fragments.push_back(new BeamFragment)
  layout2(crl, st, n)

  // BUILD BOUNDING BOX from all segments:
  lw2 = _beamWidth / 2.0
  for bs in _beamSegments:
    r = RectF(bs.line).adjusted(0, -lw2, 0, lw2)
    addbbox(r)
```

### 8.2 `Beam::layout1()` — Direction Determination
**file:** `beam.cpp:291–430`

```
INITIAL SETUP:
  _isBesideTabStaff = _tab && !_tab->stemless() && !_tab->stemThrough()

TAB STAFF (lines 300–313):
  Set _up from tab configuration
  _slope = 0.0, _cross = false, _minMove = 0, _maxMove = 0
  Return

DRUM STAFF (lines 315–335):
  Set _up from direction/grace status
  Compute all chord stem directions
  Return

NORMAL STAFF:
  1. COLLECT (lines 341–357):
     _minMove = INT_MAX, _maxMove = INT_MIN
     Clear _notes vector
     For each chord:
       Track magnification (small notes)
       staffMove = chord->staffMove()
       _minMove = min(_minMove, staffMove)
       _maxMove = max(_maxMove, staffMove)
       Collect all noteDistances into _notes
     Sort _notes

  2. STEM DIRECTION (lines 363–397):
     If direction != AUTO: use explicit
     Elif _maxMove > 0: _up = false                    // moved down → stems down
     Elif _minMove < 0: _up = true                     // moved up → stems up
     Elif grace + multiple voices: alternate by track
     Elif _notes.size(): use computeAutoStemDirection()
     Default: _up = true

  3. ADD MIDDLE LINE (lines 399–402):
     For each note in _notes: note += middleLine

  4. CROSS-STAFF (lines 404–430):
     _cross = (_minMove != _maxMove)
     If entirely moved: adjust staff index and direction
     Adjust stem directions for all chords
```

### 8.3 `Beam::layout2()` — Beam Geometry (Dictator/Pointer System)
**file:** `beam.cpp:1437–1589`

```
INITIALIZATION (lines 1439–1478):
  Find startChord, endChord (first/last actual Chord, skip rests)
  Layout all chord stems

  _beamSpacing = useWideBeams ? 4 : 3
  _beamDist = (_beamSpacing / 4.0) * spatium() * mag()                    // default: 0.75sp
  _beamWidth = point(styleS(Sid::beamWidth)) * mag()                      // default: 0.5sp

  GRACE NOTE SCALING:
  if _isGrace:
    _beamDist  *= styleD(Sid::graceNoteMag)                               // *= 0.7
    _beamWidth *= styleD(Sid::graceNoteMag)                               // *= 0.7

  Get anchor positions and default stem lengths

USER-MODIFIED (lines 1481–1496):
  If _userModified[fragmentIndex]:
    Use stored fragment y-positions, snap to grid, create segments, return

CROSS-STAFF (lines 1498–1503):
  Call layout2Cross() — see §8.4
  If failed, mark _cross = false and continue

STANDARD BEAM POSITIONING (lines 1508–1579):
  1. DICTATOR/POINTER (lines 1509–1530):
     Get startNote/endNote lines
     isAscending = (startNote > endNote)
     Convert anchor Y positions to quarter-space units
     Determine dictator (controls position) vs pointer (follows)
     // Dictator is the note that's furthest from the beam

  2. DESIRED SLANT (line 1526):
     slant = computeDesiredSlant()                     // see §8.5
     isFlat = (slant == 0)

  3. COLLISION AVOIDANCE:
     offsetBeamWithAnchorShortening()                  // see §8.8
     offsetBeamToRemoveCollisions()                    // see §8.8

  4. VALID POSITIONS:
     setValidBeamPositions()                           // see §8.7
     addMiddleLineSlant()                              // see §8.9
     add8thSpaceSlant()                                // see §8.9

  5. FINALIZE (lines 1565–1580):
     Update Y from dictator/pointer
     Set X from stem positions
     Calculate _slope = (endY - startY) / (endX - startX)

TAB STAFF (lines 1581–1583):
  _slope = 0

STORE + CREATE (lines 1585–1588):
  Store fragment positions
  createBeamSegments()                                 // see §8.10
```

### 8.4 `Beam::layout2Cross()` — Cross-Staff Beam Geometry
**file:** `beam.cpp:1591–1803`

```
Track notes on top/bottom staff separately:
  topFirst, topLast, bottomFirst, bottomLast
  maxMiddleTopLine, minMiddleBottomLine
  Flags for second/penultimate note matching endpoints

Identify staff offset from first chord with staffMove != 0
Return false if no cross-staff detected

INITIAL POSITION (lines 1692–1694):
  Y = (maxY + minY) / 2                               // midpoint between extremes
  _slope = 0                                           // start flat

SLOPE CALCULATION:
  TWO-NOTE CASE (lines 1711–1726):
    One chord on each staff — calculate slant from stem positions
    Apply max slope constraint, offset anchors by slant/2

  ONE-STAFF CASE (lines 1727–1759):
    Only notes on one staff — use that staff's slope
    Force horizontal if middle note more extreme than endpoints

  MULTI-NOTE ON EACH STAFF (lines 1760–1794):
    Compare slants from both staves
    If same direction: use minimum slant
    If opposite: keep horizontal
    If either zero: keep horizontal

FINALIZE (lines 1795–1801):
  Set X anchors to stem positions
  Calculate slope, store fragment, createBeamSegments()
```

### 8.5 Slope Computation Functions

**`_maxSlopes` array** — beam.h:238:
```cpp
static constexpr std::array _maxSlopes = { 0, 1, 2, 3, 4, 5, 6, 7 };
// Index = interval in staff positions (0 = unison, 7+ = octave+)
// Values in quarter-spaces
```

**`getMaxSlope()`** — beam.cpp:613–641:
```
beamWidth = (endX - startX) / spatium()    // beam length in staff-spaces
maxSlope = _maxSlopes[7]                   // default = 7

if beamWidth <  3.0: maxSlope = _maxSlopes[1] = 1
elif         <  5.0: maxSlope = _maxSlopes[2] = 2
elif         <  7.5: maxSlope = _maxSlopes[3] = 3
elif         < 10.0: maxSlope = _maxSlopes[4] = 4
elif         < 15.0: maxSlope = _maxSlopes[5] = 5
elif         < 20.0: maxSlope = _maxSlopes[6] = 6
else:                maxSlope = _maxSlopes[7] = 7

return maxSlope
```

**`computeDesiredSlant()`** — beam.cpp:505–538:
```
If noSlope(): return 0
Calculate extensions:
  dictatorExtension = middleLine - dictator
  pointerExtension = middleLine - pointer
  If up: both constrained to <= 0
  If down: both constrained to >= 0
If both endpoints at middleLine: return 0
If startNote == endNote: return 0

slopeConstrained = isSlopeConstrained(startNote, endNote)  // see below
If 0: return 0                                              // forced flat
If 1: return 0.25 direction                                 // ±1 quarter-space

interval = min(abs(endNote - startNote), _maxSlopes.size() - 1)  // cap at 7
maxSlope = min(getMaxSlope(), _maxSlopes[interval])
return maxSlope * (_up ? 1 : -1)
```

**`isSlopeConstrained()`** — beam.cpp:540–611:
```
Returns: 0 = flat, 1 = ±0.25 (quarter-space), -1 = no constraint

If startNote == endNote: return 0

If _notes.size() > 2:
  For UP beams:
    If any inner note higher than both endpoints: return 0      // "concave"
    Exception: if 2 notes at endpoint height and 2nd is neighbor: return 1
  For DOWN beams: mirrored logic

Return -1   // no constraint
```

### 8.6 Anchor Functions

**`chordBeamAnchorX()`** — beam.cpp:654–701:
```
stemPosX = cr->stemPosX() + cr->pagePos().x() - pagePos().x()

If not chord or no stem:
  If !_up: adjust stemPosX for rests
  return stemPosX

If chord with stem:
  stemWidth = chord->stem()->lineWidth() * chord->mag()        // beam.cpp:667
  // NOTE: uses stem->lineWidth(), NOT styleMM(Sid::stemWidth)

  Switch anchorType:
    Start:
      TAB: return stemPosX - 0.5 * stemWidth
      If chord.up(): return stemPosX - stemWidth               // left edge
      Else: return stemPosX
    Middle:
      TAB: return stemPosX
      return stemPosX ± 0.5 * stemWidth                        // center
    End:
      TAB: return stemPosX + 0.5 * stemWidth
      If !chord.up(): return stemPosX + stemWidth              // right edge
      Else: return stemPosX
```

**`chordBeamAnchorY()`** — beam.cpp:703–725:
```
If not chord: return cr->pagePos().y()

note = cr->up() ? chord->downNote() : chord->upNote()
position = note->pagePos()

upValue = cr->up() ? -1 : 1
beamOffset = _beamWidth / 2 * upValue                          // line 716

If _isBesideTabStaff:
  stemLength = _tab->chordStemLength(chord) * (_up ? -1 : 1)
  y = _tab->chordRestStemPosY(chord) + stemLength
  y *= spatium()
  y -= beamOffset                                               // line 720
  return y + chord->pagePos().y()

return position.y() + (chord->defaultStemLength() * upValue) - beamOffset  // line 724
```

### 8.7 Position Validation Functions

**`isBeamInsideStaff()`** — beam.cpp:1260–1265:
```
aboveStaff = allowFloater ? -2 : -3
belowStaff = (staffLines - 1) * 4 + (allowFloater ? 2 : 3)
return yPos > aboveStaff && yPos < belowStaff
```

**`isValidBeamPosition()`** — beam.cpp:1279–1307:
```
// Outside staff is always valid:
if !isBeamInsideStaff(yPos, staffLines, isOuter): return true

yPos += 8                                      // normalize to avoid negative modulo

// FLOATERS (between lines) are INVALID:
if yPos % 4 == 2: return false                 // half-space positions

if isFlat: return true

// Lines are valid:
if yPos % 4 == 0: return true

// SPACES — direction-dependent:
if yPos % 4 == 3:                              // "sitting" space
  return isAscending != isStart
if yPos % 4 == 1:                              // "hanging" space
  return isAscending == isStart
```

**`is64thBeamPositionException()`** — beam.cpp:1309–1315:
```
if _beamSpacing == 4: return false              // wide beams, no exception
return yPos == 2 || yPos == staffLines*4-2
    || yPos == staffLines*4-6 || yPos == -2
```

**`getOuterBeamPosOffset()`** — beam.cpp:1267–1277:
```
spacing = _up ? -_beamSpacing : _beamSpacing
offset = (beamCount - 1) * spacing
isInner = false
while offset != 0 && !isBeamInsideStaff(innerBeam + offset, staffLines, isInner):
  offset -= spacing
  isInner = true
return offset
```

**`findValidBeamOffset()`** — beam.cpp:1317–1337:
```
offset = 0
innerBeam = outer + (beamCount-1) * (_up ? _beamSpacing : -_beamSpacing)

Loop until valid:
  while !isValidBeamPosition(innerBeam + offset, ...):
    offset += _up ? -1 : 1
  outerMostBeam = innerBeam + offset + getOuterBeamPosOffset(...)
  if isValidBeamPosition(outerMostBeam) OR (beamCount==4 && is64thException):
    break
  else: offset += _up ? -1 : 1
return offset
```

**`setValidBeamPositions()`** — beam.cpp:1339–1399:
```
PHASE 1 — 3+ BEAMS INSIDE STAFF:
  If has3BeamsInsideStaff && !useWideBeams:
    Try to fit inside staff using getOuterBeamPosOffset
    If |outerOffset| <= _beamSpacing: give up (can't fit)
    Find valid offset for both dictator and pointer

PHASE 2 — ALL OTHER CASES:
  Loop until valid:
    dictatorOffset = findValidBeamOffset(dictator, ...)
    dictator += dictatorOffset
    pointer += dictatorOffset

    If isFlat: pointer = dictator; check all inner chords
    Else:
      pointerOffset = findValidBeamOffset(pointer, ...)
      pointer += pointerOffset
      If pointer crossed dictator: adjust dictator
      Else: done
```

### 8.8 Collision Avoidance Functions

**`offsetBeamToRemoveCollisions()`** — beam.cpp:1106–1172:
```
If _cross or startX == endX: return

tolerance = _beamWidth * 0.25 * (_up ? -1 : 1)

For each INNER chord (not first/last):
  anchor = chordBeamAnchor(chord, Middle)

  slope = abs(dictator - pointer)
  reduction:
    slope <= 3: reduction = 0.25 * spatium()
    slope <= 6: reduction = 0.5 * spatium()
    else:       reduction = 0.75 * spatium()

  While beam intersects anchor:
    If isFlat: move both dictator and pointer
    Elif |dictator - pointer| == 1: move dictator only
    Else: move pointer
    Recalculate startY/endY
```

**`offsetBeamWithAnchorShortening()`** — beam.cpp:1174–1234:
```
Min stem lengths by beam count:
  static const int minStemLengths[] = { 11, 13, 15, 18, 21, 24, 27, 30 }; // line 1192
  // Index = beamCount - 1. Values in quarter-spaces.

maxDictatorReduce = stemLengthDictator
                    - minStemLengths[dictator_beams - 1]
maxDictatorReduce = min(|dictator - middleLine|, maxDictatorReduce)

Try shortening dictator to find valid position:
  while !isValidBeamPosition(newDictator):
    reduce++
    if reduce > maxDictatorReduce: reset and extend instead
    newDictator -= towardBeam
    newPointer -= towardBeam

Constrain pointer: newPointer = _up ? min(ptr, midLine) : max(ptr, midLine)

Walk back beamwards until both valid:
  while !valid(newDictator) || !valid(newPointer):
    if isFlat: move both
    elif |dict - ptr| == 1: move dictator
    else: move pointer
```

### 8.9 Special Beam Adjustments

**`addMiddleLineSlant()`** — beam.cpp:1402–1415:
```
If interval == 0 || (beamCount > 2 && !useWideBeams) || noSlope(): return

If pointer == middleLine && |pointer - dictator| < 2:
  If |desiredSlant| == 1 || interval == 1 || (beamCount==2 && !useWideBeams):
    dictator = middleLine + (_up ? -1 : 1)          // 1 quarter-space
  Else:
    dictator = middleLine + (_up ? -2 : 2)          // 2 quarter-spaces
```

**`add8thSpaceSlant()`** — beam.cpp:1417–1431:
```
If beamCount != 3 || noSlope() || _beamSpacing != 3: return
If !(isFlat && dictator != middleLine) || dictator != pointer || interval == 0: return

Check if dictator is in space (not on line):
  If up:   (dictator + 4) % 4 != 3 → return
  If down: (dictator + 4) % 4 != 1 → return

dictatorAnchor.y += (_up ? -0.125 : +0.125) * spatium()        // 1/8 space
_beamDist += 0.0625 * spatium()                                  // 1/16 space
```

**`extendStem()`** — beam.cpp:1236–1258:
```
anchor = chordBeamAnchor(chord, Middle)

if _endAnchor.x() > _startAnchor.x():
  proportionAlongX = (anchor.x() - _startAnchor.x())
                     / (_endAnchor.x() - _startAnchor.x())
  desiredY = proportionAlongX * (_endAnchor.y() - _startAnchor.y())
             + _startAnchor.y()
else:
  desiredY = max(_endAnchor.y(), _startAnchor.y())

if chord.up():
  chord->setBeamExtension(anchor.y() - desiredY + addition)
else:
  chord->setBeamExtension(desiredY - anchor.y() + addition)
```

### 8.10 Beam Segment Creation

**`createBeamSegments()`** — beam.cpp:1035–1104:
```
Delete all existing _beamSegments

level = 0
do:
  levelHasBeam = false
  startCr = null, endCr = null

  for each chordRest:
    if level < cr->beams(): levelHasBeam = true

    Check beam breaks: calcBeamBreaks()                // see §8.11
    breakBeam = isBroken32 || isBroken64

    if level < beamCount && !breakBeam:
      endCr = chordRest
      if !startCr: startCr = chordRest
    else:
      if startCr && endCr:
        if startCr == endCr:
          createBeamletSegment(startCr, isBeamletBefore, level)  // §8.10b
        else:
          createBeamSegment(startCr, endCr, level)               // §8.10a
      if breakBeam && level < beamCount:
        startCr = endCr = chordRest
      else:
        startCr = endCr = null

  // Final segment:
  if startCr:
    if startCr == endCr || !endCr:
      createBeamletSegment(startCr, true, level)
    else:
      createBeamSegment(startCr, endCr, level)

  level++
while (levelHasBeam)
```

**`createBeamSegment()`** — beam.cpp:732–860:
```
Determine segment direction (up/down) from start/end chord stems
startX = chordBeamAnchorX(startCr, Start)
endX   = chordBeamAnchorX(endCr, End)

startY = _slope * (startX - _startAnchor.x()) + _startAnchor.y() - pagePos().y()
endY   = _slope * (endX   - _startAnchor.x()) + _startAnchor.y() - pagePos().y()

MULTI-LEVEL OFFSET (lines 785–816):
  Count beams above/below level 0 (extraBeamAdjust)
  verticalOffset = _beamDist * (level - extraBeamAdjust) * upValue
  Apply to startY/endY
  For feathered beams: interpolate grow factors

Create BeamSegment { above, level, line(startX,startY → endX,endY) }
Push to _beamSegments

EXTEND STEMS (lines 829–859):
  For each chord in [startCr, endCr]:
    Calculate additional stem length for this beam level
    Call extendStem(chord, addition)                    // see §8.9
```

**`createBeamletSegment()`** — beam.cpp:945–995:
```
startX = chordBeamAnchorX(cr, isBefore ? End : Start)
beamletLength = beamMinLen * cr->mag() * staff->staffMag()
endX = startX + (isBefore ? -beamletLength : +beamletLength)

startY = _slope * (startX - _startAnchor.x()) + _startAnchor.y() - pagePos().y()
endY = _slope * (endX - startX) + startY

Count extraBeamAdjust from overlapping beams
verticalOffset = _beamDist * (level - extraBeamAdjust) * upValue
Apply offset, create segment
```

### 8.11 Beam Breaks

**`calcBeamBreaks()`** — beam.cpp:997–1033:
```
beamMode = chord->beamMode()
defaultBeamMode = Groups::endBeam(chord, prevChord)

MANUAL BREAKS:
  isManuallyBroken32 = level >= 1 && beamMode == BEGIN32
  isManuallyBroken64 = level >= 2 && beamMode == BEGIN64

DEFAULT BREAKS:
  isDefaultBroken32 = beamMode == AUTO && level >= 1 && defaultBeamMode == BEGIN32
  isDefaultBroken64 = beamMode == AUTO && level >= 2 && defaultBeamMode == BEGIN64

isBroken32 = isManuallyBroken32 || isDefaultBroken32
isBroken64 = isManuallyBroken64 || isDefaultBroken64

TUPLET BREAKS:
  if level > 0 && beamMode == AUTO:
    if tuplet changed:
      beams = max(TDuration(tuplet->ticks()).hooks(), 1)
      if beams <= level: set isBroken32/64
  BEAM_TUPLET_TOLERANCE = 6                                                // line 934
```

**`calcIsBeamletBefore()`** — beam.cpp:862–943:
```
Returns: true = beamlet before note (left), false = after (right)

If first chord: return false
If last chord: return true
If first/last in tuplet: apply tuplet rules
If next chord has break: return true
If next has more beams: return false
If previous has more: return true
Check beat subdivision (tick distance to next chord)
Default: return false
```

### 8.12 layoutbeams.cpp — Beam Orchestration

**`LayoutBeams::createBeams()`** — layoutbeams.cpp:277–474:
```
For each track/staff:
  Skip invisible/stemless staffs
  Initialize beat subdivision map (if 4/4 meter)
  Scan all elements → find minimum duration per beat

For each chord/rest:
  Handle cross-measure continuation
  Call beamGraceNotes() for before/after graces
  Get beamMode
  Check beat boundaries → break beams as needed

  BEAM STATE MACHINE:
    if duration <= 1/4 OR beamMode == NONE:
      Finalize beam; remove beams; continue
    if beam exists:
      if beamMode == BEGIN: finalize beam
      else: add element
    if a1 == null: a1 = element
    else:
      if beamMode == BEGIN or incompatible: remove a1 beam; a1 = element
      else: create/get beam; add element; clear a1

  Finalize remaining beam
```

**`LayoutBeams::restoreBeams()`** — layoutbeams.cpp:108–122:
```
For each ChordRest segment:
  if element is first in its beam:
    beam->layout()
    beam->addSkyline()
```

**`LayoutBeams::breakCrossMeasureBeams()`** — layoutbeams.cpp:128–195:
```
If no next measure: return
For each track:
  Find beam spanning measure boundary
  Split into mElements (current) + nextElements (next)
  If mElements.size() == 1: remove beam
  If nextElements.size() > 1: create new beam, layout1()
  If nextElements.size() == 1: remove beam
```

**`LayoutBeams::beamGraceNotes()`** — layoutbeams.cpp:208–275:
```
For each grace chord:
  If duration <= quarter || beamMode == NONE: finalize beam; continue
  If in beam && beamMode == BEGIN: finalize; start new
  If in beam: add to beam; if END: finalize
  If a1 == null: a1 = chord
  Else: create/get beam; add chord
```

**`LayoutBeams::layoutNonCrossBeams()`** — layoutbeams.cpp:481–506:
```
For each element in segment:
  If isTopBeam(element): element->beam()->layout()
  If chord: also layout grace note beams
```

**Helper functions:**
- `isTopBeam(cr)` — layoutbeams.cpp:47: true if cr is first in non-cross-staff beam
- `notTopBeam(cr)` — layoutbeams.cpp:78: true if cr is first in cross-staff beam
- `beamNoContinue(mode)` — layoutbeams.cpp:197: true if END, NONE, or INVALID

### 8.13 Constants & Arrays Summary

| Constant | Value | Source |
|----------|-------|--------|
| `_maxSlopes` | `{0,1,2,3,4,5,6,7}` | beam.h:238 |
| `_beamSpacing` (normal) | 3 | beam.cpp:1455 |
| `_beamSpacing` (wide) | 4 | beam.cpp:1455 |
| `_beamDist` (default) | 0.75sp × mag | beam.cpp:1456 |
| `_beamWidth` (default) | 0.5sp × mag | Sid::beamWidth |
| `graceNoteMag` | 0.7 | Sid::graceNoteMag |
| `minStemLengths[]` | `{11,13,15,18,21,24,27,30}` | beam.cpp:1192 |
| `BEAM_TUPLET_TOLERANCE` | 6 | beam.cpp:934 |
| `getMaxSlope` thresholds | `<3→1, <5→2, <7.5→3, <10→4, <15→5, <20→6, ≥20→7` | beam.cpp:624–637 |
| `add8thSpaceSlant` Y | ±0.125sp | beam.cpp:1429 |
| `add8thSpaceSlant` dist | +0.0625sp | beam.cpp:1430 |
| Collision tolerance | `_beamWidth * 0.25` | beam.cpp:1117 |
| Collision reduction (slope≤3) | 0.25sp | beam.cpp:1143 |
| Collision reduction (slope≤6) | 0.5sp | beam.cpp:1145 |
| Collision reduction (slope>6) | 0.75sp | beam.cpp:1147 |

### 8.14 Additional Beam Functions & Constants

**Beam management (beam.cpp):**
- **`Beam::addChordRest(cr)`** (beam.cpp:186) — Adds a ChordRest to the beam group. Updates beam's tick range.
- **`Beam::removeChordRest(cr)`** (beam.cpp:213) — Removes a ChordRest from the beam group.
- **`Beam::findChordWithCustomStemDirection()`** (beam.cpp:221) — Scans beam elements for any chord with explicit (non-auto) stem direction. Used to override beam direction heuristics.
- **`Beam::getBeamCount(cr)`** (beam.cpp:643) — Returns number of beam lines for a given ChordRest based on duration (8th=1, 16th=2, etc.).
- **`Beam::setBeamDirection(Direction d)`** (beam.cpp:2009) — Sets manual beam direction (AUTO/UP/DOWN) and triggers relayout of all beam segments.
- **`Beam::setBeamPos(pos)`** (beam.cpp:2147) — Manual beam position override from inspector/editing. Sets `_userModified=true`.
- **`Beam::actionIconTypeForBeamMode(mode)`** (beam.cpp:2354) — Returns toolbar icon type for a given BeamMode.
- **`Beam::initBeamEditData(ed)`** (beam.cpp:2415) — Initializes edit data for beam grip dragging: stores original beam position as undo reference.
- **`setIsGrace()`** (beam.h:214) — Inline setter for grace-note beam flag, affects `graceNoteMag` scaling.

**Beam constants:**
- `isFirstSubgroup` (beam.cpp:734) — `startCr == _elements.front()`, true for first subgroup in a beam.
- `isLastSubgroup` (beam.cpp:735) — `endCr == _elements.back()`, true for last subgroup.
- `firstUp` / `lastUp` (beam.cpp:736-737) — Stem directions of first/last subgroup chords, used for slope calculation.
- `quarterSpace = spatium() / 4` (beam.cpp:1485, 1517, 1597) — Quarter-spatium unit for fine beam positioning adjustments.
- `isStartDictator` (beam.cpp:1516) — In dictator/pointer system: `_up ? startNote < endNote : startNote > endNote`. Determines which end constrains beam position.

**Header guard:** `__BEAM_H__` (beam.h:24).

**layoutbeams.cpp constant:**
- `nextBeamed = bool(newBeam)` (layoutbeams.cpp:183) — Flag indicating whether the next ChordRest continues into a new beam group.

---

## פרק 9: Page Layout & System Stacking

> קבצים: `layout/layoutpage.cpp` (709 שורות), `libmscore/system.cpp` (2,147 שורות), `layout/verticalgapdata.cpp` (251 שורות)

### 9.1 `LayoutPage::getNextPage()`
**file:** `layoutpage.cpp:60`

```
void getNextPage(options, lc):
  if !lc.page || lc.curPage >= score.npages():
    // Create new page:
    lc.page = Factory::createPage(score.rootItem())
    score.pages().push_back(lc.page)
    lc.prevSystem = null
    lc.pageOldMeasure = null
  else:
    // Reuse existing page:
    lc.page = score.pages()[lc.curPage]
    systems = lc.page.systems()
    lc.pageOldMeasure = systems.empty() ? null : systems.back().measures().back()

    i = indexOf(systems, lc.curSystem)
    if i < systems.size() && i > 0 && systems[i-1].page() == lc.page:
      // Current+previous on same page → erase from current onwards
      systems.erase(systems.begin()+i, systems.end())
    else:
      systems.clear()

    lc.prevSystem = systems.empty() ? null : systems.back()

  lc.page.bbox = Rect(0, 0, options.loWidth, options.loHeight)     // layoutpage.cpp:82
  lc.page.setNo(lc.curPage)

  // Page position (for multi-page display):
  x = y = 0.0
  if lc.curPage:                                                    // layoutpage.cpp:86
    prevPage = score.pages()[lc.curPage - 1]
    if MScore::verticalOrientation():
      y = prevPage.pos.y + lc.page.height + MScore::verticalPageGap
    else:
      gap = (lc.curPage + score.pageNumberOffset()) & 1
            ? MScore::horizontalPageGapOdd : MScore::horizontalPageGapEven
      x = prevPage.pos.x + lc.page.width + gap

  ++lc.curPage                                                      // layoutpage.cpp:95
  lc.page.setPos(x, y)
```

### 9.2 `LayoutPage::collectPage()`
**file:** `layoutpage.cpp:103`

אוספת systems לדף. לולאה ראשית מוסיפה systems, בודקת page break, ואחריה post-layout (cross-staff beams, tuplets, slurs).

```
void collectPage(options, ctx):
  CONSTANTS:                                                        // layoutpage.cpp:107-113
    slb = styleMM(Sid::staffLowerBorder)            // = 7sp
    breakPages = (layoutMode != SYSTEM)
    footerExtension = page.footerExtension()
    headerExtension = page.headerExtension()
    headerFooterPadding = styleMM(Sid::staffHeaderFooterPadding)
    endY = page.height - page.bm()                  // bottom margin

  y = 0.0
  nextSystem = null
  systemIdx = -1

  // ── Phase 1: Re-layout previously placed systems ──
  pSystems = page.systems().size()                                  // layoutpage.cpp:120
  if pSystems > 0:
    page.system(0).restoreLayout2()
    y = page.system(0).y() + page.system(0).height()
  else:
    y = page.tm()                                    // top margin

  for i = 1..pSystems:                                              // layoutpage.cpp:127
    cs = page.system(i); ps = page.system(i-1)
    distance = ps.minDistance(cs)
    y += distance
    cs.setPos(page.lm(), y)
    cs.restoreLayout2()
    y += cs.height()

  // ── Phase 2: Main loop — add new systems ──
  for k = 0.. (infinite):                                           // layoutpage.cpp:137
    // Compute distance to previous system:
    if ctx.prevSystem:
      distance = ctx.prevSystem.minDistance(ctx.curSystem)           // uses Skyline
    else:
      // First system on page
      if ctx.curSystem.vbox():
        distance = headerExtension ? headerExtension + headerFooterPadding : 0.0
      else:
        distance = styleMM(Sid::staffUpperBorder)    // = 7sp        // layoutpage.cpp:151
        fixedDistance = false
        for mb in curSystem.measures():                              // layoutpage.cpp:153
          if mb.isMeasure():
            sp = m.vspacerUp(0)
            if sp:
              if sp.spacerType() == FIXED:
                distance = sp.gap(); fixedDistance = true; break
              else:
                distance = max(distance, sp.gap().val())

        if !fixedDistance:                                            // layoutpage.cpp:168
          top = curSystem.minTop()
          if headerExtension > 0.0:
            top += headerExtension + headerFooterPadding
          distance = max(distance, top)

    y += distance
    ctx.curSystem.setPos(page.lm(), y)
    ctx.curSystem.restoreLayout2()
    page.appendSystem(ctx.curSystem)
    y += ctx.curSystem.height()

    // ── Collect next system ──
    collected = false                                                // layoutpage.cpp:188
    if ctx.rangeDone:
      if systemIdx > 0:
        nextSystem = score.systems()[systemIdx++]                    // layoutpage.cpp:192
      else:
        nextSystem = ctx.systemList.empty() ? null : takeFirst(ctx.systemList)
        if nextSystem: score.systems().push_back(nextSystem)
    else:
      nextSystem = LayoutSystem::collectSystem(options, ctx, score)  // layoutpage.cpp:203
      if nextSystem: collected = true

    ctx.prevSystem = ctx.curSystem
    ctx.curSystem = nextSystem

    // ── Check page break ──
    breakPage = !ctx.curSystem || (breakPages && ctx.prevSystem.pageBreak())

    if !breakPage:                                                   // layoutpage.cpp:214
      dist = ctx.prevSystem.minDistance(ctx.curSystem) + ctx.curSystem.height()
      vbox = ctx.curSystem.vbox()
      if vbox:
        dist += vbox.bottomGap()
        if footerExtension > 0: dist += footerExtension
      else if !ctx.prevSystem.hasFixedDownDistance():                 // layoutpage.cpp:222
        margin = max(ctx.curSystem.minBottom(), ctx.curSystem.spacerDistance(false))
        if footerExtension > 0:
          margin += footerExtension + headerFooterPadding
        dist += max(margin, slb)
      breakPage = (y + dist) >= endY && breakPages                   // layoutpage.cpp:230

    if breakPage:                                                    // layoutpage.cpp:232
      dist = max(ctx.prevSystem.minBottom(), ctx.prevSystem.spacerDistance(false))
      footerPadding = 0.0
      if footerExtension > 0:
        footerPadding = footerExtension + headerFooterPadding
        dist += footerPadding
      dist = max(dist, slb)
      layoutPage(ctx, page, endY - (y + dist), footerPadding)       // ← distribute space
      if collected: ctx.pageOldMeasure = null
      break

  // ── Phase 3: Post-layout — cross-staff beams, tuplets, arpeggios ──
  //    layoutpage.cpp:251-318
  for system in page.systems():
    for mb in system.measures():
      if !mb.isMeasure(): continue
      m = toMeasure(mb)
      for track in 0..score.ntracks():
        for segment in m:
          e = segment.element(track)
          if !e: continue
          if e.isChordRest():
            if !staff(track2staff(track)).show(): continue
            cr = toChordRest(e)
            if notTopBeam(cr):
              cr.beam().layout()                     // cross-staff beams
            if notTopTuplet(cr):
              // fix layout of nested tuplets (walk up chain)
              de = cr
              while de.tuplet() && de.tuplet().elements().front() == de:
                t = de.tuplet(); t.layout(); de = t
            if cr.isChord():
              c = toChord(cr)
              for gc in c.graceNotes():
                if gc.beam() && gc.beam().elements().front() == gc:
                  gc.beam().layout()
                gc.layoutSpanners()
                for el in gc.el():
                  if el.isSlur(): el.layout()
              c.layoutArpeggio2()
              c.layoutSpanners()
              if c.tremolo():                        // cross-staff tremolo
                t = c.tremolo()
                if t.twoNotes() && c1 && c2 && (c1.staffMove() || c2.staffMove()):
                  t.layout()
          else if e.isBarLine():
            toBarLine(e).layout2()
      m.layout2()

  // ── Phase 4: SYSTEM mode height adjustment ──
  if layoutMode == SYSTEM:                                           // layoutpage.cpp:320
    s = page.systems().back()
    height = s ? s.pos.y + s.height() + s.minBottom() : page.tm()
    page.bbox = Rect(0, 0, options.loWidth, height + page.bm())

  // ── Phase 5: Cross-staff slur re-layout HACK ──
  //    layoutpage.cpp:327-349
  //    "we relayout cross-staff slurs because only now staff distances are available"
  for system in page.systems():
    stick = system.firstMeasure().tick().ticks() if system.firstMeasure() else 0
    etick = system.endTick().ticks()
    if stick == 0 && etick == 0: continue
    spanners = score.spannerMap().findOverlapping(stick, etick)
    for interval in spanners:
      sp = interval.value
      if sp.isSlur() && toSlur(sp).isCrossStaff():
        toSlur(sp).layout()

  page.invalidateBspTree()                                           // layoutpage.cpp:350
```

### 9.3 `LayoutPage::layoutPage()` — Vertical Space Distribution
**file:** `layoutpage.cpp:361`

Distributes remaining vertical space (`restHeight`) evenly between systems on a page. Two-phase algorithm: first equalizes gaps, then spreads remaining space.

```
void layoutPage(ctx, page, restHeight, footerPadding):
  if restHeight < 0.0: restHeight = 0.0
  gaps = page.systems().size() - 1

  // ── Build gap list (excluding vbox and fixedDistance gaps) ──
  sList = []                                                         // layoutpage.cpp:375
  for i = 0..gaps:
    s1 = page.systems[i]; s2 = page.systems[i+1]
    s1.setDistance(s2.y - s1.y)
    if s1.vbox() || s2.vbox() || s1.hasFixedDownDistance():
      if s2.vbox(): remove dividers from s1 and s2
      continue
    sList.push(s1)

  // Remove dividers from last system
  checkDivider(ctx, left=true, lastSystem, 0, remove=true)
  checkDivider(ctx, left=false, lastSystem, 0, remove=true)

  // ── Early return conditions ──
  if sList.empty() || noVerticalStretch || enableVerticalSpread || SYSTEM mode:
    if FLOAT mode: shift all systems down by restHeight * 0.5       // layoutpage.cpp:398
    if enableVerticalSpread: distributeStaves(ctx, page, footerPadding)
    // add system dividers at midpoints
    return

  maxDist = score.maxSystemDistance()                                // layoutpage.cpp:419

  // ── Phase 1: Equalize system-to-system gaps ──
  //    Sort by gap size (system-to-system distance minus system height)
  sort sList by (distance - height) ascending                        // layoutpage.cpp:422
  s0 = sList[0]
  dist = s0.distance - s0.height                     // smallest gap

  for i = 1..sList.size():                                           // layoutpage.cpp:425
    si = sList[i]
    ndist = si.distance - si.height                   // next larger gap
    fill = ndist - dist                               // difference
    if fill > 0.0:
      totalFill = fill * i                            // space needed for all shorter
      if totalFill > restHeight:
        totalFill = restHeight
        fill = restHeight / i
      for k = 0..i:
        s = sList[k]
        d = s.distance + fill
        if (d - s.height) > maxDist:                  // clamp to maxSystemDistance
          d = max(maxDist + s.height, s.distance)
        s.setDistance(d)
      restHeight -= totalFill
      if restHeight <= 0: break
    dist = ndist

  // ── Phase 2: Distribute any remaining space equally ──
  if restHeight > 0.0:                                               // layoutpage.cpp:451
    fill = restHeight / sList.size()
    for s in sList:
      d = s.distance + fill
      if (d - s.height) > maxDist:
        d = max(maxDist + s.height, s.distance)
      s.setDistance(d)

  // ── Apply new positions ──
  y = page.systems[0].y()                                            // layoutpage.cpp:462
  for i = 0..gaps:
    s1 = page.systems[i]; s2 = page.systems[i+1]
    s1.setPosY(y)
    y += s1.distance
    if !(s1.vbox() || s2.vbox()):
      yOffset = s1.height + (s1.distance - s1.height) * 0.5
      checkDivider(ctx, true, s1, yOffset)
      checkDivider(ctx, false, s1, yOffset)
  page.systems.back().setPosY(y)
```

### 9.4 `LayoutPage::checkDivider()`
**file:** `layoutpage.cpp:478`

```
void checkDivider(ctx, left, system, yOffset, remove=false):
  divider = left ? s.systemDividerLeft() : s.systemDividerRight()
  sid = left ? Sid::dividerLeft : Sid::dividerRight
  if score.styleB(sid) && !remove:
    if !divider:
      divider = new SystemDivider(s)
      divider.setDividerType(left ? LEFT : RIGHT)
      divider.setGenerated(true)
      s.add(divider)
    divider.layout()
    divider.setPosY(divider.height * 0.5 + yOffset)
    if left:
      divider.movePosY(styleD(Sid::dividerLeftY) * SPATIUM20)       // layoutpage.cpp:491
      divider.setPosX(styleD(Sid::dividerLeftX) * SPATIUM20)
    else:
      divider.movePosY(styleD(Sid::dividerRightY) * SPATIUM20)
      divider.setPosX(styleD(Sid::pagePrintableWidth) * DPI - divider.width())
      divider.movePosX(styleD(Sid::dividerRightX) * SPATIUM20)
  else if divider:
    if divider.generated(): s.remove(divider); delete divider
    else: score.undoRemoveElement(divider)
```

### 9.5 `LayoutPage::distributeStaves()` — VerticalGapData-based Distribution
**file:** `layoutpage.cpp:508`

Advanced algorithm used when `enableVerticalSpread` is on. Uses `VerticalGapData` objects to classify and fill gaps with stretch factors.

```
void distributeStaves(ctx, page, footerPadding):
  vgdl = VerticalGapDataList()
  ngaps = 0; prevYBottom = page.tm()

  // ── Build gap data for every staff in every system ──
  for system in page.systems():                                      // layoutpage.cpp:522
    if system.vbox():
      vgd = new VerticalGapData(style, !ngaps++, system, null, null, null, prevYBottom)
      vgd.addSpaceAroundVBox(above=true)
      prevYBottom = system.y; yBottom = system.y + system.height
      vbox = true; vgdl.push(vgd)
    else:
      newSystem = true
      endNormalBracket = endCurlyBracket = -1
      for sysStaff in system.staves():                               // layoutpage.cpp:539
        staff = score.staff(++staffNr)
        // Track bracket boundaries for spacing factors
        addSpaceAroundNormalBracket |= (endNormalBracket == staffNr)
        addSpaceAroundCurlyBracket |= (endCurlyBracket == staffNr)
        for bi in staff.brackets():
          if NORMAL: endNormalBracket = max(endNormalBracket, idx + span)
          if BRACE: endCurlyBracket = max(endCurlyBracket, idx + span)

        if !sysStaff.show(): continue

        vgd = new VerticalGapData(style, !ngaps++, system, staff, sysStaff, nextSpacer, prevYBottom)
        nextSpacer = system.downSpacer(staff.idx)

        if newSystem: vgd.addSpaceBetweenSections(); newSystem = false
        if addSpaceAroundNormalBracket: vgd.addSpaceAroundNormalBracket()
        if addSpaceAroundCurlyBracket: vgd.addSpaceAroundCurlyBracket()
        else if staffNr < endCurlyBracket: vgd.insideCurlyBracket()
        if vbox: vgd.addSpaceAroundVBox(false); vbox = false

        prevYBottom = system.y + sysStaff.y + sysStaff.bbox.height
        yBottom = system.y + sysStaff.y + sysStaff.skyline.south.max()
        spacerOffset = sysStaff.skyline.south.max() - sysStaff.bbox.height
        vgdl.push(vgd)

  --ngaps
  staffLowerBorder = styleMM(Sid::staffLowerBorder)
  combinedBottomMargin = page.bm + footerPadding
  marginToStaff = page.bm + staffLowerBorder
  spaceRemaining = min(page.height - combinedBottomMargin - yBottom,
                       page.height - marginToStaff - prevYBottom)    // layoutpage.cpp:599

  if nextSpacer:
    spaceRemaining -= max(0, nextSpacer.gap() - spacerOffset - staffLowerBorder)
  if spaceRemaining <= 0: return

  // ── Phase 1: Equalize normalised spacings (max 20 passes) ──
  maxPasses = 20                                                     // layoutpage.cpp:609
  pass = 0
  while !RealIsNull(spaceRemaining) && ngaps > 0 && ++pass < maxPasses:
    ngaps = 0
    smallest = vgdl.smallest()
    nextSmallest = vgdl.smallest(smallest)                           // next above smallest
    if RealIsNull(smallest) || RealIsNull(nextSmallest): break

    if (nextSmallest - smallest) * vgdl.sumStretchFactor() > spaceRemaining:
      nextSmallest = smallest + spaceRemaining / vgdl.sumStretchFactor()

    addedSpace = 0.0
    modified = []
    for vgd in vgdl:
      if !RealIsNull(vgd.spacing - smallest): continue
      step = nextSmallest - vgd.spacing
      if step < 0: continue
      step = vgd.addSpacing(step)                    // may be clamped by maxActualSpacing
      if !RealIsNull(step):
        addedSpace += step * vgd.factor()
        modified.push(vgd); ++ngaps
      if spaceRemaining - addedSpace <= 0: break

    if spaceRemaining - addedSpace <= 0:
      for vgd in modified: vgd.undoLastAddSpacing()  // undo overshoot
      ngaps = 0
    else:
      spaceRemaining -= addedSpace

  // ── Phase 2: Fill remaining space (capped by maxPageFillSpread) ──
  maxPageFill = styleMM(Sid::maxPageFillSpread)                      // layoutpage.cpp:655
  spaceRemaining = min(maxPageFill * vgdl.size(), spaceRemaining)
  pass = 0; ngaps = 1
  while !RealIsNull(spaceRemaining) && !RealIsNull(maxPageFill) && ngaps > 0 && ++pass < maxPasses:
    ngaps = 0
    addedSpace = 0.0
    step = spaceRemaining / vgdl.sumStretchFactor()
    for vgd in vgdl:
      res = vgd.addFillSpacing(step, maxPageFill)
      if !RealIsNull(res): addedSpace += res * vgd.factor(); ++ngaps
    spaceRemaining -= addedSpace

  // ── Phase 3: Apply positions ──                                  // layoutpage.cpp:673
  systemShift = staffShift = 0.0
  prvSystem = null
  for vgd in vgdl:
    systemShift += vgd.actualAddedSpace()
    if prvSystem == vgd.system:
      staffShift += vgd.actualAddedSpace()
    else:
      vgd.system.movePosY(systemShift)
      if prvSystem:
        prvSystem.setDistance(vgd.system.y - prvSystem.y)
        prvSystem.setHeight(prvSystem.height + staffShift)
      staffShift = 0.0
    if vgd.sysStaff: vgd.sysStaff.bbox.translate(0, staffShift)
    prvSystem = vgd.system
  if prvSystem: prvSystem.setHeight(prvSystem.height + staffShift)

  for system in systems:                                             // layoutpage.cpp:703
    system.setMeasureHeight(system.height)
    system.layoutBracketsVertical()
    system.layoutInstrumentNames()
  vgdl.deleteAll()
```

### 9.6 `System::layout2()` — Vertical Staff Positioning Within System
**file:** `system.cpp:884`

Positions staves vertically within a system, computing inter-staff distances based on Skyline collision detection.

```
void System::layout2(ctx):
  if vbox(): vbox.layout(); setbbox(vbox.bbox); return              // system.cpp:887

  setPos(0, 0)
  visibleStaves = [(idx, sysStaff) for each staff if show && sysStaff.show]

  _spatium = spatium()                                               // system.cpp:906
  y = 0.0
  minVerticalDistance = styleMM(Sid::minVerticalDistance)
  staffDistance = styleMM(Sid::staffDistance)                         // = 6.5sp (same instrument)
  akkoladeDistance = styleMM(Sid::akkoladeDistance)                   // = 6.5sp (bracketed)
  if enableVerticalSpread:
    staffDistance = styleMM(Sid::minStaffSpread)
    akkoladeDistance = styleMM(Sid::minStaffSpread)

  for each (si1, ss) in visibleStaves:                               // system.cpp:920
    staff = score.staff(si1)
    ni = next(i)

    dist = staff.height()
    // 1-line staff handling:
    if staff.lines(0) == 1:
      yOffset = _spatium * BARLINE_SPAN_1LINESTAFF_TO * 0.5
      h = _spatium * (BARLINE_SPAN_1LINESTAFF_TO - BARLINE_SPAN_1LINESTAFF_FROM) * 0.5
    else:
      yOffset = 0.0; h = staff.height()

    if ni == end:   // last visible staff
      ss.setYOff(yOffset)
      ss.bbox = Rect(_leftMargin, y - yOffset, width - _leftMargin, h)
      ss.saveLayout()
      break

    si2 = ni.first; staff2 = score.staff(si2)

    // Same part → akkoladeDistance; different part → staffDistance
    if staff.part() == staff2.part():                                // system.cpp:946
      mag = m ? staff.staffMag(m.tick()) : 1.0
      dist += akkoladeDistance * mag
    else:
      dist += staffDistance
    dist += staff2.userDist()

    // Check spacers (down on current staff, up on next staff)
    fixedSpace = false
    for mb in ml:                                                    // system.cpp:955
      if !mb.isMeasure(): continue
      m = toMeasure(mb)
      sp = m.vspacerDown(si1)
      if sp:
        if FIXED: dist = staff.height + sp.gap(); fixedSpace = true; break
        else: dist = max(dist, staff.height + sp.gap())
      sp = m.vspacerUp(si2)
      if sp: dist = max(dist, sp.gap + staff.height)

    if !fixedSpace:                                                  // system.cpp:975
      // Skyline collision detection: south of current ↔ north of next
      d = ss.skyline.minDistance(System.staff(si2).skyline)
      if lineMode:
        previousDist = ss.continuousDist()
        if d > previousDist: ss.setContinuousDist(d)
        else: d = previousDist
      dist = max(dist, d + minVerticalDistance)

    ss.setYOff(yOffset)
    ss.bbox = Rect(_leftMargin, y - yOffset, width - _leftMargin, h)
    ss.saveLayout()
    y += dist

  _systemHeight = staff(visibleStaves.back.first).bbox.bottom()     // system.cpp:1002
  setHeight(_systemHeight)
  setMeasureHeight(_systemHeight)
  layoutBracketsVertical()
  layoutInstrumentNames()

  // Cross-staff slurs/ties:                                         // system.cpp:1023
  stick = measures.front.tick; etick = measures.back.endTick
  for sp in spannerMap.findOverlapping(stick, etick):
    if sp.isSlur():
      scr = sp.startCR(); ecr = sp.endCR(); idx = sp.vStaffIdx()
      if scr && ecr && (scr.vStaffIdx() != idx || ecr.vStaffIdx() != idx):
        sp.layoutSystem(this)
```

### 9.7 `System::restoreLayout2()`
**file:** `system.cpp:1047`

```
void System::restoreLayout2():
  if vbox(): return
  for s in _staves: s.restoreLayout()
  setHeight(_systemHeight)
  setMeasureHeight(_systemHeight)
```

### 9.8 `System::minDistance()` — System-to-System Minimum Distance
**file:** `system.cpp:1597`

Used by `collectPage()` to compute inter-system spacing. Uses Skyline collision detection for non-fixed distances.

```
double System::minDistance(s2):
  // ── VBox cases ──
  if vbox() && !s2.vbox(): return max(vbox.bottomGap, s2.minTop())
  if !vbox() && s2.vbox(): return max(s2.vbox.topGap, minBottom())
  if vbox() && s2.vbox():  return s2.vbox.topGap + vbox.bottomGap

  if _staves.empty() || s2.staves.empty(): return 0.0

  minVerticalDistance = styleMM(Sid::minVerticalDistance)
  dist = enableVerticalSpread ? styleP(Sid::minSystemSpread)
                              : styleP(Sid::minSystemDistance)       // = 8.5sp

  // Find first/last visible staves
  firstStaff = first i where staff(i).show && s2.staff(i).show      // system.cpp:1616
  lastStaff = last i where staff(i).show && staff(i).show

  userDist = score.staff(firstStaff).userDist()
  dist = max(dist, userDist)
  fixedDownDistance = false                                          // mutable member, system.h:107

  // Check down spacers on this system (last staff)
  for mb in ml:                                                      // system.cpp:1632
    if mb.isMeasure():
      sp = m.vspacerDown(lastStaff)
      if sp:
        if FIXED: dist = sp.gap(); fixedDownDistance = true; break
        else: dist = max(dist, sp.gap().val())

  if !fixedDownDistance:
    // Check up spacers on next system (first staff)
    for mb in s2.ml:                                                 // system.cpp:1648
      if mb.isMeasure():
        sp = m.vspacerUp(firstStaff)
        if sp: dist = max(dist, sp.gap().val())

    // Skyline collision: south of this ↔ north of s2
    sysStaff = this.staff(lastStaff)
    sld = sysStaff ? sysStaff.skyline.minDistance(s2.staff(firstStaff).skyline) : 0
    sld -= sysStaff ? sysStaff.bbox.height - minVerticalDistance : 0 // system.cpp:1660
    dist = max(dist, sld)

  return dist
```

### 9.9 `System::minTop()` / `System::minBottom()` / `System::spacerDistance()`
**file:** `system.cpp:1735, 1750, 1768`

```
double System::minTop():                                             // system.cpp:1735
  si = firstVisibleSysStaff()
  s = (si == nidx) ? null : staff(si)
  return s ? -s.skyline.north.max() : 0.0
  // north.max() returns most negative y → negate for positive distance

double System::minBottom():                                          // system.cpp:1750
  if vbox(): return vbox.bottomGap()
  si = lastVisibleSysStaff()
  s = (si == nidx) ? null : staff(si)
  return s ? s.skyline.south.max() - s.bbox.height : 0.0
  // south.max() = furthest below staff → subtract staff height for overhang

double System::spacerDistance(up):                                   // system.cpp:1768
  staff = up ? firstVisibleSysStaff() : lastVisibleSysStaff()
  if staff == nidx: return 0.0
  dist = 0.0
  for mb in measures():
    if mb.isMeasure():
      sp = up ? m.vspacerUp(staff) : m.vspacerDown(staff)
      if sp:
        if FIXED: dist = sp.gap(); break
        else: dist = max(dist, sp.gap().val())
  return dist
```

### 9.10 `VerticalGapData` — Gap Classification for distributeStaves
**file:** `verticalgapdata.cpp:34`, header: `verticalgapdata.h:39`

```
class VerticalGapData:
  // Fields (verticalgapdata.h:42-49):
  _fixedHeight           : bool   = false       // first gap on page → fixed to staffUpperBorder
  _fixedSpacer           : bool   = false       // FIXED spacer type → cannot stretch
  _factor                : double = 1.0         // stretch factor (context-dependent)
  _normalisedSpacing     : double = 0.0         // normalised gap value
  _maxActualSpacing      : double = 0.0         // ceiling for this gap
  _addedNormalisedSpace  : double = 0.0         // accumulated space added
  _fillSpacing           : double = 0.0         // accumulated fill space
  _lastStep              : double = 0.0         // for undo

Constructor(style, first, sys, staff, sysStaff, nextSpacer, y):     // verticalgapdata.cpp:34
  if first:
    _normalisedSpacing = styleMM(Sid::staffUpperBorder)
    _maxActualSpacing = _normalisedSpacing
    _fixedHeight = true
  else:
    _normalisedSpacing = system.y + (sysStaff ? sysStaff.bbox.y : 0) - y
    _maxActualSpacing = styleMM(Sid::maxStaffSpread)
    spacer = staff ? system.upSpacer(staff.idx, nextSpacer) : null
    if spacer:
      _fixedSpacer = (spacer.spacerType == FIXED)
      _normalisedSpacing = max(_normalisedSpacing, spacer.gap().val())
      if _fixedSpacer: _maxActualSpacing = _normalisedSpacing

updateFactor(factor):                                                // verticalgapdata.cpp:60
  if _fixedHeight: return
  f = max(factor, _factor)
  _normalisedSpacing *= _factor / f                 // rescale existing spacing
  _factor = f

addSpaceBetweenSections():                                           // verticalgapdata.cpp:74
  updateFactor(styleD(Sid::spreadSystem))
  if !(_fixedHeight | _fixedSpacer):
    _maxActualSpacing = styleMM(Sid::maxSystemSpread) / _factor

addSpaceAroundVBox(above):                                           // verticalgapdata.cpp:86
  _fixedHeight = true; _factor = 1.0
  _normalisedSpacing = above ? styleMM(Sid::frameSystemDistance) : styleMM(Sid::systemFrameDistance)
  _maxActualSpacing = _normalisedSpacing / _factor

addSpaceAroundNormalBracket(): updateFactor(styleD(Sid::spreadSquareBracket))
addSpaceAroundCurlyBracket(): updateFactor(styleD(Sid::spreadCurlyBracket))
insideCurlyBracket(): _maxActualSpacing = styleMM(Sid::maxAkkoladeDistance) / _factor

spacing():  return _normalisedSpacing + _addedNormalisedSpace        // verticalgapdata.cpp:136
actualAddedSpace(): return _addedNormalisedSpace * factor()          // verticalgapdata.cpp:144

addSpacing(step):                                                    // verticalgapdata.cpp:153
  if _fixedHeight | _fixedSpacer: return 0.0
  if _normalisedSpacing >= _maxActualSpacing:
    _normalisedSpacing = _maxActualSpacing; step = 0.0
  else:
    newSpacing = _normalisedSpacing + _addedNormalisedSpace + step
    if newSpacing >= _maxActualSpacing:
      step = _maxActualSpacing - _normalisedSpacing - _addedNormalisedSpace
  _addedNormalisedSpace += step; _lastStep = step
  return step

isFixedHeight(): return _fixedHeight || RealIsNull(_normalisedSpacing - _maxActualSpacing)

addFillSpacing(step, maxFill):                                       // verticalgapdata.cpp:195
  if _fixedSpacer: return 0.0
  actStep = ((step + _fillSpacing / _factor) > maxFill)
            ? (maxFill - _fillSpacing / _factor) : step
  res = addSpacing(actStep)
  _fillSpacing += res * _factor
  return res

// VerticalGapDataList helpers (verticalgapdata.cpp:210-251):
sumStretchFactor(): sum of factor() for non-fixed entries
smallest(limit): smallest spacing() above limit (using ceil comparison)
```

### 9.11 System Helper Functions

**`System::instrumentNamesWidth()`** (system.cpp:271):
```
double instrumentNamesWidth():
  namesWidth = 0.0
  for staffIdx = 0..nstaves:
    for name in staff(staffIdx).instrumentNames:
      name.layout()
      namesWidth = max(namesWidth, name.width())
  return namesWidth
```

**`System::layoutBrackets()`** (system.cpp:294):
```
double layoutBrackets(ctx):
  nstaves = _staves.size()                                           // system.cpp:296
  columns = getBracketsColumnsCount()
  bracketWidth[columns] = {0.0, ...}
  bl = swap(_brackets)                               // save old brackets
  for staffIdx = 0..nstaves:
    for i = 0..columns:
      for bi in staff(staffIdx).brackets():
        if bi.column == i && bi.bracketType != NO_BRACKET:
          b = createBracket(ctx, bi, i, staffIdx, bl, firstMeasure())
          if b: bracketWidth[i] = max(bracketWidth[i], b.width())
  delete old brackets (bl)
  return sum(bracketWidth)                           // total bracket width
```

**`System::lastChordRest(track)` / `System::firstChordRest(track)`** (system.cpp:1948, 1971):
Iterate measures backwards/forwards to find first/last ChordRest for a given track.

**`System::hasCrossStaffOrModifiedBeams()`** (system.cpp:2118):
Scans all segments for beams that are cross-staff (`beam.cross()`) or user-modified (`beam.userModified()`), including grace notes. Returns bool.

**Constant:** `nstaves = score()->nstaves()` (system.cpp:1163) — local var in `searchStaff()`, not a class constant.

---

## פרק 9B: Shape, Skyline & Autoplace

> קבצים: `libmscore/shape.cpp` (380 שורות) + `shape.h` (125 שורות), `libmscore/skyline.cpp` (374 שורות) + `skyline.h` (121 שורות), `libmscore/engravingitem.cpp` (autoplace only)
>
> Header guards: `__SHAPE_H__` (shape.h:24), `__SKYLINE_H__` (skyline.h:24). Debug flag: `SKL_DEBUG` (skyline.cpp:38) — conditional compilation for skyline debug output.

### 9B.1 Shape — Bounding Box Collection

**class:** `Shape : public std::vector<ShapeElement>` (shape.h:58)

Shape is a list of `ShapeElement` objects. Each `ShapeElement` is a `RectF` with an optional pointer to the owning `EngravingItem`.

```
struct ShapeElement : RectF                                          // shape.h:41
  toItem: const EngravingItem*    // may be null for "wall" shapes

class Shape : vector<ShapeElement>
  enum HorizontalSpacingType:                                        // shape.h:62
    SPACING_GENERAL = 0
    SPACING_LYRICS
    SPACING_HARMONY

  add(Shape s): insert all elements from s
  add(RectF r, item): push ShapeElement(r, item)
  add(RectF r): push ShapeElement(r) with null item
  remove(RectF r): find and erase first match
  remove(Shape s): remove each rect in s
```

**`addHorizontalSpacing()`** — creates "walls" (zero-height rects that collide with everything):
```
void addHorizontalSpacing(item, leftEdge, rightEdge):                // shape.cpp:44
  eps = 100 * DBL_EPSILON
  if leftEdge == rightEdge: rightEdge += eps    // HACK: zero-width → collide with all
  add(Rect(leftEdge, 0, rightEdge - leftEdge, 0), item)
```

### 9B.2 Shape — Collision Detection

**`minHorizontalDistance()`** — minimum X distance so shapes don't overlap:
```
double minHorizontalDistance(other, score):                           // shape.cpp:100
  dist = -1000000.0
  verticalClearance = 0.2 * score.spatium()                          // shape.cpp:103
  for r2 in other:                                  // other is to the RIGHT of this
    item2 = r2.toItem
    by1 = r2.top; by2 = r2.bottom
    for r1 in this:
      item1 = r1.toItem
      ay1 = r1.top; ay2 = r1.bottom
      intersection = intersects(ay1, ay2, by1, by2, verticalClearance)
      padding = 0; kerningType = NON_KERNING
      if item1 && item2:
        padding = item1.computePadding(item2)
        kerningType = item1.computeKerningType(item2)
      if (intersection && kerningType != ALLOW_COLLISION)
         || (r1.width == 0 || r2.width == 0)        // zero-width → always collide
         || (!item1 && item2 && item2.isLyrics())    // HACK: melisma lines
         || kerningType == NON_KERNING:
        dist = max(dist, r1.right - r2.left + padding)
      if kerningType == KERNING_UNTIL_ORIGIN:        // prepared for future use
        dist = max(dist, r1.left - r2.left)
  return dist
```

**Critical constant:** `verticalClearance = 0.2 * spatium()` (shape.cpp:103) — elements within 0.2sp vertical range still count as overlapping.

**`intersects()` — inline helper** (shape.h:113):
```
static bool intersects(a, b, c, d, verticalClearance):
  if a == b || c == d: return false                  // zero height → no collision
  return (b + verticalClearance > c) && (a < d + verticalClearance)
```

**`minVerticalDistance()`** — minimum Y distance between vertically adjacent shapes:
```
double minVerticalDistance(other):                                    // shape.cpp:140
  if empty() || other.empty(): return 0.0
  dist = -1000000.0
  for r2 in other:                                  // other is BELOW this
    if r2.height <= 0: continue
    bx1 = r2.left; bx2 = r2.right
    for r1 in this:
      if r1.height <= 0: continue
      ax1 = r1.left; ax2 = r1.right
      if intersects(ax1, ax2, bx1, bx2, 0.0):       // horizontal overlap
        dist = max(dist, r1.bottom - r2.top)
  return dist
```

**Other Shape methods:**
```
left():   min(r.left for r if r.height != 0 && !r.toItem.isTextBase) → negate  // shape.cpp:192
right():  max(r.right for r)                                        // shape.cpp:209
top():    min(r.top for r)                                          // shape.cpp:229
bottom(): max(r.bottom for r)                                       // shape.cpp:244

topDistance(point):    min(r.top - p.y for r if p.x in [r.left, r.right))     // shape.cpp:261
bottomDistance(point): min(p.y - r.bottom for r if p.x in [r.left, r.right))  // shape.cpp:278

contains(point):     any r.contains(p)                              // shape.cpp:316
intersects(RectF):   any r.intersects(rr)                           // shape.cpp:330
intersects(Shape):   any this.intersects(r) for r in other         // shape.cpp:344
clearsVertically(a): no overlap where min(r1.top,bot) <= max(r2.top,bot) for X-overlapping rects
```

### 9B.3 Skyline — North/South Contour

**struct:** `SkylineSegment` (skyline.h:42)
```
struct SkylineSegment:
  x: double          // segment start X
  y: double          // contour Y value
  w: double          // segment width
  staffSpan: int     // for cross-staff elements (e.g. arpeggio)
```

**class:** `SkylineLine` — a single contour (north or south) (skyline.h:56)
```
class SkylineLine:
  north: bool                    // true=north (upward), false=south (downward)
  seg: vector<SkylineSegment>    // ordered by x position
```

**class:** `Skyline` — pair of north+south contours (skyline.h:95)
```
class Skyline:
  _north: SkylineLine(true)
  _south: SkylineLine(false)

  add(Shape): add each ShapeElement
  add(ShapeElement r):                                               // skyline.cpp:60
    span = findSpan(r)           // nonzero for arpeggios (span-1)   // skyline.cpp:46
    _north.add(r.x, r.top, r.width, span)
    _south.add(r.x, r.bottom, r.width, span)
  minDistance(other): return south.minDistance(other.north)           // skyline.cpp:237
```

**`SkylineLine::add(x, y, w, span)`** — insert contour segment (skyline.cpp:137):

Complex algorithm that maintains contour segments in sorted order. Handles 6 cases (A-F) when a new rectangle overlaps existing segments:
```
void SkylineLine::add(x, y, w, span):
  if x < 0: w -= -x; x = 0; if w <= 0: return                      // skyline.cpp:140

  i = find(x)                                       // binary search  // skyline.cpp:150
  cx = seg.empty ? 0 : i.x
  for (; i != end; ++i):
    cy = i.y
    if (x + w) <= cx:       return                   // Case A: entirely before current
    if x > (cx + i.w):      cx += i.w; continue      // Case B: entirely after current
    if (north && cy <= y) || (!north && cy >= y):
      cx += i.w; continue                            // already more extreme → skip

    if x >= cx && (x+w) < (cx + i.w):               // Case E: insert inside
      w1 = x - cx; w2 = w; w3 = i.w - (w1 + w2)
      if w1 > 1e-7: i.w = w1; ++i; insert(i, x, y, w2)
      else: i.w = w2; i.y = y
      if w3 > 1e-7: ++i; insert(i, x+w2, cy, w3)
      return

    else if x <= cx && (x+w) >= (cx + i.w):         // Case F: covers entire segment
      i.y = y

    else if x < cx:                                  // Case C: overlaps left edge
      w1 = x + w - cx
      i.w -= w1
      insert(i, cx, y, w1)
      return

    else:                                            // Case D: overlaps right edge
      w1 = x - cx; w2 = i.w - w1
      if w2 > 1e-7: i.w = w1; cx += w1; ++i; insert(i, cx, y, w2)
    cx += i.w

  // Append if beyond existing segments
  if x >= cx:
    if x > cx: append(cx, north ? MAXIMUM_Y : MINIMUM_Y, x - cx)
    append(x, y, w)
  else if x + w > cx:
    append(cx, y, x + w - cx)
```

**Constants:** `MAXIMUM_Y = 1000000.0`, `MINIMUM_Y = -1000000.0` (skyline.cpp:35-36)

### 9B.4 `SkylineLine::minDistance()` — Contour-to-Contour Distance
**file:** `skyline.cpp:242`

Sweeps two contours left-to-right, computing maximum south−north difference. This is the core of all vertical collision detection.

```
double SkylineLine::minDistance(sl):                                  // skyline.cpp:242
  dist = MINIMUM_Y                                   // = -1000000.0
  x1 = x2 = 0.0
  k = sl.begin()

  for i in this.seg:
    if i.staffSpan > 0: continue                     // skip cross-staff items  // skyline.cpp:250
    while k != sl.end() && (x2 + k.w) < x1:
      x2 += k.w; ++k
    if k == sl.end(): break
    loop:
      if (x1 + i.w > x2) && (x1 < x2 + k.w) && k.staffSpan >= 0:
        dist = max(dist, i.y - k.y)                  // south.y − north.y      // skyline.cpp:263
      if x2 + k.w < x1 + i.w:
        x2 += k.w; ++k
        if k == sl.end(): break
      else: break
    if k == sl.end(): break
    x1 += i.w
  return dist
```

### 9B.5 `SkylineLine::max()` — Extreme Contour Value
**file:** `skyline.cpp:358`

```
double SkylineLine::max():
  if north:
    val = MAXIMUM_Y                                                  // skyline.cpp:361
    for s in seg: val = min(val, s.y)                // most negative = highest point
  else:
    val = MINIMUM_Y
    for s in seg: val = max(val, s.y)                // most positive = lowest point
  return val
```

**Usage in System:**
- `minTop()` = `-staff(first).skyline.north.max()` — how far above staff the north contour reaches
- `minBottom()` = `staff(last).skyline.south.max() - staff(last).bbox.height` — how far below staff bottom

### 9B.6 Autoplace — `autoplaceSegmentElement()`
**file:** `engravingitem.cpp:2504`

Positions elements (dynamics, articulations, etc.) to avoid Skyline collisions. Used for elements attached to a Segment.

```
void autoplaceSegmentElement(above, add):                            // engravingitem.cpp:2504
  // Rebase offset on drag:
  rebase = 0.0
  if offsetChanged != NONE:
    rebase = rebaseOffset()                          // engravingitem.cpp:2400

  if !autoplace() || !explicitParent(): setOffsetChanged(false); return

  s = toSegment(explicitParent())
  m = s.measure()
  sp = score.spatium()
  si = staffIdxOrNextVisible()

  _skipDraw = (si == nidx)                           // no visible staff → hide
  setSelectable(!_skipDraw)
  if _skipDraw: return

  mag = staff.staffMag(this)
  sp *= mag
  minDistance = _minDistance.val() * sp               // engravingitem.cpp:2528

  ss = m.system().staff(si)
  r = bbox.translated(m.pos + s.pos + pos)           // absolute rect

  // StaffType Y offset adjustment:
  if staffType():
    stYOffset = staffType.yoffset().val() * sp
    r.translate(0, stYOffset)

  // ── Create temporary skyline and compute distance ──
  sk = SkylineLine(!above)                           // opposite direction
  if above:
    sk.add(r.x, r.bottom, r.width)                  // engravingitem.cpp:2542
    d = sk.minDistance(ss.skyline.north())
  else:
    sk.add(r.x, r.top, r.width)
    d = ss.skyline.south().minDistance(sk)

  // ── Apply offset if collision detected ──
  if d > -minDistance:                               // engravingitem.cpp:2549
    yd = d + minDistance
    if above: yd *= -1.0                             // move upward
    if offsetChanged != NONE:
      // Handle user drag within skyline
      inStaff = above ? r.bottom + rebase > 0 : r.top + rebase < staff.height
      if rebaseMinDistance(minDistance, yd, sp, rebase, above, inStaff):
        r.translate(0, rebase)
    movePosY(yd)
    r.translate(0, yd)

  // ── Add to skyline (prevents future collisions) ──
  if add && addToSkyline():
    ss.skyline.add(r)                                // engravingitem.cpp:2566

  setOffsetChanged(false)
```

### 9B.7 Autoplace — `autoplaceMeasureElement()`
**file:** `engravingitem.cpp:2576`

Same algorithm as `autoplaceSegmentElement()` but for elements attached to a Measure (not Segment). Key difference: uses `shape()` instead of `bbox()` for tuplets.

```
void autoplaceMeasureElement(above, add):                            // engravingitem.cpp:2576
  // Same rebase logic as segment version
  rebase = 0.0
  if offsetChanged != NONE: rebase = rebaseOffset()

  if !autoplace() || !explicitParent(): setOffsetChanged(false); return

  m = toMeasure(explicitParent())
  si = staffIdxOrNextVisible()
  _skipDraw = (si == nidx); setSelectable(!_skipDraw)
  if _skipDraw: return

  sp = score.spatium()
  minDistance = _minDistance.val() * sp

  ss = m.system().staff(si)
  sh = shape().translated(m.pos + pos)               // ← shape, not bbox   // engravingitem.cpp:2600

  sk = SkylineLine(!above)
  if above:
    sk.add(sh)                                       // adds full shape, not just rect
    d = sk.minDistance(ss.skyline.north())
  else:
    sk.add(sh)
    d = ss.skyline.south().minDistance(sk)

  if d > -minDistance:                                                // engravingitem.cpp:2611
    yd = d + minDistance
    if above: yd *= -1.0
    if offsetChanged != NONE:
      inStaff = above ? sh.bottom + rebase > 0 : sh.top + rebase < staff.height
      if rebaseMinDistance(minDistance, yd, sp, rebase, above, inStaff):
        sh.translateY(rebase)
    movePosY(yd)
    sh.translateY(yd)

  if add && addToSkyline():
    ss.skyline.add(sh)                                                // engravingitem.cpp:2628

  setOffsetChanged(false)
```

### 9B.8 Autoplace — `rebaseMinDistance()`
**file:** `engravingitem.cpp:2458`

Called during drag operations to adjust `minDistance` property and offset based on user movement direction.

```
bool rebaseMinDistance(md, yd, sp, rebase, above, fix):              // engravingitem.cpp:2458
  rc = false
  pf = propertyFlags(Pid::MIN_DISTANCE)
  if pf == STYLED: pf = UNSTYLED
  adjustedY = pos.y + yd
  diff = _changedPos.y - adjustedY

  if fix:                                            // element forced into staff
    undoChangeProperty(MIN_DISTANCE, -999.0, pf)     // disable minDistance
    yd = 0.0
  else if !isStyled(MIN_DISTANCE):                   // user already set minDistance
    md = (above ? md + yd : md - yd) / sp
    undoChangeProperty(MIN_DISTANCE, md, pf)
    yd += diff
  else:                                              // minDistance still styled
    if RELATIVE_OFFSET:
      if (above && diff > 0) || (!above && diff < 0):
        // moving into skyline → rebase
        p = offset; p.ry += rebase
        undoChangeProperty(OFFSET, p)
        md = (above ? md - diff : md + diff) / sp
        undoChangeProperty(MIN_DISTANCE, md, pf)
        rc = true; yd = 0.0
    else:  // ABSOLUTE (drag)
      md = (above ? md + yd : md - yd) / sp
      undoChangeProperty(MIN_DISTANCE, md, pf)
      yd = 0.0
  return rc
```

---

## פרק 10: Style System — Sid Complete Registry (Layout-relevant)

> קובץ: `src/engraving/style/styledef.cpp`
> Spatium: `Spatium(x)` = x staff-spaces (sp). Converted to pixels: `sp * spatium_pixels`
> DPI: default 360dpi. spatium_pixels = 24.8 at default.

### 10.1 All Layout-Relevant Sid Values (Complete)
```
// PAGE
Sid::spatium                         = 24.8           [raw pixels at default DPI]
Sid::pageWidth                       = 210/25.4        [inches, A4]
Sid::pageHeight                      = 297/25.4        [inches, A4]
Sid::pagePrintableWidth              = 180/25.4        [inches, A4 minus margins]
Sid::pageOddTopMargin                = 15/25.4         [inches]
Sid::pageOddBottomMargin             = 15/25.4
Sid::pageOddLeftMargin               = 15/25.4
Sid::pageEvenTopMargin               = 15/25.4
Sid::pageEvenBottomMargin            = 15/25.4
Sid::pageEvenLeftMargin              = 15/25.4

// STAVES & SYSTEMS
Sid::staffUpperBorder                = Spatium(7.0)
Sid::staffLowerBorder                = Spatium(7.0)
Sid::staffDistance                   = Spatium(6.5)    // same-instrument staves
Sid::akkoladeDistance                = Spatium(6.5)    // bracketed staves
Sid::minSystemDistance               = Spatium(8.5)
Sid::maxSystemDistance               = Spatium(15.0)
Sid::hideEmptyStaves                 = false
Sid::dontHideStavesInFirstSystem     = true
Sid::enableIndentationOnFirstSystem  = true
Sid::firstSystemIndentationValue     = Spatium(5.0)    // first system indent width

// HORIZONTAL SPACING
Sid::minNoteDistance                 = Spatium(0.5)
Sid::barNoteDistance                 = Spatium(1.3)
Sid::barAccidentalDistance           = Spatium(0.65)
Sid::noteBarDistance                 = Spatium(1.5)
Sid::measureSpacing                  = 1.5             // slope for duration stretch formula
Sid::minMeasureWidth                 = Spatium(8.0)
Sid::minMMRestWidth                  = Spatium(4.0)
Sid::lastSystemFillLimit             = 0.3

// SYSTEM HEADER
Sid::systemHeaderDistance            = Spatium(2.5)
Sid::systemHeaderTimeSigDistance     = Spatium(2.0)
Sid::systemTrailerRightMargin        = Spatium(0.5)
Sid::clefKeyDistance                 = Spatium(1.0)
Sid::clefTimesigDistance             = Spatium(1.0)
Sid::keyTimesigDistance              = Spatium(1.0)
Sid::keyBarlineDistance              = Spatium(1.0)
Sid::clefBarlineDistance             = Spatium(0.5)
Sid::clefKeyRightMargin              = Spatium(0.8)
Sid::HeaderToLineStartDistance       = Spatium(1.0)    // min tie length at system start

// BARLINES
Sid::barWidth                        = Spatium(0.18)
Sid::doubleBarWidth                  = Spatium(0.18)
Sid::endBarWidth                     = Spatium(0.55)
Sid::doubleBarDistance               = Spatium(0.37)
Sid::endBarDistance                  = Spatium(0.37)
Sid::repeatBarlineDotSeparation      = Spatium(0.37)   // dot-to-line distance in repeat

// STEMS
Sid::stemWidth                       = Spatium(0.10)
Sid::stemLength                      = 3.5             // in spatiums (= 14 quarter-spaces)
Sid::stemLengthSmall                 = 2.25
Sid::shortestStem                    = 2.25            // minimum stem (quarter-spaces / 4)
Sid::shortStemStartLocation          = 0               // staff position for short-stem algorithm
Sid::useWideBeams                    = false

// BEAMS
Sid::beamWidth                       = Spatium(0.5)
Sid::beamMinLen                      = Spatium(1.1)
Sid::snapCustomBeamsToGrid           = false

// AUGMENTATION DOTS
Sid::dotNoteDistance                 = Spatium(0.5)
Sid::dotDotDistance                  = Spatium(0.65)
Sid::dotRestDistance                 = Spatium(0.25)

// ACCIDENTALS
Sid::accidentalNoteDistance          = (see accidental.cpp)
Sid::accidentalDistance              = (see accidental.cpp)

// NOTE SIZES
Sid::smallNoteMag                    = 0.7
Sid::graceNoteMag                    = 0.7
Sid::smallStaffMag                   = 0.7

// MULTI-MEASURE RESTS
Sid::createMultiMeasureRests         = false           // off by default
Sid::minEmptyMeasures                = 2               // minimum to merge

// CHORD SHIFTS (autoplace)
Sid::maxChordShiftAbove              = Spatium(0.0)
Sid::maxChordShiftBelow              = Spatium(0.0)
Sid::maxFretShiftAbove               = Spatium(0.0)
Sid::maxFretShiftBelow               = Spatium(0.0)

// AUTOPLACE
Sid::autoplaceVerticalAlignRange     = SEGMENT (0)
```

---

## מפת Call Graph — PAGE MODE

```
Layout::doLayoutRange()
  └─ LayoutMeasure::getNextMeasure()          // load first measure into ctx
  └─ LayoutSystem::collectSystem()            // build first system
  └─ Layout::doLayout()
       └─ loop: {
            LayoutPage::getNextPage()
            LayoutPage::collectPage()
              └─ loop: {
                   LayoutSystem::collectSystem()
                     ├─ LayoutMeasure::computePreSpacingItems()
                     │    └─ LayoutChords::updateLineAttachPoints()
                     │    └─ chord.layoutArticulations()
                     │    └─ seg.createShapes()
                     ├─ system.layoutSystem()          // header (clef+key+time)
                     ├─ Measure::computeWidth()        // per-measure width
                     │    └─ Segment::computeDurationStretch()
                     │    └─ Segment::minHorizontalDistance()
                     ├─ LayoutSystem::justifySystem()
                     │    └─ Segment::stretchSegmentsToWidth()
                     ├─ LayoutSystem::layoutSystemElements()
                     │    ├─ LayoutBeams::layoutNonCrossBeams()
                     │    │    └─ Beam::layout()
                     │    │         └─ Beam::layout2()
                     │    │              ├─ chord.layoutStem()
                     │    │              │    └─ Chord::calcDefaultStemLength()
                     │    │              │    └─ Stem::layout()
                     │    │              ├─ Beam::chordBeamAnchor()
                     │    │              └─ Beam::computeDesiredSlant()
                     │    ├─ Skyline construction
                     │    ├─ LayoutHarmonies::layoutHarmonies()
                     │    └─ LayoutLyrics::layoutLyrics()
                     └─ system.layout2(ctx)           // staff y-distances
               }
         }
```

---

## הבדלים קריטיים שגילינו (מול MAP Renderer)

> אלה הממצאים הבולטים שדורשים בדיקה ותיקון בשלב 2 (מסמך MAP renderer) ושלב 3 (gap analysis)

### א. נוסחת ה-Duration Stretch
*(פירוט מלא: סעיף 4.3)*
**webmscore:** `str = pow(slope, log2(ratio))` כאשר `slope = 1.5` (Sid::measureSpacing), `ratio = curTicks / dMinTicks`
**MAP:** `stretch = SPACING_MULTIPLIER × log10(1 + durRatio × 9) / log10(10)`
→ **פורמולות שונות לחלוטין!** webmscore משתמש בחזקה לוגריתמית, MAP משתמש ב-log10.

### ב. ה-HACK ב-computeDurationStretch
*(פירוט מלא: סעיף 4.3)*
webmscore מכפיל את `dMinTicks` ב-2 כאשר `RealIsEqualOrMore(maxTicks/minTicks, 2.0) && minTicks < 1/16` (segment.cpp:2831). הבדיקה משתמשת ב-**fuzzy comparison**, לא `>=` רגיל. משפיע על כל חישוב spacing כשיש 32nd notes.

### ג. empFactor — Long Note Compensation
*(פירוט מלא: סעיף 4.3)*
כש-`dMinTicks > 0.0625` (כל התווים ≥ sixteenth): `str *= (0.4 + 0.6 * sqrt(dMinTicks / 0.0625))`.
empFactor = 0.6 hardcoded (segment.cpp:2847). **חייב להיות מיושם עם incremental system building** — minTicks משתנה בזמן שתיבות מצטרפות למערכת.

### ד. Incremental System Building
*(פירוט מלא: סעיף 5.1)*
collectSystem() עוקב אחרי minTicks/maxTicks לכל המערכת. **כל פעם שמצטרפת תיבה עם תו קצר יותר — כל התיבות הקודמות מחושבות מחדש** (layoutsystem.cpp:139-151). וכשתיבה מוסרת כי לא נכנסת — minTicks/maxTicks מוחזרים לערכים הקודמים. MAP צריך לממש את אותו מנגנון בדיוק.

### ה. squeezability = 0.3 (hardcoded)
*(פירוט מלא: סעיפים 4.2, 5.1)*
System נחשב "מתאים" אם `curSysWidth + ww <= targetWidth + 0.3 * squeezableSpace`. MAP צריך לוודא שהחישוב של `squeezableSpace` זהה — זה נצבר ב-`computeWidth()` ומוגבל ל-`max(0, min(_squeezableSpace, x - minMeasureWidth))`.

### ו. Spring Model — `stretchSegmentsToWidth`
*(פירוט מלא: סעיף 4.6)*
**Do-while loop**, לא for loop. preTension check נעשה על ה-spring **הבא** (אחרי `++spring`), לא הנוכחי. Phase 2 משתמש ב-strict `>` (segment.cpp:2805). MAP צריך לאמת שהנוסחאות זהות בדיוק.

### ז. Minimum Note Space
*(פירוט מלא: סעיף 4.2)*
webmscore: `minNoteSpace = noteHeadWidth + 1.2 * styleMM(Sid::minNoteDistance)` = noteHeadWidth + 0.6sp
(spacingMultiplier = 1.2 מקודד ב-measure.cpp:4174 כ-`static constexpr double spacingMultiplier = 1.2`).
ערך זה מוכפל ב-`durStretch × usrStretch × stretchCoeff` — לא נוסחה עצמאית.

### ח. Stem Direction — Multiple Voices
*(פירוט מלא: סעיף 6.1)*
webmscore: `track % 2 == 0` → stem up. זה מבוסס על track number, לא voice number ישירות.
Voice 0 (track 0,4,8...) → up, Voice 1 (track 1,5,9...) → down.

### ט. stemUpSE / stemDownNW
*(פירוט מלא: סעיף 6.2)*
webmscore קורא ל-`note.stemUpSE()` ו-`note.stemDownNW()` שהם anchors ספציפיים לגליף מה-SMuFL font metrics. גרסאות Bravura ו-Leland עשויות להיות שונות.

### י. layoutSystemElements — 25 Phases בסדר קבוע
*(פירוט מלא: סעיף 5.4)*
הסדר קריטי ואי אפשר לשנות אותו. למשל:
- Beams חייבים להיות מחושבים **לפני** skyline building
- Fingerings חייבים להיות מחושבים **אחרי** skyline building
- Slurs לפני articulation adjustment (layoutArticulations3)
- FretDiagram detection קובע אם Harmony מתועד בphase 14 או 21
- Jumps ו-Markers הם ב-`Measure.el()`, לא ב-segment annotations — אם MAP מחפש אותם באנוטציות, לא ימצא
- Pedal lines use `align=true`, other spanners use `align=false`

### יא. Fuzzy Float Comparisons
*(פירוט מלא: הערה בתחילת פרק 4)*
כל ה-`>=` ו-`<=` בקוד spacing עוברות דרך `RealIsEqualOrMore`/`RealIsEqualOrLess` עם ε=1e-9 relative (framework/global/realfn.h). MAP שמשתמש ב-`>=`/`<=` רגילים עלול לקבל תוצאות שונות בדיוק במקרי קצה.

### יב. maxRatio Cap — Linear Interpolation
*(פירוט מלא: סעיף 4.3)*
כש-`maxTicks/minTicks > 32`, C++ עובר ל-interpolation ליניארית של ratio (segment.cpp:2837-2841). בלי זה, תווים ארוכים מאוד (whole notes לצד 32nds) מקבלים stretch גדול מדי.

### יג. extraLeadingSpace
*(פירוט מלא: סעיף 4.4, Phase 5)*
`minHorizontalDistance` מוסיף `ns.extraLeadingSpace().val() * spatium()` בסוף (segment.cpp:2668-2670). זה user-defined spacing שנקרא מ-XML. אם MAP לא קורא את `<leadingSpace>` מה-MusicXML, המרווחים יהיו שונים.

### יד. Cross-Beam Spacing Adjustment
*(פירוט מלא: סעיפים 4.2, 4.12)*
`computeCrossBeamType()` (segment.cpp:2726) מזהה beams עם stem directions מתחלפים ו-`computeWidth()` מוסיף/מחסיר `noteHeadWidth - stemWidth` displacement. בלי זה, cross-beam spacing לא נכון.

### טו. layoutChords1 — Inter-Voice Conflict Resolution Constants
*(פירוט מלא: סעיף 6.1)*
webmscore פותר התנגשויות בין voices בתוך segment עם 10 מקרי separation (layoutchords.cpp:103-519). קבועי המרחקים:
- `minNoteDistance = styleMM(Sid::minNoteDistance)` — ברירת מחדל 0.5sp
- Voice 1 vs Voice 2 separation: `margin = max(lShape.right(), 0.0) + 0.5 * spatium() * (voice1Right ? 1.0 : 0.0)`
- Grace note offset: `0.5 * spatium()`
- Dot avoidance: `noteWidth + 0.16 * spatium()`
MAP צריך לממש את אותם 10 separation cases אם תומך ב-multi-voice.

### טז. Accidental Column Resolution — Octave Matching
*(פירוט מלא: סעיפים 6.3, 6.4, 6.5)*
`resolveAccidentals()` (layoutchords.cpp:646-707): כש-2 notes עם accidentals מתנגשים, השמאלי מוזז ב-`0.33 * spatium()`. אם עדיין חופף, offset נוסף `1.41 * accidental.width`. `layoutChords3()` (layoutchords.cpp:804-1222) מארגן accidentals ב-columns ע"פ אוקטבות — notes באותו octave מקבלים padding שונה.

### יז. maxReductions Table — Stem Shortening
*(פירוט מלא: סעיף 7.6)*
webmscore מקצר stems של תווים מקובצים ב-beam לפי `maxReductions[4][5]` (chord.cpp:1524-1566):
```
beams\inside:  0    1     2     3     4+
  2:          1.0  0.5   0.0   0.0   0.0
  3:          0.5  0.25  0.0   0.0   0.0
  4:          0.5  0.0   0.0   0.0   0.0
  5+:         0.0  0.0   0.0   0.0   0.0
```
ערכים ביחידות qs (quarter-space, 1 sp = 4 qs). בלי טבלה זו, stems בקבוצות beam יהיו ארוכים מדי.

### יח. _maxSlopes — Beam Slope Limits
*(פירוט מלא: סעיף 8.5)*
**תיקון:** המסמך המקורי ציין `_maxSlopes = {0,0,1,1,2,2,3,3}` — **שגוי לחלוטין**.
webmscore beam.h:238 מגדיר: `_maxSlopes = { 0, 1, 2, 3, 4, 5, 6, 7 }` — אינדקס = beam count - 1.
`getMaxSlope()` (beam.cpp:1309-1325) מפחית slope limit עבור beams קצרים: `dictator-pointer ≤ 2 → maxSlope/2`, `≤ 3 → maxSlope*2/3`.

### יט. Beam Position Validation — Quarter-Space Grid
*(פירוט מלא: סעיפים 8.7, 8.8, 8.9)*
webmscore מאלץ beam positions ל-quarter-space grid (beam.cpp:1279-1307):
- **Inside staff:** positions חייבים להיות on straddle (between lines) — "floaters" (exactly on line) אסורים ל-single beams
- **Outside staff:** positions חייבים להיות on line או straddle — לא between quarter-spaces
- `offsetBeamToRemoveCollisions()` בודק כל note ומוודא stem ≥ `minStemLengths[beamCount]`:
  `minStemLengths = { 11, 13, 15, 18, 21, 24, 27, 30 }` (qs units, beam.cpp:1111)
- `offsetBeamWithAnchorShortening()` — anchor shortening: beam עולה `2 qs` כל פעם ומאפשר stem shortening עד `maxReduction` qs

### כ. Cross-Staff Beam Handling
*(פירוט מלא: סעיף 8.4)*
`layout2Cross()` (beam.cpp:1591-1803) מטפל ב-beams שחוצים staves:
- Notes sorted by `staffMove * 1000 + line` — ממפה dictator/pointer ע"פ staff position
- `up` direction: dictator = bottommost note (highest line value)
- Beam position = average `(startAnchor + endAnchor) / 2`, clamped to staff intersection
- Stem extension: all stems extended to reach beam across staves
MAP שלא תומך ב-cross-staff beams יכול לדלג, אבל צריך detection (לא לנסות layout רגיל על cross-staff notes).

### כא. Hook (Flag) Glyph Selection — Index Table
*(פירוט מלא: סעיף 7.11)*
`Hook::symIdForHookIndex()` (hook.cpp:73-117) ממפה `hookIndex` → SMuFL SymId. הטבלה מכסה indices -8 עד +8 (שלילי=down, חיובי=up). `smuflAnchor()` (hook.cpp:68-71) קורא `stemUpNW` (up) או `stemDownSW` (down) מה-font metadata — ולא stemUpSE/stemDownNW כמו noteheads.

### כב. computeUp — 9 Priority Levels
*(פירוט מלא: סעיף 7.1)*
webmscore קובע stem direction ב-9 שלבי עדיפות (chord.cpp:1010-1135):
1. `_stemDirection` (user override) → 2. Mirror (multiple voices in segment) →
3. Beam group consensus → 4. Cross-staff (move>0=up, move<0=down) →
5. Tablature (always down) → 6. Drum map → 7. User default →
8. `computeAutoStemDirection()` — **net positive (notes below middle) returns 1 (UP)**
9. Fallback: up
MAP צריך לממש לפחות levels 1, 2, 8, 9. Multi-voice (level 2) קריטי.

### כג. verticalClearance — Shape Collision Threshold
*(פירוט מלא: סעיף 9B.2)*
`Shape::minHorizontalDistance()` (shape.cpp:103) משתמש ב-`verticalClearance = 0.2 * spatium()` — אלמנטים שנמצאים בטווח 0.2sp אנכי נחשבים כמתנגשים גם אם אין חפיפה פיזית. MAP צריך לוודא שגם הוא מיישם clearance דומה כשבודק חפיפה בין שני elements.

### כד. Zero-Width Shape Walls
*(פירוט מלא: סעיף 9B.1)*
`addHorizontalSpacing()` (shape.cpp:44) יוצר rectangles בגובה 0 שמתנגשים עם **הכל** — HACK ב-webmscore ליצירת "קירות" שאי אפשר לעקוף. `minHorizontalDistance()` (shape.cpp:120) בודק `r1.width == 0 || r2.width == 0` ומכריח collision. MAP שלא מממש את ההתנהגות הזו יקבל אלמנטים שחודרים לתוך spacing שצריך להיות שמור.

### כה. Skyline Epsilon 1e-7
*(פירוט מלא: סעיף 9B.3)*
`SkylineLine::add()` (skyline.cpp:170,180,198) משווה רוחבי segments עם threshold של `0.0000001` (1e-7) ולא zero מדויק. אם MAP משתמש ב-`> 0` במקום `> 1e-7`, מקרי קצה עם floating point rounding עלולים ליצור segments מיותרים.

---

## פרק 11: Barlines — Layout, Width Computation & Drawing

> קובץ: `src/engraving/libmscore/barline.cpp` (1,674 שורות) + `barline.h` (173 שורות)

### 11.1 BarLine Types & BarLineTable

```cpp
// barline.h:71
BarLineType _barLineType { BarLineType::NORMAL };
```

Complete type enumeration (barline.cpp:253-265):
```
BarLineType::NORMAL           → SymId::barlineSingle
BarLineType::DOUBLE           → SymId::barlineDouble
BarLineType::START_REPEAT     → SymId::repeatLeft
BarLineType::END_REPEAT       → SymId::repeatRight
BarLineType::BROKEN           → SymId::barlineDashed
BarLineType::END              → SymId::barlineFinal
BarLineType::END_START_REPEAT → SymId::repeatRightLeft
BarLineType::DOTTED           → SymId::barlineDotted
BarLineType::REVERSE_END      → SymId::barlineReverseFinal
BarLineType::HEAVY            → SymId::barlineHeavy
BarLineType::DOUBLE_HEAVY     → SymId::barlineHeavyHeavy
```

### 11.2 Span Constants

```cpp
// barline.h:32-47
static constexpr int MIN_BARLINE_FROMTO_DIST  = 2;
static constexpr int MIN_BARLINE_SPAN_FROMTO  = -2;

// 1-line staff: goes from 2sp above to 2sp below the line
static constexpr int BARLINE_SPAN_1LINESTAFF_FROM = -4;
static constexpr int BARLINE_SPAN_1LINESTAFF_TO   =  4;

// Tick barline presets
static constexpr int BARLINE_SPAN_TICK1_FROM  = -1;
static constexpr int BARLINE_SPAN_TICK1_TO    = -7;
static constexpr int BARLINE_SPAN_TICK2_FROM  = -2;
static constexpr int BARLINE_SPAN_TICK2_TO    = -6;

// Short barline presets
static constexpr int BARLINE_SPAN_SHORT1_FROM =  2;
static constexpr int BARLINE_SPAN_SHORT1_TO   = -2;
static constexpr int BARLINE_SPAN_SHORT2_FROM =  1;
static constexpr int BARLINE_SPAN_SHORT2_TO   = -1;
```

### 11.3 `BarLine::layoutWidth()` — Width per Type

**Signature:** `double BarLine::layoutWidth() const` (barline.cpp:1163)

Returns total width in mm (before mag scaling), using Sid style values:

```
NORMAL, BROKEN, DOTTED:
  w = Sid::barWidth

HEAVY:
  w = Sid::endBarWidth

DOUBLE:
  w = Sid::doubleBarWidth × 2 + Sid::doubleBarDistance

END, REVERSE_END:
  w = Sid::endBarWidth + Sid::barWidth + Sid::endBarDistance

DOUBLE_HEAVY:
  w = Sid::endBarWidth × 2 + Sid::endBarDistance

START_REPEAT, END_REPEAT:
  w = Sid::endBarWidth + Sid::barWidth + Sid::endBarDistance
    + Sid::repeatBarlineDotSeparation + dotWidth
  where dotWidth = symWidth(SymId::repeatDot)

END_START_REPEAT:
  w = Sid::endBarWidth + Sid::barWidth × 2 + Sid::endBarDistance × 2
    + Sid::repeatBarlineDotSeparation × 2 + dotWidth × 2
```

**Relevant Sid constants** (from chapter 1):
```
Sid::barWidth                    — thin barline width
Sid::doubleBarWidth              — thin line width for double barlines
Sid::endBarWidth                 — thick barline width (final/repeat)
Sid::doubleBarDistance            — gap between lines in double barline
Sid::endBarDistance               — gap between thin and thick in final barline
Sid::repeatBarlineDotSeparation  — gap between dots and thin line in repeat
Sid::repeatBarTips               — bool: show bracket tips on repeats
```

### 11.4 `BarLine::getY()` — Vertical Span Computation

**Signature:** `void BarLine::getY() const` (barline.cpp:429)
**Mutates:** `y1`, `y2` (mutable doubles on the BarLine)

**Algorithm:**
```
if no parent (palette):
    y1 = _spanFrom × spatium × 0.5
    y2 = (8 - _spanTo) × spatium × 0.5
    return

staffIdx1 = staffIdx()
staffIdx2 = staffIdx1
if _spanStaff:
    staffIdx2 = nextVisibleSpannedStaff(this)

// 1-line staff special case
if staffLines ≤ 1 AND _spanFrom == 0:
    from = BARLINE_SPAN_1LINESTAFF_FROM (-4)
    if !_spanStaff OR lastStaff:
        to = BARLINE_SPAN_1LINESTAFF_TO (4)
else:
    from = _spanFrom
    to = _spanTo

spatium1 = st1->spatium(score())   // staff-specific spatium
d = lineDistance × spatium1         // distance between staff lines
yy = staffLines.y1() - sysStaff.y()  // staff top relative to system
lw = Sid::staffLineWidth × spatium1 × 0.5

y1 = yy + from × d × 0.5 - lw

if spanning to different staff:
    y2 = staffLines[staffIdx2].y1() - sysStaff.y() - to × d × 0.5
else:
    y2 = yy + (lines × 2 - 2 + to) × d × 0.5 + lw
```

**Helper: `nextVisibleSpannedStaff()`** (barline.cpp:391-422):
Walks forward from staffIdx, looking for visible staves. Stops at a barline that doesn't span or at invisible staves. Special rules for endBarLines: also spans to cutaway courtesy clef staves and to staves visible in next measure on same system.

**Helper: `prevVisibleSpannedStaff()`** (barline.cpp:369-385):
Walks backward. Stops at a barline that doesn't span.

### 11.5 `BarLine::layout()` — Initial Layout (Phase 1)

**Signature:** `void BarLine::layout()` (barline.cpp:1262)

**Algorithm:**
```
setPos(0,0)

// Hidden barline check
if staff exists AND (
    (!showBarlines AND EndBarLine segment) OR
    (hideSystemBarLine AND BeginBarLine segment)):
    setbbox(empty)
    return

// Magnification
mag = Sid::scaleBarlines && staff ? staffMag(tick) : 1.0

// Temporary y values (real values set in layout2)
y1 = spatium × 0.5 × _spanFrom
if y2 == 0:
    y2 = spatium × 0.5 × (8.0 + _spanTo)

w = layoutWidth() × mag
bbox = Rect(0, y1, w, y2 - y1)

// Repeat tips extend bbox
if Sid::repeatBarTips:
    START_REPEAT: unite(symBbox(bracketTop) at y1)
    END_REPEAT: unite(symBbox(reversedBracketTop) at y1)
    END_START_REPEAT: both

setbbox(bbox)

// Layout attached elements (fermata etc.)
for each element in _el:
    e->layout()
    if articulation:
        x = width × 0.5
        distance = 0.5 × spatium
        DOWN: pos = (x, y2 + distance)
        UP:   pos = (x, y1 - distance)
```

### 11.6 `BarLine::layout2()` — Final Layout (After System Layout)

**Signature:** `void BarLine::layout2()` (barline.cpp:1334)

Called after system layout when staff distances are known. Sets true vertical dimensions.

```
// Same hidden barline check as layout()
getY()   // sets y1, y2 to actual values
bbox.top = y1
bbox.bottom = y2

// Repeat tips (both top AND bottom, unlike layout() which only does top)
if Sid::repeatBarTips:
    START_REPEAT:
        unite(bracketTop at y1)
        unite(bracketBottom at y2)
    END_REPEAT:
        unite(reversedBracketTop at y1)
        unite(reversedBracketBottom at y2)
    END_START_REPEAT: all four
```

### 11.7 `BarLine::layoutRect()` — Shape for Skyline

**Signature:** `RectF BarLine::layoutRect() const` (barline.cpp:1214)

Returns bbox adjusted for single-staff span only (excludes cross-staff extension for skyline purposes).

```
bb = bbox()
if staff:
    span = staffLines - 1
    // 1-line staff special case
    if span == 0 AND _spanTo == 0:
        sFrom = BARLINE_SPAN_1LINESTAFF_FROM
        sTo = _spanStaff ? 0 : BARLINE_SPAN_1LINESTAFF_TO
    else:
        sFrom = _spanFrom
        sTo = _spanStaff ? 0 : _spanTo  // clamp to own staff if spanning

    y = sp × sFrom × 0.5
    h = sp × (span + (sTo - sFrom) × 0.5)

    // repeat tips extend y/h
    if Sid::repeatBarTips AND is repeat type:
        if isTop: y -= symBbox(bracketTop).height(), h += same
        if isBottom: h += symBbox(bracketBottom).height()

    bb.top = y
    bb.height = h
return bb
```

### 11.8 `BarLine::draw()` — Rendering

**Signature:** `void BarLine::draw(Painter*) const` (barline.cpp:582)

Each type draws one or two vertical lines using style-based widths:

| Type | Lines | Widths | Spacing |
|------|-------|--------|---------|
| NORMAL | 1 thin | Sid::barWidth | — |
| BROKEN | 1 thin dashed | Sid::barWidth | PenStyle::DashLine |
| DOTTED | 1 thin dotted | Sid::barWidth | PenStyle::DotLine |
| HEAVY | 1 thick | Sid::endBarWidth | — |
| DOUBLE | 2 thin | Sid::doubleBarWidth | Sid::doubleBarDistance |
| END | thin + thick | Sid::barWidth + Sid::endBarWidth | Sid::endBarDistance |
| REVERSE_END | thick + thin | Sid::endBarWidth + Sid::barWidth | Sid::endBarDistance |
| DOUBLE_HEAVY | 2 thick | Sid::endBarWidth × 2 | Sid::endBarDistance |
| START_REPEAT | thick + thin + dots | endBarWidth + barWidth | endBarDistance + repeatBarlineDotSeparation |
| END_REPEAT | dots + thin + thick | dotWidth + barWidth + endBarWidth | repeatBarlineDotSeparation + endBarDistance |
| END_START_REPEAT | dots + thin + thick + thin + dots | full mirror | all separations |

**Drawing coordinates:** Each line at `x = lw × 0.5` (centered on its width). Lines drawn from `y1` to `y2`. All widths multiplied by `mag()`.

**Pen:** `PenCapStyle::FlatCap` always (no rounded caps).

### 11.9 `BarLine::drawDots()` — Repeat Dot Positioning

**Signature:** `void BarLine::drawDots(Painter*, double x) const` (barline.cpp:489)

```
if palette (no parent):
    y1l = 1.5 × spatium     (Bravura shift)
    y2l = 2.5 × spatium
else:
    y1l = staffType.doty1() × spatium
    y2l = staffType.doty2() × spatium

    // Font workaround: Bravura/Petaluma/Leland have built-in offset
    if font is NOT Leland/Bravura/Petaluma:
        offset = 0.5 × spatium × mag
        y1l += offset
        y2l += offset

    // staffType offset
    y1l += st.yoffset × spatium
    y2l += st.yoffset × spatium

drawSymbol(SymId::repeatDot, x, y1l)
drawSymbol(SymId::repeatDot, x, y2l)
```

### 11.10 `BarLine::drawTips()` — Repeat Bracket Tips

**Signature:** `void BarLine::drawTips(Painter*, bool reversed, double x) const` (barline.cpp:528)

```
if reversed:
    if isTop: drawSymbol(reversedBracketTop, x - symWidth(reversedBracketTop), y1)
    if isBottom: drawSymbol(reversedBracketBottom, x - symWidth(reversedBracketBottom), y2)
else:
    if isTop: drawSymbol(bracketTop, x, y1)
    if isBottom: drawSymbol(bracketBottom, x, y2)
```

`isTop()` (barline.cpp:551): true if staffIdx==0 or prevVisibleSpannedStaff returns same idx.
`isBottom()` (barline.cpp:565): true if !_spanStaff, or last staff, or nextVisibleSpannedStaff returns same idx.

### 11.11 `BarLine::shape()` — Collision Shape

**Signature:** `Shape BarLine::shape() const` (barline.cpp:1381)

Simply wraps `bbox()` as a Shape with `this` as owner. Barlines have `neverKernable() = true` — they never participate in horizontal kerning with adjacent elements.

---

## פרק 12: Key Signatures, Time Signatures & Clefs

### 12A: Key Signatures

> קובץ: `src/engraving/libmscore/keysig.cpp` (809 שורות) + `keysig.h` (107 שורות)

#### 12A.1 `KeySig::layout()` — Full Layout Algorithm

**Signature:** `void KeySig::layout()` (keysig.cpp:112)

**Step 1: Initialize**
```
spatium = spatium()
step = spatium × lineDistance × 0.5    // half-line distance
bbox = empty
keySymbols.clear()

if staff type doesn't gen keysig → return empty
```

**Step 2: Determine current clef**
```
Look backward for a Clef at same tick in prev segments.
If found: use its clefType
Else: staff->clef(tick - 1)   // last known clef
```

**Step 3: Standard key signature layout** (keysig.cpp:213-345)

For non-custom keys (`abs(t1) <= 7`):

```
// Bitmask for accidentals
abs(7) → 0x7f (all 7 positions)
abs(6) → 0x3f
abs(5) → 0x1f
abs(4) → 0xf
abs(3) → 0x7
abs(2) → 0x3
abs(1) → 0x1
abs(0) → 0x0

// Naturals determination
naturalsOn = !newSection AND (Sid::keySigNaturals != NONE OR t1 == 0)
// Don't repeat naturals if already shown in courtesy
if firstInSystem AND prevMeasure has KeySigAnnounce → naturalsOn = false

if naturalsOn:
    t2 = previous key
    naturals = bitmask for abs(t2)
    // Remove redundant: if same sign, remove overlapping
    if same sign: naturals &= ~accidentals

// Ordering: naturals BEFORE accidentals if:
//   style says BEFORE, OR changing sign (sharps↔flats)
prefixNaturals = naturalsOn AND (style == BEFORE OR t1 × t2 < 0)
suffixNaturals = naturalsOn AND !prefixNaturals
```

**Step 4: Place accidentals using `ClefInfo::lines()`**

The line positions for sharps and flats are clef-dependent. Each `ClefInfo` entry has a 14-element `_lines` array (clef.cpp:51-92):
- Indices 0–6: sharp positions (F♯ C♯ G♯ D♯ A♯ E♯ B♯)
- Indices 7–13: flat positions (B♭ E♭ A♭ D♭ G♭ C♭ F♭)

Example for treble clef (G, line 2):
```
sharps: { 0, 3, -1, 2, 5, 1, 4 }   // F♯=line0, C♯=line3, G♯=line-1, ...
flats:  { 4, 1, 5, 2, 6, 3, 7 }    // B♭=line4, E♭=line1, A♭=line5, ...
```

```
// For sharps (t1 > 0): lineIndexOffset = 0
// For flats (t1 < 0): lineIndexOffset = 7
for i = 0 to abs(t1)-1:
    addLayout(sharp/flat symbol, lines[lineIndexOffset + i])
```

#### 12A.2 `KeySig::addLayout()` — Accidental X-Positioning with Cutouts

**Signature:** `void KeySig::addLayout(SymId sym, int line)` (keysig.cpp:76)

```
if first symbol:
    x = 0
else:
    previous = keySymbols.back()
    accidentalGap = Sid::keysigAccidentalDistance
    if different symbol type: gap × 2
    if both natural: gap = Sid::keysigNaturalDistance

    previousWidth = symWidth(previous.sym) / spatium
    x = previous.xPos + previousWidth + gap

    // SMuFL cutout optimization: tighter spacing when ascending/descending
    isAscending = line < previous.line
    currentCutout = isAscending ? cutOutSW : cutOutNW
    previousCutout = isAscending ? cutOutNE : cutOutSE
    if current cutout overlaps previous cutout vertically:
        x -= cutout.x / spatium   // tighten
```

**Sid constants:**
```
Sid::keysigAccidentalDistance  — gap between different-type accidentals (sp)
Sid::keysigNaturalDistance     — gap between naturals (sp)
```

#### 12A.3 `KeySig::changeKeySigEvent()` — Non-Layout Utility

**Signature:** `void KeySig::changeKeySigEvent(const KeySigEvent& t)` (keysig.cpp:683)

Simple setter with equality check — calls `setKeySigEvent(t)` only if `_sig != t`. Not part of layout pipeline.

#### 12A.4 `KeySig::draw()` — Rendering with Ledger Lines

**Signature:** `void KeySig::draw(Painter*) const` (keysig.cpp:359)

```
for each KeySym ks:
    x = ks.xPos × spatium
    y = ks.line × step
    drawSymbol(ks.sym, x, y)

    // Ledger lines for accidentals above/below staff
    ledgerLineWidth = Sid::ledgerLineWidth × mag
    ledgerExtraLen = Sid::ledgerLineLength × spatium
    x1 = x - ledgerExtraLen
    x2 = x + symWidth + ledgerExtraLen

    for i = -2 down to ks.line (above staff):
        draw horizontal line at i × step
    for i = lines×2 up to ks.line (below staff):
        draw horizontal line at i × step
```

---

### 12B: Time Signatures

> קובץ: `src/engraving/libmscore/timesig.cpp` (615 שורות) + `timesig.h` (151 שורות)

#### 12B.1 TimeSigType Enum

```cpp
// timesig.h:38-44
enum class TimeSigType : char {
    NORMAL,       // numeric N/D display
    FOUR_FOUR,    // common time (C symbol)
    ALLA_BREVE,   // cut time (C with line)
    CUT_BACH,     // Bach cut time
    CUT_TRIPLE,   // cut triple time (9/8)
};
```

#### 12B.2 `TimeSig::layout()` — Full Layout Algorithm

**Signature:** `void TimeSig::layout()` (timesig.cpp:256)

**Step 1: Initialize**
```
setPos(0, 0)
bbox = empty
pointLargeLeftParen = (0,0)
pz = (0,0)    // numerator position
pn = (0,0)    // denominator position
pointLargeRightParen = (0,0)

if staff type doesn't gen timesig → return empty
numOfLines = staff.lines(tick)
lineDist = staff.lineDistance(tick)
```

**Step 2: Vertical center**
```
yoff = spatium × (numOfLines - 1) × 0.5 × lineDist
```

**Step 3: Symbol types (single glyph)**
```
FOUR_FOUR:    pz = (0, yoff), bbox = symBbox(timeSigCommon) at pz
ALLA_BREVE:   pz = (0, yoff), bbox = symBbox(timeSigCutCommon) at pz
CUT_BACH:     pz = (0, yoff), bbox = symBbox(timeSigCut2) at pz
CUT_TRIPLE:   pz = (0, yoff), bbox = symBbox(timeSigCut3) at pz
```

**Step 4: Numeric type (two rows)**
```
ns = timeSigSymIdsFromString(numeratorString or sig.numerator)
ds = timeSigSymIdsFromString(denominatorString or sig.denominator)

numRect = font->bbox(ns, mag × _scale)
denRect = font->bbox(ds, mag × _scale)

// Vertical displacement between num and den
displ = (numOfLines is odd) ? 0.0 : 0.05 × spatium

pzY = yoff - (displ + numRect.height × 0.5)     // numerator above center
pnY = yoff + displ + denRect.height × 0.5        // denominator below center

// Horizontal centering: align on the wider
if numRect.width >= denRect.width:
    pz = (0, pzY)
    pn = ((numRect.width - denRect.width) × 0.5, pnY)
else:
    pz = ((denRect.width - numRect.width) × 0.5, pzY)
    pn = (0, pnY)

// Large parentheses (for local time sigs)
centerY = yoff / 2 + spatium
widest = max(numRect.width, denRect.width)
pointLargeLeftParen = (-spatium, centerY)
pointLargeRightParen = (widest + spatium, centerY)
```

**Sid constants:**
```
Sid::timesigScale  → ScaleF applied to time sig glyphs (Pid::SCALE)
```

#### 12B.3 `TimeSig::draw()` — Rendering

**Signature:** `void TimeSig::draw(Painter*) const` (timesig.cpp:383)

```
if staff type doesn't gen timesig → return
drawSymbols(ns, pz, _scale)   // numerator symbols at pz
drawSymbols(ds, pn, _scale)   // denominator symbols at pn
if _largeParentheses:
    drawSymbol(timeSigParensLeft, pointLargeLeftParen, _scale.width)
    drawSymbol(timeSigParensRight, pointLargeRightParen, _scale.width)
```

---

### 12C: Clefs

> קובץ: `src/engraving/libmscore/clef.cpp` (538 שורות) + `clef.h` (156 שורות)

#### 12C.1 ClefInfo Table — Complete Clef Type Registry

**Source:** `ClefInfo::clefTable[]` (clef.cpp:51-92)

Each entry: `{ ClefType, line, pitchOffset, lines[14], SymId, StaffGroup }`

| ClefType | Line | pitchOffset | SymId | StaffGroup |
|----------|------|-------------|-------|------------|
| G | 2 | 45 | gClef | STANDARD |
| G15_MB | 2 | 31 | gClef15mb | STANDARD |
| G8_VB | 2 | 38 | gClef8vb | STANDARD |
| G8_VA | 2 | 52 | gClef8va | STANDARD |
| G15_MA | 2 | 59 | gClef15ma | STANDARD |
| G8_VB_O | 2 | 38 | gClef8vbOld | STANDARD |
| G8_VB_P | 2 | 45 | gClef8vbParens | STANDARD |
| G_1 | 1 | 47 | gClef | STANDARD |
| C1 | 1 | 43 | cClef | STANDARD |
| C2 | 2 | 41 | cClef | STANDARD |
| C3 | 3 | 39 | cClef | STANDARD |
| C4 | 4 | 37 | cClef | STANDARD |
| C5 | 5 | 35 | cClef | STANDARD |
| C_19C | 2 | 45 | cClefSquare | STANDARD |
| C1_F18C | 1 | 43 | cClefFrench | STANDARD |
| C3_F18C | 3 | 39 | cClefFrench | STANDARD |
| C4_F18C | 4 | 37 | cClefFrench | STANDARD |
| C1_F20C | 1 | 43 | cClefFrench20C | STANDARD |
| C3_F20C | 3 | 39 | cClefFrench20C | STANDARD |
| C4_F20C | 4 | 37 | cClefFrench20C | STANDARD |
| F | 4 | 33 | fClef | STANDARD |
| F15_MB | 4 | 19 | fClef15mb | STANDARD |
| F8_VB | 4 | 26 | fClef8vb | STANDARD |
| F_8VA | 4 | 40 | fClef8va | STANDARD |
| F_15MA | 4 | 47 | fClef15ma | STANDARD |
| F_B | 3 | 35 | fClef | STANDARD |
| F_C | 5 | 31 | fClef | STANDARD |
| F_F18C | 4 | 33 | fClefFrench | STANDARD |
| F_19C | 4 | 33 | fClef19thCentury | STANDARD |
| PERC | 2 | 45 | unpitchedPercussionClef1 | PERCUSSION |
| PERC2 | 2 | 45 | unpitchedPercussionClef2 | PERCUSSION |
| TAB | 5 | 45 | sixStringTabClef | TAB |
| TAB4 | 5 | 45 | fourStringTabClef | TAB |
| TAB_SERIF | 5 | 45 | sixStringTabClefSerif | TAB |
| TAB4_SERIF | 5 | 45 | fourStringTabClefSerif | TAB |

**Key signature line positions** (the `_lines[14]` array): first 7 entries = sharp positions, next 7 = flat positions. Used by `KeySig::layout()` (see 12A.1).

#### 12C.2 `Clef::layout()` — Full Layout Algorithm

**Signature:** `void Clef::layout()` (clef.cpp:119)

**Step 1: Staff type compatibility check**
```
tick = segment.tick
st = staff->staffType(tick)
show = st->genClef()
staffGroup = st->group()

// override staffGroup for non-TAB using drumset
if staffGroup != TAB:
    staffGroup = useDrumset ? PERCUSSION : STANDARD

// incompatible clef type?
if ClefInfo::staffGroup(clefType) != staffGroup:
    if tick > 0 AND !generated: hide
    else: replace with initial staff clef type
```

**Step 2: Vertical positioning**
```
lines = st->lines()
lineDist = st->lineDistance()
stepOffset = st->stepOffset()

symId = ClefInfo::symId(clefType)
yoff = lineDist × (5 - ClefInfo::line(clefType))
```

**Special case overrides** (clef.cpp:176-213):
```
C_19C:  yoff = lineDist × 1.5    // 19th century clef treated as G position
TAB types: yoff = lineDist × (lines-1) × 0.5, stepOffset = 0
PERC types: yoff = lineDist × (lines-1) × 0.5, stepOffset = 0
```

**Step 3: Position and bbox**
```
r = symBbox(symId)

// Alignment: start-of-system clefs left-aligned, mid-measure right-aligned
x = (segment AND rtick != 0) ? -r.right() : 0.0

setPos(x, yoff × spatium + stepOffset × 0.5 × spatium)
setbbox(r)
```

#### 12C.3 `Clef::mag()` — Magnification

**Signature:** `double Clef::mag() const` (clef.cpp:106)

```
mag = staff ? staffMag(tick) : 1.0
if isSmall:
    mag *= Sid::smallClefMag
return mag
```

**Sid constants:**
```
Sid::smallClefMag  — scaling factor for courtesy/mid-measure clefs
```

#### 12C.4 Clef Utility Functions (Non-Layout)

| Function | Line | Purpose |
|----------|------|---------|
| `setConcertClef(ClefType)` | clef.cpp:359 | Simple setter: `_clefTypes._concertClef = val` |
| `setTransposingClef(ClefType)` | clef.cpp:368 | Simple setter: `_clefTypes._transposingClef = val` |
| `clefType()` | clef.cpp:377 | Returns concert or transposing clef based on `concertPitch()` |
| `setClefType(ClefType)` | clef.cpp:340 | Sets concert/transposing based on `concertPitch()`, fills INVALID counterpart |
| `otherClef()` | clef.cpp:410 | Finds the paired clef (courtesy↔main) in adjacent measure |

`otherClef()` algorithm: If this clef is at measure start (HeaderClef), look in previous measure's end-of-measure Clef segment. If at measure end, look in next measure's HeaderClef segment. Returns the clef at the same track, or nullptr.

#### 12C.5 `Clef::draw()` — Rendering

**Signature:** `void Clef::draw(Painter*) const` (clef.cpp:228)

```
if symId == noSym OR staff type doesn't gen clef → return
setPen(curColor)
drawSymbol(symId)   // at element position (set by layout)
```

---

## פרק 13: Accidentals — Layout & Type Registry

> קובץ: `src/engraving/libmscore/accidental.cpp` (657 שורות) + `accidental.h` (143 שורות)

### 13.1 Accidental Type Table (`accList[]`)

**Source:** `accList[]` (accidental.cpp:54-227)

Static array of `Acc` structs: `{ AccidentalVal offset, double centOffset, SymId sym }`

**Standard accidentals (non-microtonal):**
```
NONE           → AccidentalVal::NATURAL,  0 cent, SymId::noSym
FLAT           → AccidentalVal::FLAT,     0 cent, SymId::accidentalFlat
NATURAL        → AccidentalVal::NATURAL,  0 cent, SymId::accidentalNatural
SHARP          → AccidentalVal::SHARP,    0 cent, SymId::accidentalSharp
SHARP2         → AccidentalVal::SHARP2,   0 cent, SymId::accidentalDoubleSharp
FLAT2          → AccidentalVal::FLAT2,    0 cent, SymId::accidentalDoubleFlat
SHARP3         → AccidentalVal::SHARP3,   0 cent, SymId::accidentalTripleSharp
FLAT3          → AccidentalVal::FLAT3,    0 cent, SymId::accidentalTripleFlat
NATURAL_FLAT   → AccidentalVal::FLAT,     0 cent, SymId::accidentalNaturalFlat
NATURAL_SHARP  → AccidentalVal::SHARP,    0 cent, SymId::accidentalNaturalSharp
SHARP_SHARP    → AccidentalVal::SHARP2,   0 cent, SymId::accidentalSharpSharp
```

**Microtonal families:** Gould arrow quartertone (12 types), Stein-Zimmermann (4), Arel-Ezgi-Uzdilek AEU (4), Extended Helmholtz-Ellis (30+), Equal-tempered (7), Sagittal (24), Wyschnegradsky (22), Turkish folk (8), Persian (2: Sori +33¢, Koron -67¢).

Total: ~110 accidental types.

### 13.2 `AccidentalBracket` Enum

```cpp
// accidental.h:46-51
enum class AccidentalBracket : char {
    NONE,
    PARENTHESIS,
    BRACKET,
    BRACE,    // deprecated
};
```

### 13.3 `Accidental::layout()` — Main Layout

**Signature:** `void Accidental::layout()` (accidental.cpp:373)

```
el.clear()    // clear SymElement list

// Skip on TAB staff or fixed-pitch notes
if onTabStaff OR note.fixed → setbbox(empty), return

// Magnification
m = parent ? parentItem.mag : 1.0
if isSmall: m *= Sid::smallNoteMag
setMag(m)

// Choose single-glyph vs multi-glyph path
if bracket == NONE,
   OR (bracket == PARENTHESIS AND type is flat/natural/sharp/sharp2/flat2):
    layoutSingleGlyphAccidental()
else:
    layoutMultiGlyphAccidental()
```

### 13.4 `Accidental::layoutSingleGlyphAccidental()`

**Signature:** (accidental.cpp:405)

```
s = symbol()   // SymId from accList

if bracket == PARENTHESIS:
    // Use combined paren+accidental glyphs
    FLAT2   → accidentalDoubleFlatParens
    FLAT    → accidentalFlatParens
    NATURAL → accidentalNaturalParens
    SHARP   → accidentalSharpParens
    SHARP2  → accidentalDoubleSharpParens

    if font doesn't have this glyph → fall back to layoutMultiGlyphAccidental()

el.push_back(SymElement(s, 0, 0))
bbox = symBbox(s)
```

### 13.5 `Accidental::layoutMultiGlyphAccidental()`

**Signature:** (accidental.cpp:442)

Builds a multi-element glyph sequence: `[left bracket] + [accidental] + [right bracket]`

```
margin = Sid::bracketedAccidentalPadding

// Left bracket
x = 0
switch bracket:
    PARENTHESIS → accidentalParensLeft
    BRACKET     → accidentalBracketLeft
    BRACE       → accidentalCombiningOpenCurlyBrace (y offset: 0.4 × spatium)
el.push_back(SymElement(id, 0, yOffset))
x += symAdvance(id) + margin

// Main accidental
s = symbol()
el.push_back(SymElement(s, x, 0))
x += symAdvance(s) + margin

// Right bracket
switch bracket:
    PARENTHESIS → accidentalParensRight
    BRACKET     → accidentalBracketRight
    BRACE       → accidentalCombiningCloseCurlyBrace (y offset: 0.4 × spatium)
el.push_back(SymElement(id, x, yOffset))

bbox = union of all element bboxes
```

**Sid constants:**
```
Sid::bracketedAccidentalPadding  — margin between bracket and accidental symbol
Sid::smallNoteMag                — scale factor for small notes/accidentals
```

### 13.6 `Accidental::draw()` — Rendering

**Signature:** `void Accidental::draw(Painter*) const` (accidental.cpp:523)

```
if onTabStaff OR note.fixed → return
setPen(curColor)
for each SymElement e in el:
    symbolFont->draw(e.sym, painter, magS(), (e.x, e.y))
```

Note: uses `symbolFont->draw()` directly (not `drawSymbol()`) with explicit x,y offsets from the multi-glyph layout.

### 13.7 Utility Functions

| Function | Line | Purpose |
|----------|------|---------|
| `symbol()` | 306 | Returns `accList[accidentalType].sym` |
| `subtype2value(AccidentalType)` | 316 | Returns `accList[st].offset` (AccidentalVal) |
| `subtype2name(AccidentalType)` | 325 | Returns SymNames for the type's symbol |
| `subtype2symbol(AccidentalType)` | 334 | Returns SymId from accList |
| `value2subtype(AccidentalVal)` | 503 | Reverse lookup: SHARP→SHARP, FLAT→FLAT, etc. |
| `name2subtype(AsciiStringView)` | 343 | SymId lookup → scan accList for match |
| `sym2accidentalVal(SymId)` | 233 | Global: scan accList for SymId → AccidentalVal |

### 13.8 Cross-Reference: Accidental Stacking in Chords

Accidental **positioning relative to note** and **columning for chords** is handled in `layoutchords.cpp` (documented in Chapter 6). The `Accidental::layout()` documented here only computes the accidental's own bbox/glyph list. The x-position relative to the note head is set by the chord layout algorithm.

---

## הבדלים קריטיים — סשן D

### כו. Barline Width Uses Multiple Sid Values
Barline width is NOT a single value — it depends on type (11 distinct cases in `layoutWidth()`). MAP's native renderer must implement the full switch or use a lookup table. Key values: `Sid::barWidth` (thin), `Sid::endBarWidth` (thick), `Sid::doubleBarWidth` (double thin), `Sid::endBarDistance` (gap), `Sid::repeatBarlineDotSeparation` (dot gap).

### כז. Barline Two-Phase Layout
`layout()` sets temporary y1/y2 values; `layout2()` (called after system layout) sets the real values via `getY()`. MAP must also defer final barline vertical positioning to after staff y-positions are known.

### כח. Key Signature Accidental Spacing Uses SMuFL Cutouts
`KeySig::addLayout()` (keysig.cpp:76) uses `SmuflAnchorId::cutOutSW/NW/NE/SE` to tighten accidental spacing. If MAP doesn't implement cutout anchors, key signatures will be wider than webmscore.

### כט. Key Signature Line Positions Are Clef-Dependent
The `ClefInfo::lines[14]` array (clef.cpp:51-92) determines WHERE sharps/flats appear on the staff. Each clef type has its own pattern. Using treble-clef positions for all clefs will produce wrong key signatures.

### ל. Time Signature Vertical Center Formula
`yoff = spatium × (numOfLines - 1) × 0.5 × lineDist` (timesig.cpp:298). On non-standard staves (e.g., 1-line percussion), this centers the time sig correctly. The displacement between numerator and denominator is `0.05sp` for even-line staves, `0.0` for odd-line staves (timesig.cpp:344).

### לא. Clef Mid-Measure Alignment
Clefs at measure start (`rtick == 0`) are left-aligned; mid-measure clefs are right-aligned (`x = -r.right()`) (clef.cpp:218). MAP must check rtick to get correct horizontal positioning.

### לב. Accidental Single vs Multi-Glyph Path
Standard accidentals with parentheses use combined SMuFL glyphs (e.g., `accidentalFlatParens`) for tighter rendering. Only falls back to multi-glyph (separate bracket + accidental) if the font doesn't have the combined glyph (accidental.cpp:430-433). MAP should prefer combined glyphs when available.

---

## פרק 14: Special Elements Layout

This chapter documents the layout algorithms for all "special" notation elements: harmonies, lyrics, tuplets, slurs, ties, hairpins, dynamics, and articulations. It also backfills the `engravingitem.cpp` draw/drag functions that were deferred from Session C.

---

### 14.1 Harmonies — `layoutharmonies.cpp`

#### 14.1.1 `LayoutHarmonies::layoutHarmonies(sl)` — layoutharmonies.cpp:38

**Signature:** `static void layoutHarmonies(const std::vector<Segment*>& sl)`

Entry point for harmony element layout. For each segment in `sl`, iterates all annotations. If the annotation is a Harmony, calls `h->layout()` then `h->autoplaceSegmentElement()`.

```
FOR each Segment s in sl:
  FOR each annotation e in s->annotations():
    IF e->isHarmony():
      h = toHarmony(e)
      h->layout()
      h->autoplaceSegmentElement()
```

#### 14.1.2 `LayoutHarmonies::alignHarmonies(system, sl, harmony, maxShiftAbove, maxShiftBelow)` — layoutharmonies.cpp:56

**Signature:** `static void alignHarmonies(const System* system, const std::vector<Segment*>& sl, bool harmony, const double maxShiftAbove, const double maxShiftBelow)`

Aligns harmonies (or fret diagrams, depending on `harmony` flag) to a common vertical reference within each staff, using an iterative alignment algorithm.

**Algorithm:**
```
IF RealIsNull(maxShiftAbove) AND RealIsNull(maxShiftBelow): RETURN

// Collection: group by staff
FOR each segment in sl:
  FOR each annotation:
    IF (harmony flag AND isHarmony) OR (!harmony AND isFretDiagram):
      staves[staffIdx].append(segment, element)

// Alignment: iterative passes per staff
FOR each staff idx:
  moved = true; pass = 0
  WHILE moved AND pass < 10:                    // magic: 10 max passes (line 212)
    moved = false
    moved |= staves[idx].align(true, getReferenceHeight(true), maxShiftAbove)
    moved |= staves[idx].align(false, getReferenceHeight(false), maxShiftBelow)
  staves[idx].addToSkyline(system)
```

**Inner class `HarmonyList`** (lines 61-187):
- `getReferenceElement(segment, above, visible)` — finds the reference element for alignment at a given segment. Picks the lowest-y for above placement, highest-y for below. Skips non-autoplace elements and manually-offset harmonies.
- `getReferenceHeight(above)` — iterates all segments, returns min (above) or max (below) y-coordinate of reference elements.
- `align(above, reference, maxShift)` — shifts elements toward the reference height. For each segment, finds the reference element (including invisible ones), checks if shift would exceed `maxShift`, and applies `movePosY(-shift)` to all matching elements.
- `addToSkyline(system)` — adds all modified elements to the staff skyline. Special handling for FretDiagram: adds both the diagram and its child Harmony shape.

**Constants:**
| Value | Line | Purpose |
|-------|------|---------|
| `10` | 212 | Maximum alignment passes |
| `0.0` | 111 | Initial reference height |

---

### 14.2 Lyrics — `layoutlyrics.cpp`

#### 14.2.1 `LayoutLyrics::layoutLyrics(options, score, system)` — layoutlyrics.cpp:206

**Signature:** `static void layoutLyrics(const LayoutOptions& options, const Score* score, System* system)`

The master lyrics layout function, with three phases:

**Phase 1: Build visible staves and count above-lyrics** (lines 208-252)
```
Build visibleStaves from system->firstVisibleStaff() / nextVisibleStaff()
FOR each visible staff, each measure, each segment, each voice:
  cr = segment.cr(staffIdx * VOICES + voice)
  FOR each lyric l in cr->lyrics():
    IF l->offsetChanged() != NONE:
      l->rebaseOffset()
      IF placement changed: l->undoResetProperty(Pid::AUTOPLACE)
    l->setOffsetChanged(false)
    IF l->placeAbove(): nA++
  VnAbove[staffIdx] = max(VnAbove[staffIdx], nA)
```

**Phase 2: Call layout2 on all lyrics** (lines 254-273)
```
FOR each visible staff, each measure, each segment, each voice, each lyric:
  l->layout2(VnAbove[staffIdx])
```

**Phase 3: Vertical alignment by range** (lines 275-322)

Switch on `options.verticalAlignRange`:
- **`MEASURE`**: For each measure × staff, compute max-Y across entire measure, apply uniformly.
- **`SYSTEM`**: For each staff, compute global yMax and yMin across all measures, apply to all.
- **`SEGMENT`**: For each segment, compute and apply max-Y individually.

#### 14.2.2 Helper Functions

**`findLyricsMaxY(style, Segment, staffIdx)`** — layoutlyrics.cpp:40
Computes maximum downward shift needed for below-lyrics at a segment. Uses two passes:
1. Builds a south-facing `SkylineLine` from all below-lyrics bounding boxes (with y-offset removed).
2. Computes `minDistance` between the skyline and the staff's south skyline. Returns max shift if distance < `lyricsMinTopDistance`.

**`findLyricsMinY(style, Segment, staffIdx)`** — layoutlyrics.cpp:81
Mirror of findLyricsMaxY for above-lyrics. Uses north-facing skyline. Note: uses `r.bottom()` not `r.top()` (line 98), and negates the result (line 106).

**`applyLyricsMax(style, Segment, staffIdx, yMax)`** — layoutlyrics.cpp:137
Applies the computed yMax to below-lyrics:
```
FOR each below-lyric l:
  l->movePosY(yMax - l->propertyDefault(Pid::OFFSET).y())
  IF l->addToSkyline():
    Add bbox.adjusted(0, 0, 0, lyricsMinBottomDistance) to skyline
```
Note the `.adjusted()` call adds bottom padding equal to `Sid::lyricsMinBottomDistance` (line 152).

**`applyLyricsMin(cr, staffIdx, yMin)`** — layoutlyrics.cpp:171
Applies yMin to above-lyrics. No `.adjusted()` call — no extra padding for above-lyrics.

**Measure overloads** (lines 115-131, 160-165, 185-197): iterate all segments and delegate to segment-level functions.

**Style properties used:**
- `Sid::lyricsMinTopDistance` (lines 47, 87)
- `Sid::lyricsMinBottomDistance` (line 146)

---

### 14.3 Tuplets — `layouttuplets.cpp` + `tuplet.cpp`

#### 14.3.1 `LayoutTuplets::layout(de)` — layouttuplets.cpp:33

**Signature:** `static void layout(DurationElement* de)`

Entry point. Performs **post-order traversal** — nested tuplets are laid out before parents:
```
t = reinterpret_cast<Tuplet*>(de)
IF t is null: RETURN
FOR each element d in t->elements():
  IF d == de: SKIP (avoid self-recursion)
  IF d->isTuplet(): layout(d)    // recursive
t->layout()                       // lay out parent after children
```

#### 14.3.2 `LayoutTuplets::isTopTuplet(cr)` — layouttuplets.cpp:54

Returns true if `cr` is the first element of its top-level tuplet and that tuplet is NOT cross-staff.

#### 14.3.3 `LayoutTuplets::notTopTuplet(cr)` — layouttuplets.cpp:74

Returns true only for cross-staff top tuplets. Logical complement of `isTopTuplet` when `cr` is first element of a cross-staff tuplet; both return false otherwise.

#### 14.3.4 `Tuplet::layout()` — tuplet.cpp:175 **(~470 lines)**

The main tuplet layout function. Algorithm sections:

**A. Number text creation** (lines 183-227):
```
IF numberType != NO_TEXT:
  Create/update Text element (TextStyleType::TUPLET)
  IF SHOW_NUMBER: text = "{numerator}"
  ELSE: text = "{numerator}:{denominator}"
  Detect isSmall: true if ALL elements are small notes/tuplets
  magnification = isSmall ? styleD(smallNoteMag) : 1.0
```

**B. Direction computation** (lines 229-248):
```
IF direction == AUTO:
  up = 1                                    // initial bias upward (line 233)
  FOR each element:
    IF chord with explicit stem direction:
      up += (stemDir==UP ? 1000 : -1000)    // heavy weight (line 239)
    ELSE:
      up += chord->up() ? 1 : -1            // unit weight (line 241)
  _isUp = (up > 0)
```

**C. Bracket decision** — `calcHasBracket(cr1, cr2)` (tuplet.cpp:650):
```
IF bracketType != AUTO: return (bracketType != SHOW_NO_BRACKET)
IF cr1 == cr2: return false
IF either is not Chord: return true
IF no beams or different beams: return true
// Check if tuplet exactly matches a beam group:
beamCount = -1                              // sentinel (line 675)
FOR each element:
  IF tuplet or rest or no beam: return true
  IF beamCount == -1: beamCount = cr.beams()
  ELSE IF beamCount != cr.beams(): return true
IF beamCount < 1: return true               // line 691
// Check beam breaks at boundaries
return !(both start and end define tuplet boundaries)
```

**D. Style distances** (lines 261-284):
```
maxSlope     = styleD(tupletMaxSlope)
outOfStaff   = styleB(tupletOufOfStaff)     // note: typo "Ouf" in source
vHeadDistance = styleMM(tupletVHeadDistance)
vStemDistance = styleMM(tupletVStemDistance)
stemLeft     = styleMM(tupletStemLeftDistance)  - bracketWidth/2
stemRight    = styleMM(tupletStemRightDistance) - bracketWidth/2
noteLeft     = styleMM(tupletNoteLeftDistance)  - bracketWidth/2
noteRight    = styleMM(tupletNoteRightDistance) - bracketWidth/2
```

**E. Endpoint computation (UP direction)** (lines 330-422):
- Stem-up chord with stem: p1.y = stem top, p1.x = stem left - stemLeft
- Stem-down chord or no stem: p1.y = upNote top, p1.x = leftNoteEdge - noteLeft
- If one endpoint is a rest: flatten both y to min(p1.y, p2.y)
- If outOfStaff: clamp to staff bbox top
- **Slope clamping:** if slope exceeds `maxSlope`, adjust the higher endpoint
- **Collision avoidance** (n >= 3 elements, line 403): for middle elements, check if bracket line crosses their bbox; if so, shift both endpoints up by the overlap

**F. Endpoint computation (DOWN direction)** (lines 424-519): Mirror of UP, using bottom of stem/downNote, max instead of min.

**G. Coordinate conversion** (lines 520-542): Convert page-pos to local coordinates, apply user offsets `_p1`/`_p2`.

**H. Number centering** (lines 544-570):
```
y3 = p1.y + (p2.y-p1.y)*0.5 - l1*(isUp?1:-1)     // midpoint + hook height
IF cr1 and cr2 share same beam AND same direction:
  x3 = xx1 + deltax * 0.5                           // center on beam span
ELSE:
  x3 = p1.x + (p2.x-p1.x)*0.5                      // center on bracket span
```

**I. Bracket geometry** (lines 572-622):
- With number: split bracket into left part (3 points) and right part (3 points) with a gap for the number. Gap = `numberWidth + spatium` centered at x3.
- Without number: single 4-point polyline.
- Hook height = `styleMM(tupletBracketHookHeight)` (l1).

**Tuplet style properties** (from `tupletStyle` array, tuplet.cpp:53-64):

| Sid | Pid | Purpose |
|-----|-----|---------|
| `tupletDirection` | `DIRECTION` | Up/Down/Auto |
| `tupletNumberType` | `NUMBER_TYPE` | Show number, ratio, or none |
| `tupletBracketType` | `BRACKET_TYPE` | Auto/Show/Hide |
| `tupletBracketWidth` | `LINE_WIDTH` | Bracket line thickness |
| `tupletFontFace` | `FONT_FACE` | Number font |
| `tupletFontSize` | `FONT_SIZE` | Number size (default 9) |
| `tupletFontStyle` | `FONT_STYLE` | Bold/italic |
| `tupletAlign` | `ALIGN` | Text alignment |
| `tupletMinDistance` | `MIN_DISTANCE` | Autoplace minimum |
| `tupletFontSpatiumDependent` | `SIZE_SPATIUM_DEPENDENT` | Scale with spatium |

**All magic numbers in Tuplet::layout():**

| Value | Line(s) | Purpose |
|-------|---------|---------|
| `1` | 233 | Initial upward direction bias |
| `1000`/`-1000` | 239 | Heavy weight for explicit stem direction |
| `3` | 403, 495 | Minimum element count for collision check |
| `0.5` | 413, 505, 552, 560, 567, 579, 587 | Midpoint calculations |
| `0.0` | 525 | Position origin |

**`Tuplet::sanitizeTuplet()`** (tuplet.cpp:1286) — Post-layout validation. Verifies tuplet ratio consistency and fixes invalid duration assignments. Called after layout when tuplet nesting is detected.

---

### 14.4 Slurs — `slur.cpp`

#### 14.4.1 `Slur::layoutSystem(system)` — slur.cpp:1535

**Signature:** `SpannerSegment* layoutSystem(System* system)`

The primary layout-time slur function, called during system-by-system layout.

**Key constants** (lines 1537-1540):
```cpp
horizontalTieClearance = 0.35 * spatium    // horizontal gap to avoid ties
tieClearance           = 0.65 * spatium    // vertical gap to avoid ties
continuedSlurOffsetY   = 0.4 * spatium     // y-offset for cross-system continuation
continuedSlurMaxDiff   = 2.5 * spatium     // max y-difference for cross-system
```

**Algorithm:**
1. Determine `SpannerSegmentType`: SINGLE (both ends in system), BEGIN (starts here), MIDDLE (passes through), END (ends here).
2. Call `slurPos(&sPos)` to compute base positions.
3. On first segment, call `computeUp()` for direction.
4. **Start anchor (SINGLE/BEGIN):** Check for ties on startNote (forward and back). Adjust p1 vertically/horizontally by `tieClearance`/`horizontalTieClearance`.
5. **Start anchor (END/MIDDLE):** Find first ChordRest in system, position at note+stem+beam with `continuedSlurOffsetY` offset.
6. **End anchor (SINGLE/END):** Check for ties, adjust p2.
7. **End anchor (BEGIN/MIDDLE):** Find last ChordRest, cap vertical diff at `continuedSlurMaxDiff`.
8. Call `slurSegment->layoutSegment(p1, p2)`.

#### 14.4.2 `Slur::computeUp()` — slur.cpp:1798

Direction computation for slurs:
```
SWITCH slurDirection:
  UP/DOWN: set directly
  AUTO:
    default: _up = !startCR->up()     // opposite of stem direction
    cross-beam: force up
    multiple voices: voice > 0 → down, else up
    direction mixture: up
    grace note mixture: up
```

#### 14.4.3 `Slur::slurPos(sp)` — slur.cpp:964 **(~465 lines)**

The main slur positioning function. Computes start (p1) and end (p2) positions.

**Key constants** (lines 968-981):
```cpp
stemSideInset       = 0.5      // how much slur endpoint overlaps stem
stemOffsetX         = 0.35     // horizontal offset from stem
beamClearance       = 0.35     // vertical clearance above/below beam
beamAnchorInset     = 0.15     // inset from beam end
straightStemXOffset = 0.5      // offset for straight (non-curved) flags
minOffset           = 0.2      // minimum vertical offset from note
fakeCutoutSlope     = 1.5      // Gonville/MuseJazz hook cutout slope (1.0 for others)
```

**Anchor types:**
- `SlurAnchor::STEM`: endpoint at stem end (used when hook present + same direction, or same stem direction + stem present)
- `SlurAnchor::NONE`: endpoint at notehead (default)

**Stem anchor positioning** (start, line ~1100-1180):
- Position at stem end point
- Clear stem with `stemOffsetX`
- Handle regular hooks via `fakeCutout` line: `y = slope * (x - stemX) + stemY`
- Handle straight flags: position at `straightStemXOffset * hookWidth`

**Default (NONE) positioning** (line ~1200-1400):
- x = half notehead width, y = note pos + `0.9*sp` (normal) or `0.75*sp` (tablature)
- Beamed notes not at beam end: layout to stem with `beamClearance`
- Direction mixture (Gould p. 111): float along stem, `yd *= 0.5`

**Fallback** (line 987): if no endCR, `p2 = p1 + (5 * spatium, 0)`.

#### 14.4.4 `SlurSegment::computeBezier(p6offset)` — slur.cpp:635

Computes the Bezier control points for a slur segment.

**Shoulder calculation by distance** (lines 693-703):
| Distance (spatium) | shoulderW | shoulderH |
|---------------------|-----------|-----------|
| `d < 2` | 0.60 | `sqrt(d/4) * sp` |
| `d < 10` | 0.50 | `sqrt(d/4) * sp` |
| `d < 18` | 0.60 | `sqrt(d/4) * sp` |
| `d >= 18` | 0.70 | `sqrt(d/4) * sp` |

If slur `isOverBeams()`: `shoulderH *= 0.75` (shoulderReduction, line 703).

**Control point formulas:**
```
c = p2.x    (total width in slur coordinates)
c1 = (c - c*shoulderW)/2 + p6offset.x      // left control point x
c2 = c1 + c*shoulderW + p6offset.x          // right control point x
p3 = (c1, -shoulderH)                        // bezier control point 1
p4 = (c2, -shoulderH)                        // bezier control point 2
```

**Thickness** (lines 768-780):
- `w = SlurMidWidth - SlurEndWidth`, scaled by staffMag
- If span `(c2 - c1) <= spatium`: `w *= 0.5` (thin short slurs)
- Shape path uses `3.0 * w` thickness for collision detection

**Skyline shape:** 32 rectangles (`nbShapes = 32`, line 792) along the CubicBezier curve.

#### 14.4.5 `SlurSegment::avoidCollisions(...)` — slur.cpp:407

Iterative collision avoidance between slur and notation elements.

**Clearance by slur length** (lines 472-479):
| Slur length | Clearance |
|-------------|-----------|
| `< 4 sp` | `0.15 * sp` |
| `< 8 sp` | `0.4 * sp` |
| `< 12 sp` | `0.6 * sp` |
| `>= 12 sp` | `0.75 * sp` |

**Balance factors** (lines 488-497):
- `leftBalance`: 0.1 (stem + same direction), 0.4 (normal), 0.9 (cross-system)
- `rightBalance`: same pattern

**Iteration** (line 505): `maxIter = 30`, `step = ±0.25 * sp`, `npoints = 20` (rectangles along curve).

Even iterations adjust Bezier control points (shape); odd iterations adjust endpoints (tilt). Constraint: slur height ≤ slur width (line 611), tangent points clamped between endpoints (lines 614-623). Steep limit: `M_PI / 4` (45°, line 582).

#### 14.4.6 `SlurSegment::adjustEndpoints()` — slur.cpp:328

Nudges slur endpoints away from staff lines.
```
staffLineMargin = 0.175 + (0.5 * staffLineWidth * (spatium / lw))    // line 331
```
For each endpoint within the staff range, if fractional offset from nearest staff line is within `staffLineMargin`, adjusts the point away.

#### 14.4.7 `SlurSegment::draw(painter)` — slur.cpp:84

Draws the slur with style-dependent pen:
| Style | Pattern | Width Sid |
|-------|---------|-----------|
| Solid | filled brush, RoundCap/Join | `SlurEndWidth * mag` |
| Dotted | `{0.01, 1.99}` | `SlurDottedWidth * mag` |
| Dashed | `{3.00, 3.00}` | `SlurDottedWidth * mag` |
| WideDashed | `{5.00, 6.00}` | `SlurDottedWidth * mag` |

#### 14.4.8 Other Slur Functions

- **`Slur::layout()`** (slur.cpp:1867) — Legacy non-system layout. Palette: `6 * spatium` width (line 1890). Long slurs (span > measure ticks, line 1929): always up.
- **`Slur::fixArticulations(pt, c, up, stemSide)`** (slur.cpp:864) — Adjusts slur endpoint to avoid articulations. `slurTipToArticVertDist = 0.5 * sp * up`, `slurTipInwardAdjust = 0.1 * sp` (lines 871-872).
- **`Slur::isCrossStaff()`** (slur.cpp:2035) — True if start/end CR have different staffMove/vStaffIdx.
- **`Slur::stemSideForBeam(start)`** (slur.cpp:2048) — True if slur anchors to stem side due to beam.
- **`Slur::isOverBeams()`** (slur.cpp:2078) — True only if ALL ChordRests between start and end have beams on the slur side.

#### 14.4.9 Constructors & Edit Helpers

**Constructors:** `SlurTieSegment()` (slur.cpp:71, 76) and `SlurTie()` (slur.cpp:855, 1436) — Base class constructors. SlurTieSegment stores element type (SLUR_SEGMENT); SlurTie stores element type (SLUR). Copy constructors clone grip positions.

**`SlurSegment::changeAnchor(ed, element)`** (slur.cpp:233) — During grip editing, reassigns the start or end anchor to a new EngravingItem. Updates spanner tick/track accordingly.

**`calcStemArrangement(start, end)`** (slur.cpp:1445) — Returns integer encoding stem directions of slur endpoints: 0=both up, 1=start down/end up, 2=start up/end down, 3=both down. Used by `Slur::layoutSystem()` for slur direction heuristics.

**Additional constants:**
- `steepLimit = M_PI / 4` (slur.cpp:582) — Maximum allowed slur slope angle (45°). Slurs steeper than this are flattened.
- `maxRelativeHeight = abs(p2.x())` (slur.cpp:611) — Height cap proportional to slur horizontal span.
- `vertClearance` (slur.cpp:506) — Signed clearance: `slur->up() ? clearance : -clearance`. Flip direction for down-slurs.
- `moveStart` / `moveEnd` (slur.cpp:157-158) — Grip-based booleans: `moveStart = (curGrip == Grip::START)`, `moveEnd = (curGrip == END || curGrip == DRAG)`.

---

### 14.5 Ties — `tie.cpp`

#### 14.5.1 `Tie::layoutFor(system)` — tie.cpp:1154

**Signature:** `TieSegment* layoutFor(System* system)`

Layout the forward (or single) tie segment:
```
IF no startNote or no endNote: create short bow, adjustY, finalize, return
calculateDirection()
slurPos(&sPos)
IF cross-system: n=2, p2.x = system lastNoteRestSegmentX. Else n=1.
fixupSegments(n)
adjustY(p1, p2)
Set type (SINGLE or BEGIN)
adjustX()
finalizeSegment()
addLineAttachPoints()
```

#### 14.5.2 `Tie::layoutBack(system)` — tie.cpp:1232

Layout the back segment (second system of cross-system tie):
```
slurPos(&sPos)
fixupSegments(2), use segment[1]
x = system->firstNoteRestSegmentX(true)
adjustY((x, p2.y), p2)
Set type END
adjustX(), finalizeSegment(), addLineAttachPoints()
```

#### 14.5.3 `Tie::calculateDirection()` — tie.cpp:1036

Direction computation for ties:
```
IF AUTO:
  Multiple voices: tie on stem side (voice-based up for simpleTab)
  Single note + mixed stems: up
  Single note + same stems: opposite of stem
  Chords: find pivot (pair of notes a 2nd or unison apart, |noteDiff| <= 1)
    Notes below pivot → down, above → up
    No unique pivot → majority vote, dead center → opposite of stem
```

#### 14.5.4 `Tie::slurPos(sp)` — tie.cpp:861

Main tie positioning function:
```
_isInside = true if either chord has multiple notes
p1 = startChord pagePos + segment pos + measure pos
y1 = startNote.y + bbox.y (top); if down, add height
Force horizontal if same line and same vStaff
Inside ties: x1 = noteX + headWidth
Outside ties: x1 from outsideTieAttachX()
IF no endChord: p2 = p1 + (3 * spatium, 0)         // line 948
Same logic for p2
```

#### 14.5.5 `TieSegment::computeBezier(shoulderOffset)` — tie.cpp:247

Key differences from slur bezier:
- **Fixed shoulderW = 0.6** (line 272), vs. slur's distance-dependent 0.5-0.7
- **shoulderH formula:** `tieWidthInSp * 0.4 * 0.38` (smallH=0.38, line 267-269)
- Clamped to `[shoulderHeightMin, shoulderHeightMax]` (set by `adjustY`, defaults ~0.4, 1.3)
- Bezier X: `bezier1X = tieWidth * 0.2`, `bezier2X = bezier1X + tieWidth * 0.6`
- Thickness same as slur: `w = SlurMidWidth - SlurEndWidth`
- Shape path: `3.0 * w` thickness (line 325)
- Skyline: **15** rectangles (`nbShapes = 15`, line 348), vs. slur's 32

#### 14.5.6 `TieSegment::adjustY(p1, p2)` — tie.cpp:368

Complex vertical adjustment with three modes:

**Defaults** (lines 383-384):
- `shoulderHeightMin = 0.4`
- `shoulderHeightMax = 1.3`
- `staffLineOffset = 0.110 + (staffLineWidth / 2 / ld)` (line 387)
- `noteHeadOffset = 0.185` (line 388)

**Outside ties:** Auto-adjust by `noteHeadOffset * sp * direction` (line 404). Adjust endpoints to avoid staff lines within `staffLineOffset`. Constrain height to fit within one space.

**Tablature inside ties:** `shoulderHeightMax = 4/3`, anchor at string + `0.2 * direction` (line 461).

**Inside ties (non-tab):** Detect adjacent-tie collisions. `shoulderHeightMax = 4/3` (line 464). Endpoint anchors at quantized line positions with `staffLineOffset`. Height formula: `actualHeight = 4 * shoulderH / 3` (lines 505, 522, 528, 580, 584, 588, 593).

#### 14.5.7 `TieSegment::adjustX()` — tie.cpp:617

Horizontal endpoint adjustment to avoid collisions:

**Key constants:**
- `offsetMargin = 0.25 * sp` (line 620)
- `collisionYMargin = 0.25 * sp` (line 621)
- Ledger line / dot Y tolerance: `0.5 * sp` (lines 679, 689, 758)
- TieBack offset: `sp / 6` (~0.167sp, line 722)
- Default rightward offset: `sp / 8` (~0.125sp, line 724)

**Inside ties (left grip):** Check stems, ledger lines, dots, notes for collision at same tick. If within y-tolerance, offset past the obstacle + `offsetMargin`.

**Outside ties (left grip):** Same-direction stem: check hooks, offset by `offsetMargin`. TieBack: `sp/6`. Default: `sp/8`.

#### 14.5.8 `TieSegment::draw(painter)` — tie.cpp:71

Same as SlurSegment::draw with one extra rule: early return if end note's chord is `CrossMeasure::SECOND` (hides tie toward second chord of cross-measure value, line 76).

#### 14.5.9 Constructors, Edit Helpers & Additional Constants

**Constructors:** `SlurTieSegment()` (tie.cpp:56, 62) — TIE_SEGMENT type. `SlurTie()` (tie.cpp:1005) — TIE type.

**`TieSegment::changeAnchor(ed, element)`** (tie.cpp:153) — Reassigns tie start/end to a different note during grip editing.

**Additional constants:**
- `tieEndpointOffsetSp = 0.2` (tie.cpp:461) — Inward offset from notehead edge in spatium units. Prevents tie endpoints from touching the notehead exactly.
- `adjustForHooks = false` (tie.cpp:619) — Flag for hook collision adjustment; currently disabled by default.

---

### 14.6 Hairpins — `hairpin.cpp`

#### 14.6.1 `HairpinSegment::layout()` — hairpin.cpp:114

The main hairpin segment layout function (~200 lines).

**Phase 1: Dynamic alignment** (lines 126-170)
If autoplace, search for dynamics at start/end segments. Adjust hairpin horizontal position to avoid overlap:
- Start dynamic: `movePosX(dist)` where dist ensures gap >= `autoplaceHairpinDynamicsDistance`
- End dynamic: shorten or lengthen hairpin. `extendThreshold = 3.0 * spatium` (line 168)
- Track `dymax` for vertical alignment with dynamics

**Phase 2: Geometry computation** (lines 188-285)

For **line type** (cresc./dim. text): delegate to `TextLineBaseSegment::layout()`.

For **wedge type** (crescendo/decrescendo hairpin):
```
h1 = hairpinHeight * spatium * 0.5          // full opening half-height (line 203)
h2 = hairpinContHeight * spatium * 0.5      // continuation half-height (line 204)
x1 = text width + spatium * 0.5             // gap after begin text (line 199)
IF x < spatium: x = spatium                  // minimum hairpin = 1 sp (line 210)
rotation = asin(y / len)                     // diagonal hairpin support
circledTipRadius = 0.6 * spatium * 0.5       // if drawCircledTip (line 218)
```

Wedge lines per segment type:
| Type | SINGLE/BEGIN | MIDDLE/END |
|------|-------------|------------|
| CRESC | (x1, 0)→(len, ±h1) | (x1, ±h2)→(len, ±h1) |
| DECRESC | (x1, ±h1)→(len, 0) | (x1, ±h1)→(len, ±h2) |

Rotation transform applied to all lines. Bounding box adjusted by `hairpinLineWidth * 0.5`.

**Phase 3: Autoplace** (lines 295-395)
```
ddiff = isLineType ? 0.0 : spatium * 0.5     // offset between hairpin and dynamics (line 307)
```
Uses skyline collision detection. Aligns start/end dynamics to match hairpin y + ddiff.

#### 14.6.2 `Hairpin::layout()` — hairpin.cpp:693

Trivial: `setPos(0, 0)` then `TextLineBase::layout()`. Real work is in segment layout.

**`Hairpin::setHairpinType(val)`** (hairpin.cpp:679) — Setter for hairpin type (CRESC_HAIRPIN, DECRESC_HAIRPIN, CRESC_LINE, DECRESC_LINE). Triggers style reset: `resetProperty(Pid::LINE_WIDTH)`, updates `_hairpinCircledTip`, `_veloChange`, `_dynRange`.

**Alignment intermediates:** `sdRight = sd->bbox().right() + sd->pos().x()` (line 149), `edLeft = ed->bbox().left() + ed->pos().x()` (line 165) — local computations for start/end dynamic x-coordinates during hairpin-dynamic alignment in `HairpinSegment::layout()`.

#### 14.6.3 `HairpinSegment::editDrag(ed)` — hairpin.cpp:495

Aperture grip drag: `newHeight = current + delta.y / sp / 0.5`. Minimum: `0.5` (line 499).

---

### 14.7 Dynamics — `dynamic.cpp`

#### 14.7.1 `dynList[]` Static Table — dynamic.cpp:59-107

Complete velocity mapping for all 30 dynamic types:

| DynamicType | Velocity | changeInVelocity | Accent | SymId Text |
|-------------|----------|-------------------|--------|------------|
| OTHER | -1 | 0 | true | — |
| PPPPPP | 1 | 0 | false | `<sym>dynamicPiano</sym>` ×6 |
| PPPPP | 5 | 0 | false | ×5 |
| PPPP | 10 | 0 | false | ×4 |
| PPP | 16 | 0 | false | ×3 |
| PP | 33 | 0 | false | ×2 |
| P | 49 | 0 | false | ×1 |
| MP | 64 | 0 | false | mezzo + piano |
| MF | 80 | 0 | false | mezzo + forte |
| F | 96 | 0 | false | forte |
| FF | 112 | 0 | false | ×2 |
| FFF | 126 | 0 | false | ×3 |
| FFFF | 127 | 0 | false | ×4 |
| FFFFF | 127 | 0 | false | ×5 |
| FFFFFF | 127 | 0 | false | ×6 |
| FP | 96 | -47 | true | forte + piano |
| PF | 49 | 47 | true | piano + forte |
| SF | 112 | -18 | true | sforzando + forte |
| SFZ | 112 | -18 | true | sforzando + forte + z |
| SFF | 126 | -18 | true | sforzando + forte ×2 |
| SFFZ | 126 | -18 | true | sforzando + forte ×2 + z |
| SFP | 112 | -47 | true | sforzando + forte + piano |
| SFPP | 112 | -79 | true | sforzando + forte + piano ×2 |
| RFZ | 112 | -18 | true | rinforzando + forte + z |
| RF | 112 | -18 | true | rinforzando + forte |
| FZ | 112 | -18 | true | forte + z |
| M | 96 | -16 | true | mezzo |
| R | 112 | -18 | true | rinforzando |
| S | 112 | -18 | true | sforzando |
| Z | 80 | 0 | true | z |
| N | 49 | -48 | true | niente |

#### 14.7.2 `Dynamic::layout()` — dynamic.cpp:280

```
Call TextBase::layout()
t = track & ~0x3                             // mask to staff base track (line 294)
FOR voice = 0 to VOICES-1:
  e = segment->element(t + voice)
  IF e is Chord AND align == HCENTER:
    // Center on notehead
    movePosX(noteHeadWidth * 0.5)            // line 309
    // SMuFL optical center adjustment
    opticalCenter = symSmuflAnchor(symId, opticalCenter).x
    IF opticalCenter != 0:
      symWidth = symBbox(symId).width
      offset = symWidth/2 - opticalCenter + symBbox.left
      fontScaling = size / 10.0              // DEFAULT_DYNAMIC_FONT_SIZE (line 318)
      movePosX(offset * spatiumScaling * fontScaling)
  ELSE:
    movePosX(e->width * 0.5)                 // line 324
  BREAK
```

#### 14.7.3 `Dynamic::doAutoplace()` — dynamic.cpp:339

Standard skyline-based autoplacement using `Sid::dynamicsMinDistance`.

#### 14.7.4 `Dynamic::velocityChangeLength()` — dynamic.cpp:179

Speed multipliers for velocity change duration:
| VelChangeSpeed | Multiplier |
|----------------|------------|
| SLOW | 1.3 (line 189) |
| FAST | 0.5 (line 191) |
| NORMAL | 0.8 (line 196) |

Formula: `Fraction::fromTicks(ratio * speedMult * Constants::division)` where `ratio = currentTempo / defaultTempo`.

---

### 14.8 Articulations — `articulation.cpp`

#### 14.8.1 `Articulation::layout()` — articulation.cpp:345

```
IF isHiddenOnTabStaff(): _skipDraw = true; RETURN
IF textType != NO_TEXT:
  bRect = FontMetrics(scaledFont).boundingRect(text)
ELSE:
  bRect = symBbox(_symId)
setbbox(bRect.translated(-0.5 * bRect.width, 0.0))    // center horizontally (line 365)
```

#### 14.8.2 `Articulation::layoutCloseToNote()` — articulation.cpp:390

Returns true if articulation should be placed close to notehead (before slurs):
```
IF tab staff AND isStaccato: return false
return (isStaccato OR isTenuto) AND NOT isDouble
```

#### 14.8.3 `Articulation::doAutoplace()` — articulation.cpp:766

Standard skyline-based autoplacement using `Pid::MIN_DISTANCE` (mapped from `Sid::articulationMinDistance`).

#### 14.8.4 `Articulation::setUp(val)` — articulation.cpp:136

Flips articulation symbol between Above/Below variants:
```
IF symName ends with (!dup ? "Above" : "Below"):
  Replace suffix with opposite
ELSE IF symName ends with "Turned":
  IF dup: remove "Turned"
ELSE IF !dup:
  Try appending "Turned"
```

#### 14.8.5 `Articulation::anchorGroup(symId)` — articulation.cpp:483

Groups SymIds into anchor categories:
- **ARTICULATION** (37 SymIds): accent, staccato, staccatissimo, tenuto, marcato, laissez-vibrer, stress, unstress, soft accent (Above/Below variants), guitar fade/swell, wiggle vibrato
- **LUTE_FINGERING** (4 SymIds): thumb, first, second, third
- **OTHER**: everything else

#### 14.8.6 Articulation Combination Functions

**`splitArticulations(set)`** (articulation.cpp:909) — Breaks combined SymIds (e.g., `articAccentStaccatoAbove`) into components using `articulationAboveSplitGroups` (5 entries, line 878).

**`joinArticulations(set)`** (articulation.cpp:926) — Combines pairs (staccato+accent → accentStaccato) using `articulationAboveJoinGroups` (5 entries, line 886). O(n²) pair matching.

**`updateArticulations(set, symId, mode)`** (articulation.cpp:976) — Add/remove/replace with mutual exclusion (marcato replaces accent).

**`flipArticulations(set, placement)`** (articulation.cpp:1035) — Converts Above↔Below using `articulationPlacements` (12 pairs, line 894).

#### 14.8.7 Tab Display Styles

`setupShowOnTabStyles()` (articulation.cpp:816) maps articulation types to tab visibility style pairs:
| Articulation | Common Style | Simple Style |
|--------------|-------------|-------------|
| Staccato | `staccatoShowTabCommon` | `staccatoShowTabSimple` |
| Accent/Marcato | `accentShowTabCommon` | `accentShowTabSimple` |
| Turn/TurnInverted | `turnShowTabCommon` | `turnShowTabSimple` |
| Mordent/ShortTrill | `mordentShowTabCommon` | `mordentShowTabSimple` |
| Brass mute open/closed | `wahShowTabCommon` | `wahShowTabSimple` |
| Guitar golpe | `golpeShowTabCommon` | `golpeShowTabSimple` |

**`Articulation::dragAnchorLines()`** (articulation.cpp:404) — Returns drag visual anchor lines connecting articulation to parent chord's stem or notehead position. Used for visual feedback during drag operations.

**`Articulation::computeCategories()`** (articulation.cpp:681) — Classifies articulation into category groups (ARTICULATION, ORNAMENT, TECHNICAL, FINGERING, etc.) based on `_symId`. Used by stacking/ordering logic and UI filtering.

---

### 14.9 engravingitem.cpp — Draw/Drag Functions (Backfill)

Functions deferred from Session C (engravingitem.cpp draw/drag range).

#### 14.9.1 Color Functions

**`EngravingItem::color()`** (engravingitem.cpp:584) — Returns `_color` member directly.

**`EngravingItem::curColor()`** (engravingitem.cpp:593) — Delegates to `curColor(visible())`.

**`EngravingItem::curColor(isVisible)`** (engravingitem.cpp:602) — Delegates to `curColor(isVisible, color())`.

**`EngravingItem::curColor(isVisible, normalColor)`** (engravingitem.cpp:607) — Priority chain:
1. **Printing:** defaultColor → black; else normalColor
2. **Drop target:** `highlightSelectionColor(voiceIdx)`
3. **Selected/marked:** `selectionColor(voiceIdx, isVisible)`
4. **Invisible:** `invisibleColor()`
5. **Color inversion:** `scoreInversionColor()`
6. **Default:** normalColor

#### 14.9.2 `Compound::draw(painter)` — engravingitem.cpp:1122

Draws child elements by translating the painter to each child's position:
```
FOR each child e in elements:
  painter->translate(e->pos())
  e->draw(painter)
  painter->translate(-e->pos())
```

#### 14.9.3 Symbol Drawing Functions

**`drawSymbol(id, painter, origin, scale)`** (engravingitem.cpp:1683):
`score()->symbolFont()->draw(id, p, magS() * scale, o)`

**`drawSymbol(id, painter, origin, n)`** (engravingitem.cpp:1688):
Draws symbol `n` times: `score()->symbolFont()->draw(id, p, magS(), o, n)`

**`drawSymbols(symbols, painter, origin, scale)`** (engravingitem.cpp:1693):
Batch draw from SymIdList: `score()->symbolFont()->draw(symbols, p, magS() * scale, o)`

**`drawSymbols(symbols, painter, origin, scaleSizeF)`** (engravingitem.cpp:1698):
Non-uniform scaling variant with `SizeF`.

**Symbol metric helpers:**
- `symHeight(id)` (line 1707): `symbolFont()->height(id, magS())`
- `symWidth(id)` (line 1716): `symbolFont()->width(id, magS())`
- `symWidth(symbols)` (line 1721): `symbolFont()->width(symbols, magS())`
- `symAdvance(id)` (line 1730): `symbolFont()->advance(id, magS())`

#### 14.9.4 `drawEditMode(painter, ed, currentViewScaling)` — engravingitem.cpp:2049

Draws grip handles for edit mode:
```
pen = Pen(defaultColor, 0.0)    // hairline pen
FOR i = 0 to ed.grips-1:
  IF Grip(i) == curGrip: brush = formattingMarksColor (filled)
  ELSE: brush = NoBrush (hollow)
  drawRect(ed.grip[i])
```

#### 14.9.5 Drag Pipeline

**`startDrag(ed)`** (engravingitem.cpp:2068): Saves OFFSET and AUTOPLACE properties for undo. `initOffset = offset()`. Alt-drag disables autoplace.

**`drag(ed)`** (engravingitem.cpp:2089): Absolute positioning with grid snapping:
```
offset0 = ed.moveDelta + eed->initOffset
IF ed.hRaster: snap x to hRaster grid
IF ed.vRaster: snap y to vRaster grid
setOffset(x, y)
IF isTextBase: clamp to page boundaries
```

**`endDrag(ed)`** (engravingitem.cpp:2162): Undo-change all saved properties. STYLED → UNSTYLED promotion. `setGenerated(false)`.

#### 14.9.6 EditDrag Pipeline

**`startEditDrag(ed)`** (engravingitem.cpp:2267): Like startDrag but reuses existing edit data; does NOT save initOffset.

**`editDrag(ed)`** (engravingitem.cpp:2286): Incremental: `setOffset(offset() + ed.delta)`. No grid snap, no page clamp. Double-refresh pattern.

**`endEditDrag(ed)`** (engravingitem.cpp:2298): Like endDrag but clears propertyData after processing; conditionally sets GENERATED=false.

**`genericDragAnchorLines()`** (engravingitem.cpp:2186): Computes anchor line from staff position to element's canvas position, used for visual feedback during drag.

**`collectElements(data, e)`** (engravingitem.cpp:1341) — Free function that gathers all visible child elements recursively into a vector. Used by selection and hit-testing to flatten the element tree for a given staff/voice. `data` is cast to `std::vector<EngravingItem*>*`.

**Additional constants:**
- `guessedLocalIndex` (engravingitem.cpp:859) — Trial local index for linked elements, computed by `ctx->assignLocalIndex(mainLoc)`.
- `indexDiff` (engravingitem.cpp:864) — `ctx->lidLocalIndex(_links->lid()) - guessedLocalIndex`, used to detect linked-element ordering mismatches.
- `ngrips` (engravingitem.cpp:2223) — `positions.size()`, number of edit grips for the current element.

---

## פרק 15: Style System — Complete Sid Registry

This chapter documents the complete style system: the `Sid` enum (~1,348 entries), the `StyleDef::styleValues` default array, and the `MStyle` access functions.

---

### 15.1 Style Access Functions — `style.cpp` + `style.h`

The `MStyle` class holds all score style values in a flat array indexed by `Sid`. Key methods:

| Method | Return Type | Description | File:Line |
|--------|-------------|-------------|-----------|
| `value(Sid)` | `PropertyValue` | Returns value; falls back to `StyleDef::styleValues` default | style.cpp:40 |
| `valueMM(Sid)` | `Millimetre` | Returns precomputed spatium-to-mm value | style.cpp:55 |
| `set(Sid, PropertyValue)` | `void` | Sets value; if spatium changed, calls `precomputeValues()` | style.cpp:64 |
| `precomputeValues()` | `void` | For each SPATIUM-typed Sid, computes `value * _spatium` | style.cpp:82 |
| `styleS(Sid)` | `Spatium` | Asserts SPATIUM type, returns value | style.h (inline) |
| `styleMM(Sid)` | `Millimetre` | Alias for `valueMM()` | style.h (inline) |
| `styleD(Sid)` | `double` | Asserts REAL type, returns double | style.h (inline) |
| `styleI(Sid)` | `int` | Returns int (no type assert) | style.h (inline) |
| `styleB(Sid)` | `bool` | Asserts BOOL type, returns bool | style.h (inline) |
| `styleSt(Sid)` | `String` | Asserts STRING type, returns string | style.h (inline) |
| `isDefault(Sid)` | `bool` | Compares vs version-resolved defaults | style.cpp:92 |
| `styleIdx(String)` | `Sid` | Static linear search by XML name | style.cpp:420 |

**Header guards:** `MU_ENGRAVING_STYLEDEF_H` (styledef.h:24), `MU_ENGRAVING_STYLE_H` (style.h:24).

**`readVal`** (style.cpp:250) — local `bool(e.readText().toInt())` for deserializing legacy bool-style properties from XML text nodes.

**Spatium precomputation chain:**
When `Sid::spatium` changes (default 24.8), ALL SPATIUM-typed values are precomputed: `millimetre = spatiumValue * _spatiumPixels`. Access via `styleMM()` is O(1) array lookup, no computation.

**XML read/write** (style.cpp:107-411):
Handles type-specific parsing (SPATIUM, REAL, BOOL, INT, DIRECTION_V, STRING, ALIGN, POINT, SIZE, SCALE, COLOR, PLACEMENT_V/H, HOOK_TYPE, LINE_TYPE) and legacy compatibility tags ("ottavaHook", "beamDistance"→`useWideBeams`, typo "lyricsDashMaxLegth", "dontHidStavesInFirstSystm").

---

### 15.2 Sid Constants — Complete Registry by Category

Source: `styledef.h` (enum, lines 58-1522) and `styledef.cpp` (defaults).

**Type legend:** `Sp` = Spatium, `d` = double, `b` = bool, `i` = int, `s` = String, `Pt` = PointF

#### Page Layout

| Sid | XML Name | Default | Type |
|-----|----------|---------|------|
| `pageWidth` | "pageWidth" | 210.0/INCH (~8.27") | d |
| `pageHeight` | "pageHeight" | 297.0/INCH (~11.69", A4) | d |
| `pagePrintableWidth` | "pagePrintableWidth" | 180.0/INCH | d |
| `pageEvenLeftMargin` | "pageEvenLeftMargin" | 15.0/INCH | d |
| `pageOddLeftMargin` | "pageOddLeftMargin" | 15.0/INCH | d |
| `pageEvenTopMargin` | "pageEvenTopMargin" | 10.0/INCH | d |
| `pageEvenBottomMargin` | "pageEvenBottomMargin" | 20.0/INCH | d |
| `pageOddTopMargin` | "pageOddTopMargin" | 10.0/INCH | d |
| `pageOddBottomMargin` | "pageOddBottomMargin" | 20.0/INCH | d |
| `pageTwosided` | "pageTwosided" | true | b |

#### Staff & System Spacing

| Sid | Default | Type |
|-----|---------|------|
| `staffUpperBorder` | Sp(7.0) | Sp |
| `staffLowerBorder` | Sp(7.0) | Sp |
| `staffHeaderFooterPadding` | Sp(1.0) | Sp |
| `staffDistance` | Sp(6.5) | Sp |
| `instrumentNameOffset` | Sp(1.0) | Sp |
| `akkoladeDistance` | Sp(6.5) | Sp |
| `minSystemDistance` | Sp(8.5) | Sp |
| `maxSystemDistance` | Sp(15.0) | Sp |
| `alignSystemToMargin` | false | b |

#### Vertical Spread

| Sid | Default | Type |
|-----|---------|------|
| `enableVerticalSpread` | true | b |
| `spreadSystem` | Sp(3.5) | Sp |
| `spreadSquareBracket` | Sp(1.0) | Sp |
| `spreadCurlyBracket` | Sp(1.0) | Sp |
| `minSystemSpread` | Sp(8.5) | Sp |
| `maxSystemSpread` | Sp(32.0) | Sp |
| `minStaffSpread` | Sp(3.5) | Sp |
| `maxStaffSpread` | Sp(32.0) | Sp |
| `maxAkkoladeDistance` | Sp(6.5) | Sp |
| `maxPageFillSpread` | Sp(6.0) | Sp |

#### Note Spacing & Stems

| Sid | Default | Type |
|-----|---------|------|
| `stemWidth` | Sp(0.10) | Sp |
| `stemLength` | 3.5 | d |
| `stemLengthSmall` | 2.5 | d |
| `shortestStem` | 2.5 | d |
| `shortenStem` | true | b |
| `minNoteDistance` | Sp(0.5) | Sp |
| `barNoteDistance` | Sp(1.3) | Sp |
| `barAccidentalDistance` | Sp(0.3) | Sp |
| `noteBarDistance` | Sp(1.5) | Sp |
| `measureSpacing` | 1.5 | d |
| `minMeasureWidth` | Sp(8.0) | Sp |
| `staffLineWidth` | Sp(0.11) | Sp |
| `ledgerLineWidth` | Sp(0.16) | Sp |
| `ledgerLineLength` | Sp(0.33) | Sp |

#### Beams

| Sid | Default | Type |
|-----|---------|------|
| `beamWidth` | Sp(0.5) | Sp |
| `useWideBeams` | false | b |
| `beamMinLen` | Sp(1.32) | Sp |
| `beamNoSlope` | false | b |
| `snapCustomBeamsToGrid` | true | b |

#### Barlines

| Sid | Default | Type |
|-----|---------|------|
| `barWidth` | Sp(0.18) | Sp |
| `doubleBarWidth` | Sp(0.18) | Sp |
| `endBarWidth` | Sp(0.55) | Sp |
| `doubleBarDistance` | Sp(0.37) | Sp |
| `endBarDistance` | Sp(0.37) | Sp |
| `repeatBarlineDotSeparation` | Sp(0.37) | Sp |
| `repeatBarTips` | false | b |
| `startBarlineSingle` | false | b |
| `startBarlineMultiple` | true | b |

#### Accidentals & Dots

| Sid | Default | Type |
|-----|---------|------|
| `accidentalDistance` | Sp(0.22) | Sp |
| `accidentalNoteDistance` | Sp(0.22) | Sp |
| `bracketedAccidentalPadding` | Sp(0.45) | Sp |
| `alignAccidentalsLeft` | false | b |
| `keysigAccidentalDistance` | Sp(0.08) | Sp |
| `keysigNaturalDistance` | Sp(0.16) | Sp |
| `dotMag` | 1.0 | d |
| `dotNoteDistance` | Sp(0.35) | Sp |
| `dotRestDistance` | Sp(0.25) | Sp |
| `dotDotDistance` | Sp(0.5) | Sp |

#### Articulations

| Sid | Default | Type |
|-----|---------|------|
| `articulationMag` | 1.0 | d |
| `articulationPosAbove` | Pt(0, 0) | Pt |
| `articulationAnchorDefault` | int(0) | i |
| `articulationAnchorLuteFingering` | int(2) | i |
| `articulationAnchorOther` | int(1) | i |
| `articulationMinDistance` | Sp(0.5) | Sp |
| `lastSystemFillLimit` | 0.3 | d |

#### Slur & Tie

| Sid | Default | Type |
|-----|---------|------|
| `SlurEndWidth` | Sp(0.05) | Sp |
| `SlurMidWidth` | Sp(0.21) | Sp |
| `SlurDottedWidth` | Sp(0.10) | Sp |
| `MinTieLength` | Sp(1.0) | Sp |
| `SlurMinDistance` | Sp(0.5) | Sp |

#### Hairpin

| Sid | Default | Type |
|-----|---------|------|
| `hairpinPlacement` | BELOW | i |
| `hairpinPosAbove` | Pt(0, -3.5) | Pt |
| `hairpinPosBelow` | Pt(0, 3.5) | Pt |
| `hairpinLinePosAbove` | Pt(0, -5.0) | Pt |
| `hairpinLinePosBelow` | Pt(0, 8.0) | Pt |
| `hairpinHeight` | Sp(1.15) | Sp |
| `hairpinContHeight` | Sp(0.5) | Sp |
| `hairpinLineWidth` | Sp(0.12) | Sp |
| `autoplaceHairpinDynamicsDistance` | Sp(0.5) | Sp |

#### Dynamics

| Sid | Default | Type |
|-----|---------|------|
| `dynamicsPlacement` | BELOW | i |
| `dynamicsPosAbove` | Pt(0, -2.0) | Pt |
| `dynamicsPosBelow` | Pt(0, 4.0) | Pt |
| `dynamicsMinDistance` | Sp(0.5) | Sp |
| `autoplaceVerticalAlignRange` | SEGMENT | i |

#### Tuplet

| Sid | Default | Type |
|-----|---------|------|
| `tupletMaxSlope` | 0.5 | d |
| `tupletOufOfStaff` | true | b |
| `tupletVHeadDistance` | Sp(0.5) | Sp |
| `tupletVStemDistance` | Sp(0.25) | Sp |
| `tupletStemLeftDistance` | Sp(0.5) | Sp |
| `tupletStemRightDistance` | Sp(0.5) | Sp |
| `tupletNoteLeftDistance` | Sp(0.0) | Sp |
| `tupletNoteRightDistance` | Sp(0.0) | Sp |
| `tupletBracketHookHeight` | Sp(1.0) | Sp |
| `tupletBracketWidth` | Sp(0.1) | Sp |
| `tupletDirection` | AUTO | i |
| `tupletNumberType` | SHOW_NUMBER | i |
| `tupletBracketType` | AUTO_BRACKET | i |
| `tupletFontSize` | 9.0 | d |
| `tupletMinDistance` | Sp(0.5) | Sp |

#### Lyrics

| Sid | Default | Type |
|-----|---------|------|
| `lyricsPlacement` | BELOW | i |
| `lyricsPosAbove` | Pt(0, -2.0) | Pt |
| `lyricsPosBelow` | Pt(0, 3.0) | Pt |
| `lyricsMinTopDistance` | Sp(1.0) | Sp |
| `lyricsMinBottomDistance` | Sp(2.0) | Sp |
| `lyricsMinDistance` | Sp(0.25) | Sp |
| `lyricsLineHeight` | 1.0 | d |
| `lyricsDashMinLength` | Sp(0.4) | Sp |
| `lyricsDashMaxLength` | Sp(0.8) | Sp |
| `lyricsLineThickness` | Sp(0.10) | Sp |

#### Harmony & Chords

| Sid | Default | Type |
|-----|---------|------|
| `harmonyFretDist` | Sp(0.5) | Sp |
| `minHarmonyDistance` | Sp(0.5) | Sp |
| `maxHarmonyBarDistance` | Sp(3.0) | Sp |
| `maxChordShiftAbove` | Sp(0.0) | Sp |
| `maxChordShiftBelow` | Sp(0.0) | Sp |
| `harmonyPlacement` | ABOVE | i |

#### Note Magnification

| Sid | Default | Type |
|-----|---------|------|
| `smallNoteMag` | 0.7 | d |
| `graceNoteMag` | 0.7 | d |
| `smallStaffMag` | 0.7 | d |
| `smallClefMag` | 0.8 | d |

#### Miscellaneous

| Sid | Default | Type |
|-----|---------|------|
| `spatium` | 24.8 | d |
| `autoplaceEnabled` | true | b |
| `linearStretch` | 1.5 | d |
| `MusicalSymbolFont` | "Leland" | s |
| `MusicalTextFont` | "Leland Text" | s |

**Note:** The full `Sid` enum contains ~1,348 entries (styledef.h:58-1522). The tables above cover all layout-critical values. The remaining entries are primarily text style properties (font face/size/style/color/frame for each of ~40 text style types like title, subtitle, composer, tempo, rehearsalMark, etc.) and tab display options. See Chapter 10 for the subset already documented with layout context.

### 15.3 Text Style Sid Blocks

Each text style defines 13-16 Sid entries. Default font: "Edwin" (except romanNumeral = "Campania", figuredBass = "MScoreBC").

**Default font sizes by style:**

| Size | Text Styles |
|------|-------------|
| 22 | title |
| 14 | subTitle, partInstrument |
| 12 | tempo, metronome, romanNumeral, nashvilleNumber |
| 11 | volta, header, repeatRight |
| 10 | default, composer, lyricist, dynamics, expression, systemText, staffText, rehearsalMark, repeatLeft, frame, textLine, glissando, bend, instrumentChange, sticking, user1-12, letRing, palmMute |
| 9 | tuplet, footer |
| 8 | fingering, lhGuitarFingering, rhGuitarFingering, stringNumber, measureNumber, mmRestRange, figuredBass |

### 15.4 VerticalAlignRange Enum — styledef.h:1533

```cpp
enum class VerticalAlignRange {
    SEGMENT,   // align lyrics per segment
    MEASURE,   // align lyrics per measure
    SYSTEM     // align lyrics across entire system
};
```

Used by `Sid::autoplaceVerticalAlignRange` to control lyrics vertical alignment scope.

---

## פרק 16: Font & Glyph System

This chapter documents the SMuFL glyph system, the SymbolFont rendering engine, and the SymbolFonts registry.

---

### 16.1 SMuFL — `smufl.cpp` + `smufl.h`

#### 16.1.1 Overview

SMuFL (Standard Music Font Layout) is the glyph standard used by webmscore. The `Smufl` class provides the mapping from `SymId` enum values to Unicode codepoints.

**Class `Smufl`** (smufl.h):
- `Code` struct: `{ char32_t smuflCode, char32_t musicSymBlockCode }` with `isValid()` check
- `code(SymId)` — returns Code from static lookup table `s_symIdCodes`
- `smuflCode(SymId)` — returns just the SMuFL codepoint
- `smuflRanges()` — returns `map<String, StringList>` of glyph ranges
- `SMUFL_ALL_SYMBOLS = "All symbols"` — sentinel for all-glyphs range

#### 16.1.2 Initialization — smufl.cpp:56

`initGlyphNamesJson()` parses `/fonts/smufl/glyphnames.json`:
```
FOR each SymId:
  name = SymNames::nameForSymId(id)
  Look up name in JSON
  Parse "codepoint" hex after "U+" → smuflCode
  Parse "alternateCodepoint" → musicSymBlockCode
  Store in s_symIdCodes[id]
```

#### 16.1.3 Ranges — smufl.cpp:113

`smuflRanges()` lazy-loads `/fonts/smufl/ranges.json`. Each range has "description" and "glyphs" array. Also adds "All symbols" entry containing all valid SymId names.

**Header guard:** `MU_ENGRAVING_SMUFL_H` (smufl.h:23).

---

### 16.2 SymbolFont — `symbolfont.cpp` + `symbolfont.h`

#### 16.2.1 Sym Structure — symbolfont.h:91

Each glyph is stored as a `Sym` struct:
```cpp
struct Sym {
    char32_t code;                              // Unicode codepoint
    RectF bbox;                                 // bounding box
    double advance;                             // horizontal advance width
    std::map<SmuflAnchorId, PointF> smuflAnchors; // stem/cutout/optical anchors
    SymIdList subSymbolIds;                      // compound glyph components
    isValid() → code != 0 && bbox.isValid()
    isCompound() → !subSymbolIds.empty()
};
```

#### 16.2.2 Loading — symbolfont.cpp:96

`SymbolFont::load()`:
1. Register font via `fontProvider()->addSymbolFont()`
2. Set font properties (weight, style, family, hinting)
3. For each valid SymId: `computeMetrics()` → query font provider for bbox and advance at `DPI_F`
4. Open `metadata.json`: load anchors, composed glyphs, stylistic alternates, engraving defaults

#### 16.2.3 Anchor Loading — symbolfont.cpp:139

`loadGlyphsWithAnchors()` parses JSON anchors. Maps anchor names to `SmuflAnchorId`:
- `stemDownNW`, `stemUpSE`, `stemDownSW`, `stemUpNW` — stem attachment points
- `cutOutNE`, `cutOutNW`, `cutOutSE`, `cutOutSW` — tight spacing cutouts
- `opticalCenter` — visual center for alignment

All coordinates stored as `PointF(x, -y) * SPATIUM20` (y-axis inverted, scaled to 20-spatium reference).

#### 16.2.4 Composed Glyphs — symbolfont.cpp:180

7 compound ornament glyphs built from sub-symbol sequences:

| SymId | Components |
|-------|------------|
| `ornamentPrallMordent` | prall + mordent |
| `ornamentUpPrall` | ornamentBottomLeftCurvedHead + prall |
| `ornamentUpMordent` | ornamentBottomLeftCurvedHead + prall + mordent |
| `ornamentPrallDown` | prall + ornamentZigZagLineWithRightEnd + ornamentBottomRightCurvedHead |
| `ornamentDownMordent` | ornamentLeftVerticalStroke + prall + mordent |
| `ornamentPrallUp` | prall + ornamentZigZagLineWithRightEnd + ornamentTopRightCurvedHead |
| `ornamentLinePrall` | ornamentLeftVerticalStroke + ornamentZigZagLineWithRightEnd + prall |

#### 16.2.5 Stylistic Alternates — symbolfont.cpp:241

24 alternate glyphs loaded from font metadata:
- 4/6-string tab clef serif variants
- cClef French/French 20th century, fClef French/19th century
- Oversized noteheads (black, half, whole, double-whole, square)
- Brace size variants (small, large, larger)
- Straight flag variants (8th through 1024th, up and down)

#### 16.2.6 Engraving Defaults — symbolfont.cpp:415

`loadEngravingDefaults()` maps 20 SMuFL font metadata keys to Sid values:

| SMuFL Key | Sid | Notes |
|-----------|-----|-------|
| staffLineThickness | `staffLineWidth` | |
| stemThickness | `stemWidth` | |
| beamThickness | `beamWidth` | |
| beamSpacing | `useWideBeams` | >0.75 = wide beams |
| slurEndpointThickness | `SlurEndWidth` | |
| slurMidpointThickness | `SlurMidWidth` | |
| thinBarlineThickness | `barWidth` + `doubleBarWidth` | |
| thickBarlineThickness | `endBarWidth` | |
| dashedBarlineThickness | `barWidth` | |
| dashedBarlineDashLength | (custom) | |
| dashedBarlineGapLength | (custom) | |
| bracketThickness | `bracketWidth` | |
| hairpinThickness | `hairpinLineWidth` | |
| repeatBarlineDotSeparation | `repeatBarlineDotSeparation` | |
| repeatEndBarThickness | `endBarWidth` | |
| lyricsLineThickness | `lyricsLineThickness` | |
| textEnclosureThickness | (stored separately) | |

Also auto-sets `MusicalTextFont` to the font's text companion.

#### 16.2.7 Metric Functions

| Function | Line | Returns | Algorithm |
|----------|------|---------|-----------|
| `bbox(SymId, double mag)` | 570 | `RectF` | Returns `sym.bbox` scaled by mag. Fallback to fallback font if needed |
| `bbox(SymId, SizeF mag)` | 575 | `RectF` | Non-uniform scaling by width/height |
| `bbox(SymIdList, double mag)` | 591 | `RectF` | Union of individual bboxes, translated by cumulative advance |
| `width(SymId, double mag)` | 606 | `double` | `bbox(id, mag).width()` |
| `height(SymId, double mag)` | 611 | `double` | `bbox(id, mag).height()` |
| `advance(SymId, double mag)` | 616 | `double` | `sym.advance * mag`, fallback if needed |
| `width(SymIdList, double mag)` | 625 | `double` | `bbox(list, mag).width()` |
| `smuflAnchor(SymId, SmuflAnchorId, double mag)` | 630 | `PointF` | Anchor point × mag, fallback if needed |

#### 16.2.8 Drawing — symbolfont.cpp:643

`draw(SymId, Painter*, SizeF mag, PointF pos)`:
```
IF compound glyph: delegate to SymIdList draw
IF invalid: use fallback font
Save painter state
Set font size to 20.0 * pixelRatio                    // magic: 20.0 (line 654)
Scale painter by mag
Draw symbol via fontProvider()->drawSymbol()
Restore painter state
```

`draw(SymIdList, Painter*, double mag, PointF startPos)` (line 681):
Iterates list, draws each symbol at accumulated x position (incremented by `advance(id, mag)`).

#### 16.2.9 Additional Functions

**`SymbolFont::loadComposedGlyphs()`** (symbolfont.cpp:180) — Parses `glyphsWithAlternates` and `ligatures` from metadata.json. For each compound glyph, stores the component SymId sequence in `sym.subSymbolIds`. Called during `load()` after metrics are computed.

**`SymbolFont::useFallbackFont(id)`** (symbolfont.cpp:561) — Returns true if this font doesn't have a valid glyph for the given SymId (`!sym(id).isValid()`), signaling the caller to use the fallback font instead.

**Header guard:** `MU_ENGRAVING_SYMBOLFONT_H` (symbolfont.h:23).

---

### 16.3 SymbolFonts Registry — `symbolfonts.cpp` + `symbolfonts.h`

Static manager for all loaded symbol fonts.

#### 16.3.1 Functions

| Function | Line | Description |
|----------|------|-------------|
| `addFont(name, family, filePath)` | 34 | Registers a new SymbolFont |
| `scoreFonts()` | 39 | Returns all registered fonts |
| `fontByName(name)` | 44 | Case-insensitive lookup; lazy-loads on first access; returns fallback if not found |
| `setFallbackFont(name)` | 65 | Sets the fallback font (default: index 0). Logs error if not found |
| `fallbackFont(load)` | 85 | Returns fallback font pointer, optionally triggers load |
| `fallbackTextFont()` | 96 | Returns hardcoded `"Bravura Text"` |

**Default font:** "Leland" (`Sid::MusicalSymbolFont`). **Fallback font:** "Bravura" (hardcoded as index 0 if not explicitly set). **Fallback text font:** "Bravura Text" (always, line 96).

**Font loading is lazy:** `fontByName()` triggers `font->load()` on first access (symbolfont.cpp:57).

**Header guard:** `MU_ENGRAVING_SYMBOLFONTS_H` (symbolfonts.h:24).

---

---

## פרק 17: SVG/Drawing Output Pipeline

> קבצים (תחת `src/`):
> `importexport/imagesexport/internal/svggenerator.cpp` + `.h` (~1,375 שורות)
> `importexport/imagesexport/internal/svgwriter.cpp` + `.h` (~295 שורות)
> `framework/draw/painter.cpp` + `.h` (~830 שורות)
> `framework/draw/bufferedpaintprovider.cpp` + `.h` (~280 שורות)
> `framework/draw/buffereddrawtypes.h` (~120 שורות)
> `framework/draw/svgrenderer.cpp` + `.h` (~80 שורות)

This chapter documents the complete paint-to-SVG output pipeline: how laid-out score elements become SVG markup.

---

### 17.1 Painter API — `painter.cpp` + `painter.h`

The `Painter` class is the central drawing facade. All `draw()` calls throughout the engraving engine go through Painter, which delegates to an `IPaintProvider`.

#### 17.1.1 Construction & Lifecycle

**`Painter(IPaintProviderPtr provider, const std::string& name)`** (painter.cpp:38) — Primary constructor. Calls `init()`.

**`Painter(QPaintDevice* dp, const std::string& name)`** (painter.cpp:45) — Qt constructor. Creates a QPainterProvider wrapping the device.

**`Painter(QPainter* qp, const std::string& name, bool ownsQPainter)`** (painter.cpp:52) — Qt painter wrapper constructor.

**`~Painter()`** (painter.cpp:61) — Destructor; calls `endTarget(false)`.

**`Painter::init()`** (painter.cpp:66) — Initializes state stack with default State (identity transforms), calls `m_provider->beginTarget(m_name)` to start paint session.

**`Painter::endDraw()`** (painter.cpp:95) — End drawing. Calls `endTarget(true)`.

**`Painter::endTarget(bool endDraw)`** (painter.cpp:100) — Internal finalizer. Calls `m_provider->beforeEndTargetHook(this)`, then `m_provider->endTarget(endDraw)`.

**`Painter::isActive()`** (painter.cpp:114) — Returns `m_provider->isActive()`.

**`Painter::setProvider(p, reinit)`** (painter.cpp:87) — Change paint provider. If `reinit`, calls `init()`.

**`Painter::provider()`** (painter.cpp:82) — Returns current `IPaintProviderPtr`.

#### 17.1.2 State Management

**`Painter::save()`** (painter.cpp:195) — Pushes current `State` onto stack. Delegates to provider.

**`Painter::restore()`** (painter.cpp:206) — Pops state. Pushes restored transform to provider via `updateMatrix()`.

**`Painter::setAntialiasing(bool)`** (painter.cpp:135) — Sets antialiasing on provider.

**`Painter::setCompositionMode(CompositionMode)`** (painter.cpp:143) — Sets blending mode on provider.

**`Painter::setFont(const Font&)`** (painter.cpp:151) — Sets font on provider.

**`Painter::font()`** (painter.cpp:159) — Returns font from provider.

**`Painter::setPen(const Pen&)`** (painter.cpp:164) — Sets pen on provider.

**`Painter::setPen(const Color& color)`** (painter.h, inline) — Convenience: creates Pen from color.

**`Painter::setNoPen()`** (painter.cpp:172) — Sets pen style to NoPen.

**`Painter::pen()`** (painter.cpp:177) — Returns current pen.

**`Painter::setBrush(const Brush&)`** (painter.cpp:182) — Sets brush on provider.

**`Painter::brush()`** (painter.cpp:190) — Returns current brush.

#### 17.1.3 Object Markers

**`Painter::beginObject(name, pagePos)`** (painter.cpp:119) — Marks start of a drawable object (for SVG grouping and debugging).

**`Painter::endObject()`** (painter.cpp:127) — Marks end of drawable object.

**`PainterObjMarker`** (painter.h) — RAII class that calls beginObject in constructor, endObject in destructor.

**Header guard:** `MU_DRAW_PAINTER_H` (painter.h). **Debug constant:** `TRACE_OBJ_DRAW` (painter.h) — when defined, enables draw object tracing.

#### 17.1.4 Transform Methods

**`Painter::setWorldTransform(matrix, combine)`** (painter.cpp:218) — Sets or combines world transform matrix. Calls `updateMatrix()`.

**`Painter::worldTransform()`** (painter.cpp:230) — Returns current world transform from state.

**`Painter::scale(sx, sy)`** (painter.cpp:235) — Scales world transform.

**`Painter::rotate(angle)`** (painter.cpp:243) — Rotates world transform.

**`Painter::translate(dx, dy)`** (painter.cpp:251) — Translates world transform.

**`Painter::translate(const PointF& offset)`** (painter.h, inline) — Convenience translate.

**`Painter::window()`** (painter.cpp:259) — Returns logical coordinate window.

**`Painter::setWindow(window)`** (painter.cpp:264) — Sets logical coordinate window.

**`Painter::viewport()`** (painter.cpp:272) — Returns device coordinate viewport.

**`Painter::setViewport(viewport)`** (painter.cpp:277) — Sets device coordinate viewport.

**Internal:**
- `editableState()` (painter.cpp:490) — Returns mutable reference to top of state stack.
- `state()` (painter.cpp:495) — Returns const reference to top state.
- `updateViewTransform()` (painter.cpp:500) — Recalculates view transform from window/viewport: `scaleW = viewport.width / window.width`, `scaleH = viewport.height / window.height`.
- `updateMatrix()` (painter.cpp:509) — Combines world + view transforms and pushes to provider via `setTransform()`.

**Static:** `IPaintProviderPtr extended` (painter.cpp:176) — Optional extended provider for testing. All draw calls dual-dispatch to this if set.

#### 17.1.5 Drawing Methods

**Path drawing:**
- `fillPath(path, brush)` (painter.cpp:287) — Saves state, sets brush, draws path, restores.
- `strokePath(path, pen)` (painter.cpp:300) — Saves state, sets pen, no-brush, draws path, restores.
- `drawPath(path)` (painter.cpp:313) — Draws path with current pen and brush.

**Line drawing:**
- `drawLines(const LineF*, count)` (painter.cpp:321) — Multiple lines from array.
- `drawLines(const PointF*, count)` (painter.cpp:332) — Lines from point pairs. Compile-time assert: `sizeof(LineF) == 2 * sizeof(PointF)`.
- `drawLine(const LineF&)` (painter.h, inline) — Single line.
- `drawLine(p1, p2)` (painter.h, inline) — Line between two points.
- `drawLine(x1, y1, x2, y2)` (painter.h, inline) — Integer coordinates.
- `drawLines(const std::vector<LineF>&)` (painter.h, inline) — Vector of lines.

**Rectangle drawing:**
- `drawRects(const RectF*, count)` (painter.cpp:339) — Multiple rectangles.
- `drawRect(const RectF&)` (painter.h, inline) — Single rectangle.
- `drawRect(x, y, w, h)` (painter.h, inline) — Integer coordinates.
- `drawRoundedRect(rect, xRadius, yRadius)` (painter.cpp:398) — Rounded rectangle.
- `fillRect(rect, brush)` (painter.cpp:442) — Fill only, saves/restores state.

**Ellipse/Arc drawing:**
- `drawEllipse(const RectF&)` (painter.cpp:351) — Inscribed in rectangle.
- `drawEllipse(center, rx, ry)` (painter.h, inline) — Center + radii.
- `drawArc(r, a, alen)` (painter.cpp:386) — Arc with angle in 1/16 degree units (divide by `16.0`).

**Polygon drawing:**
- `drawPolyline(const PointF*, count)` (painter.cpp:361) — Open polyline.
- `drawPolyline(const PolygonF&)` (painter.h, inline) — From PolygonF.
- `drawPolygon(const PointF*, count, FillRule)` (painter.cpp:369) — Filled polygon.
- `drawPolygon(const PolygonF&, FillRule)` (painter.h, inline) — From PolygonF.
- `drawConvexPolygon(const PointF*, count)` (painter.cpp:378) — Convex polygon.
- `drawConvexPolygon(const PolygonF&)` (painter.h, inline) — From PolygonF.

**Text drawing:**
- `drawText(const PointF&, const String&)` (painter.cpp:410) — Text at point.
- `drawText(const RectF&, int flags, const String&)` (painter.cpp:418) — Text in rectangle with alignment.
- `drawText(x, y, const String&)` (painter.h, inline) — Integer coordinates.
- `drawTextWorkaround(Font& f, pos, text)` (painter.cpp:426) — Qt workaround for artificially emboldened fonts.

**Symbol drawing:**
- `drawSymbol(const PointF&, char32_t ucs4Code)` (painter.cpp:434) — Unicode symbol.

**Pixmap drawing:**
- `drawPixmap(const PointF&, const Pixmap&)` (painter.cpp:455) — At point.
- `drawTiledPixmap(rect, pm, offset)` (painter.cpp:463) — Tiled in rectangle.
- `drawPixmap(const PointF&, const QPixmap&)` (painter.cpp:472) — Qt variant.
- `drawTiledPixmap(rect, const QPixmap&, offset)` (painter.cpp:480) — Qt tiled variant.

**Clipping:**
- `setClipRect(const RectF&)` (painter.cpp:523) — Set clip rectangle.
- `setClipping(bool)` (painter.cpp:528) — Enable/disable clipping.

---

### 17.2 BufferedPaintProvider — `bufferedpaintprovider.cpp` + `.h`

Implements `IPaintProvider` by buffering all paint operations into a `DrawData` structure for deferred playback.

#### 17.2.1 DrawData Types — `buffereddrawtypes.h`

**`DrawMode` enum:** `Stroke` (0), `Fill`, `StrokeAndFill`.

**Command structs:**

| Struct | Fields | Purpose |
|--------|--------|---------|
| `DrawPath` | `path`, `pen`, `brush`, `mode` | Buffered path command |
| `DrawPolygon` | `polygon: PolygonF`, `mode: PolygonMode` | Buffered polygon |
| `DrawText` | `pos: PointF`, `text: String` | Text at point |
| `DrawRectText` | `rect`, `flags`, `text` | Text in rectangle |
| `DrawPixmap` | `pos`, `pm: Pixmap` | Pixmap at point |
| `DrawTiledPixmap` | `rect`, `pm`, `offset` | Tiled pixmap |
| `Scale` | `x`, `y` | Scale transform |

**`DrawData::State`:**
```
pen: Pen
brush: Brush
font: Font
transform: Transform
isAntialiasing: bool
compositionMode: CompositionMode
```

**`DrawData::Data`:** Contains `state: State` + vectors of each command type (`paths`, `polygons`, `texts`, `rectTexts`, `pixmaps`, `tiledPixmap`). `empty()` checks all vectors.

**`DrawData::Object`:** `name: string`, `pagePos: PointF`, `datas: vector<Data>`. `empty()` checks if all datas are empty.

**`DrawData`:** `name: string`, `objects: vector<Object>`. `empty()` checks if all objects are empty.

**Header guard:** `MU_DRAW_BUFFEREDDRAWTYPES_H` (buffereddrawtypes.h).

#### 17.2.2 Provider Implementation — `bufferedpaintprovider.cpp`

**Lifecycle:**
- `BufferedPaintProvider::beginTarget(name)` (line 42) — Clears buffer, sets name, creates default object, sets active.
- `BufferedPaintProvider::beforeEndTargetHook(painter)` (line 50) — Empty hook.
- `BufferedPaintProvider::endTarget(endDraw)` (line 54) — Ends default object, deactivates.
- `BufferedPaintProvider::isActive()` (line 64) — Returns `m_isActive`.

**Object management:**
- `BufferedPaintProvider::beginObject(name, pagePos)` (line 69) — Pushes new Object onto `m_currentObjects` stack.
- `BufferedPaintProvider::endObject()` (line 79) — Pops object from stack, moves to `m_buf.objects`. Removes empty trailing Data.

**State management:**
- `BufferedPaintProvider::editableState()` (line 115) — Key pattern: if current Data has drawing commands, creates new Data with copy of current state. Ensures state isolation.
- `BufferedPaintProvider::currentData()` (line 100) — Returns last Data of top object.
- `BufferedPaintProvider::currentState()` (line 105) — Returns state of current Data.
- `BufferedPaintProvider::editableData()` (line 110) — Returns mutable Data reference.
- `BufferedPaintProvider::setAntialiasing(bool)` (line 130)
- `BufferedPaintProvider::setCompositionMode(mode)` (line 135)
- `BufferedPaintProvider::setFont(font)` (line 140), `font()` (line 145)
- `BufferedPaintProvider::setPen(pen)` (line 150), `setNoPen()` (line 155), `pen()` (line 160)
- `BufferedPaintProvider::setBrush(brush)` (line 165), `brush()` (line 170)
- `BufferedPaintProvider::save()` (line 175) — Empty (state managed via Data isolation).
- `BufferedPaintProvider::restore()` (line 179) — Empty.
- `BufferedPaintProvider::setTransform(transform)` (line 183), `transform()` (line 189)

**Draw operations:**
- `BufferedPaintProvider::drawPath(path)` (line 196) — Determines DrawMode from pen/brush, appends `DrawPath` to `paths` vector.
- `BufferedPaintProvider::drawPolygon(points, count, mode)` (line 208) — Converts to `PolygonF`, appends to `polygons`.
- `BufferedPaintProvider::drawText(point, text)` (line 217) — Appends to `texts`.
- `BufferedPaintProvider::drawText(rect, flags, text)` (line 222) — Appends to `rectTexts`.
- `BufferedPaintProvider::drawTextWorkaround(font, pos, text)` (line 227) — Sets font then calls `drawText()`.
- `BufferedPaintProvider::drawSymbol(point, ucs4Code)` (line 233) — Converts char32_t to String, calls `drawText()`.
- `BufferedPaintProvider::drawPixmap(p, pm)` (line 238) — Appends to `pixmaps`.
- `BufferedPaintProvider::drawTiledPixmap(rect, pm, offset)` (line 243) — Appends to `tiledPixmap`.
- Qt variants: `drawPixmap(point, QPixmap)` (line 249), `drawTiledPixmap(rect, QPixmap, offset)` (line 254) — Convert QPixmap to Pixmap.
- `BufferedPaintProvider::setClipRect()` (line 261) — Unimplemented.
- `BufferedPaintProvider::setClipping()` (line 266) — Unimplemented.

**Retrieval:**
- `BufferedPaintProvider::drawData()` (line 271) — Returns accumulated `m_buf`.
- `BufferedPaintProvider::clear()` (line 276) — Resets buffer and object stack.

**Header guard:** `MU_DRAW_BUFFEREDPAINTPROVIDER_H` (bufferedpaintprovider.h).

---

### 17.3 SvgGenerator — `svggenerator.cpp` + `.h`

The SvgGenerator converts QPainter operations to SVG markup. Inherits from `QPaintDevice` and internally uses `SvgPaintEngine`.

**Header guard:** `SVGGENERATOR_H` (svggenerator.h).

#### 17.3.1 SVG Markup Constants — svggenerator.cpp

All SVG string literals are `#define` macros:

| Constant | Value | Purpose |
|----------|-------|---------|
| `SVG_SPACE` | `' '` | Space separator |
| `SVG_QUOTE` | `"\""` | Attribute quote |
| `SVG_COMMA` | `","` | Coordinate separator |
| `SVG_GT` | `">"` | Tag close |
| `SVG_PX` | `"px"` | Pixel unit |
| `SVG_NONE` | `"none"` | No fill/stroke |
| `SVG_EVENODD` | `"evenodd"` | Fill rule |
| `SVG_BUTT` | `"butt"` | Line cap |
| `SVG_SQUARE` | `"square"` | Line cap |
| `SVG_ROUND` | `"round"` | Line cap/join |
| `SVG_MITER` | `"miter"` | Line join |
| `SVG_BEVEL` | `"bevel"` | Line join |
| `SVG_ONE` | `"1"` | Numeric one |
| `SVG_BLACK` | `"#000000"` | Default color |
| `SVG_BEGIN` | `"<svg"` | SVG open tag |
| `SVG_END` | `"</svg>"` | SVG close tag |
| `SVG_WIDTH` | `" width=\""` | Width attr |
| `SVG_HEIGHT` | `" height=\""` | Height attr |
| `SVG_VIEW_BOX` | `" viewBox=\""` | viewBox attr |
| `SVG_X` | `" x="` | X position |
| `SVG_Y` | `" y="` | Y position |
| `SVG_POINTS` | `" points=\""` | Polyline points attr |
| `SVG_D` | `" d=\""` | Path data attr |
| `SVG_MOVE` | `'M'` | Path moveto command |
| `SVG_LINE` | `'L'` | Path lineto command |
| `SVG_CURVE` | `'C'` | Path cubic bezier command |
| `SVG_CLASS` | `" class=\""` | CSS class attr |
| `SVG_ELEMENT_END` | `"/>"` | Self-closing tag |
| `SVG_RPAREN_QUOTE` | `")\""` | Close parens+quote |
| `SVG_TITLE_BEGIN` | `"<title>"` | Title open |
| `SVG_TITLE_END` | `"</title>"` | Title close |
| `SVG_DESC_BEGIN` | `"<desc>"` | Description open |
| `SVG_DESC_END` | `"</desc>"` | Description close |
| `SVG_IMAGE` | `"<image"` | Image element |
| `SVG_PATH` | `"<path"` | Path element |
| `SVG_POLYLINE` | `"<polyline"` | Polyline element |
| `SVG_PRESERVE_ASPECT` | `" preserveAspectRatio=\""` | Aspect ratio attr |
| `SVG_FILL` | `" fill=\""` | Fill attr |
| `SVG_STROKE` | `" stroke=\""` | Stroke attr |
| `SVG_STROKE_WIDTH` | `" stroke-width=\""` | Stroke width attr |
| `SVG_STROKE_LINECAP` | `" stroke-linecap=\""` | Line cap attr |
| `SVG_STROKE_LINEJOIN` | `" stroke-linejoin=\""` | Line join attr |
| `SVG_STROKE_DASHARRAY` | `" stroke-dasharray=\""` | Dash pattern attr |
| `SVG_STROKE_DASHOFFSET` | `" stroke-dashoffset=\""` | Dash offset attr |
| `SVG_STROKE_MITERLIMIT` | `" stroke-miterlimit=\""` | Miter limit attr |
| `SVG_OPACITY` | `" opacity=\""` | Opacity attr |
| `SVG_FILL_OPACITY` | `" fill-opacity=\""` | Fill opacity |
| `SVG_STROKE_OPACITY` | `" stroke-opacity=\""` | Stroke opacity |
| `SVG_FONT_FAMILY` | `" font-family=\""` | Font family attr |
| `SVG_FONT_SIZE` | `" font-size=\""` | Font size attr |
| `SVG_FILL_RULE` | `" fill-rule=\"evenodd\""` | Evenodd fill rule |
| `SVG_VECTOR_EFFECT` | `" vector-effect=\"non-scaling-stroke\""` | Cosmetic pen effect |
| `SVG_MATRIX` | `" transform=\"matrix("` | Matrix transform |

#### 17.3.2 Helper Functions

**`translate_color(color, colorStr, opacityStr)`** (svggenerator.cpp:107) — Converts QColor to SVG hex `#RRGGBB` + alpha float. Defaults: black, 1.0.

**`translate_dashPattern(pattern, penWidth, result)`** (svggenerator.cpp:121) — Multiplies Qt relative dash ratios by pen width for absolute SVG lengths.

**`getClass(element)`** (svggenerator.cpp:134) — Extracts EngravingItem type name for SVG `class` attribute. Returns `class="TypeName"`.

#### 17.3.3 SvgPaintEngine — Core Rendering Engine

**Constructor** (svggenerator.cpp:310) — Initializes with SVG feature set (excludes Pattern, Perspective, ConicalGradient, PorterDuff).

**`SvgPaintEngine::begin(pdev)`** (svggenerator.cpp:1016) — Initializes SVG output:
1. Validates output device
2. Creates QTextStream → internal `header` buffer
3. Writes XML declaration + `<svg>` with width/height/viewBox
4. Writes xmlns declarations, version="1.2", baseProfile="tiny"
5. Writes `<title>` and `<desc>` if set
6. **Switches stream to `body` buffer**

**`SvgPaintEngine::end()`** (svggenerator.cpp:1069) — Finalizes:
1. Switches stream to actual output device
2. Sets UTF-8 codec
3. Streams: header → body → `</svg>`

**`SvgPaintEngine::updateState(state)`** (svggenerator.cpp:1152) — Rebuilds SVG attribute string:
1. Gets CSS class from current element via `getClass()`
2. Converts brush → fill via `qbrushToSvg()`
3. Converts pen → stroke via `qpenToSvg()`
4. Handles opacity if != 1.0
5. **Transform optimization:** if translation-only (m11≈1, m22≈1, m12≈m21≈0) → stores offsets in `_dx`, `_dy`. Otherwise → full `transform="matrix(m11,m12,m21,m22,m31,m32)"`.
6. Pre-rounds m11/m22 to 3 decimals (`* 1000 / 1000.0`) to prevent floating-point noise.

**Magic numbers in updateState:**
- `spacing = ...` — spacing value from element type (line varies)
- `m11`, `m22` — rounding to 3 decimals: `round(m11 * 1000) / 1000.0`

**`SvgPaintEngine::drawPath(path)`** (svggenerator.cpp:1204) — Converts QPainterPath to SVG:
```
FOR each element in path:
  MoveToElement → emit 'M x,y'
  LineToElement → emit 'L x,y'
  CurveToElement → emit 'C x1,y1 x2,y2 x3,y3'
Apply _dx,_dy offsets to all coordinates
Wrap in <path d="..." stateString />
Add fill-rule="evenodd" if OddEvenFill
```

**`SvgPaintEngine::drawPolygon(points, count, mode)`** (svggenerator.cpp:1252):
- PolylineMode → `<polyline points="x,y x,y..."/>`
- PolygonMode → converts to QPainterPath with `closeSubpath()`, delegates to `drawPath()`

**`SvgPaintEngine::drawImage(r, image, sr)`** (svggenerator.cpp:1100) — Encodes image as base64 PNG. Optimization: if original raster in ImageStore is smaller than re-encoded PNG, uses original format.

**`SvgPaintEngine::writeImage(rect, data, mimeType)`** (svggenerator.cpp:1139) — Generates `<image x= y= width= height= preserveAspectRatio="none" xlink:href="data:mime;base64,..."/>`.

**`SvgPaintEngine::drawPixmap(r, pm, sr)`** (svggenerator.cpp:1094) — Converts QPixmap to QImage, delegates to `drawImage()`.

#### 17.3.4 Pen/Brush to SVG Conversion

**`qpenToSvg(pen, stateString)`** (svggenerator.cpp:477) — Builds stroke attributes:
- stroke color (hex)
- `stroke-width` (2 decimal precision; default `qreal(1)` for zero-width pen, line 514)
- `stroke-linecap` (butt/square/round)
- `stroke-linejoin` (miter/bevel/round)
- `stroke-dasharray` + `stroke-dashoffset` (for dashed pens)
- `stroke-miterlimit` (for miter join)
- `stroke-opacity` (if < 1.0)
- `vector-effect="non-scaling-stroke"` (for cosmetic pens)

**`qbrushToSvg(brush, stateString)`** (svggenerator.cpp:580) — Builds fill attributes:
- NoBrush → `fill="none"`
- SolidPattern → `fill="#RRGGBB"` + `fill-opacity` if needed

#### 17.3.5 SvgGenerator — QPaintDevice Wrapper

**`SvgGenerator()`** (svggenerator.cpp:734) — Creates SvgPaintEngine.

**`~SvgGenerator()`** (svggenerator.cpp:746) — Cleans up engine and optionally-owned I/O device.

**Property getters/setters:**
- `title()` / `setTitle()` (lines 761-773) — SVG `<title>` metadata.
- `description()` / `setDescription()` (lines 781-793) — SVG `<desc>` metadata.
- `size()` / `setSize()` (lines 809-823) — Canvas size. Guards against modification during active painting.
- `viewBoxF()` / `viewBox()` / `setViewBox()` (lines 839-871) — SVG viewBox.
- `fileName()` / `setFileName()` (lines 880-903) — Output file. Creates QFile, manages ownership.
- `outputDevice()` / `setOutputDevice()` (lines 915-931) — Alternative I/O device.
- `resolution()` / `setResolution()` (lines 943-953) — DPI setting.
- `paintEngine()` (line 959) — Returns SvgPaintEngine.

**`SvgGenerator::metric(QPaintDevice::PaintDeviceMetric)`** (svggenerator.cpp:968) — Device metrics:
- PdmDepth → `32`
- PdmWidth/PdmHeight → from `_size`
- PdmDpiX/PdmDpiY → from `_resolution`
- PdmHeightMM/PdmWidthMM → computed via `mu::engraving::DPMM`
- PdmNumColors → `0xffffffff`
- PdmDevicePixelRatio → `1`

**`SvgGenerator::setElement(const EngravingItem* e)`** (svggenerator.cpp:1007) — Passes current element to SvgPaintEngine for class attribute generation.

---

### 17.4 SvgWriter — `svgwriter.cpp` + `.h`

The entry point for SVG export. Orchestrates the three-pass rendering pipeline.

**Header guard:** `MU_IMPORTEXPORT_SVGWRITER_H` (svgwriter.h).

#### 17.4.1 `SvgWriter::supportedUnitTypes()` — svgwriter.cpp:45

Returns `{UnitType::PER_PAGE}` — one SVG file per page.

#### 17.4.2 `SvgWriter::write(notation, device, options)` — svgwriter.cpp:50

Main export function (~190 lines). Three-pass rendering pipeline:

**Setup phase:**
1. Asserts notation and score exist
2. Sets printing flags: `score->setPrinting(true)`, `MScore::pdfPrinting = true`, `MScore::svgPrinting = true`
3. Extracts page via `PAGE_NUMBER` option (0-indexed)
4. Creates `SvgGenerator`: sets title (with page number if multi-page), resolution
5. Calculates dimensions with optional `TRIM_MARGIN_SIZE` from configuration
6. Creates `Draw::Painter` with antialiasing, adjusts pixel ratio: `pixelRatio = DPI / printer.logicalDpiX()`
7. Optionally fills white background (unless `TRANSPARENT_BACKGROUND` option set)

**Pass 1 — Staff Lines** (lines 105-167):
Renders staff lines per system, optimizing by drawing once per system when possible. Falls back to per-measure rendering if invisible measures or boxes exist.

**Pass 2 — Beat Coloring** (lines 169-199):
```
beatsColors = parseBeatsColors(options[BEATS_COLORS])
FOR each repeat segment, measure, segment:
  IF isChordRestType:
    IF color exists for current beatIndex:
      Apply color to all notes (Chord) or element (ChordRest)
    beatIndex++
```

**Pass 3 — All Other Elements** (lines 201-225):
Renders remaining elements sorted by z-order. Excludes invisible elements and staff lines (already drawn in Pass 1). Uses `SvgGenerator::setElement()` for SVG class attributes.

#### 17.4.3 `SvgWriter::parseBeatsColors(value)` — svgwriter.cpp:238

Converts QVariant map to `BeatsColors` hash (`QHash<int, QColor>`): maps beat indices to colors for beat-coloring mode.

**Constants:**
- `PAGE_NUMBER` (svgwriter.cpp) — Page index from options.
- `TRIM_MARGIN_SIZE` (svgwriter.cpp) — Trim margin from `configuration()->trimMarginPixelSize()`.

---

### 17.5 SvgRenderer — `svgrenderer.cpp` + `.h`

Renders SVG data back into a Painter. Used for embedding SVG symbols.

**Header guard:** `MU_DRAW_SVGRENDERER_H` (svgrenderer.h).

**`SvgRenderer(const ByteArray& data)`** (svgrenderer.cpp:37) — Constructor. Creates `QSvgRenderer` from data. Conditional: `DRAW_NO_QSVGRENDER` guard for platforms without Qt SVG.

**`~SvgRenderer()`** (svgrenderer.cpp:47) — Deletes QSvgRenderer.

**`SvgRenderer::defaultSize()`** (svgrenderer.cpp:54) — Returns intrinsic SVG size. Under `DRAW_NO_QSVGRENDER`: logs NOT_SUPPORTED, returns empty size.

**`SvgRenderer::render(painter, rect)`** (svgrenderer.cpp:64) — Extracts `QPainter` from framework Painter via `dynamic_pointer_cast<QPainterProvider>`, delegates to `QSvgRenderer::render()`. Under `DRAW_NO_QSVGRENDER`: logs NOT_SUPPORTED.

---

### 17.6 End-to-End Pipeline Diagram

```
Score Elements (laid-out)
    │
    ▼
SvgWriter::write()                    ← Entry point
    │
    ├─ Creates SvgGenerator (QPaintDevice)
    │       │
    │       └─ Owns SvgPaintEngine
    │
    ├─ Creates Draw::Painter(svgGenerator)
    │       │
    │       └─ Painter delegates to QPainterProvider
    │               │
    │               └─ QPainterProvider wraps QPainter(SvgGenerator)
    │
    ├─ Pass 1: Staff Lines
    │   └─ element->draw(painter) → Painter → QPainter → SvgPaintEngine
    │
    ├─ Pass 2: Beat Coloring
    │   └─ Sets colors on elements before draw
    │
    └─ Pass 3: All Other Elements
        └─ For each element (z-order sorted):
            setElement(e) → getClass() → SVG class="TypeName"
            element->draw(painter)
                │
                ▼
            SvgPaintEngine::updateState()
                ├─ qbrushToSvg() → fill attributes
                ├─ qpenToSvg() → stroke attributes
                └─ transform optimization (translate vs matrix)
                │
                ▼
            SvgPaintEngine::drawPath() / drawImage() / drawPolygon()
                │
                ▼
            SVG elements accumulated in body buffer
                │
                ▼
            SvgPaintEngine::end()
                └─ Streams: header + body + </svg> → output device
```

**Coordinate chain:**
```
Score coordinates (spatium-based)
    → Painter world transform (scale + translate)
        → SvgPaintEngine transform optimization:
            IF translation-only: _dx, _dy offsets applied to coordinates
            ELSE: transform="matrix(...)" attribute on SVG element
                → SVG viewport coordinates (pixels at given DPI)
```

**BufferedPaintProvider alternative path:**
```
Score Elements → Painter → BufferedPaintProvider
    → DrawData (in-memory command buffer)
        → Later playback via iterate DrawData::Objects/Datas
```
This path is used for non-SVG output (screen rendering, diff computation) where commands need to be stored before being replayed through a different provider.

---

## הבדלים קריטיים — סשן E

### לג. Slur Bezier Shoulder Depends on Distance
Slur shoulder width (`shoulderW`) varies from 0.5 to 0.7 based on distance in spatium units (slur.cpp:693-700). MAP must implement the same distance-dependent lookup table, not a fixed value. The `shoulderH = sqrt(d/4) * spatium` formula (slur.cpp:701) is particularly important for short slurs.

### לד. Tie Has Fixed Shoulder Width 0.6
Unlike slurs, ties use a fixed `shoulderW = 0.6` (tie.cpp:272). The `shoulderH` formula is different too: `tieWidthInSp * 0.4 * 0.38` (tie.cpp:267-269), clamped to `[shoulderHeightMin, shoulderHeightMax]`. MAP must implement separate bezier computation for ties vs slurs.

### לה. Slur Collision Avoidance is 30-Iteration Max
`avoidCollisions()` (slur.cpp:407) runs up to 30 iterations with alternating shape/endpoint adjustments and `0.25sp` step size. MAP should implement similar iterative collision avoidance or accept slightly different slur shapes.

### לו. Hairpin-Dynamic Alignment is Bidirectional
`HairpinSegment::layout()` (hairpin.cpp:114) searches for dynamics at both start and end segments and adjusts both horizontal position and vertical alignment. The `extendThreshold = 3.0 * spatium` (line 168) controls when a hairpin extends toward an end dynamic vs. shortens to avoid it. The `ddiff = 0.5 * spatium` (line 307) is the vertical offset between hairpin and dynamics centers.

### לז. Dynamic Optical Center Uses SMuFL Anchor
`Dynamic::layout()` (dynamic.cpp:309-322) uses the SMuFL `opticalCenter` anchor to center dynamics on noteheads. Without this anchor, dynamics with asymmetric glyphs (like ff) will appear off-center. The scaling formula accounts for both spatium ratio and font size ratio (default 10.0pt).

### לח. Tuplet Direction Uses Weighted Voting
Direction computation (tuplet.cpp:233-247) uses weight 1000 for explicit stem direction vs. weight 1 for automatic, with an initial upward bias of 1. MAP must implement the same weighted voting, not simple majority.

### לט. Style Spatium Precomputation is Critical
`MStyle::precomputeValues()` (style.cpp:82) converts all SPATIUM-typed Sid values to millimetres when spatium changes. MAP should precompute similarly to avoid per-element multiplication overhead.

### מ. SymbolFont Engraving Defaults Override Style
`loadEngravingDefaults()` (symbolfont.cpp:415) maps 20 SMuFL font metadata values to Sid overrides. Switching fonts (e.g., Leland → Bravura) changes fundamental style values like stem width, beam width, and barline thickness. MAP must reload these defaults when changing musical fonts.

### מא. Tie adjustY Uses 4/3 Height Factor
The tie height-to-shoulder conversion uses `4 * shoulderH / 3` throughout `adjustY()` (tie.cpp:505, 522, 528, 580, 584, 588, 593). This factor converts between the Bezier shoulder height parameter and the actual visual tie height.

### מב. Articulation Close-to-Note Rule
`layoutCloseToNote()` (articulation.cpp:390) returns true for staccato and tenuto (but not double variants). These articulations are placed between the note and the slur. MAP must check this flag to get correct articulation-slur stacking order.

---

## סשנים הבאים

**סשן A (הושלם):** פרקים 1–5 — XML Import → System Breaking ✅
**סשן B (הושלם):** פרקים 6–8 — Chord & Note Positioning, Stem Layout, Beam Layout ✅
**סשן C (הושלם):** פרקים 9+9B — Page Layout, System Stacking, Shape/Skyline/Autoplace ✅
**סשן D (הושלם):** פרקים 11–13 — Barlines, Key/Time Sigs, Accidentals ✅
**סשן E (הושלם):** פרקים 14–16 — Special Elements, Style System (Sid), Font/Glyph + engravingitem draw functions ✅
**סשן F (הושלם):** פרק 17 — SVG/Drawing Output Pipeline ✅

---

## הבדלים קריטיים — סשן F

### מג. SVG Uses Two-Phase Buffering (Header + Body)
SvgPaintEngine accumulates SVG in separate `header` and `body` buffers, then flushes `header → body → </svg>` at `end()`. MAP's SVG export should follow the same pattern to allow metadata (viewBox, title) to precede content.

### מד. Transform Optimization: Translation vs Matrix
`updateState()` (svggenerator.cpp:1152) checks if the current transform is translation-only (m11≈1, m22≈1, m12≈m21≈0). If so, offsets are applied inline to coordinates (`_dx`, `_dy`) rather than emitting `transform="matrix(...)"`. Pre-rounding m11/m22 to 3 decimals prevents floating-point noise in tablature text. MAP should implement the same optimization for SVG file size reduction.

### מה. SVG Element CSS Class from EngravingItem Type
Every paint operation includes a `class="TypeName"` SVG attribute derived from the current `EngravingItem->typeName()`. This enables CSS-based post-processing. MAP must set element type before each draw call to generate equivalent class attributes.

### מו. Three-Pass SVG Rendering Order
SvgWriter renders in three passes: (1) staff lines, (2) beat coloring, (3) all other elements by z-order. Staff lines are drawn first per-system for optimization. MAP's SVG export must preserve this rendering order for visual correctness.

### מז. BufferedPaintProvider State Isolation Pattern
`editableState()` creates a new `Data` element when the current Data already contains drawing commands. This ensures state changes don't retroactively affect buffered commands. MAP's command buffer implementation must follow the same state isolation pattern.

---

## Document Summary

**Total sessions:** A–F (6 sessions, 17 chapters)
**Total source files documented:** ~55 C++ files
**Scope:** Complete webmscore rendering pipeline from MusicXML import through layout, spacing, collision avoidance, style system, font/glyph system, and SVG output
