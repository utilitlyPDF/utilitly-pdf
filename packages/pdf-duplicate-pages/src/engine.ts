import { PDFDocument, PDFPage } from 'pdf-lib'
import type { OnProgress } from '../../../internal/bytes'

/**
 * Build a new PDF from an emit list (see ./plan).
 *
 * Why this is not just `copyPages(src, emit)` in a loop:
 *
 * `copyPages` deduplicates shared objects only WITHIN a single call. Calling it
 * once per emitted page re-embeds that page's fonts and images every time, so
 * duplicating one image-heavy page five times multiplies the asset, not the
 * reference — measured at 4.82 MB against 0.80 MB for the same 9-page output.
 *
 * So each distinct source page is copied exactly once, in one bulk call, and every
 * repeat is a shallow clone of the resulting page dictionary: a NEW page object
 * that points at the SAME content stream and resource refs. Cheap, and — unlike
 * pushing the identical page object into the tree twice — spec-correct, because
 * each entry in /Kids is a distinct node with its own /Parent.
 */
export async function writeDuplicates(
  src: PDFDocument,
  emit: number[],
  onPage?: OnProgress,
): Promise<Uint8Array> {
  if (emit.length === 0) throw new Error('Nothing to write: the page plan is empty.')

  const out = await PDFDocument.create()

  // One bulk copy of the distinct pages -> shared resources are embedded once.
  const uniq = [...new Set(emit)]
  const copied = await out.copyPages(src, uniq)
  const byIndex = new Map<number, PDFPage>(uniq.map((srcIdx, k) => [srcIdx, copied[k]]))

  const placed = new Set<number>()
  for (let i = 0; i < emit.length; i++) {
    const base = byIndex.get(emit[i])!
    if (!placed.has(emit[i])) {
      out.addPage(base)
      placed.add(emit[i])
    } else {
      const node = base.node.clone(out.context)
      const ref = out.context.register(node)
      out.addPage(PDFPage.of(node, ref, out))
    }
    await onPage?.(i + 1, emit.length)
  }

  return out.save()
}
