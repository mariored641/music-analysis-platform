/**
 * Fraction.ts — Exact rational arithmetic for music layout
 *
 * Mirrors MuseScore C++ `class Fraction { int _numerator; int _denominator; }`.
 * Immutable value object — all operations return new instances.
 *
 * Ticks convention: Fraction(1,4).ticks(480) = 480 (quarter = tpq).
 * Formula: ticks = (numerator * tpq * 4) / denominator
 */

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

export class Fraction {
  readonly numerator: number
  readonly denominator: number

  constructor(numerator: number, denominator: number) {
    if (denominator === 0) {
      throw new Error('Fraction: zero denominator')
    }
    // Normalize sign: denominator always positive
    if (denominator < 0) {
      numerator = -numerator
      denominator = -denominator
    }
    // Special-case zero
    if (numerator === 0) {
      this.numerator = 0
      this.denominator = 1
      return
    }
    // Reduce to lowest terms
    const g = gcd(numerator, denominator)
    this.numerator = numerator / g
    this.denominator = denominator / g
  }

  // ── Static factories ──

  static zero(): Fraction {
    return new Fraction(0, 1)
  }

  static one(): Fraction {
    return new Fraction(1, 1)
  }

  /**
   * Convert a float to a Fraction using continued fraction approximation.
   * Max denominator 1920 (LCM of common music denominators: 1,2,3,4,5,6,7,8,16,32).
   */
  static fromNumber(n: number): Fraction {
    if (Number.isInteger(n)) {
      return new Fraction(n, 1)
    }
    // Continued fraction approximation
    const maxDenom = 1920
    const sign = n < 0 ? -1 : 1
    n = Math.abs(n)

    let bestNum = Math.round(n)
    let bestDen = 1
    let bestErr = Math.abs(n - bestNum)

    // Stern-Brocot / mediants approach
    let pPrev = 0, qPrev = 1
    let pCurr = 1, qCurr = 0
    let x = n

    for (let i = 0; i < 64 && bestErr > 1e-12; i++) {
      const a = Math.floor(x)
      const pNext = a * pCurr + pPrev
      const qNext = a * qCurr + qPrev

      if (qNext > maxDenom) break

      const err = Math.abs(n - pNext / qNext)
      if (err < bestErr) {
        bestErr = err
        bestNum = pNext
        bestDen = qNext
      }

      if (err < 1e-12) break

      pPrev = pCurr
      qPrev = qCurr
      pCurr = pNext
      qCurr = qNext

      const remainder = x - a
      if (Math.abs(remainder) < 1e-12) break
      x = 1 / remainder
    }

    return new Fraction(sign * bestNum, bestDen)
  }

  /**
   * Convert MIDI-style ticks to a Fraction.
   * e.g. fromTicks(240, 480) → Fraction(1, 8) because 240 = (1*480*4)/8
   */
  static fromTicks(ticks: number, ticksPerQuarter: number): Fraction {
    // ticks = (num * tpq * 4) / den → num/den = ticks / (tpq * 4)
    const whole = ticksPerQuarter * 4
    return new Fraction(ticks, whole)
  }

  // ── Arithmetic ──

  add(other: Fraction): Fraction {
    return new Fraction(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    )
  }

  sub(other: Fraction): Fraction {
    return new Fraction(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    )
  }

  mul(other: Fraction): Fraction {
    return new Fraction(
      this.numerator * other.numerator,
      this.denominator * other.denominator,
    )
  }

  div(other: Fraction): Fraction {
    if (other.numerator === 0) {
      throw new Error('Fraction: division by zero')
    }
    return new Fraction(
      this.numerator * other.denominator,
      this.denominator * other.numerator,
    )
  }

  // ── Comparison ──

  equals(other: Fraction): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator
  }

  lessThan(other: Fraction): boolean {
    return this.numerator * other.denominator < other.numerator * this.denominator
  }

  lessOrEqual(other: Fraction): boolean {
    return this.numerator * other.denominator <= other.numerator * this.denominator
  }

  greaterThan(other: Fraction): boolean {
    return this.numerator * other.denominator > other.numerator * this.denominator
  }

  greaterOrEqual(other: Fraction): boolean {
    return this.numerator * other.denominator >= other.numerator * this.denominator
  }

  compareTo(other: Fraction): -1 | 0 | 1 {
    const diff = this.numerator * other.denominator - other.numerator * this.denominator
    return diff < 0 ? -1 : diff > 0 ? 1 : 0
  }

  isZero(): boolean {
    return this.numerator === 0
  }

  isNegative(): boolean {
    return this.numerator < 0
  }

  isPositive(): boolean {
    return this.numerator > 0
  }

  // ── Conversion ──

  toNumber(): number {
    return this.numerator / this.denominator
  }

  /**
   * Convert to MIDI-style ticks.
   * Fraction(1,4).ticks(480) = 480 (quarter note)
   * Fraction(1,8).ticks(480) = 240 (eighth note)
   */
  ticks(ticksPerQuarter: number): number {
    return (this.numerator * ticksPerQuarter * 4) / this.denominator
  }

  toString(): string {
    return `${this.numerator}/${this.denominator}`
  }
}
