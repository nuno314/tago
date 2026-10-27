import { spawn, type ChildProcess } from 'node:child_process'
import process from 'node:process'

const children: ChildProcess[] = []
let stopping = false

function start(command: string, env: Record<string, string> = {}) {
  const child = spawn(command, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } })
  children.push(child)
  child.on('exit', (code) => {
    if (stopping) return
    stopping = true
    for (const other of children) {
      if (other !== child && !other.killed) other.kill()
    }
    process.exit(code ?? 0)
  })
}

function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(0)
}

start('npx tsx server/index.ts', { TAGO_DEV: '1' })
start('npx vite --host')
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
