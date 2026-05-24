// — Circle of Fifths panel —
// Visualiseert akkoorden in een COF-layout. Buitenring = major, binnenring =
// relatieve minor. Huidige akkoord wordt opgelicht; andere segmenten krijgen
// een groen→rood gradient gebaseerd op COF-afstand (klik-volgakkoord-logica).
// Bij gekozen toonsoort verschijnen romeinse cijfers in de diatonische
// posities.

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLAT_NAMES  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

// COF-positie 0 = bovenaan = C. Met de klok mee toenemend met perfecte
// kwint per stap.
const COF_TO_PC = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]
const PC_TO_COF = {}
COF_TO_PC.forEach((pc, pos) => { PC_TO_COF[pc] = pos })

function wedgeChord(pos, ring) {
  const majPc = COF_TO_PC[pos]
  if (ring === 'outer') return { rootPc: majPc, mode: 'major' }
  return { rootPc: (majPc - 3 + 12) % 12, mode: 'minor' }
}

// Bepaal positie op COF van een herkend akkoord
function chordOnCOF(chord) {
  if (!chord || !chord.name) return null
  if (chord.name === '?' || chord.name === '5') return null  // power chord, dim — skip
  const isMinor = /^m(?!aj)/.test(chord.name) || chord.name.startsWith('dim')
  if (isMinor) {
    const relMajPc = (chord.root + 3) % 12
    return { pos: PC_TO_COF[relMajPc], ring: 'inner' }
  }
  return { pos: PC_TO_COF[chord.root], ring: 'outer' }
}

function cofDistance(a, b) {
  const posDiff = Math.min(Math.abs(a.pos - b.pos), 12 - Math.abs(a.pos - b.pos))
  const ringDiff = a.ring === b.ring ? 0 : 0.5
  return posDiff + ringDiff
}

function colorForDistance(d) {
  if (d == null) return 'rgba(255,255,255,0.04)'
  const norm = Math.min(1, d / 4)
  const hue = 120 * (1 - Math.pow(norm, 0.8))
  const alpha = 0.12 + 0.32 * norm
  return `hsla(${hue.toFixed(0)}, 75%, 50%, ${alpha.toFixed(2)})`
}

// Naam-conventie: outer (major) standaard sharps voor C♯/F♯/G♯ etc., inner
// (minor) gebruikt de bekende minor-namen.
function nameForWedge(pos, ring) {
  const majPc = COF_TO_PC[pos]
  if (ring === 'outer') {
    // Flat names look more standard for some major keys, but in a COF we keep
    // the conventional sharps on the right side. For pos 6 (F♯ / G♭) the
    // common name is F♯ on the sharp side.
    return SHARP_NAMES[majPc]
  }
  const minPc = (majPc - 3 + 12) % 12
  // Minor names: use flat for pc 1, 3, 8, 10 (Cm/Dm-side minors)
  const flatPcs = new Set([3, 10])  // E♭m, B♭m more common than D♯m, A♯m
  const names = flatPcs.has(minPc) ? FLAT_NAMES : SHARP_NAMES
  return names[minPc] + 'm'
}

function numeralForWedge(pos, ring, keyRoot, keyMode) {
  if (keyRoot == null) return null
  const chord = wedgeChord(pos, ring)
  const offset = (chord.rootPc - keyRoot + 12) % 12

  if (keyMode === 'major') {
    const map = {
      0:  { mode: 'major', num: 'I'    },
      2:  { mode: 'minor', num: 'ii'   },
      4:  { mode: 'minor', num: 'iii'  },
      5:  { mode: 'major', num: 'IV'   },
      7:  { mode: 'major', num: 'V'    },
      9:  { mode: 'minor', num: 'vi'   },
      11: { mode: 'minor', num: 'vii°' },
    }
    const entry = map[offset]
    if (entry && entry.mode === chord.mode) return entry.num
  } else if (keyMode === 'minor') {
    const map = {
      0:  { mode: 'minor', num: 'i'   },
      2:  { mode: 'minor', num: 'ii°' },
      3:  { mode: 'major', num: 'III' },
      5:  { mode: 'minor', num: 'iv'  },
      7:  { mode: 'major', num: 'V'   },   // harmonic minor V (most common)
      8:  { mode: 'major', num: 'VI'  },
      10: { mode: 'major', num: 'VII' },
    }
    const entry = map[offset]
    if (entry && entry.mode === chord.mode) return entry.num
  }
  return null
}

export function createCircleOfFifths(container) {
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)

  let chord = null
  let keyRoot = null
  let keyMode = 'major'

  function draw() {
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // Subtle ambient
    const ambient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2)
    ambient.addColorStop(0, 'rgba(255,255,255,0.03)')
    ambient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = ambient
    ctx.fillRect(0, 0, w, h)

    const size = Math.min(w, h)
    const cx = w / 2
    const cy = h / 2 + 2
    const rOuter = size * 0.46
    const rMid   = size * 0.30
    const rInner = size * 0.13

    const currentCOF = chordOnCOF(chord)
    const wedgeAng   = (2 * Math.PI) / 12

    for (let pos = 0; pos < 12; pos++) {
      for (const ring of ['outer', 'inner']) {
        const r1 = ring === 'outer' ? rOuter : rMid
        const r2 = ring === 'outer' ? rMid   : rInner
        const start = -Math.PI / 2 - wedgeAng / 2 + pos * wedgeAng
        const end   = start + wedgeAng

        const isCurrent = currentCOF && currentCOF.pos === pos && currentCOF.ring === ring
        const dist = currentCOF ? cofDistance(currentCOF, { pos, ring }) : null
        const numeral = numeralForWedge(pos, ring, keyRoot, keyMode)

        // Wedge path
        ctx.beginPath()
        ctx.arc(cx, cy, r1, start, end)
        ctx.arc(cx, cy, r2, end, start, true)
        ctx.closePath()

        // Fill — current chord gets a bright white, others a distance-coloured glow
        if (isCurrent) {
          const g = ctx.createRadialGradient(cx, cy, r2, cx, cy, r1)
          g.addColorStop(0, 'rgba(255,255,255,0.95)')
          g.addColorStop(1, 'rgba(255,255,255,0.65)')
          ctx.fillStyle = g
        } else if (dist != null) {
          ctx.fillStyle = colorForDistance(dist)
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.03)'
        }
        ctx.fill()

        // In-key overlay (cool tint on top of the base color)
        if (numeral && !isCurrent) {
          ctx.fillStyle = 'rgba(120,180,255,0.10)'
          ctx.fill()
        }

        // Edge stroke
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'
        ctx.lineWidth = 1
        ctx.stroke()

        // Label
        const midA = (start + end) / 2
        const midR = (r1 + r2) / 2
        const tx = cx + midR * Math.cos(midA)
        const ty = cy + midR * Math.sin(midA)
        const label = nameForWedge(pos, ring)
        const fs = Math.max(8, Math.round(size * (ring === 'outer' ? 0.045 : 0.038)))
        ctx.font = `${fs}px "Courier New", monospace`
        ctx.fillStyle = isCurrent ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.78)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, tx, ty - (numeral ? fs * 0.45 : 0))

        if (numeral) {
          ctx.font = `${(fs * 0.72).toFixed(1)}px "Courier New", monospace`
          ctx.fillStyle = isCurrent ? 'rgba(0,0,0,0.55)' : 'rgba(170,210,255,0.85)'
          ctx.fillText(numeral, tx, ty + fs * 0.55)
        }
      }
    }
  }

  function setChord(c)         { chord = c;  draw() }
  function setKey(root, mode)  { keyRoot = root; keyMode = mode || 'major'; draw() }
  function clearKey()          { keyRoot = null; draw() }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return
    canvas.width  = w
    canvas.height = h
    draw()
  }

  new ResizeObserver(resize).observe(container)
  resize()

  return { setChord, setKey, clearKey, getState: () => ({ keyRoot, keyMode }) }
}
