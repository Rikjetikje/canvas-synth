const TIME_WINDOW = 4   // seconds represented by full canvas width
const HIT_RADIUS  = 24  // px touch target
const CLICK_MAX   = 6   // px — less than this = click (toggle), more = drag

// Default ADSR positions (x=time normalised, y=amplitude)
// lockedX = X-positie mag niet bewegen, Y wel
const DEFAULTS = [
  { x: 0,    y: 0,    smooth: true, lockedX: true  },  // n0: start
  { x: 0.10, y: 1,    smooth: true, lockedX: false },  // n1: attack peak
  { x: 0.28, y: 0.65, smooth: true, lockedX: false },  // n2: sustain level
  { x: 0.78, y: 0.65, smooth: true, lockedX: false },  // n3: release start
  { x: 1,    y: 0,    smooth: true, lockedX: true  },  // n4: end
]

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function makeAttackCurve(startY, smooth) {
  // 16-point curve from startY → 1.0
  return Array.from({ length: 16 }, (_, i) => {
    const t = i / 15
    return startY + (1 - startY) * (smooth ? Math.sin(t * Math.PI / 2) : t)
  })
}

function extractParams(nodes) {
  const [n0, n1, n2, n3, n4] = nodes
  return {
    attack:       clamp((n1.x - n0.x) * TIME_WINDOW, 0.005, 4),
    decay:        clamp((n2.x - n1.x) * TIME_WINDOW, 0.01, 4),
    sustain:      clamp(n2.y, 0, 1),
    release:      clamp((n4.x - n3.x) * TIME_WINDOW, 0.05, 4),
    attackCurve:  makeAttackCurve(clamp(n0.y, 0, 0.99), n1.smooth),
    decayCurve:   n2.smooth ? 'exponential' : 'linear',
    releaseCurve: n3.smooth ? 'exponential' : 'linear',
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
  grad.addColorStop(0, 'rgba(255,180,80,0.45)')
  grad.addColorStop(1, 'rgba(255,80,30,0.0)')
  ctx.fillStyle = grad
  ctx.fill(fillPath)

  // Stroke curve
  const curvePath = new Path2D()
  curvePath.moveTo(nodes[0].x * W, (1 - nodes[0].y) * H)
  addBeziers(curvePath)
  ctx.strokeStyle = 'rgba(255,210,140,0.9)'
  ctx.lineWidth   = 1.5
  ctx.lineJoin    = 'round'
  ctx.stroke(curvePath)
}

const PRESETS = [
  {
    name: 'stab',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 2 L6 2 L9 10 L22 10" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    nodes: [
      { x: 0,    y: 1, smooth: true, lockedX: true  },
      { x: 0.02, y: 1, smooth: true, lockedX: false },
      { x: 0.12, y: 0, smooth: true, lockedX: false },
      { x: 0.16, y: 0, smooth: true, lockedX: false },
      { x: 1,    y: 0, smooth: true, lockedX: true  },
    ],
  },
  {
    name: 'pluck',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 10 L4 2 L8 10 L22 10" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    nodes: [
      { x: 0,    y: 0, smooth: true, lockedX: true  },
      { x: 0.04, y: 1, smooth: true, lockedX: false },
      { x: 0.20, y: 0, smooth: true, lockedX: false },
      { x: 0.25, y: 0, smooth: true, lockedX: false },
      { x: 1,    y: 0, smooth: true, lockedX: true  },
    ],
  },
  {
    name: 'lead',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 10 L5 2 L9 5 L16 5 L22 10" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    nodes: [
      { x: 0,    y: 0,    smooth: true, lockedX: true  },
      { x: 0.10, y: 1,    smooth: true, lockedX: false },
      { x: 0.28, y: 0.65, smooth: true, lockedX: false },
      { x: 0.78, y: 0.65, smooth: true, lockedX: false },
      { x: 1,    y: 0,    smooth: true, lockedX: true  },
    ],
  },
  {
    name: 'pad',
    icon: '<svg viewBox="0 0 24 12" width="20" height="10"><path d="M2 10 L9 2 L15 2 L22 10" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    nodes: [
      { x: 0,    y: 0,   smooth: true, lockedX: true  },
      { x: 0.35, y: 1,   smooth: true, lockedX: false },
      { x: 0.40, y: 0.9, smooth: true, lockedX: false },
      { x: 0.55, y: 0.9, smooth: true, lockedX: false },
      { x: 1,    y: 0,   smooth: true, lockedX: true  },
    ],
  },
]

export function createGestureEnvelope(container, onChange) {
  const canvasWrap = document.createElement('div')
  canvasWrap.className = 'strip-canvas-wrap'
  container.appendChild(canvasWrap)

  const canvas = document.createElement('canvas')
  canvasWrap.appendChild(canvas)

  const presetsDiv = document.createElement('div')
  presetsDiv.className = 'strip-presets'
  container.appendChild(presetsDiv)

  let nodes = DEFAULTS.map(n => ({ ...n }))
  let dragIdx = null
  let dragStart = null     // { clientX, clientY }
  let dragStartNode = null // snapshot of node at drag start
  let dragMoved = 0

  PRESETS.forEach(preset => {
    const btn = document.createElement('button')
    btn.className = 'preset-btn'
    btn.title = preset.name
    btn.innerHTML = preset.icon
    btn.addEventListener('click', () => {
      nodes = preset.nodes.map(n => ({ ...n }))
      draw()
      onChange(extractParams(nodes))
    })
    presetsDiv.appendChild(btn)
  })

  function resize() {
    const w = canvasWrap.clientWidth
    if (!w) return
    canvas.width  = w
    canvas.height = canvasWrap.clientHeight || 100
    draw()
  }

  function draw() {
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.font = `${Math.max(9, Math.round(W * 0.022))}px "Courier New", monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('envelope', 8, 5)

    drawCurve(ctx, nodes, W, H)

    // Nodes
    nodes.forEach((n, i) => {
      const nx = n.x * W
      const ny = (1 - n.y) * H

      const r = n.lockedX ? 4 : 6   // end-nodes iets kleiner

      if (n.smooth) {
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(nx, ny, 2, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
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
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < HIT_RADIUS && d < bestDist) { bestDist = d; best = i }
    })
    return best
  }

  canvas.addEventListener('pointerdown', e => {
    const idx = nearestNode(e.clientX, e.clientY)
    if (idx === null) return
    dragIdx = idx
    dragStart = { x: e.clientX, y: e.clientY }
    dragStartNode = { ...nodes[idx] }
    dragMoved = 0
    canvas.setPointerCapture(e.pointerId)
  })

  canvas.addEventListener('pointermove', e => {
    if (dragIdx === null) return
    const rect = canvas.getBoundingClientRect()
    const dx =  (e.clientX - dragStart.x) / rect.width
    const dy = -(e.clientY - dragStart.y) / rect.height
    dragMoved = Math.max(dragMoved, Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y))

    const n = nodes[dragIdx]
    const prev = nodes[dragIdx - 1]
    const next = nodes[dragIdx + 1]

    if (!nodes[dragIdx].lockedX) {
      const xMin = prev ? prev.x + 0.002 : 0.002
      const xMax = next ? next.x - 0.002 : 0.998
      n.x = clamp(dragStartNode.x + dx, xMin, xMax)
    }

    n.y = clamp(dragStartNode.y + dy, 0, 1)

    draw()
    onChange(extractParams(nodes))
  })

  function endDrag() {
    if (dragIdx === null) return
    if (dragMoved < CLICK_MAX) {
      nodes[dragIdx].smooth = !nodes[dragIdx].smooth
      draw()
    }
    onChange(extractParams(nodes))
    dragIdx = null
  }
  canvas.addEventListener('pointerup',          endDrag)
  canvas.addEventListener('pointercancel',      endDrag)
  canvas.addEventListener('lostpointercapture', endDrag)

  // Reverse-map ADSR numbers back to node positions (for back→front sync)
  function setFromParams({ attack, decay, sustain, release }) {
    const TW = TIME_WINDOW
    if (attack  !== undefined) nodes[1].x = clamp(attack / TW, 0.002, 0.96)
    if (decay   !== undefined) nodes[2].x = clamp(nodes[1].x + decay / TW, nodes[1].x + 0.002, 0.97)
    if (sustain !== undefined) { nodes[2].y = clamp(sustain, 0, 1); nodes[3].y = nodes[2].y }
    if (release !== undefined) nodes[3].x = clamp(1 - release / TW, nodes[2].x + 0.002, 0.998)
    draw()
  }

  function getNodes() { return nodes.map(n => ({ ...n })) }
  function setNodes(arr) {
    if (!Array.isArray(arr) || arr.length !== nodes.length) return
    nodes = arr.map(n => ({ ...n }))
    draw()
    onChange(extractParams(nodes))
  }

  new ResizeObserver(resize).observe(canvasWrap)
  resize()

  setTimeout(() => onChange(extractParams(nodes)), 0)

  return { setFromParams, getNodes, setNodes }
}
