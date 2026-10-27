import { deserialize, installSave, loadGame } from '../save/storage'
import type { GameState } from '../state/GameState'
import { peekState } from '../state/store'
import type { ClientMsg, Peer, ServerMsg } from './messages'

const SESSION_KEY = 'tago-account'

interface Session {
  token: string
  name: string
}

const queue: ServerMsg[] = []
const sceneListeners = new Set<(msg: ServerMsg) => void>()
let onlineHandler: (names: string[]) => void = () => {}
let statusHandler: (text: string) => void = () => {}
let sessionHandler: () => void = () => {}
let socket: WebSocket | null = null
let want = false
let ready = false
let place: Peer | null = null

export function accountName(): string | null {
  return readSession()?.name ?? null
}

export function onNet(fn: (msg: ServerMsg) => void) {
  sceneListeners.add(fn)
  return () => {
    sceneListeners.delete(fn)
  }
}

export function drainNet(pred: (msg: ServerMsg) => boolean) {
  const take: ServerMsg[] = []
  const keep: ServerMsg[] = []
  for (const msg of queue) (pred(msg) ? take : keep).push(msg)
  queue.length = 0
  queue.push(...keep)
  return take
}

export function onOnline(fn: (names: string[]) => void) {
  onlineHandler = fn
}

export function onStatus(fn: (text: string) => void) {
  statusHandler = fn
}

export function onSession(fn: () => void) {
  sessionHandler = fn
}

export function setReady(on: boolean) {
  ready = on
  if (!on) place = null
  send({ t: 'ready', on })
  if (on && place) send({ t: 'place', map: place.map, x: place.x, y: place.y, dir: place.dir })
}

export function sendPlace(pos: { map: string; x: number; y: number; dir: number }) {
  if (pos.map !== 'village' && pos.map !== 'route') return
  const x = Math.floor(pos.x)
  const y = Math.floor(pos.y)
  const dir = Math.max(0, Math.min(3, Math.floor(pos.dir)))
  place = { name: readSession()?.name ?? '', map: pos.map, x, y, dir }
  if (ready) send({ t: 'place', map: pos.map, x, y, dir })
}

export function answerChallenge(from: string, yes: boolean) {
  send({ t: 'answer', from, yes })
}

export function sendBattleMove(battle: string, move: string) {
  send({ t: 'move', battle, move })
}

export function sendDone() {
  send({ t: 'done' })
}

export async function pushCloud(state: GameState): Promise<boolean> {
  const session = readSession()
  if (!session) return false
  const data = await post('/api/save', state, session.token)
  return typeof data.error !== 'string'
}

export async function register(name: string, password: string): Promise<string> {
  const data = await post('/api/register', { name, password, save: loadGame() })
  if (typeof data.error === 'string') return data.error
  applySession(data, false)
  return ''
}

export async function login(name: string, password: string): Promise<string> {
  const data = await post('/api/login', { name, password })
  if (typeof data.error === 'string') return data.error
  applySession(data, true)
  return ''
}

export async function challenge(name: string): Promise<string> {
  if (!readSession()) return 'Hãy đăng nhập trong nút ⚙.'
  const state = peekState()
  if (!state) return 'Vào làng trước đã.'
  if (!state.party[0] || state.party[0].hp <= 0) return 'Tamon dẫn đầu không còn sức.'
  if (!(await pushCloud(state))) return 'Không lưu được đội lên máy chủ.'
  if (!send({ t: 'challenge', name })) return 'Chưa kết nối.'
  return ''
}

export function logout() {
  want = false
  ready = false
  place = null
  clearSession()
  socket?.close()
  socket = null
  sessionHandler()
  onlineHandler([])
  statusHandler('Đã đăng xuất.')
}

export function connect() {
  if (!readSession()) return
  want = true
  openSocket()
}

function applySession(data: Record<string, unknown>, uploadLocal: boolean) {
  const token = typeof data.token === 'string' ? data.token : ''
  const name = typeof data.name === 'string' ? data.name : ''
  if (!token || !name) return
  writeSession(token, name)
  if (data.save) {
    const state = deserialize(JSON.stringify(data.save))
    if (state) {
      installSave(state)
      window.dispatchEvent(new CustomEvent('tago-reload'))
    }
  } else if (uploadLocal) {
    const local = loadGame()
    if (local) void pushCloud(local)
  }
  sessionHandler()
  connect()
}

function deliver(msg: ServerMsg) {
  if (msg.t === 'online') {
    onlineHandler(msg.names)
    send({ t: 'ready', on: ready })
    if (ready && place) send({ t: 'place', map: place.map, x: place.x, y: place.y, dir: place.dir })
  }
  if (msg.t === 'error') {
    statusHandler(msg.text)
    if (msg.text.includes('Phiên')) {
      want = false
      clearSession()
      sessionHandler()
      socket?.close()
    }
  }
  if (msg.t === 'ok') statusHandler(msg.text)
  if (msg.t === 'declined') statusHandler(`${msg.from} từ chối giao đấu.`)
  const keep = msg.t === 'challenge' || msg.t === 'start' || msg.t === 'go' || msg.t === 'abort' || msg.t === 'declined' || msg.t === 'here'
  if (msg.t === 'here') {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].t === 'here') queue.splice(i, 1)
  }
  if (keep && sceneListeners.size === 0) {
    queue.push(msg)
    return
  }
  for (const fn of sceneListeners) fn(msg)
}

function send(msg: ClientMsg) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false
  socket.send(JSON.stringify(msg))
  return true
}

function openSocket() {
  if (!want || socket) return
  const session = readSession()
  if (!session) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}//${location.host}/ws`)
  socket = ws
  ws.onopen = () => {
    if (socket !== ws) return
    ws.send(JSON.stringify({ t: 'auth', token: session.token }))
  }
  ws.onmessage = (ev) => {
    try {
      deliver(JSON.parse(String(ev.data)) as ServerMsg)
    } catch {
      /* bỏ tin hỏng */
    }
  }
  ws.onclose = () => {
    if (socket === ws) socket = null
    if (want) window.setTimeout(openSocket, 3000)
  }
}

async function post(path: string, body: unknown, token?: string) {
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (token) headers.authorization = `Bearer ${token}`
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) })
    const data = (await res.json()) as Record<string, unknown>
    if (!res.ok) return { error: typeof data.error === 'string' ? data.error : 'Không thực hiện được.' }
    return data
  } catch {
    return { error: 'Không nối được máy chủ. Chạy npm run dev rồi mở lại trang.' }
  }
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Session
    if (!data?.token || !data.name) return null
    return data
  } catch {
    return null
  }
}

function writeSession(token: string, name: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, name }))
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
