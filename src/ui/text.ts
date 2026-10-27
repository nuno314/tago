import Phaser from 'phaser'

export const FONT = '"Be Vietnam Pro", "Segoe UI", sans-serif'

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 10,
  color = '#fff6ea',
  wrap = 0,
): Phaser.GameObjects.Text {
  const label = scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    wordWrap: wrap ? { width: wrap } : undefined,
  })
  label.setResolution(2)
  label.setPadding(0, 1, 0, 2)
  return label
}

export function paintBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, hp: number, max: number) {
  g.clear()
  g.fillStyle(0x1c1424, 1)
  g.fillRect(x, y, w, 6)
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, hp / max))
  const color = ratio > 0.5 ? 0x7dce6a : ratio > 0.25 ? 0xffd15a : 0xff5d5d
  g.fillStyle(color, 1)
  g.fillRect(x + 1, y + 1, Math.max(0, Math.floor((w - 2) * ratio)), 4)
}

export function paintMeter(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  value: number,
  max: number,
  color: number,
) {
  g.clear()
  g.fillStyle(0x1c1424, 1)
  g.fillRect(x, y, w, 4)
  const ratio = max <= 0 ? 1 : Math.max(0, Math.min(1, value / max))
  g.fillStyle(color, 1)
  g.fillRect(x + 1, y + 1, Math.max(0, Math.floor((w - 2) * ratio)), 2)
}

export interface Keys {
  up: Phaser.Input.Keyboard.Key
  down: Phaser.Input.Keyboard.Key
  left: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
  z: Phaser.Input.Keyboard.Key
  x: Phaser.Input.Keyboard.Key
  enter: Phaser.Input.Keyboard.Key
}

export function bindKeys(scene: Phaser.Scene): Keys {
  const kb = scene.input.keyboard
  if (!kb) throw new Error('Cần bàn phím')
  kb.addCapture([
    Phaser.Input.Keyboard.KeyCodes.UP,
    Phaser.Input.Keyboard.KeyCodes.DOWN,
    Phaser.Input.Keyboard.KeyCodes.LEFT,
    Phaser.Input.Keyboard.KeyCodes.RIGHT,
    Phaser.Input.Keyboard.KeyCodes.SPACE,
    Phaser.Input.Keyboard.KeyCodes.ENTER,
  ])
  scene.game.canvas.setAttribute('tabindex', '0')
  scene.game.canvas.focus()
  scene.input.on('pointerdown', () => scene.game.canvas.focus())
  scene.events.once('shutdown', () => kb.removeAllKeys(true, false))
  return {
    up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
    down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
    left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
    right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
    x: kb.addKey(Phaser.Input.Keyboard.KeyCodes.X),
    enter: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
  }
}

export function pressed(key: Phaser.Input.Keyboard.Key | undefined): boolean {
  return Boolean(key && Phaser.Input.Keyboard.JustDown(key))
}
