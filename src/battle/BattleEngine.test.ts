import { describe, expect, it } from 'vitest'
import { Battle, catchChance } from '../battle/BattleEngine'
import { effectiveness } from '../data/elements'
import { getMove } from '../data/moves'
import { getSpecies, movesAtLevel, SPECIES } from '../data/species'
import { xpToNext } from '../data/balance'
import { computeDamage } from '../battle/damage'
import { createNewGame, createTamon, giveTamon, moveTamon, restAtWell } from '../state/GameState'
import { deserialize, serialize } from '../save/storage'
import { MAPS, SPAWN, tileAt, isBlocked, isSolidTile } from '../world/maps'
import { clickRoute } from '../world/path'
import { rollWild } from '../world/encounters'
import { mulberry32 } from '../util/rng'
import type { Tamon } from '../state/GameState'
import type { BattleEvent } from '../battle/BattleEngine'
import type { Element } from '../types'

const ELEMENTS: Element[] = ['diem', 'kha', 'trieu', 'nham', 'loi']

function texts(events: BattleEvent[]): string {
  return events
    .filter((event) => event.t === 'text')
    .map((event) => (event.t === 'text' ? event.text : ''))
    .join(' | ')
}

function bestMove(battle: Battle): string {
  const snap = battle.snapshot()
  let best = snap.player.moves[0]
  let score = -1
  for (const id of snap.player.moves) {
    const move = getMove(id)
    if (move.power <= 0) continue
    const eff = effectiveness(move.type, snap.enemy.element)
    const stab = move.type === snap.player.element ? 1.25 : 1
    const value = move.power * eff * stab
    if (value > score) {
      score = value
      best = id
    }
  }
  return best
}

function fight(party: Tamon[], foe: Tamon, kind: 'wild' | 'boss', rng: () => number, potions = 6) {
  const battle = new Battle(party, foe, kind, rng)
  const log: BattleEvent[] = []
  log.push(...battle.start())
  let left = potions
  for (let turn = 0; turn < 40 && battle.phase !== 'done'; turn++) {
    if (battle.phase === 'replace') log.push(...battle.chooseMove(0))
    else if (battle.phase === 'evolve') {
      const snap = battle.snapshot()
      log.push(...battle.chooseEvo(snap.player.hoa >= snap.player.chien ? 'hoa' : 'chien'))
    } else if (battle.phase === 'switch') {
      const idx = party.findIndex((mon) => mon.hp > 0)
      if (idx < 0) break
      log.push(...battle.chooseSwitch(idx))
    } else if (battle.phase === 'command') {
      const snap = battle.snapshot()
      if (left > 0 && snap.player.hp < snap.player.max * 0.45) {
        left -= 1
        log.push(...battle.usePotion())
      } else log.push(...battle.useMove(bestMove(battle)))
    } else break
  }
  return { battle, log, left }
}

describe('ngũ hành', () => {
  it('mỗi hệ khắc một và bị một hệ khắc', () => {
    for (const element of ELEMENTS) {
      const strong = ELEMENTS.filter((other) => effectiveness(element, other) === 1.8)
      const weak = ELEMENTS.filter((other) => effectiveness(element, other) === 0.55)
      expect(strong).toHaveLength(1)
      expect(weak).toHaveLength(1)
      expect(effectiveness(element, element)).toBe(1)
    }
    expect(effectiveness('diem', 'kha')).toBe(1.8)
    expect(effectiveness('loi', 'diem')).toBe(1.8)
    expect(effectiveness('none', 'diem')).toBe(1)
  })

  it('khắc gây nhiều sát thương hơn bị khắc', () => {
    const base = { power: 80, atk: 50, def: 50, level: 16, roll: 1 }
    const superHit = computeDamage({ ...base, stab: 1, eff: 1.8 })
    const normal = computeDamage({ ...base, stab: 1, eff: 1 })
    const resist = computeDamage({ ...base, stab: 1, eff: 0.55 })
    expect(superHit).toBeGreaterThan(normal)
    expect(normal).toBeGreaterThan(resist)
    expect(computeDamage({ ...base, stab: 1.25, eff: 1 })).toBeGreaterThan(normal)
  })
})

describe('loài', () => {
  it('mọi đường tiến hóa và đòn đều có thật', () => {
    for (const species of SPECIES) {
      expect(species.base.hp).toBeGreaterThan(0)
      for (const row of species.learn) expect(getMove(row.move).id).toBe(row.move)
      if (species.gift) expect(getMove(species.gift).id).toBe(species.gift)
      if (!species.evo) continue
      if ('into' in species.evo) expect(getSpecies(species.evo.into).id).toBe(species.evo.into)
      else {
        expect(getSpecies(species.evo.hoa).id).toBe(species.evo.hoa)
        expect(getSpecies(species.evo.chien).id).toBe(species.evo.chien)
      }
    }
    const sum = (id: string) => Object.values(getSpecies(id).base).reduce((a, b) => a + b, 0)
    expect(sum('solmi')).toBe(500)
    expect(sum('solvyr')).toBe(500)
    expect(sum('luma')).toBe(280)
    expect(movesAtLevel('luma', 5)).toEqual(['danh', 'tan-lua', 'hoi-giot'])
  })
})

describe('trận', () => {
  it('Zzip tiến hóa khi đủ cấp', () => {
    const zzip = createTamon('zzip', 17, 'f', () => 0.2)
    zzip.xp = xpToNext(17) - 1
    const foe = createTamon('pebbo', 2, 'm', () => 0.9)
    foe.hp = 1
    const battle = new Battle([zzip], foe, 'wild', () => 0.4)
    battle.start()
    const events = battle.useMove('tia')
    expect(zzip.speciesId).toBe('zzaprel')
    expect(events.some((event) => event.t === 'evolve' && event.to === 'zzaprel')).toBe(true)
    expect(battle.result).toBe('win')
  })

  it('hòa thước thì người chơi chọn, lệch thì tự chọn', () => {
    const tie = createTamon('lumara', 25, 'f', () => 0.2)
    tie.hoa = 4
    tie.chien = 4
    tie.xp = xpToNext(25) - 1
    tie.moves = ['danh', 'bung-chay', 'thu', 'hoi-giot']
    const foe = createTamon('zzip', 3, 'm', () => 0.8)
    foe.hp = 1
    const battle = new Battle([tie], foe, 'wild', () => 0.4)
    battle.start()
    battle.useMove('danh')
    expect(battle.phase).toBe('evolve')
    battle.chooseEvo('hoa')
    expect(tie.speciesId).toBe('solmi')
    if (battle.phase === 'replace') battle.chooseMove(0)
    expect(tie.moves).toContain('binh-minh')

    const fierce = createTamon('lumara', 25, 'm', () => 0.2)
    fierce.hoa = 0
    fierce.chien = 8
    fierce.xp = xpToNext(25) - 1
    fierce.moves = ['danh', 'hoi-giot', 'thu', 'bung-chay']
    const foe2 = createTamon('zzip', 3, 'f', () => 0.8)
    foe2.hp = 1
    const battle2 = new Battle([fierce], foe2, 'wild', () => 0.4)
    battle2.start()
    battle2.useMove('danh')
    expect(fierce.speciesId).toBe('solvyr')
  })

  it('bắt dễ hơn khi máu thấp và boss không bắt được', () => {
    const low = catchChance(1, 30, 1.15)
    const high = catchChance(30, 30, 1.15)
    expect(low).toBeGreaterThan(high)
    expect(catchChance(1, 30, 1.15)).toBeGreaterThan(catchChance(1, 30, 0.6))
    expect(catchChance(1, 100, 0)).toBe(0)
    const boss = createTamon('korrath', 18, 'm')
    const hero = createTamon('luma', 8, 'f')
    const battle = new Battle([hero], boss, 'boss', () => 0)
    battle.start()
    const events = battle.throwSeed()
    expect(texts(events)).toContain('Không thể giao ước')
    expect(battle.phase).toBe('command')
  })

  it('Korrath đổi sang Lôi rồi có thể bị hạ', () => {
    const rng = mulberry32(4)
    const party = [createTamon('lumara', 16, 'f', rng), createTamon('pebbo', 16, 'm', rng)]
    const boss = createTamon('korrath', 18, 'm', rng)
    const { battle, log } = fight(party, boss, 'boss', rng, 10)
    const phased = log.some((event) => event.t === 'phase')
    expect(phased, texts(log)).toBe(true)
    expect(battle.result, texts(log)).toBe('win')
    expect(boss.speciesId).toBe('korrath-loi')
  })

  it('nuôi Luma tới Lumara trong vài trận cỏ', () => {
    const rng = mulberry32(2)
    const state = createNewGame('Mai', 'luma', rng)
    let fights = 0
    while (state.party[0].level < 14 && fights < 24) {
      state.party[0].hp = 999
      const foe = rollWild(6, rng)
      const { battle } = fight(state.party, foe, 'wild', rng, 4)
      if (battle.result === 'win') state.suong += 8
      fights += 1
    }
    expect(state.party[0].speciesId).toBe('lumara')
    expect(fights).toBeLessThan(16)
  })
})

describe('đội và bản đồ', () => {
  it('đầy đội thì vào rương, không bỏ trống đội', () => {
    const rng = mulberry32(1)
    const state = createNewGame('Mai', 'luma', rng)
    for (let i = 0; i < 3; i++) expect(giveTamon(state, createTamon('zzip', 3, 'm', rng))).toBe('party')
    expect(giveTamon(state, createTamon('pebbo', 4, 'f', rng))).toBe('chest')
    const error = moveTamon(state, { box: 'party', index: 0 }, { box: 'chest', index: state.chest.length })
    expect(error).toBeNull()
    expect(state.party.length).toBe(3)
    const saved = deserialize(serialize(state))
    expect(saved?.name).toBe('Mai')
    expect(saved?.party).toHaveLength(3)
    expect(deserialize('{')).toBeNull()
  })

  it('giếng chỉ tăng Hòa sau một trận', () => {
    const state = createNewGame('Mai', 'bubblin', () => 0.1)
    restAtWell(state)
    expect(state.party[0].hoa).toBe(0)
    state.flags.restReady = true
    state.party[0].hp = 1
    restAtWell(state)
    expect(state.party[0].hp).toBeGreaterThan(1)
    expect(state.party[0].hoa).toBe(2)
    restAtWell(state)
    expect(state.party[0].hoa).toBe(2)
  })

  it('làng và lối cỏ đi được', () => {
    for (const map of Object.values(MAPS)) {
      const width = map.rows[0].length
      expect(map.rows.every((row) => row.length === width)).toBe(true)
      for (const npc of map.npcs) expect(isSolidTile(tileAt(map, npc.x, npc.y))).toBe(false)
    }
    expect(tileAt(MAPS.village, 23, 10)).toBe('E')
    expect(tileAt(MAPS.village, 19, 4)).toBe('W')
    expect(tileAt(MAPS.route, 0, 6)).toBe('V')
    expect(tileAt(MAPS.route, 44, 6)).toBe('P')
    for (const spot of Object.values(SPAWN)) {
      expect(isBlocked(MAPS[spot.map], spot.x, spot.y)).toBe(false)
    }
    const rng = mulberry32(9)
    const early = Array.from({ length: 40 }, () => rollWild(4, rng).speciesId)
    expect(early.filter((id) => id === 'zzip').length).toBeGreaterThan(20)
  })

  it('chuột đi tới ô trống và tới cạnh người', () => {
    expect(clickRoute(MAPS.village, 4, 6, 6, 6)).toMatchObject({ dirs: [3, 3], talk: false })
    expect(clickRoute(MAPS.village, 4, 6, 4, 5)).toEqual({ dirs: [], talk: true, face: 1 })
  })

  it('giao hữu cùng hạt giống thì máu khớp', () => {
    const leftMon = createTamon('luma', 8, 'm', () => 0.2)
    const rightMon = createTamon('luma', 8, 'f', () => 0.8)
    const leftCopy = structuredClone(leftMon)
    const rightCopy = structuredClone(rightMon)
    const before = leftMon.hp
    const left = new Battle([leftMon], rightCopy, 'pvp')
    const right = new Battle([rightMon], leftCopy, 'pvp')
    left.start()
    right.start()
    left.useMove('danh')
    right.useMove('danh')
    left.receiveFoeMove('danh', 9)
    right.receiveFoeMove('danh', 9)
    expect(leftMon.hp).toBe(leftCopy.hp)
    expect(rightMon.hp).toBe(rightCopy.hp)
    expect(leftMon.hp).toBeLessThan(before)
  })
})