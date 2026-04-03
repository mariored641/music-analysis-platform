/**
 * MAP Native Renderer — engine/libmscore/Hook.ts
 * C++ source: src/engraving/libmscore/hook.cpp
 *
 * Mirrors Hook::setHookType() and Hook::symIdForHookIndex().
 * Maps hook index → SMuFL glyph name for Leland font.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Hook index → SMuFL glyph
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook index convention (C++ hook.cpp:44–48):
 *   positive = stem up: 1=8th, 2=16th, 3=32nd, 4=64th, ...
 *   negative = stem down: -1=8th, -2=16th, -3=32nd, -4=64th, ...
 *   0 = no hook
 *
 * C++ hook.cpp:73 — Hook::symIdForHookIndex(int index, bool straight)
 */
export type HookIndex = -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/**
 * SMuFL glyph names for flags (using Leland curved flags, not straight).
 * C++: hook.cpp:75–117 — symIdForHookIndex() with straight=false
 */
const HOOK_GLYPH: Partial<Record<HookIndex, string>> = {
  // stem-up flags (positive index)
  1: '\u{E240}',   // flag8thUp       — U+E240
  2: '\u{E242}',   // flag16thUp      — U+E242
  3: '\u{E244}',   // flag32ndUp      — U+E244
  4: '\u{E246}',   // flag64thUp      — U+E246
  5: '\u{E248}',   // flag128thUp     — U+E248

  // stem-down flags (negative index)
  [-1]: '\u{E241}',  // flag8thDown     — U+E241
  [-2]: '\u{E243}',  // flag16thDown    — U+E243
  [-3]: '\u{E245}',  // flag32ndDown    — U+E245
  [-4]: '\u{E247}',  // flag64thDown    — U+E247
  [-5]: '\u{E249}',  // flag128thDown   — U+E249
}

/** Returns the flag glyph for a given hook index, or null if index=0 */
export function hookGlyph(index: HookIndex): string | null {
  return HOOK_GLYPH[index] ?? null
}

/**
 * Convert duration type + stem direction to hook index.
 * C++: Chord::hookIndex() — beams() for beam count, negative when stem down.
 */
export function durationToHookIndex(type: string, stemUp: boolean): HookIndex {
  const baseIndex: Partial<Record<string, number>> = {
    'eighth': 1,
    '16th':   2,
    '32nd':   3,
    '64th':   4,
    '128th':  5,
  }
  const base = baseIndex[type] ?? 0
  if (base === 0) return 0
  return (stemUp ? base : -base) as HookIndex
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook layout
// ─────────────────────────────────────────────────────────────────────────────

export interface HookLayout {
  x: number
  y: number
  glyph: string
  fontSize: number
}

/**
 * Compute flag/hook layout given stem tip position.
 *
 * C++: stem.cpp:144–148 — Stem::flagPosition() = pos() + PointF(bbox.left(), ±length())
 * C++: hook.cpp:68–71   — Hook::smuflAnchor() = symSmuflAnchor(_sym, stemUpNW / stemDownSW)
 *
 * In Leland, the flag glyph is placed at the stem tip (x = stemTipX, y = stem tip y).
 * The SMuFL anchor of the flag aligns with the top of the stem.
 */
export function layoutHook(
  stemX: number,
  stemTipY: number,
  hookIndex: HookIndex,
  fontSize: number,
): HookLayout | null {
  const glyph = hookGlyph(hookIndex)
  if (!glyph) return null
  return {
    x: stemX,
    y: stemTipY,
    glyph,
    fontSize,
  }
}
