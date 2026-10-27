import { C } from './palette'
import { outline, Pix } from './pix'

function legs(p: Pix, step: number, leftX: number, rightX: number) {
  const pose = (x: number, lift: number) => {
    p.litRect(x, 27 + lift, 5, 7, C.night, C.ink, C.wingD)
    p.litRect(x, 33 + lift, 5, 3, C.bark, C.hair, C.foxD)
  }
  pose(leftX, step ? 3 : 0)
  pose(rightX, step ? 0 : 3)
}

function eye(p: Pix, x: number, y: number) {
  p.rect(x, y, 4, 4, C.white)
  p.rect(x + 2, y + 1, 2, 2, C.ink)
  p.set(x, y, C.white)
}

function keeper(dir: number, frame: number): Pix {
  const p = new Pix(32, 40)
  const step = frame % 2
  p.ellipse(18, 37, 9, 2.6, C.basalt)
  if (dir === 1) {
    legs(p, step, 10, 17)
    p.orb(16, 23, 8.5, 8.5, C.cloak, C.night, C.wing)
    p.orb(16, 11, 7, 6.4, C.hair, C.ink, C.bark)
    p.orb(16, 24, 2.2, 2.2, C.ember, C.foxD, C.core, C.white)
    p.set(16, 3, C.core)
  } else if (dir === 2) {
    legs(p, step, 11, 17)
    p.orb(11, 10, 4.5, 5, C.hair, C.ink, C.bark)
    p.orb(17, 23, 7, 8, C.cloak, C.night, C.wing)
    p.litRect(21, 18, 4, 9, C.cloak, C.night, C.wing)
    p.orb(23, 27, 2.2, 2.2, C.skin, C.foxD, C.sand, C.white)
    p.orb(15, 12, 5.2, 5.6, C.skin, C.foxD, C.sand, C.white)
    eye(p, 12, 11)
    p.set(16, 15, C.blush)
    p.orb(16, 21, 2.4, 2.4, C.ember, C.foxD, C.core, C.white)
    p.set(12, 4, C.core)
  } else if (dir === 3) {
    legs(p, step, 10, 16)
    p.orb(21, 10, 4.5, 5, C.hair, C.ink, C.bark)
    p.orb(15, 23, 7, 8, C.cloak, C.night, C.wing)
    p.litRect(7, 18, 4, 9, C.cloak, C.night, C.wing)
    p.orb(8, 27, 2.2, 2.2, C.skin, C.foxD, C.sand, C.white)
    p.orb(17, 12, 5.2, 5.6, C.skin, C.foxD, C.sand, C.white)
    eye(p, 17, 11)
    p.set(16, 15, C.blush)
    p.orb(16, 21, 2.4, 2.4, C.ember, C.foxD, C.core, C.white)
    p.set(20, 4, C.core)
  } else {
    legs(p, step, 9, 18)
    p.orb(16, 8, 7, 4.6, C.hair, C.ink, C.bark)
    p.orb(10, 13, 2.4, 3.4, C.hair, C.ink, C.bark)
    p.orb(22, 13, 2.4, 3.4, C.hair, C.ink, C.bark)
    p.orb(16, 22, 8, 8, C.cloak, C.night, C.wing)
    p.litRect(5, 18, 4, 9, C.cloak, C.night, C.wing)
    p.litRect(23, 18, 4, 9, C.cloak, C.night, C.wing)
    p.orb(6, 27, 2.3, 2.3, C.skin, C.foxD, C.sand, C.white)
    p.orb(26, 27, 2.3, 2.3, C.skin, C.foxD, C.sand, C.white)
    p.orb(16, 12, 6, 5.8, C.skin, C.foxD, C.sand, C.white)
    eye(p, 11, 12)
    eye(p, 17, 12)
    p.rect(14, 16, 2, 1, C.blush)
    p.rect(17, 16, 2, 1, C.blush)
    p.litRect(11, 17, 10, 2, C.foxL, C.fox, C.white)
    p.litRect(12, 19, 8, 3, C.sand, C.fox, C.core)
    p.orb(16, 24, 2.6, 2.6, C.ember, C.flame, C.core, C.white)
    p.set(16, 2, C.core)
  }
  return p
}

function person(kind: 'elder' | 'shop', frame: number): Pix {
  const p = new Pix(16, 24)
  const bob = frame % 2
  const hair = kind === 'elder' ? C.white : C.bark
  p.ellipse(8, 22, 4, 1.2, C.basalt)
  p.rect(4, 2 + bob, 8, 3, hair)
  p.rect(5, 4 + bob, 6, 5, C.skin)
  p.rect(6, 6 + bob, 1, 2, C.ink)
  p.rect(9, 6 + bob, 1, 2, C.ink)
  p.set(6, 6 + bob, C.white)
  p.set(9, 6 + bob, C.white)
  p.set(7, 8 + bob, C.blush)
  if (kind === 'elder') {
    p.rect(3, 9, 10, 8, C.cloak)
    p.rect(4, 9, 8, 1, C.white)
    p.rect(12, 5, 1, 12, C.bark)
    p.set(12, 4, C.core)
  } else {
    p.rect(4, 9, 8, 8, C.leaf)
    p.rect(3, 9, 10, 2, C.foxL)
    p.rect(5, 11, 6, 2, C.sand)
    p.ellipse(8, 14, 1.4, 1.4, C.leafL)
  }
  p.rect(5, 17, 2, 4, C.night)
  p.rect(9, 17, 2, 4, C.night)
  p.rect(5, 21, 2, 1, C.bark)
  p.rect(9, 21, 2, 1, C.bark)
  return outline(p)
}

const GLYPH: Record<string, string[]> = {
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
}

export function drawLogo(): Pix {
  const scale = 6
  const gap = 4
  const width = 4 * (5 * scale + gap) - gap
  const height = 7 * scale
  const p = new Pix(width, height)
  const word = 'TAGO'
  word.split('').forEach((ch, index) => {
    const glyph = GLYPH[ch]
    const ox = index * (5 * scale + gap)
    glyph.forEach((row, y) => {
      row.split('').forEach((bit, x) => {
        if (bit === '1') p.rect(ox + x * scale, y * scale, scale - 1, scale - 1, C.core)
      })
    })
  })
  return p
}

export function drawPlayerSheet(): Pix {
  const sheet = new Pix(64, 160)
  for (let dir = 0; dir < 4; dir++) {
    for (let frame = 0; frame < 2; frame++) {
      const sprite = keeper(dir, frame)
      blit(sheet, sprite, frame * 32, dir * 40)
    }
  }
  return sheet
}

export function drawNpc(kind: 'elder' | 'shop'): Pix {
  const sheet = new Pix(32, 24)
  blit(sheet, person(kind, 0), 0, 0)
  blit(sheet, person(kind, 1), 16, 0)
  return sheet
}

function blit(dest: Pix, src: Pix, ox: number, oy: number) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const color = src.px[y * src.w + x]
      if (color) dest.px[(oy + y) * dest.w + (ox + x)] = color
    }
  }
}
