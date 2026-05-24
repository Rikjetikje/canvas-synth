const TYPES  = ['fatsine', 'fattriangle', 'fatsawtooth', 'fatsquare']
const LABELS = ['sine', 'tri', 'saw', 'sqr']

function drawShape(ctx, type, x, y, w, h) {
  const mid = y + h * 0.5
  const amp = h * 0.32
  ctx.beginPath()
  for (let i = 0; i <= 64; i++) {
    const t  = i / 64
    const px = x + t * w
    let v
    if (type === 'fatsine') {
      v = Math.sin(t * Math.PI * 2)
    } else if (type === 'fattriangle') {
      v = 1 - 4 * Math.abs(Math.round(t) - t)
    } else if (type === 'fatsawtooth') {
      v = 2 * (t - Math.floor(t + 0.5))
    } else {
      v = t < 0.5 ? 1 : -1
    }
    const py = mid - v * amp
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.stroke()
}

export function createWaveformCycle(container, onChange) {
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  let activeIdx = 0

  function resize() {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    canvas.width  = w
    canvas.height = h
    draw()
  }

  function draw() {
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const iconH = H * 0.54

    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth   = 1.5
    ctx.lineJoin    = 'round'
    drawShape(ctx, TYPES[activeIdx], 4, H * 0.08, W - 8, iconH)

    ctx.fillStyle    = 'rgba(255,255,255,0.45)'
    ctx.font         = `${Math.max(7, Math.round(W * 0.22))}px "Courier New", monospace`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(LABELS[activeIdx], W / 2, H * 0.74)

    // Position dots
    const step = W / (TYPES.length + 1)
    TYPES.forEach((_, i) => {
      ctx.beginPath()
      ctx.arc(step * (i + 1), H * 0.91, i === activeIdx ? 2.5 : 1.5, 0, Math.PI * 2)
      ctx.fillStyle = i === activeIdx ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.18)'
      ctx.fill()
    })
  }

  canvas.addEventListener('pointerdown', () => {
    activeIdx = (activeIdx + 1) % TYPES.length
    draw()
    onChange(TYPES[activeIdx])
  })

  new ResizeObserver(resize).observe(container)
  resize()
  setTimeout(() => onChange(TYPES[activeIdx]), 0)
}
