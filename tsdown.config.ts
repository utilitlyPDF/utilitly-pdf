import { defineConfig } from 'tsdown'

// Shared by every package. Each one runs `tsdown -c ../../tsdown.config.ts`
// from its own folder. tsdown resolves paths from the config file's folder
// when -c is used, so cwd is pinned back to the package being built.
export default defineConfig({
  cwd: process.cwd(),
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // The engines run in Node and in browsers, so the output can't assume either.
  platform: 'neutral',
  target: 'es2022',
  fixedExtension: true,
  dts: true,
  clean: true,
  failOnWarn: true,
})
