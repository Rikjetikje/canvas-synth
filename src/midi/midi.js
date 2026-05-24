let midiAccess = null
let activeInput = null
let onNoteOn = null
let onNoteOff = null
let onDevicesChange = null

export async function initMIDI({ noteOn, noteOff, devicesChange }) {
  onNoteOn = noteOn
  onNoteOff = noteOff
  onDevicesChange = devicesChange

  if (!navigator.requestMIDIAccess) {
    return { supported: false }
  }

  try {
    midiAccess = await navigator.requestMIDIAccess()
    midiAccess.onstatechange = () => {
      onDevicesChange?.(getInputs())
    }
    return { supported: true, inputs: getInputs() }
  } catch (err) {
    const denied = err?.name === 'SecurityError' || err?.name === 'NotAllowedError'
    return { supported: false, denied }
  }
}

export function connectInput(input) {
  if (activeInput) activeInput.onmidimessage = null
  activeInput = input
  if (input) input.onmidimessage = handleMessage
}

export function getInputs() {
  if (!midiAccess) return []
  return [...midiAccess.inputs.values()]
}

function handleMessage(event) {
  const [status, note, velocity] = event.data
  const type = status & 0xf0

  if (type === 0x90 && velocity > 0) {
    onNoteOn?.(note, velocity / 127)
  } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
    onNoteOff?.(note)
  }
}
