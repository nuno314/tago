import type { Element, Gender } from '../types'
import { C } from './palette'
import { Pix } from './pix'

interface Look {
  kind: 'up' | 'shark' | 'golem'
  body: number
  shade: number
  light: number
  accent: number
  element: Element
  cute: boolean
  size: number
  ears: 'fox' | 'long' | 'bat' | 'round' | 'none'
  tail?: boolean
  flameTail?: boolean
  mane?: boolean
  scarf?: boolean
  horns?: boolean
  wings?: boolean
  snout?: boolean
  legs?: boolean
  leaf?: boolean
  fists?: boolean
  wide?: boolean
  jelly?: boolean
  rock?: boolean
  loi?: boolean
}

const LOOKS: Record<string, Look> = {
  luma: { kind: 'up', body: C.fox, shade: C.foxD, light: C.foxL, accent: C.flame, element: 'diem', cute: true, size: 0.86, ears: 'fox', tail: true, flameTail: true, snout: true },
  lumara: { kind: 'up', body: C.fox, shade: C.foxD, light: C.foxL, accent: C.ember, element: 'diem', cute: true, size: 1, ears: 'fox', tail: true, flameTail: true, mane: true, snout: true },
  solmi: { kind: 'up', body: C.foxL, shade: C.fox, light: C.core, accent: C.ember, element: 'diem', cute: true, size: 1.05, ears: 'long', scarf: true, snout: true, legs: true },
  solvyr: { kind: 'up', body: C.foxD, shade: C.hair, light: C.fox, accent: C.flame, element: 'diem', cute: false, size: 1.12, ears: 'fox', tail: true, flameTail: true, mane: true, horns: true, snout: true, legs: true },
  bubblin: { kind: 'up', body: C.water, shade: C.deep, light: C.foam, accent: C.foam, element: 'trieu', cute: true, size: 0.9, ears: 'none', jelly: true },
  tidra: { kind: 'up', body: C.water, shade: C.deep, light: C.foam, accent: C.bolt, element: 'trieu', cute: true, size: 1.08, ears: 'none', jelly: true },
  neril: { kind: 'up', body: C.foam, shade: C.water, light: C.white, accent: C.deep, element: 'trieu', cute: true, size: 1.05, ears: 'long', legs: true, scarf: true, snout: true },
  reefrax: { kind: 'shark', body: C.deep, shade: C.night, light: C.water, accent: C.petal, element: 'trieu', cute: false, size: 1, ears: 'none' },
  mossbit: { kind: 'up', body: C.leafL, shade: C.leafD, light: C.white, accent: C.leaf, element: 'kha', cute: true, size: 0.84, ears: 'round', leaf: true, snout: true },
  brambin: { kind: 'up', body: C.leaf, shade: C.bark, light: C.leafL, accent: C.leafD, element: 'kha', cute: true, size: 1, ears: 'round', leaf: true, snout: true },
  petalune: { kind: 'up', body: C.petal, shade: C.leaf, light: C.white, accent: C.blush, element: 'kha', cute: true, size: 1.06, ears: 'long', leaf: true, legs: true, snout: true },
  gnarl: { kind: 'up', body: C.bark, shade: C.leafD, light: C.leaf, accent: C.leafL, element: 'kha', cute: false, size: 1.12, ears: 'none', wide: true, fists: true, leaf: true },
  zzip: { kind: 'up', body: C.night, shade: C.wingD, light: C.wing, accent: C.bolt, element: 'loi', cute: true, size: 0.86, ears: 'bat', wings: true },
  zzaprel: { kind: 'up', body: C.wingD, shade: C.night, light: C.bolt, accent: C.spark, element: 'loi', cute: false, size: 1.12, ears: 'bat', wings: true, tail: true },
  pebbo: { kind: 'up', body: C.stone, shade: C.stoneD, light: C.white, accent: C.moss, element: 'nham', cute: true, size: 0.9, ears: 'none', rock: true },
  craggar: { kind: 'up', body: C.stoneD, shade: C.basalt, light: C.stone, accent: C.moss, element: 'nham', cute: false, size: 1.14, ears: 'none', wide: true, fists: true },
  korrath: { kind: 'golem', body: C.basalt, shade: C.stoneD, light: C.stone, accent: C.flame, element: 'nham', cute: false, size: 1, ears: 'none' },
  'korrath-loi': { kind: 'golem', body: C.basalt, shade: C.night, light: C.bolt, accent: C.spark, element: 'loi', cute: false, size: 1, ears: 'none', loi: true },
}

function eye(p: Pix, cx: number, cy: number, rx: number, ry: number, blink: boolean) {
  if (blink) {
    p.rect(cx - rx, cy, rx * 2, 2, C.ink)
    return
  }
  p.ellipse(cx, cy, rx, ry, C.white)
  p.ellipse(cx + 0.6, cy + 0.8, rx * 0.42, ry * 0.55, C.ink)
  p.set(cx - 1, cy - 1, C.white)
}

function cuteEyes(p: Pix, cx: number, y: number, blink: boolean) {
  eye(p, cx - 6, y, 3.6, 4.1, blink)
  eye(p, cx + 6, y, 3.6, 4.1, blink)
}

function coolEyes(p: Pix, cx: number, y: number, blink: boolean) {
  eye(p, cx - 7, y, 3.4, 2.4, blink)
  eye(p, cx + 7, y, 3.4, 2.4, blink)
}

function smile(p: Pix, cx: number, y: number) {
  p.set(cx - 3, y, C.ink)
  p.set(cx + 3, y, C.ink)
  p.set(cx - 2, y + 1, C.ink)
  p.set(cx - 1, y + 1, C.ink)
  p.set(cx, y + 1, C.ink)
  p.set(cx + 1, y + 1, C.ink)
  p.set(cx + 2, y + 1, C.ink)
}

function cheeks(p: Pix, cx: number, y: number, big: boolean, spread = 12) {
  const rx = big ? 2.8 : 1.8
  p.ellipse(cx - spread, y, rx, rx * 0.7, C.blush)
  p.ellipse(cx + spread, y, rx, rx * 0.7, C.blush)
}

function markGender(p: Pix, gender: Gender, x: number, y: number, accent: number, horns: boolean) {
  if (gender === 'm') {
    p.rect(x - 1, y, 3, 2, accent)
    p.set(x, y - 1, C.core)
    p.set(x, y - 2, C.core)
    if (!horns) p.set(x - 2, y + 1, accent)
    return
  }
  p.rect(x - 16, y + 4, 4, 4, C.blush)
  p.set(x - 15, y + 8, C.petal)
  p.set(x - 17, y + 9, C.blush)
  p.set(x - 14, y + 5, C.white)
}

function vfx(p: Pix, element: Element) {
  if (element === 'diem') {
    p.orb(54, 32, 6, 6, C.flame, C.foxD, C.core, C.white)
    p.orb(56, 30, 2.6, 3.4, C.core, C.ember, C.white, C.white)
  } else if (element === 'trieu') {
    p.orb(54, 26, 4, 4, C.foam, C.water, C.white, C.white)
    p.orb(58, 36, 3.2, 3.2, C.water, C.deep, C.foam, C.white)
  } else if (element === 'kha') {
    p.litTri(50, 36, 60, 26, 60, 40, C.leaf, C.leafD, C.leafL)
    p.litTri(48, 26, 56, 18, 58, 32, C.leafL, C.leaf, C.white)
  } else if (element === 'loi') {
    p.line(50, 22, 58, 32, C.bolt)
    p.line(58, 32, 50, 42, C.bolt)
    p.line(49, 23, 56, 31, C.spark)
    p.set(56, 30, C.white)
  } else {
    p.litRect(50, 28, 8, 8, C.stone, C.stoneD, C.white)
    p.litRect(54, 36, 6, 6, C.stoneD, C.basalt, C.stone)
  }
}

function drawUpright(p: Pix, o: Look, blink: boolean, gender: Gender, frame: number) {
  const s = o.size
  const cx = 32
  const headY = o.jelly ? 31 : o.cute ? 27 : 30
  const bodyY = 46
  p.ellipse(cx + 3, 58, 12 * s, 3.2, C.basalt)
  if (o.tail) {
    p.orb(cx + 14, bodyY - 2, 6.4 * s, 4.4 * s, o.shade, o.shade, o.body)
    if (o.flameTail) {
      const fy = bodyY - 10 + (frame % 2 === 0 ? 0 : -2)
      p.orb(cx + 18, fy, 4, 6, o.accent, o.shade, C.core, C.white)
    }
  }
  if (o.wings) {
    const flap = frame % 2 === 0 ? 0 : 4
    p.litTri(cx - 6, 32, cx - 26, 24 + flap, cx - 8, 44, o.light, o.shade, C.white)
    p.litTri(cx + 6, 32, cx + 26, 24 + flap, cx + 8, 44, o.light, o.shade, C.white)
    p.litTri(cx - 6, 32, cx - 20, 28 + flap, cx - 8, 40, o.accent, o.shade, C.spark)
    p.litTri(cx + 6, 32, cx + 20, 28 + flap, cx + 8, 40, o.accent, o.shade, C.spark)
  }
  if (o.rock && !o.wide) {
    p.orb(cx, 33, 15.2 * s, 13.2 * s, o.body, o.shade, o.light, C.white)
    p.line(cx - 2, 28, cx + 4, 40, o.shade)
    p.litRect(cx - 10, 48, 6, 6, o.shade, o.shade, o.body)
    p.litRect(cx + 4, 48, 6, 6, o.shade, o.shade, o.body)
    p.orb(cx + 6, 30, 2.2, 2.2, o.accent, o.shade, C.white)
    cuteEyes(p, cx, 30, blink)
    cheeks(p, cx, 38, true)
    smile(p, cx, 37)
    markGender(p, gender, cx, 14, o.accent, false)
    return
  }
  if (o.wide) {
    p.orb(cx, bodyY - 2, 16 * s, 10.4 * s, o.body, o.shade, o.light, C.white)
    p.orb(cx - 16, bodyY - 4, 5.6, 5.6, o.shade, o.shade, o.body)
    p.orb(cx + 16, bodyY - 4, 5.6, 5.6, o.shade, o.shade, o.body)
    if (o.fists) {
      p.orb(cx - 22, bodyY + 2, 4.6, 4.6, o.light, o.body, C.white, C.white)
      p.orb(cx + 22, bodyY + 2, 4.6, 4.6, o.light, o.body, C.white, C.white)
    }
    p.orb(cx, headY + 1, (o.cute ? 10.2 : 8.2) * s, (o.cute ? 8.4 : 6.6) * s, o.body, o.shade, o.light, C.white)
  } else if (o.jelly) {
    p.orb(cx, 34, 16 * s, 14 * s, o.light, o.body, C.white, C.white)
    p.orb(cx, 36, 11 * s, 10 * s, o.body, o.shade, o.light, C.foam)
    p.orb(cx, 38, 4.8 * s, 5.2 * s, o.accent, o.shade, C.white, C.white)
    p.orb(cx - 12, 32, 3.6, 3.6, C.foam, C.water, C.white, C.white)
    p.orb(cx + 12, 30, 2.8, 2.8, C.foam, C.water, C.white, C.white)
  } else {
    p.orb(cx, bodyY, (o.cute ? 8.6 : 10.8) * s, (o.cute ? 6.4 : 8) * s, o.body, o.shade, o.light, C.white)
    p.orb(cx, bodyY + 1, (o.cute ? 5.2 : 6.4) * s, (o.cute ? 3.8 : 4.8) * s, o.light, o.body, C.white)
    p.orb(cx, headY, (o.cute ? 13.4 : 11.6) * s, (o.cute ? 12.2 : 10.2) * s, o.body, o.shade, o.light, C.white)
  }
  if (o.legs) {
    p.litRect(cx - 8, 48, 4, 8, o.shade, o.shade, o.body)
    p.litRect(cx + 4, 48, 4, 8, o.shade, o.shade, o.body)
  }
  if (o.ears === 'fox') {
    p.litTri(cx - 10, headY - 2, cx - 16, headY - 18, cx - 2, headY - 4, o.body, o.shade, o.light)
    p.litTri(cx + 10, headY - 2, cx + 16, headY - 18, cx + 2, headY - 4, o.body, o.shade, o.light)
    p.tri(cx - 10, headY - 4, cx - 14, headY - 14, cx - 4, headY - 4, C.blush)
    p.tri(cx + 10, headY - 4, cx + 14, headY - 14, cx + 4, headY - 4, C.blush)
  } else if (o.ears === 'long') {
    p.litTri(cx - 6, headY - 4, cx - 12, headY - 24, cx, headY - 4, o.body, o.shade, o.light)
    p.litTri(cx + 6, headY - 4, cx + 12, headY - 24, cx, headY - 4, o.body, o.shade, o.light)
  } else if (o.ears === 'bat') {
    p.litTri(cx - 6, headY - 2, cx - 14, headY - 16, cx - 2, headY - 2, o.accent, o.shade, C.spark)
    p.litTri(cx + 6, headY - 2, cx + 14, headY - 16, cx + 2, headY - 2, o.accent, o.shade, C.spark)
  } else if (o.ears === 'round') {
    p.orb(cx - 10, headY - 8, 4, 4, o.body, o.shade, o.light, C.white)
    p.orb(cx + 10, headY - 8, 4, 4.4, o.body, o.shade, o.light, C.white)
  }
  if (o.leaf) {
    p.litTri(cx + 2, headY - 10, cx - 8, headY - 24, cx + 4, headY - 8, C.leaf, C.leafD, C.leafL)
    p.orb(cx + 4, headY - 16, 3, 3, C.bark, C.hair, C.sand)
  }
  if (o.horns) {
    const horns: Array<[number, number, number, number, number, number]> = [
      [cx - 4, headY - 8, cx - 12, headY - 24, cx - 16, headY - 20],
      [cx + 4, headY - 8, cx + 12, headY - 24, cx + 16, headY - 20],
    ]
    for (const [x0, y0, x1, y1, x2, y2] of horns) {
      p.line(x0 + 1, y0 + 1, x1 + 1, y1 + 1, o.shade)
      p.line(x1 + 1, y1 + 1, x2 + 1, y2 + 1, o.shade)
      p.line(x0, y0, x1, y1, o.accent)
      p.line(x1, y1, x2, y2, o.accent)
      p.line(x0 - 1, y0, x1 - 1, y1, C.core)
    }
  }
  if (o.mane) {
    const hot = frame % 2 === 0 ? C.flame : C.ember
    for (const [dx, dy] of [
      [-12, -2],
      [12, -4],
      [0, -12],
      [-6, -10],
      [8, -8],
    ] as const) {
      p.orb(cx + dx, headY + dy, 3, 4, hot, o.shade, C.core, C.white)
    }
  }
  if (o.scarf) {
    p.litRect(cx - 10, headY + 8, 20, 4, o.accent, o.shade, o.light)
    p.litRect(cx + 6, headY + 12, 4, 6, o.shade, o.shade, o.accent)
  }
  if (o.snout && !o.jelly && !o.wide) p.orb(cx, headY + 5, o.cute ? 3.1 : 3.6, 2.2, o.light, o.body, C.white)
  const eyeY = o.jelly ? 28 : o.wide ? headY + 1 : headY - 1
  if (o.cute) cuteEyes(p, cx, eyeY, blink)
  else coolEyes(p, cx, eyeY, blink)
  cheeks(p, cx, eyeY + (o.cute ? 7 : 5), o.cute && !o.wide, o.wide ? 8 : 12)
  smile(p, cx, eyeY + (o.wide ? 4 : o.cute ? 6 : 5))
  markGender(p, gender, cx, headY - 16, o.accent, Boolean(o.horns))
}

function drawShark(p: Pix, o: Look, blink: boolean, gender: Gender) {
  p.ellipse(35, 56, 16, 3.4, C.basalt)
  p.orb(30, 32, 20, 10, o.body, o.shade, o.light, C.foam)
  p.litTri(12, 32, 2, 22, 2, 42, o.shade, o.shade, o.body)
  p.litTri(28, 24, 36, 12, 40, 26, o.accent, o.shade, C.white)
  p.litTri(44, 36, 56, 44, 48, 36, o.shade, o.shade, o.light)
  p.rect(40, 34, 8, 2, C.white)
  eye(p, 43, 28, 3.4, 3.6, blink)
  p.ellipse(30, 33, 2.2, 1.4, C.blush)
  p.ellipse(36, 34, 2.2, 1.4, C.blush)
  if (gender === 'm') {
    p.rect(34, 12, 4, 3, o.accent)
    p.set(36, 11, C.core)
  } else {
    p.rect(24, 24, 4, 4, C.blush)
    p.set(24, 28, C.petal)
    p.set(25, 25, C.white)
  }
}

function drawGolem(p: Pix, o: Look, blink: boolean, gender: Gender) {
  p.ellipse(35, 54, 22, 4, C.basalt)
  p.litRect(8, 20, 48, 32, o.body, o.shade, o.light, C.white)
  p.litRect(4, 24, 8, 16, o.shade, o.shade, o.body)
  p.litRect(52, 24, 8, 16, o.shade, o.shade, o.body)
  p.litRect(14, 12, 36, 16, o.shade, o.shade, o.body)
  p.litRect(16, 28, 32, 16, o.light, o.body, C.white)
  const crack = o.loi ? C.bolt : C.flame
  p.line(20, 16, 28, 36, crack)
  p.line(36, 18, 32, 44, crack)
  p.line(24, 32, 40, 28, o.loi ? C.spark : C.ember)
  if (o.loi) {
    p.orb(32, 32, 8, 8, C.bolt, C.wingD, C.spark, C.white)
    p.orb(32, 32, 4, 4, C.glow, C.bolt, C.white, C.white)
  }
  eye(p, 24, 18, 3.2, 3.2, blink)
  eye(p, 40, 18, 3.2, 3.2, blink)
  if (!blink) {
    p.ellipse(24, 18, 1.3, 1.5, crack)
    p.ellipse(40, 18, 1.3, 1.5, crack)
    p.set(23, 17, C.white)
    p.set(39, 17, C.white)
  }
  smile(p, 32, 24)
  if (gender === 'm') p.rect(30, 8, 4, 4, crack)
  else {
    p.rect(12, 16, 4, 4, C.blush)
    p.set(12, 20, C.petal)
    p.set(13, 17, C.white)
  }
}

export function renderSpecies(id: string, gender: Gender, frame: number): Pix {
  const look = LOOKS[id]
  if (!look) throw new Error(`Không có sprite cho ${id}`)
  const idle = frame < 4
  const bob = idle ? [0, 0, -2, 2][frame] : 0
  const blink = idle && frame === 1
  const lunge = idle ? 0 : [-4, 6, 0][frame - 4]
  const pix = new Pix(64, 64)
  pix.ox = lunge
  pix.oy = bob
  if (look.kind === 'shark') drawShark(pix, look, blink, gender)
  else if (look.kind === 'golem') drawGolem(pix, look, blink, gender)
  else drawUpright(pix, look, blink, gender, frame < 4 ? frame : 0)
  if (frame === 5) vfx(pix, look.element)
  pix.ox = 0
  pix.oy = 0
  return pix
}

export const DRAWN_SPECIES = Object.keys(LOOKS)
