/**
 * Every way of getting a piece in or out of the workspace goes through here,
 * so loading, saving and syncing behave the same everywhere.
 */
import { useAnnotationStore } from '../store/annotationStore'
import { useLibraryStore, type LibraryPiece } from '../store/libraryStore'
import { useResearchStore } from '../store/researchStore'
import { useSelectionStore } from '../store/selectionStore'
import { usePlaybackStore } from '../store/playbackStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { deleteFile, loadFile, saveFile } from './storageService'
import { parseHarmonies, parseMusicXml } from './xmlParser'
import { migrateAnnotations } from './migrate'
import { buildAnalysisFile, parseAnalysisFile } from './analysisExport'
import { readPieceAnalysis, scanFolder, writePieceToFolder } from './syncService'
import { deleteThumbnail } from '../score/thumbnail'
import { useUiStore } from '../store/uiStore'
import { tr } from '../i18n'

// While a piece's saved state is being applied to the stores, autosave must not
// treat it as an edit.
let applying = 0
export const isApplyingLoad = () => applying > 0
function applyLoaded(fn: () => void) {
  applying++
  try { fn() } finally { applying-- }
}

// ── File reading ─────────────────────────────────────────────────────────────

export async function readScoreFile(file: File): Promise<string> {
  if (!/\.mxl$/i.test(file.name)) return file.text()
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const container = await zip.file('META-INF/container.xml')?.async('string')
  const path = container?.match(/full-path="([^"]+)"/i)?.[1]
    ?? Object.keys(zip.files).find(n => /\.(xml|musicxml)$/i.test(n) && !n.startsWith('META-INF'))
  const root = path ? zip.file(path) : null
  if (!root) throw new Error('Invalid MXL file')
  return root.async('string')
}

export function isScoreFile(name: string) {
  return /\.(xml|musicxml|mxl)$/i.test(name)
}

/** Metadata suggestion for the import form, read from the XML itself. */
export function suggestMeta(xml: string, fileName: string): Partial<LibraryPiece> {
  const nm = parseMusicXml(xml)
  const fallback = fileName.replace(/\.(musicxml|xml|mxl)$/i, '').replace(/[_-]+/g, ' ')
  const title = nm.metadata.title && nm.metadata.title !== 'Untitled' ? nm.metadata.title : fallback
  return {
    title: titleCase(title),
    composer: nm.metadata.composer,
    key: nm.metadata.key,
    timeSignature: nm.metadata.timeSignature,
    totalMeasures: nm.metadata.totalMeasures,
  }
}

function titleCase(s: string) {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s
}

// ── Import ───────────────────────────────────────────────────────────────────

function uniqueId(fileName: string): string {
  const ids = new Set(useLibraryStore.getState().pieces.map(p => p.id))
  if (!ids.has(fileName)) return fileName
  const m = fileName.match(/^(.*?)(\.[^.]+)?$/)!
  for (let n = 2; ; n++) {
    const id = `${m[1]}-${n}${m[2] ?? ''}`
    if (!ids.has(id)) return id
  }
}

/** Add a piece to the library (and IndexedDB). Returns its id. */
export async function importPiece(
  fileName: string,
  xml: string,
  meta: Partial<LibraryPiece> = {},
  analysisText?: string | null,
): Promise<string> {
  const nm = parseMusicXml(xml)
  const id = uniqueId(fileName)
  const now = Date.now()
  const analysis = analysisText ? parseAnalysisFile(analysisText) : null
  await saveFile(id, xml, analysis?.annotations ?? {}, analysis?.researchNotes ?? [], analysis?.savedAt || now)
  useLibraryStore.getState().addPiece({
    id,
    fileName,
    title: meta.title || analysis?.piece?.title || suggestMeta(xml, fileName).title || fileName,
    composer: meta.composer ?? analysis?.piece?.composer ?? nm.metadata.composer,
    genre: meta.genre ?? analysis?.piece?.genre,
    year: meta.year ?? analysis?.piece?.year,
    notes: meta.notes ?? analysis?.piece?.notes,
    key: nm.metadata.key,
    timeSignature: nm.metadata.timeSignature,
    totalMeasures: nm.metadata.totalMeasures,
    dateAdded: now,
    lastModified: now,
    lastOpened: 0,
    tagCount: analysis ? Object.keys(analysis.annotations).length : 0,
  })
  return id
}

export async function loadSamplePiece(): Promise<string> {
  const existing = useLibraryStore.getState().pieces.find(p => p.id === 'DONNALEE.XML')
  if (existing) return existing.id
  const xml = await (await fetch('/DONNALEE.XML')).text()
  return importPiece('DONNALEE.XML', xml, { title: 'Donna Lee', composer: 'Charlie Parker', genre: 'Bebop', year: 1947 })
}

/** Pieces present in the sync folder but not in the library → import them. */
export async function importFromFolder(): Promise<number> {
  const pieces = await scanFolder()
  const known = new Set(useLibraryStore.getState().pieces.map(p => p.fileName.replace(/\.(musicxml|xml|mxl)$/i, '').toLowerCase()))
  let added = 0
  for (const fp of pieces) {
    const base = fp.fileName.replace(/\.(musicxml|xml|mxl)$/i, '').toLowerCase()
    if (known.has(base)) continue
    await importPiece(fp.fileName, fp.xml, {}, fp.analysisText)
    added++
  }
  return added
}

// ── Open / close ─────────────────────────────────────────────────────────────

export async function openPiece(id: string) {
  const ws = useWorkspaceStore.getState()
  if (ws.pieceId === id && ws.status === 'ready') {
    useLibraryStore.getState().setView('analysis')
    useLibraryStore.getState().updatePiece(id, { lastOpened: Date.now() })
    await refreshFromFolder(id)
    return
  }
  await flushSave()
  ws.setStatus('loading')
  useLibraryStore.getState().setActive(id)
  useLibraryStore.getState().setView('analysis')

  const stored = await loadFile(id)
  if (!stored) {
    ws.setStatus('error', 'missing')
    return
  }
  let annotations = migrateAnnotations(stored.annotations)
  let notes = stored.researchNotes ?? []

  // A newer analysis in the sync folder (e.g. edited by Claude Code) wins
  const piece = useLibraryStore.getState().pieces.find(p => p.id === id)
  const external = await readPieceAnalysis(piece?.fileName ?? id)
  if (external && external.savedAt > stored.savedAt + 1000) {
    annotations = external.annotations
    notes = external.researchNotes
    await saveFile(id, stored.xml, annotations, notes, external.savedAt)
  }

  const noteMap = parseMusicXml(stored.xml)
  useSelectionStore.getState().clear()
  usePlaybackStore.getState().stop()
  const bpm = parseFloat(noteMap.metadata.tempo)
  usePlaybackStore.getState().setTempo(bpm >= 30 && bpm <= 400 ? bpm : 120)
  applyLoaded(() => {
    useAnnotationStore.getState().loadAnnotations(annotations)
    useResearchStore.getState().loadNotes(notes)
  })
  useWorkspaceStore.getState().setPiece({ pieceId: id, xml: stored.xml, noteMap, xmlHarmonies: parseHarmonies(stored.xml) })
  useWorkspaceStore.getState().setSaveState('saved', stored.savedAt)
  useLibraryStore.getState().updatePiece(id, {
    lastOpened: Date.now(),
    totalMeasures: noteMap.metadata.totalMeasures,
    key: noteMap.metadata.key,
    timeSignature: noteMap.metadata.timeSignature,
  })
  if (external && external.savedAt > stored.savedAt + 1000) announceExternal()
}

function announceExternal() {
  useUiStore.getState().toast(tr('נטען ניתוח מעודכן מתיקיית הסנכרון', 'Loaded a newer analysis from the sync folder'), 'success')
}

/** Pick up changes made to the open piece's analysis.json outside MAP (e.g. by Claude Code). */
export async function refreshFromFolder(id: string) {
  const piece = useLibraryStore.getState().pieces.find(p => p.id === id)
  const external = await readPieceAnalysis(piece?.fileName ?? id)
  const lastSaved = useWorkspaceStore.getState().lastSaved ?? 0
  if (!external || external.savedAt <= lastSaved + 1000 || useWorkspaceStore.getState().pieceId !== id) return
  await flushSave()
  applyLoaded(() => {
    useAnnotationStore.getState().loadAnnotations(external.annotations)
    useResearchStore.getState().loadNotes(external.researchNotes)
  })
  const { xml } = useWorkspaceStore.getState()
  if (xml) await saveFile(id, xml, external.annotations, external.researchNotes, external.savedAt)
  useWorkspaceStore.getState().setSaveState('saved', external.savedAt)
  announceExternal()
}

export async function closePiece() {
  await flushSave()
  usePlaybackStore.getState().stop()
  useSelectionStore.getState().clear()
  useLibraryStore.getState().setView('library')
}

export async function deletePiece(id: string) {
  if (useWorkspaceStore.getState().pieceId === id) useWorkspaceStore.getState().close()
  await deleteFile(id)
  await deleteThumbnail(id)
  useLibraryStore.getState().removePiece(id)
}

// ── Saving ───────────────────────────────────────────────────────────────────

let pending: Promise<void> | null = null

/** Persist the open piece now (IndexedDB + sync folder). */
export async function savePiece() {
  const { pieceId, xml, noteMap, setSaveState } = useWorkspaceStore.getState()
  if (!pieceId || !xml) return
  const annotations = useAnnotationStore.getState().annotations
  const notes = useResearchStore.getState().notes
  const now = Date.now()
  setSaveState('saving')
  const run = (async () => {
    try {
      await saveFile(pieceId, xml, annotations, notes, now)
      useLibraryStore.getState().updatePiece(pieceId, { lastModified: now, tagCount: Object.keys(annotations).length })
      const piece = useLibraryStore.getState().pieces.find(p => p.id === pieceId)
      if (piece) {
        const file = buildAnalysisFile(piece, annotations, notes, noteMap, xml, now)
        await writePieceToFolder(piece.fileName, xml, JSON.stringify(file, null, 2))
      }
      // Only mark saved if nothing changed while we were writing
      if (useAnnotationStore.getState().annotations === annotations && useResearchStore.getState().notes === notes) {
        setSaveState('saved', now)
      }
    } catch (e) {
      console.error('save failed', e)
      setSaveState('error')
    }
  })()
  pending = run
  await run
  if (pending === run) pending = null
}

let timer: ReturnType<typeof setTimeout> | null = null

export function scheduleSave(delay = 900) {
  useWorkspaceStore.getState().setSaveState('dirty')
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; savePiece() }, delay)
}

export async function flushSave() {
  if (timer) { clearTimeout(timer); timer = null; await savePiece() }
  else if (pending) await pending
}
