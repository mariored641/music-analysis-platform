/**
 * xmlSanitizer.ts
 *
 * Utilities to prepare MusicXML for clean rendering in Verovio.
 */

// ── Accidental helpers ────────────────────────────────────────────────────────

/** Flat order in key signatures (1 flat = Bb, 2 flats = Bb+Eb, …) */
const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F']
/** Sharp order in key signatures (1 sharp = F#, 2 sharps = F#+C#, …) */
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']

/** Map of step → alter (-1 / 0 / +1) implied by a given key signature fifths value. */
function keyAccidentals(fifths: number): Record<string, number> {
  const acc: Record<string, number> = {}
  if (fifths < 0) {
    for (let i = 0; i < Math.abs(fifths) && i < 7; i++) acc[FLAT_ORDER[i]]  = -1
  } else if (fifths > 0) {
    for (let i = 0; i < fifths && i < 7; i++)             acc[SHARP_ORDER[i]] =  1
  }
  return acc
}

/** MusicXML accidental text for a given alter value. */
function alterToAccText(alter: number): string {
  if (alter ===  1) return 'sharp'
  if (alter === -1) return 'flat'
  if (alter ===  2) return 'double-sharp'
  if (alter === -2) return 'flat-flat'
  return 'natural'
}

/**
 * addAccidentals — injects <accidental> elements where needed.
 *
 * Verovio converts MusicXML <alter> to MEI @accid.ges (gestural = sounding pitch)
 * but only renders a visible accidental sign when @accid (written) is present.
 * Written accidentals come from the MusicXML <accidental> element, which many
 * exporters omit.  This pass adds them by computing, per measure and staff, which
 * notes deviate from the current key signature or a prior alteration in the bar.
 *
 * Rules implemented:
 *  - Accidentals reset to the key signature at every bar line.
 *  - Within a measure, an accidental on step X overrides the key-sig default for
 *    all subsequent notes on the same step (any octave) until the bar ends.
 *  - Notes already carrying <accidental> are left untouched.
 *  - Rests are ignored.
 */
function addAccidentals(doc: Document, keyFifths: number): void {
  const keyAcc = keyAccidentals(keyFifths)

  doc.querySelectorAll('measure').forEach(measure => {
    // Track active accidental per step, separately for each staff
    const activeAcc: Record<number, Record<string, number>> = {}

    const getStaffAcc = (staff: number) => {
      if (!activeAcc[staff]) activeAcc[staff] = { ...keyAcc }
      return activeAcc[staff]
    }

    for (const node of Array.from(measure.childNodes)) {
      if (node.nodeType !== 1) continue
      const el = node as Element
      if (el.tagName !== 'note') continue
      if (el.querySelector('rest')) continue          // skip rests
      if (el.querySelector('accidental')) continue    // already has one

      const stepEl  = el.querySelector('pitch > step')
      const alterEl = el.querySelector('pitch > alter')
      if (!stepEl) continue

      const step  = stepEl.textContent?.trim() ?? ''
      const alter = alterEl ? parseFloat(alterEl.textContent?.trim() ?? '0') : 0
      const staffNum = parseInt(el.querySelector('staff')?.textContent?.trim() ?? '1', 10)

      const acc      = getStaffAcc(staffNum)
      const expected = acc[step] ?? 0

      if (alter !== expected) {
        // Insert <accidental> before <time-modification>, <stem>, or <staff>,
        // whichever comes first — the correct MusicXML position.
        const accEl   = doc.createElement('accidental')
        accEl.textContent = alterToAccText(alter)
        const anchor  = el.querySelector('time-modification, stem, staff')
        if (anchor) el.insertBefore(accEl, anchor)
        else        el.appendChild(accEl)

        acc[step] = alter   // propagate within the bar
      }
    }
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * prepareMusicXML — reorders and voices MusicXML notes for correct Verovio rendering,
 * then injects <accidental> elements so accidental signs appear in the SVG output.
 *
 * Root cause (staff ordering): Verovio only honors <staff>N</staff> for physical
 * staff placement when the note comes AFTER a <backup> element.  Many MusicXML
 * exporters write staff-2 rests FIRST in each measure, causing Verovio to place
 * bass rests on the treble staff.
 *
 * Root cause (accidentals): Verovio converts <alter> → @accid.ges (gestural) but
 * only renders a visible sign when @accid (written) is present, which requires the
 * <accidental> child element in MusicXML.  Files that omit <accidental> show no
 * accidental signs even when the pitch deviates from the key signature.
 *
 * Fix:
 *  1. Within every <measure>, collect notes by staff number.
 *  2. Rebuild the measure: staff-1 notes first, then one <backup>, then staff-2 notes.
 *  3. Inject <voice>1</voice> into every note.
 *  4. Inject <accidental> elements where needed based on key sig + intra-bar context.
 */
export function prepareMusicXML(xmlString: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')
  if (doc.querySelector('parsererror')) return xmlString

  // ── Pass 1: reorder staves ─────────────────────────────────────────────────
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

  // ── Pass 2: inject <accidental> elements ──────────────────────────────────
  const fifthsEl = doc.querySelector('key > fifths')
  const fifths   = fifthsEl ? parseInt(fifthsEl.textContent?.trim() ?? '0', 10) : 0
  addAccidentals(doc, fifths)

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
