#!/usr/bin/env python3
"""
cpp_verifier.py — Compare extracted C++ items against the pipeline document.

Usage:
    python cpp_verifier.py --extracted extracted_B.json --doc WEBMSCORE_RENDERING_PIPELINE.md
    python cpp_verifier.py --extracted extracted_B.json --doc ... --chapter 6
    python cpp_verifier.py --extracted extracted_B.json --doc ... --fix  # show suggested additions

Output: coverage report showing what's documented vs. what's missing.
"""

import json
import re
import sys
from pathlib import Path
from typing import Optional

# Fix Windows console encoding
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# ──────────────────────────────────────────────────────────────────────────────
# File → Chapter mapping
# Each file name (basename) maps to the chapter it primarily belongs to.
# When --chapter N is used, only files for chapter N are checked.
# ──────────────────────────────────────────────────────────────────────────────

# For files that span multiple chapters, specify which line ranges belong to which chapter.
# Functions outside these ranges are skipped when checking a specific chapter.
# Format: "filename": {chapter_num: (start_line, end_line), ...}
CHAPTER_RANGES = {
    "chord.cpp": {
        6: [(800, 2082)],       # addLedgerLines → end of layoutPitched
        7: [(978, 1875)],       # computeUp → layoutStem helpers
    },
    "note.cpp": {
        6: [(980, 1175), (2183, 2450)],   # geometry helpers + layout/layout2/setDotY
    },
    "engravingitem.cpp": {
        10: [(0, 99999)],  # autoplace section — full file
        14: [(580, 2720)],  # draw/drag functions backfill
    },
}

FILE_TO_CHAPTER = {
    # Session A
    "importmusicxml.cpp": 1,
    "importmusicxmlpass1.cpp": 1,
    "importmusicxmlpass2.cpp": 1,
    "score.cpp": 1,
    "layout.cpp": 2,
    "layoutcontext.cpp": 2,
    "layoutoptions.h": 2,
    "layoutmeasure.cpp": 3,
    "measure.cpp": 3,
    "segment.cpp": 4,
    "layoutsystem.cpp": 5,
    # Session B
    "layoutchords.cpp": 6,
    "note.cpp": 6,
    # chord.cpp spans chapters 6 and 7 — assign to 6 (main entry)
    "chord.cpp": 6,
    "stem.cpp": 7,
    "hook.cpp": 7,
    "stem.h": 7,
    "hook.h": 7,
    "beam.cpp": 8,
    "beam.h": 8,
    "layoutbeams.cpp": 8,
    # Session C
    "layoutpage.cpp": 9,
    "system.cpp": 9,
    "verticalgapdata.cpp": 9,
    "shape.cpp": 10,
    "shape.h": 10,
    "skyline.cpp": 10,
    "skyline.h": 10,
    "engravingitem.cpp": 10,
    # Session D
    "barline.cpp": 11,
    "keysig.cpp": 12,
    "timesig.cpp": 12,
    "clef.cpp": 12,
    "accidental.cpp": 13,
    # Session E
    "layoutharmonies.cpp": 14,
    "layoutlyrics.cpp": 14,
    "layouttuplets.cpp": 14,
    "tuplet.cpp": 14,
    "slur.cpp": 14,
    "tie.cpp": 14,
    "hairpin.cpp": 14,
    "dynamic.cpp": 14,
    "articulation.cpp": 14,
    "styledef.cpp": 15,
    "style.cpp": 15,
    "smufl.cpp": 16,
    "smufl.h": 16,
    "symbolfont.cpp": 16,
    "symbolfont.h": 16,
    "symbolfonts.cpp": 16,
    "symbolfonts.h": 16,
    "styledef.h": 15,
    "style.h": 15,
    # Session F
    "svggenerator.cpp": 17,
    "svggenerator.h": 17,
    "svgwriter.cpp": 17,
    "svgwriter.h": 17,
    "painter.cpp": 17,
    "painter.h": 17,
    "bufferedpaintprovider.cpp": 17,
    "bufferedpaintprovider.h": 17,
    "buffereddrawtypes.h": 17,
    "svgrenderer.cpp": 17,
    "svgrenderer.h": 17,
}

# ──────────────────────────────────────────────────────────────────────────────
# Chapter boundaries in the document
# ──────────────────────────────────────────────────────────────────────────────

CHAPTER_PATTERN = re.compile(r'^## פרק (\d+):', re.MULTILINE)


def load_document(doc_path: str) -> str:
    with open(doc_path, encoding="utf-8", errors="replace") as f:
        return f.read()


def get_chapter_text(doc: str, chapter_num: Optional[int]) -> str:
    """Extract text for a specific chapter (or all chapters if None)."""
    if chapter_num is None:
        return doc

    matches = list(CHAPTER_PATTERN.finditer(doc))
    for i, m in enumerate(matches):
        if int(m.group(1)) == chapter_num:
            start = m.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(doc)
            return doc[start:end]

    return ""  # chapter not found


# ──────────────────────────────────────────────────────────────────────────────
# Coverage checks
# ──────────────────────────────────────────────────────────────────────────────

# Constants we don't need to track (Qt/stdlib boilerplate)
SKIP_CONSTANTS = {
    "Q_UNUSED", "Q_OBJECT", "QT_VERSION",
}

# Layout-relevant: method names that START WITH these prefixes (case-insensitive).
# These are almost always layout computation functions.
LAYOUT_PREFIXES = [
    "layout", "compute", "calc", "render", "build", "collect",
    "autoplace", "position", "place",
]

# Layout-relevant: method names that CONTAIN these exact substrings as whole words
# (surrounded by camelCase boundaries or underscores).
# More specific than a flat substring to avoid "note" matching "annotate" etc.
LAYOUT_SUBSTRINGS = [
    "Stem", "Beam", "Ledger", "Accidental", "Skyline", "Grace",
    "Spacing", "Stretch", "Spring", "Barline", "KeySig", "TimeSig",
    "Clef", "Slur", "Hairpin", "Tuplet", "Harmony", "Lyric",
    "Glyph", "Font", "Symbol", "Anchor", "Width", "Height",
    "MinStem", "MaxSlope", "StemLength", "BeamAnchor",
    "NotesGroup", "ChordRest",
]

# Always skip these — serialization, accessibility, Qt, drag, property boilerplate
NOISE_PATTERNS = re.compile(
    r'(?i)(write|readProp|accessible|screenReader|qml|setProperty|getProperty'
    r'|propertyDefault|undoChange|scanElements|localSpatium'
    r'|startDrag|endDrag|editDrag|acceptDrop'
    r'|nextElement|prevElement|nextSegment|prevSegment'
    r'|nextTied|firstTied|lastTied|connectTied|disconnectTied'
    r'|accessibleInfo|accessibleExtra|noteValName|userVelocity'
    r'|customizeVel|setTrack|setScore|setColor|reset|clone'
    r'|toString|fromString|operator|IF_ASSERT|processSiblings'
    r'|ChordRest::ChordRest|Chord::Chord|Note::Note)'
)


def is_layout_relevant(bare_name: str) -> bool:
    """Return True if this METHOD NAME (no class prefix) is layout-critical."""
    if len(bare_name) <= 2:
        return False
    if bare_name in ("switch", "while", "if", "for"):
        return False
    if NOISE_PATTERNS.search(bare_name):
        return False

    lower = bare_name.lower()

    # Starts with a layout prefix
    for prefix in LAYOUT_PREFIXES:
        if lower.startswith(prefix):
            return True

    # Contains a specific layout substring (case-sensitive word-part matching)
    for sub in LAYOUT_SUBSTRINGS:
        if sub in bare_name:
            return True

    return False


def check_function_coverage(functions: list, doc_text: str) -> tuple[list, list]:
    """Returns (documented, missing) lists — only layout-relevant functions."""
    documented = []
    missing = []

    for func in functions:
        name = func["name"]
        # Only use the method name (after last ::), never the class prefix
        bare_name = name.split("::")[-1]

        if not is_layout_relevant(bare_name):
            continue

        # Search for method name in document (word boundary)
        pattern = r'\b' + re.escape(bare_name) + r'\b'
        if re.search(pattern, doc_text):
            documented.append(func)
        else:
            missing.append(func)

    return documented, missing


def check_array_coverage(arrays: list, doc_text: str) -> tuple[list, list]:
    """Returns (documented, missing) lists."""
    documented = []
    missing = []

    for arr in arrays:
        name = arr["name"]
        if len(name) <= 2:
            continue

        pattern = r'\b' + re.escape(name) + r'\b'
        if re.search(pattern, doc_text):
            # Also check if values appear (rough check)
            arr["in_doc"] = True
            documented.append(arr)
        else:
            missing.append(arr)

    return documented, missing


def check_constant_coverage(constants: list, doc_text: str) -> tuple[list, list]:
    """Returns (documented, missing) lists for named constants."""
    documented = []
    missing = []

    for const in constants:
        name = const["name"]
        if name in SKIP_CONSTANTS or len(name) <= 2:
            continue
        # Only care about named constants with meaningful names (not single letters)
        if re.match(r'^[a-z]$', name):
            continue

        pattern = r'\b' + re.escape(name) + r'\b'
        if re.search(pattern, doc_text):
            documented.append(const)
        else:
            missing.append(const)

    return documented, missing


def check_value_accuracy(arrays: list, doc_text: str) -> list:
    """
    For documented arrays, verify that the values in the document match C++.
    Returns list of discrepancies.
    """
    discrepancies = []

    for arr in arrays:
        name = arr["name"]
        values = arr.get("values", [])
        if not values or len(name) <= 2:
            continue

        # Find the array name in doc, then check nearby values
        idx = doc_text.find(name)
        if idx == -1:
            continue

        # Look at 200 chars after the name mention for value patterns
        context = doc_text[idx:idx + 300]
        cpp_values_str = ", ".join(values[:8])  # First 8 values as reference

        # Check if numeric values appear nearby
        cpp_nums = re.findall(r'-?\d+\.?\d*', cpp_values_str)
        doc_nums_in_context = re.findall(r'-?\d+\.?\d*', context)

        cpp_set = set(cpp_nums)
        doc_set = set(doc_nums_in_context)
        extra_in_doc = doc_set - cpp_set - {"0", "1", "2", "3", "4", "5", "6", "7", "8", "9"}

        if extra_in_doc and len(cpp_nums) >= 3:
            # Possible value mismatch
            discrepancies.append({
                "array": name,
                "cpp_values": values[:8],
                "doc_context": context[:150].replace("\n", " "),
                "note": f"Values in doc near '{name}' may not match C++. Verify manually.",
            })

    return discrepancies


# ──────────────────────────────────────────────────────────────────────────────
# Report
# ──────────────────────────────────────────────────────────────────────────────

def print_report(extracted: dict, doc: str, chapter: Optional[int], show_fix: bool):
    session = extracted.get("session", "?")
    files = extracted.get("files", [])

    if chapter:
        doc_text = get_chapter_text(doc, chapter)
        if not doc_text:
            print(f"ERROR: Chapter {chapter} not found in document.")
            sys.exit(1)
        scope = f"Chapter {chapter}"
    else:
        doc_text = doc
        scope = "Full document"

    print(f"\n{'='*70}")
    print(f"WEBMSCORE Pipeline -- Coverage Report")
    print(f"Session: {session}  |  Scope: {scope}")
    print(f"{'='*70}\n")

    all_missing_funcs = []
    all_missing_arrays = []
    all_missing_consts = []
    all_discrepancies = []

    for file_data in files:
        # Filter: if --chapter given, only check files mapped to that chapter
        if chapter is not None:
            fname = file_data.get("file", "")
            mapped_chapter = FILE_TO_CHAPTER.get(fname)
            if mapped_chapter is not None and mapped_chapter != chapter:
                continue  # skip this file for this chapter
        if not file_data.get("exists"):
            print(f"  ⚠ MISSING FILE: {file_data['file']}")
            continue

        fname = file_data["file"]
        funcs = file_data.get("functions", [])
        arrays = file_data.get("arrays", [])
        consts = file_data.get("constants", [])

        doc_funcs, miss_funcs = check_function_coverage(funcs, doc_text)
        doc_arrays, miss_arrays = check_array_coverage(arrays, doc_text)
        doc_consts, miss_consts = check_constant_coverage(consts, doc_text)
        discrepancies = check_value_accuracy(doc_arrays, doc_text)

        total_tracked = len(doc_funcs) + len(miss_funcs)
        covered = len(doc_funcs)
        pct = (covered / total_tracked * 100) if total_tracked else 100

        print(f"  {fname}")
        print(f"    Functions: {covered}/{total_tracked} documented ({pct:.0f}%)")
        print(f"    Arrays:    {len(doc_arrays)}/{len(doc_arrays)+len(miss_arrays)} documented")
        print(f"    Constants: {len(doc_consts)}/{len(doc_consts)+len(miss_consts)} documented")

        for f in miss_funcs:
            all_missing_funcs.append({**f, "file": fname})
        for a in miss_arrays:
            all_missing_arrays.append({**a, "file": fname})
        for c in miss_consts:
            all_missing_consts.append({**c, "file": fname})
        all_discrepancies.extend(discrepancies)

    # --- Missing Functions ---
    if all_missing_funcs:
        print(f"\n{'-'*70}")
        print(f"MISSING FUNCTIONS ({len(all_missing_funcs)} total):")
        print(f"{'-'*70}")
        for f in all_missing_funcs:
            print(f"  MISS  {f['name']}()  --  {f['file']}:{f['line']}")
            if show_fix:
                print(f"        Signature: {f.get('signature','?')[:80]}")
    else:
        print(f"\n  OK All functions documented.")

    # --- Missing Arrays ---
    if all_missing_arrays:
        print(f"\n{'-'*70}")
        print(f"MISSING ARRAYS ({len(all_missing_arrays)} total):")
        print(f"{'-'*70}")
        for a in all_missing_arrays:
            vals = a.get("values", [])[:8]
            print(f"  MISS  {a['name']}  --  {a['file']}:{a['line']}")
            print(f"        Values: {{ {', '.join(vals)} }}")
    else:
        print(f"\n  OK All arrays documented.")

    # --- Missing Named Constants ---
    if all_missing_consts:
        print(f"\n{'-'*70}")
        print(f"MISSING CONSTANTS ({len(all_missing_consts)} total):")
        print(f"{'-'*70}")
        for c in all_missing_consts:
            print(f"  MISS  {c['name']} = {c.get('value','?')[:60]}  --  {c['file']}:{c['line']}")
    else:
        print(f"\n  OK All named constants documented.")

    # --- Value Discrepancies ---
    if all_discrepancies:
        print(f"\n{'-'*70}")
        print(f"POSSIBLE VALUE DISCREPANCIES ({len(all_discrepancies)}) -- verify manually:")
        print(f"{'-'*70}")
        for d in all_discrepancies:
            print(f"  WARN  Array: {d['array']}")
            print(f"        C++ values: {d['cpp_values']}")
            print(f"        Doc context: {d['doc_context'][:100]}")

    # --- Summary ---
    total_issues = len(all_missing_funcs) + len(all_missing_arrays) + len(all_missing_consts)
    print(f"\n{'='*70}")
    if total_issues == 0:
        print("OK COVERAGE: COMPLETE -- No gaps found.")
    else:
        print(f"GAPS: {total_issues} items need documentation.")
        print(f"  Missing functions: {len(all_missing_funcs)}")
        print(f"  Missing arrays:    {len(all_missing_arrays)}")
        print(f"  Missing constants: {len(all_missing_consts)}")
    print(f"{'='*70}\n")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Verify C++ pipeline documentation coverage")
    parser.add_argument("--extracted", "-e", required=True, help="JSON from cpp_extractor.py")
    parser.add_argument("--doc", "-d", required=True, help="WEBMSCORE_RENDERING_PIPELINE.md path")
    parser.add_argument("--chapter", "-c", type=int, help="Only check specific chapter number")
    parser.add_argument("--fix", action="store_true", help="Show signatures for missing functions")
    args = parser.parse_args()

    with open(args.extracted, encoding="utf-8") as f:
        extracted = json.load(f)

    doc = load_document(args.doc)
    print_report(extracted, doc, args.chapter, args.fix)


if __name__ == "__main__":
    main()
