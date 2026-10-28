import { PDFDocument } from 'pdf-lib'

/**
 * A new PDF holding `pages` (1-based) of `source`, in the order given.
 *
 * One bulk copy, not one copy per page: copyPages shares objects only within a
 * call, so copying page by page embeds a shared image or font once per page.
 */
export async function copyPagesToNewPdf(source: PDFDocument, pages: readonly number[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const page of await out.copyPages(source, pages.map(p => p - 1))) out.addPage(page)
  return out.save()
}
