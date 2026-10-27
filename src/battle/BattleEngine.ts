import { MAX_LEVEL, POTION_HEAL, STAB, suongReward, xpToNext } from '../data/balance'
import { effectiveness } from '../data/elements'
import { getMove } from '../data/moves'
import {
  calcStats,
  displayName,
  evolutionChoice,
  getSpecies,
  movesAtLevel,
  movesUnlockedAt,
} from '../data/species'
import type { Tamon } from '../state/GameState'
import { makeId } from '../state/GameState'
import type { Element } from '../types'
import { mulberry32 } from '../util/rng'
import { computeDamage, damageRoll, stageMult } from './damage'

export type BattlePhase = 'command' | 'switch' | 'replace' | 'evolve' | 'growth' | 'wait' | 'done'
export type BattleResult = 'win' | 'lose' | 'run' | 'catch'

export type BattleEvent =
  | { t: 'text'; text: string }
  | { t: 'anim'; side: 'player' | 'enemy'; kind: 'atk' }
  | { t: 'hit'; side: 'player' | 'enemy'; hp: number; max: number; eff: number; quiet?: boolean }
  | { t: 'heal'; side: 'player' | 'enemy'; hp: number; max: number }
  | { t: 'hp'; side: 'player' | 'enemy'; hp: number; max: number }
  | { t: 'faint'; side: 'player' | 'enemy' }
  | { t: 'phase' }
  | { t: 'evolve'; from: string; to: string }
  | { t: 'switch' }
  | { t: 'catch' }
  | { t: 'end'; result: BattleResult; suong?: number; caught?: Tamon }

export interface FighterView {
  name: string
  speciesId: string
  gender: Tamon['gender']
  level: number
  hp: number
  max: number
  element: Element
  moves: string[]
  hoa: number
  chien: number
  xp: number
  xpNext: number
}

interface Stages {
  atk: number
  def: number
  spe: number
  spa: number
  spd: number
}

interface Fighter {
  ref: Tamon
  maxHp: number
  atk: number
  def: number
  spe: number
  spa: number
  spd: number
  element: Element
  stages: Stages
  burn: boolean
  para: boolean
  root: number
}

function emptyStages(): Stages {
  return { atk: 0, def: 0, spe: 0, spa: 0, spd: 0 }
}

function makeFighter(tamon: Tamon): Fighter {
  const stats = calcStats(getSpecies(tamon.speciesId).base, tamon.level)
  tamon.hp = Math.max(0, Math.min(tamon.hp, stats.hp))
  return {
    ref: tamon,
    maxHp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spe: stats.spe,
    spa: stats.spa,
    spd: stats.spd,
    element: getSpecies(tamon.speciesId).element,
    stages: emptyStages(),
    burn: false,
    para: false,
    root: 0,
  }
}

export function catchChance(hp: number, maxHp: number, rate: number): number {
  if (rate <= 0) return 0
  const missing = 1 - hp / Math.max(1, maxHp)
  return Math.min(0.92, Math.max(0.07, missing * 0.78 * rate + 0.05))
}

export class Battle {
  phase: BattlePhase = 'command'
  result: BattleResult | null = null
  private out: BattleEvent[] = []
  private playerF!: Fighter
  private enemyF!: Fighter
  private phased = false
  private pendingMove: string | null = null
  private lockedMove: string | null = null
  private pendingEvo: { hoa: string; chien: string } | null = null
  private pendingCatch: Tamon | null = null
  private evolvedThisLevel = false

  constructor(
    private party: Tamon[],
    private enemy: Tamon,
    readonly kind: 'wild' | 'boss' | 'pvp',
    private rng: () => number = Math.random,
  ) {}

  start(): BattleEvent[] {
    const idx = this.party.findIndex((tamon) => tamon.hp > 0)
    if (idx < 0) {
      this.phase = 'done'
      this.result = 'lose'
      this.out.push({ t: 'end', result: 'lose' })
      return this.take()
    }
    this.playerF = makeFighter(this.party[idx])
    this.enemyF = makeFighter(this.enemy)
    if (this.kind === 'boss') this.say('Korrath thức dậy trong hố!')
    else if (this.kind === 'pvp') this.say(`${displayName(this.enemy.speciesId, this.enemy.gender)} của đối thủ vào trận!`)
    else this.say(`${displayName(this.enemy.speciesId, this.enemy.gender)} hoang dã xuất hiện!`)
    this.phase = 'command'
    return this.take()
  }

  snapshot(): {
    phase: BattlePhase
    result: BattleResult | null
    kind: 'wild' | 'boss' | 'pvp'
    player: FighterView
    enemy: FighterView
    pendingMove: string | null
    pendingEvo: { hoa: string; chien: string } | null
  } {
    return {
      phase: this.phase,
      result: this.result,
      kind: this.kind,
      player: this.viewOf(this.playerF),
      enemy: this.viewOf(this.enemyF),
      pendingMove: this.pendingMove,
      pendingEvo: this.pendingEvo,
    }
  }

  useMove(id: string): BattleEvent[] {
    if (this.phase !== 'command') return this.take()
    if (!this.playerF.ref.moves.includes(id)) {
      this.say('Không dùng được đòn đó.')
      return this.take()
    }
    if (this.kind === 'pvp') {
      this.lockedMove = id
      this.phase = 'wait'
      this.say('Đợi đối thủ chọn đòn.')
      return this.take()
    }
    this.playTurn(id)
    return this.take()
  }

  receiveFoeMove(id: string, seed: number): BattleEvent[] {
    if (this.kind !== 'pvp' || this.phase !== 'wait' || !this.lockedMove) return []
    const mine = this.lockedMove
    this.lockedMove = null
    this.phase = 'command'
    this.rng = mulberry32(seed >>> 0)
    const foe = this.enemyF.ref.moves.includes(id) ? id : this.enemyF.ref.moves[0]
    this.playTurn(mine, foe)
    return this.take()
  }

  usePotion(): BattleEvent[] {
    if (this.phase !== 'command') return this.take()
    if (this.friendlyOnly()) return this.take()
    const room = this.playerF.maxHp - this.playerF.ref.hp
    if (room <= 0) {
      this.say('Máu đã đầy.')
      return this.take()
    }
    this.say(`${getSpecies(this.playerF.ref.speciesId).name} dùng Giọt Sương.`)
    this.heal(this.playerF, 'player', Math.min(POTION_HEAL, room))
    this.enemyRetaliate()
    return this.take()
  }

  throwSeed(): BattleEvent[] {
    if (this.phase !== 'command') return this.take()
    if (this.friendlyOnly()) return this.take()
    const rate = getSpecies(this.enemyF.ref.speciesId).catch
    if (rate <= 0) {
      this.say('Không thể giao ước.')
      return this.take()
    }
    const chance = catchChance(this.enemyF.ref.hp, this.enemyF.maxHp, rate)
    this.say('Hạt Ấn bay ra!')
    if (this.rng() < chance) {
      const src = this.enemyF.ref
      this.pendingCatch = {
        ...src,
        uid: makeId(this.rng),
        hp: Math.max(1, src.hp),
        hoa: 0,
        chien: 0,
        xp: 0,
        skipped: [],
        moves: [...src.moves],
      }
      this.say(`Giao ước thành với ${displayName(src.speciesId, src.gender)}!`)
      this.out.push({ t: 'catch' })
      const gain = Math.max(1, Math.floor((getSpecies(src.speciesId).yield * src.level) / 2))
      this.grantXp(gain)
      return this.take()
    }
    this.say('Hạt Ấn không giữ được!')
    this.enemyRetaliate()
    return this.take()
  }

  run(): BattleEvent[] {
    if (this.phase !== 'command') return this.take()
    if (this.friendlyOnly()) return this.take()
    if (this.kind === 'boss') {
      this.say('Không thoát được khỏi Hố.')
      return this.take()
    }
    this.say('Bạn rút khỏi cỏ.')
    this.phase = 'done'
    this.result = 'run'
    this.out.push({ t: 'end', result: 'run', suong: 0 })
    return this.take()
  }

  chooseMove(index: number | null): BattleEvent[] {
    if (this.phase !== 'replace' || !this.pendingMove) return this.take()
    const tamon = this.playerF.ref
    const moveId = this.pendingMove
    this.pendingMove = null
    if (index === null) {
      tamon.skipped.push(moveId)
      this.say(`${getSpecies(tamon.speciesId).name} không học ${getMove(moveId).name}.`)
    } else if (index >= 0 && index < tamon.moves.length) {
      const old = tamon.moves[index]
      tamon.moves[index] = moveId
      this.say(`Quên ${getMove(old).name}. Học ${getMove(moveId).name}!`)
    }
    this.phase = 'growth'
    if (this.offerMoves()) return this.take()
    if (this.offerEvo()) return this.take()
    this.growthContinue()
    return this.take()
  }

  chooseEvo(which: 'hoa' | 'chien'): BattleEvent[] {
    if (this.phase !== 'evolve' || !this.pendingEvo) return this.take()
    const id = which === 'hoa' ? this.pendingEvo.hoa : this.pendingEvo.chien
    this.pendingEvo = null
    if (this.applyEvo(id)) return this.take()
    this.growthContinue()
    return this.take()
  }

  chooseSwitch(index: number): BattleEvent[] {
    if (this.phase !== 'switch') return this.take()
    const tamon = this.party[index]
    if (!tamon || tamon.hp <= 0) {
      this.say('Tamon đó không còn sức.')
      return this.take()
    }
    this.playerF = makeFighter(tamon)
    this.phase = 'command'
    this.say(`${displayName(tamon.speciesId, tamon.gender)} vào trận!`)
    this.out.push({ t: 'switch' })
    return this.take()
  }

  private friendlyOnly() {
    if (this.kind !== 'pvp') return false
    this.say('Trận giao hữu chỉ chọn đòn.')
    return true
  }

  private playTurn(moveId: string, foeMove?: string) {
    const enemyMove = foeMove ?? this.pickEnemyMove()
    const playerSpeed = this.speed(this.playerF)
    const enemySpeed = this.speed(this.enemyF)
    let playerFirst = playerSpeed >= enemySpeed
    if (playerSpeed === enemySpeed && this.kind === 'pvp') playerFirst = this.playerF.ref.uid < this.enemyF.ref.uid
    const order: Array<'player' | 'enemy'> = playerFirst ? ['player', 'enemy'] : ['enemy', 'player']
    for (const who of order) {
      if (this.playerF.ref.hp <= 0 || this.enemyF.ref.hp <= 0) break
      if (who === 'player') this.perform(this.playerF, this.enemyF, moveId, 'player')
      else this.perform(this.enemyF, this.playerF, enemyMove, 'enemy')
    }
    this.afterAction()
  }

  private enemyRetaliate() {
    if (this.playerF.ref.hp <= 0 || this.enemyF.ref.hp <= 0) {
      this.afterAction()
      return
    }
    this.perform(this.enemyF, this.playerF, this.pickEnemyMove(), 'enemy')
    this.afterAction()
  }

  private afterAction() {
    if (this.playerF.ref.hp > 0 && this.enemyF.ref.hp > 0) this.endTurnStatus()
    if (this.enemyF.ref.hp <= 0) this.onEnemyFaint()
    else if (this.playerF.ref.hp <= 0) this.onPlayerFaint()
    else this.phase = 'command'
  }

  private perform(attacker: Fighter, defender: Fighter, moveId: string, side: 'player' | 'enemy') {
    const move = getMove(moveId)
    const other: 'player' | 'enemy' = side === 'player' ? 'enemy' : 'player'
    if (attacker.para && this.rng() < 0.25) {
      this.say(`${this.who(attacker)} bị tê, không cử động!`)
      return
    }
    this.out.push({ t: 'anim', side, kind: 'atk' })
    this.say(`${this.who(attacker)} dùng ${move.name}!`)
    let dealt = 0
    if (move.power > 0) {
      const category = move.category === 'physical' ? 'physical' : 'special'
      const stab = move.type !== 'none' && move.type === attacker.element ? STAB : 1
      const eff = effectiveness(move.type, defender.element)
      dealt = computeDamage({
        power: move.power,
        atk: this.offensive(attacker, category),
        def: this.defensive(defender, category),
        level: attacker.ref.level,
        stab,
        eff,
        roll: damageRoll(this.rng),
      })
      this.hurt(defender, other, dealt, eff, false)
      const mark = attacker === this.playerF && stab > 1 ? ' Chiến +1.' : ''
      if (attacker === this.playerF && stab > 1) attacker.ref.chien += 1
      if (eff > 1) this.say(`Rất hiệu quả!${mark}`)
      else if (eff < 1) this.say(`Không hiệu quả lắm...${mark}`)
      else if (mark) this.say('Chiến +1.')
    }
    if (move.heal && attacker.ref.hp > 0) {
      const amount = Math.max(1, Math.floor(attacker.maxHp * move.heal))
      this.heal(attacker, side, amount)
      this.say(`${this.who(attacker)} hồi sức.`)
    }
    if (move.stages) {
      const target = move.stages.target === 'self' ? attacker : defender
      const targetSide = move.stages.target === 'self' ? side : other
      if (target.ref.hp > 0) this.applyStage(target, move.stages.stat, move.stages.delta, targetSide)
    }
    if (move.status && defender.ref.hp > 0 && (move.power === 0 || this.rng() < move.status.chance)) {
      this.applyStatus(defender, move.status.id)
    }
    if (move.recoil && dealt > 0 && attacker.ref.hp > 0) {
      const recoil = Math.max(1, Math.floor(dealt * move.recoil))
      this.say(`${this.who(attacker)} bị sức đòn dội lại!`)
      this.hurt(attacker, side, recoil, 1, true)
    }
  }

  private endTurnStatus() {
    this.tickStatus(this.playerF, 'player')
    this.tickStatus(this.enemyF, 'enemy')
  }

  private tickStatus(fighter: Fighter, side: 'player' | 'enemy') {
    if (fighter.ref.hp <= 0) return
    if (fighter.burn) {
      const chip = Math.max(1, Math.floor(fighter.maxHp / 8))
      this.say(`${this.who(fighter)} bị bỏng rát!`)
      this.hurt(fighter, side, chip, 1, true)
    }
    if (fighter.ref.hp <= 0 || fighter.root <= 0) return
    const chip = Math.max(1, Math.floor(fighter.maxHp / 8))
    this.say(`${this.who(fighter)} bị rễ siết!`)
    this.hurt(fighter, side, chip, 1, true)
    fighter.root -= 1
  }

  private onEnemyFaint() {
    this.say(`${this.foeLabel()} ngất!`)
    this.out.push({ t: 'faint', side: 'enemy' })
    const tamon = this.playerF.ref
    tamon.chien += 2
    if (tamon.hp > 0) {
      tamon.hoa += 2
      this.say('Hòa +2, Chiến +2.')
    } else this.say('Chiến +2.')
    const full = getSpecies(this.enemyF.ref.speciesId).yield * this.enemyF.ref.level
    this.grantXp(this.kind === 'pvp' ? Math.max(1, Math.floor(full / 2)) : full)
  }

  private onPlayerFaint() {
    const tamon = this.playerF.ref
    this.say(`${displayName(tamon.speciesId, tamon.gender)} ngất!`)
    this.out.push({ t: 'faint', side: 'player' })
    if (!this.party.some((mon) => mon.hp > 0)) {
      this.say('Đội không còn đứng nổi...')
      this.phase = 'done'
      this.result = 'lose'
      this.out.push({ t: 'end', result: 'lose' })
      return
    }
    this.phase = 'switch'
    this.say('Chọn Tamon kế tiếp.')
  }

  private grantXp(amount: number) {
    const tamon = this.playerF.ref
    tamon.xp += amount
    this.say(`${getSpecies(tamon.speciesId).name} nhận ${amount} kinh nghiệm.`)
    this.growthContinue()
  }

  private growthContinue() {
    const tamon = this.playerF.ref
    while (tamon.xp >= xpToNext(tamon.level) && tamon.level < MAX_LEVEL) {
      tamon.xp -= xpToNext(tamon.level)
      tamon.level += 1
      this.evolvedThisLevel = false
      this.say(`${getSpecies(tamon.speciesId).name} lên cấp ${tamon.level}!`)
      this.syncLevel()
      this.out.push({ t: 'hp', side: 'player', hp: tamon.hp, max: this.playerF.maxHp })
      if (this.offerMoves()) return
      if (this.offerEvo()) return
    }
    this.afterGrowth()
  }

  private offerMoves(): boolean {
    const tamon = this.playerF.ref
    for (const moveId of movesUnlockedAt(tamon.speciesId, tamon.level)) {
      if (this.queueMove(moveId)) return true
    }
    return false
  }

  private offerEvo(): boolean {
    if (this.evolvedThisLevel) return false
    const tamon = this.playerF.ref
    const choice = evolutionChoice(tamon.speciesId, tamon.level, tamon.hoa, tamon.chien)
    if (!choice) return false
    this.evolvedThisLevel = true
    if (choice.mode === 'ask') {
      this.pendingEvo = { hoa: choice.hoa ?? '', chien: choice.chien ?? '' }
      this.phase = 'evolve'
      this.say('Thước Hòa và Chiến ngang nhau. Chọn dạng cuối.')
      return true
    }
    return this.applyEvo(choice.id ?? tamon.speciesId)
  }

  private applyEvo(nextId: string): boolean {
    const tamon = this.playerF.ref
    const from = tamon.speciesId
    const wasDown = tamon.hp <= 0
    const ratio = tamon.hp / Math.max(1, this.playerF.maxHp)
    tamon.speciesId = nextId
    const stats = calcStats(getSpecies(nextId).base, tamon.level)
    this.playerF.maxHp = stats.hp
    this.playerF.atk = stats.atk
    this.playerF.def = stats.def
    this.playerF.spe = stats.spe
    this.playerF.spa = stats.spa
    this.playerF.spd = stats.spd
    this.playerF.element = getSpecies(nextId).element
    tamon.hp = wasDown ? 0 : Math.max(1, Math.min(stats.hp, Math.round(ratio * stats.hp)))
    this.say(`${getSpecies(from).name} tiến hóa thành ${getSpecies(nextId).name}!`)
    this.out.push({ t: 'evolve', from, to: nextId })
    this.out.push({ t: 'hp', side: 'player', hp: tamon.hp, max: this.playerF.maxHp })
    const gift = getSpecies(nextId).gift
    if (gift) return this.queueMove(gift)
    return false
  }

  private queueMove(moveId: string): boolean {
    const tamon = this.playerF.ref
    if (tamon.moves.includes(moveId) || tamon.skipped.includes(moveId)) return false
    if (tamon.moves.length < 4) {
      tamon.moves.push(moveId)
      this.say(`${getSpecies(tamon.speciesId).name} học ${getMove(moveId).name}!`)
      return false
    }
    this.pendingMove = moveId
    this.phase = 'replace'
    this.say(`${getSpecies(tamon.speciesId).name} muốn học ${getMove(moveId).name}. Quên đòn nào?`)
    return true
  }

  private afterGrowth() {
    if (this.pendingCatch) {
      const caught = this.pendingCatch
      this.pendingCatch = null
      this.phase = 'done'
      this.result = 'catch'
      this.out.push({ t: 'end', result: 'catch', caught, suong: 0 })
      return
    }
    if (this.enemyF.ref.hp <= 0) {
      const suong = this.kind === 'pvp' ? 8 : suongReward(this.enemyF.ref.level, this.kind === 'boss')
      this.say(`Bạn nhận ${suong} Sương.`)
      this.phase = 'done'
      this.result = 'win'
      this.out.push({ t: 'end', result: 'win', suong })
      return
    }
    if (this.playerF.ref.hp <= 0) {
      this.onPlayerFaint()
      return
    }
    this.phase = 'command'
  }

  private syncLevel() {
    const fighter = this.playerF
    const stats = calcStats(getSpecies(fighter.ref.speciesId).base, fighter.ref.level)
    const gain = Math.max(0, stats.hp - fighter.maxHp)
    fighter.maxHp = stats.hp
    fighter.ref.hp = Math.min(stats.hp, fighter.ref.hp + gain)
    fighter.atk = stats.atk
    fighter.def = stats.def
    fighter.spe = stats.spe
    fighter.spa = stats.spa
    fighter.spd = stats.spd
    fighter.element = getSpecies(fighter.ref.speciesId).element
  }

  private hurt(target: Fighter, side: 'player' | 'enemy', amount: number, eff: number, quiet: boolean) {
    target.ref.hp = Math.max(0, target.ref.hp - amount)
    this.out.push({ t: 'hit', side, hp: target.ref.hp, max: target.maxHp, eff, quiet })
    this.maybePhase(target)
  }

  private heal(target: Fighter, side: 'player' | 'enemy', amount: number) {
    target.ref.hp = Math.min(target.maxHp, target.ref.hp + amount)
    this.out.push({ t: 'heal', side, hp: target.ref.hp, max: target.maxHp })
  }

  private maybePhase(target: Fighter) {
    if (this.phased || this.kind !== 'boss' || target !== this.enemyF) return
    if (target.ref.speciesId !== 'korrath') return
    if (target.ref.hp <= 0 || target.ref.hp > target.maxHp * 0.5) return
    this.phased = true
    const level = target.ref.level
    target.ref.speciesId = 'korrath-loi'
    target.ref.moves = movesAtLevel('korrath-loi', level)
    const stats = calcStats(getSpecies('korrath-loi').base, level)
    target.atk = stats.atk
    target.def = stats.def
    target.spe = stats.spe
    target.spa = stats.spa
    target.spd = stats.spd
    target.element = 'loi'
    target.stages = emptyStages()
    this.say('Lớp đá vỡ. Lõi Lôi của Korrath thức giấc!')
    this.out.push({ t: 'phase' })
  }

  private applyStage(target: Fighter, stat: keyof Stages, delta: number, _side: 'player' | 'enemy') {
    const before = target.stages[stat]
    const next = Math.max(-3, Math.min(3, before + delta))
    target.stages[stat] = next
    if (next === before) {
      this.say('Không ăn thua thêm.')
      return
    }
    const label = { atk: 'sức', def: 'giáp', spe: 'nhanh', spa: 'ý', spd: 'ý chí' }[stat]
    this.say(`${this.who(target)} ${delta > 0 ? 'tăng' : 'giảm'} ${label}!`)
  }

  private applyStatus(target: Fighter, id: 'burn' | 'para' | 'root') {
    if (id === 'burn') {
      if (target.burn) return
      target.burn = true
      this.say(`${this.who(target)} bị bỏng!`)
      return
    }
    if (id === 'para') {
      if (target.para) return
      target.para = true
      this.say(`${this.who(target)} bị tê!`)
      return
    }
    target.root = 3
    this.say(`${this.who(target)} bị rễ giữ chân!`)
  }

  private pickEnemyMove(): string {
    const moves = this.enemyF.ref.moves.map((id) => getMove(id))
    const ratio = this.enemyF.ref.hp / Math.max(1, this.enemyF.maxHp)
    if (ratio < 0.35) {
      const heal = moves.find((move) => move.heal)
      if (heal && this.rng() < 0.55) return heal.id
    }
    let best = moves[0]
    let bestScore = -Infinity
    for (const move of moves) {
      let score = 8
      if (move.power > 0) {
        const eff = effectiveness(move.type, this.playerF.element)
        const stab = move.type === this.enemyF.element ? STAB : 1
        score = move.power * eff * stab
      } else if (move.status?.id === 'burn' && !this.playerF.burn) score = 46
      else if (move.status?.id === 'para' && !this.playerF.para) score = 48
      else if (move.status?.id === 'root' && this.playerF.root <= 0) score = 40
      else if (move.heal) score = ratio < 0.6 ? 52 : 8
      else if (move.stages) score = 28
      score *= 0.85 + this.rng() * 0.3
      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }
    return best?.id ?? 'danh'
  }

  private speed(fighter: Fighter): number {
    const staged = fighter.spe * stageMult(fighter.stages.spe)
    return fighter.para ? staged * 0.5 : staged
  }

  private offensive(fighter: Fighter, category: 'physical' | 'special'): number {
    if (category === 'physical') return fighter.atk * stageMult(fighter.stages.atk)
    return fighter.spa * stageMult(fighter.stages.spa)
  }

  private defensive(fighter: Fighter, category: 'physical' | 'special'): number {
    if (category === 'physical') return fighter.def * stageMult(fighter.stages.def)
    return fighter.spd * stageMult(fighter.stages.spd)
  }

  private foeLabel(): string {
    if (this.kind === 'boss') return 'Korrath'
    return displayName(this.enemyF.ref.speciesId, this.enemyF.ref.gender)
  }

  private who(fighter: Fighter): string {
    if (fighter === this.enemyF && this.kind === 'boss') return 'Korrath'
    return displayName(fighter.ref.speciesId, fighter.ref.gender)
  }

  private viewOf(fighter: Fighter): FighterView {
    const tamon = fighter.ref
    return {
      name: getSpecies(tamon.speciesId).name,
      speciesId: tamon.speciesId,
      gender: tamon.gender,
      level: tamon.level,
      hp: tamon.hp,
      max: fighter.maxHp,
      element: fighter.element,
      moves: [...tamon.moves],
      hoa: tamon.hoa,
      chien: tamon.chien,
      xp: tamon.xp,
      xpNext: tamon.level >= MAX_LEVEL ? 0 : xpToNext(tamon.level),
    }
  }

  private say(text: string) {
    this.out.push({ t: 'text', text })
  }

  private take(): BattleEvent[] {
    const events = this.out
    this.out = []
    return events
  }
}
