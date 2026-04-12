import { DOMParser } from 'linkedom'
;(globalThis as any).DOMParser = DOMParser
import { loadFixtureXml } from './pipeline/harness'
import { extractScore } from '../src/renderer/xmlExtractor'
import { computeSegmentWidths, computeMeasureWidth, computeDurationStretch, BAR_NOTE_DIST_SP, NOTE_BAR_DIST_SP } from '../src/renderer/engine/layout/LayoutMeasure'
import { orchestrateHorizontalLayout } from '../src/renderer/engine/LayoutOrchestrator'

const fixtureId = process.argv[2] || '07-time-signatures'
const xml = loadFixtureXml(fixtureId)
const extracted = extractScore(xml)
const sp = 24.8

const hLayout = orchestrateHorizontalLayout(extracted)
const sys0 = hLayout.systems[0]
console.log('Sys0 sysMin/sysMax deduced from measures:')

// Check m1 raw vs scaled widths
const m1 = hLayout.measures.get(1)!
console.log('m1: minW='+m1.minWidth.toFixed(3)+' w='+m1.width.toFixed(3))

// Manually compute with sysMin=0.5, sysMax=2
const segs1 = [{beat:1, durationQb:1.0},{beat:2,durationQb:1.0},{beat:3,durationQb:1.0},{beat:4,durationQb:1.0}]
const raw1 = computeSegmentWidths(segs1, 0.5, sp, 2.0)
const pad1 = BAR_NOTE_DIST_SP * sp
const minW1 = computeMeasureWidth(pad1, raw1, sp)
console.log('Manual m1 minW with sysMin=0.5 sysMax=2:', minW1.toFixed(3))
console.log('Raw segs:', raw1.map(w=>w.toFixed(3)))
console.log('BAR_NOTE_DIST_SP:', BAR_NOTE_DIST_SP, 'NOTE_BAR_DIST_SP:', NOTE_BAR_DIST_SP)
console.log('pad1:', pad1.toFixed(3))

// Check system 1 sysMinDur/sysMaxDur from the orchestrator output
// We can't access them directly, but let's check m7 and m1 stretch
const m1seg = m1.segments[0]
console.log('\nm1 seg[0]: beat='+m1seg.beat+' dur='+m1seg.duration+' stretch='+m1seg.stretch.toFixed(4))

// Back-calculate sysMin from the stretch value
// str = 1.873 for dur=1.0qb
// empFactor applied when dMin > 0.25
// With dMin=0.5: str = 1.5 * (0.4 + 0.6*sqrt(0.5/0.25)) = 1.5*1.2493 = 1.8739
// So str=1.873 means sysMin=0.5

// What raw width does the seg have?
// rawW * noteScale = scaledW = seg.width
// noteScale = (m1.width - pad - trail) / rawNoteArea
const trail = NOTE_BAR_DIST_SP * sp
const noteArea_m1 = m1.segments.reduce((s, sg) => s + sg.width, 0)
console.log('\nm1 segments total scaled:', noteArea_m1.toFixed(3))
console.log('m1.width - pad - trail:', (m1.width - pad1 - trail).toFixed(3))
