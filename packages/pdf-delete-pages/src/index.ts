import { PdfError } from '../../../internal/errors'
import { loadPdf } from '../../../internal/load'
import { copyPagesToNewPdf } from '../../../internal/copy'
import { pagesLabel, parsePageRange } from '../../../internal/pages'
import type { PdfInput } from '../../../internal/bytes'

export { PdfError } from '../../../internal/errors'
export type { PdfErrorCode } from '../../../internal/errors'
export type { PdfInput } from '../../../internal/bytes'

/**
 * Removes the selected pages and returns a new PDF with the rest, in their
 * original order.
 *
 * `pages` is a selection such as `"2, 5-end"`. If nothing matches it throws
 * NO_PAGES; if everything would go it throws INVALID_OPTIONS, since a PDF
 * needs at least one page.
 */
export async function deletePages(pdf: PdfInput, pages: string): Promise<Uint8Array> {
  if (typeof pages !== 'string') {
    throw new PdfError('INVALID_OPTIONS', 'pages must be a string such as "2, 5-end".')
  }
  const source = await loadPdf(pdf)
  const count = source.getPageCount()
  const doomed = new Set(parsePageRange(pages, count))
  if (doomed.size === 0) {
    throw new PdfError('NO_PAGES', `"${pages}" doesn't match any page. The PDF has ${pagesLabel(count)}.`)
  }
  if (doomed.size === count) {
    throw new PdfError('INVALID_OPTIONS', `"${pages}" would delete all ${pagesLabel(count)}. A PDF needs at least one page.`)
  }
  const kept = Array.from({ length: count }, (_, i) => i + 1).filter(page => !doomed.has(page))
  return copyPagesToNewPdf(source, kept)
}
