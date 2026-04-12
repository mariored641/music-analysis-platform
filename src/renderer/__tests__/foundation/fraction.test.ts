import { describe, it, expect } from 'vitest'
import { Fraction } from '../../Fraction'

describe('Fraction', () => {
  describe('construction and normalization', () => {
    it('creates a basic fraction', () => {
      const f = new Fraction(1, 4)
      expect(f.numerator).toBe(1)
      expect(f.denominator).toBe(4)
    })

    it('auto-reduces', () => {
      const f = new Fraction(2, 8)
      expect(f.numerator).toBe(1)
      expect(f.denominator).toBe(4)
    })

    it('reduces large fractions', () => {
      const f = new Fraction(6, 4)
      expect(f.numerator).toBe(3)
      expect(f.denominator).toBe(2)
    })

    it('normalizes negative denominator', () => {
      const f = new Fraction(1, -3)
      expect(f.numerator).toBe(-1)
      expect(f.denominator).toBe(3)
    })

    it('normalizes double negative', () => {
      const f = new Fraction(-1, -3)
      expect(f.numerator).toBe(1)
      expect(f.denominator).toBe(3)
    })

    it('normalizes zero numerator', () => {
      const f = new Fraction(0, 7)
      expect(f.numerator).toBe(0)
      expect(f.denominator).toBe(1)
    })

    it('throws on zero denominator', () => {
      expect(() => new Fraction(1, 0)).toThrow('zero denominator')
    })
  })

  describe('static factories', () => {
    it('zero()', () => {
      const f = Fraction.zero()
      expect(f.numerator).toBe(0)
      expect(f.denominator).toBe(1)
    })

    it('one()', () => {
      const f = Fraction.one()
      expect(f.numerator).toBe(1)
      expect(f.denominator).toBe(1)
    })

    it('fromNumber integer', () => {
      expect(Fraction.fromNumber(3).equals(new Fraction(3, 1))).toBe(true)
    })

    it('fromNumber simple decimal', () => {
      expect(Fraction.fromNumber(0.25).equals(new Fraction(1, 4))).toBe(true)
    })

    it('fromNumber repeating decimal', () => {
      const f = Fraction.fromNumber(1 / 3)
      expect(f.numerator).toBe(1)
      expect(f.denominator).toBe(3)
    })

    it('fromNumber 0.5', () => {
      expect(Fraction.fromNumber(0.5).equals(new Fraction(1, 2))).toBe(true)
    })

    it('fromNumber negative', () => {
      const f = Fraction.fromNumber(-0.75)
      expect(f.equals(new Fraction(-3, 4))).toBe(true)
    })

    it('fromTicks quarter', () => {
      const f = Fraction.fromTicks(480, 480)
      expect(f.equals(new Fraction(1, 4))).toBe(true)
    })

    it('fromTicks eighth', () => {
      const f = Fraction.fromTicks(240, 480)
      expect(f.equals(new Fraction(1, 8))).toBe(true)
    })

    it('fromTicks dotted quarter', () => {
      const f = Fraction.fromTicks(720, 480)
      expect(f.equals(new Fraction(3, 8))).toBe(true)
    })

    it('fromTicks whole note', () => {
      const f = Fraction.fromTicks(1920, 480)
      expect(f.equals(new Fraction(1, 1))).toBe(true)
    })
  })

  describe('arithmetic', () => {
    it('1/4 + 1/8 = 3/8', () => {
      const result = new Fraction(1, 4).add(new Fraction(1, 8))
      expect(result.equals(new Fraction(3, 8))).toBe(true)
    })

    it('1/3 + 1/6 = 1/2', () => {
      const result = new Fraction(1, 3).add(new Fraction(1, 6))
      expect(result.equals(new Fraction(1, 2))).toBe(true)
    })

    it('3/4 - 1/4 = 1/2', () => {
      const result = new Fraction(3, 4).sub(new Fraction(1, 4))
      expect(result.equals(new Fraction(1, 2))).toBe(true)
    })

    it('subtraction resulting in negative', () => {
      const result = new Fraction(1, 4).sub(new Fraction(3, 4))
      expect(result.equals(new Fraction(-1, 2))).toBe(true)
    })

    it('3/4 * 2/3 = 1/2', () => {
      const result = new Fraction(3, 4).mul(new Fraction(2, 3))
      expect(result.equals(new Fraction(1, 2))).toBe(true)
    })

    it('1/2 / 1/4 = 2', () => {
      const result = new Fraction(1, 2).div(new Fraction(1, 4))
      expect(result.equals(new Fraction(2, 1))).toBe(true)
    })

    it('division by zero throws', () => {
      expect(() => new Fraction(1, 2).div(Fraction.zero())).toThrow('division by zero')
    })

    it('adding zero is identity', () => {
      const f = new Fraction(3, 8)
      expect(f.add(Fraction.zero()).equals(f)).toBe(true)
    })

    it('multiplying by one is identity', () => {
      const f = new Fraction(3, 8)
      expect(f.mul(Fraction.one()).equals(f)).toBe(true)
    })
  })

  describe('comparison', () => {
    it('equals reduced forms', () => {
      expect(new Fraction(1, 4).equals(new Fraction(2, 8))).toBe(true)
    })

    it('lessThan', () => {
      expect(new Fraction(1, 8).lessThan(new Fraction(1, 4))).toBe(true)
      expect(new Fraction(1, 4).lessThan(new Fraction(1, 8))).toBe(false)
    })

    it('greaterThan', () => {
      expect(new Fraction(1, 2).greaterThan(new Fraction(1, 4))).toBe(true)
    })

    it('lessOrEqual', () => {
      expect(new Fraction(1, 4).lessOrEqual(new Fraction(1, 4))).toBe(true)
      expect(new Fraction(1, 4).lessOrEqual(new Fraction(1, 2))).toBe(true)
    })

    it('greaterOrEqual', () => {
      expect(new Fraction(1, 2).greaterOrEqual(new Fraction(1, 2))).toBe(true)
      expect(new Fraction(1, 2).greaterOrEqual(new Fraction(1, 4))).toBe(true)
    })

    it('compareTo returns -1, 0, 1', () => {
      expect(new Fraction(1, 8).compareTo(new Fraction(1, 4))).toBe(-1)
      expect(new Fraction(1, 4).compareTo(new Fraction(1, 4))).toBe(0)
      expect(new Fraction(1, 2).compareTo(new Fraction(1, 4))).toBe(1)
    })

    it('isZero, isNegative, isPositive', () => {
      expect(Fraction.zero().isZero()).toBe(true)
      expect(new Fraction(-1, 4).isNegative()).toBe(true)
      expect(new Fraction(1, 4).isPositive()).toBe(true)
      expect(new Fraction(1, 4).isZero()).toBe(false)
      expect(new Fraction(1, 4).isNegative()).toBe(false)
    })
  })

  describe('conversion', () => {
    it('toNumber: 3/8 → 0.375', () => {
      expect(new Fraction(3, 8).toNumber()).toBe(0.375)
    })

    it('toNumber: 1/3 → ~0.333', () => {
      expect(new Fraction(1, 3).toNumber()).toBeCloseTo(1 / 3, 10)
    })

    it('ticks: quarter = tpq', () => {
      expect(new Fraction(1, 4).ticks(480)).toBe(480)
    })

    it('ticks: eighth = tpq/2', () => {
      expect(new Fraction(1, 8).ticks(480)).toBe(240)
    })

    it('ticks: dotted quarter (3/8)', () => {
      expect(new Fraction(3, 8).ticks(480)).toBe(720)
    })

    it('ticks: whole note', () => {
      expect(new Fraction(1, 1).ticks(480)).toBe(1920)
    })

    it('ticks: sixteenth', () => {
      expect(new Fraction(1, 16).ticks(480)).toBe(120)
    })

    it('toString', () => {
      expect(new Fraction(3, 8).toString()).toBe('3/8')
      expect(new Fraction(-1, 4).toString()).toBe('-1/4')
      expect(Fraction.zero().toString()).toBe('0/1')
    })
  })
})
