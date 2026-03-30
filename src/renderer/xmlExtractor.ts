/**
 * MAP Native Renderer — XML Extractor
 * Stage 2: MusicXML → ExtractedScore
 *
 * Extracts all musical content needed by the layout engine.
 * Does NOT calculate any geometry — that is the job of Stage 3/4.
 *
 * Key responsibilities:
 *  - All staves, all voices
 *  - Beaming (begin/continue/end per level)
 *  - Ties and slurs (start/stop)
 *  - Tuplets (with shared tupletId per group)
 *  - Accidentals: explicit + computed showAccidental (§4h algorithm)
 *  - Dynamics, directions, hairpins, tempo
 *  - Repeat barlines, volta brackets
 *  - Clef/key/time signature changes per measure
 *  - Grace notes
 *  - Articulations and ornaments
 */

import type {
  ExtractedScore,
  ExtractedMetadata,
  ExtractedMeasure,
  ExtractedNote,
  ExtractedHarmony,
  ExtractedDynamic,
  ExtractedDirection,
  ExtractedBarline,
  ExtractedVolta,
  ExtractedClef,
  AccidentalSign,
  BeamState,
  BeamValue,
  ArticulationMark,
  OrnamentMark,
  ClefSign,
  BarlineStyle,
} from './extractorTypes'

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function extractScore(xmlString: string): ExtractedScore {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const parts = extractParts(doc)
  const metadata = extractMetadata(doc, parts)
  const measures = extractMeasures(doc, metadata)

  return { metadata, parts, measures }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parts
// ─────────────────────────────────────────────────────────────────────────────

function extractParts(doc: Document) {
  const partListEls = doc.querySelectorAll('part-list > score-part')
  const parts = Array.from(partListEls).map(el => ({
    id: el.getAttribute('id') || 'P1',
    name: el.querySelector('part-name')?.textContent?.trim() || '',
    staffCount: 1, // updated below from first measure
  }))
  if (parts.length === 0) parts.push({ id: 'P1', name: '', staffCount: 1 })
  return parts
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────

function extractMetadata(
  doc: Document,
  parts: ReturnType<typeof extractParts>
): ExtractedMetadata {
  const title =
    doc.querySelector('work-title')?.textContent?.trim() ||
    doc.querySelector('movement-title')?.textContent?.trim() ||
    doc.querySelector('credit-words')?.textContent?.trim() ||
    'Untitled'

  const composer =
    doc.querySelector('creator[type="composer"]')?.textContent?.trim() || ''

  const firstMeasure = doc.querySelector('measure')
  const keyEl = firstMeasure?.querySelector('attributes > key')
  const timeEl = firstMeasure?.querySelector('attributes > time')
  const stavesEl = firstMeasure?.querySelector('attributes > staves')

  const fifths = parseInt(keyEl?.querySelector('fifths')?.textContent || '0')
  const mode = (keyEl?.querySelector('mode')?.textContent || 'major') as 'major' | 'minor'
  const beats = parseInt(timeEl?.querySelector('beats')?.textContent || '4')
  const beatType = parseInt(timeEl?.querySelector('beat-type')?.textContent || '4')
  const staffCount = stavesEl ? parseInt(stavesEl.textContent || '1') : 1

  // Update part staffCount
  parts.forEach(p => { p.staffCount = staffCount })

  // Tempo
  let tempo: number | undefined
  let tempoText: string | undefined
  const soundEl = firstMeasure?.querySelector('sound[tempo]')
  if (soundEl) tempo = parseFloat(soundEl.getAttribute('tempo') || '120')
  const wordsEl = firstMeasure?.querySelector('direction > direction-type > words')
  if (wordsEl) tempoText = wordsEl.textContent?.trim()

  const measureCount = doc.querySelectorAll('measure').length

  return { title, composer, fifths, mode, beats, beatType, tempo, tempoText, measureCount, staffCount }
}

// ─────────────────────────────────────────────────────────────────────────────
// Measures
// ─────────────────────────────────────────────────────────────────────────────

function extractMeasures(doc: Document, meta: ExtractedMetadata): ExtractedMeasure[] {
  const measureEls = Array.from(doc.querySelectorAll('measure'))

  // Running state across measures
  let divisions = 1
  let currentKey = { fifths: meta.fifths, mode: meta.mode }
  let currentTime = { beats: meta.beats, beatType: meta.beatType }
  const currentClefs: Record<number, ExtractedClef> = {
    0: { sign: 'G', line: 2, staffIndex: 0 },
    1: { sign: 'F', line: 4, staffIndex: 1 },
  }

  // Accidental state: per-staff, per-pitch-class; resets each measure
  // pitch-class = (step + alter) identity: "C0", "C1", "C-1", "D0", etc.
  type AccidentalState = Map<string, number> // pitchClass key → alter value
  const accidentalState: Record<number, AccidentalState> = {}
  for (let s = 0; s < meta.staffCount; s++) accidentalState[s] = new Map()

  // Tuplet counter per voice to generate shared IDs
  let tupletCounter = 0

  // Active tuplet IDs per voice (voice → tupletId)
  const activeTuplets: Record<number, string> = {}

  const measures: ExtractedMeasure[] = []

  measureEls.forEach(mEl => {
    const num = parseInt(mEl.getAttribute('number') || '1')

    // Reset accidental state at start of each measure
    for (let s = 0; s < Math.max(meta.staffCount, 2); s++) {
      if (!accidentalState[s]) accidentalState[s] = new Map()
      else accidentalState[s].clear()
    }

    // ── Attributes ────────────────────────────────────────────────────────
    let keyChange: ExtractedMeasure['keyChange']
    let timeChange: ExtractedMeasure['timeChange']
    const clefChange: Record<number, ClefSign> = {}

    const attribEl = mEl.querySelector('attributes')
    if (attribEl) {
      const divEl = attribEl.querySelector('divisions')
      if (divEl) divisions = parseInt(divEl.textContent || '1')

      const kEl = attribEl.querySelector('key')
      if (kEl) {
        const f = parseInt(kEl.querySelector('fifths')?.textContent || '0')
        const m = (kEl.querySelector('mode')?.textContent || 'major') as 'major' | 'minor'
        if (f !== currentKey.fifths || m !== currentKey.mode) {
          keyChange = { fifths: f, mode: m }
          currentKey = { fifths: f, mode: m }
        }
      }

      const tEl = attribEl.querySelector('time')
      if (tEl) {
        const b = parseInt(tEl.querySelector('beats')?.textContent || '4')
        const bt = parseInt(tEl.querySelector('beat-type')?.textContent || '4')
        if (b !== currentTime.beats || bt !== currentTime.beatType) {
          timeChange = { beats: b, beatType: bt }
          currentTime = { beats: b, beatType: bt }
        }
      }

      Array.from(attribEl.querySelectorAll('clef')).forEach(cEl => {
        const staffAttr = parseInt(cEl.getAttribute('number') || '1')
        const staffIdx = staffAttr - 1
        const sign = (cEl.querySelector('sign')?.textContent || 'G') as ClefSign
        const line = parseInt(cEl.querySelector('line')?.textContent || (sign === 'F' ? '4' : '2'))
        const octaveChange = cEl.querySelector('clef-octave-change')
          ? parseInt(cEl.querySelector('clef-octave-change')!.textContent || '0')
          : undefined
        currentClefs[staffIdx] = { sign, line, staffIndex: staffIdx, octaveChange }
        clefChange[staffIdx] = sign
      })
    }

    // ── Tempo / rehearsal from <direction> ────────────────────────────────
    let tempo: number | undefined
    let tempoText: string | undefined
    let rehearsalMark: string | undefined

    const soundEl = mEl.querySelector('sound[tempo]')
    if (soundEl) tempo = parseFloat(soundEl.getAttribute('tempo') || '120')
    const rehearsalEl = mEl.querySelector('rehearsal')
    if (rehearsalEl) rehearsalMark = rehearsalEl.textContent?.trim()
    // Words at first direction (exclude dynamics which are inside <dynamics>)
    const wordsEl = mEl.querySelector('direction > direction-type > words')
    if (wordsEl) tempoText = wordsEl.textContent?.trim()

    // ── Barlines ──────────────────────────────────────────────────────────
    let barlineLeft: ExtractedBarline | undefined
    let barlineRight: ExtractedBarline | undefined
    let voltaStart: ExtractedVolta | undefined
    let voltaEnd = false

    Array.from(mEl.querySelectorAll('barline')).forEach(bEl => {
      const loc = (bEl.getAttribute('location') || 'right') as 'left' | 'right'
      const styleEl = bEl.querySelector('bar-style')
      const repeat = bEl.querySelector('repeat')
      const endingEl = bEl.querySelector('ending')

      let style: BarlineStyle = 'regular'
      if (repeat) {
        const dir = repeat.getAttribute('direction')
        if (dir === 'forward') style = 'repeat-start'
        else if (dir === 'backward') style = 'repeat-end'
      } else if (styleEl) {
        style = mapBarStyle(styleEl.textContent || '')
      }

      if (endingEl) {
        const endingType = endingEl.getAttribute('type') || 'start'
        if (endingType === 'start' || endingType === 'discontinue') {
          const num = parseInt(endingEl.getAttribute('number') || '1')
          const text = endingEl.textContent?.trim() || `${num}.`
          voltaStart = { number: num, text, openRight: endingType === 'discontinue' }
        } else if (endingType === 'stop') {
          voltaEnd = true
        }
      }

      if (loc === 'left') barlineLeft = { style, location: 'left' }
      else barlineRight = { style, location: 'right' }
    })

    // ── Notes, harmonies, dynamics, directions ────────────────────────────
    const notes: ExtractedNote[] = []
    const harmonies: ExtractedHarmony[] = []
    const dynamics: ExtractedDynamic[] = []
    const directions: ExtractedDirection[] = []

    // Beat tracking per staff (needed because backup/forward affect per-staff position)
    // We track a single running beat for voice 1 (staff 1), similar to existing parser
    const beatByVoice: Record<number, number> = {}
    let runningBeat = 1  // fallback

    Array.from(mEl.children).forEach(child => {
      const tag = child.tagName

      // ── backup / forward ──────────────────────────────────────────────
      if (tag === 'backup') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0')
        runningBeat -= dur / divisions
        // Also update all voice beats (simplified: they all share the running beat for now)
        return
      }
      if (tag === 'forward') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0')
        runningBeat += dur / divisions
        return
      }

      // ── harmony ────────────────────────────────────────────────────────
      if (tag === 'harmony') {
        const harmony = parseHarmony(child as Element, num, runningBeat, divisions, currentTime.beats)
        if (harmony) harmonies.push(harmony)
        return
      }

      // ── direction ─────────────────────────────────────────────────────
      if (tag === 'direction') {
        const extracted = parseDirection(child as Element, num, runningBeat)
        if (extracted.dynamics) dynamics.push(...extracted.dynamics)
        if (extracted.directions) directions.push(...extracted.directions)
        // Update tempo from sound element inside direction
        const sSnd = child.querySelector('sound[tempo]')
        if (sSnd && !tempo) tempo = parseFloat(sSnd.getAttribute('tempo') || '120')
        return
      }

      // ── note ───────────────────────────────────────────────────────────
      if (tag !== 'note') return

      const noteEl = child as Element
      const voice = parseInt(noteEl.querySelector('voice')?.textContent || '1')
      const staffAttr = parseInt(noteEl.querySelector('staff')?.textContent || '1')
      const staffIndex = staffAttr - 1

      const isChord = !!noteEl.querySelector('chord')
      const isRest = !!noteEl.querySelector('rest')
      const isGrace = !!noteEl.querySelector('grace')

      const durEl = noteEl.querySelector('duration')
      const durationDivisions = durEl ? parseInt(durEl.textContent || '1') : 0
      const duration = divisions > 0 ? durationDivisions / divisions : 0

      // Beat position: chord notes share beat with previous; grace notes don't advance
      if (!beatByVoice[voice]) beatByVoice[voice] = runningBeat
      const noteBeat = isChord ? (beatByVoice[voice] ?? runningBeat) : runningBeat

      // Advance beat after non-chord, non-grace notes
      if (!isChord && !isGrace && durationDivisions > 0) {
        runningBeat += duration
        beatByVoice[voice] = runningBeat
      }

      // ── Pitch ──────────────────────────────────────────────────────────
      let step: string | undefined
      let octave: number | undefined
      let alter: number | undefined
      let midi: number | undefined

      if (!isRest) {
        const pitchEl = noteEl.querySelector('pitch')
        if (pitchEl) {
          step = pitchEl.querySelector('step')?.textContent || 'C'
          octave = parseInt(pitchEl.querySelector('octave')?.textContent || '4')
          const rawAlter = parseFloat(pitchEl.querySelector('alter')?.textContent || '0')
          alter = isNaN(rawAlter) ? 0 : rawAlter
          midi = stepOctaveAlterToMidi(step, octave, alter)
        }
      }

      // ── noteMap ID ─────────────────────────────────────────────────────
      const id = step && octave !== undefined
        ? `note-m${num}b${Math.round(noteBeat * 100)}-${step}${octave}`
        : `note-m${num}b${Math.round(noteBeat * 100)}-rest`

      // ── Duration type ──────────────────────────────────────────────────
      const typeEl = noteEl.querySelector('type')
      const type = typeEl?.textContent || durationToType(durationDivisions, divisions)
      const dotCount = noteEl.querySelectorAll('dot').length

      // ── Accidental ────────────────────────────────────────────────────
      let explicitAccidental: AccidentalSign | undefined
      let isCourtesy = false
      const accidentalEl = noteEl.querySelector('accidental')
      if (accidentalEl) {
        explicitAccidental = mapAccidentalText(accidentalEl.textContent || '')
        isCourtesy = accidentalEl.getAttribute('cautionary') === 'yes' ||
                     accidentalEl.getAttribute('courtesy') === 'yes' ||
                     accidentalEl.getAttribute('parentheses') === 'yes'
      }

      // ── Computed accidental display (§4h algorithm) ───────────────────
      let showAccidental = false
      let accidentalToShow: AccidentalSign | undefined

      if (!isRest && step !== undefined && alter !== undefined) {
        const stateMap = accidentalState[staffIndex] ?? (accidentalState[staffIndex] = new Map())
        const pitchKey = `${step}${octave}`   // e.g. "C4" — track per exact pitch (step+octave)
        const expectedAlter = keySignatureAlterFor(step, currentKey.fifths)
        const stateAlter = stateMap.has(pitchKey) ? stateMap.get(pitchKey)! : expectedAlter

        if (explicitAccidental) {
          // Always show explicitly written accidentals
          showAccidental = true
          accidentalToShow = explicitAccidental
          stateMap.set(pitchKey, alter)
        } else if (alter !== stateAlter) {
          // Differ from current measure state → show accidental
          showAccidental = true
          accidentalToShow = alterToAccidentalSign(alter)
          stateMap.set(pitchKey, alter)
        }
      }

      // ── Beam ──────────────────────────────────────────────────────────
      const beamStates: BeamState[] = []
      Array.from(noteEl.querySelectorAll('beam')).forEach(bEl => {
        const level = parseInt(bEl.getAttribute('number') || '1')
        const value = (bEl.textContent || 'continue') as BeamValue
        beamStates.push({ level, value })
      })

      // ── Tie ───────────────────────────────────────────────────────────
      let tieStart = false
      let tieStop = false
      Array.from(noteEl.querySelectorAll('tie')).forEach(tEl => {
        const type2 = tEl.getAttribute('type')
        if (type2 === 'start') tieStart = true
        if (type2 === 'stop') tieStop = true
      })

      // ── Slur ──────────────────────────────────────────────────────────
      let slurStart = false
      let slurStop = false
      let slurPlacement: 'above' | 'below' | undefined
      Array.from(noteEl.querySelectorAll('notations > slur')).forEach(sEl => {
        const type2 = sEl.getAttribute('type')
        if (type2 === 'start') {
          slurStart = true
          const pl = sEl.getAttribute('placement')
          if (pl === 'above' || pl === 'below') slurPlacement = pl
        }
        if (type2 === 'stop') slurStop = true
      })

      // ── Tuplet ────────────────────────────────────────────────────────
      let tupletStart = false
      let tupletStop = false
      let tupletActual: number | undefined
      let tupletNormal: number | undefined
      let tupletId: string | undefined

      const tupletEl = noteEl.querySelector('notations > tuplet')
      if (tupletEl) {
        const tupType = tupletEl.getAttribute('type')
        if (tupType === 'start') {
          tupletStart = true
          tupletCounter++
          activeTuplets[voice] = `tuplet-${num}-${tupletCounter}`
        }
        if (tupType === 'stop') {
          tupletStop = true
        }
      }
      // Time modification (all notes in tuplet have this)
      const timeMod = noteEl.querySelector('time-modification')
      if (timeMod) {
        tupletActual = parseInt(timeMod.querySelector('actual-notes')?.textContent || '0') || undefined
        tupletNormal = parseInt(timeMod.querySelector('normal-notes')?.textContent || '0') || undefined
        tupletId = activeTuplets[voice]
      }
      if (tupletEl?.getAttribute('type') === 'stop') {
        delete activeTuplets[voice]
      }

      // ── Articulations ─────────────────────────────────────────────────
      const articulations: ArticulationMark[] = []
      const articEl = noteEl.querySelector('notations > articulations')
      if (articEl) {
        Array.from(articEl.children).forEach(a => {
          const mark = mapArticulation(a.tagName)
          if (mark) articulations.push(mark)
        })
      }
      // Fermata is under notations directly
      if (noteEl.querySelector('notations > fermata')) {
        articulations.push('fermata')
      }

      // ── Ornaments ─────────────────────────────────────────────────────
      const ornaments: OrnamentMark[] = []
      const ornEl = noteEl.querySelector('notations > ornaments')
      if (ornEl) {
        Array.from(ornEl.children).forEach(o => {
          const mark = mapOrnament(o.tagName)
          if (mark) ornaments.push(mark)
        })
      }

      // ── Fingering ─────────────────────────────────────────────────────
      const fingering = noteEl.querySelector('notations > technical > fingering')?.textContent?.trim()
        || noteEl.querySelector('fingering')?.textContent?.trim()

      const note: ExtractedNote = {
        id,
        measureNum: num,
        beat: noteBeat,
        duration,
        durationDivisions,
        staffIndex,
        voice,
        isChord,
        isRest,
        isGrace,
        step,
        octave,
        alter,
        midi,
        type,
        dotCount,
        explicitAccidental,
        isCourtesy: isCourtesy || undefined,
        showAccidental,
        accidentalToShow,
        beamStates: beamStates.length > 0 ? beamStates : undefined,
        tieStart: tieStart || undefined,
        tieStop: tieStop || undefined,
        slurStart: slurStart || undefined,
        slurStop: slurStop || undefined,
        slurPlacement,
        tupletStart: tupletStart || undefined,
        tupletStop: tupletStop || undefined,
        tupletActual,
        tupletNormal,
        tupletId,
        articulations: articulations.length > 0 ? articulations : undefined,
        ornaments: ornaments.length > 0 ? ornaments : undefined,
        fingering,
      }

      notes.push(note)
    })

    const measure: ExtractedMeasure = {
      num,
      divisions,
      notes,
      harmonies,
      dynamics,
      directions,
    }
    if (keyChange) measure.keyChange = keyChange
    if (timeChange) measure.timeChange = timeChange
    if (Object.keys(clefChange).length > 0) measure.clefChange = clefChange
    if (barlineLeft) measure.barlineLeft = barlineLeft
    if (barlineRight) measure.barlineRight = barlineRight
    if (voltaStart) measure.voltaStart = voltaStart
    if (voltaEnd) measure.voltaEnd = true
    if (rehearsalMark) measure.rehearsalMark = rehearsalMark
    if (tempoText) measure.tempoText = tempoText
    if (tempo) measure.tempo = tempo

    measures.push(measure)
  })

  return measures
}

// ─────────────────────────────────────────────────────────────────────────────
// Harmony parser
// ─────────────────────────────────────────────────────────────────────────────

function parseHarmony(
  el: Element,
  measureNum: number,
  currentBeat: number,
  divisions: number,
  beatsPerMeasure: number,
): ExtractedHarmony | null {
  const rootStep = el.querySelector('root > root-step')?.textContent?.trim() || ''
  if (!rootStep) return null

  const rawAlter = parseFloat(el.querySelector('root > root-alter')?.textContent || '0')
  const rootAlter = isNaN(rawAlter) ? 0 : rawAlter
  const kind = el.querySelector('kind')?.textContent?.trim() || ''
  const kindText = el.querySelector('kind')?.getAttribute('text') || kindToDisplay(kind)

  const acc = rootAlter === -1 ? '♭' : rootAlter === 1 ? '♯' : rootAlter === -2 ? '𝄫' : rootAlter === 2 ? '𝄪' : ''
  const label = rootStep + acc + kindText

  // Offset element shifts the beat position of the harmony
  const offsetEl = el.querySelector('offset')
  const offsetDivisions = offsetEl ? parseInt(offsetEl.textContent || '0') : 0
  const beat = currentBeat + (divisions > 0 ? offsetDivisions / divisions : 0)

  // beatFraction for compatibility with melodyColorScript
  const totalDivisions = divisions * beatsPerMeasure
  // We compute beatFraction as (beat - 1) / beatsPerMeasure
  const beatFraction = beatsPerMeasure > 0 ? (beat - 1) / beatsPerMeasure : 0

  const bassStepEl = el.querySelector('bass > bass-step')
  const bassAlterEl = el.querySelector('bass > bass-alter')
  const bassStep = bassStepEl?.textContent?.trim()
  const bassAlterRaw = parseFloat(bassAlterEl?.textContent || '0')
  const bassAlter = isNaN(bassAlterRaw) ? 0 : bassAlterRaw

  return {
    measureNum,
    beat,
    beatFraction,
    rootStep,
    rootAlter,
    kind,
    kindText,
    label,
    bassStep: bassStep || undefined,
    bassAlter: bassStep ? bassAlter : undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direction parser (dynamics, words, wedge, metronome, etc.)
// ─────────────────────────────────────────────────────────────────────────────

function parseDirection(
  el: Element,
  measureNum: number,
  currentBeat: number
): { dynamics: ExtractedDynamic[]; directions: ExtractedDirection[] } {
  const dynamics: ExtractedDynamic[] = []
  const directions: ExtractedDirection[] = []

  const placementAttr = el.getAttribute('placement') || 'below'
  const placement: 'above' | 'below' = placementAttr === 'above' ? 'above' : 'below'
  const staffAttr = parseInt(el.querySelector('staff')?.textContent || '1')
  const staffIndex = staffAttr - 1

  Array.from(el.querySelectorAll('direction-type')).forEach(dtEl => {
    // Dynamics
    const dynEl = dtEl.querySelector('dynamics')
    if (dynEl && dynEl.firstElementChild) {
      dynamics.push({
        measureNum,
        beat: currentBeat,
        staffIndex,
        placement,
        value: dynEl.firstElementChild.tagName,
      })
    }

    // Words
    const wordsEl = dtEl.querySelector('words')
    if (wordsEl) {
      directions.push({
        measureNum,
        beat: currentBeat,
        staffIndex,
        placement,
        type: 'words',
        text: wordsEl.textContent?.trim(),
      })
    }

    // Metronome
    const metroEl = dtEl.querySelector('metronome')
    if (metroEl) {
      const unit = metroEl.querySelector('beat-unit')?.textContent?.trim() || 'quarter'
      const bpm = parseInt(metroEl.querySelector('per-minute')?.textContent || '0') || undefined
      directions.push({
        measureNum,
        beat: currentBeat,
        staffIndex,
        placement,
        type: 'metronome',
        metronomeUnit: unit,
        metronomeBpm: bpm,
      })
    }

    // Wedge (hairpin)
    const wedgeEl = dtEl.querySelector('wedge')
    if (wedgeEl) {
      const wedgeType = wedgeEl.getAttribute('type') || ''
      const wedgeNumber = parseInt(wedgeEl.getAttribute('number') || '1')
      let dirType: 'wedge-crescendo' | 'wedge-decrescendo' | 'wedge-stop' = 'wedge-stop'
      if (wedgeType === 'crescendo') dirType = 'wedge-crescendo'
      else if (wedgeType === 'diminuendo' || wedgeType === 'decrescendo') dirType = 'wedge-decrescendo'
      directions.push({
        measureNum,
        beat: currentBeat,
        staffIndex,
        placement,
        type: dirType,
        wedgeNumber,
      })
    }

    // Dashes
    const dashesEl = dtEl.querySelector('dashes')
    if (dashesEl) {
      const dtype = dashesEl.getAttribute('type') === 'start' ? 'dashes-start' : 'dashes-stop'
      directions.push({ measureNum, beat: currentBeat, staffIndex, placement, type: dtype })
    }

    // Octave shift
    const octaveEl = dtEl.querySelector('octave-shift')
    if (octaveEl) {
      const otype = octaveEl.getAttribute('type') || 'up'
      const dtype: 'octave-shift-up' | 'octave-shift-down' | 'octave-shift-stop' =
        otype === 'stop' ? 'octave-shift-stop' :
        otype === 'up' ? 'octave-shift-up' : 'octave-shift-down'
      directions.push({ measureNum, beat: currentBeat, staffIndex, placement, type: dtype })
    }

    // Segno / Coda
    if (dtEl.querySelector('segno')) {
      directions.push({ measureNum, beat: currentBeat, staffIndex, placement, type: 'segno' })
    }
    if (dtEl.querySelector('coda')) {
      directions.push({ measureNum, beat: currentBeat, staffIndex, placement, type: 'coda' })
    }
  })

  return { dynamics, directions }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pitch helpers
// ─────────────────────────────────────────────────────────────────────────────

const STEP_SEMITONES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

function stepOctaveAlterToMidi(step: string, octave: number, alter: number): number {
  return (octave + 1) * 12 + (STEP_SEMITONES[step] ?? 0) + alter
}

/** Key signature: which alter each step gets.
 *  Positive fifths = sharps: F C G D A E B
 *  Negative fifths = flats:  B E A D G C F
 */
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

function keySignatureAlterFor(step: string, fifths: number): number {
  if (fifths > 0) {
    return SHARP_ORDER.slice(0, fifths).includes(step) ? 1 : 0
  } else if (fifths < 0) {
    return FLAT_ORDER.slice(0, -fifths).includes(step) ? -1 : 0
  }
  return 0
}

function alterToAccidentalSign(alter: number): AccidentalSign {
  if (alter === 1)  return 'sharp'
  if (alter === -1) return 'flat'
  if (alter === 0)  return 'natural'
  if (alter === 2)  return 'double-sharp'
  if (alter === -2) return 'double-flat'
  return alter > 0 ? 'sharp' : 'flat'
}

// ─────────────────────────────────────────────────────────────────────────────
// Duration helpers
// ─────────────────────────────────────────────────────────────────────────────

function durationToType(durationDivisions: number, divisions: number): string {
  if (divisions <= 0) return 'quarter'
  const beats = durationDivisions / divisions
  if (beats >= 4)   return 'whole'
  if (beats >= 2)   return 'half'
  if (beats >= 1)   return 'quarter'
  if (beats >= 0.5) return 'eighth'
  if (beats >= 0.25) return '16th'
  if (beats >= 0.125) return '32nd'
  return '64th'
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapBarStyle(style: string): BarlineStyle {
  const map: Record<string, BarlineStyle> = {
    'regular': 'regular',
    'dotted': 'dotted',
    'dashed': 'dashed',
    'heavy': 'final',
    'light-light': 'double',
    'light-heavy': 'final',
    'heavy-light': 'repeat-start',
    'heavy-heavy': 'heavy-heavy',
    'none': 'none',
  }
  return map[style] ?? 'regular'
}

function mapAccidentalText(text: string): AccidentalSign | undefined {
  const map: Record<string, AccidentalSign> = {
    'sharp': 'sharp',
    'flat': 'flat',
    'natural': 'natural',
    'double-sharp': 'double-sharp',
    'flat-flat': 'double-flat',
    'double-flat': 'double-flat',
    'sharp-sharp': 'double-sharp',
    'natural-sharp': 'sharp',
    'natural-flat': 'flat',
  }
  return map[text.trim()] ?? (text.trim() ? 'natural' : undefined)
}

function mapArticulation(tagName: string): ArticulationMark | undefined {
  const map: Record<string, ArticulationMark> = {
    'staccato': 'staccato',
    'staccatissimo': 'staccatissimo',
    'tenuto': 'tenuto',
    'accent': 'accent',
    'strong-accent': 'strong-accent',
    'stress': 'stress',
    'unstress': 'unstress',
    'snap-pizzicato': 'snap-pizzicato',
    'fermata': 'fermata',
  }
  return map[tagName]
}

function mapOrnament(tagName: string): OrnamentMark | undefined {
  const map: Record<string, OrnamentMark> = {
    'trill-mark': 'trill-mark',
    'turn': 'turn',
    'inverted-turn': 'inverted-turn',
    'mordent': 'mordent',
    'inverted-mordent': 'inverted-mordent',
    'tremolo': 'tremolo',
    'wavy-line': 'wavy-line',
  }
  return map[tagName]
}

/** Convert MusicXML kind value to a display string when kind/@text is absent */
function kindToDisplay(kind: string): string {
  const map: Record<string, string> = {
    'major': '',
    'minor': 'm',
    'dominant': '7',
    'major-seventh': 'maj7',
    'minor-seventh': 'm7',
    'diminished': 'dim',
    'diminished-seventh': 'dim7',
    'augmented': 'aug',
    'augmented-seventh': 'aug7',
    'half-diminished': 'ø7',
    'major-minor': 'mMaj7',
    'major-sixth': '6',
    'minor-sixth': 'm6',
    'dominant-ninth': '9',
    'major-ninth': 'maj9',
    'minor-ninth': 'm9',
    'dominant-11th': '11',
    'major-11th': 'maj11',
    'minor-11th': 'm11',
    'dominant-13th': '13',
    'major-13th': 'maj13',
    'minor-13th': 'm13',
    'suspended-second': 'sus2',
    'suspended-fourth': 'sus4',
    'Neapolitan': 'N',
    'Italian': 'It',
    'French': 'Fr',
    'German': 'Ger',
    'pedal': 'ped',
    'power': '5',
    'Tristan': 'Tristan',
    'other': '',
    'none': '',
  }
  return map[kind] ?? kind
}
