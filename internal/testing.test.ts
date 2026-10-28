import { describe, it, expect } from 'vitest'
import { makeLabelledPdf, textPerPage } from './testing'

// The suites lean on these readers, so they get a check of their own.
describe('test helpers', () => {
  it('reads back the text of each page in order', async () => {
    expect(await textPerPage(await makeLabelledPdf(3))).toEqual(['p1', 'p2', 'p3'])
  })
})
