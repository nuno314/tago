import type { GameState } from '../state/GameState'

const SAVE_KEY = 'tago-save-v1'

export function serialize(state: GameState): string {
  return JSON.stringify(state)
}

export function deserialize(raw: string): GameState | null {
  try {
    const data = JSON.parse(raw) as GameState
    if (!data || data.version !== 1 || !Array.isArray(data.party) || data.party.length < 1) return null
    data.notice ??= ''
    data.calm ??= 0
    data.flags ??= { intro: true, boss: false, restReady: false }
    for (const tamon of [...data.party, ...(data.chest ?? [])]) {
      tamon.skipped ??= []
      tamon.moves ??= []
      tamon.hoa ??= 0
      tamon.chien ??= 0
    }
    data.chest ??= []
    data.seen ??= []
    data.caught ??= []
    return data
  } catch {
    return null
  }
}

let cloud: ((state: GameState) => void) | null = null

export function setCloudSync(fn: (state: GameState) => void) {
  cloud = fn
}

export function saveGame(state: GameState) {
  localStorage.setItem(SAVE_KEY, serialize(state))
  cloud?.(state)
}

export function installSave(state: GameState) {
  localStorage.setItem(SAVE_KEY, serialize(state))
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return deserialize(raw)
  } catch {
    return null
  }
}

export function hasSave(): boolean {
  return loadGame() !== null
}
