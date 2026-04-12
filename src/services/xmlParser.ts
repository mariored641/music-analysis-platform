import type { NoteMap, MeasureData, NoteData, ScoreMetadata } from '../types/score'

export function parseMusicXml(xmlString: string): NoteMap {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const measures = new Map<number, MeasureData>()
  const notes = new Map<string, NoteData>()

  // Extract metadata
  const titleEl = doc.querySelector('work-title, movement-title, credit-words')
  const composerEl = doc.querySelector('creator[type="composer"]')
  const keyEl = doc.querySelector('key')
  const timeEl = doc.querySelector('time')
  const tempoEl = doc.querySelector('metronome beat-unit, direction-type words')
  const measureEls = doc.querySelectorAll('measure')

  const fifths = keyEl ? parseInt(keyEl.querySelector('fifths')?.textContent || '0') : 0
  const mode = keyEl?.querySelector('mode')?.textContent || 'major'
  const keyName = fifthsToKey(fifths, mode)

  const beats = timeEl ? parseInt(timeEl.querySelector('beats')?.textContent || '4') : 4
  const beatType = timeEl ? parseInt(timeEl.querySelector('beat-type')?.textContent || '4') : 4
  const timeSignature = `${beats}/${beatType}`

  const metadata: ScoreMetadata = {
    title: titleEl?.textContent?.trim() || 'Untitled',
    composer: composerEl?.textContent?.trim() || '',
    key: keyName,
    timeSignature,
    tempo: tempoEl?.textContent?.trim() || '',
    totalMeasures: measureEls.length,
  }

  let currentDivisions = 1
  let currentKey = { fifths, mode }
  let currentTime = { beats, beatType }

  measureEls.forEach((measureEl) => {
    const num = parseInt(measureEl.getAttribute('number') || '1')
    const measureData: MeasureData = { num, notes: [] }

    // Check for attributes
    const attribEl = measureEl.querySelector('attributes')
    if (attribEl) {
      const divEl = attribEl.querySelector('divisions')
      if (divEl) currentDivisions = parseInt(divEl.textContent || '1')

      const keyEl2 = attribEl.querySelector('key')
      if (keyEl2) {
        const f = parseInt(keyEl2.querySelector('fifths')?.textContent || '0')
        const m = keyEl2.querySelector('mode')?.textContent || 'major'
        currentKey = { fifths: f, mode: m }
        measureData.keySignature = { fifths: f, mode: m }
      }

      const timeEl2 = attribEl.querySelector('time')
      if (timeEl2) {
        const b = parseInt(timeEl2.querySelector('beats')?.textContent || '4')
        const bt = parseInt(timeEl2.querySelector('beat-type')?.textContent || '4')
        currentTime = { beats: b, beatType: bt }
        measureData.timeSignature = { beats: b, beatType: bt }
      }
    }

    // Check for tempo
    const soundEl = measureEl.querySelector('sound[tempo]')
    if (soundEl) measureData.tempo = parseFloat(soundEl.getAttribute('tempo') || '120')

    // Parse notes — iterate children in order so <backup>/<forward> are processed correctly.
    // This fixes multi-staff scores where <backup> rewinds time between staves.
    let currentBeat = 1
    let chordStartBeat = 1  // beat of the first note in the current chord group
    Array.from(measureEl.children).forEach((child) => {
      const tag = child.tagName

      // <backup>: rewind time position (transition between staves)
      if (tag === 'backup') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0')
        currentBeat -= dur / currentDivisions
        return
      }

      // <forward>: advance time position
      if (tag === 'forward') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0')
        currentBeat += dur / currentDivisions
        return
      }

      if (tag !== 'note') return
      const noteEl = child as Element

      const staffNum = parseInt(noteEl.querySelector('staff')?.textContent || '1')

      if (noteEl.querySelector('rest')) {
        const durEl = noteEl.querySelector('duration')
        const chord = !!noteEl.querySelector('chord')
        if (durEl && !chord) currentBeat += parseInt(durEl.textContent || '0') / currentDivisions
        return
      }

      const pitchEl = noteEl.querySelector('pitch')
      if (!pitchEl) return

      const step = pitchEl.querySelector('step')?.textContent || 'C'
      const octave = parseInt(pitchEl.querySelector('octave')?.textContent || '4')
      const alter = parseFloat(pitchEl.querySelector('alter')?.textContent || '0')
      const durEl = noteEl.querySelector('duration')
      const dur = durEl ? parseInt(durEl.textContent || '1') / currentDivisions : 1
      const typeEl = noteEl.querySelector('type')
      const voiceEl = noteEl.querySelector('voice')
      const fingerEl = noteEl.querySelector('fingering')
      const chord = !!noteEl.querySelector('chord')
      // For chord notes (2nd, 3rd…), reuse the beat of the first note in the group.
      // Without this, currentBeat has already been advanced by the previous note,
      // causing wrong beat values and ID collisions with later notes.
      if (!chord) chordStartBeat = currentBeat

      const alterStr = alter === 1 ? '#' : alter === -1 ? 'b' : alter === 2 ? '##' : ''
      const pitch = `${step}${alterStr}${octave}`

      // Staff-1 IDs keep original format (backward compatible with saved annotations).
      // Bass staff (2+) gets a -s{N} suffix to prevent collisions.
      const id = staffNum === 1
        ? `note-m${num}b${Math.round(chordStartBeat * 100)}-${step}${octave}`
        : `note-m${num}b${Math.round(chordStartBeat * 100)}-${step}${octave}-s${staffNum}`

      const noteData: NoteData = {
        id,
        pitch,
        step,
        octave,
        alter: alter || undefined,
        duration: dur,
        type: typeEl?.textContent || 'quarter',
        measureNum: num,
        beat: chordStartBeat,
        voice: parseInt(voiceEl?.textContent || '1'),
        staff: staffNum,
        fingering: fingerEl?.textContent || undefined,
      }

      if (!chord) currentBeat += dur

      measureData.notes.push(noteData)
      notes.set(id, noteData)
    })

    measures.set(num, measureData)
  })

  return { measures, notes, metadata }
}

function fifthsToKey(fifths: number, mode: string): string {
  const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
  const minorKeys = ['a', 'e', 'b', 'f#', 'c#', 'g#', 'd#', 'a#', 'd', 'g', 'c', 'f', 'bb', 'eb', 'ab']
  const idx = ((fifths % 15) + 15) % 15
  const key = mode === 'minor' ? minorKeys[idx] : majorKeys[idx]
  return `${key} ${mode}`
}

export interface HarmonyItem {
  measureNum: number
  beatFraction: number  // 0.0–1.0 within measure
  label: string         // full chord label: "Ab6", "Bbm7", "EbMaj7" etc.
}

export function parseHarmonies(xmlString: string): HarmonyItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const items: HarmonyItem[] = []
  let divisions = 1
  let beatsPerMeasure = 4

  doc.querySelectorAll('measure').forEach(mEl => {
    const measureNum = parseInt(mEl.getAttribute('number') || '0')

    const divEl = mEl.querySelector('attributes > divisions')
    if (divEl) divisions = parseInt(divEl.textContent || '1')
    const beatsEl = mEl.querySelector('attributes > time > beats')
    if (beatsEl) beatsPerMeasure = parseInt(beatsEl.textContent || '4')

    const totalDivisions = divisions * beatsPerMeasure
    let offset = 0

    Array.from(mEl.children).forEach(el => {
      const tag = el.tagName
      if (tag === 'harmony') {
        const rootStep = el.querySelector('root > root-step')?.textContent?.trim() || ''
        const rootAlter = parseFloat(el.querySelector('root > root-alter')?.textContent || '0')
        const kindText = el.querySelector('kind')?.getAttribute('text') || ''
        const acc = rootAlter === -1 ? '♭' : rootAlter === 1 ? '♯' : rootAlter === -2 ? '𝄫' : ''
        const label = rootStep + acc + kindText
        const offsetEl = el.querySelector('offset')
        const harmonyOffset = offsetEl ? parseInt(offsetEl.textContent || '0') : 0
        items.push({
          measureNum,
          beatFraction: totalDivisions > 0 ? (offset + harmonyOffset) / totalDivisions : 0,
          label,
        })
      } else if (tag === 'note') {
        if (!el.querySelector('chord')) {
          offset += parseInt(el.querySelector('duration')?.textContent || '0')
        }
      } else if (tag === 'backup') {
        offset -= parseInt(el.querySelector('duration')?.textContent || '0')
      } else if (tag === 'forward') {
        offset += parseInt(el.querySelector('duration')?.textContent || '0')
      }
    })
  })

  return items
}

// ── All-staves note extraction (for chordify / harmonic analysis) ──────────────

export interface AllStavesNote {
  measureNum: number
  beat: number
  duration: number
  step: string
  alter: number
  staff: number
}

/**
 * Parse ALL notes from ALL staves (including staff 2 for piano left-hand).
 * Used by romanNumeralScript for chordify-based chord detection.
 */
export function parseAllStavesNotes(xmlString: string): AllStavesNote[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const result: AllStavesNote[] = []
  let currentDivisions = 1

  doc.querySelectorAll('measure').forEach(measureEl => {
    const num = parseInt(measureEl.getAttribute('number') || '1')

    const divEl = measureEl.querySelector('attributes > divisions')
    if (divEl) currentDivisions = parseInt(divEl.textContent || '1')

    let currentBeat = 1

    Array.from(measureEl.children).forEach(child => {
      const tag = child.tagName

      if (tag === 'backup') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0')
        currentBeat -= dur / currentDivisions
        return
      }
      if (tag === 'forward') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0')
        currentBeat += dur / currentDivisions
        return
      }
      if (tag !== 'note') return

      const isChord = !!child.querySelector('chord')
      const isRest = !!child.querySelector('rest')
      const staff = parseInt(child.querySelector('staff')?.textContent || '1')
      const durEl = child.querySelector('duration')
      const dur = durEl ? parseInt(durEl.textContent || '1') / currentDivisions : 1

      if (!isRest) {
        const pitchEl = child.querySelector('pitch')
        if (pitchEl) {
          const step = pitchEl.querySelector('step')?.textContent || 'C'
          const rawAlter = parseFloat(pitchEl.querySelector('alter')?.textContent || '0')
          result.push({
            measureNum: num,
            beat: currentBeat,
            duration: dur,
            step,
            alter: isNaN(rawAlter) ? 0 : rawAlter,
            staff,
          })
        }
      }

      if (!isChord) currentBeat += dur
    })
  })

  return result
}

export function extractSourceMarkings(xmlString: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const dynamics: Array<{measure: number; value: string}> = []
  const articulations: Array<{measure: number; noteId: string; value: string}> = []
  const ornaments: Array<{measure: number; noteId: string; value: string}> = []
  const tempoMarkings: Array<{measure: number; value: string}> = []
  const fingerings: Array<{measure: number; value: string}> = []

  doc.querySelectorAll('measure').forEach((mEl) => {
    const num = parseInt(mEl.getAttribute('number') || '1')

    mEl.querySelectorAll('dynamics').forEach((d) => {
      const type = d.firstElementChild?.tagName || ''
      if (type) dynamics.push({ measure: num, value: type })
    })

    mEl.querySelectorAll('articulations > *').forEach((a) => {
      articulations.push({ measure: num, noteId: '', value: a.tagName })
    })

    mEl.querySelectorAll('ornaments > *').forEach((o) => {
      ornaments.push({ measure: num, noteId: '', value: o.tagName })
    })

    mEl.querySelectorAll('words').forEach((w) => {
      const text = w.textContent?.trim()
      if (text) tempoMarkings.push({ measure: num, value: text })
    })

    mEl.querySelectorAll('fingering').forEach((f) => {
      const text = f.textContent?.trim()
      if (text) fingerings.push({ measure: num, value: text })
    })
  })

  return { dynamics, articulations, ornaments, tempoMarkings, fingerings }
}
