// Helpers for the test suites. Never imported by package source, so it is not
// part of any build.

import { createRequire } from 'node:module'
import { PDFDocument } from 'pdf-lib'

/** A blank PDF with `pages` US Letter pages. */
export async function makePdf(pages: number, size: [number, number] = [612, 792]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage(size)
  return doc.save()
}

/** A PDF whose pages each print their own page number, so order can be checked. */
export async function makeLabelledPdf(pages: number, prefix = 'p'): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 1; i <= pages; i++) doc.addPage([612, 792]).drawText(`${prefix}${i}`, { x: 50, y: 700, size: 24 })
  return doc.save()
}

/** The text on each page, in page order, read back through pdf.js. */
export async function textPerPage(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data: bytes.slice(0), useSystemFonts: true, verbosity: 0 })
  const doc = await task.promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    out.push(content.items.map(item => ('str' in item ? item.str : '')).join('').trim())
  }
  await task.destroy()
  return out
}

/** Encrypts with qpdf, for tests that need a password-protected input. */
export async function encryptForTest(bytes: Uint8Array, userPassword: string, ownerPassword = userPassword): Promise<Uint8Array> {
  const require = createRequire(import.meta.url)
  const createQpdf = require('@neslinesli93/qpdf-wasm')
  const qpdf = await createQpdf({ thisProgram: 'qpdf' })
  qpdf.FS.writeFile('/in.pdf', bytes)
  const previous = process.exitCode
  const code = qpdf.callMain(['--encrypt', userPassword, ownerPassword, '256', '--', '/in.pdf', '/out.pdf'])
  process.exitCode = previous
  if (code !== 0 && code !== 3) throw new Error(`qpdf exited with ${code}`)
  return qpdf.FS.readFile('/out.pdf')
}

/**
 * A PNG of random noise, so it can't compress away: the size of a PDF that
 * embeds it shows how many copies of the image the file holds.
 */
export async function makePng(width: number, height: number): Promise<Uint8Array> {
  const { deflateSync, crc32 } = await import('node:zlib')
  const { randomBytes } = await import('node:crypto')
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB, no interlace
  const rows = Buffer.concat(Array.from({ length: height }, () => Buffer.concat([Buffer.from([0]), randomBytes(width * 3)])))
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}

/** A PDF whose pages all draw the same embedded image. */
export async function makeImagePdf(pages: number, png: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const image = await doc.embedPng(png)
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]).drawImage(image, { x: 50, y: 50, width: 200, height: 200 })
  return doc.save()
}

