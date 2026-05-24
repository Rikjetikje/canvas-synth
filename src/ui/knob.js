// — Rotary Knob —
// Classic synth-style knob. Drag vertically (or click+drag radially) to rotate.
// Returns a normalised 0..1 value. The min/max angle range goes from 7-o'clock
// to 5-o'clock (about 270° of usable rotation).

const ANG_MIN = Math.PI *  0.75   // 7-o'clock-ish (135° from straight up clockwise)
const ANG_MAX = Math.PI * 2.25    // 5-o'clock (one full turn minus the gap)

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

export function createKnob(container, label, initial, onChange) {
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)

  let value = clamp(initial ?? 0, 0, 1)   // 0..1
  let isDragging = false
  let dragStartY = 0
  let dragStartVal = 0

  function angleFor(v) {
    return ANG_MIN + (ANG_MAX - ANG_MIN) * v
  }

  function draw() {
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    const cx = w / 2, cy = h * 0.55
    const radius = Math.min(w, h * 1.15) * 0.32
    ctx.clearRect(0, 0, w, h)

    // Background track arc
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 3, ANG_MIN, ANG_MAX)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Active arc (from min to current angle)
    const curAng = angleFor(value)
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 3, ANG_MIN, curAng)
    ctx.strokeStyle = 'rgba(180,200,255,0.55)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Knob body
    const g = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius)
    g.addColorStop(0, 'rgba(70, 70, 80, 1)')
    g.addColorStop(1, 'rgba(20, 20, 25, 1)')
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Pointer indicator (line from centre to edge at current angle)
    const tipX = cx + Math.cos(curAng) * radius * 0.85
    const tipY = cy + Math.sin(curAng) * radius * 0.85
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(tipX, tipY)
    ctx.strokeStyle = 'rgba(220,230,255,0.95)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()

    // Centre dot
    ctx.beginPath()
    ctx.arc(cx, cy, 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fill()

    // Label below
    const fs = Math.max(8, Math.round(w * 0.10))
    ctx.font = `${fs}px "Courier New", monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(label, cx, h - 4)
  }

  canvas.addEventListener('pointerdown', e => {
    isDragging = true
    canvas.setPointerCapture(e.pointerId)
    dragStartY = e.clientY
    dragStartVal = value
  })

  canvas.addEventListener('pointermove', e => {
    if (!isDragging) return
    // Vertical drag: up = increase. 200 px = full range.
    const dy = dragStartY - e.clientY
    value = clamp(dragStartVal + dy / 200, 0, 1)
    draw()
    onChange(value)
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
    draw()
  }

  function getState() { return { value } }
  function setState(s) {
    if (!s) return
    value = clamp(s.value ?? 0, 0, 1)
    draw()
    onChange(value)
  }

  new ResizeObserver(resize).observe(container)
  resize()
  setTimeout(() => onChange(value), 0)

  return { getState, setState }
}
