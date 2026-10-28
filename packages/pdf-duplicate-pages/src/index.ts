import { PdfError } from '../../../internal/errors'
import { loadPdf } from '../../../internal/load'
import { pagesLabel, parsePageRange } from '../../../internal/pages'
import type { OnProgress, PdfInput } from '../../../internal/bytes'
import { buildEmitList, type Placement } from './plan'
import { writeDuplicates } from './engine'

export { PdfError } from '../../../internal/errors'
export type { PdfErrorCode } from '../../../internal/errors'
export type { OnProgress, PdfInput } from '../../../internal/bytes'
export type { Placement } from './plan'

export type DuplicateOptions = {
  /** Extra copies of each selected page. Default 1. */
  copies?: number
  /** `'after'` (default) puts copies right behind their page; `'end'` adds them all at the end. */
  placement?: Placement
  /** Called after each page of the output is written, with (pages done, total pages). */
  onProgress?: OnProgress
}

function invalid(message: string): never {
  throw new PdfError('INVALID_OPTIONS', message)
}

/**
 * Duplicates the selected pages. Copies share the original page's content,
 * images and fonts, so duplicating an image-heavy page barely grows the file.
 */
export async function duplicatePages(pdf: PdfInput, pages: string, options: DuplicateOptions = {}): Promise<Uint8Array> {
  if (typeof pages !== 'string') invalid('pages must be a string such as "2" or "1, 4-end".')
  const copies = options.copies ?? 1
  if (!Number.isInteger(copies) || copies < 1) invalid('copies must be a whole number, 1 or more.')
  const placement = options.placement ?? 'after'
  if (placement !== 'after' && placement !== 'end') invalid(`placement must be "after" or "end", not "${placement}".`)

  const source = await loadPdf(pdf)
  const count = source.getPageCount()
  const selected = parsePageRange(pages, count)
  if (selected.length === 0) {
    throw new PdfError('NO_PAGES', `"${pages}" doesn't match any page. The PDF has ${pagesLabel(count)}.`)
  }

  const emit = buildEmitList(count, selected.map(p => p - 1), copies, placement)
  return writeDuplicates(source, emit, options.onProgress)
}
