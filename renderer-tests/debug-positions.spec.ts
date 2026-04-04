import { test } from '@playwright/test'

test('debug barline positions', async ({ page }) => {
  await page.goto('/renderer-test?case=12-barlines&capture=1')
  await page.waitForSelector('[data-ready="true"]', { timeout: 15000 })

  const positions = await page.evaluate(() => {
    const svg = document.querySelector('svg')!
    if (!svg) return { barlines: [], svgViewBox: 'no svg', svgWidth: '?' }
    const lines = Array.from(svg.querySelectorAll('line'))
    // Find barlines (tall vertical lines spanning staff height ~99px)
    const barlines = lines
      .filter(l => {
        const x1 = parseFloat(l.getAttribute('x1') || '0')
        const x2 = parseFloat(l.getAttribute('x2') || '0')
        const y1 = parseFloat(l.getAttribute('y1') || '0')
        const y2 = parseFloat(l.getAttribute('y2') || '0')
        const height = Math.abs(y2 - y1)
        return Math.abs(x1 - x2) < 5 && height > 80  // vertical, tall (barline height ~99px)
      })
      .map(l => ({ 
        x: parseFloat(l.getAttribute('x1') || '0'), 
        h: Math.abs(parseFloat(l.getAttribute('y2') || '0') - parseFloat(l.getAttribute('y1') || '0')),
        sw: l.getAttribute('stroke-width')
      }))
      .sort((a, b) => a.x - b.x)
    
    const svgViewBox = svg.getAttribute('viewBox')
    const svgWidth = svg.getAttribute('width')
    return { barlines, svgViewBox, svgWidth }
  })

  console.log('SVG dimensions:', positions.svgViewBox, positions.svgWidth)
  console.log('Barlines (SVG coords):')
  positions.barlines.forEach(b => console.log(`  x=${b.x.toFixed(2)} h=${b.h.toFixed(2)} sw=${b.sw}`))
})
