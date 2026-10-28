// No dependencies, so packages that don't use pdf-lib can import this.

import { PdfError } from './errors'

/** The bytes of a PDF. A Node.js Buffer works too, since it is a Uint8Array. */
export type PdfInput = Uint8Array | ArrayBuffer

/** Optional progress callback. Awaited, so a UI can yield a frame between steps. */
export type OnProgress = (done: number, total: number) => void | Promise<void>

// Tag checks rather than instanceof, so bytes from another realm (an iframe, a
// worker, a vm context) are still recognised.
export function toBytes(input: PdfInput, what = 'The PDF'): Uint8Array {
  const tag = Object.prototype.toString.call(input)
  if (tag === '[object Uint8Array]') return input as Uint8Array
  if (tag === '[object ArrayBuffer]') return new Uint8Array(input as ArrayBuffer)
  throw new PdfError('INVALID_INPUT', `${what} must be a Uint8Array or an ArrayBuffer.`)
}
