import { computeHorizontalLayout, FIRST_SYSTEM_INDENT_SP } from './src/renderer/horizontalLayout'

// Check the constant
console.log('FIRST_SYSTEM_INDENT_SP =', FIRST_SYSTEM_INDENT_SP)
console.log('Expected: 5.0')

// Test with a mock score
const mockScore = {
  title: 'Test',
  composer: '',
  measures: Array.from({length: 5}, (_, i) => ({
    number: i + 1,
    notes: [{pitch: {step:'C', octave:5}, duration: 4, type:'whole', dots:0, staff:1, voice:1, isRest:false, beam:undefined, tie:undefined, accidental:undefined, fermata:false, id:'n'+i}],
    attributes: i === 0 ? {divisions:4, fifths:0, mode:'major', beats:4, beatType:4, clef:'treble'} : undefined,
    barlines: [],
    harmonies: [],
    clefChange: undefined,
    keyChange: undefined,
    timeChange: undefined,
  })),
  keyFifths: 0,
  mode: 'major',
  beats: 4,
  beatType: 4,
  timeUnit: 4,
  totalMeasures: 5,
  clef: 'treble',
}
const layout = computeHorizontalLayout(mockScore as any, {})
for (const sys of layout.systems) {
  console.log('sys '+sys.systemIndex+': x='+sys.x.toFixed(1)+' width='+sys.width.toFixed(1)+' (indent applied: '+(sys.x > 220 ? 'YES' : 'NO')+')')
}
