// — Intensity Circle —
// Drag outward from the centre to grow the ring. Radius (0..1) is interpreted
// as a single "intensity" parameter that the parent can map to multiple
// effects (distortion + filter Q + reverb wet bump). The ring pulses with
// the audio (RMS-driven), giving live visual feedback.

import { getWaveformData } from '../audio/synth.js'

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

export function createIntensityCircle(container, onChange) {
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)

  let radius = 0          // 0..1
  let isDragging = false

  function emit() { onChange({ intensity: radius }) }

  function draw() {
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height
    const cx = w / 2, cy = h / 2
    const rMax = Math.min(w, h) * 0.42
    ctx.clearRect(0, 0, w, h)

    // Audio-driven pulse
    let pulse = 0
    const data = getWaveformData()
    if (data && data.length) {
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
      pulse = Math.min(1, Math.sqrt(sum / data.length) * 6)
    }

    const r     = radius * rMax
    const intensityCol = (a) => `rgba(${Math.round(220 + 35 * radius)},${Math.round(100 - 60 * radius)},${Math.round(180 - 40 * radius)},${a})`

    // Outer max ring (faint guide)
    ctx.beginPath()
    ctx.arc(cx, cy, rMax, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.stroke()

    if (radius > 0.005) {
      // Filled disc (gradient from centre)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      g.addColorStop(0, intensityCol(0.05 + 0.35 * radius))
      g.addColorStop(1, intensityCol(0.0))
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()

      // Pulsing ring at radius
      const ringR = r * (1 + pulse * 0.12)
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.strokeStyle = intensityCol(0.55 + 0.4 * radius)
      ctx.lineWidth = 1 + radius * 1.5
      ctx.stroke()
    }

    // Centre dot
    ctx.beginPath()
    ctx.arc(cx, cy, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Label
    const fs = Math.max(8, Math.round(w * 0.045))
    ctx.font = `${fs}px "Courier New", monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.20)'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('intensity', 6, 5)
  }

  function eventDistNorm(e) {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    const dx = (src.clientX - rect.left) - rect.width  / 2
    const dy = (src.clientY - rect.top)  - rect.height / 2
    const rMax = Math.min(rect.width, rect.height) * 0.42
    return clamp(Math.sqrt(dx * dx + dy * dy) / rMax, 0, 1)
  }

  canvas.addEventListener('pointerdown', e => {
    isDragging = true
    canvas.setPointerCapture(e.pointerId)
    radius = eventDistNorm(e)
    emit()
  })

  canvas.addEventListener('pointermove', e => {
    if (!isDragging) return
    radius = eventDistNorm(e)
    emit()
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
  }

  function getState() { return { radius } }
  function setState(s) {
    if (!s) return
    radius = clamp(s.radius ?? 0, 0, 1)
    emit()
  }

  new ResizeObserver(resize).observe(container)
  resize()
  // Continuous tick for audio-reactive pulse
  ;(function tick() { draw(); requestAnimationFrame(tick) })()
  // Seed initial value
  setTimeout(emit, 0)

  return { getState, setState }
}
