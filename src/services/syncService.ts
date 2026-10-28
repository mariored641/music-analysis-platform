/**
 * Folder sync (File System Access API).
 *
 * Layout inside the chosen folder — one sub-folder per piece:
 *   <base>/<base>.musicxml        the score
 *   <base>/<base>.analysis.json   everything MAP knows about it (see analysisExport.ts)
 *
 * MAP writes both after every save. When a piece is opened, a newer
 * analysis.json in the folder (e.g. edited by Claude Code) wins.
 * "Import from folder" adds pieces that exist only in the folder.
 *
 * The directory handle is persisted in IndexedDB; after a reload the browser
 * may ask for permission again (status 'needs-permission').
 */
import { create } from 'zustand'
import { kvDelete, kvGet, kvSet } from './storageService'
import { baseName, parseAnalysisFile } from './analysisExport'

export type SyncStatus = 'unsupported' | 'off' | 'needs-permission' | 'ready'

interface SyncState { status: SyncStatus; folder: string | null; lastSync: number | null }
export const useSyncStore = create<SyncState>()(() => ({ status: 'off', folder: null, lastSync: null }))

const HANDLE_KEY = 'sync-dir'
let dir: FileSystemDirectoryHandle | null = null

const supported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window

export async function initSync() {
  if (!supported()) { useSyncStore.setState({ status: 'unsupported' }); return }
  const handle = await kvGet<FileSystemDirectoryHandle>(HANDLE_KEY).catch(() => undefined)
  if (!handle) return
  dir = handle
  const perm = await (handle as any).queryPermission?.({ mode: 'readwrite' })
  useSyncStore.setState({ status: perm === 'granted' ? 'ready' : 'needs-permission', folder: handle.name })
}

export async function connectFolder(): Promise<boolean> {
  if (!supported()) return false
  try {
    const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'map-sync' })
    dir = handle
    await kvSet(HANDLE_KEY, handle)
    useSyncStore.setState({ status: 'ready', folder: handle.name })
    return true
  } catch {
    return false
  }
}

export async function reauthorize(): Promise<boolean> {
  if (!dir) return connectFolder()
  const perm = await (dir as any).requestPermission?.({ mode: 'readwrite' })
  const ok = perm === 'granted'
  useSyncStore.setState({ status: ok ? 'ready' : 'needs-permission' })
  return ok
}

export async function disconnectFolder() {
  dir = null
  await kvDelete(HANDLE_KEY)
  useSyncStore.setState({ status: supported() ? 'off' : 'unsupported', folder: null })
}

const ready = () => dir && useSyncStore.getState().status === 'ready'

function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'piece'
}

async function writeText(d: FileSystemDirectoryHandle, name: string, text: string) {
  const fh = await d.getFileHandle(name, { create: true })
  const w = await (fh as any).createWritable()
  await w.write(text)
  await w.close()
}

async function readText(d: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    const fh = await d.getFileHandle(name)
    return await (await fh.getFile()).text()
  } catch {
    return null
  }
}

/** Write score + analysis for a piece. Never throws. */
export async function writePieceToFolder(fileName: string, xml: string, analysisJson: string) {
  if (!ready()) return
  try {
    const base = safeName(baseName(fileName))
    const sub = await dir!.getDirectoryHandle(base, { create: true })
    const xmlName = `${base}.musicxml`
    if ((await readText(sub, xmlName)) === null) await writeText(sub, xmlName, xml)
    await writeText(sub, `${base}.analysis.json`, analysisJson)
    useSyncStore.setState({ lastSync: Date.now() })
  } catch (e) {
    console.error('[sync] write failed', e)
  }
}

/** Read the analysis for a piece from the folder, if present. */
export async function readPieceAnalysis(fileName: string) {
  if (!ready()) return null
  try {
    const base = safeName(baseName(fileName))
    const sub = await dir!.getDirectoryHandle(base)
    const text = await readText(sub, `${base}.analysis.json`)
    return text ? parseAnalysisFile(text) : null
  } catch {
    return null
  }
}

export interface FolderPiece { fileName: string; xml: string; analysisText: string | null }

/** List pieces in the folder (sub-folders with a score file, or loose score files). */
export async function scanFolder(): Promise<FolderPiece[]> {
  if (!ready()) return []
  const out: FolderPiece[] = []
  const isScore = (n: string) => /\.(musicxml|xml)$/i.test(n) && !/\.analysis\./i.test(n)
  for await (const [name, handle] of (dir as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
    if (handle.kind === 'file' && isScore(name)) {
      out.push({ fileName: name, xml: await (await (handle as FileSystemFileHandle).getFile()).text(), analysisText: null })
    } else if (handle.kind === 'directory') {
      const sub = handle as FileSystemDirectoryHandle
      for await (const [n2, h2] of (sub as any).entries() as AsyncIterable<[string, FileSystemHandle]>) {
        if (h2.kind === 'file' && isScore(n2)) {
          const xml = await (await (h2 as FileSystemFileHandle).getFile()).text()
          const analysisText = await readText(sub, `${baseName(n2)}.analysis.json`)
          out.push({ fileName: n2, xml, analysisText })
          break
        }
      }
    }
  }
  return out
}
