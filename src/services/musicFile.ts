export async function extractXmlFromMxl(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(arrayBuffer)
  const containerFile = zip.file('META-INF/container.xml')
  const container = containerFile
    ? new DOMParser().parseFromString(await containerFile.async('string'), 'application/xml')
    : null
  const path = container?.getElementsByTagName('rootfile')[0]?.getAttribute('full-path')
    ?? Object.keys(zip.files).find(name => /\.(xml|musicxml)$/i.test(name) && !name.startsWith('META-INF'))
  const scoreFile = path ? zip.file(path) : null
  if (!scoreFile) throw new Error('Invalid MXL: score file not found')
  return scoreFile.async('string')
}

export async function readMusicFile(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.mxl')) {
    return extractXmlFromMxl(await file.arrayBuffer())
  }
  return file.text()
}
