import Phaser from 'phaser'
import { sfx } from '../audio/sfx'
import { ELEMENT_COLOR, ELEMENT_NAME, matchupText } from '../data/elements'
import { LINES, getSpecies, type DexLine } from '../data/species'
import { saveGame } from '../save/storage'
import { getState } from '../state/store'
import { bindKeys, txt, type Keys } from '../ui/text'
import { hit, typing } from '../ui/pad'
import { playCreature } from './BootScene'

export class CodexScene extends Phaser.Scene {
  private keys!: Keys
  private cursor = 0
  private page: 'list' | 'detail' = 'list'
  private labels: Phaser.GameObjects.Text[] = []
  private sprites: Phaser.GameObjects.Sprite[] = []

  constructor() {
    super('codex')
  }

  create() {
    this.keys = bindKeys(this)
    this.page = 'list'
    this.draw()
  }

  update() {
    if (typing()) return
    if (hit(this.keys, 'x')) {
      this.back()
      return
    }
    if (this.page === 'detail') return
    if (hit(this.keys, 'up')) {
      this.cursor = (this.cursor - 1 + LINES.length) % LINES.length
      sfx.confirm()
      this.draw()
    } else if (hit(this.keys, 'down')) {
      this.cursor = (this.cursor + 1) % LINES.length
      sfx.confirm()
      this.draw()
    } else if (hit(this.keys, 'z') || hit(this.keys, 'enter')) this.openLine()
  }

  private back() {
    sfx.cancel()
    if (this.page === 'detail') {
      this.page = 'list'
      this.draw()
      return
    }
    saveGame(getState())
    this.scene.start('world')
  }

  private openLine() {
    const line = LINES[this.cursor]
    if (!this.known(line)) {
      this.draw()
      return
    }
    this.page = 'detail'
    sfx.confirm()
    this.draw()
  }

  private known(line: DexLine) {
    const state = getState()
    return line.forms.some((id) => state.seen.includes(id))
  }

  private draw() {
    this.children.removeAll(true)
    this.labels = []
    this.sprites = []
    const bg = this.add.graphics()
    bg.fillStyle(0x1a1022, 1)
    bg.fillRect(0, 0, 384, 216)
    bg.fillStyle(0xf0d2a0, 1)
    bg.fillRect(4, 4, 376, 208)
    bg.fillStyle(0x2a1c38, 1)
    bg.fillRect(6, 6, 372, 204)
    this.labels.push(txt(this, 14, 10, 'Ấn Ký', 12))
    const help = txt(this, 14, 196, 'Z xem · X rời', 8, '#d5c4e0')
    help.setInteractive({ useHandCursor: true })
    help.on('pointerdown', () => this.back())
    this.labels.push(help)
    if (this.page === 'list') this.drawList()
    else this.drawDetail(LINES[this.cursor])
  }

  private drawList() {
    const state = getState()
    LINES.forEach((line, index) => {
      const seen = this.known(line)
      const caught = line.forms.some((id) => state.caught.includes(id))
      const name = seen ? line.title : '???'
      const mark = caught ? ' ◆' : seen ? ' ○' : ''
      const color = index === this.cursor ? '#fff6ea' : '#d5c4e0'
      const prefix = index === this.cursor ? '▸ ' : '  '
      const label = txt(this, 20, 36 + index * 24, `${prefix}${name}${mark}`, 11, color)
      label.setInteractive({ useHandCursor: true })
      label.on('pointerdown', () => {
        this.cursor = index
        this.openLine()
      })
      this.labels.push(label)
      if (seen) {
        this.labels.push(txt(this, 180, 38 + index * 24, ELEMENT_NAME[line.element], 10, ELEMENT_COLOR[line.element]))
      }
    })
  }

  private drawDetail(line: DexLine) {
    const state = getState()
    this.labels.push(txt(this, 120, 28, line.title, 12, ELEMENT_COLOR[line.element]))
    this.labels.push(txt(this, 120, 48, matchupText(line.element), 10, '#fff6ea', 240))
    this.labels.push(txt(this, 14, 168, line.blurb, 8, '#d5c4e0', 356))
    line.forms.forEach((id, index) => {
      const x = 24 + (index % 4) * 88
      const y = 118
      if (!state.seen.includes(id)) {
        this.labels.push(txt(this, x, y - 28, '???', 10, '#d5c4e0'))
        return
      }
      const species = getSpecies(id)
      const sprite = this.add.sprite(x + 24, y, id).setOrigin(0.5, 1)
      playCreature(sprite, id, 'm', 'idle')
      this.sprites.push(sprite)
      const tag = state.caught.includes(id) ? species.name : `${species.name}?`
      this.labels.push(txt(this, x, y + 2, tag, 8))
    })
  }
}
