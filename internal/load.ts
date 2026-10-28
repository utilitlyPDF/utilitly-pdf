import { PDFDocument } from 'pdf-lib'
import { PdfError } from './errors'
import { toBytes, type PdfInput } from './bytes'

/**
 * Opens a PDF for editing.
 *
 * Encrypted files are refused: pdf-lib can't decrypt, so editing one writes a
 * file whose pages no longer render. Detection reads pdf-lib's `isEncrypted`
 * flag rather than its EncryptedPDFError, which fails `instanceof` checks.
 */
export async function loadPdf(input: PdfInput, what = 'The PDF'): Promise<PDFDocument> {
  const bytes = toBytes(input, what)
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch (err) {
    throw new PdfError('NOT_A_PDF', `${what} could not be read as a PDF.`, { cause: err })
  }
  if (doc.isEncrypted) {
    throw new PdfError('ENCRYPTED', `${what} is password-protected. Remove the password first, then try again.`)
  }
  return doc
}
