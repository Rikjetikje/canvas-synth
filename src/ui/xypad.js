import { presets } from '../audio/presets.js'
import { getWaveformData } from '../audio/synth.js'

const CORNER_COLORS = {
  topLeft:     'rgba(255,180,80,0.14)',
  topRight:    'rgba(80,210,255,0.14)',
  bottomLeft:  'rgba(100,100,255,0.14)',
  bottomRight: 'rgba(255,60,60,0.14)',
}

const SLIDER_PX = 10

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

export function createXYPad(container, onChange) {
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)

  let pos = { x: 0.5, y: 0.5 }
  let axis = { x: 1, y: 1 }          // −1..+1 per axis
  let dragMode = null                 // 'pos' | 'sliderX' | 'sliderY' | null
  let isDragging = false
  let bgCache = null

  function buildBackground(w, h) {
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const ctx = off.getContext('2d')

    const corners = [
      { x: 0, y: 0, key: 'topLeft' },
      { x: w, y: 0, key: 'topRight' },
      { x: 0, y: h, key: 'bottomLeft' },
      { x: w, y: h, key: 'bottomRight' },
    ]
    corners.forEach(({ x, y, key }) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.72)
      g.addColorStop(0, CORNER_COLORS[key])
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    })

    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h)
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2)
    ctx.stroke()

    return off
  }

  function drawOscilloscope(ctx, w, h) {
    const data = getWaveformData()
    if (!data || data.length === 0) return

    // Compute RMS to drive glow intensity
    let sumSq = 0
    for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i]
    const rms = Math.sqrt(sumSq / data.length)
    const alpha = Math.min(1, rms * 8)

    if (alpha < 0.005) return

    const midY = h * 0.5
    const amp  = h * 0.38

    // Glow pass — thick + translucent
    ctx.beginPath()
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * w
      const y = midY + data[i] * amp
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.12).toFixed(3)})`
    ctx.lineWidth   = 5
    ctx.lineJoin    = 'round'
    ctx.stroke()

    // Sharp pass — thin + brighter
    ctx.beginPath()
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * w
      const y = midY + data[i] * amp
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.55).toFixed(3)})`
    ctx.lineWidth   = 1
    ctx.lineJoin    = 'round'
    ctx.stroke()
  }

  function drawAxisSliders(ctx, w, h) {
    const innerW = w - SLIDER_PX
    const innerH = h - SLIDER_PX
    const HR = 4                              // handle radius
    const trackXFrom = SLIDER_PX + HR
    const trackXTo   = w - HR
    const trackYFrom = HR
    const trackYTo   = innerH - HR

    // Track backgrounds
    ctx.fillStyle = 'rgba(255,255,255,0.025)'
    ctx.fillRect(SLIDER_PX, h - SLIDER_PX, innerW, SLIDER_PX)   // bottom (X)
    ctx.fillRect(0, 0, SLIDER_PX, innerH)                        // left (Y)

    // Centre ticks
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    const xCentre = (trackXFrom + trackXTo) / 2
    ctx.moveTo(xCentre, h - SLIDER_PX); ctx.lineTo(xCentre, h)
    const yCentre = (trackYFrom + trackYTo) / 2
    ctx.moveTo(0, yCentre); ctx.lineTo(SLIDER_PX, yCentre)
    ctx.stroke()

    // Handles
    const xT  = (axis.x + 1) / 2          // −1..+1 → 0..1
    const yT  = 1 - (axis.y + 1) / 2      // +1 at top, −1 at bottom
    const xHX = trackXFrom + xT * (trackXTo - trackXFrom)
    const xHY = h - SLIDER_PX / 2
    const yHX = SLIDER_PX / 2
    const yHY = trackYFrom + yT * (trackYTo - trackYFrom)

    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath(); ctx.arc(xHX, xHY, HR, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(yHX, yHY, HR, 0, Math.PI * 2); ctx.fill()
  }

  function draw() {
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const innerW = w - SLIDER_PX
    const innerH = h - SLIDER_PX

    ctx.clearRect(0, 0, w, h)

    if (!bgCache) bgCache = buildBackground(w, h)
    ctx.drawImage(bgCache, 0, 0)

    // Corner labels (within the inner XY area)
    const fontSize = Math.max(10, Math.round(w * 0.033))
    ctx.font = `${fontSize}px "Courier New", monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    const pad = Math.round(w * 0.045)

    ctx.textAlign = 'left';  ctx.textBaseline = 'top'
    ctx.fillText(presets.topLeft.label, SLIDER_PX + pad, pad)
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'
    ctx.fillText(presets.topRight.label, w - pad, pad)
    ctx.textAlign = 'left';  ctx.textBaseline = 'bottom'
    ctx.fillText(presets.bottomLeft.label, SLIDER_PX + pad, innerH - pad)
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
    ctx.fillText(presets.bottomRight.label, w - pad, innerH - pad)

    drawOscilloscope(ctx, w, h)

    const cx = SLIDER_PX + pos.x * innerW
    const cy = pos.y * innerH

    // Crosshair across inner area
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, 0); ctx.lineTo(cx, innerH)
    ctx.moveTo(SLIDER_PX, cy); ctx.lineTo(w, cy)
    ctx.stroke()

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28)
    glow.addColorStop(0, 'rgba(255,255,255,0.25)')
    glow.addColorStop(1, 'transparent')
    ctx.beginPath()
    ctx.arc(cx, cy, 28, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()

    // Dot
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    drawAxisSliders(ctx, w, h)
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const sliderPx = (SLIDER_PX / canvas.width) * rect.width
    if (py > rect.height - sliderPx && px > sliderPx) return 'sliderX'
    if (px < sliderPx && py < rect.height - sliderPx) return 'sliderY'
    return 'pos'
  }

  function updateFromEvent(e) {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    const px = src.clientX - rect.left
    const py = src.clientY - rect.top
    const sliderPx = (SLIDER_PX / canvas.width) * rect.width
    const innerW = rect.width  - sliderPx
    const innerH = rect.height - sliderPx

    if (dragMode === 'sliderX') {
      const t = clamp((px - sliderPx) / innerW, 0, 1)
      axis.x = clamp(t * 2 - 1, -1, 1)
    } else if (dragMode === 'sliderY') {
      const t = clamp(py / innerH, 0, 1)
      axis.y = clamp(1 - t * 2, -1, 1)
    } else {
      pos.x = clamp((px - sliderPx) / innerW, 0, 1)
      pos.y = clamp(py / innerH, 0, 1)
    }
  }

  function emit() {
    onChange(pos.x, pos.y, axis.x, axis.y)
  }

  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true
    dragMode = hitTest(e.clientX, e.clientY)
    canvas.setPointerCapture(e.pointerId)
    updateFromEvent(e)
    emit()
  })

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return
    updateFromEvent(e)
    emit()
  })

  function endDrag() {
    isDragging = false
    dragMode = null
  }
  canvas.addEventListener('pointerup',          endDrag)
  canvas.addEventListener('pointercancel',      endDrag)
  canvas.addEventListener('lostpointercapture', endDrag)

  function resize() {
    const size = Math.min(container.clientWidth, container.clientHeight)
    if (size === 0) return
    canvas.width = size
    canvas.height = size
    bgCache = null
  }

  new ResizeObserver(resize).observe(container)
  resize()

  // Animation loop — drives oscilloscope at 60fps
  ;(function tick() {
    draw()
    requestAnimationFrame(tick)
  })()
}
