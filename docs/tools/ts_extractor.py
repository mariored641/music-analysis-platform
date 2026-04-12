#!/usr/bin/env python3
"""
ts_extractor.py — Extract functions, constants, classes, interfaces from TypeScript files.

Usage:
    python ts_extractor.py <file1.ts> [file2.ts ...] --out extracted.json
    python ts_extractor.py --session G --out extracted_G.json

Sessions are defined in SESSION_FILES at the bottom of this file.
Output is a JSON file used by ts_verifier.py to check document coverage.

Parallel to cpp_extractor.py — same output format, adapted for TypeScript.
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

MAP_ROOT = r"C:\Users\DELL\Documents\MAP - Music Analysis Platform\src\renderer"

SESSION_FILES = {
    "G": [
        "style/StyleDef.ts",
        "index.ts",
        "engine/LayoutOrchestrator.ts",
        "xmlExtractor.ts",
        "extractorTypes.ts",
    ],
    "H": [
        "horizontalLayout.ts",
        "engine/layout/LayoutMeasure.ts",
        "engine/layout/LayoutSystem.ts",
        "engine/layout/LayoutPage.ts",
    ],
    "I": [
        "chordLayout.ts",
        "engine/layout/LayoutChords.ts",
        "engine/libmscore/Note.ts",
        "engine/libmscore/Stem.ts",
        "engine/libmscore/Hook.ts",
        "engine/layout/LayoutBeams.ts",
    ],
    "J": [
        "verticalLayout.ts",
        "engine/libmscore/Shape.ts",
        "engine/libmscore/Skyline.ts",
        "engine/libmscore/LedgerLine.ts",
        "atomicElements.ts",
    ],
    "K": [
        "svgRenderer.ts",
        "painter/Painter.ts",
        "painter/SVGPainter.ts",
        "glyphs/leland.ts",
        "glyphs/index.ts",
        "bravura/anchors.ts",
        "types.ts",
        "spatium.ts",
    ],
}

# ──────────────────────────────────────────────────────────────────────────────
# Extractors
# ──────────────────────────────────────────────────────────────────────────────

# Matches: export function name( or function name(
FUNC_PATTERN = re.compile(
    r'^[ \t]*'
    r'(?:export\s+)?'              # optional export
    r'(?:async\s+)?'               # optional async
    r'function\s+'
    r'(\w+)'                       # CAPTURE: function name
    r'\s*(?:<[^>]*>)?'             # optional generic params
    r'\s*\(',                      # opening paren
    re.MULTILINE
)

# Matches: export const name = (...) => or const name = (...) =>
# Also: export const name = function
ARROW_FUNC_PATTERN = re.compile(
    r'^[ \t]*'
    r'(?:export\s+)?'
    r'const\s+'
    r'(\w+)'                       # CAPTURE: name
    r'\s*(?::\s*[^=]+?)?\s*'       # optional type annotation
    r'=\s*'
    r'(?:'
        r'(?:async\s+)?'
        r'(?:\([^)]*\)|[a-zA-Z_]\w*)'  # params: (args) or single arg
        r'\s*(?::\s*[^=]+?)?\s*'        # optional return type
        r'=>'                           # arrow
    r'|'
        r'(?:async\s+)?function'        # or function expression
    r')',
    re.MULTILINE
)

# Matches: class method definitions (inside class body)
# public/private/protected methodName( or static methodName(
METHOD_PATTERN = re.compile(
    r'^[ \t]+'
    r'(?:public\s+|private\s+|protected\s+)?'
    r'(?:static\s+)?'
    r'(?:async\s+)?'
    r'(?:get\s+|set\s+)?'
    r'(\w+)'                       # CAPTURE: method name
    r'\s*(?:<[^>]*>)?'
    r'\s*\(',
    re.MULTILINE
)

# Matches: export class ClassName or class ClassName
CLASS_PATTERN = re.compile(
    r'^[ \t]*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)',
    re.MULTILINE
)

# Matches: export interface Name or interface Name
INTERFACE_PATTERN = re.compile(
    r'^[ \t]*(?:export\s+)?interface\s+(\w+)',
    re.MULTILINE
)

# Matches: export type Name = or type Name =
TYPE_ALIAS_PATTERN = re.compile(
    r'^[ \t]*(?:export\s+)?type\s+(\w+)\s*(?:<[^>]*>)?\s*=',
    re.MULTILINE
)

# Matches: export enum Name or enum Name
ENUM_PATTERN = re.compile(
    r'^[ \t]*(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{([^}]+)\}',
    re.DOTALL
)

# Matches: export const NAME = value (non-function constants)
CONST_PATTERN = re.compile(
    r'^[ \t]*(?:export\s+)?const\s+'
    r'(\w+)'                       # CAPTURE: name
    r'\s*(?::\s*[\w<>\[\]|&\s,]+)?\s*'  # optional type
    r'=\s*'
    r'(-?[\d.]+(?:e[-+]?\d+)?'    # numeric literal
    r'|["\'][^"\']*["\']'          # or string literal
    r'|true|false'                 # or boolean
    r'|\{[^}]*\}'                  # or object literal
    r'|\[[^\]]*\]'                 # or array literal
    r')',
    re.MULTILINE
)

# Magic numbers: numeric literals in computation context
MAGIC_NUMBER_PATTERN = re.compile(
    r'(?<!["\w.])(-?\d+\.?\d*(?:e[-+]?\d+)?)'
    r'(?!\s*["\w])'
)


def extract_from_file(filepath: str) -> dict:
    """Extract all items from a single TypeScript file."""
    path = Path(filepath)
    if not path.exists():
        print(f"  WARNING: {filepath} not found", file=sys.stderr)
        return {"file": str(path.name), "full_path": filepath, "exists": False}

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
        "classes": [],
        "interfaces": [],
        "type_aliases": [],
        "enums": [],
        "magic_numbers": [],
    }

    seen_funcs = set()

    # ── Functions ────────────────────────────────────────────────────────────
    for m in FUNC_PATTERN.finditer(content):
        name = m.group(1)
        if name in seen_funcs:
            continue
        seen_funcs.add(name)
        line_num = content[:m.start()].count("\n") + 1
        # Get the full line as signature
        line_end = content.find("\n", m.start())
        sig = content[m.start():line_end].strip() if line_end != -1 else m.group(0).strip()
        result["functions"].append({
            "name": name,
            "line": line_num,
            "signature": sig[:200],
            "exported": "export" in content[m.start():m.start()+20],
        })

    # ── Arrow functions / const functions ─────────────────────────────────────
    for m in ARROW_FUNC_PATTERN.finditer(content):
        name = m.group(1)
        if name in seen_funcs:
            continue
        seen_funcs.add(name)
        line_num = content[:m.start()].count("\n") + 1
        line_end = content.find("\n", m.start())
        sig = content[m.start():line_end].strip() if line_end != -1 else m.group(0).strip()
        result["functions"].append({
            "name": name,
            "line": line_num,
            "signature": sig[:200],
            "exported": "export" in content[m.start():m.start()+20],
        })

    # ── Classes ──────────────────────────────────────────────────────────────
    for m in CLASS_PATTERN.finditer(content):
        name = m.group(1)
        line_num = content[:m.start()].count("\n") + 1

        # Find class body and extract methods
        class_start = content.find("{", m.end())
        if class_start == -1:
            continue

        # Simple brace-counting to find class end
        depth = 1
        pos = class_start + 1
        while pos < len(content) and depth > 0:
            if content[pos] == "{":
                depth += 1
            elif content[pos] == "}":
                depth -= 1
            pos += 1
        class_body = content[class_start:pos]

        methods = []
        for mm in METHOD_PATTERN.finditer(class_body):
            method_name = mm.group(1)
            if method_name in ("constructor", "if", "for", "while", "switch", "return", "catch"):
                continue
            method_line = content[:class_start].count("\n") + class_body[:mm.start()].count("\n") + 1
            methods.append({
                "name": method_name,
                "line": method_line,
            })

        result["classes"].append({
            "name": name,
            "line": line_num,
            "methods": methods,
            "exported": "export" in content[m.start():m.start()+20],
        })

    # ── Interfaces ───────────────────────────────────────────────────────────
    for m in INTERFACE_PATTERN.finditer(content):
        name = m.group(1)
        line_num = content[:m.start()].count("\n") + 1
        result["interfaces"].append({
            "name": name,
            "line": line_num,
            "exported": "export" in content[m.start():m.start()+20],
        })

    # ── Type aliases ─────────────────────────────────────────────────────────
    for m in TYPE_ALIAS_PATTERN.finditer(content):
        name = m.group(1)
        line_num = content[:m.start()].count("\n") + 1
        result["type_aliases"].append({
            "name": name,
            "line": line_num,
            "exported": "export" in content[m.start():m.start()+20],
        })

    # ── Enums ────────────────────────────────────────────────────────────────
    for m in ENUM_PATTERN.finditer(content):
        name = m.group(1)
        line_num = content[:m.start()].count("\n") + 1
        raw_entries = m.group(2)
        entries = [e.strip().split("=")[0].strip().split("//")[0].strip()
                   for e in raw_entries.split(",")
                   if e.strip() and not e.strip().startswith("//")]
        entries = [e for e in entries if e]
        result["enums"].append({
            "name": name,
            "entries": entries,
            "line": line_num,
        })

    # ── Named constants (non-function) ───────────────────────────────────────
    for m in CONST_PATTERN.finditer(content):
        name = m.group(1)
        value = m.group(2).strip()
        # Skip if this is actually a function (already captured above)
        if name in seen_funcs:
            continue
        line_num = content[:m.start()].count("\n") + 1
        result["constants"].append({
            "name": name,
            "value": value[:100],
            "line": line_num,
            "exported": "export" in content[m.start():m.start()+20],
        })

    # ── Magic numbers ────────────────────────────────────────────────────────
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        # Skip comments, imports, strings-only lines
        if stripped.startswith("//") or stripped.startswith("*") or \
           stripped.startswith("import ") or stripped.startswith("export type") or \
           stripped.startswith("export interface"):
            continue
        nums = MAGIC_NUMBER_PATTERN.findall(stripped)
        # Filter out trivial values
        floats = [n for n in nums if "." in n and n not in ("0.0", "1.0", "-1.0", "0.5", "2.0")]
        interesting_ints = [n for n in nums if "." not in n and
                           n not in ("0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
                                     "-1", "-2", "100", "16", "32", "64", "128", "255", "256")]
        significant = floats + interesting_ints
        if significant:
            result["magic_numbers"].append({
                "line": i,
                "values": significant,
                "context": stripped[:120],
            })

    return result


def extract_session(session: str) -> dict:
    """Extract all files for a given session."""
    if session not in SESSION_FILES:
        raise ValueError(f"Unknown session '{session}'. Choose from: {list(SESSION_FILES.keys())}")

    results = {"session": session, "files": []}
    for rel_path in SESSION_FILES[session]:
        full_path = os.path.join(MAP_ROOT, rel_path)
        print(f"  Extracting: {rel_path}")
        results["files"].append(extract_from_file(full_path))

    # Summary counts
    total_funcs = sum(len(f["functions"]) for f in results["files"] if f.get("exists"))
    total_consts = sum(len(f["constants"]) for f in results["files"] if f.get("exists"))
    total_classes = sum(len(f["classes"]) for f in results["files"] if f.get("exists"))
    total_interfaces = sum(len(f["interfaces"]) for f in results["files"] if f.get("exists"))
    total_types = sum(len(f["type_aliases"]) for f in results["files"] if f.get("exists"))
    total_enums = sum(len(f["enums"]) for f in results["files"] if f.get("exists"))

    results["summary"] = {
        "total_functions": total_funcs,
        "total_constants": total_consts,
        "total_classes": total_classes,
        "total_interfaces": total_interfaces,
        "total_type_aliases": total_types,
        "total_enums": total_enums,
    }
    print(f"\n  Summary: {total_funcs} functions, {total_consts} constants, "
          f"{total_classes} classes, {total_interfaces} interfaces, "
          f"{total_types} type aliases, {total_enums} enums")
    return results


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Extract TypeScript items for pipeline documentation")
    parser.add_argument("files", nargs="*", help="TypeScript files to extract (or use --session)")
    parser.add_argument("--session", "-s", help="Session name (G/H/I/J/K)")
    parser.add_argument("--out", "-o", default="extracted.json", help="Output JSON file")
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
