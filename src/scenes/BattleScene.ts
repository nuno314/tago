import Phaser from 'phaser'
import { sfx } from '../audio/sfx'
import { Battle, type BattleEvent } from '../battle/BattleEngine'
import { takePendingBattle } from '../battle/pending'
import { ELEMENT_COLOR, ELEMENT_NAME, chartPairs } from '../data/elements'
import { getMove, moveHint } from '../data/moves'
import { displayName, getSpecies } from '../data/species'
import { saveGame } from '../save/storage'
import { giveTamon, markCaught, markSeen, releaseTamon, type Slot } from '../state/GameState'
import { getState } from '../state/store'
import { drainNet, onNet, sendBattleMove, sendDone } from '../net/client'
import type { ServerMsg } from '../net/messages'
import { hit, typing } from '../ui/pad'
import { bindKeys, paintBar, paintMeter, txt, type Keys } from '../ui/text'
import { SPAWN } from '../world/maps'
import { playCreature } from './BootScene'

interface Choice {
  id: string
  label: string
  hint: string
  slot?: Slot
}

export class BattleScene extends Phaser.Scene {
  private keys!: Keys
  private battle!: Battle
  private kind: 'wild' | 'boss' | 'pvp' = 'wild'
  private pvpId = ''
  private offNet = () => {}
  private queue: BattleEvent[] = []
  private timer?: Phaser.Time.TimerEvent
  private waiting = false
  private ui: 'command' | 'move' | 'replace' | 'evolve' | 'switch' | 'room' = 'command'
  private cursor = 0
  private choices: Choice[] = []
  private choiceTexts: Phaser.GameObjects.Text[] = []
  private choiceGfx!: Phaser.GameObjects.Graphics
  private message!: Phaser.GameObjects.Text
  private enemyName!: Phaser.GameObjects.Text
  private playerName!: Phaser.GameObjects.Text
  private enemyBar!: Phaser.GameObjects.Graphics
  private playerBar!: Phaser.GameObjects.Graphics
  private enemySprite!: Phaser.GameObjects.Sprite
  private playerSprite!: Phaser.GameObjects.Sprite
  private meters!: Phaser.GameObjects.Text
  private xpText!: Phaser.GameObjects.Text
  private playerXp!: Phaser.GameObjects.Graphics
  private leaving = false

  constructor() {
    super('battle')
  }

  create() {
    const pending = takePendingBattle()
    if (!pending) {
      this.scene.start('world')
      return
    }
    this.kind = pending.kind
    this.pvpId = pending.pvpId ?? ''
    this.leaving = false
    this.waiting = false
    const state = getState()
    markSeen(state, pending.enemy.speciesId)
    const roster = pending.kind === 'pvp' ? [state.party[0]] : state.party
    this.battle = new Battle(roster, pending.enemy, pending.kind)
    this.keys = bindKeys(this)
    this.offNet = onNet((msg) => this.onNetMsg(msg))
    for (const msg of drainNet((item) => (item.t === 'go' || item.t === 'abort') && item.battle === this.pvpId)) {
      this.onNetMsg(msg)
    }
    this.events.once('shutdown', () => this.offNet())
    this.drawBackdrop()
    let chartX = 6
    for (const pair of chartPairs()) {
      const label = txt(this, chartX, 1, `${ELEMENT_NAME[pair.from]}→${ELEMENT_NAME[pair.to]}`, 8, ELEMENT_COLOR[pair.from])
      chartX += label.width + 6
    }
    this.enemyName = txt(this, 8, 16, '', 10)
    this.enemyBar = this.add.graphics()
    this.playerName = txt(this, 96, 88, '', 10)
    this.playerBar = this.add.graphics()
    this.playerXp = this.add.graphics()
    this.xpText = txt(this, 168, 112, '', 8, '#b7dcff')
    this.meters = txt(this, 96, 120, '', 8, '#d5c4e0')
    this.message = txt(this, 10, 158, '', 10, '#fff6ea', 364)
    this.choiceGfx = this.add.graphics().setDepth(5)
    this.enemySprite = this.add.sprite(328, 86, pending.enemy.speciesId).setOrigin(0.5, 1)
    this.playerSprite = this.add.sprite(46, 148, state.party[0].speciesId).setOrigin(0.5, 1)
    this.queue = this.battle.start()
    this.refreshActors()
    this.pump()
    this.input.on('pointerdown', () => {
      if (this.leaving || this.waiting || typing() || !this.timer) return
      this.timer.remove(false)
      this.timer = undefined
      this.pump()
    })
  }

  private onNetMsg(msg: ServerMsg) {
    if (msg.t === 'go' && msg.battle === this.pvpId) {
      const events = this.battle.receiveFoeMove(msg.foeMove, msg.seed)
      if (!events.length) return
      this.queue.push(...events)
      if (!this.timer && !this.waiting && !this.leaving) this.pump()
      return
    }
    if (msg.t === 'abort' && msg.battle === this.pvpId) {
      const state = getState()
      state.notice = msg.text
      saveGame(state)
      this.leave()
    }
  }

  update() {
    if (this.leaving || typing()) return
    if (this.timer && (hit(this.keys, 'z') || hit(this.keys, 'enter'))) {
      this.timer.remove(false)
      this.timer = undefined
      this.pump()
      return
    }
    if (!this.waiting) return
    const cols = this.ui === 'command' || this.ui === 'move' ? 2 : 1
    const count = this.choices.length
    if (hit(this.keys, 'left') || (cols === 1 && hit(this.keys, 'up'))) {
      this.cursor = (this.cursor - 1 + count) % count
      sfx.confirm()
      this.drawChoices()
    } else if (hit(this.keys, 'right') || (cols === 1 && hit(this.keys, 'down'))) {
      this.cursor = (this.cursor + 1) % count
      sfx.confirm()
      this.drawChoices()
    } else if (cols === 2 && hit(this.keys, 'up')) {
      this.cursor = Math.max(0, this.cursor - 2)
      this.drawChoices()
    } else if (cols === 2 && hit(this.keys, 'down')) {
      this.cursor = Math.min(count - 1, this.cursor + 2)
      this.drawChoices()
    } else if (hit(this.keys, 'x') && this.ui === 'move') {
      this.ui = 'command'
      this.cursor = 0
      this.buildChoices()
      sfx.cancel()
    } else if ((hit(this.keys, 'z') || hit(this.keys, 'enter')) && count) {
      sfx.confirm()
      this.confirm()
    }
  }

  private showLine(text: string) {
    this.choiceGfx.clear()
    this.choiceTexts.forEach((label) => label.destroy())
    this.choiceTexts = []
    this.choiceGfx.fillStyle(0xf0d2a0, 1)
    this.choiceGfx.fillRect(4, 154, 376, 58)
    this.choiceGfx.fillStyle(0x2a1c38, 1)
    this.choiceGfx.fillRect(6, 156, 372, 54)
    this.message.setVisible(true)
    this.message.setPosition(12, 164)
    this.message.setText(text)
  }

  private drawBackdrop() {
    const g = this.add.graphics()
    if (this.kind === 'boss') {
      g.fillStyle(0x2a2040, 1)
      g.fillRect(0, 0, 384, 110)
      g.fillStyle(0x4a3048, 1)
      g.fillRect(0, 100, 384, 116)
      g.fillStyle(0xff5a32, 1)
      g.fillRect(150, 96, 80, 4)
    } else {
      g.fillStyle(0xf2b48a, 1)
      g.fillRect(0, 0, 384, 78)
      g.fillStyle(0xc484b8, 1)
      g.fillRect(0, 64, 384, 30)
      g.fillStyle(0x3e8f55, 1)
      g.fillRect(0, 90, 384, 126)
    }
    g.fillStyle(0x1c1424, 0.35)
    g.fillEllipse(328, 84, 54, 12)
    g.fillEllipse(46, 146, 40, 10)
  }

  private refreshActors() {
    const snap = this.battle.snapshot()
    this.enemySprite.setTexture(snap.enemy.speciesId)
    playCreature(this.enemySprite, snap.enemy.speciesId, snap.enemy.gender, 'idle')
    this.enemySprite.setFlipX(true)
    this.playerSprite.setTexture(snap.player.speciesId)
    playCreature(this.playerSprite, snap.player.speciesId, snap.player.gender, 'idle')
    this.updateBars()
  }

  private updateBars() {
    const snap = this.battle.snapshot()
    const enemyTitle = this.kind === 'boss' ? 'Korrath' : displayName(snap.enemy.speciesId, snap.enemy.gender)
    this.enemyName.setText(`${enemyTitle}  cấp ${snap.enemy.level}`)
    this.enemyName.setColor(ELEMENT_COLOR[snap.enemy.element])
    this.playerName.setText(`${displayName(snap.player.speciesId, snap.player.gender)}  cấp ${snap.player.level}`)
    this.playerName.setColor(ELEMENT_COLOR[snap.player.element])
    this.meters.setText(`Hòa ${snap.player.hoa} · Chiến ${snap.player.chien}`)
    this.xpText.setText(snap.player.xpNext <= 0 ? 'KN đầy' : `KN ${snap.player.xp}/${snap.player.xpNext}`)
    paintBar(this.enemyBar, 8, 32, 120, snap.enemy.hp, snap.enemy.max)
    paintBar(this.playerBar, 96, 104, 120, snap.player.hp, snap.player.max)
    paintMeter(this.playerXp, 96, 112, 68, snap.player.xp, snap.player.xpNext, 0x7ec8ff)
  }

  private pump() {
    if (this.leaving || this.waiting) return
    const event = this.queue.shift()
    if (!event) {
      this.onEmpty()
      return
    }
    this.apply(event)
    if (event.t === 'end' || this.leaving) return
    const delay = event.t === 'text' ? 640 : event.t === 'anim' ? 200 : 30
    this.timer = this.time.delayedCall(delay, () => {
      this.timer = undefined
      this.pump()
    })
  }

  private apply(event: BattleEvent) {
    if (event.t === 'text') {
      this.showLine(event.text)
      this.updateBars()
      if (event.text.includes('không giữ')) sfx.fail()
    }
    else if (event.t === 'anim') {
      const snap = this.battle.snapshot()
      const sprite = event.side === 'player' ? this.playerSprite : this.enemySprite
      const who = event.side === 'player' ? snap.player : snap.enemy
      playCreature(sprite, who.speciesId, who.gender, 'atk')
    } else if (event.t === 'hit' || event.t === 'hp' || event.t === 'heal') {
      this.refreshActors()
      if (event.t === 'hit' && !event.quiet) {
        const sprite = event.side === 'player' ? this.playerSprite : this.enemySprite
        sprite.setTintFill(0xffffff)
        this.time.delayedCall(70, () => sprite.clearTint())
        if (event.eff > 1) {
          sfx.super()
          this.cameras.main.shake(80, 0.004)
        } else if (event.eff < 1) sfx.resist()
        else sfx.hit()
      } else if (event.t === 'heal') sfx.heal()
    } else if (event.t === 'faint') {
      sfx.faint()
      const sprite = event.side === 'player' ? this.playerSprite : this.enemySprite
      this.tweens.add({ targets: sprite, alpha: 0.2, scaleY: 0.2, duration: 280 })
    } else if (event.t === 'phase') {
      markSeen(getState(), 'korrath-loi')
      sfx.phase()
      this.cameras.main.shake(180, 0.008)
      this.refreshActors()
      this.enemySprite.setAlpha(1)
      this.enemySprite.setScale(1)
    } else if (event.t === 'evolve') {
      markCaught(getState(), event.to)
      sfx.evolve()
      this.refreshActors()
      this.playerSprite.setAlpha(1)
      this.playerSprite.setScale(1)
    } else if (event.t === 'switch' || event.t === 'catch') {
      if (event.t === 'catch') sfx.catch()
      this.refreshActors()
      this.playerSprite.setAlpha(1)
      this.playerSprite.setScale(1)
    } else if (event.t === 'end') {
      this.finish(event)
    }
  }

  private onEmpty() {
    const phase = this.battle.phase
    if (phase === 'command') this.ui = 'command'
    else if (phase === 'replace') this.ui = 'replace'
    else if (phase === 'evolve') this.ui = 'evolve'
    else if (phase === 'switch') this.ui = 'switch'
    else return
    this.cursor = 0
    this.waiting = true
    this.buildChoices()
  }

  private buildChoices() {
    const state = getState()
    const snap = this.battle.snapshot()
    if (this.ui === 'command') {
      this.choices = this.kind === 'pvp'
        ? [{ id: 'fight', label: 'Đánh', hint: 'Giao hữu' }]
        : [
            { id: 'fight', label: 'Đánh', hint: 'Chọn đòn' },
            { id: 'seed', label: `Hạt (${state.seeds})`, hint: 'Giao ước' },
            { id: 'potion', label: `Giọt (${state.potions})`, hint: 'Hồi 30' },
            { id: 'run', label: 'Chạy', hint: this.kind === 'boss' ? 'Không thoát' : 'Rời cỏ' },
          ]
    } else if (this.ui === 'move') {
      this.choices = snap.player.moves.map((id) => {
        const move = getMove(id)
        return { id, label: move.name, hint: moveHint(move, snap.enemy.element) }
      })
    } else if (this.ui === 'replace') {
      const move = getMove(snap.pendingMove ?? 'danh')
      this.message.setText(`Học ${move.name}. Quên đòn nào?`)
      this.choices = snap.player.moves.map((id, index) => ({ id: String(index), label: getMove(id).name, hint: 'Quên đòn này' }))
      this.choices.push({ id: 'skip', label: 'Không học', hint: 'Giữ nguyên' })
    } else if (this.ui === 'evolve') {
      const evo = snap.pendingEvo
      this.choices = [
        { id: 'hoa', label: getSpecies(evo?.hoa ?? '').name, hint: 'Dạng Hòa' },
        { id: 'chien', label: getSpecies(evo?.chien ?? '').name, hint: 'Dạng Chiến' },
      ]
    } else if (this.ui === 'switch') {
      this.choices = state.party
        .map((tamon, index) => ({ tamon, index }))
        .filter((row) => row.tamon.hp > 0)
        .map((row) => ({
          id: String(row.index),
          label: displayName(row.tamon.speciesId, row.tamon.gender),
          hint: `Máu ${row.tamon.hp}`,
        }))
    } else {
      this.choices = []
      state.party.forEach((tamon, index) => {
        this.choices.push({
          id: `party-${index}`,
          label: `Thả ${getSpecies(tamon.speciesId).name}`,
          hint: 'Trong đội',
          slot: { box: 'party', index },
        })
      })
      state.chest.forEach((tamon, index) => {
        this.choices.push({
          id: `chest-${index}`,
          label: `Thả ${getSpecies(tamon.speciesId).name}`,
          hint: 'Trong rương',
          slot: { box: 'chest', index },
        })
      })
      this.choices.push({ id: 'abandon', label: 'Bỏ cuộc', hint: 'Tamon trở về cỏ' })
    }
    this.drawChoices()
  }

  private drawChoices() {
    this.choiceTexts.forEach((label) => label.destroy())
    this.choiceTexts = []
    this.choiceGfx.clear()
    if (!this.waiting) return
    const cols = this.ui === 'command' || this.ui === 'move' ? 2 : 1
    const showTitle = this.ui !== 'command' && this.ui !== 'move'
    const rowH = cols === 1 ? 22 : 32
    const rows = Math.ceil(this.choices.length / cols)
    const shown = cols === 1 ? Math.min(5, this.choices.length) : rows
    const height = (showTitle ? 28 : 8) + shown * rowH
    const y = 216 - height - 4
    this.choiceGfx.fillStyle(0xf0d2a0, 1)
    this.choiceGfx.fillRect(4, y, 376, height)
    this.choiceGfx.fillStyle(0x241833, 1)
    this.choiceGfx.fillRect(6, y + 2, 372, height - 4)
    this.message.setVisible(showTitle)
    if (showTitle) this.message.setPosition(12, y + 4)
    const windowStart = cols === 1 ? Math.max(0, Math.min(this.cursor - 3, Math.max(0, this.choices.length - 5))) : 0
    const visible = cols === 1 ? this.choices.slice(windowStart, windowStart + 5) : this.choices
    visible.forEach((choice, index) => {
      const real = cols === 1 ? windowStart + index : index
      const col = cols === 1 ? 0 : real % 2
      const row = cols === 1 ? index : Math.floor(real / 2)
      const x = 12 + col * 184
      const itemY = y + (showTitle ? 22 : 6) + row * rowH
      if (real === this.cursor) {
        this.choiceGfx.fillStyle(0x5a3d68, 1)
        this.choiceGfx.fillRect(x - 4, itemY - 1, cols === 1 ? 360 : 176, cols === 1 ? 20 : 30)
      }
      const mark = real === this.cursor ? '▸ ' : '  '
      const label = txt(this, x, itemY, `${mark}${choice.label}`, 10).setDepth(6)
      label.setInteractive({ useHandCursor: true })
      label.on('pointerdown', () => {
        if (!this.waiting || this.leaving) return
        this.cursor = real
        sfx.confirm()
        this.confirm()
      })
      this.choiceTexts.push(label)
      if (cols === 2) this.choiceTexts.push(txt(this, x + 16, itemY + 12, choice.hint, 8, '#d5c4e0').setDepth(6))
    })
  }

  private confirm() {
    const choice = this.choices[this.cursor]
    if (!choice) return
    const state = getState()
    this.waiting = false
    this.choiceGfx.clear()
    this.choiceTexts.forEach((label) => label.destroy())
    this.choiceTexts = []
    if (this.ui === 'command') {
      if (choice.id === 'fight') {
        this.ui = 'move'
        this.cursor = 0
        this.waiting = true
        this.buildChoices()
        return
      }
      if (choice.id === 'seed') {
        if (getSpecies(this.battle.snapshot().enemy.speciesId).catch <= 0) {
          this.queue = [{ t: 'text', text: 'Không thể giao ước.' }]
          this.pump()
          return
        }
        if (state.seeds <= 0) {
          this.queue = [{ t: 'text', text: 'Hết Hạt Ấn.' }]
          this.pump()
          return
        }
        state.seeds -= 1
        this.queue = this.battle.throwSeed()
        this.pump()
        return
      }
      if (choice.id === 'potion') {
        const snap = this.battle.snapshot()
        if (state.potions <= 0) {
          this.queue = [{ t: 'text', text: 'Hết Giọt Sương.' }]
          this.pump()
          return
        }
        if (snap.player.hp >= snap.player.max) {
          this.queue = [{ t: 'text', text: 'Máu đã đầy.' }]
          this.pump()
          return
        }
        state.potions -= 1
        this.queue = this.battle.usePotion()
        this.pump()
        return
      }
      this.queue = this.battle.run()
      this.pump()
      return
    }
    if (this.ui === 'move') {
      this.queue = this.battle.useMove(choice.id)
      if (this.kind === 'pvp' && this.pvpId && this.battle.phase === 'wait') sendBattleMove(this.pvpId, choice.id)
      this.pump()
      return
    }
    if (this.ui === 'replace') {
      this.queue = this.battle.chooseMove(choice.id === 'skip' ? null : Number(choice.id))
      this.pump()
      return
    }
    if (this.ui === 'evolve') {
      this.queue = this.battle.chooseEvo(choice.id === 'hoa' ? 'hoa' : 'chien')
      this.pump()
      return
    }
    if (this.ui === 'switch') {
      this.queue = this.battle.chooseSwitch(Number(choice.id))
      this.pump()
      return
    }
    if (choice.id === 'abandon') {
      state.notice = 'Không còn chỗ. Tamon trở về cỏ.'
      saveGame(state)
      this.scene.start('world')
      return
    }
    if (choice.slot) {
      const caught = this.heldCatch
      const error = releaseTamon(state, choice.slot)
      if (error || !caught) {
        this.message.setText(error ?? 'Không thả được.')
        this.waiting = true
        this.drawChoices()
        return
      }
      const where = giveTamon(state, caught)
      state.notice = where === 'party' ? `${getSpecies(caught.speciesId).name} vào đội.` : `${getSpecies(caught.speciesId).name} vào rương.`
      state.flags.restReady = true
      saveGame(state)
      this.scene.start('world')
    }
  }

  private heldCatch: ReturnType<typeof getState>['party'][number] | null = null

  private finish(event: Extract<BattleEvent, { t: 'end' }>) {
    if (this.leaving) return
    const state = getState()
    if (this.kind === 'pvp') {
      if (event.result === 'lose') {
        const lead = state.party[0]
        if (lead && lead.hp <= 0) lead.hp = 1
        state.notice = 'Bạn thua trận giao hữu.'
      } else if (event.result === 'win') {
        state.suong += event.suong ?? 0
        state.flags.restReady = true
        state.notice = 'Bạn thắng trận giao hữu.'
      } else state.notice = 'Trận giao hữu kết thúc.'
      saveGame(state)
      this.leave()
      return
    }
    if (event.result === 'lose') {
      for (const tamon of state.party) tamon.hp = 1
      state.pos = { ...SPAWN.villageWell }
      state.notice = 'Đội kiệt sức. Giếng Sương đón các con.'
      state.flags.restReady = true
      saveGame(state)
      this.leave()
      return
    }
    if (event.result === 'run') {
      saveGame(state)
      this.leave()
      return
    }
    if (state.party.every((tamon) => tamon.hp <= 0)) {
      for (const tamon of state.party) tamon.hp = 1
    }
    state.flags.restReady = true
    if (event.result === 'win') {
      state.suong += event.suong ?? 0
      if (this.kind === 'boss') {
        state.flags.boss = true
        state.pos = { ...SPAWN.routeFromBoss }
        state.notice = 'Korrath lại ngủ. Bình minh trở lại. Mở Ấn Ký bằng Enter.'
      }
    }
    if (event.result === 'catch' && event.caught) {
      const where = giveTamon(state, event.caught)
      if (where === 'full') {
        this.heldCatch = event.caught
        this.message.setText('Hết chỗ. Thả một Tamon để giữ giao ước.')
        this.ui = 'room'
        this.cursor = 0
        this.waiting = true
        this.buildChoices()
        return
      }
      state.notice = where === 'party'
        ? `${getSpecies(event.caught.speciesId).name} vào đội.`
        : `${getSpecies(event.caught.speciesId).name} vào rương làng.`
    }
    saveGame(state)
    this.leave()
  }

  private leave() {
    if (this.leaving) return
    this.leaving = true
    if (this.kind === 'pvp') sendDone()
    this.scene.start('world')
  }
}
