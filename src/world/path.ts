import { isBlocked, npcAt, tileAt, type GameMap } from './maps'

const DIRS = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
]

export interface ClickRoute {
  dirs: number[]
  talk: boolean
  face: number
}

function walkable(map: GameMap, x: number, y: number) {
  if (tileAt(map, x, y) === 'P') return false
  return !isBlocked(map, x, y)
}

function interactable(map: GameMap, x: number, y: number) {
  if (npcAt(map, x, y)) return true
  const ch = tileAt(map, x, y)
  return ch === 'W' || ch === 's' || ch === 'P'
}

function bfs(map: GameMap, x0: number, y0: number, x1: number, y1: number): number[] | null {
  if (x0 === x1 && y0 === y1) return []
  const key = (x: number, y: number) => `${x},${y}`
  const queue = [{ x: x0, y: y0 }]
  const prev = new Map<string, { x: number; y: number; dir: number }>()
  prev.set(key(x0, y0), { x: x0, y: y0, dir: -1 })
  let seen = 0
  while (queue.length && seen < 500) {
    const cur = queue.shift()
    if (!cur) break
    seen += 1
    for (let dir = 0; dir < 4; dir++) {
      const nx = cur.x + DIRS[dir].x
      const ny = cur.y + DIRS[dir].y
      const id = key(nx, ny)
      if (prev.has(id) || !walkable(map, nx, ny)) continue
      prev.set(id, { x: cur.x, y: cur.y, dir })
      if (nx === x1 && ny === y1) {
        const dirs: number[] = []
        let cx = nx
        let cy = ny
        while (!(cx === x0 && cy === y0)) {
          const step = prev.get(key(cx, cy))
          if (!step) return null
          dirs.push(step.dir)
          cx = step.x
          cy = step.y
        }
        dirs.reverse()
        return dirs.length > 80 ? null : dirs
      }
      queue.push({ x: nx, y: ny })
    }
  }
  return null
}

function faceOf(x: number, y: number, tx: number, ty: number) {
  if (ty > y) return 0
  if (ty < y) return 1
  if (tx < x) return 2
  return 3
}

export function clickRoute(map: GameMap, fromX: number, fromY: number, toX: number, toY: number): ClickRoute | null {
  if (fromX === toX && fromY === toY) return { dirs: [], talk: false, face: 0 }
  if (walkable(map, toX, toY)) {
    const dirs = bfs(map, fromX, fromY, toX, toY)
    if (!dirs) return null
    return { dirs, talk: false, face: dirs[dirs.length - 1] ?? 0 }
  }
  if (!interactable(map, toX, toY)) return null
  let best: { dirs: number[]; face: number } | null = null
  for (let dir = 0; dir < 4; dir++) {
    const nx = toX + DIRS[dir].x
    const ny = toY + DIRS[dir].y
    const face = faceOf(nx, ny, toX, toY)
    if (nx === fromX && ny === fromY) {
      best = { dirs: [], face }
      break
    }
    if (!walkable(map, nx, ny)) continue
    const dirs = bfs(map, fromX, fromY, nx, ny)
    if (!dirs) continue
    if (!best || dirs.length < best.dirs.length) best = { dirs, face }
  }
  if (!best) return null
  if (tileAt(map, toX, toY) === 'P') return { dirs: [...best.dirs, best.face], talk: false, face: best.face }
  return { dirs: best.dirs, talk: true, face: best.face }
}
