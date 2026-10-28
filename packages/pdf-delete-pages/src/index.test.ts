import { describe, it, expect } from 'vitest'
import { PDFDocument, degrees } from 'pdf-lib'
import { deletePages } from './index'
import { makeLabelledPdf, makePdf, makePng, makeImagePdf, encryptForTest, textPerPage } from '../../../internal/testing'

describe('deletePages', () => {
  it('removes the selected pages and keeps the rest in order', async () => {
    expect(await textPerPage(await deletePages(await makeLabelledPdf(5), '2, 4'))).toEqual(['p1', 'p3', 'p5'])
  })

  it('understands ranges and "end"', async () => {
    expect(await textPerPage(await deletePages(await makeLabelledPdf(5), '3-end'))).toEqual(['p1', 'p2'])
  })

  it("keeps each remaining page's size and rotation", async () => {
    const doc = await PDFDocument.create()
    doc.addPage([612, 792])
    doc.addPage([595, 842]).setRotation(degrees(90))
    const out = await PDFDocument.load(await deletePages(await doc.save(), '1'))
    expect(out.getPage(0).getSize()).toEqual({ width: 595, height: 842 })
    expect(out.getPage(0).getRotation().angle).toBe(90)
  })

  it('embeds an image shared by the remaining pages once', async () => {
    const file = await makeImagePdf(4, await makePng(200, 200))
    const out = await deletePages(file, '1')
    expect(out.length).toBeLessThan(file.length * 1.2)
  })

  it('reports NO_PAGES when the selection matches nothing', async () => {
    const err = await deletePages(await makePdf(3), '9').catch(e => e)
    expect(err.code).toBe('NO_PAGES')
    expect(err.message).toContain('3 pages')
  })

  it('refuses to delete every page, since a PDF needs at least one', async () => {
    expect((await deletePages(await makePdf(3), '1-end').catch(e => e)).code).toBe('INVALID_OPTIONS')
  })

  it('needs the selection as a string', async () => {
    expect((await deletePages(await makePdf(2), 1 as never).catch(e => e)).code).toBe('INVALID_OPTIONS')
  })

  it('refuses password-protected and non-PDF input', async () => {
    const locked = await encryptForTest(await makePdf(2), 'pw')
    expect((await deletePages(locked, '1').catch(e => e)).code).toBe('ENCRYPTED')
    expect((await deletePages(new Uint8Array([1]), '1').catch(e => e)).code).toBe('NOT_A_PDF')
  })
})
