/**
 * Duplication planning — pure functions, no pdf-lib.
 *
 * The "plan" is an emit list: the sequence of ORIGINAL page indices the output
 * document is built from, in order. `[0, 1, 1, 2]` means "page 1, page 2, page 2
 * again, page 3". Everything about the output (its page count, where the copies
 * land) follows from this one list.
 */

export type Placement = 'after' | 'end'

/**
 * Build the emit list.
 *
 * @param pageCount  pages in the source document
 * @param selected   0-based indices to duplicate (order/duplicates in this array are ignored)
 * @param copies     extra copies of each selected page (1 = one extra copy); the
 *                   caller checks it is a whole number, 1 or more
 * @param placement  'after' puts each copy directly behind its original;
 *                   'end' groups every copy at the end, in ascending page order.
 */
export function buildEmitList(
  pageCount: number,
  selected: number[],
  copies: number,
  placement: Placement,
): number[] {
  if (pageCount <= 0) return []

  const n = copies
  // Normalise: unique, in range, ascending. The caller's click order is irrelevant —
  // a page's position in the document is what decides where its copies go.
  const picks = [...new Set(selected)]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < pageCount)
    .sort((a, b) => a - b)

  const out: number[] = []

  if (placement === 'after') {
    for (let i = 0; i < pageCount; i++) {
      out.push(i)
      if (picks.includes(i)) for (let c = 0; c < n; c++) out.push(i)
    }
  } else {
    for (let i = 0; i < pageCount; i++) out.push(i)
    for (const i of picks) for (let c = 0; c < n; c++) out.push(i)
  }

  return out
}
