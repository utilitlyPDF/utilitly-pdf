import { describe, it, expect } from 'vitest'
import { toBytes } from './bytes'

describe('toBytes', () => {
  it('passes a Uint8Array through unchanged', () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(toBytes(bytes)).toBe(bytes)
  })

  it('wraps an ArrayBuffer', () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer
    expect(toBytes(buffer)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('accepts a Node Buffer, which is a Uint8Array', () => {
    expect([...toBytes(Buffer.from([1, 2]))]).toEqual([1, 2])
  })

  it('rejects anything else with INVALID_INPUT', () => {
    expect(() => toBytes('%PDF-1.7' as never)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }))
  })
})
