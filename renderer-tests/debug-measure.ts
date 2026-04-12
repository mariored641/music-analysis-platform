import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser
import { computeSegmentWidths, computeMeasureWidth } from '../src/renderer/engine/layout/LayoutMeasure'

const sp = 24.8
// m4 = 8 eighth notes, no accidentals
const segs = Array(8).fill(0).map((_:any,i:number) => ({beat: 1+i*0.5, durationQb: 0.5}))
const ws025 = computeSegmentWidths(segs, 0.25, sp, 4.0)
const ws05  = computeSegmentWidths(segs, 0.5,  sp, 4.0)
console.log('segW with min=0.25:', ws025[0].toFixed(2), '(each)')
console.log('segW with min=0.5:', ws05[0].toFixed(2), '(each)')
console.log('m4 minWidth min=0.25:', computeMeasureWidth(1.3*sp, ws025, sp).toFixed(2))
console.log('m4 minWidth min=0.5:', computeMeasureWidth(1.3*sp, ws05, sp).toFixed(2))
