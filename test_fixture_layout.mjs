import { readFileSync } from 'fs'

// Parse the XML manually
const xml = readFileSync('renderer-tests/fixtures/12-barlines.xml', 'utf8')

// Check what horizontalLayout does with 12-barlines
// We know from tsx output that the layout gives measure 1 end at 942.95
// But screenshot shows barline at 983-986
// 
// Question: is the SVG renderer adding any offset to barline x?

// Look at svgRenderer.ts renderBarline function
const svgCode = readFileSync('src/renderer/svgRenderer.ts', 'utf8')

// Find renderBarline function
const idx = svgCode.indexOf('function renderBarline')
console.log('renderBarline function:')
console.log(svgCode.substring(idx, idx + 800))
