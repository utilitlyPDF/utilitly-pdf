// Real-install check: packs every package exactly as npm would publish it,
// installs the tarballs into a brand-new project in a temp folder, and runs
// each one there through both `import` and `require`.
//
//   npm run build && node scripts/smoke-install.mjs
//
// Catches what tests inside the repo can't: a file missing from the tarball, a
// dependency that isn't declared, an exports map that doesn't resolve.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Folders with a package.json only: macOS drops .DS_Store files in here.
const packages = readdirSync(join(root, 'packages')).filter(name => existsSync(join(root, 'packages', name, 'package.json')))
const work = mkdtempSync(join(tmpdir(), 'utilitly-smoke-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// One script, run twice: once as ESM, once as CommonJS.
const exercise = load => `
${load}
const base = await PDFDocument.create()
for (let i = 0; i < 3; i++) base.addPage([612, 792])
const pdf = await base.save()
const pages = async bytes => (await PDFDocument.load(bytes)).getPageCount()
const results = {}

results['pdf-merge'] = (await pages(await merge.mergePdfs([pdf, pdf]))) === 6
results['pdf-split'] = (await pages(await split.extractPages(pdf, '2-end'))) === 2
const rotated = await PDFDocument.load(await rotate.rotatePdf(pdf, 90))
results['pdf-rotate'] = rotated.getPage(0).getRotation().angle === 90
results['pdf-delete-pages'] = (await pages(await remove.deletePages(pdf, '1'))) === 2
results['pdf-reorder-pages'] = (await pages(await reorder.reorderPages(pdf, [3, 1, 2]))) === 3
results['pdf-duplicate-pages'] = (await pages(await duplicate.duplicatePages(pdf, '2', { copies: 2 }))) === 5

console.log(JSON.stringify(results))
`

const ESM = exercise(`
import { PDFDocument } from 'pdf-lib'
import * as merge from '@utilitly/pdf-merge'
import * as split from '@utilitly/pdf-split'
import * as rotate from '@utilitly/pdf-rotate'
import * as remove from '@utilitly/pdf-delete-pages'
import * as reorder from '@utilitly/pdf-reorder-pages'
import * as duplicate from '@utilitly/pdf-duplicate-pages'
`)

const CJS = `(async () => {${exercise(`
const { PDFDocument } = require('pdf-lib')
const merge = require('@utilitly/pdf-merge')
const split = require('@utilitly/pdf-split')
const rotate = require('@utilitly/pdf-rotate')
const remove = require('@utilitly/pdf-delete-pages')
const reorder = require('@utilitly/pdf-reorder-pages')
const duplicate = require('@utilitly/pdf-duplicate-pages')
`)}})().catch(err => { console.error(err); process.exitCode = 1 })`

let failed = false

// The temp project installs pdf-lib for its own use, which would hide a package
// that imports pdf-lib without declaring it. So check the built code directly:
// everything it imports must be one of the package's declared dependencies.
const IMPORTS = /\bimport\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/g
for (const name of packages) {
  const dir = join(root, 'packages', name)
  const declared = Object.keys(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).dependencies ?? {})
  for (const file of ['dist/index.mjs', 'dist/index.cjs']) {
    const used = [...readFileSync(join(dir, file), 'utf8').matchAll(IMPORTS)]
      .map(m => m[1] ?? m[2] ?? m[3])
      .filter(spec => !spec.startsWith('.') && !spec.startsWith('node:'))
      .map(spec => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/'))
    for (const dep of new Set(used)) {
      if (!declared.includes(dep)) {
        failed = true
        console.error(`FAIL  @utilitly/${name} ${file} imports "${dep}", which is not in its dependencies`)
      }
    }
  }
}

try {
  const tarballs = join(work, 'tarballs')
  mkdirSync(tarballs)
  for (const name of packages) {
    const out = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', tarballs], join(root, 'packages', name)))[0]
    console.log(`packed ${out.name}: ${out.files.map(f => f.path).join(', ')}`)
  }

  const app = join(work, 'app')
  mkdirSync(app)
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'smoke-app', private: true }))
  // pdf-lib is installed only so the script can build a test PDF; the packages
  // bring their own dependencies.
  run(npm, ['install', '--no-audit', '--no-fund', '--prefer-offline', 'pdf-lib', ...readdirSync(tarballs).map(t => join(tarballs, t))], app)
  writeFileSync(join(app, 'esm.mjs'), ESM)
  writeFileSync(join(app, 'cjs.cjs'), CJS)

  for (const [label, file] of [['import', 'esm.mjs'], ['require', 'cjs.cjs']]) {
    const results = JSON.parse(run(process.execPath, [file], app))
    for (const name of packages) {
      const ok = results[name] === true
      failed ||= !ok
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(7)} @utilitly/${name}`)
    }
  }

  // Each README's Node.js example, run exactly as written against the files it
  // reads, which are generated here. Every PDF it writes must be a real PDF.
  const { PDFDocument } = await import('pdf-lib')
  const samplePdf = async () => {
    const doc = await PDFDocument.create()
    for (let i = 1; i <= 6; i++) doc.addPage([612, 792]).drawText(`Sample page ${i}`, { x: 60, y: 700, size: 24 })
    return doc.save()
  }
  for (const name of packages) {
    const markdown = readFileSync(join(root, 'packages', name, 'README.md'), 'utf8')
    const example = [...markdown.matchAll(/```js\n([\s\S]*?)```/g)].map(m => m[1]).find(code => code.includes("from 'node:fs/promises'"))
    let ok = false
    let detail = 'no Node.js example in the README'
    if (example) {
      const dir = join(app, `readme-${name}`)
      mkdirSync(dir)
      for (const [, file] of example.matchAll(/readFile\('([^']+)'\)/g)) writeFileSync(join(dir, file), await samplePdf())
      writeFileSync(join(dir, 'example.mjs'), example)
      const before = new Set(readdirSync(dir))
      try {
        run(process.execPath, ['example.mjs'], dir)
        const written = readdirSync(dir).filter(f => f.endsWith('.pdf') && !before.has(f))
        ok = written.length > 0 && written.every(f => readFileSync(join(dir, f)).subarray(0, 5).toString('latin1') === '%PDF-')
        detail = written.join(', ') || 'wrote no PDF'
      } catch (err) {
        const lines = String(err.stderr || err.message).trim().split('\n')
        detail = lines.find(line => /^\w*Error: /.test(line)) ?? lines[0]
      }
    }
    failed ||= !ok
    console.log(`${ok ? 'PASS' : 'FAIL'}  README  @utilitly/${name}: ${detail}`)
  }
} catch (err) {
  failed = true
  console.error(err.stderr || err)
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (failed) {
  console.error('\nSmoke install failed.')
  process.exitCode = 1
} else {
  console.log(`\nSmoke install passed: ${packages.length} packages, installed from their tarballs, via import and require, and every README example ran.`)
}
