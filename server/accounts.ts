import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { GameState } from '../src/state/GameState'
import { deserialize } from '../src/save/storage'
const FILE = path.join(process.cwd(), 'data', 'accounts.json')

export interface Account {
  name: string
  pass: string
  tokenHash: string
  save: GameState | null
}

interface DB {
  accounts: Account[]
}

let db: DB = { accounts: [] }
let chain = Promise.resolve()

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`
}

function checkPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(':')
  if (!salt || !hex) return false
  const buf = scryptSync(password, salt, 32)
  const want = Buffer.from(hex, 'hex')
  if (buf.length !== want.length) return false
  return timingSafeEqual(buf, want)
}

async function load() {
  try {
    db = JSON.parse(await readFile(FILE, 'utf8')) as DB
    db.accounts ??= []
  } catch {
    db = { accounts: [] }
  }
}

function flush() {
  chain = chain.then(async () => {
    await mkdir(path.dirname(FILE), { recursive: true })
    await writeFile(FILE, JSON.stringify(db))
  })
  return chain
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  if (name.length < 3 || name.length > 16) return null
  if (/[\u0000-\u001f]/.test(name)) return null
  return name
}

export function cleanPassword(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length < 4 || raw.length > 72) return null
  return raw
}

function sameName(a: string, b: string) {
  return a.localeCompare(b, 'vi', { sensitivity: 'accent' }) === 0
}

export function accountByName(name: string) {
  return db.accounts.find((account) => sameName(account.name, name)) ?? null
}

export function accountByToken(token: string) {
  const hash = hashToken(token)
  return db.accounts.find((account) => account.tokenHash === hash) ?? null
}

export async function initAccounts() {
  await load()
}

export async function registerAccount(name: string, password: string, save: unknown) {
  if (accountByName(name)) return { error: 'Tên này đã có người dùng.' as const }
  const account: Account = {
    name,
    pass: hashPassword(password),
    tokenHash: '',
    save: readSave(save),
  }
  const token = randomBytes(32).toString('hex')
  account.tokenHash = hashToken(token)
  db.accounts.push(account)
  await flush()
  return { token, name: account.name, save: account.save }
}

export async function loginAccount(name: string, password: string) {
  const account = accountByName(name)
  if (!account || !checkPassword(password, account.pass)) return { error: 'Sai tên hoặc mật khẩu.' as const }
  const token = randomBytes(32).toString('hex')
  account.tokenHash = hashToken(token)
  await flush()
  return { token, name: account.name, save: account.save }
}

export async function storeSave(token: string, save: unknown) {
  const account = accountByToken(token)
  if (!account) return { error: 'Phiên không còn hiệu lực.' as const }
  const next = readSave(save)
  if (!next) return { error: 'Bản lưu không đọc được.' as const }
  account.save = next
  await flush()
  return { ok: true as const }
}

function readSave(save: unknown): GameState | null {
  if (!save) return null
  return deserialize(JSON.stringify(save))
}
