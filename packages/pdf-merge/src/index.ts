import { PDFDocument } from 'pdf-lib'
import { PdfError } from '../../../internal/errors'
import { loadPdf } from '../../../internal/load'
import type { OnProgress, PdfInput } from '../../../internal/bytes'

export { PdfError } from '../../../internal/errors'
export type { PdfErrorCode } from '../../../internal/errors'
export type { OnProgress, PdfInput } from '../../../internal/bytes'

export type MergeOptions = {
  /** Called after each file is added, with (files done, total files). */
  onProgress?: OnProgress
}

/**
 * Merges PDFs into one, in the order given.
 *
 * Each file's pages are copied in a single call, so an image or font that
 * several pages of one file share is embedded once rather than once per page.
 */
export async function mergePdfs(pdfs: readonly PdfInput[], options: MergeOptions = {}): Promise<Uint8Array> {
  if (!Array.isArray(pdfs) || pdfs.length === 0) {
    throw new PdfError('INVALID_OPTIONS', 'mergePdfs needs an array with at least one PDF.')
  }

  const merged = await PDFDocument.create()
  for (let i = 0; i < pdfs.length; i++) {
    const source = await loadPdf(pdfs[i], `File ${i + 1}`)
    const pages = await merged.copyPages(source, source.getPageIndices())
    for (const page of pages) merged.addPage(page)
    await options.onProgress?.(i + 1, pdfs.length)
  }
  return merged.save()
}
