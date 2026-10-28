import type { NoteMap, MeasureData, NoteData, ScoreMetadata } from '../types/score'

/**
 * MusicXML → NoteMap.
 *
 * Note ID format (stable — stored in annotations):
 *   note-m{measureIndex}b{round(beat*100)}-{Step}{Octave}[-s{staff}][-p{part}]
 * measureIndex is the 1-based position of the measure in document order (not the
 * printed number), so it lines up 1:1 with the rendered measures.
 * Collisions (unison in two voices) get a -v{voice} suffix.
 */

function childText(el: Element, tag: string): string | null {
  for (const c of Array.from(el.children)) if (c.tagName === tag) return c.textContent
  return null
}

function partsOf(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('score-partwise > part'))
}

function measuresOf(part: Element): Element[] {
  return Array.from(part.children).filter(c => c.tagName === 'measure')
}

export function parseXmlDoc(xmlString: string): Document {
  return new DOMParser().parseFromString(xmlString, 'application/xml')
}

export function parseMusicXml(xmlString: string): NoteMap {
  const doc = parseXmlDoc(xmlString)
  const parts = partsOf(doc)

  const measures = new Map<number, MeasureData>()
  const notes = new Map<string, NoteData>()

  const titleEl = doc.querySelector('work > work-title, movement-title, credit-words')
  const composerEl = doc.querySelector('creator[type="composer"]')
  const firstKey = doc.querySelector('key')
  const firstTime = doc.querySelector('time')
  const tempoEl = doc.querySelector('sound[tempo]')

  const fifths0 = parseInt(firstKey?.querySelector('fifths')?.textContent || '0')
  const mode0 = firstKey?.querySelector('mode')?.textContent || 'major'
  const beats0 = parseInt(firstTime?.querySelector('beats')?.textContent || '4')
  const beatType0 = parseInt(firstTime?.querySelector('beat-type')?.textContent || '4')

  let staffOffset = 0
  const maxReached = new Map<number, number>()

  parts.forEach((part, p) => {
    let divisions = 1
    let staves = 1
    let key = { fifths: fifths0, mode: mode0 }
    let time = { beats: beats0, beatType: beatType0 }

    measuresOf(part).forEach((mEl, i) => {
      const num = i + 1
      const attrs = Array.from(mEl.children).filter(c => c.tagName === 'attributes')
      for (const a of attrs) {
        const d = a.querySelector('divisions'); if (d) divisions = parseInt(d.textContent || '1') || 1
        const s = a.querySelector('staves'); if (s) staves = parseInt(s.textContent || '1') || 1
        const k = a.querySelector('key')
        if (k) key = { fifths: parseInt(k.querySelector('fifths')?.textContent || '0'), mode: k.querySelector('mode')?.textContent || 'major' }
        const t = a.querySelector('time')
        if (t) time = { beats: parseInt(t.querySelector('beats')?.textContent || '4'), beatType: parseInt(t.querySelector('beat-type')?.textContent || '4') }
      }

      let measure = measures.get(num)
      if (!measure) {
        measure = {
          num,
          label: mEl.getAttribute('number') || String(num),
          notes: [],
          timeSignature: { ...time },
          keySignature: { ...key },
          startQ: 0,
          lengthQ: (time.beats * 4) / time.beatType,
        }
        const sound = mEl.querySelector('sound[tempo]')
        if (sound) measure.tempo = parseFloat(sound.getAttribute('tempo') || '120')
        if (mEl.getAttribute('implicit') === 'yes') (measure as any)._implicit = true
        measures.set(num, measure)
      }

      let beat = 1
      let chordStart = 1
      for (const child of Array.from(mEl.children)) {
        const tag = child.tagName
        if (tag === 'backup' || tag === 'forward') {
          const dur = parseInt(childText(child, 'duration') || '0') / divisions
          beat += tag === 'backup' ? -dur : dur
          continue
        }
        if (tag !== 'note') continue

        const isChord = !!child.querySelector('chord')
        const isGrace = !!child.querySelector('grace')
        const dur = isGrace ? 0 : parseInt(childText(child, 'duration') || '0') / divisions
        if (!isChord) chordStart = beat

        if (!child.querySelector('rest')) {
          const pitchEl = child.querySelector('pitch')
          if (pitchEl) {
            const step = pitchEl.querySelector('step')?.textContent || 'C'
            const octave = parseInt(pitchEl.querySelector('octave')?.textContent || '4')
            const alter = parseFloat(pitchEl.querySelector('alter')?.textContent || '0') || 0
            const staff = parseInt(childText(child, 'staff') || '1')
            const voice = parseInt(childText(child, 'voice') || '1')
            const ties = Array.from(child.querySelectorAll(':scope > tie')).map(t => t.getAttribute('type'))
            const tied = ties.includes('start') && ties.includes('stop') ? 'continue'
              : ties.includes('start') ? 'start' : ties.includes('stop') ? 'stop' : undefined
            const acc = alter === 1 ? '#' : alter === -1 ? 'b' : alter === 2 ? '##' : alter === -2 ? 'bb' : ''

            let id = `note-m${num}b${Math.round(chordStart * 100)}-${step}${octave}`
              + (staff > 1 ? `-s${staff}` : '') + (p > 0 ? `-p${p}` : '')
            if (notes.has(id)) id += `-v${voice}`
            let n = 2
            while (notes.has(id)) id = id.replace(/(-x\d+)?$/, `-x${n++}`)

            const note: NoteData = {
              id,
              pitch: `${step}${acc}${octave}`,
              step,
              octave,
              alter: alter || undefined,
              duration: dur,
              type: childText(child, 'type') || 'quarter',
              measureNum: num,
              beat: chordStart,
              voice,
              staff,
              part: p,
              globalStaff: staffOffset + staff,
              tied,
              grace: isGrace || undefined,
              fingering: child.querySelector('fingering')?.textContent || undefined,
            }
            measure.notes.push(note)
            notes.set(id, note)
          }
        }
        if (!isChord) beat += dur
        maxReached.set(num, Math.max(maxReached.get(num) ?? 0, beat - 1))
      }
    })
    staffOffset += staves
  })

  // Measure start offsets (quarter notes). Implicit (pickup) measures use their real length.
  let q = 0
  const sorted = [...measures.values()].sort((a, b) => a.num - b.num)
  for (const m of sorted) {
    const reached = maxReached.get(m.num) ?? 0
    if ((m as any)._implicit && reached > 0) m.lengthQ = reached
    delete (m as any)._implicit
    m.startQ = q
    q += m.lengthQ
    m.notes.sort((a, b) => a.beat - b.beat || a.globalStaff - b.globalStaff)
  }

  const metadata: ScoreMetadata = {
    title: titleEl?.textContent?.trim() || 'Untitled',
    composer: composerEl?.textContent?.trim() || '',
    key: fifthsToKey(fifths0, mode0),
    timeSignature: `${beats0}/${beatType0}`,
    tempo: tempoEl?.getAttribute('tempo') || '',
    totalMeasures: parts[0] ? measuresOf(parts[0]).length : 0,
    parts: parts.length,
  }

  return { measures, notes, metadata }
}

export function fifthsToKey(fifths: number, mode: string): string {
  const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
  const minorKeys = ['a', 'e', 'b', 'f#', 'c#', 'g#', 'd#', 'a#', 'd', 'g', 'c', 'f', 'bb', 'eb', 'ab']
  const idx = fifths >= 0 ? Math.min(fifths, 7) : 7 + Math.min(-fifths, 7)
  const key = mode === 'minor' ? minorKeys[idx] : majorKeys[idx]
  return `${key} ${mode}`
}

/** Notes in score order (measure, beat, staff, pitch high→low). */
export function noteOrder(noteMap: NoteMap): NoteData[] {
  return [...noteMap.notes.values()].sort((a, b) =>
    a.measureNum - b.measureNum || a.beat - b.beat || a.globalStaff - b.globalStaff || midiOf(b) - midiOf(a))
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export function midiOf(n: { step: string; octave: number; alter?: number }): number {
  return (n.octave + 1) * 12 + (PC[n.step] ?? 0) + (n.alter ?? 0)
}

export interface HarmonyItem {
  measureNum: number
  beat: number          // 1-based quarter position
  beatFraction: number  // 0.0–1.0 within measure
  label: string         // "Ab6", "B♭m7" …
}

/** Chord symbols embedded in the MusicXML (<harmony>) — first part only. */
export function parseHarmonies(xmlString: string): HarmonyItem[] {
  const doc = parseXmlDoc(xmlString)
  const part = partsOf(doc)[0]
  if (!part) return []
  const items: HarmonyItem[] = []
  let divisions = 1
  let time = { beats: 4, beatType: 4 }

  measuresOf(part).forEach((mEl, i) => {
    const measureNum = i + 1
    const d = mEl.querySelector('attributes > divisions'); if (d) divisions = parseInt(d.textContent || '1') || 1
    const t = mEl.querySelector('attributes > time')
    if (t) time = { beats: parseInt(t.querySelector('beats')?.textContent || '4'), beatType: parseInt(t.querySelector('beat-type')?.textContent || '4') }
    const lengthQ = (time.beats * 4) / time.beatType
    let offset = 0

    for (const el of Array.from(mEl.children)) {
      const tag = el.tagName
      if (tag === 'harmony') {
        const rootStep = el.querySelector('root > root-step')?.textContent?.trim() || ''
        if (!rootStep) continue
        const rootAlter = parseFloat(el.querySelector('root > root-alter')?.textContent || '0')
        const kind = el.querySelector('kind')
        const kindText = kind?.getAttribute('text') ?? kindToText(kind?.textContent || '')
        const acc = rootAlter === -1 ? '♭' : rootAlter === 1 ? '♯' : rootAlter === -2 ? '𝄫' : ''
        const bass = el.querySelector('bass > bass-step')?.textContent?.trim()
        const bassAlter = parseFloat(el.querySelector('bass > bass-alter')?.textContent || '0')
        const bassStr = bass ? `/${bass}${bassAlter === -1 ? '♭' : bassAlter === 1 ? '♯' : ''}` : ''
        const harmonyOffset = parseInt(el.querySelector('offset')?.textContent || '0')
        const q = (offset + harmonyOffset) / divisions
        items.push({ measureNum, beat: 1 + q, beatFraction: lengthQ > 0 ? q / lengthQ : 0, label: rootStep + acc + kindText + bassStr })
      } else if (tag === 'note') {
        if (!el.querySelector('chord') && !el.querySelector('grace')) offset += parseInt(childText(el, 'duration') || '0')
      } else if (tag === 'backup') {
        offset -= parseInt(childText(el, 'duration') || '0')
      } else if (tag === 'forward') {
        offset += parseInt(childText(el, 'duration') || '0')
      }
    }
  })
  return items
}

function kindToText(kind: string): string {
  const map: Record<string, string> = {
    major: '', minor: 'm', augmented: '+', diminished: 'dim', dominant: '7',
    'major-seventh': 'maj7', 'minor-seventh': 'm7', 'diminished-seventh': 'dim7',
    'augmented-seventh': '+7', 'half-diminished': 'm7b5', 'major-minor': 'mMaj7',
    'major-sixth': '6', 'minor-sixth': 'm6', 'dominant-ninth': '9', 'major-ninth': 'maj9',
    'minor-ninth': 'm9', 'suspended-fourth': 'sus4', 'suspended-second': 'sus2', power: '5',
  }
  return map[kind.trim()] ?? ''
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

/** Every pitched note of every part/staff (measure = 1-based index). */
export function parseAllStavesNotes(xmlString: string): AllStavesNote[] {
  const doc = parseXmlDoc(xmlString)
  const result: AllStavesNote[] = []
  partsOf(doc).forEach(part => {
    let divisions = 1
    measuresOf(part).forEach((mEl, i) => {
      const num = i + 1
      const d = mEl.querySelector('attributes > divisions'); if (d) divisions = parseInt(d.textContent || '1') || 1
      let beat = 1
      let chordStart = 1
      for (const child of Array.from(mEl.children)) {
        const tag = child.tagName
        if (tag === 'backup' || tag === 'forward') {
          const dur = parseInt(childText(child, 'duration') || '0') / divisions
          beat += tag === 'backup' ? -dur : dur
          continue
        }
        if (tag !== 'note') continue
        const isChord = !!child.querySelector('chord')
        const isGrace = !!child.querySelector('grace')
        const dur = isGrace ? 0 : parseInt(childText(child, 'duration') || '0') / divisions
        if (!isChord) chordStart = beat
        const pitchEl = child.querySelector('pitch')
        if (pitchEl && !isGrace) {
          result.push({
            measureNum: num,
            beat: chordStart,
            duration: dur,
            step: pitchEl.querySelector('step')?.textContent || 'C',
            alter: parseFloat(pitchEl.querySelector('alter')?.textContent || '0') || 0,
            staff: parseInt(childText(child, 'staff') || '1'),
          })
        }
        if (!isChord) beat += dur
      }
    })
  })
  return result
}

export function extractSourceMarkings(xmlString: string) {
  const doc = parseXmlDoc(xmlString)
  const dynamics: Array<{ measure: number; value: string }> = []
  const articulations: Array<{ measure: number; value: string }> = []
  const ornaments: Array<{ measure: number; value: string }> = []
  const words: Array<{ measure: number; value: string }> = []
  const fingerings: Array<{ measure: number; value: string }> = []
  const part = partsOf(doc)[0]
  if (part) measuresOf(part).forEach((mEl, i) => {
    const num = i + 1
    mEl.querySelectorAll('dynamics').forEach(d => {
      const type = d.firstElementChild?.tagName
      if (type) dynamics.push({ measure: num, value: type })
    })
    mEl.querySelectorAll('articulations > *').forEach(a => articulations.push({ measure: num, value: a.tagName }))
    mEl.querySelectorAll('ornaments > *').forEach(o => ornaments.push({ measure: num, value: o.tagName }))
    mEl.querySelectorAll('words').forEach(w => {
      const text = w.textContent?.trim()
      if (text) words.push({ measure: num, value: text })
    })
    mEl.querySelectorAll('fingering').forEach(f => {
      const text = f.textContent?.trim()
      if (text) fingerings.push({ measure: num, value: text })
    })
  })
  return { dynamics, articulations, ornaments, words, fingerings }
}

