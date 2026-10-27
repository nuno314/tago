import { CHEST_MAX, PARTY_MAX, POTION_PRICE, SEED_PRICE, START_POTIONS, START_SEEDS } from '../data/balance'
import { getSpecies, maxHpOf, movesAtLevel } from '../data/species'
import type { Gender } from '../types'
import { SPAWN, type MapId } from '../world/maps'

export interface Tamon {
  uid: string
  speciesId: string
  gender: Gender
  level: number
  xp: number
  hp: number
  moves: string[]
  hoa: number
  chien: number
  skipped: string[]
}

export interface GameState {
  version: 1
  name: string
  suong: number
  seeds: number
  potions: number
  party: Tamon[]
  chest: Tamon[]
  seen: string[]
  caught: string[]
  flags: { intro: boolean; boss: boolean; restReady: boolean }
  pos: { map: MapId; x: number; y: number; dir: number }
  calm: number
  notice: string
}

let seq = 0

export function makeId(rng: () => number = Math.random): string {
  seq += 1
  return `t${seq.toString(36)}${Math.floor(rng() * 1e6).toString(36)}`
}

export function createTamon(speciesId: string, level: number, gender?: Gender, rng: () => number = Math.random): Tamon {
  const lv = Math.max(1, Math.min(40, level))
  const g: Gender = gender ?? (rng() < 0.5 ? 'm' : 'f')
  const hp = maxHpOf(speciesId, lv)
  return {
    uid: makeId(rng),
    speciesId,
    gender: g,
    level: lv,
    xp: 0,
    hp,
    moves: movesAtLevel(speciesId, lv),
    hoa: 0,
    chien: 0,
    skipped: [],
  }
}

export function createNewGame(name: string, starterId: string, rng: () => number = Math.random): GameState {
  const starter = createTamon(starterId, 5, undefined, rng)
  const state: GameState = {
    version: 1,
    name: name.trim().slice(0, 12) || 'Giữ',
    suong: 0,
    seeds: START_SEEDS,
    potions: START_POTIONS,
    party: [starter],
    chest: [],
    seen: [],
    caught: [],
    flags: { intro: false, boss: false, restReady: false },
    pos: { ...SPAWN.villageStart },
    calm: 2,
    notice: '',
  }
  markCaught(state, starter.speciesId)
  return state
}

export function markSeen(state: GameState, speciesId: string) {
  if (!state.seen.includes(speciesId)) state.seen.push(speciesId)
}

export function markCaught(state: GameState, speciesId: string) {
  markSeen(state, speciesId)
  if (!state.caught.includes(speciesId)) state.caught.push(speciesId)
}

export function giveTamon(state: GameState, tamon: Tamon): 'party' | 'chest' | 'full' {
  markCaught(state, tamon.speciesId)
  if (state.party.length < PARTY_MAX) {
    state.party.push(tamon)
    return 'party'
  }
  if (state.chest.length < CHEST_MAX) {
    state.chest.push(tamon)
    return 'chest'
  }
  return 'full'
}

export function restAtWell(state: GameState): { bonded: boolean } {
  const bonded = state.flags.restReady
  for (const tamon of state.party) {
    tamon.hp = maxHpOf(tamon.speciesId, tamon.level)
    if (bonded) tamon.hoa += 2
  }
  state.flags.restReady = false
  return { bonded }
}

export function buy(state: GameState, item: 'seed' | 'potion'): string | null {
  const price = item === 'seed' ? SEED_PRICE : POTION_PRICE
  if (state.suong < price) return 'Không đủ Sương.'
  state.suong -= price
  if (item === 'seed') state.seeds += 1
  else state.potions += 1
  return null
}

export function usePotionOn(state: GameState, index: number): string | null {
  const tamon = state.party[index]
  if (!tamon) return 'Không có Tamon này.'
  if (state.potions <= 0) return 'Hết Giọt Sương.'
  const max = maxHpOf(tamon.speciesId, tamon.level)
  if (tamon.hp >= max) return 'Máu đã đầy.'
  state.potions -= 1
  tamon.hp = Math.min(max, tamon.hp + 30)
  return null
}

export interface Slot {
  box: 'party' | 'chest'
  index: number
}

function listOf(state: GameState, box: Slot['box']): Tamon[] {
  return box === 'party' ? state.party : state.chest
}

export function moveTamon(state: GameState, from: Slot, to: Slot): string | null {
  const source = listOf(state, from.box)
  const dest = listOf(state, to.box)
  const moving = source[from.index]
  if (!moving) return 'Không có Tamon để chuyển.'
  if (from.box === to.box && from.index === to.index) return null

  const destTamon = dest[to.index]
  if (destTamon) {
    source[from.index] = destTamon
    dest[to.index] = moving
    return null
  }

  if (to.box === 'chest' && to.index === state.chest.length) {
    if (from.box === 'party' && state.party.length <= 1) return 'Đội cần ít nhất một Tamon.'
    source.splice(from.index, 1)
    state.chest.push(moving)
    return null
  }
  if (to.box === 'party' && to.index === state.party.length) {
    if (state.party.length >= PARTY_MAX) return 'Đội đã đủ bốn con.'
    source.splice(from.index, 1)
    state.party.push(moving)
    return null
  }
  return 'Không bỏ vào ô đó được.'
}

export function leadTamon(state: GameState, index: number) {
  if (index <= 0 || index >= state.party.length) return
  const [tam] = state.party.splice(index, 1)
  state.party.unshift(tam)
}

export function releaseTamon(state: GameState, slot: Slot): string | null {
  const list = listOf(state, slot.box)
  if (!list[slot.index]) return 'Không có Tamon này.'
  if (slot.box === 'party' && state.party.length <= 1 && state.chest.length === 0) {
    return 'Không thả Tamon cuối cùng.'
  }
  if (slot.box === 'party' && state.party.length <= 1) return 'Hãy để lại một con trong đội.'
  list.splice(slot.index, 1)
  return null
}

export function speciesName(id: string): string {
  return getSpecies(id).name
}
