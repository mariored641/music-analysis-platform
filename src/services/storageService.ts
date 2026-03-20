import { openDB, type IDBPDatabase } from 'idb'
import type { Annotation } from '../types/annotation'

interface MapDB {
  files: {
    key: string
    value: { id: string; xml: string; annotations: Record<string, Annotation>; savedAt: number }
  }
}

let db: IDBPDatabase<MapDB> | null = null

async function getDb() {
  if (!db) {
    db = await openDB<MapDB>('map-storage', 1, {
      upgrade(db) {
        db.createObjectStore('files', { keyPath: 'id' })
      },
    })
  }
  return db
}

export async function saveFile(id: string, xml: string, annotations: Record<string, Annotation>) {
  const database = await getDb()
  await database.put('files', { id, xml, annotations, savedAt: Date.now() })
}

export async function loadFile(id: string) {
  const database = await getDb()
  return database.get('files', id)
}

export async function listFiles() {
  const database = await getDb()
  return database.getAll('files')
}

export async function deleteFile(id: string) {
  const database = await getDb()
  await database.delete('files', id)
}
