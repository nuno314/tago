import Phaser from 'phaser'
import { unlockAudio, sfx } from '../audio/sfx'
import { hasSave, loadGame, saveGame } from '../save/storage'
import { createNewGame } from '../state/GameState'
import { setState } from '../state/store'
import { askKeeperName } from '../ui/nameForm'
import { hit, typing } from '../ui/pad'
import { bindKeys, txt, type Keys } from '../ui/text'

const STARTERS = [
  { id: 'luma', label: 'Luma · Diệm', about: 'Cáo than đuôi nến. Nhanh và ấm.' },
  { id: 'bubblin', label: 'Bubblin · Triều', about: 'Ếch sứa má bong bóng. Mềm và lì.' },
  { id: 'mossbit', label: 'Mossbit · Kha', about: 'Chuột túi đội hạt. Chắc và hiền.' },
]

export class TitleScene extends Phaser.Scene {
  private keys!: Keys
  private mode: 'menu' | 'starter' = 'menu'
  private cursor = 0
  private asking = false
  private keeperName = 'Giữ'
  private labels: Phaser.GameObjects.Text[] = []
  private about!: Phaser.GameObjects.Text
  private sprites: Phaser.GameObjects.Sprite[] = []

  constructor() {
    super('title')
  }

  create() {
    unlockAudio()
    const sky = this.add.graphics()
    sky.fillStyle(0xf2b48a, 1)
    sky.fillRect(0, 0, 384, 78)
    sky.fillStyle(0xc484b8, 1)
    sky.fillRect(0, 62, 384, 36)
    sky.fillStyle(0x3e8f55, 1)
    sky.fillRect(0, 96, 384, 120)
    this.add.image(192, 8, 'logo').setOrigin(0.5, 0)
    txt(this, 192, 52, 'Rìa Bình Minh', 12, '#2a1420').setOrigin(0.5, 0)
    this.about = txt(this, 192, 198, 'Chuột hoặc mũi tên · Z chọn · ⚙ nút màn hình', 8, '#fff6ea', 360).setOrigin(0.5, 0)
    this.keys = bindKeys(this)
    this.draw()
  }

  update() {
    if (this.asking || typing()) return
    const options = this.options()
    if (hit(this.keys, 'up') || hit(this.keys, 'left')) {
      this.cursor = (this.cursor + options.length - 1) % options.length
      sfx.confirm()
      this.draw()
    } else if (hit(this.keys, 'down') || hit(this.keys, 'right')) {
      this.cursor = (this.cursor + 1) % options.length
      sfx.confirm()
      this.draw()
    } else if (hit(this.keys, 'z') || hit(this.keys, 'enter')) {
      sfx.confirm()
      void this.confirm()
    } else if (hit(this.keys, 'x') && this.mode === 'starter') {
      sfx.cancel()
      this.mode = 'menu'
      this.cursor = 0
      this.draw()
    }
  }

  private options(): string[] {
    if (this.mode === 'starter') return STARTERS.map((starter) => starter.label)
    return [...(hasSave() ? ['Tiếp tục'] : []), 'Chơi mới']
  }

  private draw() {
    this.labels.forEach((label) => label.destroy())
    this.sprites.forEach((sprite) => sprite.destroy())
    this.labels = []
    this.sprites = []
    const options = this.options()
    if (this.cursor >= options.length) this.cursor = 0
    options.forEach((option, index) => {
      const y = this.mode === 'menu' ? 156 + index * 16 : 118 + index * 18
      const x = this.mode === 'menu' ? 192 : 230
      const label = txt(this, x, y, `${index === this.cursor ? '▸ ' : '  '}${option}`, 11)
      label.setOrigin(this.mode === 'menu' ? 0.5 : 0, 0)
      label.setInteractive({ useHandCursor: true })
      label.on('pointerdown', () => {
        if (this.asking) return
        this.cursor = index
        sfx.confirm()
        void this.confirm()
      })
      this.labels.push(label)
    })
    if (this.mode === 'starter') {
      const starter = STARTERS[this.cursor]
      const sprite = this.add.sprite(78, 168, starter.id, 0).setOrigin(0.5, 1)
      sprite.play(`${starter.id}-m-idle`)
      this.sprites.push(sprite)
      this.about.setText(`${starter.about} Giới tính ngẫu nhiên.`)
    } else {
      STARTERS.forEach((starter, index) => {
        const sprite = this.add.sprite(78 + index * 114, 140, starter.id, 0).setOrigin(0.5, 1)
        sprite.play(`${starter.id}-f-idle`)
        this.sprites.push(sprite)
      })
      this.about.setText('Chuột hoặc mũi tên · Z chọn · ⚙ nút màn hình')
    }
  }

  private lock = false

  private async confirm() {
    if (this.lock || this.asking) return
    this.lock = true
    try {
      await this.pick()
    } finally {
      if (this.scene.isActive()) this.lock = false
    }
  }

  private async pick() {
    const options = this.options()
    const pick = options[this.cursor]
    if (pick === 'Tiếp tục') {
      const saved = loadGame()
      if (!saved) return
      setState(saved)
      this.scene.start('world')
      return
    }
    if (pick === 'Chơi mới') {
      this.asking = true
      this.input.keyboard?.disableGlobalCapture()
      this.keeperName = await askKeeperName()
      this.input.keyboard?.enableGlobalCapture()
      this.asking = false
      this.mode = 'starter'
      this.cursor = 0
      this.draw()
      this.game.canvas.focus()
      return
    }
    const starter = STARTERS[this.cursor]
    const state = createNewGame(this.keeperName, starter.id)
    setState(state)
    saveGame(state)
    this.scene.start('world')
  }
}
