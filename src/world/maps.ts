export type MapId = 'village' | 'route'

export interface Npc {
  id: string
  name: string
  x: number
  y: number
  kind: 'elder' | 'shop'
}

export interface Sign {
  x: number
  y: number
  lines: string[]
}

export interface GameMap {
  id: MapId
  name: string
  rows: string[]
  npcs: Npc[]
  signs: Sign[]
}

export const VILLAGE_ROWS = [
  'tttttttttttttttttttttttt',
  't......................t',
  't..RRRR......bbbb......t',
  't..RdhR......b..b......t',
  't..RhhR............W...t',
  't......................t',
  't......................t',
  't...oooo........oooo...t',
  't...oooo........oooo...t',
  't......................t',
  'tppppppppppppppppppppppE',
  't......................t',
  't.s....................t',
  'tttttttttttttttttttttttt',
]

function buildRoute(): string[] {
  const height = 14
  const width = 48
  const rows: string[] = []
  for (let y = 0; y < height; y++) {
    let row = ''
    for (let x = 0; x < width; x++) {
      const border = y === 0 || y === 13 || x === 47 || (x === 0 && y !== 6)
      if (border) row += 't'
      else if (x === 0 && y === 6) row += 'V'
      else if (x >= 43 && x <= 45 && y >= 5 && y <= 7) row += 'P'
      else if (y === 6) row += 'p'
      else if (x === 4 && y === 5) row += 's'
      else if ((y === 4 || y === 5 || y === 7 || y === 8) && x > 3 && x < 43) row += 'g'
      else if (y === 3 && x % 8 === 0) row += 'o'
      else row += '.'
    }
    rows.push(row)
  }
  return rows
}

export const MAPS: Record<MapId, GameMap> = {
  village: {
    id: 'village',
    name: 'Làng Sương Mai',
    rows: VILLAGE_ROWS,
    npcs: [
      { id: 'elder', name: 'Cụ Mai', x: 4, y: 5, kind: 'elder' },
      { id: 'shop', name: 'Cô Lá', x: 14, y: 5, kind: 'shop' },
    ],
    signs: [
      {
        x: 2,
        y: 12,
        lines: ['Bấm chuột hoặc Z để nói chuyện.', 'Enter mở đội. Nút ⚙ bật phím màn hình.'],
      },
    ],
  },
  route: {
    id: 'route',
    name: 'Lối Cỏ Mở',
    rows: buildRoute(),
    npcs: [],
    signs: [
      {
        x: 4,
        y: 5,
        lines: ['Lối đông là Hố Korrath.', 'Cỏ cao có Tamon hoang.'],
      },
    ],
  },
}

export const SPAWN = {
  villageStart: { map: 'village' as const, x: 4, y: 6, dir: 1 },
  villageFromRoute: { map: 'village' as const, x: 22, y: 10, dir: 2 },
  villageWell: { map: 'village' as const, x: 19, y: 5, dir: 1 },
  routeFromVillage: { map: 'route' as const, x: 1, y: 6, dir: 3 },
  routeFromBoss: { map: 'route' as const, x: 41, y: 6, dir: 2 },
}

const SOLID = new Set(['t', 'R', 'h', 'd', 'W', 'b', 's', 'f', 'w'])

export function mapSize(map: GameMap): { w: number; h: number } {
  return { w: map.rows[0]?.length ?? 0, h: map.rows.length }
}

export function tileAt(map: GameMap, x: number, y: number): string {
  if (y < 0 || x < 0 || y >= map.rows.length || x >= map.rows[0].length) return 't'
  return map.rows[y][x]
}

export function isSolidTile(ch: string): boolean {
  return SOLID.has(ch)
}

export function npcAt(map: GameMap, x: number, y: number): Npc | undefined {
  return map.npcs.find((npc) => npc.x === x && npc.y === y)
}

export function isBlocked(map: GameMap, x: number, y: number): boolean {
  return isSolidTile(tileAt(map, x, y)) || Boolean(npcAt(map, x, y))
}
