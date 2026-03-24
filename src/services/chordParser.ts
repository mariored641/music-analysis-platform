/**
 * chordParser.ts
 * Converts a chord symbol string → Set of pitch classes (0–11).
 * Handles user-typed symbols ("Bb7", "Dm7b5") and XML-sourced symbols ("B♭7").
 */

const NOTE_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

export function parseChordSymbol(symbol: string): Set<number> | null {
  if (!symbol?.trim()) return null
  const s = symbol.trim()

  // Root letter
  const letter = s[0].toUpperCase()
  if (!(letter in NOTE_PC)) return null
  let rootPc = NOTE_PC[letter]
  let i = 1

  // Accidental — always consumed right after root letter
  if (s[i] === '𝄫' || (s[i] === 'b' && s[i + 1] === 'b')) {
    rootPc = (rootPc - 2 + 12) % 12; i += 2
  } else if (s[i] === '♭' || s[i] === 'b') {
    rootPc = (rootPc - 1 + 12) % 12; i += 1
  } else if (s[i] === '#' && s[i + 1] === '#') {
    rootPc = (rootPc + 2) % 12; i += 2
  } else if (s[i] === '♯' || s[i] === '#') {
    rootPc = (rootPc + 1) % 12; i += 1
  }

  const quality = s.slice(i)
  const intervals = qualityToIntervals(quality)
  return new Set(intervals.map(iv => (rootPc + iv) % 12))
}

function qualityToIntervals(q: string): number[] {
  // Capital-M major-seventh check before lowercasing (avoids "M7" → "m7" confusion)
  if (/^M[^a-z]/.test(q) || /^M$/.test(q)) return [0, 4, 7, 11]

  const n = q.toLowerCase()

  // Half-diminished
  if (n.includes('m7b5') || n.includes('ø') || n.includes('half')) return [0, 3, 6, 10]

  // Diminished 7
  if (/dim7|°7|o7/.test(n)) return [0, 3, 6, 9]

  // Diminished triad
  if (/^(dim|°|o)/.test(n)) return [0, 3, 6]

  // Augmented
  if (/^(aug|\+)/.test(n)) return n.includes('7') ? [0, 4, 8, 10] : [0, 4, 8]

  // Major 7 (Maj7 / maj7 / ma7 / Δ)
  if (/^(maj|ma|Δ)/.test(n) || n === 'Δ7') return [0, 4, 7, 11]

  // Minor family
  if (/^(m|min)/.test(n)) {
    const sub = n.replace(/^(min|m)/, '')
    if (/^(maj|ma|Δ)/.test(sub)) return [0, 3, 7, 11]       // mMaj7
    if (/^[79]/.test(sub) || sub === '7') return [0, 3, 7, 10] // m7 / m9
    return [0, 3, 7]                                            // minor triad
  }

  // Dominant 7 / 9 / 11 / 13
  if (/^[79]|^1[13]/.test(n)) return [0, 4, 7, 10]

  // Suspended (sus2 / sus4) — treat as major triad for NCT analysis
  if (/^sus/.test(n)) return [0, 5, 7]

  // Default: major triad
  return [0, 4, 7]
}

/** Convenience: pitch-class of a note name like "Bb", "F#", "C" */
export function noteNameToPc(name: string): number {
  const letter = name[0].toUpperCase()
  let pc = NOTE_PC[letter] ?? 0
  for (let i = 1; i < name.length; i++) {
    if (name[i] === 'b' || name[i] === '♭') pc = (pc - 1 + 12) % 12
    if (name[i] === '#' || name[i] === '♯') pc = (pc + 1) % 12
  }
  return pc
}
