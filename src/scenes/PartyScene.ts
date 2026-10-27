import Phaser from 'phaser'
import { sfx } from '../audio/sfx'
import { saveGame } from '../save/storage'
import { leadTamon, moveTamon, type Slot, type Tamon } from '../state/GameState'
import { getState } from '../state/store'
import { calcStats, getSpecies, growthText } from '../data/species'
import { ELEMENT_COLOR, ELEMENT_NAME } from '../data/elements'
import { getMove } from '../data/moves'
import { bindKeys, paintMeter, txt, type Keys } from '../ui/text'
import { hit, typing } from '../ui/pad'
import { CHEST_MAX, MAX_LEVEL, PARTY_MAX, xpToNext } from '../data/balance'
import { playCreature } from './BootScene'

interface Cell {
  slot: Slot
  tamon?: Tamon
  label: string
}

export class PartyScene extends Phaser.Scene {
  private keys!: Keys
  private mode: 'view' | 'chest' = 'view'
  private column = 0
  private cursor = 0
  private held: Slot | null = null
  private detail = false
  private labels: Phaser.GameObjects.Text[] = []
  private sprite?: Phaser.GameObjects.Sprite
  private note = ''

  constructor() {
    super('party')
  }

  init(data: { mode?: string }) {
    this.mode = data.mode === 'chest' ? 'chest' : 'view'
  }

  create() {
    this.keys = bindKeys(this)
    this.column = 0
    this.cursor = 0
    this.held = null
    this.detail = false
    this.draw()
  }

  update() {
    if (typing()) return
    if (hit(this.keys, 'x')) {
      this.back()
      return
    }
    if (this.detail) {
      if (hit(this.keys, 'z') || hit(this.keys, 'enter')) {
        const cell = this.cells()[this.cursor]
        if (cell?.tamon && cell.slot.box === 'party') {
          leadTamon(getState(), cell.slot.index)
          sfx.confirm()
          saveGame(getState())
          this.note = 'Đã đưa lên đầu đội.'
          this.draw()
        }
      }
      return
    }
    const columns = this.mode === 'chest' ? 2 : 1
    const list = this.column === 0 ? this.partyCells() : this.chestCells()
    if (hit(this.keys, 'up')) {
      this.cursor = (this.cursor - 1 + list.length) % list.length
      sfx.confirm()
      this.draw()
    } else if (hit(this.keys, 'down')) {
      this.cursor = (this.cursor + 1) % list.length
      sfx.confirm()
      this.draw()
    } else if (hit(this.keys, 'left') && columns === 2) {
      this.column = 0
      this.cursor = 0
      sfx.confirm()
      this.draw()
    } else if (hit(this.keys, 'right') && columns === 2) {
      this.column = 1
      this.cursor = 0
      sfx.confirm()
      this.draw()
    } else if (hit(this.keys, 'z') || hit(this.keys, 'enter')) {
      this.activate()
    }
  }

  private back() {
    sfx.cancel()
    if (this.detail) {
      this.detail = false
      this.draw()
      return
    }
    if (this.held) {
      this.held = null
      this.draw()
      return
    }
    saveGame(getState())
    this.scene.start('world')
  }

  private partyCells(): Cell[] {
    const state = getState()
    const cells: Cell[] = state.party.map((tamon, index) => ({
      slot: { box: 'party', index },
      tamon,
      label: `${getSpecies(tamon.speciesId).name} cấp ${tamon.level}`,
    }))
    if (this.mode === 'chest' && state.party.length < PARTY_MAX) {
      cells.push({ slot: { box: 'party', index: state.party.length }, label: '— ô trống' })
    }
    return cells
  }

  private chestCells(): Cell[] {
    const state = getState()
    const cells: Cell[] = state.chest.map((tamon, index) => ({
      slot: { box: 'chest' as const, index },
      tamon,
      label: `${getSpecies(tamon.speciesId).name} cấp ${tamon.level}`,
    }))
    if (state.chest.length < CHEST_MAX) {
      cells.push({ slot: { box: 'chest', index: state.chest.length }, label: '— ô trống' })
    }
    return cells
  }

  private cells(): Cell[] {
    return this.column === 0 ? this.partyCells() : this.chestCells()
  }

  private activate() {
    const cell = this.cells()[this.cursor]
    if (!cell) return
    if (this.mode === 'view') {
      if (!cell.tamon) return
      this.detail = true
      sfx.confirm()
      this.draw()
      return
    }
    if (!this.held) {
      if (!cell.tamon) return
      this.held = cell.slot
      sfx.confirm()
      this.draw()
      return
    }
    const error = moveTamon(getState(), this.held, cell.slot)
    if (error) this.note = error
    else {
      this.note = 'Đã chuyển.'
      this.held = null
      saveGame(getState())
    }
    sfx.confirm()
    this.draw()
  }

  private draw() {
    this.children.removeAll(true)
    this.labels = []
    this.sprite = undefined
    const list = this.cells()
    if (this.cursor >= list.length) this.cursor = Math.max(0, list.length - 1)
    const bg = this.add.graphics()
    bg.fillStyle(0x1a1022, 1)
    bg.fillRect(0, 0, 384, 216)
    bg.fillStyle(0xf0d2a0, 1)
    bg.fillRect(4, 4, 376, 208)
    bg.fillStyle(0x2a1c38, 1)
    bg.fillRect(6, 6, 372, 204)
    const title = this.mode === 'chest' ? 'Rương làng' : 'Đội'
    this.labels.push(txt(this, 14, 10, title, 12))
    const help = txt(this, 14, 196, this.mode === 'chest' ? 'Z cầm hoặc đổi · X rời' : 'Z xem · X rời', 8, '#d5c4e0')
    help.setInteractive({ useHandCursor: true })
    help.on('pointerdown', () => this.back())
    this.labels.push(help)
    if (this.note) this.labels.push(txt(this, 150, 12, this.note, 8, '#ffd0a8'))
    if (this.detail) {
      this.drawDetail()
      return
    }
    this.drawColumn(this.partyCells(), 0, 'Đội')
    if (this.mode === 'chest') this.drawColumn(this.chestCells(), 1, 'Rương')
  }

  private drawColumn(cells: Cell[], column: number, heading: string) {
    const x = 16 + column * 180
    const visible = 7
    const start = this.column === column ? Math.max(0, Math.min(this.cursor - 3, cells.length - visible)) : 0
    const slice = cells.slice(start, start + visible)
    this.labels.push(txt(this, x, 32, heading, 8, '#d5c4e0'))
    slice.forEach((cell, index) => {
      const real = start + index
      const active = this.column === column && this.cursor === real
      const held = this.held && this.held.box === cell.slot.box && this.held.index === cell.slot.index
      const prefix = held ? '◆ ' : active ? '▸ ' : '  '
      const label = txt(this, x, 48 + index * 18, `${prefix}${cell.label}`, 10, active ? '#fff6ea' : '#d5c4e0')
      label.setInteractive({ useHandCursor: true })
      label.on('pointerdown', () => {
        this.column = column
        this.cursor = real
        this.activate()
      })
      this.labels.push(label)
    })
  }

  private drawDetail() {
    const cell = this.cells()[this.cursor]
    const tamon = cell?.tamon
    if (!tamon) return
    const species = getSpecies(tamon.speciesId)
    const stats = calcStats(species.base, tamon.level)
    this.sprite = this.add.sprite(64, 112, tamon.speciesId).setOrigin(0.5, 1)
    playCreature(this.sprite, tamon.speciesId, tamon.gender, 'idle')
    const next = tamon.level >= MAX_LEVEL ? 0 : xpToNext(tamon.level)
    paintMeter(this.add.graphics(), 16, 118, 88, tamon.xp, next, 0x7ec8ff)
    const lines = [
      `${species.name} ${tamon.gender === 'm' ? 'đực' : 'cái'}  cấp ${tamon.level}`,
      ELEMENT_NAME[species.element],
      `Máu ${tamon.hp}/${stats.hp}`,
      next <= 0 ? 'KN đầy' : `KN ${tamon.xp}/${next}`,
      `Sức ${stats.atk}  Giáp ${stats.def}  Nhanh ${stats.spe}`,
      `Ý ${stats.spa}  Ý chí ${stats.spd}`,
      tamon.moves.map((id) => getMove(id).name).join(' · '),
      growthText(tamon.speciesId, tamon.level, tamon.hoa, tamon.chien),
      'Z đưa lên đầu đội',
    ]
    lines.forEach((line, index) => {
      const color = index === 1 ? ELEMENT_COLOR[species.element] : '#fff6ea'
      this.labels.push(txt(this, 120, 32 + index * 16, line, index >= 7 ? 8 : 10, color, 240))
    })
  }
}
