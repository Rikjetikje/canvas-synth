// — Drum sequencer grid —
// 6 rows × 16 step columns. Click a cell to toggle. During playback the
// current step's column is highlighted with a vertical wash.

const TRACK_COLORS = [
  // kick    snare    hhc      hho      clap     tom
  'rgba(255,170, 80, 0.85)',   // kick   → warm orange
  'rgba(255,230,120, 0.85)',   // snare  → yellow
  'rgba(140,220,255, 0.85)',   // hhc    → cyan
  'rgba(120,200,255, 0.65)',   // hho    → softer cyan
  'rgba(255,140,200, 0.85)',   // clap   → pink
  'rgba(140,255,170, 0.85)',   // tom    → mint green
]

export function createDrumGrid(container, opts) {
  const labels  = opts.labels   ?? ['k', 's', 'hhc', 'hho', 'cl', 'tom']
  const tracks  = labels.length
  const steps   = opts.steps    ?? 16
  const onToggle = opts.onToggle ?? (() => {})
  const getPattern = opts.getPattern ?? (() => [])

  const canvas = document.createElement('canvas')
  container.appendChild(canvas)

  let currentStep = -1

  // — Layout (in canvas pixels) —
  const LABEL_W = 38            // width of the track-label column on the left
  function geom() {
    const w = canvas.width, h = canvas.height
    const gridW = w - LABEL_W
    const cellW = gridW / steps
    const cellH = h / tracks
    return { w, h, gridW, cellW, cellH }
  }

  function draw() {
    const ctx = canvas.getContext('2d')
    const { w, h, cellW, cellH } = geom()
    ctx.clearRect(0, 0, w, h)

    const pattern = getPattern()

    // Vertical column highlight for the current playback step
    if (currentStep >= 0) {
      const x = LABEL_W + currentStep * cellW
      const g = ctx.createLinearGradient(x, 0, x, h)
      g.addColorStop(0, 'rgba(255,255,255,0.10)')
      g.addColorStop(1, 'rgba(255,255,255,0.02)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, cellW, h)
    }

    // Subtle beat dividers (every 4 steps)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (let s = 0; s <= steps; s += 4) {
      const x = LABEL_W + s * cellW
      ctx.beginPath()
      ctx.moveTo(x, 0); ctx.lineTo(x, h)
      ctx.stroke()
    }

    // Track-label column
    ctx.font = `${Math.max(9, Math.round(cellH * 0.32))}px "Courier New", monospace`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let t = 0; t < tracks; t++) {
      ctx.fillStyle = 'rgba(255,255,255,0.42)'
      ctx.fillText(labels[t], LABEL_W - 6, t * cellH + cellH / 2)
      // Row separator
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.beginPath()
      ctx.moveTo(0, (t + 1) * cellH); ctx.lineTo(w, (t + 1) * cellH)
      ctx.stroke()
    }

    // Cells
    const inset = Math.max(1, Math.min(cellW, cellH) * 0.10)
    for (let t = 0; t < tracks; t++) {
      const row = pattern[t] || []
      const cellColor = TRACK_COLORS[t] || 'rgba(255,255,255,0.7)'
      for (let s = 0; s < steps; s++) {
        const x = LABEL_W + s * cellW + inset
        const y = t * cellH + inset
        const ww = cellW - 2 * inset
        const hh = cellH - 2 * inset

        const isOn       = !!row[s]
        const isPlaying  = s === currentStep
        const isOnBeat   = s % 4 === 0

        // Off-cell base
        ctx.fillStyle = isOnBeat ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'
        ctx.fillRect(x, y, ww, hh)

        if (isOn) {
          // Filled cell with a soft gradient using the track colour
          const g = ctx.createLinearGradient(x, y, x, y + hh)
          g.addColorStop(0, cellColor)
          g.addColorStop(1, cellColor.replace(/[\d.]+\)$/, '0.55)'))
          ctx.fillStyle = g
          ctx.fillRect(x, y, ww, hh)

          // Extra glow if this is the current step
          if (isPlaying) {
            ctx.fillStyle = 'rgba(255,255,255,0.30)'
            ctx.fillRect(x, y, ww, hh)
          }
        }
      }
    }
  }

  function setCurrentStep(s) {
    currentStep = s
    draw()
  }

  // — Pointer interactions —
  let dragMode = null   // 'set' | 'clear' | null — preserve the toggle action across drag
  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const scale = canvas.width / rect.width
    const cx = px * scale
    const cy = py * scale
    if (cx < LABEL_W) return null
    const { cellW, cellH } = geom()
    const s = Math.floor((cx - LABEL_W) / cellW)
    const t = Math.floor(cy / cellH)
    if (s < 0 || s >= steps || t < 0 || t >= tracks) return null
    return { track: t, step: s }
  }

  canvas.addEventListener('pointerdown', e => {
    const c = cellAt(e.clientX, e.clientY)
    if (!c) return
    canvas.setPointerCapture(e.pointerId)
    const pattern = getPattern()
    const wasOn = !!(pattern[c.track] && pattern[c.track][c.step])
    dragMode = wasOn ? 'clear' : 'set'
    onToggle(c.track, c.step, !wasOn)
    draw()
  })

  canvas.addEventListener('pointermove', e => {
    if (!dragMode) return
    const c = cellAt(e.clientX, e.clientY)
    if (!c) return
    const pattern = getPattern()
    const isOn = !!(pattern[c.track] && pattern[c.track][c.step])
    const want = dragMode === 'set'
    if (isOn !== want) {
      onToggle(c.track, c.step, want)
      draw()
    }
  })

  function endDrag() { dragMode = null }
  canvas.addEventListener('pointerup',          endDrag)
  canvas.addEventListener('pointercancel',      endDrag)
  canvas.addEventListener('lostpointercapture', endDrag)

  function resize() {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    canvas.width  = w
    canvas.height = h
    draw()
  }

  new ResizeObserver(resize).observe(container)
  resize()

  return { setCurrentStep, redraw: draw }
}
