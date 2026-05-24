import * as Tone from 'tone'

// — Drum machine: 6 synthesized drum voices + 16-step sequencer on Tone.Transport —
//
// Voices are made entirely with Tone.MembraneSynth (kicks/toms) and
// Tone.NoiseSynth (snares/hats/clap) so we don't need to load audio samples.

const TRACKS = 6
const STEPS  = 16

// Shared output bus for all drum sounds. Starts a few dB under unity so the
// drums sit alongside the synth without dominating it. The drum-volume
// slider in the UI can push this up or down (see setDrumVolume).
const drumBus = new Tone.Gain(Tone.dbToGain(-9)).toDestination()

// — Voice 0: Kick —
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.04,
  octaves: 6,
  oscillator: { type: 'sine' },
  envelope:   { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4, attackCurve: 'exponential' },
}).connect(drumBus)

// — Voice 1: Snare — body + filtered noise burst
const snareFilter = new Tone.Filter({ frequency: 1700, type: 'bandpass', Q: 0.7 }).connect(drumBus)
const snareNoise  = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.03 },
  volume: -8,
}).connect(snareFilter)
const snareBody = new Tone.MembraneSynth({
  pitchDecay: 0.005,
  octaves: 3,
  envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  volume: -16,
}).connect(drumBus)

// — Voice 2: Hi-hat closed — high-pass noise, very short
const hhcFilter = new Tone.Filter({ frequency: 8500, type: 'highpass' }).connect(drumBus)
const hhc = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.03 },
  volume: -16,
}).connect(hhcFilter)

// — Voice 3: Hi-hat open — high-pass noise, longer decay
const hhoFilter = new Tone.Filter({ frequency: 7000, type: 'highpass' }).connect(drumBus)
const hho = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.18 },
  volume: -18,
}).connect(hhoFilter)

// — Voice 4: Clap — multi-hit noise burst gives that signature "spread"
const clapFilter = new Tone.Filter({ frequency: 1400, type: 'bandpass', Q: 0.6 }).connect(drumBus)
const clap = new Tone.NoiseSynth({
  noise: { type: 'pink' },
  envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
  volume: -10,
}).connect(clapFilter)

// — Voice 5: Tom — pitched membrane, mid-low
const tom = new Tone.MembraneSynth({
  pitchDecay: 0.08,
  octaves: 3,
  envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.4 },
  volume: -4,
}).connect(drumBus)

const VOICES = [
  { name: 'kick',  trigger: (t, v) => kick.triggerAttackRelease('C1', '8n', t, v) },
  { name: 'snare', trigger: (t, v) => {
      snareNoise.triggerAttackRelease('16n', t, v)
      snareBody.triggerAttackRelease('G2', '32n', t, v * 0.6)
    } },
  { name: 'hhc',   trigger: (t, v) => hhc.triggerAttackRelease('32n', t, v) },
  { name: 'hho',   trigger: (t, v) => hho.triggerAttackRelease('8n',  t, v) },
  { name: 'clap',  trigger: (t, v) => {
      // 3 quick noise hits → "clap spread"
      clap.triggerAttackRelease('16n', t,         v)
      clap.triggerAttackRelease('16n', t + 0.012, v * 0.85)
      clap.triggerAttackRelease('16n', t + 0.024, v * 0.7)
    } },
  { name: 'tom',   trigger: (t, v) => tom.triggerAttackRelease('E2', '8n', t, v) },
]

export const DRUM_TRACK_NAMES = VOICES.map(v => v.name)
export const DRUM_TRACK_COUNT = TRACKS
export const DRUM_STEP_COUNT  = STEPS

// Pattern: 6 tracks × 16 steps booleans (true = step active)
let pattern = Array.from({ length: TRACKS }, () => new Array(STEPS).fill(false))
let currentStep = -1
let onStepCb = null
let isPlaying = false

const sequence = new Tone.Sequence((time, step) => {
  for (let t = 0; t < TRACKS; t++) {
    if (pattern[t][step]) VOICES[t].trigger(time, 0.9)
  }
  // Schedule the UI step-indicator update on the correct paint frame
  Tone.Draw.schedule(() => {
    currentStep = step
    if (onStepCb) onStepCb(step)
  }, time)
}, [...Array(STEPS).keys()], '16n')

export function startDrums() {
  if (isPlaying) return
  Tone.Transport.start()
  sequence.start(0)
  isPlaying = true
}

export function stopDrums() {
  if (!isPlaying) return
  sequence.stop(0)
  Tone.Transport.stop()
  Tone.Transport.position = 0   // rewind
  currentStep = -1
  if (onStepCb) onStepCb(-1)
  isPlaying = false
}

export function isDrumPlaying() { return isPlaying }

export function setBPM(bpm) {
  Tone.Transport.bpm.value = Math.max(40, Math.min(220, bpm))
}
export function getBPM() { return Tone.Transport.bpm.value }

export function toggleStep(track, step) {
  if (track < 0 || track >= TRACKS || step < 0 || step >= STEPS) return
  pattern[track][step] = !pattern[track][step]
}
export function setStep(track, step, on) {
  if (track < 0 || track >= TRACKS || step < 0 || step >= STEPS) return
  pattern[track][step] = !!on
}
export function getPattern() {
  return pattern.map(row => [...row])
}
export function setPattern(newPattern) {
  if (!Array.isArray(newPattern)) return
  for (let t = 0; t < TRACKS; t++) {
    for (let s = 0; s < STEPS; s++) {
      pattern[t][s] = !!(newPattern[t] && newPattern[t][s])
    }
  }
}
export function clearPattern() {
  for (let t = 0; t < TRACKS; t++) pattern[t].fill(false)
}

export function onStep(cb) { onStepCb = cb }
export function getCurrentStep() { return currentStep }

export function setDrumVolume(db) {
  drumBus.gain.rampTo(Tone.dbToGain(db), 0.05)
}
