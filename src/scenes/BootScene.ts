import Phaser from 'phaser'
import { SPECIES_IDS } from '../data/species'
import type { Gender } from '../types'

export function playCreature(sprite: Phaser.GameObjects.Sprite, id: string, gender: Gender, anim: 'idle' | 'atk') {
  const idle = `${id}-${gender}-idle`
  if (anim === 'idle') {
    sprite.play(idle)
    return
  }
  sprite.play(`${id}-${gender}-atk`)
  sprite.once('animationcomplete', () => {
    if (sprite.active) sprite.play(idle)
  })
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  preload() {
    for (const id of SPECIES_IDS) {
      this.load.spritesheet(id, `sprites/${id}.png`, { frameWidth: 64, frameHeight: 64 })
    }
    this.load.spritesheet('player', 'sprites/player.png', { frameWidth: 32, frameHeight: 40 })
    this.load.spritesheet('npc-elder', 'sprites/npc-elder.png', { frameWidth: 16, frameHeight: 24 })
    this.load.spritesheet('npc-shop', 'sprites/npc-shop.png', { frameWidth: 16, frameHeight: 24 })
    this.load.spritesheet('tiles', 'sprites/tiles.png', { frameWidth: 16, frameHeight: 16 })
    this.load.image('logo', 'sprites/logo.png')
  }

  create() {
    for (const id of SPECIES_IDS) {
      for (const [gender, row] of [
        ['m', 0],
        ['f', 7],
      ] as const) {
        this.makeAnim(`${id}-${gender}-idle`, id, row, row + 3, 4, -1)
        this.makeAnim(`${id}-${gender}-atk`, id, row + 4, row + 6, 8, 0)
      }
    }
    this.makeAnim('elder-idle', 'npc-elder', 0, 1, 2, -1)
    this.makeAnim('shop-idle', 'npc-shop', 0, 1, 2, -1)
    this.scene.start('title')
  }

  private makeAnim(key: string, sheet: string, start: number, end: number, frameRate: number, repeat: number) {
    if (this.anims.exists(key)) return
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(sheet, { start, end }),
      frameRate,
      repeat,
    })
  }
}
