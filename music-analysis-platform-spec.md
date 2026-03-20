# Music Analysis Platform — Full Specification

## Overview

A React PWA for musicological analysis. The platform allows the user to view, lightly edit, and deeply annotate MusicXML files. All analytical data is stored in the XML file itself (using a custom namespace) and auto-exported as a companion `.analysis.json` file on every save. The JSON is the primary interface for Claude Code and Python analysis scripts.

The platform is fully self-hosted (Vercel), mobile-friendly, and works across devices without manual file sync. The user never manages two files manually — the app handles everything in the background.

---

## Tech Stack

- **Frontend**: React + Vite, PWA
- **Rendering**: Verovio or OpenSheetMusicDisplay (OSMD) — renders MusicXML to SVG in-browser
- **Music parsing**: music21 (Python) for analysis scripts
- **Storage**: Cloud-hosted (Vercel + cloud storage), files accessible from any device
- **Playback**: Tone.js, basic MIDI synthesis, lightweight
- **Language**: UI supports Hebrew and English (user-selectable)

---

## File Architecture

### Primary file: `[piece].xml`
Standard MusicXML with a custom namespace for analytical annotations:

```xml
<note>
  <pitch><step>G</step><octave>4</octave></pitch>
  <type>quarter</type>
  <notations>
    <other-notation mario:tag="passing-tone" mario:motif="A" mario:confidence="high"/>
  </notations>
</note>
```

Standard MusicXML elements (harmony, dynamics, articulations) are written using native MusicXML tags — MuseScore can open these files without issues.

### Auto-exported companion: `[piece].analysis.json`
Generated automatically on every save. Claude Code and Python scripts read this file — never the raw XML directly.

```json
{
  "metadata": {
    "title": "Invention No. 1",
    "composer": "J.S. Bach",
    "key": "C major",
    "time_signature": "2/4",
    "tempo": "Allegro",
    "total_measures": 22
  },
  "source_markings": {
    "dynamics": [...],
    "articulations": [...],
    "ornaments": [...],
    "tempo_markings": [...],
    "repeat_signs": [...],
    "fingerings": [...],
    "technical_indications": [...]
  },
  "analysis": {
    "formal_structure": [...],
    "harmony": [...],
    "melody": [...],
    "motifs": [...],
    "labels": [...],
    "open_questions": [...],
    "freehand_notes": [...]
  }
}
```

---

## Layout

### Three-panel layout

```
┌──────────────┬──────────────────────────────┬──────────────┐
│  Left Panel  │        Score (main)          │ Right Panel  │
│  (150px)     │        (flexible)            │  (150px)     │
└──────────────┴──────────────────────────────┴──────────────┘
```

**Top bar**: piece title, key/time/tempo info, auto-save indicator, Play button, Export button.

**Formal structure strip**: colored band just above the score showing formal sections (Exposition, Development, A, B, etc.) — color-coded by section type.

**Left panel**:
- Library (list of pieces; clicking adds to current session)
- Layer toggles (on/off per analysis category)
- Quick Tags bar (most recently used tags, one click to apply)

**Score (center)**: Verovio/OSMD rendering of the MusicXML. Annotation overlays rendered as SVG on top. Scrolls horizontally or vertically (user preference).

**Right panel**:
- Current selection info (measure number, beat, note pitch/duration)
- Analysis data for the selected element(s)
- Source markings from XML (dynamics, articulations, ornaments) — editable
- Open questions count

**Status bar**: current position, total tags, open questions count, key/range.

---

## Interaction Model

### Selection

| Gesture | Result |
|---|---|
| Click on note | Select single note |
| Click + drag | Select note range |
| Click on empty space in measure | Select full measure |
| Shift + click | Extend selection |
| Ctrl + click on note | Toggle note in/out of selection |
| Double-click on measure | Select all measures in same formal section (if tagged) |
| Click elsewhere (once) | Close tag menu, keep selection |
| Click elsewhere (twice) | Clear selection |

### Tagging flow

1. User makes a selection
2. Context menu opens immediately (no extra click) — smart menu showing tags relevant to what was selected
3. User applies tag(s)
4. Menu closes, annotation appears on score
5. File auto-saves, JSON auto-exports

### Context menu — smart filtering

- **Single note selected** → shows: note type (chord tone / non-chord tone), non-chord subtypes, chromatic/diatonic, fingering, flexible label
- **Multiple notes selected** → shows: motif, label, flexible label, texture
- **Single measure selected** → shows: harmony (chord symbol + degree), cadence type, formal section, tonality
- **Multiple measures selected** → shows: formal structure, motif, sequence, open question
- Bottom of every menu: "More..." expands to full tag list

### Keyboard shortcuts

| Key | Action |
|---|---|
| `H` | Open harmony tagging |
| `M` | Open motif tagging |
| `F` | Open formal structure tagging |
| `T` | Open flexible label (with autocomplete) |
| `Q` | Mark as open question |
| `Escape` | Close menu / clear selection |
| `Ctrl+Z` | Undo |
| `Space` | Play/pause |

---

## Analysis Layers (toggleable)

Each layer can be independently shown or hidden. Multiple layers can be active simultaneously.

| Layer | Color (background/frame) | Description |
|---|---|---|
| Harmony | Blue | Chord symbols, scale degrees, cadences |
| Melody | Green | Note types, non-chord tones |
| Form | Orange | Formal sections, phrases, periods |
| Motif | Purple | Motif labels and variants |
| Labels | Amber | Flexible text labels (arpeggio, enclosure, etc.) |
| Texture | Teal | Homophony, polyphony, etc. |
| Freehand | — | Pen strokes, color annotations |
| Note coloring | — | Colors individual noteheads by type |

### Note coloring sub-layer (independent toggle)

When active, noteheads are colored:
- **Blue** — chord tone
- **Black** — diatonic non-chord tone
- **Orange** — chromatic / outside key
- **Gray** — unanalyzed

Abbreviations can be shown instead of colors (user preference):
- CT, N (neighbor), P (passing), S (suspension), ANT (anticipation), APP (appoggiatura), ESC (escape tone)

---

## Tag Categories — Full Specification

### 1. Melody (note-level)

**Note function:**
- Chord tone (CT)
- Non-chord tone subtypes: passing tone, neighbor tone, suspension, anticipation, appoggiatura, escape tone, pedal tone

**Chromaticism:**
- Diatonic / chromatic / outside key

**Melodic role:**
- Melodic peak (local / global)
- Melodic low point

### 2. Harmony (measure/chord-level)

- **Chord symbol**: free text (C7, Dm7b5, G#dim...) — written to XML as `<harmony>` tag
- **Scale degree**: I, ii, iii, IV, V, V7, vii°, N6, It+6, Fr+6, Ger+6...
- **Function**: T (tonic) / S (subdominant) / D (dominant)
- **Cadence type**: PAC (perfect authentic), IAC (imperfect authentic), HC (half), PC (plagal), DC (deceptive)
- **Tonality event**: modulation / tonicization → to which key
- **Harmonic pedal**: pedal point on which scale degree

### 3. Formal Structure (section-level)

**High level** (piece type):
- Sonata, Rondo, ABA, Theme & Variations, Fugue, Binary, Ternary, Through-composed

**Mid level** (section):
- Exposition, Development, Recapitulation, Coda, Introduction
- A, B, A', C (for Rondo/ABA)
- Refrain, Couplet

**Low level** (phrase):
- Period, Sentence, Phrase, Sub-phrase, Extension, Codetta

**Closure type:**
- Open / Closed / Half-closed

### 4. Motif (multi-note)

- **Label**: A, B, C, A', A''... (user-defined)
- **Variant type**: original, inversion, retrograde, augmentation, diminution, sequence, fragmentation, combination
- **Cross-reference**: "returns in m. X" (links to another location)

### 5. Flexible Labels (multi-note, free text with autocomplete)

Free text labels saved and suggested from history. Examples:
- Arpeggio, enclosure, scale run, tremolo, alberti bass, pedal figure, sequence, chromatic descent...

User types freely; app suggests completions based on previously used labels across all pieces.

### 6. Texture (section-level)

- Homophony / Polyphony / Monophony
- Counterpoint: strict / free / imitative
- Dominant voice/instrument

### 7. Fingering & Technique (note or passage)

- Fingering number on note (1–5 piano / 0–4 guitar)
- Technique label: hand crossing, finger substitution, thumb under, legato fingering, etc.

### 8. Open Questions

- "Unclear" — measure/note not yet resolved
- Free text note ("check relation to m. 12...")

### 9. Freehand

- Pen strokes over score (stylus or mouse)
- Color meanings (user-defined, suggested defaults):
  - Red = complex, needs attention
  - Yellow = analysis incomplete
  - Green = interesting, notable

---

## Python Analysis Scripts

All scripts accept optional `--measures START END` argument to run on a specific range instead of the whole piece.

### Script 1 — Source extraction (auto, on file open)
Extracts all existing markings from MusicXML: dynamics, articulations, ornaments, tempo, fingerings, repeat signs, expression marks. Writes to `source_markings` in JSON. Never overwrites existing analytical data.

### Script 2 — Scale degree analysis
Reads key signature (and key changes) from XML. Analyzes each beat/downbeat and assigns scale degree. Flags potential cadence points with confidence level. Output:

```
m.1: I (high confidence)
m.4: V7 → ⚠ cadence candidate
m.8: V → I → ⚠ cadence candidate (PAC?)
```

User reviews flagged measures, confirms cadence type, marks modulations. Re-running on a range after marking a modulation recalculates degrees from new tonal center.

### Script 3 — Melodic note classification
Classifies each note against the current harmonic context (from Script 2 or from user-entered harmony). Outputs chord tone / non-chord tone with suggested subtype. Confidence level included. User reviews and corrects.

### Script 4 — Melodic repetition detector
Finds recurring interval sequences (exact or transposed). Outputs list of candidates for motif identification. User assigns motif labels from the list.

### Script 5 — Tessitura and melodic peaks
Per voice: range, peak note and location, low point and location. Useful for phrase analysis.

### Script 6 — Full library export
Reads all `.analysis.json` files in the library. Produces a single `library_export.csv` — one row per measure, columns for all analysis categories. Ready for Claude Code to query across 80+ pieces.

---

## Sync & Storage

- Files live in cloud storage, accessible from any device
- Opening a file on desktop adds it to the library, visible on mobile immediately
- No manual sync — always the same state across devices
- Internet connection required for sync; local cache for offline viewing

---

## Editing (light)

The platform supports small edits directly to the XML without opening MuseScore:

- Click note → popup: change pitch, duration, fingering, dynamic, articulation
- Click measure → add/edit chord symbol, dynamic, tempo marking
- Full structural editing (adding/deleting notes, changing time signature, etc.) → done in MuseScore, re-import XML

All edits write directly to the XML. Auto-save triggers JSON re-export.

---

## Playback

- Tone.js MIDI synthesis — lightweight, no audio samples
- Play from cursor position
- Highlight current measure during playback
- No investment in audio quality — functional only

---

## Claude Code Interface

Claude Code works exclusively with `.analysis.json` files and script outputs. It never reads raw XML.

Typical workflows:
- "Find all measures tagged as PAC cadence across the library"
- "How many times does motif A appear in inversion across all pieces?"
- "List all measures where I marked an open question"
- "Compare harmonic rhythm between pieces X and Y"
- "Find all places where I tagged 'enclosure'"

The JSON structure is designed to be flat and queryable — no deep nesting, consistent field names, human-readable values.

---

## Future / Open

- AI-assisted analysis suggestions (human-in-the-loop, user confirms)
- Tablature view linked to score (guitar pieces)
- Export analytical annotations as formatted PDF (for dissertation)
- Collaborative annotation (share piece with supervisor)
