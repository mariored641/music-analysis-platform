#!/usr/bin/env python3
"""
cpp_extractor.py — Extract functions, constants, arrays, enums from C++ files.

Usage:
    python cpp_extractor.py <file1.cpp> [file2.cpp ...] --out extracted.json
    python cpp_extractor.py --session C --out extracted_C.json

Sessions are defined in SESSION_FILES at the bottom of this file.
Output is a JSON file used by cpp_verifier.py to check document coverage.
"""

import re
import json
import sys
import os
from pathlib import Path
from typing import Optional

# ──────────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────────

WEBMSCORE_ROOT = r"C:\Users\DELL\Documents\webmscore\src\engraving"

# Per-session root overrides (default: WEBMSCORE_ROOT)
SESSION_ROOTS = {
    "F": r"C:\Users\DELL\Documents\webmscore\src",
}

# Files for each documentation session.
# Edit these when adding new sessions.
SESSION_FILES = {
    "A": [
        "importexport/musicxml/importmusicxml.cpp",
        "importexport/musicxml/importmusicxmlpass1.cpp",
        "importexport/musicxml/importmusicxmlpass2.cpp",
        "layout/layout.cpp",
        "layout/layoutmeasure.cpp",
        "libmscore/measure.cpp",
        "libmscore/segment.cpp",
        "layout/layoutsystem.cpp",
    ],
    "B": [
        "layout/layoutchords.cpp",
        "libmscore/chord.cpp",
        "libmscore/note.cpp",
        "libmscore/stem.cpp",
        "libmscore/hook.cpp",
        "libmscore/beam.cpp",
        "layout/layoutbeams.cpp",
        "libmscore/beam.h",
    ],
    "C": [
        "layout/layoutpage.cpp",
        "libmscore/system.cpp",
        "layout/verticalgapdata.cpp",
        "libmscore/shape.cpp",
        "libmscore/shape.h",
        "libmscore/skyline.cpp",
        "libmscore/skyline.h",
        "libmscore/engravingitem.cpp",
    ],
    "D": [
        "libmscore/barline.cpp",
        "libmscore/keysig.cpp",
        "libmscore/timesig.cpp",
        "libmscore/accidental.cpp",
        "libmscore/clef.cpp",
    ],
    "E": [
        "layout/layoutharmonies.cpp",
        "layout/layoutlyrics.cpp",
        "layout/layouttuplets.cpp",
        "libmscore/tuplet.cpp",
        "libmscore/slur.cpp",
        "libmscore/tie.cpp",
        "libmscore/hairpin.cpp",
        "libmscore/dynamic.cpp",
        "libmscore/articulation.cpp",
        "libmscore/engravingitem.cpp",
        "style/styledef.cpp",
        "style/styledef.h",
        "style/style.cpp",
        "style/style.h",
        "infrastructure/smufl.cpp",
        "infrastructure/smufl.h",
        "infrastructure/symbolfont.cpp",
        "infrastructure/symbolfont.h",
        "infrastructure/symbolfonts.cpp",
        "infrastructure/symbolfonts.h",
    ],
    "F": [
        "importexport/imagesexport/internal/svggenerator.cpp",
        "importexport/imagesexport/internal/svggenerator.h",
        "importexport/imagesexport/internal/svgwriter.cpp",
        "importexport/imagesexport/internal/svgwriter.h",
        "framework/draw/painter.cpp",
        "framework/draw/painter.h",
        "framework/draw/bufferedpaintprovider.cpp",
        "framework/draw/bufferedpaintprovider.h",
        "framework/draw/buffereddrawtypes.h",
        "framework/draw/svgrenderer.cpp",
        "framework/draw/svgrenderer.h",
    ],
}

# ──────────────────────────────────────────────────────────────────────────────
# Extractors
# ──────────────────────────────────────────────────────────────────────────────

# Matches: ReturnType ClassName::methodName( or just funcName(
# Catches most C++ method definitions. Excludes declarations ending in ;
FUNC_PATTERN = re.compile(
    r'^[ \t]*'                          # optional indent
    r'(?:static\s+)?'                   # optional static
    r'(?:virtual\s+)?'                  # optional virtual
    r'(?:inline\s+)?'                   # optional inline
    r'(?:const\s+)?'                    # optional const return
    r'(?:[\w:<>*& \t]+?\s+)'            # return type (greedy)
    r'((?:\w+::)+\w+|\w+)'             # CAPTURE: ClassName::method or just method
    r'\s*\([^;{]*\)'                    # parameter list (no ; or { inside)
    r'(?:\s*const)?'                    # optional trailing const
    r'(?:\s*override)?'                 # optional override
    r'(?:\s*noexcept)?'                 # optional noexcept
    r'\s*\{',                           # opening brace (definition, not declaration)
    re.MULTILINE
)

# Matches: constexpr/static const/const with assignment
CONST_PATTERN = re.compile(
    r'(?:static\s+)?(?:constexpr|const)\s+'
    r'(?:double|float|int|qreal|bool|size_t|unsigned|long|auto)\s+'
    r'(\w+)\s*=\s*([^;]+);'
)

# Matches: #define NAME value
DEFINE_PATTERN = re.compile(
    r'#define\s+([A-Z_][A-Z0-9_]+)\s+([^\n\\]+)'
)

# Matches: array or initializer_list declarations
ARRAY_PATTERN = re.compile(
    r'(?:static\s+)?(?:constexpr\s+)?(?:const\s+)?'
    r'(?:std::array\s*<[^>]+>|int|double|float|qreal|'
    r'std::initializer_list\s*<\w+>|QVector\s*<\w+>)\s+'
    r'(\w+)\s*(?:\[\d*\])?\s*=\s*\{([^}]+)\}',
    re.DOTALL
)

# Matches: enum class or enum
ENUM_PATTERN = re.compile(
    r'enum\s+(?:class\s+)?(\w+)\s*(?::\s*\w+\s*)?\{([^}]+)\}',
    re.DOTALL
)

# Matches: struct definitions
STRUCT_PATTERN = re.compile(
    r'struct\s+(\w+)\s*\{'
)

# Matches: numeric literals in context (lines containing = <number>)
# Used to flag "magic numbers" in expressions
MAGIC_NUMBER_PATTERN = re.compile(
    r'(?<!=\s)(?<!["\w./])(-?\d+\.?\d*(?:e[-+]?\d+)?)'
    r'(?!\s*["\w./])'
)


def extract_from_file(filepath: str) -> dict:
    """Extract all items from a single C++ file."""
    path = Path(filepath)
    if not path.exists():
        print(f"  WARNING: {filepath} not found", file=sys.stderr)
        return {"file": filepath, "exists": False}

    with open(filepath, encoding="utf-8", errors="replace") as f:
        content = f.read()
        lines = content.splitlines()

    result = {
        "file": str(path.name),
        "full_path": filepath,
        "exists": True,
        "line_count": len(lines),
        "functions": [],
        "constants": [],
        "arrays": [],
        "enums": [],
        "structs": [],
        "magic_numbers": [],   # lines with suspicious numeric literals
    }

    # ── Functions ────────────────────────────────────────────────────────────
    for m in FUNC_PATTERN.finditer(content):
        name = m.group(1)
        # Skip obvious noise: constructors of single-char names, operators
        if len(name) <= 1 or name.startswith("operator"):
            continue
        line_num = content[:m.start()].count("\n") + 1
        result["functions"].append({
            "name": name,
            "line": line_num,
            "signature": m.group(0).strip().rstrip("{").strip(),
        })

    # ── Named constants ───────────────────────────────────────────────────────
    for m in CONST_PATTERN.finditer(content):
        line_num = content[:m.start()].count("\n") + 1
        result["constants"].append({
            "name": m.group(1),
            "value": m.group(2).strip(),
            "line": line_num,
        })

    # ── #define constants ─────────────────────────────────────────────────────
    for m in DEFINE_PATTERN.finditer(content):
        line_num = content[:m.start()].count("\n") + 1
        result["constants"].append({
            "name": m.group(1),
            "value": m.group(2).strip(),
            "line": line_num,
            "kind": "define",
        })

    # ── Arrays ───────────────────────────────────────────────────────────────
    for m in ARRAY_PATTERN.finditer(content):
        line_num = content[:m.start()].count("\n") + 1
        raw_values = m.group(2)
        # Parse values: split by comma, strip whitespace
        values_str = [v.strip() for v in raw_values.split(",") if v.strip()]
        result["arrays"].append({
            "name": m.group(1),
            "values": values_str,
            "line": line_num,
        })

    # ── Enums ─────────────────────────────────────────────────────────────────
    for m in ENUM_PATTERN.finditer(content):
        line_num = content[:m.start()].count("\n") + 1
        raw_entries = m.group(2)
        entries = [e.strip().split("=")[0].strip()
                   for e in raw_entries.split(",")
                   if e.strip() and not e.strip().startswith("//")]
        result["enums"].append({
            "name": m.group(1),
            "entries": entries,
            "line": line_num,
        })

    # ── Structs ───────────────────────────────────────────────────────────────
    for m in STRUCT_PATTERN.finditer(content):
        line_num = content[:m.start()].count("\n") + 1
        result["structs"].append({
            "name": m.group(1),
            "line": line_num,
        })

    # ── Magic numbers: lines with numeric literals in computation context ─────
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        # Skip comments, strings, includes
        if stripped.startswith("//") or stripped.startswith("*") or \
           stripped.startswith("#include") or stripped.startswith('"'):
            continue
        nums = MAGIC_NUMBER_PATTERN.findall(stripped)
        floats = [n for n in nums if "." in n and n not in ("0.0", "1.0", "-1.0", "0.5")]
        if floats:
            result["magic_numbers"].append({
                "line": i,
                "values": floats,
                "context": stripped[:120],
            })

    return result


def extract_session(session: str) -> dict:
    """Extract all files for a given session."""
    if session not in SESSION_FILES:
        raise ValueError(f"Unknown session '{session}'. Choose from: {list(SESSION_FILES.keys())}")

    results = {"session": session, "files": []}
    root = SESSION_ROOTS.get(session, WEBMSCORE_ROOT)
    for rel_path in SESSION_FILES[session]:
        full_path = os.path.join(root, rel_path)
        print(f"  Extracting: {rel_path}")
        results["files"].append(extract_from_file(full_path))

    # Summary counts
    total_funcs = sum(len(f["functions"]) for f in results["files"] if f.get("exists"))
    total_consts = sum(len(f["constants"]) for f in results["files"] if f.get("exists"))
    total_arrays = sum(len(f["arrays"]) for f in results["files"] if f.get("exists"))
    results["summary"] = {
        "total_functions": total_funcs,
        "total_constants": total_consts,
        "total_arrays": total_arrays,
    }
    print(f"\n  Summary: {total_funcs} functions, {total_consts} constants, {total_arrays} arrays")
    return results


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Extract C++ items for pipeline documentation")
    parser.add_argument("files", nargs="*", help="C++ files to extract (or use --session)")
    parser.add_argument("--session", "-s", help="Session name (A/B/C/D/E/F)")
    parser.add_argument("--out", "-o", default="extracted.json", help="Output JSON file")
    parser.add_argument("--functions-only", action="store_true", help="Only extract functions (faster)")
    args = parser.parse_args()

    if args.session:
        print(f"Extracting session {args.session}...")
        data = extract_session(args.session)
    elif args.files:
        data = {"session": "custom", "files": []}
        for f in args.files:
            print(f"  Extracting: {f}")
            data["files"].append(extract_from_file(f))
    else:
        parser.print_help()
        sys.exit(1)

    out_path = args.out
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\nWritten to: {out_path}")


if __name__ == "__main__":
    main()
