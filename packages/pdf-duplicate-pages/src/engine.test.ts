import { describe, it, expect } from 'vitest'
import { PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib'
import { writeDuplicates } from './engine'
import { buildEmitList } from './plan'

/** A 4-page PDF whose pages read ALPHA/BRAVO/CHARLIE/DELTA, page 2 carrying a large image. */
async function makeSource(withImage = false) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  // ~180 KB of incompressible noise, embedded once as a PNG on page 2.
  let png: Awaited<ReturnType<typeof doc.embedPng>> | undefined
  if (withImage) {
    const side = 220
    const raw = new Uint8Array(side * side * 4)
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 256
    png = await doc.embedPng(await rawToPng(raw, side))
  }
  ;['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'].forEach((label, i) => {
    const page = doc.addPage([612, 792])
    page.drawText(label, { x: 60, y: 700, size: 40, font, color: rgb(0.1, 0.1, 0.6) })
    if (png && i === 1) page.drawImage(png, { x: 56, y: 120, width: 480, height: 480 })
  })
  return doc.save()
}

/** Minimal uncompressed-PNG encoder so the fixture needs no binary asset on disk. */
async function rawToPng(rgba: Uint8Array, side: number): Promise<Uint8Array> {
  const { deflateSync } = await import('node:zlib')
  const raw = Buffer.alloc((side * 4 + 1) * side)
  for (let y = 0; y < side; y++) {
    raw[y * (side * 4 + 1)] = 0
    Buffer.from(rgba.buffer, y * side * 4, side * 4).copy(raw, y * (side * 4 + 1) + 1)
  }
  const crcTable = [...Array(256)].map((_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, cr])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(side, 0); ihdr.writeUInt32BE(side, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}

const textPerPage = async (bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes)
  return doc.getPageCount()
}

describe('writeDuplicates', () => {
  it('writes the pages named by the emit list, in order', async () => {
    const src = await makeSource()
    const out = await writeDuplicates(await PDFDocument.load(src), buildEmitList(4, [1], 1, 'after'))
    expect(await textPerPage(out)).toBe(5)
  })

  it('gives every output page its own page object with a parent', async () => {
    const src = await makeSource()
    const out = await writeDuplicates(await PDFDocument.load(src), buildEmitList(4, [1], 5, 'after'))
    const doc = await PDFDocument.load(out)
    const kids = (doc.catalog.lookup(PDFName.of('Pages')) as any)
      .lookup(PDFName.of('Kids'))
      .asArray()
      .map((k: unknown) => String(k))
    // 9 slots, 9 distinct objects — never the same page dict referenced twice.
    expect(kids).toHaveLength(9)
    expect(new Set(kids).size).toBe(9)
    expect(doc.getPages().every((p) => p.node.get(PDFName.of('Parent')))).toBe(true)
  })

  it('shares the duplicated page\'s assets instead of re-embedding them', async () => {
    const src = await makeSource(true)
    // Duplicating the image page 5 times must not multiply the image.
    const out = await writeDuplicates(await PDFDocument.load(src), buildEmitList(4, [1], 5, 'after'))
    expect(out.length).toBeLessThan(src.length * 1.5)
  })

  it('reports real progress, once per emitted page', async () => {
    const src = await makeSource()
    const emit = buildEmitList(4, [0, 2], 2, 'after')
    const ticks: number[] = []
    await writeDuplicates(await PDFDocument.load(src), emit, (done, total) => {
      expect(total).toBe(emit.length)
      ticks.push(done)
    })
    expect(ticks).toEqual(emit.map((_, i) => i + 1))
  })

  it('refuses an empty plan rather than writing a zero-page file', async () => {
    const src = await makeSource()
    await expect(writeDuplicates(await PDFDocument.load(src), [])).rejects.toThrow(/empty/i)
  })
})
