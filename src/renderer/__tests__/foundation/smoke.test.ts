import { describe, it, expect } from 'vitest'
import { loadReference } from '../helpers/loadReference'

describe('Vitest smoke test', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('loads reference data for 01-noteheads', () => {
    const ref = loadReference('01-noteheads')
    expect(ref.id).toBe('01-noteheads')
    expect(ref.measures.length).toBeGreaterThan(0)
    expect(ref.notes.length).toBeGreaterThan(0)
    expect(ref.pageSize.width).toBeGreaterThan(0)
  })

  it('loads reference data for 05-stems', () => {
    const ref = loadReference('05-stems')
    expect(ref.id).toBe('05-stems')
    expect(ref.stems.length).toBeGreaterThan(0)
  })

  it('loads all 15 fixtures without error', () => {
    const fixtures = [
      '01-noteheads', '02-accidentals', '03-rests', '04-beams', '05-stems',
      '06-key-signatures', '07-time-signatures', '08-ledger-lines', '09-tuplets',
      '10-ties', '11-chord-symbols', '12-barlines', '13-dots', '14-chords', '15-mixed',
    ]
    for (const f of fixtures) {
      const ref = loadReference(f)
      expect(ref.id).toBe(f)
    }
  })
})
