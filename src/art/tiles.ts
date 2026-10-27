import { C } from './palette'
import { Pix } from './pix'

function speckle(p: Pix, points: Array<[number, number, number]>) {
  for (const [x, y, color] of points) p.set(x, y, color)
}

export function drawTile(id: string): Pix {
  const p = new Pix(16, 16)
  if (id === 'grass') {
    p.rect(0, 0, 16, 16, C.leaf)
    speckle(p, [
      [2, 3, C.leafL],
      [8, 2, C.leafD],
      [12, 7, C.leafL],
      [4, 11, C.leafD],
      [11, 13, C.leafL],
      [6, 6, C.moss],
    ])
  } else if (id === 'path') {
    p.rect(0, 0, 16, 16, C.sand)
    speckle(p, [
      [3, 4, C.foxL],
      [10, 2, C.stone],
      [7, 9, C.fox],
      [13, 12, C.stoneD],
      [2, 13, C.white],
    ])
  } else if (id === 'tall0' || id === 'tall1') {
    p.rect(0, 0, 16, 16, C.leafD)
    const shift = id === 'tall1' ? 1 : 0
    for (const x of [2, 5, 8, 11, 14]) {
      p.rect(x, 2 + shift, 1, 12, C.leaf)
      p.set(x, 1 + shift, C.leafL)
      p.set(x + (shift ? -1 : 1), 6, C.moss)
    }
  } else if (id === 'tree') {
    p.rect(0, 0, 16, 16, C.leafD)
    p.ellipse(8, 7, 6, 5, C.leaf)
    p.ellipse(6, 6, 2, 1.4, C.leafL)
    p.rect(7, 10, 2, 5, C.bark)
    p.set(3, 4, C.blush)
    p.set(12, 8, C.petal)
  } else if (id === 'water') {
    p.rect(0, 0, 16, 16, C.water)
    p.rect(0, 5, 16, 2, C.foam)
    p.rect(0, 11, 16, 1, C.deep)
    p.set(4, 3, C.white)
    p.set(12, 8, C.foam)
  } else if (id === 'roof') {
    p.rect(0, 0, 16, 16, C.flame)
    for (let y = 0; y < 16; y += 4) p.rect(0, y, 16, 1, C.foxD)
    p.rect(0, 0, 16, 2, C.ember)
  } else if (id === 'wall') {
    p.rect(0, 0, 16, 16, C.sand)
    p.rect(0, 0, 16, 1, C.foxL)
    p.rect(0, 8, 16, 1, C.stone)
    p.rect(8, 0, 1, 8, C.stone)
    p.rect(0, 8, 1, 8, C.stone)
  } else if (id === 'door') {
    p.rect(0, 0, 16, 16, C.bark)
    p.rect(3, 2, 10, 13, C.foxD)
    p.rect(11, 8, 1, 2, C.core)
    p.rect(4, 3, 3, 2, C.ember)
  } else if (id === 'fence') {
    p.rect(0, 0, 16, 16, C.leafD)
    p.rect(2, 3, 2, 10, C.bark)
    p.rect(12, 3, 2, 10, C.bark)
    p.rect(1, 5, 14, 2, C.fox)
    p.rect(1, 10, 14, 2, C.fox)
  } else if (id === 'flower0' || id === 'flower1') {
    p.rect(0, 0, 16, 16, C.leaf)
    const y = id === 'flower1' ? 4 : 5
    p.ellipse(5, y, 2, 2, C.blush)
    p.ellipse(11, y + 2, 2, 2, C.core)
    p.set(5, y, C.ember)
    p.set(11, y + 2, C.flame)
    p.rect(5, y + 3, 1, 4, C.leafD)
    p.rect(11, y + 5, 1, 3, C.leafD)
  } else if (id === 'well') {
    p.rect(0, 0, 16, 16, C.leafD)
    p.ellipse(8, 9, 6, 4, C.stone)
    p.ellipse(8, 9, 3, 2, C.water)
    p.rect(4, 2, 1, 6, C.bark)
    p.rect(11, 2, 1, 6, C.bark)
    p.rect(4, 2, 8, 1, C.fox)
  } else if (id === 'counter') {
    p.rect(0, 0, 16, 16, C.bark)
    p.rect(0, 4, 16, 2, C.foxL)
    p.rect(0, 10, 16, 2, C.foxD)
    p.set(3, 7, C.leaf)
    p.set(8, 7, C.core)
    p.set(12, 7, C.water)
  } else if (id === 'pit0' || id === 'pit1') {
    p.rect(0, 0, 16, 16, C.basalt)
    p.ellipse(8, 9, 5, 3, C.night)
    const glow = id === 'pit1' ? C.bolt : C.flame
    p.line(4, 4, 8, 10, glow)
    p.line(12, 3, 8, 11, glow)
    p.set(8, 8, C.core)
  } else if (id === 'sign') {
    p.rect(0, 0, 16, 16, C.leaf)
    p.rect(7, 8, 2, 6, C.bark)
    p.rect(3, 3, 10, 6, C.sand)
    p.rect(4, 5, 6, 1, C.foxD)
  } else {
    p.rect(0, 0, 16, 16, C.blush)
  }
  return p
}

export const TILE_IDS = [
  'grass',
  'path',
  'tall0',
  'tall1',
  'tree',
  'water',
  'roof',
  'wall',
  'door',
  'fence',
  'flower0',
  'flower1',
  'well',
  'counter',
  'pit0',
  'pit1',
  'sign',
] as const

export const TILE_INDEX: Record<string, number> = Object.fromEntries(TILE_IDS.map((id, index) => [id, index]))

export const CHAR_TILE: Record<string, string> = {
  '.': 'grass',
  p: 'path',
  g: 'tall0',
  t: 'tree',
  w: 'water',
  R: 'roof',
  h: 'wall',
  d: 'door',
  f: 'fence',
  o: 'flower0',
  W: 'well',
  b: 'counter',
  P: 'pit0',
  s: 'sign',
  E: 'path',
  V: 'path',
}
