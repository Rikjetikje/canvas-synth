// — Modulation Triangle —
// A draggable dot inside a triangle. Each corner is a "modulation mood" with
// preset LFO depths. Barycentric interpolation between corners gives a smooth
// morph across vibrato/tremolo/filter-wobble simultaneously.

const CORNERS = [
  // Top:    still         (no modulation)
  { x: 0.5, y: 0.10, label: 'kalm',   color: 'rgba(180,180,200,0.20)',
    preset: { vibratoDepth: 0,   tremoloDepth: 0,   filterDepth: 0   } },
  // BL:     warble        (warm slow modulation)
  { x: 0.08, y: 0.92, label: 'warble', color: 'rgba(255,170,100,0.20)',
    preset: { vibratoDepth: 0.4, tremoloDepth: 0.3, filterDepth: 0   } },
  // BR:     shake         (aggressive filter + tremolo)
  { x: 0.92, y: 0.92, label: 'shake',  color: 'rgba(150,100,255,0.22)',
    preset: { vibratoDepth: 0,   tremoloDepth: 0.55, filterDepth: 0.75 } },
]

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// Barycentric coords for point (px, py) in triangle ABC.
// Returns [a, b, c] non-negative, summing to 1.
function barycentric(px, py, A, B, C) {
  const det = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y)
  let a = ((B.y - C.y) * (px - C.x) + (C.x - B.x) * (py - C.y)) / det
  let b = ((C.y - A.y) * (px - C.x) + (A.x - C.x) * (py - C.y)) / det
  let c = 1 - a - b
  // Clamp negatives (when outside triangle) and re-normalise
  a = Math.max(0, a); b = Math.max(0, b); c = Math.max(0, c)
  const s = a + b + c || 1
  return [a / s, b / s, c / s]
}

// Snap an arbitrary point to the inside of triangle ABC.
function clampToTriangle(px, py, A, B, C) {
  const [a, b, c] = barycentric(px, py, A, B, C)
  return {
    x: a * A.x + b * B.x + c * C.x,
    y: a * A.y + b * B.y + c * C.y,
  }
}

export function createTriangleMod(container, onChange) {
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)

  let pos = { x: 0.5, y: 0.30 }   // start near "kalm" but slightly inside
  let isDragging = false
  let bgCache = null

  function computeParams() {
    const [a, b, c] = barycentric(pos.x, pos.y, CORNERS[0], CORNERS[1], CORNERS[2])
    const w = [a, b, c]
    const result = { vibratoDepth: 0, tremoloDepth: 0, filterDepth: 0 }
    for (let i = 0; i < 3; i++) {
      const p = CORNERS[i].preset
      result.vibratoDepth += w[i] * p.vibratoDepth
      result.tremoloDepth += w[i] * p.tremoloDepth
      result.filterDepth  += w[i] * p.filterDepth
    }
    return result
  }

  function buildBackground(w, h) {
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const ctx = off.getContext('2d')

    // Triangle path
    ctx.beginPath()
    CORNERS.forEach((c, i) => {
      const x = c.x * w, y = c.y * h
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.closePath()

    // Subtle gradient fill — radial from each corner to mix colours
    CORNERS.forEach(c => {
      const x = c.x * w, y = c.y * h
      const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.55)
      g.addColorStop(0, c.color)
      g.addColorStop(1, 'transparent')
      ctx.save()
      ctx.clip()  // clip to triangle so fill only inside
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    })

    // Outline
    ctx.beginPath()
    CORNERS.forEach((c, i) => {
      const x = c.x * w, y = c.y * h
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 1
    ctx.stroke()

    return off
  }

  function draw() {
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)
    if (!bgCache) bgCache = buildBackground(w, h)
    ctx.drawImage(bgCache, 0, 0)

    // Corner labels
    const fs = Math.max(8, Math.round(w * 0.07))
    ctx.font = `${fs}px "Courier New", monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    CORNERS.forEach((c, i) => {
      ctx.textAlign = i === 0 ? 'center' : i === 1 ? 'left' : 'right'
      ctx.textBaseline = i === 0 ? 'top' : 'bottom'
      const offX = i === 0 ? 0 : i === 1 ? 4 : -4
      const offY = i === 0 ? 4 : -4
      ctx.fillText(c.label, c.x * w + offX, c.y * h + offY)
    })

    const cx = pos.x * w, cy = pos.y * h
    // Glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22)
    glow.addColorStop(0, 'rgba(255,255,255,0.30)')
    glow.addColorStop(1, 'transparent')
    ctx.beginPath()
    ctx.arc(cx, cy, 22, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
    // Dot
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }

  function eventPos(e) {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    const raw = {
      x: clamp((src.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((src.clientY - rect.top) / rect.height, 0, 1),
    }
    return clampToTriangle(raw.x, raw.y, CORNERS[0], CORNERS[1], CORNERS[2])
  }

  canvas.addEventListener('pointerdown', e => {
    isDragging = true
    canvas.setPointerCapture(e.pointerId)
    pos = eventPos(e)
    draw()
    onChange(computeParams())
  })

  canvas.addEventListener('pointermove', e => {
    if (!isDragging) return
    pos = eventPos(e)
    draw()
    onChange(computeParams())
  })

  function endDrag() { isDragging = false }
  canvas.addEventListener('pointerup',          endDrag)
  canvas.addEventListener('pointercancel',      endDrag)
  canvas.addEventListener('lostpointercapture', endDrag)

  function resize() {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    canvas.width  = w
    canvas.height = h
    bgCache = null
    draw()
  }

  function getState() { return { x: pos.x, y: pos.y } }
  function setState(s) {
    if (!s) return
    pos = clampToTriangle(s.x ?? 0.5, s.y ?? 0.3, CORNERS[0], CORNERS[1], CORNERS[2])
    draw()
    onChange(computeParams())
  }

  new ResizeObserver(resize).observe(container)
  resize()
  setTimeout(() => onChange(computeParams()), 0)

  return { getState, setState }
}
