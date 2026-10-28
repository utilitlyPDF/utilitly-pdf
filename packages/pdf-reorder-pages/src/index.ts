import { PdfError } from '../../../internal/errors'
import { loadPdf } from '../../../internal/load'
import { copyPagesToNewPdf } from '../../../internal/copy'
import { pagesLabel } from '../../../internal/pages'
import type { PdfInput } from '../../../internal/bytes'

export { PdfError } from '../../../internal/errors'
export type { PdfErrorCode } from '../../../internal/errors'
export type { PdfInput } from '../../../internal/bytes'

function invalid(message: string): never {
  throw new PdfError('INVALID_OPTIONS', message)
}

/**
 * Returns a new PDF with the pages in `order`, a list of 1-based page numbers
 * that names every page exactly once: `[3, 1, 2]` moves page 3 to the front.
 */
export async function reorderPages(pdf: PdfInput, order: readonly number[]): Promise<Uint8Array> {
  if (!Array.isArray(order) || !order.every(n => Number.isInteger(n) && n >= 1)) {
    invalid('order must be an array of page numbers, such as [3, 1, 2].')
  }
  const source = await loadPdf(pdf)
  const count = source.getPageCount()

  const seen = new Set<number>()
  for (const page of order) {
    if (page > count) invalid(`The order names page ${page}, but the PDF has ${pagesLabel(count)}.`)
    if (seen.has(page)) invalid(`The order names page ${page} more than once.`)
    seen.add(page)
  }
  for (let page = 1; page <= count; page++) {
    if (!seen.has(page)) {
      invalid(`The order leaves out page ${page}. List every page once; to remove pages, use @utilitly/pdf-delete-pages.`)
    }
  }

  return copyPagesToNewPdf(source, order)
}
