/**
 * MAP App Integration Test Harness — /app-test
 *
 * Layer 2 test: renders the same fixtures as /renderer-test but inside the
 * real app CSS context (ScoreView.css `.vrv-svg` and `.vrv-svg svg` rules).
 *
 * The key difference from /renderer-test (Layer 1):
 *   - SVG is injected into a `<div class="vrv-svg">` element
 *   - ScoreView.css is applied: width:100%, height:auto scaling
 *   - Reveals CSS regressions that only appear in the production layout
 *
 * URL: /app-test?case=01-noteheads&capture=1
 *
 * data-ready="true" is set on the container after SVG inject + document.fonts.ready.
 * Playwright (app-integration.spec.ts) waits for this before screenshotting.
 */

import { useEffect, useRef, useState } from 'react'
import { renderScore } from '../renderer/index'
import { TEST_CASES, type TestCase } from '../../renderer-tests/test-cases'
import '../components/score/ScoreView.css'

function getUrlParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key)
}

export function AppTestView() {
  const caseId      = getUrlParam('case')
  const captureMode = getUrlParam('capture') === '1'
  const tc          = TEST_CASES.find(t => t.id === caseId)

  if (!caseId || !tc) {
    return (
      <div style={{ padding: 20, fontFamily: 'monospace', background: '#fff', color: '#c00' }}>
        <b>AppTestView</b>: pass <code>?case=&lt;id&gt;</code> to load a test fixture.<br />
        Available: {TEST_CASES.map(t => t.id).join(', ')}
      </div>
    )
  }

  return <AppCaptureMode tc={tc} captureMode={captureMode} />
}

function AppCaptureMode({ tc, captureMode }: { tc: TestCase; captureMode: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/${tc.fixtureFile}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: /${tc.fixtureFile}`)
        return r.text()
      })
      .then(xml => {
        const result = renderScore(xml)
        const div = containerRef.current
        if (!div) return
        div.innerHTML = result.svg
        // Wait for fonts (declared in App.css) then signal Playwright
        document.fonts.ready.then(() => {
          if (div.isConnected) div.setAttribute('data-ready', 'true')
        })
      })
      .catch(e => setError(String(e)))
  }, [tc])

  if (error) return (
    <div style={{ padding: 16, background: '#fff', color: 'red', fontFamily: 'monospace' }}>
      ERROR: {error}
    </div>
  )

  if (!captureMode) {
    // Interactive: show case info header
    return (
      <div style={{ background: '#f8f9fa', minHeight: '100vh' }}>
        <div style={{ padding: '8px 16px', background: '#1e1e2e', color: '#e2e8f0', fontSize: 13, display: 'flex', gap: 16, alignItems: 'center' }}>
          <b>Layer 2 — App Context Test</b>
          <span style={{ color: '#94a3b8' }}>{tc.id} — {tc.title}</span>
          <span style={{ color: '#6366f1', fontSize: 11 }}>(.vrv-svg CSS active)</span>
        </div>
        {/* vrv-svg class applies ScoreView.css: width:100%, height:auto */}
        <div className="vrv-svg" ref={containerRef} data-testid="app-test-output" />
      </div>
    )
  }

  // Capture mode: minimal output, no chrome (for Playwright)
  return (
    <div style={{ background: '#ffffff', margin: 0, padding: 0 }}>
      <div className="vrv-svg" ref={containerRef} data-testid="app-test-output" />
    </div>
  )
}
