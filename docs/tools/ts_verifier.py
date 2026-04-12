#!/usr/bin/env python3
"""
ts_verifier.py — Compare extracted TypeScript items against the MAP pipeline document.

Usage:
    python ts_verifier.py --extracted extracted_G.json --doc MAP_RENDERING_PIPELINE.md
    python ts_verifier.py --extracted extracted_G.json --doc ... --chapter 1
    python ts_verifier.py --extracted extracted_G.json --doc ... --fix

Output: coverage report showing what's documented vs. what's missing.

Parallel to cpp_verifier.py — same report format, adapted for TypeScript.
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
# ──────────────────────────────────────────────────────────────────────────────

FILE_TO_CHAPTER = {
    # Session G
    "StyleDef.ts": 1,
    "index.ts": 2,
    "LayoutOrchestrator.ts": 2,
    "xmlExtractor.ts": 3,
    "extractorTypes.ts": 3,
    # Session H
    "horizontalLayout.ts": 4,
    "LayoutMeasure.ts": 4,
    "LayoutSystem.ts": 5,
    "LayoutPage.ts": 6,
    # Session I
    "chordLayout.ts": 7,
    "LayoutChords.ts": 7,
    "Note.ts": 7,
    "Stem.ts": 8,
    "Hook.ts": 8,
    "LayoutBeams.ts": 9,
    # Session J
    "verticalLayout.ts": 10,
    "Shape.ts": 11,
    "Skyline.ts": 11,
    "LedgerLine.ts": 12,
    "atomicElements.ts": 12,
    # Session K
    "svgRenderer.ts": 13,
    "Painter.ts": 13,
    "SVGPainter.ts": 13,
    "leland.ts": 14,
    "anchors.ts": 14,
    "types.ts": 15,
    "spatium.ts": 15,
}

# For files that span multiple chapters
CHAPTER_RANGES = {
    # Add as needed during documentation
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
# Relevance filters
# ──────────────────────────────────────────────────────────────────────────────

# Skip: test helpers, React hooks, trivial utility names
SKIP_NAMES = {
    "useState", "useEffect", "useRef", "useCallback", "useMemo",
    "toString", "valueOf", "constructor",
}

# Always relevant: function names containing these substrings
LAYOUT_SUBSTRINGS = [
    "layout", "Layout", "compute", "Compute", "calc", "Calc",
    "render", "Render", "build", "Build", "collect", "Collect",
    "autoplace", "Autoplace", "position", "Position",
    "Stem", "Beam", "Ledger", "Accidental", "Skyline",
    "Spacing", "Stretch", "Spring", "Barline", "KeySig", "TimeSig",
    "Clef", "Slur", "Hairpin", "Tuplet", "Harmony", "Lyric",
    "Glyph", "Font", "Symbol", "Anchor", "Width", "Height",
    "Note", "Chord", "Rest", "Measure", "System", "Page",
    "Segment", "Shape", "Score", "Staff", "Voice",
    "extract", "Extract", "parse", "Parse",
    "svg", "SVG", "paint", "Paint", "draw", "Draw",
    "spatium", "Spatium",
]


def is_relevant(name: str) -> bool:
    """Return True if this name should be tracked in the document."""
    if name in SKIP_NAMES:
        return False
    if len(name) <= 2:
        return False
    # In the TS renderer, almost everything is relevant since
    # these are focused renderer files (not a huge codebase).
    # Still skip obvious noise.
    if name.startswith("_"):
        return False
    return True


def is_exported_relevant(item: dict) -> bool:
    """Return True if this exported item should definitely be documented."""
    return item.get("exported", False) and is_relevant(item.get("name", ""))


# ──────────────────────────────────────────────────────────────────────────────
# Coverage checks
# ──────────────────────────────────────────────────────────────────────────────

def check_name_in_doc(name: str, doc_text: str) -> bool:
    """Check if a name appears in the document (word boundary match)."""
    pattern = r'\b' + re.escape(name) + r'\b'
    return bool(re.search(pattern, doc_text))


def check_function_coverage(functions: list, doc_text: str) -> tuple:
    """Returns (documented, missing) lists."""
    documented = []
    missing = []

    for func in functions:
        name = func["name"]
        if not is_relevant(name):
            continue

        if check_name_in_doc(name, doc_text):
            documented.append(func)
        else:
            missing.append(func)

    return documented, missing


def check_class_coverage(classes: list, doc_text: str) -> tuple:
    """Returns (documented, missing) lists for classes and their methods."""
    documented = []
    missing = []

    for cls in classes:
        name = cls["name"]
        if not is_relevant(name):
            continue

        if check_name_in_doc(name, doc_text):
            # Also check methods
            missing_methods = []
            for method in cls.get("methods", []):
                mname = method["name"]
                if is_relevant(mname) and not check_name_in_doc(mname, doc_text):
                    missing_methods.append(method)
            cls_result = {**cls, "missing_methods": missing_methods}
            documented.append(cls_result)
        else:
            missing.append(cls)

    return documented, missing


def check_interface_coverage(interfaces: list, doc_text: str) -> tuple:
    """Returns (documented, missing) lists."""
    documented = []
    missing = []

    for iface in interfaces:
        name = iface["name"]
        if not is_relevant(name):
            continue
        if check_name_in_doc(name, doc_text):
            documented.append(iface)
        else:
            missing.append(iface)

    return documented, missing


def check_constant_coverage(constants: list, doc_text: str) -> tuple:
    """Returns (documented, missing) lists."""
    documented = []
    missing = []

    for const in constants:
        name = const["name"]
        if not is_relevant(name):
            continue
        if check_name_in_doc(name, doc_text):
            documented.append(const)
        else:
            missing.append(const)

    return documented, missing


def check_enum_coverage(enums: list, doc_text: str) -> tuple:
    """Returns (documented, missing) lists."""
    documented = []
    missing = []

    for enum in enums:
        name = enum["name"]
        if not is_relevant(name):
            continue
        if check_name_in_doc(name, doc_text):
            documented.append(enum)
        else:
            missing.append(enum)

    return documented, missing


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
    print(f"MAP Pipeline -- Coverage Report")
    print(f"Session: {session}  |  Scope: {scope}")
    print(f"{'='*70}\n")

    all_missing_funcs = []
    all_missing_classes = []
    all_missing_interfaces = []
    all_missing_consts = []
    all_missing_enums = []
    all_missing_methods = []

    for file_data in files:
        if not file_data.get("exists"):
            print(f"  WARNING: MISSING FILE: {file_data.get('file', '?')}")
            continue

        fname = file_data["file"]

        # Filter by chapter if specified
        if chapter is not None:
            mapped_chapter = FILE_TO_CHAPTER.get(fname)
            if mapped_chapter is not None and mapped_chapter != chapter:
                continue

        funcs = file_data.get("functions", [])
        classes = file_data.get("classes", [])
        interfaces = file_data.get("interfaces", [])
        type_aliases = file_data.get("type_aliases", [])
        consts = file_data.get("constants", [])
        enums = file_data.get("enums", [])

        doc_funcs, miss_funcs = check_function_coverage(funcs, doc_text)
        doc_classes, miss_classes = check_class_coverage(classes, doc_text)
        doc_ifaces, miss_ifaces = check_interface_coverage(interfaces, doc_text)
        doc_types, miss_types = check_interface_coverage(type_aliases, doc_text)  # same logic
        doc_consts, miss_consts = check_constant_coverage(consts, doc_text)
        doc_enums, miss_enums = check_enum_coverage(enums, doc_text)

        # Count documented methods with missing sub-methods
        for cls in doc_classes:
            for mm in cls.get("missing_methods", []):
                all_missing_methods.append({**mm, "class": cls["name"], "file": fname})

        total_funcs = len(doc_funcs) + len(miss_funcs)
        covered_funcs = len(doc_funcs)
        pct = (covered_funcs / total_funcs * 100) if total_funcs else 100

        total_types_count = len(doc_ifaces) + len(miss_ifaces) + len(doc_types) + len(miss_types)
        covered_types = len(doc_ifaces) + len(doc_types)

        print(f"  {fname} ({file_data.get('line_count', '?')} lines)")
        print(f"    Functions:  {covered_funcs}/{total_funcs} documented ({pct:.0f}%)")
        if classes or miss_classes:
            print(f"    Classes:    {len(doc_classes)}/{len(doc_classes)+len(miss_classes)} documented")
        if total_types_count:
            print(f"    Types:      {covered_types}/{total_types_count} documented")
        if consts or miss_consts:
            print(f"    Constants:  {len(doc_consts)}/{len(doc_consts)+len(miss_consts)} documented")
        if enums or miss_enums:
            print(f"    Enums:      {len(doc_enums)}/{len(doc_enums)+len(miss_enums)} documented")

        for f in miss_funcs:
            all_missing_funcs.append({**f, "file": fname})
        for c in miss_classes:
            all_missing_classes.append({**c, "file": fname})
        for i in miss_ifaces:
            all_missing_interfaces.append({**i, "file": fname})
        for t in miss_types:
            all_missing_interfaces.append({**t, "file": fname, "kind": "type"})
        for c in miss_consts:
            all_missing_consts.append({**c, "file": fname})
        for e in miss_enums:
            all_missing_enums.append({**e, "file": fname})

    # --- Missing Functions ---
    if all_missing_funcs:
        print(f"\n{'-'*70}")
        print(f"MISSING FUNCTIONS ({len(all_missing_funcs)} total):")
        print(f"{'-'*70}")
        for f in all_missing_funcs:
            exported = " [exported]" if f.get("exported") else ""
            print(f"  MISS  {f['name']}(){exported}  --  {f['file']}:{f['line']}")
            if show_fix:
                print(f"        {f.get('signature', '?')[:100]}")
    else:
        print(f"\n  OK  All functions documented.")

    # --- Missing Classes ---
    if all_missing_classes:
        print(f"\n{'-'*70}")
        print(f"MISSING CLASSES ({len(all_missing_classes)} total):")
        print(f"{'-'*70}")
        for c in all_missing_classes:
            methods = [m["name"] for m in c.get("methods", [])]
            print(f"  MISS  class {c['name']}  --  {c['file']}:{c['line']}")
            if methods and show_fix:
                print(f"        Methods: {', '.join(methods[:10])}")

    # --- Missing Class Methods ---
    if all_missing_methods:
        print(f"\n{'-'*70}")
        print(f"MISSING CLASS METHODS ({len(all_missing_methods)} total):")
        print(f"{'-'*70}")
        for m in all_missing_methods:
            print(f"  MISS  {m['class']}.{m['name']}()  --  {m['file']}:{m['line']}")

    # --- Missing Interfaces/Types ---
    if all_missing_interfaces:
        print(f"\n{'-'*70}")
        print(f"MISSING INTERFACES/TYPES ({len(all_missing_interfaces)} total):")
        print(f"{'-'*70}")
        for i in all_missing_interfaces:
            kind = i.get("kind", "interface")
            print(f"  MISS  {kind} {i['name']}  --  {i['file']}:{i['line']}")

    # --- Missing Constants ---
    if all_missing_consts:
        print(f"\n{'-'*70}")
        print(f"MISSING CONSTANTS ({len(all_missing_consts)} total):")
        print(f"{'-'*70}")
        for c in all_missing_consts:
            print(f"  MISS  {c['name']} = {c.get('value', '?')[:60]}  --  {c['file']}:{c['line']}")

    # --- Missing Enums ---
    if all_missing_enums:
        print(f"\n{'-'*70}")
        print(f"MISSING ENUMS ({len(all_missing_enums)} total):")
        print(f"{'-'*70}")
        for e in all_missing_enums:
            entries = e.get("entries", [])[:8]
            print(f"  MISS  enum {e['name']}  --  {e['file']}:{e['line']}")
            if entries and show_fix:
                print(f"        Entries: {', '.join(entries)}")

    # --- Summary ---
    total_issues = (len(all_missing_funcs) + len(all_missing_classes) +
                    len(all_missing_methods) + len(all_missing_interfaces) +
                    len(all_missing_consts) + len(all_missing_enums))

    print(f"\n{'='*70}")
    if total_issues == 0:
        print("OK  COVERAGE: COMPLETE -- No gaps found.")
    else:
        print(f"GAPS: {total_issues} items need documentation.")
        print(f"  Missing functions:   {len(all_missing_funcs)}")
        print(f"  Missing classes:     {len(all_missing_classes)}")
        print(f"  Missing methods:     {len(all_missing_methods)}")
        print(f"  Missing types:       {len(all_missing_interfaces)}")
        print(f"  Missing constants:   {len(all_missing_consts)}")
        print(f"  Missing enums:       {len(all_missing_enums)}")
    print(f"{'='*70}\n")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Verify MAP pipeline documentation coverage")
    parser.add_argument("--extracted", "-e", required=True, help="JSON from ts_extractor.py")
    parser.add_argument("--doc", "-d", required=True, help="MAP_RENDERING_PIPELINE.md path")
    parser.add_argument("--chapter", "-c", type=int, help="Only check specific chapter number")
    parser.add_argument("--fix", action="store_true", help="Show signatures/details for missing items")
    args = parser.parse_args()

    with open(args.extracted, encoding="utf-8") as f:
        extracted = json.load(f)

    doc = load_document(args.doc)
    print_report(extracted, doc, args.chapter, args.fix)


if __name__ == "__main__":
    main()
