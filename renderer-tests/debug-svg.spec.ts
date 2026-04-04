import { test } from '@playwright/test'

test('debug SVG structure', async ({ page }) => {
  await page.goto('/renderer-test?case=12-barlines&capture=1')
  await page.waitForSelector('[data-ready="true"]', { timeout: 15000 })

  const info = await page.evaluate(() => {
    const svg = document.querySelector('svg')!
    if (!svg) return { transforms: [], systemX: 'no svg' }
    
    // Check for g[transform] elements
    const groups = Array.from(svg.querySelectorAll('g[transform]'))
    const transforms = groups.slice(0, 10).map(g => ({
      transform: g.getAttribute('transform'),
      class: g.getAttribute('class') || '',
    }))
    
    // Check any data attributes on the SVG
    const allAttrs = Array.from(svg.attributes).map(a => `${a.name}=${a.value}`)
    
    // Find the first text elements (title, etc.)
    const texts = Array.from(svg.querySelectorAll('text')).slice(0, 5).map(t => ({
      x: t.getAttribute('x'), y: t.getAttribute('y'), text: t.textContent?.slice(0, 30)
    }))
    
    return { transforms, allAttrs, texts }
  })

  console.log('SVG attributes:', info.allAttrs?.join('\n  '))
  console.log('Transforms:', JSON.stringify(info.transforms, null, 2))
  console.log('Texts:', JSON.stringify(info.texts, null, 2))
})
