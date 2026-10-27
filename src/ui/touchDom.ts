import { accountName, challenge, connect, login, logout, onOnline, onSession, onStatus, register } from '../net/client'
import { poke, press, release, releaseAll, type Act } from './pad'

const PAD_KEY = 'tago-pad'
const DIRS: Act[] = ['up', 'down', 'left', 'right']

export function mountTouch() {
  const root = document.createElement('div')
  root.id = 'touch-root'
  root.innerHTML = `
    <button id="gear" type="button" aria-label="Cài đặt">⚙</button>
    <section id="settings" hidden>
      <h2>Cài đặt</h2>
      <label class="pad-check"><input id="pad-toggle" type="checkbox" /> Nút trên màn hình</label>
      <p class="settings-note">Bật khi chơi trên điện thoại. Chuột vẫn bấm được trên bản đồ.</p>
      <h2>Tài khoản</h2>
      <p class="settings-note">Đăng ký một lần để giữ đội trên máy chủ. Máy khác đăng nhập cùng tên và đấu được với bạn.</p>
      <p id="account-status">Chưa đăng nhập.</p>
      <input id="acc-name" maxlength="16" autocomplete="username" placeholder="Tên tài khoản" />
      <input id="acc-pass" type="password" maxlength="72" autocomplete="current-password" placeholder="Mật khẩu" />
      <div class="settings-row">
        <button id="acc-login" type="button">Đăng nhập</button>
        <button id="acc-register" type="button">Đăng ký</button>
        <button id="acc-logout" type="button">Đăng xuất</button>
      </div>
      <h2>Đang online</h2>
      <ul id="online-list"></ul>
    </section>
    <div id="pad" hidden>
      <div class="dpad" aria-label="Di chuyển">
        <button type="button" data-act="up" style="grid-area: up" aria-label="Lên">▲</button>
        <button type="button" data-act="left" style="grid-area: left" aria-label="Trái">◀</button>
        <button type="button" data-act="down" style="grid-area: down" aria-label="Xuống">▼</button>
        <button type="button" data-act="right" style="grid-area: right" aria-label="Phải">▶</button>
      </div>
      <div class="actions">
        <button type="button" data-act="z">Chọn</button>
        <button type="button" data-act="x">Hủy</button>
        <button type="button" data-act="enter">Đội</button>
      </div>
    </div>
  `
  document.body.appendChild(root)
  const settings = root.querySelector<HTMLElement>('#settings')!
  const pad = root.querySelector<HTMLElement>('#pad')!
  const toggle = root.querySelector<HTMLInputElement>('#pad-toggle')!
  const status = root.querySelector<HTMLElement>('#account-status')!
  const nameInput = root.querySelector<HTMLInputElement>('#acc-name')!
  const passInput = root.querySelector<HTMLInputElement>('#acc-pass')!
  const list = root.querySelector<HTMLElement>('#online-list')!
  toggle.checked = padOn()
  pad.hidden = !toggle.checked
  toggle.addEventListener('change', () => {
    localStorage.setItem(PAD_KEY, toggle.checked ? '1' : '0')
    pad.hidden = !toggle.checked
  })
  root.querySelector<HTMLButtonElement>('#gear')!.addEventListener('click', () => {
    settings.hidden = !settings.hidden
  })
  for (const input of [nameInput, passInput]) {
    input.addEventListener('focus', () => {
      releaseAll()
      window.dispatchEvent(new CustomEvent('tago-typing', { detail: true }))
    })
    input.addEventListener('blur', () => {
      window.dispatchEvent(new CustomEvent('tago-typing', { detail: false }))
    })
  }
  root.querySelector('#acc-login')!.addEventListener('click', () => {
    void runAuth(status, () => login(nameInput.value, passInput.value))
  })
  root.querySelector('#acc-register')!.addEventListener('click', () => {
    void runAuth(status, () => register(nameInput.value, passInput.value))
  })
  root.querySelector('#acc-logout')!.addEventListener('click', () => logout())
  root.querySelectorAll<HTMLButtonElement>('#pad button').forEach((button) => {
    const act = button.dataset.act as Act
    const hold = DIRS.includes(act)
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      button.setPointerCapture(event.pointerId)
      if (hold) press(act)
      else poke(act)
    })
    const up = (event: PointerEvent) => {
      if (hold && button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId)
      if (hold) release(act)
    }
    button.addEventListener('pointerup', up)
    button.addEventListener('pointercancel', up)
  })
  const paintAccount = () => {
    const name = accountName()
    status.textContent = name ? `Đang vào: ${name}` : 'Chưa đăng nhập.'
  }
  onSession(paintAccount)
  onStatus((text) => {
    status.textContent = text
  })
  onOnline((names) => {
    list.replaceChildren()
    const mine = accountName()
    if (!names.length) {
      const item = document.createElement('li')
      item.textContent = mine ? 'Chưa có ai khác.' : 'Đăng nhập để thấy bạn bè.'
      list.appendChild(item)
      return
    }
    for (const name of names) {
      const item = document.createElement('li')
      const label = document.createElement('span')
      label.textContent = name === mine ? `${name} (bạn)` : name
      item.appendChild(label)
      if (name !== mine) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = 'Đấu'
        button.addEventListener('click', () => {
          void challenge(name).then((error) => {
            status.textContent = error || `Đã mời ${name} đấu.`
          })
        })
        item.appendChild(button)
      }
      list.appendChild(item)
    }
  })
  paintAccount()
  connect()
}

export function openSettings() {
  const settings = document.querySelector<HTMLElement>('#settings')
  if (settings) settings.hidden = false
}

function padOn() {
  const saved = localStorage.getItem(PAD_KEY)
  if (saved === '1') return true
  if (saved === '0') return false
  return window.matchMedia('(pointer: coarse)').matches
}

async function runAuth(status: HTMLElement, fn: () => Promise<string>) {
  status.textContent = 'Đang nối...'
  const error = await fn()
  if (error) status.textContent = error
}
