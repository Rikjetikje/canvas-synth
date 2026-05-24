import * as Tone from 'tone'

const masterGain    = new Tone.Gain(0.5).toDestination()
const analyser      = new Tone.Analyser('waveform', 256)
const reverb        = new Tone.Reverb({ decay: 2.5, wet: 0.14 })
const distortionFx  = new Tone.Distortion({ distortion: 0.5, wet: 0 })
// AutoFilter = a Tone.Filter with a built-in LFO for cutoff modulation.
// depth=0 → no wobble. We set baseFrequency directly (no rampTo needed).
const masterFilter  = new Tone.AutoFilter({
  frequency:     2,         // LFO rate (Hz)
  baseFrequency: 700,       // filter cutoff at rest
  octaves:       2.6,       // wobble range in octaves above base
  depth:         0,         // wobble intensity (0 = off)
  type:          'sine',
  filter:        { type: 'lowpass', Q: 1 },
})

const synth = new Tone.PolySynth(Tone.MonoSynth, {
  oscillator: { type: 'fatsine', count: 1, spread: 0, phase: 0 },
  envelope: { attack: 0.3, decay: 0.2, sustain: 0.9, release: 1.2 },
  filterEnvelope: {
    attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.5,
    baseFrequency: 200, octaves: 2,
  },
})
synth.maxPolyphony = 64        // raise from default so long-release notes don't starve new ones
synth.volume.value = -14

// — Inline modulation effects (vibrato + tremolo). Filter wobble lives inside
// the AutoFilter above. start() is deferred to startAudio() so the audio context
// is running first.
const vibrato = new Tone.Vibrato({ frequency: 5, depth: 0 })
const tremolo = new Tone.Tremolo({ frequency: 6, depth: 0 })

const lfoState = {
  vibrato:  { rate: 5, depth: 0 },
  tremolo:  { rate: 6, depth: 0 },
  filter:   { rate: 2, depth: 0 },
}

synth.connect(distortionFx)
distortionFx.connect(masterFilter)
masterFilter.connect(vibrato)
vibrato.connect(tremolo)
tremolo.connect(reverb)
reverb.connect(masterGain)
masterGain.connect(analyser)

const oscState = { type: 'fatsine', count: 1, spread: 0 }
let wavePartials = null   // null = gebruik ingebouwd golftype; anders: custom array

// — Cached current parameter values so partial updates merge cleanly —
const envState = {
  attack: 0.3, decay: 0.2, sustain: 0.9, release: 1.2,
  attackCurve: null,
}
const fenvState = {
  attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.5,
  baseFrequency: 200, octaves: 2,
}
const masterState = {
  filterFreq: 700, filterQ: 1, reverbWet: 0.14, distortion: 0, gain: -10,
  reverbDecay: 2.5,
}

export function getCurrentState() {
  return {
    env: { ...envState },
    fenv: { ...fenvState },
    osc: { count: oscState.count, spread: oscState.spread },
    master: { ...masterState },
    lfo: {
      vibrato: { ...lfoState.vibrato },
      tremolo: { ...lfoState.tremolo },
      filter:  { ...lfoState.filter  },
    },
  }
}

export function setVibrato({ rate, depth }) {
  if (rate  !== undefined) { lfoState.vibrato.rate  = rate;  vibrato.frequency.value = rate }
  if (depth !== undefined) { lfoState.vibrato.depth = depth; vibrato.depth.value     = depth }
}
export function setTremolo({ rate, depth }) {
  if (rate  !== undefined) { lfoState.tremolo.rate  = rate;  tremolo.frequency.value = rate }
  if (depth !== undefined) { lfoState.tremolo.depth = depth; tremolo.depth.value     = depth }
}
export function setFilterLFO({ rate, depth }) {
  if (rate  !== undefined) { lfoState.filter.rate  = rate;  masterFilter.frequency.value = rate }
  if (depth !== undefined) { lfoState.filter.depth = depth; masterFilter.depth.value     = depth }
}

// Portamento (note glide). 0 = no glide, up to ~0.5s glide.
let portamentoState = 0
export function setPortamento(seconds) {
  portamentoState = Math.max(0, seconds)
  synth.set({ portamento: portamentoState })
}
export function getPortamento() { return portamentoState }

function applyOscillator() {
  // phase: 0 locks the FatOscillator's internal oscillators to a deterministic
  // starting phase so identical notes sound identical (no random spread-phase).
  const cfg = wavePartials
    ? { ...oscState, phase: 0, partials: wavePartials }
    : { ...oscState, phase: 0 }
  synth.set({ oscillator: cfg })
}

export function getWaveformData() {
  return analyser.getValue()
}

export async function startAudio() {
  await Tone.start()
  Tone.getContext().lookAhead = 0.01
  tremolo.start()
  masterFilter.start()        // start the AutoFilter's internal LFO
  await reverb.generate()
}

export function noteOn(note, velocity = 1) {
  // Force any in-flight release for this exact note to end now, so the
  // PolySynth allocates a fresh voice (or cleanly retriggers) instead of
  // tripping over a voice still in its release tail.
  const t = Tone.now()
  synth.triggerRelease(note, t)
  synth.triggerAttack(note, t + 0.003, velocity)
}

export function noteOff(note) {
  synth.triggerRelease(note, Tone.now())
}

export function setVolume(db) {
  masterGain.gain.rampTo(Tone.dbToGain(db), 0.05)
}

export function setReverbDecay(seconds) {
  reverb.decay = seconds
  reverb.generate()
}

export function setOscCount(count) {
  oscState.count = count
  applyOscillator()
}

export function setOscDetune(spread) {
  oscState.spread = spread
  applyOscillator()
}

export function setEnvelope(params) {
  if (params.attack       !== undefined) envState.attack       = params.attack
  if (params.decay        !== undefined) envState.decay        = params.decay
  if (params.sustain      !== undefined) envState.sustain      = params.sustain
  if (params.release      !== undefined) envState.release      = params.release
  if (params.attackCurve  !== undefined) envState.attackCurve  = params.attackCurve
  synth.set({
    envelope: {
      attack:  envState.attack,
      decay:   envState.decay,
      sustain: envState.sustain,
      release: envState.release,
      attackCurve:  Array.isArray(envState.attackCurve) && envState.attackCurve.length >= 2
        ? envState.attackCurve : 'linear',
      decayCurve:   'exponential',
      releaseCurve: 'exponential',
    },
  })
}

export function setOscType(type) {
  oscState.type = type
  wavePartials = null   // preset-type wist custom wave
  applyOscillator()
}

export function setWaveform({ partials }) {
  wavePartials = partials
  applyOscillator()
}

export function setFilterEnvelope(params) {
  if (params.filterAttack    !== undefined) fenvState.attack        = params.filterAttack
  if (params.filterDecay     !== undefined) fenvState.decay         = params.filterDecay
  if (params.filterSustain   !== undefined) fenvState.sustain       = params.filterSustain
  if (params.filterRelease   !== undefined) fenvState.release       = params.filterRelease
  if (params.filterBaseFreq  !== undefined) fenvState.baseFrequency = params.filterBaseFreq
  if (params.filterOctaves   !== undefined) fenvState.octaves       = params.filterOctaves
  synth.set({ filterEnvelope: { ...fenvState } })
}

let reverbDecayTimer = null
function scheduleReverbGenerate() {
  // Debounce — wait until movement stops so we don't recompute the impulse
  // response (audio-thread-blocking) while the user is still dragging.
  if (reverbDecayTimer) clearTimeout(reverbDecayTimer)
  reverbDecayTimer = setTimeout(() => {
    reverb.generate()
    reverbDecayTimer = null
  }, 350)
}

export function updateParams(params) {
  if (params.filterFreq !== undefined) {
    masterState.filterFreq = params.filterFreq
    masterFilter.baseFrequency = params.filterFreq     // AutoFilter: getter/setter, no rampTo
  }
  if (params.filterQ !== undefined) {
    masterState.filterQ = params.filterQ
    masterFilter.filter.Q.rampTo(params.filterQ, 0.05) // underlying Filter is at .filter
  }
  if (params.reverbWet !== undefined) {
    masterState.reverbWet = params.reverbWet
    reverb.wet.rampTo(params.reverbWet, 0.05)
  }
  if (params.distortion !== undefined) {
    masterState.distortion = params.distortion
    distortionFx.wet.rampTo(params.distortion, 0.05)
  }
  if (params.gain !== undefined) {
    masterState.gain = params.gain
    masterGain.gain.rampTo(Tone.dbToGain(params.gain), 0.05)
  }
  if (params.oscDetune !== undefined && Math.abs(oscState.spread - params.oscDetune) > 0.5) {
    oscState.spread = params.oscDetune
    applyOscillator()
  }
  if (params.oscCount !== undefined) {
    const rounded = Math.max(1, Math.min(4, Math.round(params.oscCount)))
    if (oscState.count !== rounded) {
      oscState.count = rounded
      applyOscillator()
    }
  }
  if (params.reverbDecay !== undefined && Math.abs(reverb.decay - params.reverbDecay) > 0.05) {
    masterState.reverbDecay = params.reverbDecay
    reverb.decay = params.reverbDecay
    scheduleReverbGenerate()
  }
}
