import { describe, it, expect } from 'vitest'
import { buildEmitList } from './plan'

describe('buildEmitList — placement "after"', () => {
  it('puts one copy directly behind its original', () => {
    expect(buildEmitList(4, [1], 1, 'after')).toEqual([0, 1, 1, 2, 3])
  })

  it('repeats the page for multiple copies', () => {
    expect(buildEmitList(3, [0], 3, 'after')).toEqual([0, 0, 0, 0, 1, 2])
  })

  it('handles several selected pages at once', () => {
    expect(buildEmitList(4, [0, 3], 1, 'after')).toEqual([0, 0, 1, 2, 3, 3])
  })
})

describe('buildEmitList — placement "end"', () => {
  it('groups copies after the whole document', () => {
    expect(buildEmitList(4, [1], 1, 'end')).toEqual([0, 1, 2, 3, 1])
  })

  it('keeps grouped copies in ascending page order regardless of click order', () => {
    expect(buildEmitList(4, [3, 0], 1, 'end')).toEqual([0, 1, 2, 3, 0, 3])
  })

  it('emits every copy of a page together', () => {
    expect(buildEmitList(2, [0], 2, 'end')).toEqual([0, 1, 0, 0])
  })
})

describe('buildEmitList — input hygiene', () => {
  it('returns an empty plan for an empty document', () => {
    expect(buildEmitList(0, [0], 1, 'after')).toEqual([])
  })

  it('is the identity order when nothing is selected', () => {
    expect(buildEmitList(3, [], 4, 'after')).toEqual([0, 1, 2])
    expect(buildEmitList(3, [], 4, 'end')).toEqual([0, 1, 2])
  })

  it('ignores out-of-range and duplicate selections', () => {
    expect(buildEmitList(3, [1, 1, 9, -2], 1, 'after')).toEqual([0, 1, 1, 2])
  })
})
