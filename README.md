# Canvas Synth

Een experimentele web-based synthesizer met expressieve, gesture-gedreven controls. Speel met je toetsenbord (A-K) of een MIDI-keyboard, en bewerk het geluid via interactieve canvas-elementen.

![Canvas Synth](https://img.shields.io/badge/audio-Tone.js%20v14-blue) ![Vite](https://img.shields.io/badge/build-Vite-yellow)

## Wat is het

Een browser-instrument gebouwd op **Tone.js** (PolySynth + MonoSynth-voices) met een unieke front-end: in plaats van klassieke knopjes en sliders zijn de meeste controls **canvas-gestures** — bezier-curves voor envelopes, een driehoek-pad voor modulatie-morphing, een groeiende cirkel voor intensiteit.

## Features

### Voorkant: creative controls
- **XY-pad** — Morph tussen 4 hoek-presets (warm / glasachtig / donker / agressief) door een bolletje te slepen. De pad heeft *axis-sliders* (-1..+1) langs de assen waarmee je elke as los kunt schalen of zelfs inverteren.
- **Envelope strip** — Teken je amp-ADSR door 5 bezier-nodes te slepen. 4 presets (stab / pluck / lead / pad).
- **Filter envelope strip** — Idem voor de per-stem filter-cutoff envelope, met base + octaves. 4 presets (drop / open / sweep / closed).
- **Wave strip** — Vrij-tekenbare oscillator-waveform via 5 control-nodes. DFT berekent 16 harmonische partials live. 3 presets (sine / triangle / saw).
- **Modulatie-driehoek** — 3 hoek-stemmingen (kalm / warble / shake) voor de drie LFOs (vibrato / tremolo / filter-wobble). Sleep het bolletje voor barycentrische interpolatie.
- **Intensiteitscirkel** — Sleep vanaf het midden naar buiten om gelijktijdig distortion, filter-Q en reverb-wet op te schalen. Cirkel pulst RMS-gedreven mee met het geluid.
- **Portamento-knob** — Klassieke rotary knob voor pitch-glide tussen noten.
- **Akkoord-paneel** — Live akkoord-herkenning (19 chord patterns) + schematisch pianoklavier met kleurgecodeerde extensie-suggesties (groen = consonant, oranje = spannend, rood = clashend). Schakelbaar tussen 1 / 2 / 3 octaven.

### Achterkant: alle instellingen + presets
Flip-card naar de achterkant voor numerieke controle over **alle 24 parameters** (mix / oscillator / filter / amp-env / filter-env / modulation). Wijzigingen aan de voorkant updaten live de schuiven op de achterkant en vice versa.

Met een preset-balkje kun je opstellingen opslaan in `localStorage`.

### Onder de motorkap
- **Tone.js PolySynth** wrapped around MonoSynth voices (64-stems polyfonie)
- **AutoFilter** voor de master filter met geïntegreerde LFO (filter-wobble)
- **Tone.Vibrato + Tone.Tremolo** voor pitch- en volume-modulatie
- Web Audio API analyser side-chained voor de oscilloscope in het XY-pad

## Lokaal draaien

```bash
npm install
npm run dev
```

Open de URL die Vite geeft (meestal `http://localhost:5173`). Klik op **Start** (vereist een user-gesture om de audio context te starten in de browser).

## Toetsen

- **A S D F G H J K** → C4 D4 E4 F4 G4 A4 B4 C5
- Of sluit een MIDI-keyboard aan — Web MIDI in Chrome / Edge

## Stack

- **Vite** — dev server + build
- **Tone.js v14** — audio engine
- **Canvas 2D** — alle creative controls
- Geen UI-framework, pure vanilla JS

## Bedankt

Gebouwd in collaboratie met Claude (Anthropic) via Claude Code.
