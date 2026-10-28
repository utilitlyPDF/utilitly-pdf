// Drives each package from a form. Imports resolve to the BUILT packages
// (packages/*/dist), so this exercises exactly what npm would ship.

import { mergePdfs } from '@utilitly/pdf-merge'
import { extractPages, splitPdf } from '@utilitly/pdf-split'
import { rotatePdf } from '@utilitly/pdf-rotate'
import { deletePages } from '@utilitly/pdf-delete-pages'
import { reorderPages } from '@utilitly/pdf-reorder-pages'
import { duplicatePages, type Placement } from '@utilitly/pdf-duplicate-pages'

const $ = <T extends Element>(selector: string, root: ParentNode = document) => root.querySelector(selector) as T
const status = $<HTMLParagraphElement>('.status')
const results = $<HTMLDivElement>('.results')
const objectUrls: string[] = []

// ── Tabs ────────────────────────────────────────────────────────────────────
for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', String(t === tab))
    for (const form of document.querySelectorAll<HTMLFormElement>('form.tool')) form.hidden = form.dataset.tool !== tab.dataset.tab
    // A result or error belongs to the tool that made it.
    for (const url of objectUrls.splice(0)) URL.revokeObjectURL(url)
    results.replaceChildren()
    status.classList.remove('error')
    status.textContent = 'Choose a file and run it.'
  })
}

const mergeInput = $<HTMLInputElement>('[data-tool="merge"] [name="files"]')
mergeInput.addEventListener('change', () => {
  $<HTMLOListElement>('.file-order').replaceChildren(...[...(mergeInput.files ?? [])].map(f => Object.assign(document.createElement('li'), { textContent: f.name })))
})

// ── Helpers ─────────────────────────────────────────────────────────────────
const bytesOf = async (file: File) => new Uint8Array(await file.arrayBuffer())
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`
const baseName = (file: File) => file.name.replace(/\.pdf$/i, '')
const progress = (unit: string) => (done: number, total: number) => {
  status.textContent = `${unit} ${done} of ${total}…`
}

function show(outputs: { name: string; bytes: Uint8Array }[], note = '') {
  for (const url of objectUrls.splice(0)) URL.revokeObjectURL(url)
  results.replaceChildren()
  for (const { name, bytes } of outputs) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
    objectUrls.push(url)
    const item = document.createElement('div')
    item.className = 'result'
    const link = Object.assign(document.createElement('a'), { href: url, download: name, textContent: `Download ${name}` })
    const size = Object.assign(document.createElement('span'), { textContent: ` · ${mb(bytes.length)}` })
    const line = document.createElement('div')
    line.append(link, size)
    const preview = Object.assign(document.createElement('iframe'), { src: url, title: `Preview of ${name}` })
    item.append(line, preview)
    results.append(item)
  }
  status.classList.remove('error')
  status.textContent = `Done${note ? ` · ${note}` : ''}. Made in your browser; nothing was uploaded.`
}

function showError(err: unknown) {
  results.replaceChildren()
  status.classList.add('error')
  const e = err as { code?: string; message?: string }
  status.textContent = e?.code ? `${e.code}: ${e.message}` : `Unexpected error: ${String(e?.message ?? err)}`
  console.error(err)
}

const numberOr = (value: FormDataEntryValue | null, fallback: number) => (value === null || value === '' ? fallback : Number(value))
const textOrUndefined = (value: FormDataEntryValue | null) => (typeof value === 'string' && value.trim() !== '' ? value : undefined)

// ── Tools ───────────────────────────────────────────────────────────────────
type Output = { outputs: { name: string; bytes: Uint8Array }[]; note?: string }

const tools: Record<string, (data: FormData) => Promise<Output>> = {
  async merge(data) {
    const files = data.getAll('files') as File[]
    const bytes = await mergePdfs(await Promise.all(files.map(bytesOf)), { onProgress: progress('file') })
    return { outputs: [{ name: `${baseName(files[0])}-merged.pdf`, bytes }], note: `${files.length} files` }
  },

  async split(data) {
    const file = data.get('file') as File
    const pages = String(data.get('pages'))
    if (data.get('mode') === 'extract') {
      return { outputs: [{ name: `${baseName(file)}-pages.pdf`, bytes: await extractPages(await bytesOf(file), pages) }] }
    }
    const parts = await splitPdf(await bytesOf(file), pages, { onProgress: progress('file') })
    return { outputs: parts.map((bytes, i) => ({ name: `${baseName(file)}-part${i + 1}.pdf`, bytes })), note: `${parts.length} files` }
  },

  async rotate(data) {
    const file = data.get('file') as File
    const bytes = await rotatePdf(await bytesOf(file), Number(data.get('angle')), {
      pages: textOrUndefined(data.get('pages')),
      onProgress: progress('page'),
    })
    return { outputs: [{ name: `${baseName(file)}-rotated.pdf`, bytes }] }
  },

  async delete(data) {
    const file = data.get('file') as File
    const bytes = await deletePages(await bytesOf(file), String(data.get('pages')))
    return { outputs: [{ name: `${baseName(file)}-trimmed.pdf`, bytes }] }
  },

  async reorder(data) {
    const file = data.get('file') as File
    // "3, 1, 2" or "3 1 2"; anything that isn't a number is left for reorderPages to reject.
    const order = String(data.get('order')).split(/[\s,]+/).filter(Boolean).map(Number)
    const bytes = await reorderPages(await bytesOf(file), order)
    return { outputs: [{ name: `${baseName(file)}-reordered.pdf`, bytes }] }
  },

  async duplicate(data) {
    const file = data.get('file') as File
    const bytes = await duplicatePages(await bytesOf(file), String(data.get('pages')), {
      copies: numberOr(data.get('copies'), 1),
      placement: data.get('placement') as Placement,
      onProgress: progress('page'),
    })
    return { outputs: [{ name: `${baseName(file)}-duplicated.pdf`, bytes }] }
  },
}

for (const form of document.querySelectorAll<HTMLFormElement>('form.tool')) {
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const button = $<HTMLButtonElement>('button[type="submit"]', form)
    button.disabled = true
    status.classList.remove('error')
    status.textContent = 'Working…'
    try {
      const { outputs, note } = await tools[form.dataset.tool as string](new FormData(form))
      if (outputs.length > 0) show(outputs, note)
    } catch (err) {
      showError(err)
    } finally {
      button.disabled = false
    }
  })
}
