import catalog from './etudes.json'
import type { LibraryPiece } from '../store/libraryStore'

interface CatalogEntry extends Omit<LibraryPiece, 'id' | 'lastOpened' | 'dateAdded' | 'lastModified'> {
  collection: string
  source: NonNullable<LibraryPiece['source']>
}

const entries: CatalogEntry[] = catalog

export const builtInPieces = entries.map((entry): LibraryPiece => ({
  ...entry,
  id: entry.fileName,
  dateAdded: 0,
  lastOpened: 0,
  lastModified: 0,
}))

const piecesById = new Map(builtInPieces.map(piece => [piece.id, piece]))

export function getBuiltInPiece(id: string) {
  return piecesById.get(id)
}
