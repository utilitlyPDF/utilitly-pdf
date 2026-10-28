/**
 * Reads a page selection such as `"1-3, 5, 8-end"` into sorted, unique,
 * 1-based page numbers.
 *
 * Lenient on purpose, matching the utilitly.com tools: junk parts are skipped,
 * ranges are clamped to the document, and a backwards range selects nothing.
 * Callers decide whether an empty result is an error.
 */
export function parsePageRange(range: string, pageCount: number): number[] {
  const pages = new Set<number>()
  const toNumber = (s: string) => (s.toLowerCase() === 'end' ? pageCount : parseInt(s, 10))

  for (const part of range.split(',').map(s => s.trim()).filter(Boolean)) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim())
      const start = toNumber(startStr)
      const end = toNumber(endStr)
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(pageCount, end); i++) pages.add(i)
      }
    } else {
      const page = toNumber(part)
      if (!isNaN(page) && page >= 1 && page <= pageCount) pages.add(page)
    }
  }

  return [...pages].sort((a, b) => a - b)
}

/** "1 page", "3 pages": for error messages. */
export function pagesLabel(count: number): string {
  return `${count} ${count === 1 ? 'page' : 'pages'}`
}
