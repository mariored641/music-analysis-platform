/**
 * syncService.ts — File System Access API
 *
 * Manages a user-selected sync folder. Writes `[pieceId].analysis.json` after
 * every auto-save so Claude Code (and other external tools) can read/edit the
 * analysis data. Reads back those files when a piece is opened, so edits made
 * outside MAP appear automatically.
 *
 * The directory handle lives in memory (lost on page reload). The folder name
 * is persisted to localStorage for display only. On reload, the sync button
 * turns orange ("needs re-pick") until the user clicks it again.
 */

import type { Annotation } from '../types/annotation'
import type { ResearchNote } from '../store/researchStore'

export interface SyncData {
  version: '1.0'
  savedAt: string          // ISO-8601
  annotations: Record<string, Annotation>
  researchNotes: ResearchNote[]
}

const STORAGE_KEY = 'map-sync-folder-name'

// In-memory handle — survives HMR but not page reload
let _dirHandle: FileSystemDirectoryHandle | null = null

// ── Folder management ──────────────────────────────────────────────────────

/** Opens the OS directory picker. Returns the folder name, or null if cancelled. */
export async function pickSyncFolder(): Promise<string | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
    _dirHandle = handle
    localStorage.setItem(STORAGE_KEY, handle.name)
    return handle.name as string
  } catch {
    // User cancelled or browser unsupported
    return null
  }
}

/** True when a handle has been acquired this session. */
export function hasSyncFolder(): boolean {
  return _dirHandle !== null
}

/**
 * The folder name stored from the last successful pick (survives reload).
 * Used only for display; does NOT imply a live handle.
 */
export function getSyncFolderName(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

/** Removes the handle and clears the stored folder name. */
export function clearSyncFolder(): void {
  _dirHandle = null
  localStorage.removeItem(STORAGE_KEY)
}

// ── Read / Write ───────────────────────────────────────────────────────────

function toFileName(pieceId: string): string {
  // DONNALEE.XML → DONNALEE.analysis.json
  return pieceId.replace(/\.[^.]+$/, '.analysis.json')
}

/**
 * Writes `[pieceId].analysis.json` to the sync folder.
 * Silently no-ops when no handle is active.
 */
export async function writeSyncFile(pieceId: string, data: SyncData): Promise<void> {
  if (!_dirHandle) return
  try {
    const fileName = toFileName(pieceId)
    const fileHandle = await _dirHandle.getFileHandle(fileName, { create: true })
    const writable = await (fileHandle as any).createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
  } catch (e) {
    console.error('[sync] write failed:', e)
  }
}

/**
 * Reads `[pieceId].analysis.json` from the sync folder.
 * Returns parsed SyncData, or null if the file doesn't exist or can't be read.
 */
export async function readSyncFile(pieceId: string): Promise<SyncData | null> {
  if (!_dirHandle) return null
  try {
    const fileName = toFileName(pieceId)
    const fileHandle = await _dirHandle.getFileHandle(fileName, { create: false })
    const file = await (fileHandle as any).getFile()
    const text = await file.text()
    const parsed = JSON.parse(text) as SyncData
    if (parsed.version !== '1.0') return null
    return parsed
  } catch {
    // File doesn't exist or parse error — normal case
    return null
  }
}
