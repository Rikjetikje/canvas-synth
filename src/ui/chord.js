// — Chord panel —
// Recognises the currently played chord (from a set of midi note numbers)
// and renders a schematic piano keyboard. Inactive keys are tinted with a
// gradient from green (consonant extension) to red (clashing) based on how
// each pitch class would relate to the current chord.

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLAT_NAMES  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

// Context-aware note spelling. Minor / diminished chords use flats (the
// minor third is ♭3, not #2 — Cm has E♭, not D♯). Otherwise we default to
// sharp names. The regex uses a negative lookahead so "maj" / "M7" don't
// trigger the minor branch despite starting with 'm'.
export function spellPc(pc, chordName) {
  const useFlats = chordName ? (/^m(?!aj)/.test(chordName) || /^dim/.test(chordName)) : false
  return (useFlats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12]
}

export function spellNoteMidi(midi, chordName) {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return spellPc(pc, chordName) + octave
}

const NOTE_NAMES = SHARP_NAMES   // legacy fallback for callers that don't pass a chord

// Chord patterns: intervals (in semitones) from the root.
// "maj" is used explicitly for the plain major triad so the label clearly
// distinguishes a single-note "C" from a recognised "Cmaj" chord.
// More specific (longer) patterns are listed FIRST so they win over the
// subset-fallback when an exact match is possible.
const CHORDS = [
  // Triads
  { name: 'maj',     intervals: [0, 4, 7] },
  { name: 'm',       intervals: [0, 3, 7] },
  { name: 'dim',     intervals: [0, 3, 6] },
  { name: 'aug',     intervals: [0, 4, 8] },
  { name: 'sus2',    intervals: [0, 2, 7] },
  { name: 'sus4',    intervals: [0, 5, 7] },
  { name: '5',       intervals: [0, 7] },

  // Sixths
  { name: '6',       intervals: [0, 4, 7, 9] },
  { name: 'm6',      intervals: [0, 3, 7, 9] },

  // Sevenths (basic)
  { name: 'M7',      intervals: [0, 4, 7, 11] },
  { name: 'm7',      intervals: [0, 3, 7, 10] },
  { name: '7',       intervals: [0, 4, 7, 10] },
  { name: 'dim7',    intervals: [0, 3, 6, 9] },
  { name: 'm7♭5',    intervals: [0, 3, 6, 10] },

  // Sevenths (extended)
  { name: 'm(maj7)', intervals: [0, 3, 7, 11] },     // minor-major 7, jazz/film
  { name: '7sus4',   intervals: [0, 5, 7, 10] },     // dominant suspended
  { name: '7♭5',     intervals: [0, 4, 6, 10] },     // jazz dominant flat-five
  { name: '7♯5',     intervals: [0, 4, 8, 10] },     // augmented dominant
  { name: 'M7♭5',    intervals: [0, 4, 6, 11] },
  { name: 'M7♯5',    intervals: [0, 4, 8, 11] },     // augmented major 7

  // Adds
  { name: 'add9',    intervals: [0, 2, 4, 7] },
  { name: 'madd9',   intervals: [0, 2, 3, 7] },
  { name: 'sus2sus4',intervals: [0, 2, 5, 7] },      // both suspensions / open voicing

  // Sixth/Ninths
  { name: '6/9',     intervals: [0, 2, 4, 7, 9] },
  { name: 'm6/9',    intervals: [0, 2, 3, 7, 9] },

  // Ninths
  { name: 'M9',      intervals: [0, 2, 4, 7, 11] },
  { name: 'm9',      intervals: [0, 2, 3, 7, 10] },
  { name: '9',       intervals: [0, 2, 4, 7, 10] },
  { name: '9sus4',   intervals: [0, 2, 5, 7, 10] },  // also voicing for 11
  { name: '7♭9',     intervals: [0, 1, 4, 7, 10] },  // altered dominant
  { name: '7♯9',     intervals: [0, 3, 4, 7, 10] },  // hendrix chord
  { name: 'm(maj9)', intervals: [0, 2, 3, 7, 11] },

  // Quartal voicings (stacks of 4ths) — modern jazz
  { name: 'quartal', intervals: [0, 5, 10] },
]

// Interval consonance scores. 0 = totally consonant, 1 = harshly dissonant.
const INTERVAL_SCORE = [
  0,    // 0  — unison (treated as duplicate, skipped)
  0.95, // 1  — m2
  0.55, // 2  — M2 (also serves as 9th, often a colour tone)
  0.15, // 3  — m3
  0.10, // 4  — M3
  0.20, // 5  — P4
  0.85, // 6  — tritone
  0.05, // 7  — P5
  0.15, // 8  — m6
  0.20, // 9  — M6
  0.35, // 10 — m7
  0.45, // 11 — M7
]

function sortedEq(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export function recognizeChord(pitchClasses) {
  const pcs = [...new Set(pitchClasses)].sort((a, b) => a - b)
  if (pcs.length === 0) return null
  if (pcs.length === 1) return { root: pcs[0], name: '', symbol: spellPc(pcs[0], '') }

  // Exact match (any rotation as root)
  for (const root of pcs) {
    const intervals = pcs.map(p => ((p - root) % 12 + 12) % 12).sort((a, b) => a - b)
    for (const c of CHORDS) {
      const sortedC = [...c.intervals].sort((a, b) => a - b)
      if (sortedEq(intervals, sortedC)) {
        return { root, name: c.name, symbol: spellPc(root, c.name) + c.name }
      }
    }
  }

  // Subset match — played notes are part of some chord
  let bestPartial = null
  for (const root of pcs) {
    const intervalSet = new Set(pcs.map(p => ((p - root) % 12 + 12) % 12))
    for (const c of CHORDS) {
      if ([...intervalSet].every(i => c.intervals.includes(i))) {
        if (!bestPartial || c.intervals.length < bestPartial.chord.intervals.length) {
          bestPartial = { root, chord: c }
        }
      }
    }
  }
  if (bestPartial) {
    return {
      root: bestPartial.root,
      name: bestPartial.chord.name,
      symbol: spellPc(bestPartial.root, bestPartial.chord.name) + bestPartial.chord.name + '…',
    }
  }

  // Unknown — list the notes (sharp default since no chord context)
  return { root: pcs[0], name: '?', symbol: pcs.map(p => SHARP_NAMES[p]).join(' ') }
}

// Check whether a set of pitch classes (any rotation) matches one of the
// known chord patterns above. Used to detect "logical extensions".
function formsKnownChord(pcSet) {
  const sorted = [...pcSet].sort((a, b) => a - b)
  for (const root of sorted) {
    const intervals = sorted.map(p => ((p - root) % 12 + 12) % 12).sort((a, b) => a - b)
    for (const c of CHORDS) {
      const sortedC = [...c.intervals].sort((a, b) => a - b)
      if (sortedEq(intervals, sortedC)) return true
    }
  }
  return false
}

// For each of the 12 pitch classes that's NOT currently active, return a
// score [0..1] indicating how clashing/strange it'd sound as an addition.
// 0 = consonant chord-tone extension (green); 1 = harshly dissonant (red).
// Active pitch classes return null.
export function suggestionScores(activePcs) {
  const out = new Array(12).fill(0)
  if (activePcs.size === 0) {
    for (let p = 0; p < 12; p++) out[p] = null
    return out
  }
  for (let p = 0; p < 12; p++) {
    if (activePcs.has(p)) { out[p] = null; continue }

    // 1. If adding this pitch forms a recognised chord (M, m, 7, M7, add9, …),
    //    treat it as a logical extension — strong green.
    const candidateSet = new Set([...activePcs, p])
    if (formsKnownChord(candidateSet)) {
      out[p] = 0.10
      continue
    }

    // 2. Otherwise grade by average pairwise dissonance against active notes,
    //    biased toward orange/red since it's not a chord tone.
    let total = 0
    for (const a of activePcs) {
      const i = ((p - a) % 12 + 12) % 12
      total += INTERVAL_SCORE[i]
    }
    const avg = total / activePcs.size
    out[p] = Math.min(1, 0.45 + avg * 0.7)
  }
  return out
}

function colorForScore(score) {
  // hue 120 (green) at score=0 → 0 (red) at score=1
  const clamped = Math.min(1, Math.max(0, score))
  const hue = 120 * (1 - Math.pow(clamped, 0.7))   // bias toward saturated reds at high diss
  const alpha = 0.18 + 0.45 * clamped
  return `hsla(${hue.toFixed(0)}, 75%, 50%, ${alpha.toFixed(2)})`
}

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]      // C D E F G A B
const BLACK_AFTER = [                          // { whiteIdx within octave, pc }
  { afterWhite: 0, pc: 1 },                    // C♯ between C and D
  { afterWhite: 1, pc: 3 },                    // D♯
  { afterWhite: 3, pc: 6 },                    // F♯
  { afterWhite: 4, pc: 8 },                    // G♯
  { afterWhite: 5, pc: 10 },                   // A♯
]

export function createChordPanel(container, opts = {}) {
  let octaves = opts.octaves ?? 3
  // Visible range:
  //   1 oct → C4..B4 (the keyboard A..K range)
  //   2 oct → C4..B5 (keyboard + extensions above)
  //   3 oct → C3..B5 (octave below + keyboard + above)
  function startMidi() {
    return octaves === 3 ? 48 : 60
  }

  const canvas = document.createElement('canvas')
  container.appendChild(canvas)

  let activeMidis = new Set()
  let chord = null
  let scores = new Array(12).fill(null)

  function recompute() {
    const pcs = new Set([...activeMidis].map(m => ((m % 12) + 12) % 12))
    chord  = recognizeChord([...pcs])
    scores = suggestionScores(pcs)
  }

  // — Drawing helpers (with gradient styling matching the gesture strips) —

  function drawChordLabel(ctx, w, labelH) {
    // Subtle vignette under the text for depth
    const bg = ctx.createLinearGradient(0, 0, 0, labelH)
    bg.addColorStop(0, 'rgba(255,255,255,0.02)')
    bg.addColorStop(1, 'rgba(0,0,0,0.0)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, labelH)

    ctx.fillStyle = chord ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.22)'
    const fs = Math.max(12, Math.round(labelH * 0.65))
    ctx.font = `${fs}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(chord ? chord.symbol : '—', w / 2, labelH / 2)
  }

  function suggestionGlow(ctx, cx, cy, halfW, halfH, score) {
    // Radial gradient centred on the key, fading to the edges.
    // hue 120 (green) at score=0 → 0 (red) at score=1
    const clamped = Math.min(1, Math.max(0, score))
    const hue = 120 * (1 - Math.pow(clamped, 0.7))
    const peakA  = 0.20 + 0.55 * clamped
    const edgeA  = 0.04 + 0.12 * clamped
    const r = Math.max(halfW, halfH) * 1.1
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0,    `hsla(${hue.toFixed(0)}, 80%, 55%, ${peakA.toFixed(2)})`)
    g.addColorStop(0.55, `hsla(${hue.toFixed(0)}, 80%, 50%, ${(peakA * 0.5).toFixed(2)})`)
    g.addColorStop(1,    `hsla(${hue.toFixed(0)}, 80%, 45%, ${edgeA.toFixed(2)})`)
    return g
  }

  function whiteKeyBaseGradient(ctx, x, y, w, h) {
    // Dark stealth-look base — white keys are dark grey at rest.
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0,    'rgba(45,45,52,1)')      // subtle highlight top
    g.addColorStop(0.06, 'rgba(28,28,34,1)')
    g.addColorStop(1,    'rgba(8,8,12,1)')        // dark bottom
    return g
  }

  function blackKeyBaseGradient(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0,    'rgba(18,18,24,1)')
    g.addColorStop(0.10, 'rgba(8,8,12,1)')
    g.addColorStop(1,    'rgba(2,2,4,1)')
    return g
  }

  function activeKeyGradient(ctx, x, y, w, h, isBlack) {
    // Bright white glow on top of the dark base — pops because of contrast.
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0,    'rgba(255,255,255,0.95)')
    g.addColorStop(0.4,  'rgba(245,245,255,0.7)')
    g.addColorStop(1,    isBlack ? 'rgba(220,225,240,0.55)' : 'rgba(235,235,245,0.5)')
    return g
  }

  function octaveShiftedGradient(ctx, x, y, w, h, isBlack) {
    // Dim "off-white" — pitch class is active but at a different octave.
    // Same hue as active, much lower alpha.
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0,    'rgba(255,255,255,0.32)')
    g.addColorStop(0.5,  'rgba(245,245,255,0.18)')
    g.addColorStop(1,    isBlack ? 'rgba(220,225,240,0.10)' : 'rgba(230,230,240,0.08)')
    return g
  }

  function drawPiano(ctx, w, pianoTop, pianoH) {
    const startM = startMidi()
    const totalWhites = octaves * 7
    const hasActive = activeMidis.size > 0
    // Constant key aspect (width / pianoHeight). The panel ITSELF grows
    // taller at lower octave counts (via CSS based on data-octaves), so
    // the keys scale up in BOTH dimensions — a real zoom rather than just
    // wider rectangles.
    const KEY_ASPECT = 0.50
    const desiredKeyW = pianoH * KEY_ASPECT
    const naturalKeyW = w / totalWhites
    const wKeyW = Math.min(desiredKeyW, naturalKeyW)
    const totalKbW = wKeyW * totalWhites
    const startX = (w - totalKbW) / 2
    const bKeyW = wKeyW * 0.62
    const bKeyH = pianoH * 0.64

    // Subtle ambient background under the keyboard
    const ambient = ctx.createLinearGradient(0, pianoTop, 0, pianoTop + pianoH)
    ambient.addColorStop(0, 'rgba(255,255,255,0.025)')
    ambient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = ambient
    ctx.fillRect(0, pianoTop, w, pianoH)

    // White keys first
    let whiteIdx = 0
    for (let oct = 0; oct < octaves; oct++) {
      for (let i = 0; i < 7; i++) {
        const pc = WHITE_PCS[i]
        const midi = startM + oct * 12 + pc
        const x = startX + whiteIdx * wKeyW
        const innerX = x + 1
        const innerY = pianoTop + 1
        const innerW = wKeyW - 2
        const innerH = pianoH - 2

        // Base — vertical gradient
        ctx.fillStyle = whiteKeyBaseGradient(ctx, innerX, innerY, innerW, innerH)
        ctx.fillRect(innerX, innerY, innerW, innerH)

        // Either a suggestion glow (pc is inactive) or an off-white
        // octave-shifted glow (pc is active elsewhere but not at this midi).
        if (scores[pc] != null) {
          ctx.fillStyle = suggestionGlow(ctx,
            innerX + innerW / 2, innerY + innerH * 0.55,
            innerW / 2, innerH / 2,
            scores[pc])
          ctx.fillRect(innerX, innerY, innerW, innerH)
        } else if (hasActive && !activeMidis.has(midi)) {
          ctx.fillStyle = octaveShiftedGradient(ctx, innerX, innerY, innerW, innerH, false)
          ctx.fillRect(innerX, innerY, innerW, innerH)
        }

        // Active glow (only for the exact midi note that's being played)
        if (activeMidis.has(midi)) {
          ctx.fillStyle = activeKeyGradient(ctx, innerX, innerY, innerW, innerH, false)
          ctx.fillRect(innerX, innerY, innerW, innerH)
        }

        // Thin separator (dark line on the right edge)
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(x + wKeyW - 1, pianoTop, 1, pianoH)

        whiteIdx++
      }
    }

    // Black keys on top
    for (let oct = 0; oct < octaves; oct++) {
      for (const b of BLACK_AFTER) {
        const pc = b.pc
        const midi = startM + oct * 12 + pc
        const whiteRightX = startX + (oct * 7 + b.afterWhite + 1) * wKeyW
        const x = whiteRightX - bKeyW / 2
        const innerX = x + 1
        const innerY = pianoTop + 0.5
        const innerW = bKeyW - 2
        const innerH = bKeyH - 1

        // Base — gradient + faint outer shadow for depth
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(x, pianoTop, bKeyW, bKeyH + 1)
        ctx.fillStyle = blackKeyBaseGradient(ctx, innerX, innerY, innerW, innerH)
        ctx.fillRect(innerX, innerY, innerW, innerH)

        // Suggestion glow OR octave-shifted off-white
        if (scores[pc] != null) {
          ctx.fillStyle = suggestionGlow(ctx,
            innerX + innerW / 2, innerY + innerH * 0.50,
            innerW / 2, innerH / 2,
            scores[pc])
          ctx.fillRect(innerX, innerY, innerW, innerH)
        } else if (hasActive && !activeMidis.has(midi)) {
          ctx.fillStyle = octaveShiftedGradient(ctx, innerX, innerY, innerW, innerH, true)
          ctx.fillRect(innerX, innerY, innerW, innerH)
        }

        // Active (only the exact midi)
        if (activeMidis.has(midi)) {
          ctx.fillStyle = activeKeyGradient(ctx, innerX, innerY, innerW, innerH, true)
          ctx.fillRect(innerX, innerY, innerW, innerH)
        }

        // Soft highlight at top edge
        const sheen = ctx.createLinearGradient(innerX, innerY, innerX, innerY + 2)
        sheen.addColorStop(0, 'rgba(255,255,255,0.10)')
        sheen.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = sheen
        ctx.fillRect(innerX, innerY, innerW, 2)
      }
    }
  }

  function draw() {
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)
    // Cap label height so taller panels (at lower octave counts) give the
    // piano area more vertical room to grow proportionally.
    const labelH = Math.min(36, Math.max(20, Math.round(h * 0.28)))
    drawChordLabel(ctx, w, labelH)
    drawPiano(ctx, w, labelH, h - labelH)
  }

  function updateNotes(midiSet) {
    activeMidis = new Set(midiSet)
    recompute()
    draw()
  }

  function resize() {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    canvas.width = w
    canvas.height = h
    draw()
  }

  function setOctaves(n) {
    const clamped = Math.max(1, Math.min(3, Math.round(n)))
    if (clamped === octaves) return
    octaves = clamped
    container.setAttribute('data-octaves', String(octaves))
    // ResizeObserver will fire when the CSS transition changes container height
    // and trigger a redraw automatically.
  }

  container.setAttribute('data-octaves', String(octaves))   // initial
  new ResizeObserver(resize).observe(container)
  resize()

  return { updateNotes, setOctaves, getOctaves: () => octaves, getChord: () => chord }
}
