import { degrees } from 'pdf-lib'
import { PdfError } from '../../../internal/errors'
import { loadPdf } from '../../../internal/load'
import { pagesLabel, parsePageRange } from '../../../internal/pages'
import type { OnProgress, PdfInput } from '../../../internal/bytes'

export { PdfError } from '../../../internal/errors'
export type { PdfErrorCode } from '../../../internal/errors'
export type { OnProgress, PdfInput } from '../../../internal/bytes'

export type RotateOptions = {
  /** Pages to rotate, such as `"1-3, 5, 8-end"`. Every page when left out. */
  pages?: string
  /** Called after each rotated page, with (pages done, pages to rotate). */
  onProgress?: OnProgress
}

/**
 * Rotates pages clockwise by `angle` degrees, a multiple of 90. Negative angles
 * turn counter-clockwise.
 *
 * The angle is added to each page's existing rotation, and the result is kept
 * within 0-270 so every reader interprets it the same way.
 */
export async function rotatePdf(pdf: PdfInput, angle: number, options: RotateOptions = {}): Promise<Uint8Array> {
  if (!Number.isInteger(angle) || angle % 90 !== 0) {
    throw new PdfError('INVALID_OPTIONS', `The angle must be a multiple of 90 degrees, not ${angle}.`)
  }
  if (options.pages !== undefined && typeof options.pages !== 'string') {
    throw new PdfError('INVALID_OPTIONS', 'pages must be a string such as "1-3, 5, 8-end".')
  }

  const doc = await loadPdf(pdf)
  const count = doc.getPageCount()
  const targets = options.pages === undefined
    ? Array.from({ length: count }, (_, i) => i + 1)
    : parsePageRange(options.pages, count)
  if (targets.length === 0) {
    throw new PdfError('NO_PAGES', `"${options.pages}" doesn't match any page. The PDF has ${pagesLabel(count)}.`)
  }

  for (let i = 0; i < targets.length; i++) {
    const page = doc.getPage(targets[i] - 1)
    const turned = (((page.getRotation().angle + angle) % 360) + 360) % 360
    page.setRotation(degrees(turned))
    await options.onProgress?.(i + 1, targets.length)
  }
  return doc.save()
}
