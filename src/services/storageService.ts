import { openDB, type IDBPDatabase } from 'idb'
import type { Annotation } from '../types/annotation'
import type { ResearchNote } from '../store/researchStore'

export interface StoredPiece {
  id: string
  xml: string
  annotations: Record<string, Annotation>
  researchNotes?: ResearchNote[]
  savedAt: number
}

interface MapDB {
  files: { key: string; value: StoredPiece }
  kv: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<MapDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MapDB>('map-storage', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      },
    })
  }
  return dbPromise
}

export async function saveFile(
  id: string,
  xml: string,
  annotations: Record<string, Annotation>,
  researchNotes: ResearchNote[] = [],
  savedAt = Date.now(),
) {
  const db = await getDb()
  await db.put('files', { id, xml, annotations, researchNotes, savedAt })
}

export async function loadFile(id: string): Promise<StoredPiece | undefined> {
  return (await getDb()).get('files', id)
}

export async function deleteFile(id: string) {
  await (await getDb()).delete('files', id)
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await getDb()).get('kv', key) as Promise<T | undefined>
}

export async function kvSet(key: string, value: unknown) {
  await (await getDb()).put('kv', value, key)
}

export async function kvDelete(key: string) {
  await (await getDb()).delete('kv', key)
}
