/**
 * xmlSanitizer.ts
 *
 * Utilities to prepare MusicXML for clean rendering in Verovio.
 */

/**
 * prepareMusicXML — reorders and voices MusicXML notes for correct Verovio rendering.
 *
 * Root cause: Verovio only honors <staff>N</staff> for physical staff placement when
 * the note comes AFTER a <backup> element. Notes at the very start of a measure
 * (before any backup) always land on staff 1 regardless of their <staff> tag.
 *
 * Many MusicXML exporters (e.g. the one that produced DONNALEE.XML) write staff-2
 * rests FIRST in each measure, then a <backup>, then the staff-1 melody. This
 * causes Verovio to place bass rests on the treble staff.
 *
 * Fix:
 *  1. Within every <measure>, collect notes by staff number.
 *  2. Rebuild the measure: staff-1 notes first, then one <backup>, then staff-2 notes.
 *  3. Inject <voice>1</voice> into every note so all voices map to Layer 1
 *     of their respective staff (clean single-voice-per-staff layout).
 *
 * Non-note elements (harmony, attributes, direction, sound…) are kept in their
 * original relative order at the start of the measure.
 */
export function prepareMusicXML(xmlString: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')
  if (doc.querySelector('parsererror')) return xmlString

  doc.querySelectorAll('measure').forEach(measure => {
    const preamble: ChildNode[] = []  // harmony, attributes, direction, sound…
    const staff1Notes: Element[] = []
    const staff2Notes: Element[] = []
    let staff1Duration = 0

    for (const node of Array.from(measure.childNodes)) {
      if (node.nodeType !== 1 /* ELEMENT_NODE */) continue
      const el = node as Element

      if (el.tagName === 'note') {
        const staffEl = el.querySelector('staff')
        const staffNum = staffEl ? parseInt(staffEl.textContent?.trim() ?? '1', 10) : 1
        const isChord = !!el.querySelector('chord')
        const dur = parseInt(el.querySelector('duration')?.textContent?.trim() ?? '0', 10)

        if (staffNum === 2) {
          staff2Notes.push(el)
        } else {
          staff1Notes.push(el)
          if (!isChord) staff1Duration += dur
        }
      } else if (el.tagName === 'backup' || el.tagName === 'forward') {
        // drop — we regenerate the single backup between staves
      } else {
        preamble.push(node)
      }
    }

    // Rebuild measure
    while (measure.firstChild) measure.removeChild(measure.firstChild)

    // 1. Non-note elements (harmony, attributes, …)
    preamble.forEach(n => measure.appendChild(n))

    // 2. Staff-1 notes — all forced to voice 1
    staff1Notes.forEach(note => {
      setVoice(note, '1', doc)
      measure.appendChild(note)
    })

    // 3. One backup + staff-2 notes (voice 1, staff element retained)
    //    Verovio honors <staff>2</staff> only after a <backup> — that's why we
    //    reorder AND keep the backup.
    if (staff2Notes.length > 0) {
      if (staff1Duration > 0) {
        const backup = doc.createElement('backup')
        const dur = doc.createElement('duration')
        dur.textContent = String(staff1Duration)
        backup.appendChild(dur)
        measure.appendChild(backup)
      }
      staff2Notes.forEach(note => {
        setVoice(note, '1', doc)  // voice 1 → Layer 1 of staff 2
        measure.appendChild(note)
      })
    }
  })

  return new XMLSerializer().serializeToString(doc)
}

/** Set (or replace) the <voice> child of a <note> element. */
function setVoice(noteEl: Element, voice: string, doc: Document): void {
  let voiceEl = noteEl.querySelector('voice')
  if (!voiceEl) {
    voiceEl = doc.createElement('voice')
    const staffEl = noteEl.querySelector('staff')
    if (staffEl) noteEl.insertBefore(voiceEl, staffEl)
    else noteEl.appendChild(voiceEl)
  }
  voiceEl.textContent = voice
}

/**
 * sanitizeMusicXML — keeps only the requested staves (legacy, kept for reference).
 * Pass keepStaves=[1,2] to skip filtering.
 */
export function sanitizeMusicXML(xmlString: string, keepStaves: number[] = [1]): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  const stavesEls = Array.from(doc.querySelectorAll('staves'))
  const totalDeclared = stavesEls.length > 0
    ? Math.max(...stavesEls.map(el => parseInt(el.textContent ?? '1', 10)))
    : 1

  if (keepStaves.length >= totalDeclared) return xmlString

  const keepSet = new Set(keepStaves.map(String))

  stavesEls.forEach(el => { el.textContent = String(keepStaves.length) })
  doc.querySelectorAll('clef[number]').forEach(el => {
    if (!keepSet.has(el.getAttribute('number') ?? '')) el.remove()
  })
  doc.querySelectorAll('staff-layout[number], staff-details[number]').forEach(el => {
    if (!keepSet.has(el.getAttribute('number') ?? '')) el.remove()
  })
  doc.querySelectorAll('note').forEach(noteEl => {
    const staffEl = noteEl.querySelector('staff')
    if (staffEl && !keepSet.has(staffEl.textContent?.trim() ?? '')) noteEl.remove()
  })
  doc.querySelectorAll('backup, forward').forEach(el => el.remove())

  return new XMLSerializer().serializeToString(doc)
}
