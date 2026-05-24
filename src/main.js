import * as Tone from 'tone'
import { startAudio, noteOn, noteOff, updateParams, setEnvelope, setFilterEnvelope, setWaveform, setVibrato, setTremolo, setFilterLFO, setPortamento, getCurrentState } from './audio/synth.js'
import { interpolate } from './audio/morpher.js'
import { initMIDI, connectInput } from './midi/midi.js'
import { createXYPad } from './ui/xypad.js'
import { createGestureEnvelope } from './ui/gesture.js'
import { createFilterEnvelope } from './ui/filtergesture.js'
import { createWaveformGesture } from './ui/wavegesture.js'
import { createTriangleMod } from './ui/triangle.js'
import { createIntensityCircle } from './ui/intensity.js'
import { createKnob } from './ui/knob.js'
import { createChordPanel, spellNoteMidi } from './ui/chord.js'
import { createCircleOfFifths } from './ui/circleoffifths.js'
import { createDrumGrid } from './ui/drumgrid.js'
import {
  startDrums, stopDrums, isDrumPlaying,
  setBPM, getBPM,
  toggleStep, setStep, getPattern, setPattern, clearPattern,
  onStep,
  setDrumVolume,
  DRUM_TRACK_NAMES,
} from './audio/drums.js'

// — Presets (localStorage) —
const PRESET_PREFIX = 'canvas-synth-preset:'

function listPresets() {
  const names = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(PRESET_PREFIX)) names.push(k.slice(PRESET_PREFIX.length))
  }
  return names.sort()
}

function readPreset(name) {
  try { return JSON.parse(localStorage.getItem(PRESET_PREFIX + name)) } catch { return null }
}

function writePreset(name, data) {
  localStorage.setItem(PRESET_PREFIX + name, JSON.stringify(data))
}

function deletePreset(name) {
  localStorage.removeItem(PRESET_PREFIX + name)
}

const KEY_NOTE_MAP = {
  a: 'C4',  w: 'C#4', s: 'D4',  e: 'D#4', d: 'E4',
  f: 'F4',  t: 'F#4', g: 'G4',  y: 'G#4', h: 'A4', u: 'A#4', j: 'B4',
  k: 'C5',
}

const $ = id => document.getElementById(id)

// — Back panel sliders (id → { el, valEl, fmt }) —
const sliders = {
  gain:       { el: $('s-volume'),        valEl: $('s-volume-val'),        fmt: v => `${v.toFixed(1)} dB` },
  reverbWet:  { el: $('s-reverb-wet'),    valEl: $('s-reverb-wet-val'),    fmt: v => v.toFixed(2) },
  reverbDecay:{ el: $('s-reverb-decay'),  valEl: $('s-reverb-decay-val'),  fmt: v => `${v.toFixed(1)} s` },
  distortion: { el: $('s-distortion'),    valEl: $('s-distortion-val'),    fmt: v => v.toFixed(2) },
  oscCount:   { el: $('s-osc-count'),     valEl: $('s-osc-count-val'),     fmt: v => `${Math.round(v)}` },
  oscDetune:  { el: $('s-osc-detune'),    valEl: $('s-osc-detune-val'),    fmt: v => `${Math.round(v)} ct` },
  filterFreq: { el: $('s-filter-freq'),   valEl: $('s-filter-freq-val'),   fmt: v => `${Math.round(v)} Hz` },
  filterQ:    { el: $('s-filter-q'),      valEl: $('s-filter-q-val'),      fmt: v => v.toFixed(1) },
  attack:     { el: $('s-env-attack'),    valEl: $('s-env-attack-val'),    fmt: v => `${v.toFixed(2)} s` },
  decay:      { el: $('s-env-decay'),     valEl: $('s-env-decay-val'),     fmt: v => `${v.toFixed(2)} s` },
  sustain:    { el: $('s-env-sustain'),   valEl: $('s-env-sustain-val'),   fmt: v => v.toFixed(2) },
  release:    { el: $('s-env-release'),   valEl: $('s-env-release-val'),   fmt: v => `${v.toFixed(2)} s` },
  fAttack:    { el: $('s-fenv-attack'),   valEl: $('s-fenv-attack-val'),   fmt: v => `${v.toFixed(2)} s` },
  fDecay:     { el: $('s-fenv-decay'),    valEl: $('s-fenv-decay-val'),    fmt: v => `${v.toFixed(2)} s` },
  fSustain:   { el: $('s-fenv-sustain'),  valEl: $('s-fenv-sustain-val'),  fmt: v => v.toFixed(2) },
  fRelease:   { el: $('s-fenv-release'),  valEl: $('s-fenv-release-val'),  fmt: v => `${v.toFixed(2)} s` },
  fBase:      { el: $('s-fenv-base'),     valEl: $('s-fenv-base-val'),     fmt: v => `${Math.round(v)} Hz` },
  fOctaves:   { el: $('s-fenv-octaves'),  valEl: $('s-fenv-octaves-val'),  fmt: v => v.toFixed(1) },
  vibRate:    { el: $('s-vib-rate'),      valEl: $('s-vib-rate-val'),      fmt: v => v.toFixed(1) },
  vibDepth:   { el: $('s-vib-depth'),     valEl: $('s-vib-depth-val'),     fmt: v => v.toFixed(2) },
  trmRate:    { el: $('s-trm-rate'),      valEl: $('s-trm-rate-val'),      fmt: v => v.toFixed(1) },
  trmDepth:   { el: $('s-trm-depth'),     valEl: $('s-trm-depth-val'),     fmt: v => v.toFixed(2) },
  fltRate:    { el: $('s-flt-rate'),      valEl: $('s-flt-rate-val'),      fmt: v => v.toFixed(1) },
  fltDepth:   { el: $('s-flt-depth'),     valEl: $('s-flt-depth-val'),     fmt: v => v.toFixed(2) },
}

function setSliderUI(key, value) {
  const s = sliders[key]
  if (!s || value === undefined) return
  s.el.value = value
  s.valEl.textContent = s.fmt(value)
}

const flipBtn       = $('flip-btn')
const mainCard      = $('main-card')
const startBtn      = $('start-btn')
const startScreen   = $('start-screen')
const synthScreen   = $('synth-screen')
const noteDisplay   = $('note-display')
const midiArea      = $('midi-area')
const midiSelect    = $('midi-select')
const midiStatus    = $('midi-status')
const xyContainer              = $('xy-pad-container')
const waveformContainer        = $('waveform-container')
const envelopeContainer        = $('envelope-container')
const filterEnvelopeContainer  = $('filter-envelope-container')

// — XY pad with sticky per-param lock —
// When the user touches a back-panel slider for an XY-driven param, that param
// is locked for LOCK_MS so the XY-pad doesn't overwrite it right away.
const lockTimestamps = {}
const LOCK_MS = 2500
function markLock(key)  { lockTimestamps[key] = performance.now() }
function isLocked(key)  { return lockTimestamps[key] != null && performance.now() - lockTimestamps[key] < LOCK_MS }

function onPadMove(x, y, ax = 1, ay = 1) {
  const params = interpolate(x, y, ax, ay)
  // Strip out any params the user has locked
  const filtered = {}
  for (const k of Object.keys(params)) {
    if (!isLocked(k)) filtered[k] = params[k]
  }
  updateParams(filtered)
  for (const k of ['gain','reverbWet','reverbDecay','distortion','oscCount','oscDetune','filterFreq','filterQ']) {
    if (!isLocked(k)) setSliderUI(k, params[k])
  }
}

// — Gesture strips fire here; we update synth AND back-panel display —
function onEnvelopeChange(p) {
  setEnvelope(p)
  setSliderUI('attack',  p.attack)
  setSliderUI('decay',   p.decay)
  setSliderUI('sustain', p.sustain)
  setSliderUI('release', p.release)
}

function onFilterEnvChange(p) {
  setFilterEnvelope(p)
  setSliderUI('fAttack',  p.filterAttack)
  setSliderUI('fDecay',   p.filterDecay)
  setSliderUI('fSustain', p.filterSustain)
  setSliderUI('fRelease', p.filterRelease)
  setSliderUI('fBase',    p.filterBaseFreq)
  setSliderUI('fOctaves', p.filterOctaves)
}

// — Triangle modulation pad → LFO depths (rates stay user-controlled) —
function onTriangleChange(p) {
  setVibrato({ depth: p.vibratoDepth })
  setTremolo({ depth: p.tremoloDepth })
  setFilterLFO({ depth: p.filterDepth })
  setSliderUI('vibDepth', p.vibratoDepth)
  setSliderUI('trmDepth', p.tremoloDepth)
  setSliderUI('fltDepth', p.filterDepth)
}

// — Intensity circle → distortion + filter Q + extra reverb wet —
function onIntensityChange(p) {
  const intensity = p.intensity
  // Distortion ramps from 0 to 0.7
  const distortion = intensity * 0.7
  // Filter Q goes from current base up to +12 (tighter / squelchier)
  const filterQ = 1 + intensity * 12
  // Reverb wet adds a touch of bloom (up to +0.4 over the baseline)
  const reverbWet = Math.min(1, 0.05 + intensity * 0.5)
  updateParams({ distortion, filterQ, reverbWet })
  // Don't markLock — let the XY pad regain control after 2.5 s as usual
  setSliderUI('distortion', distortion)
  setSliderUI('filterQ',    filterQ)
  setSliderUI('reverbWet',  reverbWet)
}

// — Portamento knob (0..1 mapped to 0..1.5 s glide — pretty extreme at max) —
function onPortamentoChange(v) {
  setPortamento(v * 1.5)
}

// — Note display —

// Note display renders from activeMidis (defined below) using the chord's
// preferred spelling — so a Cm shows C / E♭ / G instead of C / D♯ / G.
function renderNoteDisplay() {
  const chordName = chordPanel?.getChord?.()?.name
  if (activeMidis.size === 0) {
    noteDisplay.textContent = '—'
    noteDisplay.classList.remove('playing')
    return
  }
  const sorted = [...activeMidis].sort((a, b) => a - b)
  noteDisplay.textContent = sorted.map(m => spellNoteMidi(m, chordName)).join('  ')
  noteDisplay.classList.add('playing')
}

// Stubs kept for backwards-compat — the actual rendering happens via
// renderNoteDisplay(), and activeMidis is the source of truth.
function showNote(_)  { renderNoteDisplay() }
function clearNote(_) { renderNoteDisplay() }

// — Keyboard input —

const activeKeys = new Set()

document.addEventListener('keydown', (e) => {
  if (e.repeat) return
  const key = e.key.toLowerCase()
  const note = KEY_NOTE_MAP[key]
  if (!note || activeKeys.has(key)) return

  activeKeys.add(key)
  noteOn(note)
  showNote(note)
  activeMidis.add(Tone.Frequency(note).toMidi())
  refreshChord()
})

document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase()
  const note = KEY_NOTE_MAP[key]
  if (!note || !activeKeys.has(key)) return

  activeKeys.delete(key)
  noteOff(note)
  clearNote(note)
  activeMidis.delete(Tone.Frequency(note).toMidi())
  refreshChord()
})

// — MIDI input —

const activeMidiNotes = new Map()

function handleMidiNoteOn(midiNote, velocity) {
  const noteName = Tone.Frequency(midiNote, 'midi').toNote()
  activeMidiNotes.set(midiNote, noteName)
  noteOn(noteName, velocity)
  showNote(noteName)
  activeMidis.add(midiNote)
  refreshChord()
}

function handleMidiNoteOff(midiNote) {
  const noteName = activeMidiNotes.get(midiNote)
  if (!noteName) return
  activeMidiNotes.delete(midiNote)
  noteOff(noteName)
  clearNote(noteName)
  activeMidis.delete(midiNote)
  refreshChord()
}

function populateDeviceSelector(inputs) {
  midiSelect.innerHTML = ''
  inputs.forEach(input => {
    const option = document.createElement('option')
    option.value = input.id
    option.textContent = input.name
    midiSelect.appendChild(option)
  })
}

function connectSelected(inputs) {
  const selected = inputs.find(i => i.id === midiSelect.value)
  if (selected) connectInput(selected)
}

midiSelect.addEventListener('change', async () => {
  const { getInputs } = await import('./midi/midi.js')
  const inputs = getInputs()
  connectSelected(inputs)
  const sel = inputs.find(i => i.id === midiSelect.value)
  if (sel) midiStatus.textContent = `connected: ${sel.name}`
})

async function setupMIDI() {
  const result = await initMIDI({
    noteOn: handleMidiNoteOn,
    noteOff: handleMidiNoteOff,
    devicesChange: (inputs) => {
      if (inputs.length === 0) {
        midiArea.hidden = true
        midiStatus.textContent = ''
        connectInput(null)
      } else {
        populateDeviceSelector(inputs)
        midiArea.hidden = inputs.length < 2
        connectSelected(inputs)
        const sel = inputs.find(i => i.id === midiSelect.value) || inputs[0]
        midiStatus.textContent = `connected: ${sel.name}`
      }
    },
  })

  if (!result.supported) {
    midiStatus.textContent = result.denied
      ? 'midi access denied — check site settings in chrome'
      : 'midi not available in this browser (use chrome)'
    return
  }

  const inputs = result.inputs
  if (inputs.length === 0) {
    midiStatus.textContent = ''
    return
  }

  populateDeviceSelector(inputs)
  midiArea.hidden = inputs.length < 2
  connectInput(inputs[0])
  midiStatus.textContent = `connected: ${inputs[0].name}`
}

// — Flip card —

flipBtn.addEventListener('click', () => mainCard.classList.toggle('flipped'))

// — Settings sliders (bidirectional with front controls) —

let envStrip  = null   // populated when synth screen mounts
let fenvStrip = null
let waveStrip = null
let triangleMod    = null
let intensityRing  = null
let portamentoKnob = null
let chordPanel     = null
let cofPanel       = null
let drumGrid       = null

// Active midi notes (combined keyboard + MIDI input). Used by the chord panel.
const activeMidis = new Set()
function refreshChord() {
  chordPanel?.updateNotes(activeMidis)
  cofPanel?.setChord(chordPanel?.getChord?.())
  renderNoteDisplay()   // chord context can change preferred enharmonic spelling
}

function wireSlider(key, apply, lockKey = null) {
  const s = sliders[key]
  if (!s || !s.el) return
  s.el.addEventListener('input', () => {
    const v = Number(s.el.value)
    s.valEl.textContent = s.fmt(v)
    if (lockKey) markLock(lockKey)
    apply(v)
  })
}

// Mix — XY-driven, so they get a lock-key matching the morpher key
wireSlider('gain',        v => updateParams({ gain: v }),         'gain')
wireSlider('reverbWet',   v => updateParams({ reverbWet: v }),    'reverbWet')
wireSlider('reverbDecay', v => updateParams({ reverbDecay: v }),  'reverbDecay')
wireSlider('distortion',  v => updateParams({ distortion: v }),   'distortion')

// Oscillator
wireSlider('oscCount',    v => updateParams({ oscCount: v }),   'oscCount')
wireSlider('oscDetune',   v => updateParams({ oscDetune: v }),  'oscDetune')

// Master filter
wireSlider('filterFreq',  v => updateParams({ filterFreq: v }), 'filterFreq')
wireSlider('filterQ',     v => updateParams({ filterQ: v }),    'filterQ')

// Amp envelope — also drive the envelope strip so it visually moves
wireSlider('attack',  v => { setEnvelope({ attack:  v }); envStrip?.setFromParams(getCurrentState().env) })
wireSlider('decay',   v => { setEnvelope({ decay:   v }); envStrip?.setFromParams(getCurrentState().env) })
wireSlider('sustain', v => { setEnvelope({ sustain: v }); envStrip?.setFromParams(getCurrentState().env) })
wireSlider('release', v => { setEnvelope({ release: v }); envStrip?.setFromParams(getCurrentState().env) })

// Filter envelope — also drive the filter strip
function fEnvCurrent() {
  const s = getCurrentState().fenv
  return {
    filterAttack:    s.attack,
    filterDecay:     s.decay,
    filterSustain:   s.sustain,
    filterRelease:   s.release,
    filterBaseFreq:  s.baseFrequency,
    filterOctaves:   s.octaves,
  }
}
wireSlider('fAttack',  v => { setFilterEnvelope({ filterAttack:    v }); fenvStrip?.setFromParams(fEnvCurrent()) })
wireSlider('fDecay',   v => { setFilterEnvelope({ filterDecay:     v }); fenvStrip?.setFromParams(fEnvCurrent()) })
wireSlider('fSustain', v => { setFilterEnvelope({ filterSustain:   v }); fenvStrip?.setFromParams(fEnvCurrent()) })
wireSlider('fRelease', v => { setFilterEnvelope({ filterRelease:   v }); fenvStrip?.setFromParams(fEnvCurrent()) })
wireSlider('fBase',    v => { setFilterEnvelope({ filterBaseFreq:  v }); fenvStrip?.setFromParams(fEnvCurrent()) })
wireSlider('fOctaves', v => { setFilterEnvelope({ filterOctaves:   v }); fenvStrip?.setFromParams(fEnvCurrent()) })

// Modulation (LFOs)
wireSlider('vibRate',  v => setVibrato({ rate:  v }))
wireSlider('vibDepth', v => setVibrato({ depth: v }))
wireSlider('trmRate',  v => setTremolo({ rate:  v }))
wireSlider('trmDepth', v => setTremolo({ depth: v }))
wireSlider('fltRate',  v => setFilterLFO({ rate:  v }))
wireSlider('fltDepth', v => setFilterLFO({ depth: v }))


// — Presets UI —

const presetSelect = $('preset-select')
const presetName   = $('preset-name')
const presetSave   = $('preset-save')
const presetDelete = $('preset-delete')

function captureCurrentPreset() {
  const data = {
    sliders: {}, envNodes: null, fenvNodes: null, waveNodes: null,
    triangle: null, intensity: null, portamento: null,
    drumPattern: null, drumBpm: null,
  }
  for (const k of Object.keys(sliders)) {
    data.sliders[k] = Number(sliders[k].el.value)
  }
  if (envStrip)       data.envNodes   = envStrip.getNodes()
  if (fenvStrip)      data.fenvNodes  = fenvStrip.getNodes()
  if (waveStrip)      data.waveNodes  = waveStrip.getNodes()
  if (triangleMod)    data.triangle   = triangleMod.getState()
  if (intensityRing)  data.intensity  = intensityRing.getState()
  if (portamentoKnob) data.portamento = portamentoKnob.getState()
  data.drumPattern = getPattern()
  data.drumBpm     = Math.round(getBPM())
  return data
}

function applyPreset(data) {
  if (!data) return
  // Sliders → audio (via their existing input handlers)
  if (data.sliders) {
    for (const [k, v] of Object.entries(data.sliders)) {
      const s = sliders[k]
      if (!s || !s.el) continue
      s.el.value = v
      // Dispatch input so the wired apply() runs (updates synth + UI)
      s.el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
  // Strips (these also call onChange which re-syncs the back panel sliders to the strip values)
  if (data.envNodes  && envStrip)  envStrip.setNodes(data.envNodes)
  if (data.fenvNodes && fenvStrip) fenvStrip.setNodes(data.fenvNodes)
  if (data.waveNodes && waveStrip) waveStrip.setNodes(data.waveNodes)
  // Creative controls
  if (data.triangle    && triangleMod)    triangleMod.setState(data.triangle)
  if (data.intensity   && intensityRing)  intensityRing.setState(data.intensity)
  if (data.portamento  && portamentoKnob) portamentoKnob.setState(data.portamento)
  // Drum machine
  if (data.drumPattern) {
    setPattern(data.drumPattern)
    drumGrid?.redraw()
  }
  if (typeof data.drumBpm === 'number') {
    setBPM(data.drumBpm)
    const bpmEl = $('drum-bpm'), bpmVal = $('drum-bpm-val')
    if (bpmEl)    bpmEl.value = String(data.drumBpm)
    if (bpmVal)   bpmVal.textContent = `${data.drumBpm}`
  }
}

function refreshPresetList() {
  const names = listPresets()
  const current = presetSelect.value
  presetSelect.innerHTML = '<option value="">— preset laden —</option>'
  names.forEach(n => {
    const o = document.createElement('option')
    o.value = n
    o.textContent = n
    presetSelect.appendChild(o)
  })
  if (names.includes(current)) presetSelect.value = current
}

presetSelect.addEventListener('change', () => {
  const name = presetSelect.value
  if (!name) return
  const data = readPreset(name)
  if (data) applyPreset(data)
  presetName.value = name
})

presetSave.addEventListener('click', () => {
  const name = (presetName.value || '').trim()
  if (!name) {
    presetName.focus()
    return
  }
  writePreset(name, captureCurrentPreset())
  refreshPresetList()
  presetSelect.value = name
})

presetDelete.addEventListener('click', () => {
  const name = presetSelect.value
  if (!name) return
  deletePreset(name)
  presetSelect.value = ''
  presetName.value = ''
  refreshPresetList()
})

// — Start —

startBtn.addEventListener('click', async () => {
  await startAudio()
  startScreen.hidden = true
  synthScreen.hidden = false

  createXYPad(xyContainer, onPadMove)
  onPadMove(0.5, 0.5, 1, 1)   // seed the synth + back-panel display
  waveStrip = createWaveformGesture(waveformContainer, setWaveform)
  envStrip  = createGestureEnvelope(envelopeContainer, onEnvelopeChange)
  fenvStrip = createFilterEnvelope(filterEnvelopeContainer, onFilterEnvChange)

  triangleMod    = createTriangleMod($('triangle-container'),    onTriangleChange)
  intensityRing  = createIntensityCircle($('intensity-container'), onIntensityChange)
  portamentoKnob = createKnob($('knob-portamento'),              'glide', 0, onPortamentoChange)
  chordPanel     = createChordPanel($('chord-panel'),            { octaves: 3 })
  cofPanel       = createCircleOfFifths($('cof-panel'))

  // Drum machine grid + transport controls
  drumGrid = createDrumGrid($('drum-grid-container'), {
    labels:     DRUM_TRACK_NAMES,
    steps:      16,
    onToggle:   (t, s, on) => setStep(t, s, on),
    getPattern: getPattern,
  })
  onStep(step => drumGrid.setCurrentStep(step))

  const drumPlay = $('drum-play')
  drumPlay.addEventListener('click', () => {
    if (isDrumPlaying()) {
      stopDrums()
      drumPlay.textContent = '▶'
      drumPlay.classList.remove('playing')
    } else {
      startDrums()
      drumPlay.textContent = '■'
      drumPlay.classList.add('playing')
    }
  })

  const drumBpm    = $('drum-bpm')
  const drumBpmVal = $('drum-bpm-val')
  drumBpm.value = String(Math.round(getBPM()))
  drumBpmVal.textContent = `${Math.round(getBPM())}`
  drumBpm.addEventListener('input', () => {
    const v = Number(drumBpm.value)
    setBPM(v)
    drumBpmVal.textContent = `${v}`
  })

  const drumVol    = $('drum-vol')
  const drumVolVal = $('drum-vol-val')
  drumVol.addEventListener('input', () => {
    const v = Number(drumVol.value)
    setDrumVolume(v)
    drumVolVal.textContent = `${v}`
  })

  $('drum-clear').addEventListener('click', () => {
    clearPattern()
    drumGrid.redraw()
  })

  // Collapse buttons sit to the left of each row, vertically centred.
  document.querySelectorAll('.row-collapse-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const wrap = btn.parentElement
      wrap.classList.toggle('panel-collapsed')
      btn.textContent = wrap.classList.contains('panel-collapsed') ? '+' : '−'

      // When the main synth card is collapsed, hide the flip button too —
      // there's nothing to flip while it's folded away.
      if (wrap.dataset.collapseId === 'main') {
        const flipBtnEl = document.getElementById('flip-btn')
        if (flipBtnEl) flipBtnEl.style.display = wrap.classList.contains('panel-collapsed') ? 'none' : ''
      }
    })
  })

  // Octave toggle buttons (1 / 2 / 3 octaves)
  document.querySelectorAll('#chord-octave-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = Number(btn.dataset.oct)
      chordPanel.setOctaves(n)
      document.querySelectorAll('#chord-octave-toggle button').forEach(b => b.classList.toggle('active', b === btn))
    })
  })

  // Key selector for the COF
  const cofKeySel = $('cof-key')
  cofKeySel.addEventListener('change', () => {
    const v = cofKeySel.value
    if (!v) { cofPanel.clearKey(); return }
    const m = v.match(/^(\d+)(maj|min)$/)
    if (m) cofPanel.setKey(Number(m[1]), m[2] === 'min' ? 'minor' : 'major')
  })

  refreshPresetList()

  await setupMIDI()
})
