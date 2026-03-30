/**
 * Renderer Test — Checkpoint B
 * Stage 5: Visual SVG comparison — Native renderer vs Verovio
 *
 * Access at: /renderer-test
 *
 * Tabs:
 *   1. Visual — SVG rendered by native renderer (scroll to compare vs Verovio)
 *   2. Numeric — Checkpoint A: measure widths, note x-positions (Stage 3 data)
 */

import { useEffect, useState } from 'react'
import { renderScore }                from '../renderer/index'
import { extractScore }               from '../renderer/xmlExtractor'
import { computeHorizontalLayout }    from '../renderer/horizontalLayout'
import type {
  HorizontalLayout,
  HLayoutMeasure,
} from '../renderer/horizontalLayout'
import type { ExtractedScore }        from '../renderer/extractorTypes'
import type { RenderResult }          from '../renderer/types'

// ─── State ───────────────────────────────────────────────────────────────────

interface TestState {
  score:    ExtractedScore | null
  layout:   HorizontalLayout | null
  result:   RenderResult | null
  error:    string | null
  ms:       number
}

type Tab = 'visual' | 'numeric'

// ─── Component ───────────────────────────────────────────────────────────────

export function RendererTestView() {
  const [state, setState] = useState<TestState>({
    score: null, layout: null, result: null, error: null, ms: 0,
  })
  const [tab, setTab] = useState<Tab>('visual')
  const [expandedMeasure, setExpandedMeasure] = useState<number | null>(null)

  useEffect(() => {
    const t0 = performance.now()
    fetch('/DONNALEE.XML')
      .then(r => r.text())
      .then(xml => {
        const result = renderScore(xml)
        const score  = extractScore(xml)
        const layout = computeHorizontalLayout(score)
        const ms     = Math.round(performance.now() - t0)
        setState({ score, layout, result, error: null, ms })
      })
      .catch(e => setState(s => ({ ...s, error: String(e) })))
  }, [])

  const { score, layout, result, error, ms } = state

  if (error) {
    return (
      <div style={styles.page}>
        <h2 style={{ color: '#ef4444' }}>Error</h2>
        <pre style={{ color: '#fca5a5', fontSize: 12 }}>{error}</pre>
      </div>
    )
  }

  if (!score || !layout || !result) {
    return <div style={styles.page}><p style={{ color: '#888' }}>Loading…</p></div>
  }

  return (
    <div style={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>MAP Native Renderer</h1>
          <p style={styles.subtitle}>
            {tab === 'visual' ? 'Checkpoint B — Visual SVG' : 'Checkpoint A — Numeric Layout'}
            {' · '}{ms} ms · DONNALEE.XML ·{' '}
            {result.notes.length} notes · {result.renderedScore.pages.length} pages
          </p>
        </div>
        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(tab === 'visual'  ? styles.tabActive : {}) }} onClick={() => setTab('visual')}>🎼 Visual</button>
          <button style={{ ...styles.tab, ...(tab === 'numeric' ? styles.tabActive : {}) }} onClick={() => setTab('numeric')}>📊 Numeric</button>
        </div>
      </div>

      {/* ── Visual tab ─────────────────────────────────────────────────── */}
      {tab === 'visual' && (
        <VisualTab result={result} />
      )}

      {/* ── Numeric tab ────────────────────────────────────────────────── */}
      {tab === 'numeric' && (
        <NumericTab
          score={score}
          layout={layout}
          result={result}
          expandedMeasure={expandedMeasure}
          setExpandedMeasure={setExpandedMeasure}
        />
      )}
    </div>
  )
}

// ─── Visual tab ──────────────────────────────────────────────────────────────

function VisualTab({ result }: { result: RenderResult }) {
  const { renderedScore } = result
  const pageCount  = renderedScore.pages.length
  const noteCount  = result.notes.length
  const measureCount = renderedScore.metadata.measureCount

  return (
    <div>
      {/* Stats bar */}
      <div style={styles.statsBar}>
        <Stat label="Pages"    value={String(pageCount)} />
        <Stat label="Systems"  value={String(renderedScore.pages.reduce((s, p) => s + p.systems.length, 0))} />
        <Stat label="Measures" value={String(measureCount)} />
        <Stat label="Notes"    value={String(noteCount)} />
        <Stat label="Title"    value={renderedScore.metadata.title} />
        <Stat label="Key"      value={renderedScore.metadata.keySignature} />
        <Stat label="Time"     value={renderedScore.metadata.timeSignature} />
        {renderedScore.metadata.tempo && <Stat label="Tempo" value={`${renderedScore.metadata.tempo} BPM`} />}
      </div>

      {/* Instructions */}
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
        Native renderer output below. Compare visually against Verovio (open the main MAP app in another tab).
      </p>

      {/* SVG render output */}
      <div
        style={{
          background: '#f8f8f8',
          border: '1px solid #334155',
          borderRadius: 6,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 260px)',
          padding: 8,
        }}
        dangerouslySetInnerHTML={{ __html: result.svg }}
      />
    </div>
  )
}

// ─── Numeric tab (Stage 3 / Checkpoint A data) ───────────────────────────────

function NumericTab({
  score, layout, result, expandedMeasure, setExpandedMeasure,
}: {
  score: ExtractedScore
  layout: HorizontalLayout
  result: RenderResult
  expandedMeasure: number | null
  setExpandedMeasure: (n: number | null) => void
}) {
  const { systems, pages, measures } = layout
  const allMeasures   = [...measures.values()].sort((a, b) => a.measureNum - b.measureNum)
  const firstSystem   = systems[0]
  const avgMeasWidth  = allMeasures.reduce((s, m) => s + m.width, 0) / allMeasures.length

  return (
    <div>
      <Section title="Score Metadata">
        <KVTable rows={[
          ['Title',          score.metadata.title],
          ['Composer',       score.metadata.composer],
          ['Key',            `${score.metadata.fifths} (${Math.abs(score.metadata.fifths)}${score.metadata.fifths < 0 ? '♭' : '♯'}, ${score.metadata.mode})`],
          ['Time',           `${score.metadata.beats}/${score.metadata.beatType}`],
          ['Measures',       String(score.metadata.measureCount)],
          ['Staves',         String(score.metadata.staffCount)],
          ['Tempo',          score.metadata.tempo ? `${score.metadata.tempo} BPM` : '—'],
        ]} />
      </Section>

      <Section title="Layout Summary">
        <KVTable rows={[
          ['Page width',          `${layout.opts.pageWidth} px`],
          ['Usable width',        `${layout.opts.pageWidth - layout.opts.marginLeft - layout.opts.marginRight} px`],
          ['Spatium',             `${layout.opts.spatium} px`],
          ['System header width', `${firstSystem?.headerWidth ?? 0} px`],
          ['Total systems',       String(systems.length)],
          ['Total pages',         String(pages.length)],
          ['Avg measures / sys',  (score.metadata.measureCount / systems.length).toFixed(1)],
          ['Avg measure width',   `${avgMeasWidth.toFixed(1)} px`],
          ['Total notes rendered',String(result.notes.length)],
        ]} />
      </Section>

      <Section title={`Systems (${systems.length})`}>
        <table style={styles.table}>
          <thead>
            <tr>{['Sys #', 'Page', 'Measures', 'Range', 'minW sum', 'finalW'].map(h =>
              <th key={h} style={styles.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {systems.map(sys => {
              const sysMeasures = sys.measureNums.map(n => measures.get(n)!)
              const minW = sysMeasures.reduce((s, m) => s + m.minWidth, 0)
              const finW = sysMeasures.reduce((s, m) => s + m.width, 0)
              return (
                <tr key={sys.systemIndex} style={rowStyle(sys.systemIndex)}>
                  <td style={styles.td}>{sys.systemIndex + 1}</td>
                  <td style={styles.td}>{sys.pageIndex + 1}</td>
                  <td style={styles.td}>{sys.measureNums.length}</td>
                  <td style={styles.td}>m.{sys.measureNums[0]}–m.{sys.measureNums[sys.measureNums.length - 1]}</td>
                  <td style={styles.td}>{minW.toFixed(0)} px</td>
                  <td style={styles.td}>{(finW + sys.headerWidth).toFixed(0)} px</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Measures (click to expand segments)">
        <table style={styles.table}>
          <thead>
            <tr>{['m.#', 'Sys', 'x', 'minW', 'width', 'segs', 'notes'].map(h =>
              <th key={h} style={styles.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {allMeasures.map(m => {
              const noteCount = score.measures[m.measureNum - 1]?.notes.filter(n => !n.isGrace).length ?? 0
              const expanded  = expandedMeasure === m.measureNum
              return [
                <tr key={m.measureNum} style={{ ...rowStyle(m.measureNum - 1), cursor: 'pointer' }}
                  onClick={() => setExpandedMeasure(expanded ? null : m.measureNum)}>
                  <td style={{ ...styles.td, fontWeight: 600 }}>m.{m.measureNum}</td>
                  <td style={styles.td}>{m.systemIndex + 1}</td>
                  <td style={styles.td}>{m.x.toFixed(0)}</td>
                  <td style={styles.td}>{m.minWidth.toFixed(0)}</td>
                  <td style={{ ...styles.td, color: '#6366f1' }}>{m.width.toFixed(0)}</td>
                  <td style={styles.td}>{m.segments.length}</td>
                  <td style={styles.td}>{noteCount}</td>
                </tr>,
                expanded && (
                  <tr key={`${m.measureNum}-seg`}>
                    <td colSpan={7} style={{ padding: '4px 16px 8px', background: '#1e293b' }}>
                      <SegmentDetail measure={m} score={score} noteX={layout.noteX} />
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </Section>
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13 }}>{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      {children}
    </div>
  )
}

function KVTable({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ ...styles.table, width: 'auto' }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td style={{ ...styles.td, color: '#94a3b8', paddingRight: 24, whiteSpace: 'nowrap' }}>{k}</td>
            <td style={{ ...styles.td, fontWeight: 500 }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SegmentDetail({
  measure, score, noteX,
}: {
  measure: HLayoutMeasure
  score: ExtractedScore
  noteX: Map<string, number>
}) {
  const ext = score.measures[measure.measureNum - 1]
  return (
    <table style={{ ...styles.table, fontSize: 11 }}>
      <thead>
        <tr>{['Beat', 'Duration', 'Stretch', 'x', 'Width', 'Notes at beat'].map(h =>
          <th key={h} style={styles.th}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {measure.segments.map((seg, i) => {
          const notesHere = ext.notes.filter(n => !n.isGrace && Math.abs(n.beat - seg.beat) < 0.01)
          return (
            <tr key={i} style={rowStyle(i)}>
              <td style={styles.td}>{seg.beat.toFixed(2)}</td>
              <td style={styles.td}>{seg.duration.toFixed(3)}</td>
              <td style={{ ...styles.td, color: '#f59e0b' }}>{seg.stretch.toFixed(3)}</td>
              <td style={styles.td}>{seg.x.toFixed(1)}</td>
              <td style={styles.td}>{seg.width.toFixed(1)}</td>
              <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 10 }}>
                {notesHere.map(n => n.id).join(', ') || '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function rowStyle(idx: number): React.CSSProperties {
  return { background: idx % 2 === 0 ? '#0f172a' : '#1a2536' }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: '#0a0f1a',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    padding: '20px 28px 80px',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#f1f5f9' },
  subtitle: { color: '#64748b', fontSize: 12 },
  tabs: { display: 'flex', gap: 8 },
  tab: {
    padding: '6px 14px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 6,
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 13,
  },
  tabActive: {
    background: '#4f46e5',
    border: '1px solid #6366f1',
    color: '#fff',
  },
  statsBar: {
    display: 'flex',
    gap: 20,
    background: '#1e293b',
    padding: '10px 16px',
    borderRadius: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  section: { marginBottom: 28 },
  h2: {
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
    borderBottom: '1px solid #1e293b',
    paddingBottom: 5,
    marginBottom: 8,
  },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 12 },
  th: {
    textAlign: 'left', padding: '4px 10px',
    background: '#1e293b', color: '#94a3b8',
    fontWeight: 600, whiteSpace: 'nowrap',
    borderBottom: '1px solid #334155',
  },
  td: { padding: '3px 10px', color: '#e2e8f0', borderBottom: '1px solid #0f172a' },
}
