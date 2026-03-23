/**
 * verovio.worker.ts
 *
 * Runs Verovio WASM rendering off the main thread.
 * Protocol:
 *   IN  → { type: 'render', xml: string, id: number }
 *   OUT ← { type: 'result', svgs: string[], id: number }
 *       | { type: 'error',  message: string, id: number }
 */

// @ts-ignore — no bundled TS declarations for verovio
import createVerovioModule from 'verovio/wasm'
// @ts-ignore
import { VerovioToolkit } from 'verovio/esm'

let tkPromise: Promise<any> | null = null

function getToolkit(): Promise<any> {
  if (tkPromise) return tkPromise
  tkPromise = createVerovioModule().then((mod: any) => new VerovioToolkit(mod))
  return tkPromise!
}

self.onmessage = async (e: MessageEvent) => {
  const { type, xml, id } = e.data

  if (type !== 'render') return

  try {
    const tk = await getToolkit()

    tk.setOptions({
      pageWidth:        2100,
      scale:            40,
      adjustPageHeight: true,
      header:           'none',
      footer:           'none',
      breaks:           'auto',
      spacingSystem:    12,
    })

    tk.loadData(xml)  // caller sends already-prepared XML

    const log = tk.getLog()
    if (log) console.log('[Verovio worker]', log)

    const pageCount: number = tk.getPageCount()
    const svgs: string[] = []
    for (let i = 1; i <= pageCount; i++) {
      svgs.push(tk.renderToSVG(i, false))
    }

    self.postMessage({ type: 'result', svgs, id })
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err?.message ?? String(err), id })
  }
}
