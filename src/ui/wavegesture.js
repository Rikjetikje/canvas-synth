const TIME_WINDOW = 4
const HIT_RADIUS  = 24
const CLICK_MAX   = 6

// Sine wave by default — y=0.5 is the zero line, y=1 (top) is +1, y=0 (bottom) is -1
const DEFAULTS = [
  { x: 0.0,  y: 0.5, smooth: true, lockedX: true  },
  { x: 0.25, y: 1.0, smooth: true, lockedX: false },
  { x: 0.5,  y: 0.5, smooth: true, lockedX: false },
  { x: 0.75, y: 0.0, smooth: true, lockedX: false },
  { x: 1.0,  y: 0.5, smooth: true, lockedX: true  },
]

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// Evaluate cubic bezier at parameter t
function bezierY(t, p0, p1, p2, p3) {
  const mt = 1 - t
  return mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3
}
function bezierX(t, p0, p1, p2, p3) {
  return bezierY(t, p0, p1, p2, p3)
}
function bezierXDeriv(t, p0, p1, p2, p3) {
  const mt = 1 - t
  return 3*(mt*mt*(p1-p0) + 2*mt*t*(p2-p1) + t*t*(p3-p2))
}

function sampleCurve(nodes, N = 64) {
  const TC = 0.38
  const samples = new Float32Array(N)

  for (let si = 0; si < N; si++) {
    const xTarget = si / N

    // Find the segment containing xTarget
    let seg = nodes.length - 2
    for (let i = 0; i < nodes.length - 1; i++) {
      if (xTarget < nodes[i + 1].x) { seg = i; break }
    }

    const prev = nodes[Math.max(0, seg - 1)]
    const cur  = nodes[seg]
    const nxt  = nodes[seg + 1]
    const nnxt = nodes[Math.min(nodes.length - 1, seg + 2)]

    const tx0 = cur.smooth ? TC * (nxt.x - prev.x) / 3 : 0
    const ty0 = cur.smooth ? TC * -(nxt.y - prev.y) / 3 : 0
    const tx1 = nxt.smooth ? TC * (nnxt.x - cur.x) / 3 : 0
    const ty1 = nxt.smooth ? TC * -(nnxt.y - cur.y) / 3 : 0

    const bx = [cur.x, cur.x + tx0, nxt.x - tx1, nxt.x]
    const by = [cur.y, cur.y + ty0, nxt.y - ty1, nxt.y]

    // Newton's method: find t so that bezierX(t) = xTarget
    let t = (nxt.x > cur.x) ? (xTarget - cur.x) / (nxt.x - cur.x) : 0.5
    t = clamp(t, 0, 1)
    for (let it = 0; it < 8; it++) {
      const dx = bezierXDeriv(t, bx[0], bx[1], bx[2], bx[3])
      if (Math.abs(dx) < 1e-8) break
      t = clamp(t - (bezierX(t, bx[0], bx[1], bx[2], bx[3]) - xTarget) / dx, 0, 1)
    }

    const nodeY = bezierY(t, by[0], by[1], by[2], by[3])
    // nodeY 0.5 = audio 0, 1 (top) = +1, 0 (bottom) = -1
    samples[si] = (nodeY - 0.5) * 2
  }

  return samples
}

function samplesToPartials(samples, count = 16) {
  const N = samples.length
  const partials = []
  for (let k = 1; k <= count; k++) {
    let im = 0
    for (let n = 0; n < N; n++) {
      im += samples[n] * Math.sin(2 * Math.PI * k * n / N)
    }
    partials.push(2 * im / N)
  }
  return partials
}

function extractWaveformParams(nodes) {
  const samples = sampleCurve(nodes, 64)
  return { partials: samplesToPartials(samples, 16) }
}

function drawCurve(ctx, nodes, W, H) {
  const t = 0.38

  function addBeziers(path) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const prev = nodes[Math.max(0, i - 1)]
      const cur  = nodes[i]
      const nxt  = nodes[i + 1]
      const nnxt = nodes[Math.min(nodes.length - 1, i + 2)]
      const tx0 = cur.smooth ? t * (nxt.x - prev.x) * W / 3 : 0
      const ty0 = cur.smooth ? t * -(nxt.y - prev.y) * H / 3 : 0
      const tx1 = nxt.smooth ? t * (nnxt.x - cur.x) * W / 3 : 0
      const ty1 = nxt.smooth ? t * -(nnxt.y - cur.y) * H / 3 : 0
      path.bezierCurveTo(
        cur.x * W + tx0, (1 - cur.y) * H + ty0,
        nxt.x * W - tx1, (1 - nxt.y) * H - ty1,
        nxt.x * W,       (1 - nxt.y) * H,
      )
    }
  }

  // Gradient fill between curve and centre line
  const fillPath = new Path2D()
  fillPath.moveTo(nodes[0].x * W, (1 - nodes[0].y) * H)
  addBeziers(fillPath)
  fillPath.lineTo(nodes[nodes.length - 1].x * W, H * 0.5)
  fillPath.lineTo(nodes[0].x * W, H * 0.5)
  fillPath.closePath()

  // Mirror gradient: bright at extremes, transparent at centre
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0,   'rgba(100,220,140,0.38)')
  grad.addColorStop(0.5, 'rgba(100,220,140,0.0)')
  grad.addColorStop(1,   'rgba(100,220,140,0.38)')
  ctx.fillStyle = grad
  ctx.fill(fillPath)

  // Stroke curve
  const curvePath = new Path2D()
  curvePath.moveTo(nodes[0].x * W, (1 - nodes[0].y) * H)
  addBeziers(curvePath)
  ctx.strokeStyle = 'rgba(100,220,140,0.9)'
  ctx.lineWidth   = 1.5
  ctx.lineJoin    = 'round'
  ctx.stroke(curvePath)
}

const PRESETS = [
  {
    name: 'neutral',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 6 L22 6" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round"/></svg>',
    // Flat at the zero line — clears any custom partials so the synth reverts
    // to its built-in oscillator type (fatsine). NOT silence.
    clearsPartials: true,
    nodes: [
      { x: 0.0,  y: 0.5, smooth: true, lockedX: true  },
      { x: 0.25, y: 0.5, smooth: true, lockedX: false },
      { x: 0.5,  y: 0.5, smooth: true, lockedX: false },
      { x: 0.75, y: 0.5, smooth: true, lockedX: false },
      { x: 1.0,  y: 0.5, smooth: true, lockedX: true  },
    ],
  },
  {
    name: 'sine',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 6 Q5 1 8 6 T14 6 Q17 1 20 6 T22 6" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>',
    nodes: [
      { x: 0.0,  y: 0.5, smooth: true, lockedX: true  },
      { x: 0.25, y: 1.0, smooth: true, lockedX: false },
      { x: 0.5,  y: 0.5, smooth: true, lockedX: false },
      { x: 0.75, y: 0.0, smooth: true, lockedX: false },
      { x: 1.0,  y: 0.5, smooth: true, lockedX: true  },
    ],
  },
  {
    name: 'triangle',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 6 L6 2 L14 10 L18 6 L22 6" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    nodes: [
      { x: 0.0,  y: 0.5, smooth: false, lockedX: true  },
      { x: 0.25, y: 1.0, smooth: false, lockedX: false },
      { x: 0.5,  y: 0.5, smooth: false, lockedX: false },
      { x: 0.75, y: 0.0, smooth: false, lockedX: false },
      { x: 1.0,  y: 0.5, smooth: false, lockedX: true  },
    ],
  },
  {
    name: 'saw',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 10 L11 2 L11 10 L20 2 L20 10" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    nodes: [
      { x: 0.0,  y: 0.0,  smooth: false, lockedX: true  },
      { x: 0.30, y: 0.30, smooth: false, lockedX: false },
      { x: 0.60, y: 0.60, smooth: false, lockedX: false },
      { x: 0.90, y: 0.90, smooth: false, lockedX: false },
      { x: 1.0,  y: 1.0,  smooth: false, lockedX: true  },
    ],
  },
]

export function createWaveformGesture(container, onChange) {
  const canvasWrap = document.createElement('div')
  canvasWrap.className = 'strip-canvas-wrap'
  container.appendChild(canvasWrap)

  const canvas = document.createElement('canvas')
  canvasWrap.appendChild(canvas)

  const presetsDiv = document.createElement('div')
  presetsDiv.className = 'strip-presets'
  container.appendChild(presetsDiv)

  let nodes = DEFAULTS.map(n => ({ ...n }))
  let dragIdx      = null
  let dragStart    = null
  let dragStartNode = null
  let dragMoved    = 0

  PRESETS.forEach(preset => {
    const btn = document.createElement('button')
    btn.className = 'preset-btn'
    btn.title = preset.name
    btn.innerHTML = preset.icon
    btn.addEventListener('click', () => {
      nodes = preset.nodes.map(n => ({ ...n }))
      draw()
      // "neutral" wipes the custom-wave partials so the synth falls back to
      // its built-in oscillator type — otherwise a flat curve = silence.
      if (preset.clearsPartials) {
        onChange({ partials: null })
      } else {
        onChange(extractWaveformParams(nodes))
      }
    })
    presetsDiv.appendChild(btn)
  })

  function resize() {
    const w = canvasWrap.clientWidth
    if (!w) return
    canvas.width  = w
    canvas.height = canvasWrap.clientHeight || 72
    draw()
  }

  function draw() {
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Centre (zero) line
    ctx.beginPath()
    ctx.moveTo(0, H * 0.5); ctx.lineTo(W, H * 0.5)
    ctx.strokeStyle = 'rgba(100,220,140,0.1)'
    ctx.lineWidth   = 1
    ctx.stroke()

    ctx.fillStyle    = 'rgba(100,220,140,0.14)'
    ctx.font         = `${Math.max(9, Math.round(W * 0.022))}px "Courier New", monospace`
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('wave', 8, 5)

    drawCurve(ctx, nodes, W, H)

    nodes.forEach(n => {
      const nx = n.x * W
      const ny = (1 - n.y) * H
      const r  = n.lockedX ? 4 : 6

      if (n.smooth) {
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(100,220,140,0.9)'
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(100,220,140,0.9)'
        ctx.lineWidth   = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(nx, ny, 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(100,220,140,0.9)'
        ctx.fill()
      }
    })
  }

  function nearestNode(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    let best = null, bestDist = Infinity
    nodes.forEach((n, i) => {
      const dx = n.x * rect.width  - px
      const dy = (1 - n.y) * rect.height - py
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < HIT_RADIUS && d < bestDist) { bestDist = d; best = i }
    })
    return best
  }

  canvas.addEventListener('pointerdown', e => {
    const idx = nearestNode(e.clientX, e.clientY)
    if (idx === null) return
    dragIdx       = idx
    dragStart     = { x: e.clientX, y: e.clientY }
    dragStartNode = { ...nodes[idx] }
    dragMoved     = 0
    canvas.setPointerCapture(e.pointerId)
  })

  canvas.addEventListener('pointermove', e => {
    if (dragIdx === null) return
    const rect = canvas.getBoundingClientRect()
    const dx =  (e.clientX - dragStart.x) / rect.width
    const dy = -(e.clientY - dragStart.y) / rect.height
    dragMoved = Math.max(dragMoved, Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y))

    const n    = nodes[dragIdx]
    const prev = nodes[dragIdx - 1]
    const next = nodes[dragIdx + 1]

    if (!nodes[dragIdx].lockedX) {
      const xMin = prev ? prev.x + 0.04 : 0.02
      const xMax = next ? next.x - 0.04 : 0.98
      n.x = clamp(dragStartNode.x + dx, xMin, xMax)
    }

    n.y = clamp(dragStartNode.y + dy, 0, 1)
    draw()
    onChange(extractWaveformParams(nodes))
  })

  function endDrag() {
    if (dragIdx === null) return
    if (dragMoved < CLICK_MAX) {
      nodes[dragIdx].smooth = !nodes[dragIdx].smooth
      draw()
    }
    onChange(extractWaveformParams(nodes))
    dragIdx = null
  }
  canvas.addEventListener('pointerup',          endDrag)
  canvas.addEventListener('pointercancel',      endDrag)
  canvas.addEventListener('lostpointercapture', endDrag)

  function getNodes() { return nodes.map(n => ({ ...n })) }
  function setNodes(arr) {
    if (!Array.isArray(arr) || arr.length !== nodes.length) return
    nodes = arr.map(n => ({ ...n }))
    draw()
    onChange(extractWaveformParams(nodes))
  }

  new ResizeObserver(resize).observe(canvasWrap)
  resize()
  setTimeout(() => onChange(extractWaveformParams(nodes)), 0)

  return { getNodes, setNodes }
}
