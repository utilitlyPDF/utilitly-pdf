import { describe, it, expect } from 'vitest'
import { PDFDocument, degrees } from 'pdf-lib'
import { rotatePdf } from './index'
import { makePdf, makeLabelledPdf, encryptForTest, textPerPage } from '../../../internal/testing'

async function rotations(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPages().map(p => p.getRotation().angle)
}

async function withRotations(angles: number[]) {
  const doc = await PDFDocument.create()
  for (const a of angles) doc.addPage([612, 792]).setRotation(degrees(a))
  return doc.save()
}

describe('rotatePdf', () => {
  it('rotates every page by default', async () => {
    expect(await rotations(await rotatePdf(await makePdf(3), 90))).toEqual([90, 90, 90])
  })

  it('rotates only the selected pages', async () => {
    expect(await rotations(await rotatePdf(await makePdf(4), 180, { pages: '2, 4' }))).toEqual([0, 180, 0, 180])
  })

  it("adds to a page's existing rotation and keeps the result within 0-270", async () => {
    expect(await rotations(await rotatePdf(await withRotations([270, 90, 0]), 180))).toEqual([90, 270, 180])
  })

  it('treats negative angles as counter-clockwise', async () => {
    expect(await rotations(await rotatePdf(await makePdf(1), -90))).toEqual([270])
  })

  it('keeps the page content', async () => {
    expect(await textPerPage(await rotatePdf(await makeLabelledPdf(2), 90))).toEqual(['p1', 'p2'])
  })

  it('leaves every page as it was when turned by 0 or 360', async () => {
    const pdf = await withRotations([90, 0])
    expect(await rotations(await rotatePdf(pdf, 0))).toEqual([90, 0])
    expect(await rotations(await rotatePdf(pdf, 360))).toEqual([90, 0])
  })

  it('refuses angles that are not a multiple of 90', async () => {
    for (const angle of [45, 1.5, NaN, Infinity]) {
      expect((await rotatePdf(await makePdf(1), angle).catch(e => e)).code).toBe('INVALID_OPTIONS')
    }
  })

  it('reports NO_PAGES when the selection matches nothing', async () => {
    expect((await rotatePdf(await makePdf(2), 90, { pages: '5' }).catch(e => e)).code).toBe('NO_PAGES')
  })

  it('reports progress once per rotated page', async () => {
    const seen: [number, number][] = []
    await rotatePdf(await makePdf(5), 90, { pages: '2-4', onProgress: (d, t) => { seen.push([d, t]) } })
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]])
  })

  it('refuses password-protected and non-PDF input', async () => {
    const locked = await encryptForTest(await makePdf(1), 'pw')
    expect((await rotatePdf(locked, 90).catch(e => e)).code).toBe('ENCRYPTED')
    expect((await rotatePdf(new Uint8Array([1]), 90).catch(e => e)).code).toBe('NOT_A_PDF')
  })
})
