import { describe, it, expect } from 'vitest'
import { extractPages, splitPdf, parsePageRange } from './index'
import { makeLabelledPdf, makePng, makeImagePdf, encryptForTest, textPerPage } from '../../../internal/testing'

describe('extractPages', () => {
  it('keeps the selected pages, in page order', async () => {
    expect(await textPerPage(await extractPages(await makeLabelledPdf(5), '4, 2'))).toEqual(['p2', 'p4'])
  })

  it('understands ranges and "end"', async () => {
    expect(await textPerPage(await extractPages(await makeLabelledPdf(6), '1-2, 5-end'))).toEqual(['p1', 'p2', 'p5', 'p6'])
  })

  it('embeds an image shared by the selected pages once', async () => {
    const file = await makeImagePdf(4, await makePng(200, 200))
    const out = await extractPages(file, '1-4')
    expect(out.length).toBeLessThan(file.length * 1.2)
  })

  it('reports NO_PAGES when the selection matches nothing', async () => {
    const err = await extractPages(await makeLabelledPdf(3), '7-9').catch(e => e)
    expect(err.code).toBe('NO_PAGES')
    expect(err.message).toContain('3 pages')
  })

  it('needs the selection as a string', async () => {
    expect((await extractPages(await makeLabelledPdf(1), 2 as never).catch(e => e)).code).toBe('INVALID_OPTIONS')
  })
})

describe('splitPdf', () => {
  it('writes one file per comma-separated part', async () => {
    const parts = await splitPdf(await makeLabelledPdf(5), '1-2, 3, 4-end')
    expect(await Promise.all(parts.map(textPerPage))).toEqual([['p1', 'p2'], ['p3'], ['p4', 'p5']])
  })

  it('reports NO_PAGES for a part that matches nothing, naming it', async () => {
    const err = await splitPdf(await makeLabelledPdf(3), '1, 8-9').catch(e => e)
    expect(err.code).toBe('NO_PAGES')
    expect(err.message).toContain('"8-9"')
  })

  it('reports progress once per output file', async () => {
    const seen: [number, number][] = []
    await splitPdf(await makeLabelledPdf(4), '1, 2-3, 4', { onProgress: (d, t) => { seen.push([d, t]) } })
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]])
  })

  it('needs at least one part', async () => {
    expect((await splitPdf(await makeLabelledPdf(2), ' , ').catch(e => e)).code).toBe('NO_PAGES')
  })
})

describe('errors', () => {
  it('refuses password-protected and non-PDF input', async () => {
    const locked = await encryptForTest(await makeLabelledPdf(1), 'pw')
    expect((await extractPages(locked, '1').catch(e => e)).code).toBe('ENCRYPTED')
    expect((await splitPdf(new Uint8Array([1]), '1').catch(e => e)).code).toBe('NOT_A_PDF')
  })
})

describe('parsePageRange', () => {
  it('is exported for callers that want to preview a selection', () => {
    expect(parsePageRange('2-end', 4)).toEqual([2, 3, 4])
  })
})
