export function askKeeperName(): Promise<string> {
  const form = document.getElementById('name-form') as HTMLFormElement | null
  const input = document.getElementById('name-input') as HTMLInputElement | null
  if (!form || !input) return Promise.resolve('Giữ')
  form.classList.add('show')
  input.value = ''
  input.focus()
  return new Promise((resolve) => {
    const onSubmit = (event: Event) => {
      event.preventDefault()
      form.removeEventListener('submit', onSubmit)
      form.classList.remove('show')
      resolve(input.value.trim().slice(0, 12) || 'Giữ')
    }
    form.addEventListener('submit', onSubmit)
  })
}
