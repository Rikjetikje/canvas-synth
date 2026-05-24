import { presets } from './presets.js'

const NUMERIC_KEYS = [
  'filterFreq', 'filterQ', 'reverbWet', 'distortion',
  'oscCount', 'oscDetune', 'reverbDecay', 'gain',
]
const SOURCES = [presets.topLeft, presets.topRight, presets.bottomLeft, presets.bottomRight]

// ax / ay range −1..+1: +1 = normal axis effect, 0 = axis disabled (stays at centre),
// −1 = inverted axis effect. (x and y stay 0..1.)
export function interpolate(x, y, ax = 1, ay = 1) {
  const ex = 0.5 + (x - 0.5) * ax
  const ey = 0.5 + (y - 0.5) * ay
  const weights = [(1-ex)*(1-ey), ex*(1-ey), (1-ex)*ey, ex*ey]
  const result  = {}
  NUMERIC_KEYS.forEach(key => {
    result[key] = weights.reduce((sum, w, i) => sum + w * SOURCES[i][key], 0)
  })
  return result
}
