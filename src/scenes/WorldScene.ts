import Phaser from 'phaser'
import { sfx } from '../audio/sfx'
import { setPendingBattle } from '../battle/pending'
import { MAX_LEVEL, POTION_PRICE, SEED_PRICE, xpToNext } from '../data/balance'
import { displayName, getSpecies } from '../data/species'
import { saveGame } from '../save/storage'
import { buy, createTamon, markSeen, restAtWell, usePotionOn } from '../state/GameState'
import { getState } from '../state/store'
import { accountName, answerChallenge, drainNet, onNet, pushCloud, sendPlace, setReady } from '../net/client'
import type { Peer, ServerMsg } from '../net/messages'
import { hit, holding, typing } from '../ui/pad'
import { openSettings } from '../ui/touchDom'
import { bindKeys, paintMeter, txt, type Keys } from '../ui/text'
import { rollWild } from '../world/encounters'
import { CHAR_TILE, TILE_INDEX } from '../art/tiles'
import { isBlocked, MAPS, npcAt, SPAWN, tileAt, type GameMap, type MapId } from '../world/maps'
import { clickRoute } from '../world/path'
import { playCreature } from './BootScene'

const DIRS = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
]

interface Modal {
  kind: 'text' | 'menu'
  lines: string[]
  page: number
  options: { id: string; label: string }[]
  cursor: number
  then?: () => void
  onPick?: (id: string) => void
}

export class WorldScene extends Phaser.Scene {
  private keys!: Keys
  private map!: GameMap
  private mapId: MapId = 'village'
  private tileX = 0
  private tileY = 0
  private dir = 0
  private step = 0
  private moving = false
  private busy = true
  private leaving = false
  private player!: Phaser.GameObjects.Sprite
  private follower?: Phaser.GameObjects.Sprite
  private grass: Phaser.GameObjects.Image[] = []
  private flowers: Phaser.GameObjects.Image[] = []
  private pits: Phaser.GameObjects.Image[] = []
  private hud!: Phaser.GameObjects.Text
  private xpBar!: Phaser.GameObjects.Graphics
  private modalGfx!: Phaser.GameObjects.Graphics
  private modalText!: Phaser.GameObjects.Text
  private optionTexts: Phaser.GameObjects.Text[] = []
  private modal: Modal | null = null
  private bumpDir = -1
  private route: number[] = []
  private talkAt: { x: number; y: number } | null = null
  private inbox: ServerMsg[] = []
  private offNet = () => {}
  private peers = new Map<string, { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; x: number; y: number }>()

  constructor() {
    super('world')
  }

  create() {
    const state = getState()
    this.mapId = state.pos.map
    this.map = MAPS[this.mapId]
    this.tileX = state.pos.x
    this.tileY = state.pos.y
    this.dir = state.pos.dir
    this.moving = false
    this.leaving = false
    this.busy = true
    this.modal = null
    this.route = []
    this.talkAt = null
    this.inbox = []
    this.grass = []
    this.flowers = []
    this.pits = []
    this.paintMap()
    this.player = this.add.sprite(this.feetX(this.tileX), this.feetY(this.tileY), 'player', this.dir * 2)
    this.player.setOrigin(0.5, 1)
    this.player.setDepth(this.player.y + 1)
    this.syncFollower()
    const width = this.map.rows[0].length * 16
    const height = this.map.rows.length * 16
    this.cameras.main.setBounds(0, 0, width, height)
    this.cameras.main.roundPixels = true
    this.cameras.main.startFollow(this.player, true, 1, 1, 0, -6)
    this.cameras.main.fadeIn(160, 26, 16, 36)
    this.hud = txt(this, 6, 2, '', 8).setScrollFactor(0).setDepth(3000)
    txt(this, 6, 12, 'KN', 8, '#b7dcff').setScrollFactor(0).setDepth(3000)
    this.xpBar = this.add.graphics().setScrollFactor(0).setDepth(3000)
    const banner = txt(this, 192, 18, this.map.name, 11).setOrigin(0.5, 0).setScrollFactor(0).setDepth(3000)
    this.tweens.add({ targets: banner, alpha: 0, delay: 800, duration: 400 })
    this.modalGfx = this.add.graphics().setScrollFactor(0).setDepth(4000)
    this.modalText = txt(this, 12, 160, '', 10, '#fff6ea', 360).setScrollFactor(0).setDepth(4001)
    this.modalText.setVisible(false)
    this.keys = bindKeys(this)
    this.offNet = onNet((msg) => this.onNetMsg(msg))
    const arrived = drainNet((item) => item.t === 'challenge' || item.t === 'start' || item.t === 'declined' || item.t === 'here')
    const spots = arrived.filter((item) => item.t === 'here')
    const spot = spots[spots.length - 1]
    if (spot?.t === 'here') this.showPeers(spot.players)
    for (const msg of arrived) if (msg.t !== 'here') this.onNetMsg(msg)
    setReady(true)
    this.remember()
    this.events.once('shutdown', () => {
      this.offNet()
      setReady(false)
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (typing() || over.length > 0) return
      if (this.modal?.kind === 'text') {
        this.advanceModal()
        return
      }
      if (this.modal || this.busy || this.moving || this.leaving) return
      this.walkTo(pointer)
    })
    this.time.delayedCall(180, () => this.openArrival())
  }

  update() {
    const state = getState()
    const who = accountName()
    this.hud.setText(`${state.name}${who ? ' · ' + who : ''}   Sương ${state.suong}`)
    const lead = state.party[0]
    if (lead) {
      const next = lead.level >= MAX_LEVEL ? 0 : xpToNext(lead.level)
      paintMeter(this.xpBar, 24, 14, 56, lead.xp, next, 0x7ec8ff)
    }
    const flip = Math.floor(this.time.now / 420) % 2
    for (const sprite of this.grass) sprite.setFrame(TILE_INDEX[flip ? 'tall1' : 'tall0'])
    for (const sprite of this.flowers) sprite.setFrame(TILE_INDEX[flip ? 'flower1' : 'flower0'])
    for (const sprite of this.pits) sprite.setFrame(TILE_INDEX[flip ? 'pit1' : 'pit0'])
    if (this.follower) this.follower.setDepth(this.follower.y - 2)
    this.flushInbox()
    if (typing()) return
    if (this.modal) {
      this.handleModal()
      return
    }
    if (this.busy || this.moving || this.leaving) return
    const dir = this.heldDir()
    if (dir !== null) {
      this.route = []
      this.talkAt = null
      this.tryStep(dir)
    } else if (this.route.length > 0) {
      const next = this.route.shift()
      if (next !== undefined) this.tryStep(next)
    } else this.player.setFrame(this.dir * 2)
    if (hit(this.keys, 'z')) this.interact()
    if (hit(this.keys, 'enter')) this.openPause()
  }

  private paintMap() {
    this.map.rows.forEach((row, y) => {
      ;[...row].forEach((ch, x) => {
        const name = CHAR_TILE[ch] ?? 'grass'
        const image = this.add.image(x * 16, y * 16, 'tiles', TILE_INDEX[name]).setOrigin(0, 0)
        image.setDepth(y * 16 + 16)
        if (ch === 'g') this.grass.push(image)
        if (ch === 'o') this.flowers.push(image)
        if (ch === 'P') this.pits.push(image)
      })
    })
    for (const npc of this.map.npcs) {
      const key = npc.kind === 'elder' ? 'npc-elder' : 'npc-shop'
      const sprite = this.add.sprite(npc.x * 16 + 8, npc.y * 16 + 16, key).setOrigin(0.5, 1)
      sprite.play(npc.kind === 'elder' ? 'elder-idle' : 'shop-idle')
      sprite.setDepth(npc.y * 16 + 20)
    }
  }

  private syncFollower() {
    const state = getState()
    const lead = state.party.find((tamon) => tamon.hp > 0) ?? state.party[0]
    this.follower?.destroy()
    if (!lead) return
    this.follower = this.add.sprite(this.player.x - 26, this.player.y + 1, lead.speciesId)
    this.follower.setScale(0.5)
    this.follower.setOrigin(0.5, 1)
    playCreature(this.follower, lead.speciesId, lead.gender, 'idle')
  }

  private feetX(tile: number) {
    return tile * 16 + 8
  }

  private feetY(tile: number) {
    return tile * 16 + 16
  }

  private heldDir(): number | null {
    if (this.keys.down.isDown) return 0
    if (this.keys.up.isDown) return 1
    if (this.keys.left.isDown) return 2
    if (this.keys.right.isDown) return 3
    if (holding('down')) return 0
    if (holding('up')) return 1
    if (holding('left')) return 2
    if (holding('right')) return 3
    return null
  }

  private tryStep(dir: number) {
    this.dir = dir
    this.player.setFrame(this.dir * 2)
    const nextX = this.tileX + DIRS[dir].x
    const nextY = this.tileY + DIRS[dir].y
    const ch = tileAt(this.map, nextX, nextY)
    if (ch === 'P') {
      this.bumpDir = -1
      this.route = []
      this.talkAt = null
      this.onPit()
      return
    }
    if (isBlocked(this.map, nextX, nextY)) {
      if (this.bumpDir !== dir) sfx.bump()
      this.bumpDir = dir
      return
    }
    this.bumpDir = -1
    const fromX = this.player.x
    const fromY = this.player.y
    this.moving = true
    this.step = 1 - this.step
    this.player.setFrame(this.dir * 2 + this.step)
    if (this.follower) this.tweens.add({ targets: this.follower, x: fromX, y: fromY, duration: 140 })
    this.tweens.add({
      targets: this.player,
      x: this.feetX(nextX),
      y: this.feetY(nextY),
      duration: 140,
      onUpdate: () => this.player.setDepth(this.player.y + 1),
      onComplete: () => {
        if (this.leaving) return
        this.tileX = nextX
        this.tileY = nextY
        this.moving = false
        this.player.setFrame(this.dir * 2)
        this.onArrive(ch)
        if (this.leaving || this.busy || this.modal) {
          this.route = []
          this.talkAt = null
          return
        }
        if (this.route.length === 0 && this.talkAt) {
          const target = this.talkAt
          this.talkAt = null
          const dx = target.x - this.tileX
          const dy = target.y - this.tileY
          if (Math.abs(dx) + Math.abs(dy) === 1) {
            this.dir = dy > 0 ? 0 : dy < 0 ? 1 : dx < 0 ? 2 : 3
            this.player.setFrame(this.dir * 2)
            this.interact()
          }
        }
      },
    })
  }

  private remember() {
    const state = getState()
    state.pos = { map: this.mapId, x: this.tileX, y: this.tileY, dir: this.dir }
    sendPlace(state.pos)
  }

  private onArrive(ch: string) {
    this.remember()
    if (ch === 'E') {
      this.travel(SPAWN.routeFromVillage)
      return
    }
    if (ch === 'V') {
      this.travel(SPAWN.villageFromRoute)
      return
    }
    if (ch === 'g') this.rollEncounter()
  }

  private travel(spawn: { map: MapId; x: number; y: number; dir: number }) {
    if (this.leaving) return
    this.leaving = true
    const state = getState()
    state.pos = { ...spawn }
    state.calm = Math.max(state.calm, 2)
    saveGame(state)
    this.cameras.main.fadeOut(140, 26, 16, 36)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart())
  }

  private rollEncounter() {
    const state = getState()
    if (state.calm > 0) {
      state.calm -= 1
      return
    }
    if (!state.party.some((tamon) => tamon.hp > 0)) {
      this.showText(['Đội không còn sức. Hãy về Giếng Sương.'])
      return
    }
    if (Math.random() > 0.22) return
    state.calm = 4
    const enemy = rollWild(this.tileX)
    markSeen(state, enemy.speciesId)
    this.remember()
    saveGame(state)
    setPendingBattle({ kind: 'wild', enemy })
    this.busy = true
    this.cameras.main.flash(150, 255, 246, 220)
    sfx.confirm()
    this.time.delayedCall(170, () => this.scene.start('battle'))
  }

  private onPit() {
    const state = getState()
    if (state.flags.boss) {
      this.showText(['Hố đã yên. Sương mai nằm trên đá lạnh.'])
      return
    }
    if (!state.party.some((tamon) => tamon.hp > 0)) {
      this.showText(['Đội không còn sức để vào hố.'])
      return
    }
    const enemy = createTamon('korrath', 18, 'm')
    markSeen(state, 'korrath')
    this.remember()
    saveGame(state)
    setPendingBattle({ kind: 'boss', enemy })
    this.busy = true
    this.cameras.main.shake(200, 0.006)
    this.cameras.main.flash(160, 90, 40, 30)
    sfx.phase()
    this.time.delayedCall(220, () => this.scene.start('battle'))
  }

  private interact() {
    const face = DIRS[this.dir]
    const x = this.tileX + face.x
    const y = this.tileY + face.y
    const npc = npcAt(this.map, x, y)
    if (npc?.kind === 'elder') {
      this.talkElder()
      return
    }
    if (npc?.kind === 'shop') {
      this.talkShop()
      return
    }
    const ch = tileAt(this.map, x, y)
    if (ch === 'W') {
      this.useWell()
      return
    }
    const sign = this.map.signs.find((item) => item.x === x && item.y === y)
    if (sign) this.showText(sign.lines)
  }

  private openArrival() {
    const state = getState()
    if (state.notice) {
      const text = state.notice
      state.notice = ''
      saveGame(state)
      this.showText([text], () => this.maybeIntro())
      return
    }
    this.maybeIntro()
  }

  private maybeIntro() {
    const state = getState()
    if (!state.flags.intro) this.talkElder()
    else this.busy = false
  }

  private talkElder() {
    const state = getState()
    if (!state.flags.intro) {
      const lead = state.party[0]
      this.showText(
        [
          `${displayName(lead.speciesId, lead.gender)} đã nhận Vòng Ấn.`,
          `${state.name} à, ta là Cụ Mai.`,
          'Phía đông, Korrath thức trong Hố.',
          'Giếng này chữa lành. Cô Lá bán Hạt Ấn.',
          'Bấm chuột để đi. Nút ⚙ bật phím trên màn hình.',
        ],
        () => {
          state.flags.intro = true
          saveGame(state)
          this.busy = false
        },
      )
      return
    }
    this.showMenu('Cụ Mai', [
      { id: 'talk', label: 'Chuyện' },
      { id: 'chest', label: 'Rương' },
      { id: 'close', label: 'Thôi' },
    ], (id) => {
      if (id === 'talk') this.showText(['Korrath ở cuối Lối Cỏ Mở.', 'Ấn Ký nhắc hệ nào khắc hệ nào.'])
      if (id === 'chest') {
        this.remember()
        saveGame(state)
        this.scene.start('party', { mode: 'chest' })
      }
    })
  }

  private talkShop() {
    const state = getState()
    this.showMenu(`Cô Lá · Sương ${state.suong}`, [
      { id: 'seed', label: `Hạt Ấn (${SEED_PRICE})` },
      { id: 'potion', label: `Giọt Sương (${POTION_PRICE})` },
      { id: 'close', label: 'Thôi' },
    ], (id) => {
      if (id !== 'seed' && id !== 'potion') return
      const error = buy(state, id)
      if (error) this.showText([error])
      else {
        sfx.confirm()
        saveGame(state)
        this.showText(['Cảm ơn con.'])
      }
    })
  }

  private useWell() {
    const state = getState()
    const { bonded } = restAtWell(state)
    sfx.heal()
    saveGame(state)
    this.showText(
      bonded
        ? ['Nước sương phủ lên từng vết xước.', 'Tamon được nghỉ. Thước Hòa tăng.']
        : ['Đội đã khỏe. Ra cỏ một chuyến rồi hãy về.'],
    )
  }

  private openPause() {
    this.remember()
    saveGame(getState())
    this.showMenu('Hành trang', [
      { id: 'party', label: 'Đội' },
      { id: 'codex', label: 'Ấn Ký' },
      { id: 'bag', label: 'Túi' },
      { id: 'save', label: 'Lưu' },
      { id: 'pvp', label: 'Đấu bạn' },
      { id: 'close', label: 'Đóng' },
    ], (id) => {
      const state = getState()
      if (id === 'party') this.scene.start('party', { mode: 'view' })
      if (id === 'codex') this.scene.start('codex')
      if (id === 'bag') this.openBag()
      if (id === 'save') {
        saveGame(state)
        sfx.confirm()
        this.showText(['Đã lưu trên máy này.'])
      }
      if (id === 'pvp') openSettings()
    })
  }

  private openBag() {
    const state = getState()
    this.showMenu(`Hạt ${state.seeds} · Giọt ${state.potions}`, [
      { id: 'use', label: 'Dùng Giọt Sương' },
      { id: 'close', label: 'Đóng' },
    ], (id) => {
      if (id !== 'use') return
      if (state.potions <= 0) {
        this.showText(['Hết Giọt Sương.'])
        return
      }
      const options = state.party.map((tamon, index) => ({
        id: String(index),
        label: `${getSpecies(tamon.speciesId).name} ${tamon.hp}`,
      }))
      options.push({ id: 'close', label: 'Thôi' })
      this.showMenu('Chọn Tamon', options, (pick) => {
        if (pick === 'close') return
        const error = usePotionOn(state, Number(pick))
        if (error) this.showText([error])
        else {
          sfx.heal()
          saveGame(state)
          this.showText(['Giọt Sương mát lạnh.'])
        }
      })
    })
  }

  private showText(lines: string[], then?: () => void) {
    this.route = []
    this.talkAt = null
    this.modal = { kind: 'text', lines, page: 0, options: [], cursor: 0, then }
    this.drawModal()
  }

  private showMenu(title: string, options: { id: string; label: string }[], onPick: (id: string) => void) {
    this.route = []
    this.talkAt = null
    this.modal = { kind: 'menu', lines: [title], page: 0, options, cursor: 0, onPick }
    this.drawModal()
  }

  private drawModal() {
    this.optionTexts.forEach((label) => label.destroy())
    this.optionTexts = []
    this.modalGfx.clear()
    const modal = this.modal
    if (!modal) {
      this.modalText.setVisible(false)
      return
    }
    const height = modal.kind === 'menu' ? 36 + modal.options.length * 16 : 48
    const y = 216 - height - 4
    this.modalGfx.fillStyle(0xf0d2a0, 1)
    this.modalGfx.fillRect(4, y, 376, height)
    this.modalGfx.fillStyle(0x2a1c38, 1)
    this.modalGfx.fillRect(6, y + 2, 372, height - 4)
    this.modalText.setVisible(true)
    this.modalText.setPosition(12, y + 4)
    if (modal.kind === 'text') {
      this.modalText.setText(modal.lines[modal.page] ?? '')
      return
    }
    this.modalText.setText(modal.lines[0] ?? '')
    modal.options.forEach((option, index) => {
      const label = txt(this, 14, y + 20 + index * 16, `${index === modal.cursor ? '▸ ' : '  '}${option.label}`, 10)
      label.setScrollFactor(0).setDepth(4002)
      label.setInteractive(new Phaser.Geom.Rectangle(-8, -2, 348, 16), Phaser.Geom.Rectangle.Contains)
      label.on('pointerdown', () => this.pickModal(option.id))
      this.optionTexts.push(label)
    })
  }

  private handleModal() {
    const modal = this.modal
    if (!modal) return
    if (modal.kind === 'text') {
      if (hit(this.keys, 'z') || hit(this.keys, 'enter') || hit(this.keys, 'x')) this.advanceModal()
      return
    }
    if (hit(this.keys, 'up')) {
      modal.cursor = (modal.cursor + modal.options.length - 1) % modal.options.length
      sfx.confirm()
      this.drawModal()
    } else if (hit(this.keys, 'down')) {
      modal.cursor = (modal.cursor + 1) % modal.options.length
      sfx.confirm()
      this.drawModal()
    } else if (hit(this.keys, 'z') || hit(this.keys, 'enter')) {
      const pick = modal.options[modal.cursor]
      if (pick) this.pickModal(pick.id)
    } else if (hit(this.keys, 'x')) this.pickModal(null)
  }

  private advanceModal() {
    const modal = this.modal
    if (!modal || modal.kind !== 'text') return
    sfx.confirm()
    if (modal.page < modal.lines.length - 1) {
      modal.page += 1
      this.drawModal()
      return
    }
    const then = modal.then
    this.modal = null
    this.drawModal()
    then?.()
  }

  private pickModal(id: string | null) {
    const modal = this.modal
    if (!modal || modal.kind !== 'menu') return
    const onPick = modal.onPick
    this.modal = null
    this.drawModal()
    if (id === null) {
      sfx.cancel()
      return
    }
    sfx.confirm()
    onPick?.(id)
  }

  private walkTo(pointer: Phaser.Input.Pointer) {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
    const x = Math.floor(world.x / 16)
    const y = Math.floor(world.y / 16)
    const route = clickRoute(this.map, this.tileX, this.tileY, x, y)
    if (!route) return
    if (route.dirs.length === 0 && route.talk) {
      this.dir = route.face
      this.player.setFrame(this.dir * 2)
      this.interact()
      return
    }
    if (route.dirs.length === 0) return
    this.route = route.dirs
    this.talkAt = route.talk ? { x, y } : null
  }

  private flushInbox() {
    if (this.modal || this.busy || this.moving || this.leaving || this.inbox.length === 0) return
    const next = this.inbox.shift()
    if (next) this.applyNet(next)
  }

  private onNetMsg(msg: ServerMsg) {
    if (msg.t === 'here') {
      this.showPeers(msg.players)
      return
    }
    if (msg.t === 'challenge' && (this.modal || this.busy || this.moving || this.leaving)) {
      this.inbox.push(msg)
      return
    }
    this.applyNet(msg)
  }

  private applyNet(msg: ServerMsg) {
    if (msg.t === 'declined') {
      this.showText([`${msg.from} từ chối giao đấu.`])
      return
    }
    if (msg.t === 'challenge') {
      this.showMenu(`${msg.from} muốn đấu.`, [
        { id: 'yes', label: 'Nhận' },
        { id: 'no', label: 'Từ chối' },
      ], (id) => {
        if (id !== 'yes') {
          answerChallenge(msg.from, false)
          return
        }
        void pushCloud(getState()).then((ok) => {
          if (!ok) {
            answerChallenge(msg.from, false)
            this.showText(['Không lưu được đội lên máy chủ.'])
            return
          }
          answerChallenge(msg.from, true)
        })
      })
      return
    }
    if (msg.t !== 'start') return
    const state = getState()
    const lead = state.party[0]
    if (!lead || lead.hp <= 0) {
      this.showText(['Tamon dẫn đầu không còn sức.'])
      return
    }
    this.remember()
    saveGame(state)
    setPendingBattle({ kind: 'pvp', enemy: msg.foe, pvpId: msg.battle, foeName: msg.foeName })
    this.route = []
    this.talkAt = null
    this.leaving = true
    this.scene.start('battle')
  }

  private showPeers(players: Peer[]) {
    const mine = accountName()
    const names = new Set<string>()
    for (const peer of players) {
      if (peer.name === mine || peer.map !== this.mapId) continue
      names.add(peer.name)
      const actor = this.peers.get(peer.name) ?? this.makePeer(peer)
      if (actor.x === peer.x && actor.y === peer.y) {
        actor.sprite.setFrame(peer.dir * 2)
        continue
      }
      actor.x = peer.x
      actor.y = peer.y
      actor.sprite.setFrame(peer.dir * 2 + 1)
      this.tweens.killTweensOf(actor.sprite)
      this.tweens.add({
        targets: actor.sprite,
        x: this.feetX(peer.x),
        y: this.feetY(peer.y),
        duration: 140,
        onUpdate: () => {
          actor.sprite.setDepth(actor.sprite.y + 1)
          actor.label.setPosition(actor.sprite.x, actor.sprite.y - 42)
          actor.label.setDepth(actor.sprite.depth + 1)
        },
        onComplete: () => actor.sprite.setFrame(peer.dir * 2),
      })
    }
    for (const [name, actor] of this.peers) {
      if (names.has(name)) continue
      this.tweens.killTweensOf(actor.sprite)
      actor.sprite.destroy()
      actor.label.destroy()
      this.peers.delete(name)
    }
  }

  private makePeer(peer: Peer) {
    const sprite = this.add.sprite(this.feetX(peer.x), this.feetY(peer.y), 'player', peer.dir * 2).setOrigin(0.5, 1)
    sprite.setDepth(sprite.y + 1)
    const label = txt(this, sprite.x, sprite.y - 42, peer.name, 8, '#ffe7a0').setOrigin(0.5, 1)
    label.setDepth(sprite.depth + 1)
    const actor = { sprite, label, x: peer.x, y: peer.y }
    this.peers.set(peer.name, actor)
    return actor
  }
}
