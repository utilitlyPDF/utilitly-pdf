import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { loadPdf } from './load'
import { PdfError } from './errors'
import { makePdf, encryptForTest } from './testing'

describe('loadPdf', () => {
  it('opens a valid PDF', async () => {
    const doc = await loadPdf(await makePdf(3))
    expect(doc).toBeInstanceOf(PDFDocument)
    expect(doc.getPageCount()).toBe(3)
  })

  it('rejects bytes that are not a PDF with NOT_A_PDF', async () => {
    const err = await loadPdf(new TextEncoder().encode('hello')).catch(e => e)
    expect(err).toBeInstanceOf(PdfError)
    expect(err.code).toBe('NOT_A_PDF')
  })

  it('rejects a password-protected PDF with ENCRYPTED instead of writing a broken file', async () => {
    const locked = await encryptForTest(await makePdf(1), 'secret')
    const err = await loadPdf(locked).catch(e => e)
    expect(err.code).toBe('ENCRYPTED')
  })

  it('also rejects a PDF that only has an owner password, which pdf-lib cannot decrypt either', async () => {
    const restricted = await encryptForTest(await makePdf(1), '', 'owner')
    const err = await loadPdf(restricted).catch(e => e)
    expect(err.code).toBe('ENCRYPTED')
  })

  it('names the input in its message', async () => {
    const err = await loadPdf(new Uint8Array([1]), 'File 2').catch(e => e)
    expect(err.message).toMatch(/^File 2 /)
  })
})
