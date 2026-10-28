import { describe, it, expect } from 'vitest'
import { PDFDocument, degrees } from 'pdf-lib'
import { reorderPages } from './index'
import { makeLabelledPdf, makePdf, makePng, makeImagePdf, encryptForTest, textPerPage } from '../../../internal/testing'

describe('reorderPages', () => {
  it('puts the pages in the order given', async () => {
    expect(await textPerPage(await reorderPages(await makeLabelledPdf(5), [3, 1, 2, 5, 4]))).toEqual(['p3', 'p1', 'p2', 'p5', 'p4'])
  })

  it('can reverse a document', async () => {
    expect(await textPerPage(await reorderPages(await makeLabelledPdf(3), [3, 2, 1]))).toEqual(['p3', 'p2', 'p1'])
  })

  it("keeps each page's size and rotation", async () => {
    const doc = await PDFDocument.create()
    doc.addPage([612, 792])
    doc.addPage([595, 842]).setRotation(degrees(270))
    const out = await PDFDocument.load(await reorderPages(await doc.save(), [2, 1]))
    expect(out.getPage(0).getSize()).toEqual({ width: 595, height: 842 })
    expect(out.getPage(0).getRotation().angle).toBe(270)
  })

  it('embeds an image shared by several pages once', async () => {
    const file = await makeImagePdf(4, await makePng(200, 200))
    const out = await reorderPages(file, [4, 3, 2, 1])
    expect(out.length).toBeLessThan(file.length * 1.2)
  })

  it('names a page that is missing from the order', async () => {
    const err = await reorderPages(await makePdf(4), [2, 1, 4]).catch(e => e)
    expect(err.code).toBe('INVALID_OPTIONS')
    expect(err.message).toContain('page 3')
  })

  it('names a page that appears twice', async () => {
    const err = await reorderPages(await makePdf(3), [1, 2, 2, 3]).catch(e => e)
    expect(err.code).toBe('INVALID_OPTIONS')
    expect(err.message).toContain('page 2')
  })

  it("names a page the document doesn't have", async () => {
    const err = await reorderPages(await makePdf(3), [1, 2, 9]).catch(e => e)
    expect(err.code).toBe('INVALID_OPTIONS')
    expect(err.message).toContain('9')
  })

  it('refuses an order that is not a list of whole page numbers', async () => {
    for (const bad of ['3, 1, 2', [1, 1.5], [0, 1], null]) {
      expect((await reorderPages(await makePdf(2), bad as never).catch(e => e)).code, JSON.stringify(bad)).toBe('INVALID_OPTIONS')
    }
  })

  it('refuses password-protected and non-PDF input', async () => {
    const locked = await encryptForTest(await makePdf(2), 'pw')
    expect((await reorderPages(locked, [2, 1]).catch(e => e)).code).toBe('ENCRYPTED')
    expect((await reorderPages(new Uint8Array([1]), [1]).catch(e => e)).code).toBe('NOT_A_PDF')
  })
})
