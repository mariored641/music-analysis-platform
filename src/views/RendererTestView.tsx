/**
 * MAP Renderer Test Harness — /renderer-test
 *
 * Modes (via URL params):
 *   /renderer-test                  → interactive: sidebar + main panel
 *   /renderer-test?case=01-noteheads → loads that case directly
 *   /renderer-test?capture=1        → clean SVG output only (for Playwright)
 *   /renderer-test?grid=1           → all cases in a grid (overview)
 *
 * Test cases defined in renderer-tests/test-cases.ts
 * Fixtures at /public/renderer-tests/fixtures/*.xml
 */

import { useEffect, useState, useRef } from 'react'
import { renderScore } from '../renderer/index'
import type { RenderResult } from '../renderer/types'
import { TEST_CASES, CATEGORIES, type TestCase, type Category } from '../../renderer-tests/test-cases'

// ─── URL params ───────────────────────────────────────────────────────────────

function getUrlParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RendererTestView() {
  const captureMode = getUrlParam('capture') === '1'
  const gridMode    = getUrlParam('grid') === '1'
  const caseParam   = getUrlParam('case')

  // Capture mode: minimal output, no UI chrome (for Playwright)
  if (captureMode && caseParam) {
    return <CaptureMode caseId={caseParam} />
  }

  // Grid mode: all cases side by side
  if (gridMode) {
    return <GridMode />
  }

  // Interactive mode
  return <InteractiveMode initialCaseId={caseParam ?? TEST_CASES[0].id} />
}

// ─── Capture mode (for Playwright screenshots) ────────────────────────────────

function CaptureMode({ caseId }: { caseId: string }) {
  const tc = TEST_CASES.find(t => t.id === caseId)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tc) { setError(`Unknown test case: ${caseId}`); return }
    fetch(`/${tc.fixtureFile}`)
      .then(r => r.text())
      .then(xml => {
        const result = renderScore(xml)
        setSvg(result.svg)
      })
      .catch(e => setError(String(e)))
  }, [caseId])

  // Mark ready for Playwright after fonts load
  useEffect(() => {
    if (!svg || !containerRef.current) return
    document.fonts.ready.then(() => {
      if (containerRef.current) {
        containerRef.current.setAttribute('data-ready', 'true')
      }
    })
  }, [svg])

  if (error) return (
    <div style={{ background: '#fff', padding: 16, color: 'red', fontFamily: 'monospace' }}>
      ERROR: {error}
    </div>
  )

  if (!svg) return (
    <div style={{ background: '#fff', padding: 16, color: '#999', fontFamily: 'monospace' }}>
      Loading…
    </div>
  )

  return (
    <div
      ref={containerRef}
      data-testid="renderer-output"
      style={{ background: '#ffffff', padding: 0, margin: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

// ─── Grid mode ────────────────────────────────────────────────────────────────

function GridMode() {
  const [category, setCategory] = useState<Category>('all')
  const filtered = category === 'all'
    ? TEST_CASES
    : TEST_CASES.filter(tc => tc.category === category)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}>MAP Renderer Tests — Grid View</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {CATEGORIES.map(cat => (
            <button key={cat} style={{ ...S.pill, ...(category === cat ? S.pillActive : {}) }}
              onClick={() => setCategory(cat)}>{cat}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20 }}>
        {filtered.map(tc => <GridCard key={tc.id} tc={tc} />)}
      </div>
    </div>
  )
}

function GridCard({ tc }: { tc: TestCase }) {
  const [result, setResult] = useState<RenderResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/${tc.fixtureFile}`)
      .then(r => r.text())
      .then(xml => setResult(renderScore(xml)))
      .catch(e => setError(String(e)))
  }, [tc.fixtureFile])

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardTitle}>{tc.title}</span>
        <span style={{ ...S.catBadge, background: CATEGORY_COLORS[tc.category] }}>{tc.category}</span>
      </div>
      <p style={S.cardDesc}>{tc.description}</p>
      <div style={S.cardScore}>
        {error && <div style={{ color: '#f87171', padding: 8, fontSize: 11 }}>Error: {error}</div>}
        {result && <div dangerouslySetInnerHTML={{ __html: result.svg }} />}
        {!result && !error && <div style={{ color: '#64748b', padding: 8, fontSize: 11 }}>Loading…</div>}
      </div>
      <a href={`/renderer-test?case=${tc.id}`} style={S.cardLink}>Open in detail →</a>
    </div>
  )
}

// ─── Interactive mode (main UI) ───────────────────────────────────────────────

function InteractiveMode({ initialCaseId }: { initialCaseId: string }) {
  const [selectedId, setSelectedId] = useState(initialCaseId)
  const [category, setCategory] = useState<Category>('all')
  const tc = TEST_CASES.find(t => t.id === selectedId) ?? TEST_CASES[0]

  const filtered = category === 'all'
    ? TEST_CASES
    : TEST_CASES.filter(t => t.category === category)

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0f1a', overflow: 'hidden' }}>
      {/* ── Sidebar ─────────────────────────────────── */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.h1}>MAP Renderer Tests</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} style={{ ...S.pill, ...(category === cat ? S.pillActive : {}) }}
                onClick={() => setCategory(cat)}>{cat}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map(t => (
            <div key={t.id}
              style={{ ...S.sidebarItem, ...(t.id === selectedId ? S.sidebarItemActive : {}) }}
              onClick={() => {
                setSelectedId(t.id)
                window.history.replaceState(null, '', `/renderer-test?case=${t.id}`)
              }}>
              <span style={{ fontWeight: 600, color: t.id === selectedId ? '#e2e8f0' : '#94a3b8' }}>
                {t.title}
              </span>
              <span style={{ ...S.catBadge, background: CATEGORY_COLORS[t.category], marginTop: 4 }}>
                {t.category}
              </span>
            </div>
          ))}
        </div>
        <div style={S.sidebarFooter}>
          <a href="/renderer-test?grid=1" style={S.footerLink}>Grid view →</a>
          <a href="/" style={S.footerLink}>← Back to MAP</a>
        </div>
      </div>

      {/* ── Main panel ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <DetailPanel tc={tc} />
      </div>
    </div>
  )
}

// ─── Detail panel (right side) ───────────────────────────────────────────────

function DetailPanel({ tc }: { tc: TestCase }) {
  const [result, setResult] = useState<RenderResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ms, setMs] = useState(0)
  const [tab, setTab] = useState<'score' | 'checklist' | 'info'>('score')
  const [checked, setChecked] = useState<Set<number>>(new Set())

  useEffect(() => {
    setResult(null)
    setError(null)
    setChecked(new Set())
    const t0 = performance.now()
    fetch(`/${tc.fixtureFile}`)
      .then(r => r.text())
      .then(xml => {
        setResult(renderScore(xml))
        setMs(Math.round(performance.now() - t0))
      })
      .catch(e => setError(String(e)))
  }, [tc.id])

  const toggleCheck = (i: number) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const passCount  = checked.size
  const totalCount = tc.checklist.length
  const allPassed  = passCount === totalCount

  return (
    <>
      {/* Header */}
      <div style={S.detailHeader}>
        <div>
          <div style={S.detailTitle}>{tc.title}</div>
          <div style={S.detailDesc}>{tc.description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {result && (
            <span style={{ color: '#64748b', fontSize: 11 }}>
              {result.notes.length} notes · {result.renderedScore.pages.length} pages · {ms} ms
            </span>
          )}
          <div style={{
            padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
            background: allPassed ? '#14532d' : '#1e293b',
            color: allPassed ? '#86efac' : '#64748b',
            border: `1px solid ${allPassed ? '#22c55e44' : '#334155'}`,
          }}>
            {passCount}/{totalCount} ✓
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {(['score', 'checklist', 'info'] as const).map(t => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}
            onClick={() => setTab(t)}>
            {t === 'score' ? '🎼 Score' : t === 'checklist' ? '✓ Checklist' : 'ℹ Info'}
          </button>
        ))}
        <a href={`/renderer-test?case=${tc.id}&capture=1`}
          target="_blank" rel="noreferrer"
          style={{ marginLeft: 'auto', ...S.tab, textDecoration: 'none' }}>
          📷 Capture view
        </a>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'score' && (
          <ScorePanel result={result} error={error} />
        )}
        {tab === 'checklist' && (
          <ChecklistPanel
            tc={tc}
            checked={checked}
            onToggle={toggleCheck}
            onClearAll={() => setChecked(new Set())}
            onPassAll={() => setChecked(new Set(tc.checklist.map((_, i) => i)))}
          />
        )}
        {tab === 'info' && result && (
          <InfoPanel result={result} tc={tc} />
        )}
      </div>
    </>
  )
}

function ScorePanel({ result, error }: { result: RenderResult | null; error: string | null }) {
  if (error) return (
    <div style={{ background: '#1e1e2e', border: '1px solid #ef4444', borderRadius: 8, padding: 16 }}>
      <div style={{ color: '#f87171', fontWeight: 600, marginBottom: 8 }}>Render Error</div>
      <pre style={{ color: '#fca5a5', fontSize: 11, whiteSpace: 'pre-wrap' }}>{error}</pre>
    </div>
  )
  if (!result) return <div style={{ color: '#64748b' }}>Loading…</div>
  return (
    <div style={{ background: '#f8f8f8', borderRadius: 6, padding: 8 }}
      dangerouslySetInnerHTML={{ __html: result.svg }} />
  )
}

function ChecklistPanel({
  tc, checked, onToggle, onClearAll, onPassAll,
}: {
  tc: TestCase
  checked: Set<number>
  onToggle: (i: number) => void
  onClearAll: () => void
  onPassAll: () => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={S.actionBtn} onClick={onPassAll}>✓ Mark all passed</button>
        <button style={S.actionBtn} onClick={onClearAll}>✗ Clear all</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tc.checklist.map((item, i) => {
          const isChecked = checked.has(i)
          return (
            <div key={i}
              onClick={() => onToggle(i)}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: isChecked ? '#14532d22' : '#1e293b',
                border: `1px solid ${isChecked ? '#22c55e44' : '#334155'}`,
                borderRadius: 6, padding: '10px 14px', cursor: 'pointer',
              }}>
              <div style={{
                width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                background: isChecked ? '#22c55e' : 'transparent',
                border: `2px solid ${isChecked ? '#22c55e' : '#475569'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 700,
              }}>
                {isChecked ? '✓' : ''}
              </div>
              <div>
                <div style={{ color: isChecked ? '#86efac' : '#e2e8f0', fontSize: 13 }}>
                  {item.label}
                </div>
                {item.detail && (
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                    {item.detail}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InfoPanel({ result, tc }: { result: RenderResult; tc: TestCase }) {
  const { renderedScore } = result
  const rows: [string, string][] = [
    ['Fixture file', tc.fixtureFile],
    ['Category', tc.category],
    ['Checklist items', String(tc.checklist.length)],
    ['Pages', String(renderedScore.pages.length)],
    ['Systems', String(renderedScore.pages.reduce((s, p) => s + p.systems.length, 0))],
    ['Measures', String(renderedScore.metadata.measureCount)],
    ['Notes rendered', String(result.notes.length)],
    ['Title', renderedScore.metadata.title],
    ['Key', renderedScore.metadata.keySignature],
    ['Time', renderedScore.metadata.timeSignature],
  ]
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td style={{ color: '#64748b', paddingRight: 24, paddingBottom: 8, whiteSpace: 'nowrap' }}>{k}</td>
            <td style={{ color: '#e2e8f0', paddingBottom: 8 }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  layout: '#7c3aed',
  notation: '#0369a1',
  symbols: '#b45309',
  spacing: '#065f46',
  integration: '#9f1239',
}

const S: Record<string, React.CSSProperties> = {
  page: {
    background: '#0a0f1a', color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif', fontSize: 13,
    padding: '20px 24px 60px', minHeight: '100vh',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  h1: { fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  pill: {
    padding: '3px 10px', borderRadius: 12,
    background: '#1e293b', border: '1px solid #334155',
    color: '#64748b', cursor: 'pointer', fontSize: 11,
  },
  pillActive: { background: '#4f46e5', border: '1px solid #6366f1', color: '#fff' },
  card: {
    background: '#111827', border: '1px solid #1e293b',
    borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', background: '#1a2035',
  },
  cardTitle: { fontWeight: 700, color: '#e2e8f0', fontSize: 13 },
  cardDesc: { color: '#64748b', fontSize: 11, margin: '8px 14px', lineHeight: 1.5 },
  cardScore: {
    background: '#fff', margin: '0 14px 14px',
    borderRadius: 4, overflow: 'hidden', maxHeight: 200,
  },
  cardLink: {
    display: 'block', padding: '8px 14px', color: '#818cf8', fontSize: 11,
    textDecoration: 'none', borderTop: '1px solid #1e293b',
  },
  catBadge: {
    display: 'inline-block', padding: '1px 7px', borderRadius: 10,
    color: '#fff', fontSize: 10, fontWeight: 600,
  },
  // Sidebar
  sidebar: {
    width: 220, background: '#0d1117', borderRight: '1px solid #1e293b',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  sidebarHeader: {
    padding: '16px 12px 10px', borderBottom: '1px solid #1e293b',
  },
  sidebarItem: {
    display: 'flex', flexDirection: 'column', padding: '10px 14px',
    cursor: 'pointer', borderBottom: '1px solid #111827',
  },
  sidebarItemActive: { background: '#1e293b' },
  sidebarFooter: {
    padding: '12px', borderTop: '1px solid #1e293b',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  footerLink: {
    color: '#475569', fontSize: 11, textDecoration: 'none',
  },
  // Detail panel
  detailHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '16px 20px 12px', borderBottom: '1px solid #1e293b',
    background: '#0d1117', flexShrink: 0,
  },
  detailTitle: { fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 },
  detailDesc: { color: '#64748b', fontSize: 12 },
  tabBar: {
    display: 'flex', gap: 4, padding: '8px 12px',
    borderBottom: '1px solid #1e293b', background: '#0d1117', flexShrink: 0,
  },
  tab: {
    padding: '5px 12px', borderRadius: 6,
    background: 'transparent', border: '1px solid transparent',
    color: '#64748b', cursor: 'pointer', fontSize: 12,
  },
  tabActive: {
    background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
  },
  actionBtn: {
    padding: '6px 14px', borderRadius: 6,
    background: '#1e293b', border: '1px solid #334155',
    color: '#94a3b8', cursor: 'pointer', fontSize: 12,
  },
}

