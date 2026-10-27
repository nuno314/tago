import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-700.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-700.css'
import Phaser from 'phaser'
import './style.css'
import { pushCloud } from './net/client'
import { BattleScene } from './scenes/BattleScene'
import { BootScene } from './scenes/BootScene'
import { CodexScene } from './scenes/CodexScene'
import { PartyScene } from './scenes/PartyScene'
import { TitleScene } from './scenes/TitleScene'
import { WorldScene } from './scenes/WorldScene'
import { setCloudSync, loadGame } from './save/storage'
import { setState } from './state/store'
import { mountTouch } from './ui/touchDom'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 384,
  height: 216,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#1a1022',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 384,
    height: 216,
  },
  scene: [BootScene, TitleScene, WorldScene, BattleScene, PartyScene, CodexScene],
}

async function main() {
  await document.fonts.load('400 10px "Be Vietnam Pro"')
  await document.fonts.load('700 12px "Be Vietnam Pro"')
  await document.fonts.ready
  setCloudSync((state) => {
    void pushCloud(state)
  })
  mountTouch()
  const game = new Phaser.Game(config)
  window.addEventListener('tago-typing', (event) => {
    const on = Boolean((event as CustomEvent<boolean>).detail)
    const keyboard = game.input.keyboard as { disableGlobalCapture?: () => void; enableGlobalCapture?: () => void } | null
    if (!keyboard) return
    if (on) keyboard.disableGlobalCapture?.()
    else keyboard.enableGlobalCapture?.()
  })
  window.addEventListener('tago-reload', () => {
    const saved = loadGame()
    if (!saved) return
    setState(saved)
    const active = game.scene.getScenes(true)[0]
    if (!active) return
    if (active.scene.key === 'world' || active.scene.key === 'title') active.scene.start(active.scene.key)
  })
}

void main()
