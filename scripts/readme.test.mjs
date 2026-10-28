import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderAll } from './readme-art.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packages = readdirSync(join(root, 'packages')).filter(name => existsSync(join(root, 'packages', name, 'package.json')))
const readme = name => readFileSync(join(root, 'packages', name, 'README.md'), 'utf8')

/**
 * The sentences a reader (and npm's search index) sees: no code, tables, HTML
 * or headings, no link-only lines, and nothing from the License section, which
 * is boilerplate on purpose.
 */
export function proseSentences(markdown) {
  const body = markdown.split(/^## License$/m)[0].replace(/```[\s\S]*?```/g, '')
  return body
    .split('\n')
    .map(line => line.trim().replace(/^- /, ''))
    .filter(line => line && !/^[|<#>]/.test(line) && (line.match(/\]\(/g) ?? []).length < 3)
    .flatMap(line => line.split(/(?<=[.!?:])\s+/))
    .map(sentence => sentence.toLowerCase())
    .filter(sentence => sentence.length >= 40)
}

describe('README images', () => {
  const files = renderAll()

  it('match what scripts/readme-art.mjs generates', () => {
    for (const [path, contents] of Object.entries(files)) {
      expect(readFileSync(join(root, path), 'utf8'), `${path} is out of date: run node scripts/readme-art.mjs`).toBe(contents)
    }
  })

  it('carry no scripts, event handlers or external files, which GitHub and npm would block', () => {
    for (const path of Object.keys(files)) {
      const svg = readFileSync(join(root, path), 'utf8')
      expect(svg, path).not.toMatch(/<script|<foreignObject|@import|url\(|href=|\son[a-z]+=/i)
      expect(svg, path).toContain('<title id="title">')
      expect(svg.length, path).toBeLessThan(20_000)
    }
  })
})

describe('package READMEs', () => {
  for (const name of packages) {
    it(`${name}: opens with its package name`, () => {
      expect(readme(name)).toMatch(new RegExp(`^# @utilitly/${name}$`, 'm'))
    })

    it(`${name}: shows its hero and its Network panel, light and dark, from files that exist`, () => {
      for (const file of ['hero-light.svg', 'hero-dark.svg', 'network-light.svg', 'network-dark.svg']) {
        expect(readme(name)).toContain(`./assets/${file}`)
        expect(existsSync(join(root, 'packages', name, 'assets', file)), file).toBe(true)
      }
    })

    it(`${name}: follows the shared section order`, () => {
      const headings = [...readme(name).matchAll(/^## (.+)$/gm)].map(m => m[1])
      expect(headings[0]).toBe('Install')
      expect(headings[1]).toMatch(/ in 30 seconds$/)
      expect(headings).toContain('API')
      expect(headings.indexOf('API')).toBeLessThan(headings.indexOf('Good to know'))
      expect(headings.at(-1)).toBe('License')
    })

    it(`${name}: has alt text on every image`, () => {
      for (const img of readme(name).match(/<img [^>]*>/g)) expect(img).toMatch(/alt="[^"]{20,}"/)
    })
  }

  it('share no sentences, so npm does not index six copies of one page', () => {
    const seenIn = new Map()
    const repeats = []
    for (const name of packages) {
      for (const sentence of new Set(proseSentences(readme(name)))) {
        if (seenIn.has(sentence)) repeats.push(`${seenIn.get(sentence)} and ${name}: "${sentence}"`)
        else seenIn.set(sentence, name)
      }
    }
    expect(repeats).toEqual([])
  })
})

describe('root README', () => {
  it('shows the Network panel and links to every package folder', () => {
    const md = readFileSync(join(root, 'README.md'), 'utf8')
    expect(md).toContain('./assets/network-light.svg')
    expect(md).toContain('./assets/network-dark.svg')
    for (const name of packages) {
      expect(md).toContain(`](./packages/${name})`)
    }
  })
})
