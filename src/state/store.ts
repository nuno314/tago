import type { GameState } from '../state/GameState'

let current: GameState | null = null

export function getState(): GameState {
  if (!current) throw new Error('Chưa có cuộc chơi')
  return current
}

export function setState(state: GameState) {
  current = state
}

export function peekState(): GameState | null {
  return current
}
