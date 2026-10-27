import type { Keys } from './text'
import { pressed } from './text'

export type Act = 'up' | 'down' | 'left' | 'right' | 'z' | 'x' | 'enter'

const down = new Set<Act>()
const pulse = new Set<Act>()

export function typing(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA'
}

export function press(act: Act) {
  down.add(act)
  pulse.add(act)
}

export function release(act: Act) {
  down.delete(act)
}

export function poke(act: Act) {
  pulse.add(act)
}

export function releaseAll() {
  down.clear()
  pulse.clear()
}

export function holding(act: Act): boolean {
  if (typing()) return false
  const pulsed = pulse.delete(act)
  return down.has(act) || pulsed
}

export function hit(keys: Keys, act: Act): boolean {
  if (typing()) return false
  return pressed(keys[act]) || pulse.delete(act)
}
