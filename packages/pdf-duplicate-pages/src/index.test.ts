import { describe, it, expect } from 'vitest'
import { duplicatePages } from './index'
import { makeLabelledPdf, makePdf, encryptForTest, textPerPage } from '../../../internal/testing'

describe('duplicatePages', () => {
  it('puts one copy right after the page by default', async () => {
    expect(await textPerPage(await duplicatePages(await makeLabelledPdf(3), '2'))).toEqual(['p1', 'p2', 'p2', 'p3'])
  })

  it('makes as many copies as asked', async () => {
    expect(await textPerPage(await duplicatePages(await makeLabelledPdf(2), '1', { copies: 3 }))).toEqual(['p1', 'p1', 'p1', 'p1', 'p2'])
  })

  it('can put the copies at the end instead', async () => {
    expect(await textPerPage(await duplicatePages(await makeLabelledPdf(3), '1, 3', { placement: 'end' }))).toEqual(['p1', 'p2', 'p3', 'p1', 'p3'])
  })

  it('understands ranges and "end"', async () => {
    expect(await textPerPage(await duplicatePages(await makeLabelledPdf(3), '2-end'))).toEqual(['p1', 'p2', 'p2', 'p3', 'p3'])
  })

  it('reports progress once per page written', async () => {
    const seen: [number, number][] = []
    await duplicatePages(await makePdf(2), '1', { onProgress: (d, t) => { seen.push([d, t]) } })
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]])
  })

  it('reports NO_PAGES when the selection matches nothing', async () => {
    expect((await duplicatePages(await makePdf(2), '7').catch(e => e)).code).toBe('NO_PAGES')
  })

  it('refuses options it cannot use', async () => {
    const pdf = await makePdf(2)
    for (const [pages, options] of [
      ['1', { copies: 0 }], ['1', { copies: 1.5 }], ['1', { copies: NaN }],
      ['1', { placement: 'middle' }], [2, {}],
    ] as const) {
      expect((await duplicatePages(pdf, pages as never, options as never).catch(e => e)).code, JSON.stringify(options)).toBe('INVALID_OPTIONS')
    }
  })

  it('refuses password-protected and non-PDF input', async () => {
    const locked = await encryptForTest(await makePdf(2), 'pw')
    expect((await duplicatePages(locked, '1').catch(e => e)).code).toBe('ENCRYPTED')
    expect((await duplicatePages(new Uint8Array([1]), '1').catch(e => e)).code).toBe('NOT_A_PDF')
  })
})
