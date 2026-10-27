let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function unlockAudio() {
  ac()
}

function tone(freq: number, dur = 0.08, type: OscillatorType = 'square', gain = 0.045) {
  const context = ac()
  if (!context) return
  const osc = context.createOscillator()
  const amp = context.createGain()
  osc.type = type
  osc.frequency.value = freq
  amp.gain.setValueAtTime(gain, context.currentTime)
  amp.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur)
  osc.connect(amp).connect(context.destination)
  osc.start()
  osc.stop(context.currentTime + dur)
}

export const sfx = {
  confirm: () => tone(520, 0.05),
  cancel: () => tone(180, 0.06, 'triangle'),
  bump: () => tone(90, 0.04, 'square', 0.03),
  hit: () => tone(160, 0.07),
  super: () => {
    tone(620, 0.07)
    setTimeout(() => tone(840, 0.09), 60)
  },
  resist: () => tone(120, 0.09, 'triangle'),
  heal: () => tone(740, 0.1, 'sine'),
  catch: () => {
    ;[523, 659, 784].forEach((freq, index) => setTimeout(() => tone(freq, 0.1, 'square', 0.05), index * 90))
  },
  fail: () => tone(110, 0.14, 'sawtooth', 0.03),
  faint: () => tone(280, 0.18, 'triangle'),
  evolve: () => {
    ;[523, 659, 784, 1046].forEach((freq, index) => setTimeout(() => tone(freq, 0.12, 'square', 0.05), index * 110))
  },
  phase: () => {
    tone(80, 0.18, 'sawtooth', 0.04)
    setTimeout(() => tone(440, 0.14), 160)
  },
}
