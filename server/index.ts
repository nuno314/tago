import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes, randomInt } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { extname, resolve, sep } from 'node:path'
import { WebSocket, WebSocketServer } from 'ws'
import type { ClientMsg, ServerMsg } from '../src/net/messages'
import type { Tamon } from '../src/state/GameState'
import {
  accountByName,
  accountByToken,
  cleanName,
  cleanPassword,
  initAccounts,
  loginAccount,
  registerAccount,
  storeSave,
} from './accounts'
import { legalLead } from './lead'
import { MAPS } from '../src/world/maps'

interface Side {
  name: string
  tamon: Tamon
  move: string | null
}

interface Room {
  id: string
  a: Side
  b: Side
  timer: NodeJS.Timeout | null
}

interface Conn {
  ws: WebSocket
  name: string
  ready: boolean
  battle: string | null
  place: { map: 'village' | 'route'; x: number; y: number; dir: number } | null
}

const production = process.env.TAGO_DEV !== '1'
const DIST = resolve(process.cwd(), 'dist')
const FILE_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

const byName = new Map<string, Conn>()
const rooms = new Map<string, Room>()
const pending = new Map<string, string>()

function send(conn: Conn | undefined, msg: ServerMsg) {
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return
  conn.ws.send(JSON.stringify(msg))
}

function onlineNames() {
  return [...byName.keys()]
}

function broadcastOnline() {
  const names = onlineNames()
  for (const conn of byName.values()) send(conn, { t: 'online', names })
}

function broadcastHere() {
  const players = [...byName.values()]
    .filter((conn) => conn.ready && conn.place)
    .map((conn) => ({ name: conn.name, map: conn.place!.map, x: conn.place!.x, y: conn.place!.y, dir: conn.place!.dir }))
  for (const conn of byName.values()) send(conn, { t: 'here', players })
}

function cleanPlace(map: unknown, x: unknown, y: unknown, dir: unknown) {
  if (map !== 'village' && map !== 'route') return null
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(dir)) return null
  const rows = MAPS[map].rows
  if (x < 0 || y < 0 || x >= rows[0].length || y >= rows.length || dir < 0 || dir > 3) return null
  return { map, x, y, dir }
}

function arm(room: Room) {
  if (room.timer) clearTimeout(room.timer)
  room.timer = setTimeout(() => abort(room.id, 'Hết giờ chọn đòn.'), 120000)
}

function abort(id: string, text: string) {
  const room = rooms.get(id)
  if (!room) return
  if (room.timer) clearTimeout(room.timer)
  rooms.delete(id)
  for (const side of [room.a, room.b]) {
    const conn = byName.get(side.name)
    if (!conn) continue
    conn.battle = null
    send(conn, { t: 'abort', battle: id, text })
  }
}

function finish(conn: Conn) {
  if (!conn.battle) return
  const room = rooms.get(conn.battle)
  conn.battle = null
  if (!room) return
  if (room.timer) clearTimeout(room.timer)
  rooms.delete(room.id)
  const otherName = room.a.name === conn.name ? room.b.name : room.a.name
  const other = byName.get(otherName)
  if (other) other.battle = null
}

function begin(aName: string, bName: string) {
  const a = byName.get(aName)
  const b = byName.get(bName)
  if (!a || !b) return
  const aLead = legalLead(accountByName(aName)?.save ?? null)
  const bLead = legalLead(accountByName(bName)?.save ?? null)
  if (!aLead || !bLead) {
    send(a, { t: 'error', text: 'Cần một Tamon còn máu ở đầu đội.' })
    send(b, { t: 'error', text: 'Cần một Tamon còn máu ở đầu đội.' })
    return
  }
  const id = randomBytes(8).toString('hex')
  const room: Room = {
    id,
    a: { name: aName, tamon: aLead, move: null },
    b: { name: bName, tamon: bLead, move: null },
    timer: null,
  }
  rooms.set(id, room)
  a.battle = id
  b.battle = id
  arm(room)
  send(a, { t: 'start', battle: id, foeName: bName, foe: bLead })
  send(b, { t: 'start', battle: id, foeName: aName, foe: aLead })
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 200_000) {
        reject(new Error('big'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  const raw = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(raw)
}

function bearer(req: IncomingMessage) {
  const header = req.headers.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? ''
}

function fileInsideDist(pathname: string) {
  let name = decodeURIComponent(pathname)
  if (name === '/') name = '/index.html'
  const file = resolve(DIST, name.replace(/^[/\\]+/, ''))
  const root = DIST.endsWith(sep) ? DIST : DIST + sep
  if (file !== DIST && !file.startsWith(root)) return null
  return file
}

function sendFile(res: ServerResponse, file: string) {
  const type = FILE_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
  const cache = extname(file) === '.html' ? 'no-store' : 'public, max-age=3600'
  res.writeHead(200, { 'content-type': type, 'cache-control': cache })
  createReadStream(file).pipe(res)
}

function servePage(res: ServerResponse, pathname: string) {
  const file = fileInsideDist(pathname)
  if (file && existsSync(file) && statSync(file).isFile()) {
    sendFile(res, file)
    return
  }
  const index = fileInsideDist('/index.html')
  if (index && existsSync(index) && !extname(pathname)) {
    sendFile(res, index)
    return
  }
  json(res, 404, { error: 'Không có đường này.' })
}

function shareUrls(port: number) {
  const urls = [`http://localhost:${port}/`]
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) urls.push(`http://${item.address}:${port}/`)
    }
  }
  return urls
}

async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (!url.pathname.startsWith('/api')) {
    if (production) servePage(res, url.pathname)
    else json(res, 404, { error: 'Không có đường này.' })
    return
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    json(res, 200, { ok: true })
    return
  }
  if (req.method !== 'POST') {
    json(res, 404, { error: 'Không có đường này.' })
    return
  }
  let body: Record<string, unknown> = {}
  try {
    const raw = await readBody(req)
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    json(res, 400, { error: 'Dữ liệu không đọc được.' })
    return
  }
  if (url.pathname === '/api/register' || url.pathname === '/api/login') {
    const name = cleanName(body.name)
    const password = cleanPassword(body.password)
    if (!name) {
      json(res, 400, { error: 'Tên tài khoản từ 3 đến 16 ký tự.' })
      return
    }
    if (!password) {
      json(res, 400, { error: 'Mật khẩu cần ít nhất 4 ký tự.' })
      return
    }
    const result = url.pathname === '/api/register'
      ? await registerAccount(name, password, body.save)
      : await loginAccount(name, password)
    if ('error' in result) {
      json(res, 400, result)
      return
    }
    json(res, 200, result)
    return
  }
  if (url.pathname === '/api/save') {
    const result = await storeSave(bearer(req), body.save ?? body)
    if ('error' in result) {
      json(res, 401, result)
      return
    }
    json(res, 200, result)
    return
  }
  json(res, 404, { error: 'Không có đường này.' })
}

function onSocket(ws: WebSocket) {
  let conn: Conn | null = null
  ws.on('message', (data) => {
    let msg: ClientMsg
    try {
      msg = JSON.parse(String(data)) as ClientMsg
    } catch {
      return
    }
    if (msg.t === 'auth') {
      const account = accountByToken(msg.token)
      if (!account) {
        ws.send(JSON.stringify({ t: 'error', text: 'Phiên không còn hiệu lực.' }))
        ws.close()
        return
      }
      const prev = byName.get(account.name)
      if (prev && prev.ws !== ws) prev.ws.close()
      conn = { ws, name: account.name, ready: false, battle: null, place: null }
      byName.set(account.name, conn)
      send(conn, { t: 'ok', text: 'Đã vào.' })
      broadcastOnline()
      return
    }
    if (!conn) return
    if (msg.t === 'ready') {
      conn.ready = Boolean(msg.on)
      if (!conn.ready) conn.place = null
      broadcastHere()
      return
    }
    if (msg.t === 'place') {
      if (!conn.ready) return
      const spot = cleanPlace(msg.map, msg.x, msg.y, msg.dir)
      if (!spot) return
      const same = conn.place && conn.place.map === spot.map && conn.place.x === spot.x && conn.place.y === spot.y && conn.place.dir === spot.dir
      conn.place = spot
      if (!same) broadcastHere()
      return
    }
    if (msg.t === 'done') {
      finish(conn)
      return
    }
    if (msg.t === 'challenge') {
      const name = cleanName(msg.name)
      if (!name) return
      if (name.localeCompare(conn.name, 'vi', { sensitivity: 'accent' }) === 0) {
        send(conn, { t: 'error', text: 'Không thể tự đấu.' })
        return
      }
      const other = [...byName.values()].find((item) => item.name.localeCompare(name, 'vi', { sensitivity: 'accent' }) === 0)
      if (!other) {
        send(conn, { t: 'error', text: 'Người này không online.' })
        return
      }
      if (!other.ready || other.battle) {
        send(conn, { t: 'error', text: 'Người này đang bận.' })
        return
      }
      if (!conn.ready || conn.battle) {
        send(conn, { t: 'error', text: 'Hãy đứng trong làng rồi hãy thách đấu.' })
        return
      }
      const old = pending.get(other.name)
      if (old && old !== conn.name) send(byName.get(old), { t: 'declined', from: other.name })
      pending.set(other.name, conn.name)
      send(other, { t: 'challenge', from: conn.name })
      send(conn, { t: 'ok', text: 'Đã gửi lời thách đấu.' })
      return
    }
    if (msg.t === 'answer') {
      const from = pending.get(conn.name)
      if (!from || from.localeCompare(msg.from, 'vi', { sensitivity: 'accent' }) !== 0) return
      pending.delete(conn.name)
      if (!msg.yes) {
        send(byName.get(from), { t: 'declined', from: conn.name })
        return
      }
      const challenger = byName.get(from)
      if (!challenger || !challenger.ready || challenger.battle || conn.battle) {
        send(conn, { t: 'error', text: 'Không bắt đầu được trận.' })
        return
      }
      begin(from, conn.name)
      return
    }
    if (msg.t === 'move') {
      const room = rooms.get(msg.battle)
      if (!room || conn.battle !== room.id) return
      const side = room.a.name === conn.name ? room.a : room.b.name === conn.name ? room.b : null
      if (!side || side.move) return
      if (!side.tamon.moves.includes(msg.move)) {
        send(conn, { t: 'error', text: 'Đòn không hợp lệ.' })
        return
      }
      side.move = msg.move
      if (!room.a.move || !room.b.move) {
        if (!room.timer) arm(room)
        return
      }
      if (room.timer) clearTimeout(room.timer)
      room.timer = null
      const seed = randomInt(1, 0x7fffffff)
      const a = byName.get(room.a.name)
      const b = byName.get(room.b.name)
      send(a, { t: 'go', battle: room.id, foeMove: room.b.move, seed })
      send(b, { t: 'go', battle: room.id, foeMove: room.a.move, seed })
      room.a.move = null
      room.b.move = null
    }
  })
  ws.on('close', () => {
    if (!conn) return
    if (byName.get(conn.name)?.ws !== ws) return
    byName.delete(conn.name)
    for (const [target, from] of pending) {
      if (target === conn.name || from === conn.name) pending.delete(target)
    }
    if (conn.battle) abort(conn.battle, 'Đối thủ đã rời.')
    broadcastOnline()
    broadcastHere()
  })
}

await initAccounts()

if (production && !existsSync(resolve(DIST, 'index.html'))) {
  console.error('Chưa có bản chơi. Chạy npm run build trước, rồi npm start.')
  process.exit(1)
}

const port = Number(process.env.PORT) || (production ? 4173 : 8787)
const host = production ? process.env.HOST || '0.0.0.0' : '127.0.0.1'
const server = createServer((req, res) => {
  void handleHttp(req, res).catch(() => json(res, 500, { error: 'Máy chủ gặp lỗi.' }))
})

const wss = new WebSocketServer({ server, path: '/ws' })
wss.on('connection', onSocket)

server.listen(port, host, () => {
  if (!production) {
    console.log('Tài khoản TAGO đang mở ở cổng 8787')
    return
  }
  console.log('TAGO mở cho người chơi đăng ký:')
  for (const url of shareUrls(port)) console.log(`  ${url}`)
})
