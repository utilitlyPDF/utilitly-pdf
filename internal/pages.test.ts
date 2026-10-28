import { describe, it, expect } from 'vitest'
import { parsePageRange } from './pages'

describe('parsePageRange', () => {
  it('reads single pages, ranges and whitespace', () => {
    expect(parsePageRange('2-5, 8, 10-12', 12)).toEqual([2, 3, 4, 5, 8, 10, 11, 12])
  })

  it('returns pages sorted and without duplicates', () => {
    expect(parsePageRange('9, 2, 2-3', 12)).toEqual([2, 3, 9])
  })

  it('clamps ranges to the document', () => {
    expect(parsePageRange('0-3, 99', 4)).toEqual([1, 2, 3])
    expect(parsePageRange('3-99', 4)).toEqual([3, 4])
  })

  it('ignores junk and empty parts', () => {
    expect(parsePageRange('abc, , 2', 4)).toEqual([2])
  })

  it('selects nothing for a backwards range', () => {
    expect(parsePageRange('5-3', 8)).toEqual([])
  })

  it('accepts "end" as the last page', () => {
    expect(parsePageRange('8-end', 10)).toEqual([8, 9, 10])
    expect(parsePageRange('end', 10)).toEqual([10])
    expect(parsePageRange('1, END', 3)).toEqual([1, 3])
  })

  it('can resolve to nothing', () => {
    expect(parsePageRange('99', 3)).toEqual([])
    expect(parsePageRange('', 3)).toEqual([])
  })
})
