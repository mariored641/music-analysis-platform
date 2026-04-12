import { describe, it, expect } from 'vitest'
import { Sid, ScoreStyle, defaultStyle, getSidDefs, SidType, getPagePrintableWidthSp, sidInchToMm } from '../../style/StyleDef'

describe('ScoreStyle', () => {
  describe('default values match previous Sid constants', () => {
    it('staffDistance === 6.5', () => {
      expect(defaultStyle.styleD('staffDistance')).toBe(6.5)
    })

    it('spatiumDefault === 24.8', () => {
      expect(defaultStyle.styleD('spatiumDefault')).toBe(24.8)
    })

    it('pagePrintableWidthMm === 180.0', () => {
      expect(defaultStyle.styleD('pagePrintableWidthMm')).toBe(180.0)
    })

    it('staffUpperBorder === 7.0', () => {
      expect(defaultStyle.styleD('staffUpperBorder')).toBe(7.0)
    })

    it('minSystemDistance === 8.5', () => {
      expect(defaultStyle.styleD('minSystemDistance')).toBe(8.5)
    })

    it('barWidth === 0.18', () => {
      expect(defaultStyle.styleD('barWidth')).toBe(0.18)
    })

    it('stemWidth === 0.10', () => {
      expect(defaultStyle.styleD('stemWidth')).toBe(0.10)
    })

    it('beamWidth === 0.5', () => {
      expect(defaultStyle.styleD('beamWidth')).toBe(0.5)
    })

    it('minNoteDistance === 0.5', () => {
      expect(defaultStyle.styleD('minNoteDistance')).toBe(0.5)
    })

    it('measureSpacing === 1.5', () => {
      expect(defaultStyle.styleD('measureSpacing')).toBe(1.5)
    })

    it('enableIndentationOnFirstSystem === true', () => {
      expect(defaultStyle.styleB('enableIndentationOnFirstSystem')).toBe(true)
    })

    it('beamNoSlope === false', () => {
      expect(defaultStyle.styleB('beamNoSlope')).toBe(false)
    })
  })

  describe('Sid proxy backward compatibility', () => {
    it('Sid.staffDistance === 6.5', () => {
      expect(Sid.staffDistance).toBe(6.5)
    })

    it('Sid.barWidth === 0.18', () => {
      expect(Sid.barWidth).toBe(0.18)
    })

    it('Sid.enableIndentationOnFirstSystem === true', () => {
      expect(Sid.enableIndentationOnFirstSystem).toBe(true)
    })

    it('Sid.measureSpacing === 1.5', () => {
      expect(Sid.measureSpacing).toBe(1.5)
    })

    it('Sid.beamWidth === 0.5', () => {
      expect(Sid.beamWidth).toBe(0.5)
    })

    it('Sid.lastSystemFillLimit === 0.3', () => {
      expect(Sid.lastSystemFillLimit).toBe(0.3)
    })

    it('Sid.pagePrintableWidthMm === 180.0', () => {
      expect(Sid.pagePrintableWidthMm).toBe(180.0)
    })

    it('Sid.stemLength === 3.5', () => {
      expect(Sid.stemLength).toBe(3.5)
    })

    it('Sid.dotNoteDistance === 0.5', () => {
      expect(Sid.dotNoteDistance).toBe(0.5)
    })

    it('Sid.ledgerLineLength === 0.33', () => {
      expect(Sid.ledgerLineLength).toBe(0.33)
    })

    it('unknown key returns undefined', () => {
      expect(Sid.nonExistentKey12345).toBeUndefined()
    })
  })

  describe('typed accessors', () => {
    it('styleD returns number for numeric Sids', () => {
      const style = new ScoreStyle()
      expect(typeof style.styleD('staffDistance')).toBe('number')
    })

    it('styleB returns boolean for bool Sids', () => {
      const style = new ScoreStyle()
      expect(typeof style.styleB('enableIndentationOnFirstSystem')).toBe('boolean')
    })

    it('throws on unknown key', () => {
      const style = new ScoreStyle()
      expect(() => style.style('nonExistent')).toThrow('unknown Sid')
    })

    it('set() overrides a value', () => {
      const style = new ScoreStyle()
      style.set('staffDistance', 8.0)
      expect(style.styleD('staffDistance')).toBe(8.0)
    })

    it('set() does not affect other instances', () => {
      const style1 = new ScoreStyle()
      const style2 = new ScoreStyle()
      style1.set('staffDistance', 99.0)
      expect(style2.styleD('staffDistance')).toBe(6.5)
    })

    it('set() throws on unknown key', () => {
      const style = new ScoreStyle()
      expect(() => style.set('bogus', 1)).toThrow('unknown Sid')
    })

    it('resetToDefault() restores original value', () => {
      const style = new ScoreStyle()
      style.set('staffDistance', 99.0)
      style.resetToDefault('staffDistance')
      expect(style.styleD('staffDistance')).toBe(6.5)
    })
  })

  describe('precomputeValues', () => {
    it('converts SPATIUM Sids to pixels', () => {
      const style = new ScoreStyle()
      style.precomputeValues(20)
      expect(style.stylePx('staffDistance')).toBe(6.5 * 20)
    })

    it('does NOT precompute non-SPATIUM values', () => {
      const style = new ScoreStyle()
      style.precomputeValues(20)
      expect(() => style.stylePx('pagePrintableWidthMm')).toThrow('not a SPATIUM-type')
    })

    it('throws if precomputeValues not called', () => {
      const style = new ScoreStyle()
      expect(() => style.stylePx('staffDistance')).toThrow('precomputeValues')
    })

    it('updates when spatium changes', () => {
      const style = new ScoreStyle()
      style.precomputeValues(10)
      expect(style.stylePx('staffDistance')).toBe(65)
      style.precomputeValues(20)
      expect(style.stylePx('staffDistance')).toBe(130)
    })

    it('reflects set() changes after re-precompute', () => {
      const style = new ScoreStyle()
      style.set('staffDistance', 8.0)
      style.precomputeValues(20)
      expect(style.stylePx('staffDistance')).toBe(160)
    })
  })

  describe('loadEngravingDefaults', () => {
    it('Leland overrides values', () => {
      const style = new ScoreStyle()
      style.loadEngravingDefaults('Leland')
      expect(style.styleD('staffLineWidth')).toBe(0.11)
      expect(style.styleD('stemWidth')).toBe(0.10)
      expect(style.styleD('beamWidth')).toBe(0.50)
      expect(style.styleD('ledgerLineLength')).toBe(0.35)
    })

    it('unknown font is no-op', () => {
      const style = new ScoreStyle()
      const before = style.styleD('staffLineWidth')
      style.loadEngravingDefaults('Nonexistent')
      expect(style.styleD('staffLineWidth')).toBe(before)
    })

    it('re-precomputes after loading', () => {
      const style = new ScoreStyle()
      style.precomputeValues(20)
      const before = style.stylePx('ledgerLineLength')
      // Leland sets ledgerLineLength to 0.35 (default is 0.33)
      style.loadEngravingDefaults('Leland')
      expect(style.stylePx('ledgerLineLength')).toBe(0.35 * 20)
      expect(style.stylePx('ledgerLineLength')).not.toBe(before)
    })
  })

  describe('Sid definitions', () => {
    it('has at least 100 Sid keys', () => {
      expect(Object.keys(getSidDefs()).length).toBeGreaterThanOrEqual(100)
    })

    it('has new horizontal spacing Sids', () => {
      expect(defaultStyle.has('minMeasureWidth')).toBe(true)
      expect(defaultStyle.has('barAccidentalDistance')).toBe(true)
      expect(defaultStyle.has('systemHeaderDistance')).toBe(true)
    })

    it('has slur/tie Sids', () => {
      expect(defaultStyle.has('slurMidWidth')).toBe(true)
      expect(defaultStyle.has('tieMidWidth')).toBe(true)
    })

    it('has tuplet Sids', () => {
      expect(defaultStyle.has('tupletBracketWidth')).toBe(true)
    })

    it('has lyrics Sids', () => {
      expect(defaultStyle.has('lyricsMinTopDistance')).toBe(true)
    })

    it('sidCount matches', () => {
      expect(defaultStyle.sidCount).toBe(Object.keys(getSidDefs()).length)
    })
  })

  describe('utility functions preserved', () => {
    it('getPagePrintableWidthSp returns correct value', () => {
      const result = getPagePrintableWidthSp(20, 96)
      expect(result).toBeGreaterThan(0)
      expect(typeof result).toBe('number')
    })

    it('sidInchToMm converts correctly', () => {
      expect(sidInchToMm(1)).toBeCloseTo(25.4, 1)
    })
  })
})
