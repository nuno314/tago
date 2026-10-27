import type { Tamon } from '../state/GameState'

export interface PendingBattle {
  kind: 'wild' | 'boss' | 'pvp'
  enemy: Tamon
  pvpId?: string
  foeName?: string
}

let pending: PendingBattle | null = null

export function setPendingBattle(battle: PendingBattle) {
  pending = battle
}

export function takePendingBattle(): PendingBattle | null {
  const value = pending
  pending = null
  return value
}
