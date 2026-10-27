import { createTamon, type Tamon } from '../state/GameState'

export function rollWild(tileX: number, rng: () => number = Math.random): Tamon {
  const roll = rng()
  if (tileX < 18) {
    if (roll < 0.88) return createTamon('zzip', 3 + Math.floor(rng() * 3), undefined, rng)
    return createTamon('pebbo', 4 + Math.floor(rng() * 2), undefined, rng)
  }
  if (tileX < 32) {
    if (roll < 0.62) return createTamon('zzip', 6 + Math.floor(rng() * 5), undefined, rng)
    return createTamon('pebbo', 7 + Math.floor(rng() * 4), undefined, rng)
  }
  if (roll < 0.7) return createTamon('pebbo', 10 + Math.floor(rng() * 5), undefined, rng)
  return createTamon('zzip', 8 + Math.floor(rng() * 3), undefined, rng)
}
