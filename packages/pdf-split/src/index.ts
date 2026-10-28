import { PdfError } from '../../../internal/errors'
import { copyPagesToNewPdf } from '../../../internal/copy'
import { loadPdf } from '../../../internal/load'
import { pagesLabel, parsePageRange } from '../../../internal/pages'
import type { OnProgress, PdfInput } from '../../../internal/bytes'

export { PdfError } from '../../../internal/errors'
export type { PdfErrorCode } from '../../../internal/errors'
export type { OnProgress, PdfInput } from '../../../internal/bytes'
export { parsePageRange } from '../../../internal/pages'

export type SplitOptions = {
  /** Called after each output file is written, with (files done, total files). */
  onProgress?: OnProgress
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new PdfError('INVALID_OPTIONS', `${name} must be a string such as "1-3, 5, 8-end".`)
  return value
}

/**
 * Copies the selected pages into a new PDF, in page order.
 *
 * `pages` is a selection such as `"1-3, 5, 8-end"`. Parts that don't match a
 * page are skipped; if nothing matches, it throws NO_PAGES.
 */
export async function extractPages(pdf: PdfInput, pages: string): Promise<Uint8Array> {
  const selection = requireString(pages, 'pages')
  const source = await loadPdf(pdf)
  const count = source.getPageCount()
  const selected = parsePageRange(selection, count)
  if (selected.length === 0) {
    throw new PdfError('NO_PAGES', `"${selection}" doesn't match any page. The PDF has ${pagesLabel(count)}.`)
  }
  return copyPagesToNewPdf(source, selected)
}

/**
 * Splits a PDF into one new PDF per comma-separated part of `ranges`.
 *
 * `"1-2, 3, 4-end"` on a 5-page file gives three files: pages 1-2, page 3 and
 * pages 4-5. A part that matches no page throws NO_PAGES.
 */
export async function splitPdf(pdf: PdfInput, ranges: string, options: SplitOptions = {}): Promise<Uint8Array[]> {
  const parts = requireString(ranges, 'ranges').split(',').map(s => s.trim()).filter(Boolean)
  const source = await loadPdf(pdf)
  const count = source.getPageCount()
  if (parts.length === 0) {
    throw new PdfError('NO_PAGES', `"${ranges}" doesn't name any pages. The PDF has ${pagesLabel(count)}.`)
  }

  const selections = parts.map(part => {
    const selected = parsePageRange(part, count)
    if (selected.length === 0) {
      throw new PdfError('NO_PAGES', `"${part}" doesn't match any page. The PDF has ${pagesLabel(count)}.`)
    }
    return selected
  })

  const files: Uint8Array[] = []
  for (const selected of selections) {
    files.push(await copyPagesToNewPdf(source, selected))
    await options.onProgress?.(files.length, selections.length)
  }
  return files
}
