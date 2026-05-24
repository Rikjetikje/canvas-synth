const TIME_WINDOW = 4
const HIT_RADIUS  = 24
const CLICK_MAX   = 6

const DEFAULTS = [
  { x: 0,    y: 0.2,  smooth: true, lockedX: true  },
  { x: 0.10, y: 0.75, smooth: true, lockedX: false },
  { x: 0.30, y: 0.45, smooth: true, lockedX: false },
  { x: 0.75, y: 0.45, smooth: true, lockedX: false },
  { x: 1,    y: 0.2,  smooth: true, lockedX: true  },
]

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function yToFreq(y) {
  return 100 * Math.pow(80, clamp(y, 0, 1))  // 100 Hz – 8000 Hz log
}

function extractFilterParams(nodes) {
  const [n0, n1, n2, n3, n4] = nodes
  const baseFreq = yToFreq(Math.min(n0.y, n4.y))
  const peakFreq = Math.max(yToFreq(n1.y), baseFreq * 1.01)
  const sustFreq = yToFreq(n2.y)
  const octaves  = Math.log2(peakFreq / baseFreq)
  const sustain  = clamp(Math.log2(Math.max(sustFreq, baseFreq) / baseFreq) / octaves, 0, 1)
  return {
    filterAttack:   clamp((n1.x - n0.x) * TIME_WINDOW, 0.005, 4),
    filterDecay:    clamp((n2.x - n1.x) * TIME_WINDOW, 0.01,  4),
    filterSustain:  sustain,
    filterRelease:  clamp((n4.x - n3.x) * TIME_WINDOW, 0.05,  4),
    filterBaseFreq: baseFreq,
    filterOctaves:  octaves,
  }
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
        cur.x * W + tx0,  (1 - cur.y) * H + ty0,
        nxt.x * W - tx1,  (1 - nxt.y) * H - ty1,
        nxt.x * W,        (1 - nxt.y) * H,
      )
    }
  }

  // Gradient fill under curve
  const fillPath = new Path2D()
  fillPath.moveTo(nodes[0].x * W, (1 - nodes[0].y) * H)
  addBeziers(fillPath)
  fillPath.lineTo(nodes[nodes.length - 1].x * W, H)
  fillPath.lineTo(nodes[0].x * W, H)
  fillPath.closePath()

  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, 'rgba(80,185,255,0.45)')
  grad.addColorStop(1, 'rgba(60,80,255,0.0)')
  ctx.fillStyle = grad
  ctx.fill(fillPath)

  // Stroke curve
  const curvePath = new Path2D()
  curvePath.moveTo(nodes[0].x * W, (1 - nodes[0].y) * H)
  addBeziers(curvePath)
  ctx.strokeStyle = 'rgba(140,190,255,0.9)'
  ctx.lineWidth   = 1.5
  ctx.lineJoin    = 'round'
  ctx.stroke(curvePath)
}

const PRESETS = [
  {
    name: 'neutral',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 6 L22 6" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round"/></svg>',
    // Flat at mid-Y — base cutoff ≈ 900 Hz, octaves ≈ 0, so the filter
    // env effectively doesn't move. Static neutral filter.
    nodes: [
      { x: 0,     y: 0.5, smooth: true, lockedX: true  },
      { x: 0.005, y: 0.5, smooth: true, lockedX: false },
      { x: 0.5,   y: 0.5, smooth: true, lockedX: false },
      { x: 0.995, y: 0.5, smooth: true, lockedX: false },
      { x: 1,     y: 0.5, smooth: true, lockedX: true  },
    ],
  },
  {
    name: 'sweep',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 10 L5 2 L9 6 L17 6 L22 10" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    // Low base → sharp climb to high peak → decay to mid sustain → back to base.
    // Classic LP filter envelope shape.
    nodes: [
      { x: 0,    y: 0.18, smooth: true, lockedX: true  },
      { x: 0.08, y: 0.85, smooth: true, lockedX: false },
      { x: 0.30, y: 0.50, smooth: true, lockedX: false },
      { x: 0.75, y: 0.50, smooth: true, lockedX: false },
      { x: 1,    y: 0.18, smooth: true, lockedX: true  },
    ],
  },
  {
    name: 'open',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 3 L22 3" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round"/></svg>',
    // Flat at top — bright filter all the way through. No animation.
    nodes: [
      { x: 0,    y: 0.92, smooth: true, lockedX: true  },
      { x: 0.10, y: 0.92, smooth: true, lockedX: false },
      { x: 0.50, y: 0.92, smooth: true, lockedX: false },
      { x: 0.85, y: 0.92, smooth: true, lockedX: false },
      { x: 1,    y: 0.92, smooth: true, lockedX: true  },
    ],
  },
  {
    name: 'closed',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 9 L22 9" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round"/></svg>',
    // Flat at bottom — dark / muffled. The envelope barely opens up.
    nodes: [
      { x: 0,    y: 0.12, smooth: true, lockedX: true  },
      { x: 0.10, y: 0.15, smooth: true, lockedX: false },
      { x: 0.50, y: 0.12, smooth: true, lockedX: false },
      { x: 0.85, y: 0.12, smooth: true, lockedX: false },
      { x: 1,    y: 0.12, smooth: true, lockedX: true  },
    ],
  },
]

export function createFilterEnvelope(container, onChange) {
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
      onChange(extractFilterParams(nodes))
    })
    presetsDiv.appendChild(btn)
  })

  function resize() {
    const w = canvasWrap.clientWidth
    if (!w) return
    canvas.width  = w
    canvas.height = canvasWrap.clientHeight || 80
    draw()
  }

  function draw() {
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle    = 'rgba(140,190,255,0.12)'
    ctx.font         = `${Math.max(9, Math.round(W * 0.022))}px "Courier New", monospace`
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('filter', 8, 5)

    drawCurve(ctx, nodes, W, H)

    nodes.forEach(n => {
      const nx = n.x * W
      const ny = (1 - n.y) * H
      const r  = n.lockedX ? 4 : 6

      if (n.smooth) {
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(140,190,255,0.9)'
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(140,190,255,0.9)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(nx, ny, 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(140,190,255,0.9)'
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
      const xMin = prev ? prev.x + 0.002 : 0.002
      const xMax = next ? next.x - 0.002 : 0.998
      n.x = clamp(dragStartNode.x + dx, xMin, xMax)
    }

    n.y = clamp(dragStartNode.y + dy, 0, 1)
    draw()
    onChange(extractFilterParams(nodes))
  })

  function endDrag() {
    if (dragIdx === null) return
    if (dragMoved < CLICK_MAX) {
      nodes[dragIdx].smooth = !nodes[dragIdx].smooth
      draw()
    }
    onChange(extractFilterParams(nodes))
    dragIdx = null
  }
  canvas.addEventListener('pointerup',          endDrag)
  canvas.addEventListener('pointercancel',      endDrag)
  canvas.addEventListener('lostpointercapture', endDrag)

  // Reverse-map filter env numbers back to node positions
  function freqToY(f) { return clamp(Math.log(f / 100) / Math.log(80), 0, 1) }

  function setFromParams(p) {
    const TW = TIME_WINDOW
    // Y positions from base + octaves + sustain
    if (p.filterBaseFreq !== undefined || p.filterOctaves !== undefined || p.filterSustain !== undefined) {
      const cur = extractFilterParams(nodes)
      const base    = p.filterBaseFreq ?? cur.filterBaseFreq
      const octaves = p.filterOctaves  ?? cur.filterOctaves
      const sustain = p.filterSustain  ?? cur.filterSustain
      const peakFreq = base * Math.pow(2, octaves)
      const sustFreq = base * Math.pow(2, octaves * sustain)
      nodes[0].y = nodes[4].y = freqToY(base)
      nodes[1].y = freqToY(peakFreq)
      nodes[2].y = freqToY(sustFreq)
      nodes[3].y = freqToY(sustFreq)
    }
    if (p.filterAttack  !== undefined) nodes[1].x = clamp(p.filterAttack  / TW, 0.002, 0.96)
    if (p.filterDecay   !== undefined) nodes[2].x = clamp(nodes[1].x + p.filterDecay / TW, nodes[1].x + 0.002, 0.97)
    if (p.filterRelease !== undefined) nodes[3].x = clamp(1 - p.filterRelease / TW, nodes[2].x + 0.002, 0.998)
    draw()
  }

  function getNodes() { return nodes.map(n => ({ ...n })) }
  function setNodes(arr) {
    if (!Array.isArray(arr) || arr.length !== nodes.length) return
    nodes = arr.map(n => ({ ...n }))
    draw()
    onChange(extractFilterParams(nodes))
  }

  new ResizeObserver(resize).observe(canvasWrap)
  resize()
  setTimeout(() => onChange(extractFilterParams(nodes)), 0)

  return { setFromParams, getNodes, setNodes }
}
