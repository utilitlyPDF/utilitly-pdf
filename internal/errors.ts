export type PdfErrorCode =
  /** The input wasn't a Uint8Array or ArrayBuffer. */
  | 'INVALID_INPUT'
  /** The bytes couldn't be parsed as a PDF. */
  | 'NOT_A_PDF'
  /** The PDF is password-protected and has to be unlocked first. */
  | 'ENCRYPTED'
  /** A page selection matched no pages in the document. */
  | 'NO_PAGES'
  /** An option was missing or out of range. */
  | 'INVALID_OPTIONS'

/**
 * Every failure these packages report. Check `code` rather than `instanceof`:
 * each package bundles its own copy of this class.
 */
export class PdfError extends Error {
  readonly code: PdfErrorCode

  constructor(code: PdfErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PdfError'
    this.code = code
  }
}
