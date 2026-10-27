import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { drawLogo, drawNpc, drawPlayerSheet } from './actors'
import { DRAWN_SPECIES, renderSpecies } from './creatures'
import { encodePNG, pixToRGBA } from './png'
import { Pix } from './pix'
import { drawTile, TILE_IDS } from './tiles'
import type { Gender } from '../types'

const root = resolve(process.cwd(), 'public/sprites')

function write(name: string, pix: Pix) {
  const rgba = pixToRGBA(pix, 0, 0, pix.w, pix.h)
  const file = resolve(root, name)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, encodePNG(pix.w, pix.h, rgba))
}

function speciesSheet(id: string) {
  const sheet = blank(64 * 7, 64 * 2)
  ;(['m', 'f'] as Gender[]).forEach((gender, row) => {
    for (let frame = 0; frame < 7; frame++) {
      const sprite = renderSpecies(id, gender, frame)
      paste(sheet, sprite, frame * 64, row * 64)
    }
  })
  write(`${id}.png`, sheet)
}

function blank(w: number, h: number): Pix {
  return new Pix(w, h)
}

function paste(dest: Pix, src: Pix, ox: number, oy: number) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const color = src.px[y * src.w + x]
      if (!color) continue
      dest.px[(oy + y) * dest.w + (ox + x)] = color
    }
  }
}

function tileSheet() {
  const sheet = blank(16 * TILE_IDS.length, 16)
  TILE_IDS.forEach((id, index) => paste(sheet, drawTile(id), index * 16, 0))
  write('tiles.png', sheet)
}

function preview() {
  const cols = DRAWN_SPECIES.length
  const sheet = blank(cols * 68, 68 * 2 + 8)
  DRAWN_SPECIES.forEach((id, index) => {
    paste(sheet, renderSpecies(id, 'm', 0), index * 68 + 2, 2)
    paste(sheet, renderSpecies(id, 'f', 5), index * 68 + 2, 70)
  })
  write('preview.png', sheet)
}

mkdirSync(root, { recursive: true })
for (const id of DRAWN_SPECIES) speciesSheet(id)
tileSheet()
write('player.png', drawPlayerSheet())
write('npc-elder.png', drawNpc('elder'))
write('npc-shop.png', drawNpc('shop'))
write('logo.png', drawLogo())
preview()
console.log(`Đã vẽ ${DRAWN_SPECIES.length} loài vào public/sprites`)
