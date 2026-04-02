/**
 * MAP Renderer — HTML Report Generator
 *
 * Reads renderer-tests/compare-result.json (written by compare.ts)
 * and generates renderer-tests/report.html — an interactive visual diff report.
 *
 * Layout (inspired by webmscore vtest_compare.html):
 *   One row per test case:
 *     [Test name + status] | [Reference] | [Current] | [Diff] | [Match%]
 *
 * Run: npx tsx renderer-tests/scripts/report.ts
 * Then open: renderer-tests/report.html in a browser
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT        = path.join(__dirname, '..')
const JSON_PATH   = path.join(ROOT, 'compare-result.json')
const REPORT_PATH = path.join(ROOT, 'report.html')

if (!fs.existsSync(JSON_PATH)) {
  console.error('compare-result.json not found. Run compare.ts first.')
  process.exit(1)
}

const { results, summary } = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'))

// Convert absolute paths to relative-from-report paths for <img> src
function imgSrc(absPath: string | null): string {
  if (!absPath) return ''
  return path.relative(ROOT, absPath).replace(/\\/g, '/')
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    pass: 'background:#14532d;color:#86efac',
    fail: 'background:#7f1d1d;color:#fca5a5',
    new:  'background:#1e3a5f;color:#93c5fd',
    missing: 'background:#1c1917;color:#78716c',
  }
  const icons: Record<string, string> = { pass:'✅', fail:'❌', new:'🆕', missing:'⬜' }
  return `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;${map[status] ?? ''}">${icons[status] ?? ''} ${status.toUpperCase()}</span>`
}

function imgCell(src: string | null, label: string): string {
  if (!src) return `<td style="vertical-align:top;padding:8px;color:#555;font-size:11px">${label}<br/><em>—</em></td>`
  return `<td style="vertical-align:top;padding:8px">
    <div style="font-size:10px;color:#888;margin-bottom:4px">${label}</div>
    <img src="${src}" style="max-width:280px;border:1px solid #333;border-radius:3px;display:block" loading="lazy"/>
  </td>`
}

const rows = results.map((r: {
  id: string; title: string; status: string; matchPct: number | null;
  diffPixels: number | null; totalPixels: number | null;
  refPath: string | null; curPath: string | null; diffPath: string | null;
}) => {
  const matchStr = r.matchPct !== null ? `${r.matchPct}%` : '—'
  const diffStr  = r.diffPixels !== null ? `${r.diffPixels.toLocaleString()} px` : '—'
  const rowBg    = r.status === 'pass' ? '#0a1a0a' : r.status === 'fail' ? '#1a0a0a' : '#0a0a1a'
  return `
  <tr style="background:${rowBg};border-bottom:1px solid #222">
    <td style="padding:12px 16px;vertical-align:top;min-width:180px">
      <div style="font-weight:700;font-size:13px;color:#e2e8f0;margin-bottom:6px">${r.id}</div>
      <div style="color:#64748b;font-size:11px;margin-bottom:8px">${r.title}</div>
      ${statusBadge(r.status)}
      ${r.matchPct !== null ? `<div style="margin-top:8px;font-size:12px;color:${r.matchPct === 100 ? '#86efac' : '#fca5a5'};font-weight:600">${matchStr}</div>` : ''}
      ${r.diffPixels !== null && r.diffPixels > 0 ? `<div style="font-size:10px;color:#64748b;margin-top:2px">${diffStr} differ</div>` : ''}
    </td>
    ${imgCell(imgSrc(r.refPath),  'Reference')}
    ${imgCell(imgSrc(r.curPath),  'Current')}
    ${imgCell(imgSrc(r.diffPath), 'Diff (red = changed)')}
  </tr>`
}).join('\n')

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MAP Renderer — Visual Test Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0f1a; color: #e2e8f0; font-family: system-ui, sans-serif; font-size: 13px; }
  .header { padding: 20px 24px; border-bottom: 1px solid #1e293b; background: #0d1117; }
  .header h1 { font-size: 18px; font-weight: 700; color: #f1f5f9; margin-bottom: 8px; }
  .header .meta { color: #64748b; font-size: 12px; }
  .summary { display: flex; gap: 20px; padding: 14px 24px; border-bottom: 1px solid #1e293b; background: #111; }
  .stat { text-align: center; }
  .stat .val { font-size: 22px; font-weight: 700; }
  .stat .lbl { font-size: 10px; color: #64748b; margin-top: 2px; }
  .pass-val { color: #86efac; }
  .fail-val { color: #fca5a5; }
  .new-val  { color: #93c5fd; }
  .miss-val { color: #78716c; }
  .filters { display: flex; gap: 8px; padding: 12px 24px; border-bottom: 1px solid #1e293b; }
  .filter-btn { padding: 4px 12px; border-radius: 12px; background: #1e293b; border: 1px solid #334155;
                color: #64748b; cursor: pointer; font-size: 11px; }
  .filter-btn.active { background: #4f46e5; border-color: #6366f1; color: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 16px; background: #111; color: #475569; font-size: 11px;
       text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1e293b; }
  td { vertical-align: top; }
  .hidden { display: none; }
</style>
</head>
<body>
<div class="header">
  <h1>MAP Renderer — Visual Test Report</h1>
  <div class="meta">Generated: ${new Date().toLocaleString()} &nbsp;·&nbsp; ${summary.total} test cases</div>
</div>

<div class="summary">
  <div class="stat"><div class="val pass-val">${summary.passCount}</div><div class="lbl">PASS</div></div>
  <div class="stat"><div class="val fail-val">${summary.failCount}</div><div class="lbl">FAIL</div></div>
  <div class="stat"><div class="val new-val">${summary.newCount}</div><div class="lbl">NEW</div></div>
  <div class="stat"><div class="val miss-val">${summary.missingCount}</div><div class="lbl">MISSING</div></div>
</div>

<div class="filters">
  <button class="filter-btn active" onclick="filter('all')">All (${summary.total})</button>
  <button class="filter-btn" onclick="filter('fail')">❌ Fail (${summary.failCount})</button>
  <button class="filter-btn" onclick="filter('pass')">✅ Pass (${summary.passCount})</button>
  <button class="filter-btn" onclick="filter('new')">🆕 New (${summary.newCount})</button>
</div>

<table>
  <thead>
    <tr>
      <th>Test</th>
      <th>Reference</th>
      <th>Current</th>
      <th>Diff</th>
    </tr>
  </thead>
  <tbody id="tbody">
${rows}
  </tbody>
</table>

<script>
function filter(status) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
  event.target.classList.add('active')
  document.querySelectorAll('#tbody tr').forEach(row => {
    const badge = row.querySelector('span')
    if (!badge) return
    const rowStatus = badge.textContent.trim().toLowerCase().split(' ').pop()
    if (status === 'all') { row.classList.remove('hidden'); return }
    row.classList.toggle('hidden', rowStatus !== status)
  })
}
</script>
</body>
</html>`

fs.writeFileSync(REPORT_PATH, html, 'utf-8')
console.log(`\n✅ Report written to: ${REPORT_PATH}`)
console.log(`   Open in browser: file:///${REPORT_PATH.replace(/\\/g, '/')}`)
