import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { ReferenceData } from '../../../../renderer-tests/pipeline/types'

const REFERENCE_DIR = resolve(process.cwd(), 'renderer-tests/reference-data')

/**
 * Load a reference JSON file from renderer-tests/reference-data/.
 * @param fixtureName - e.g. '01-noteheads', '05-stems'
 */
export function loadReference(fixtureName: string): ReferenceData {
  const filePath = resolve(REFERENCE_DIR, `${fixtureName}.ref.json`)
  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

export type { ReferenceData }
