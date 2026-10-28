import { describe, it, expect } from 'vitest'
import { PDFDocument, degrees } from 'pdf-lib'
import { mergePdfs } from './index'
import { makeLabelledPdf, makePdf, makePng, makeImagePdf, encryptForTest, textPerPage } from '../../../internal/testing'

describe('mergePdfs', () => {
  it('puts the files together in the order given', async () => {
    const merged = await mergePdfs([await makeLabelledPdf(2, 'a'), await makeLabelledPdf(1, 'b'), await makeLabelledPdf(2, 'c')])
    expect(await textPerPage(merged)).toEqual(['a1', 'a2', 'b1', 'c1', 'c2'])
  })

  it('keeps each page its own size', async () => {
    const merged = await PDFDocument.load(await mergePdfs([await makePdf(1, [612, 792]), await makePdf(1, [595, 842])]))
    expect(merged.getPages().map(p => p.getSize())).toEqual([{ width: 612, height: 792 }, { width: 595, height: 842 }])
  })

  it("keeps each page's rotation", async () => {
    const turned = await PDFDocument.create()
    turned.addPage([612, 792]).setRotation(degrees(90))
    const merged = await PDFDocument.load(await mergePdfs([await makePdf(1), await turned.save()]))
    expect(merged.getPages().map(p => p.getRotation().angle)).toEqual([0, 90])
  })

  it('accepts a single file', async () => {
    expect(await textPerPage(await mergePdfs([await makeLabelledPdf(2)]))).toEqual(['p1', 'p2'])
  })

  it('accepts ArrayBuffers', async () => {
    const a = await makeLabelledPdf(1, 'a')
    const merged = await mergePdfs([a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength) as ArrayBuffer])
    expect(await textPerPage(merged)).toEqual(['a1'])
  })

  it('embeds an image shared by several pages once, not once per page', async () => {
    const file = await makeImagePdf(4, await makePng(200, 200))
    const merged = await mergePdfs([file])
    // The image is ~120 KB; four copies of it would be ~480 KB.
    expect(merged.length).toBeLessThan(file.length * 1.2)
  })

  it('reports progress once per file', async () => {
    const seen: [number, number][] = []
    await mergePdfs([await makePdf(1), await makePdf(3)], { onProgress: (d, t) => { seen.push([d, t]) } })
    expect(seen).toEqual([[1, 2], [2, 2]])
  })

  it('waits for an async progress callback before moving on', async () => {
    const order: string[] = []
    await mergePdfs([await makePdf(1), await makePdf(1)], {
      onProgress: async d => { await new Promise(r => setTimeout(r, 5)); order.push(`progress ${d}`) },
    })
    expect(order).toEqual(['progress 1', 'progress 2'])
  })

  it('needs at least one file', async () => {
    expect((await mergePdfs([]).catch(e => e)).code).toBe('INVALID_OPTIONS')
    expect((await mergePdfs(undefined as never).catch(e => e)).code).toBe('INVALID_OPTIONS')
  })

  it('says which file is password-protected', async () => {
    const locked = await encryptForTest(await makePdf(1), 'pw')
    const err = await mergePdfs([await makePdf(1), locked]).catch(e => e)
    expect(err.code).toBe('ENCRYPTED')
    expect(err.message).toMatch(/^File 2 /)
  })

  it('says which file is not a PDF', async () => {
    const err = await mergePdfs([new Uint8Array([1, 2, 3])]).catch(e => e)
    expect(err.code).toBe('NOT_A_PDF')
    expect(err.message).toMatch(/^File 1 /)
  })
})
