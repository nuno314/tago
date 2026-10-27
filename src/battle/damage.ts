export function stageMult(stage: number): number {
  const s = Math.max(-3, Math.min(3, stage))
  if (s >= 0) return (2 + s) / 2
  return 2 / (2 - s)
}

export function damageRoll(rng: () => number): number {
  return 0.9 + rng() * 0.1
}

/** Sát thương gọn để trận cỏ kết thúc vài lượt, vẫn giữ ×1.8 và ×0.55. */
export function computeDamage(opts: {
  power: number
  atk: number
  def: number
  level: number
  stab: number
  eff: number
  roll: number
}): number {
  const levelFactor = 0.72 + opts.level * 0.018
  const ratio = opts.atk / Math.max(1, opts.def)
  const raw = opts.power * 0.24 * ratio * levelFactor * opts.stab * opts.eff * opts.roll
  return Math.max(1, Math.floor(raw))
}
