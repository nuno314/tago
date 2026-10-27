import { MAX_LEVEL } from '../src/data/balance'
import { movesAtLevel, maxHpOf, getSpecies } from '../src/data/species'
import { getMove } from '../src/data/moves'
import type { GameState, Tamon } from '../src/state/GameState'

export function legalLead(save: GameState | null): Tamon | null {
  const raw = save?.party?.[0]
  if (!raw || raw.hp <= 0) return null
  try {
    getSpecies(raw.speciesId)
  } catch {
    return null
  }
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(raw.level) || 1))
  const allowed = new Set(movesAtLevel(raw.speciesId, level))
  const moves = (raw.moves ?? []).filter((id) => {
    if (!allowed.has(id)) return false
    try {
      getMove(id)
      return true
    } catch {
      return false
    }
  }).slice(0, 4)
  const known = moves.length > 0 ? moves : movesAtLevel(raw.speciesId, level).slice(0, 4)
  if (known.length < 1) return null
  const max = maxHpOf(raw.speciesId, level)
  return {
    uid: typeof raw.uid === 'string' && raw.uid ? raw.uid : `pvp-${raw.speciesId}`,
    speciesId: raw.speciesId,
    gender: raw.gender === 'f' ? 'f' : 'm',
    level,
    xp: 0,
    hp: Math.max(1, Math.min(max, Math.floor(raw.hp) || 1)),
    moves: known,
    hoa: Math.max(0, Math.min(99, Math.floor(raw.hoa) || 0)),
    chien: Math.max(0, Math.min(99, Math.floor(raw.chien) || 0)),
    skipped: [],
  }
}
