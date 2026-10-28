// Generates the animated SVGs the READMEs show, in a light and a dark version.
//
//   node scripts/readme-art.mjs
//
// GitHub loads README images through <img>, which strips scripts, so every
// animation here is CSS only. Text uses system fonts because an <img> SVG can't
// load web fonts. Each animated element's resting style is the frame worth
// showing on its own, so reduced motion (and any viewer that doesn't animate)
// still gets a meaningful picture.
//
// scripts/readme.test.mjs fails if the files on disk drift from this script.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const THEMES = {
  light: {
    card: '#f6f7fb', panel: '#ffffff', stroke: '#dcdcea', ink: '#1c1c30', muted: '#6b6b86', faint: '#a6a7bf',
    accent: '#4f46e5', accentSoft: '#e6e5fc', page: '#ffffff', pageLine: '#e4e4ef',
    green: '#1a9b4b', amber: '#d97706', red: '#e5484d',
  },
  dark: {
    card: '#11121b', panel: '#181926', stroke: '#2c2d40', ink: '#e8e8f3', muted: '#9a9bb6', faint: '#5d5e7a',
    accent: '#9a9bfb', accentSoft: '#26274a', page: '#1d1e2c', pageLine: '#33344a',
    green: '#3fb950', amber: '#f0a032', red: '#ff6b6f',
  },
}

const FONT = `ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function svg({ width, height, title, desc, css, body }, t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title>
<desc id="desc">${esc(desc)}</desc>
<style>
text { font-family: ${FONT}; fill: ${t.ink}; }
.mono { font-family: ${MONO}; }
.muted { fill: ${t.muted}; }
.faint { fill: ${t.faint}; }
.accent { fill: ${t.accent}; }
.anim { transform-box: fill-box; transform-origin: center; }
${css.trim()}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="16" fill="${t.card}" stroke="${t.stroke}"/>
${body.trim()}
</svg>
`
}

/** A document page: header bar plus text lines. */
function page(t, { x, y, w = 90, h = 116, bar = t.accent, lines = 5, number, picture = false }) {
  const pad = Math.round(w * 0.11)
  const widths = [0.82, 0.68, 0.9, 0.58, 0.76, 0.5, 0.84, 0.64, 0.72]
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${t.page}" stroke="${t.stroke}"/>`
  s += `<rect x="${x + pad}" y="${y + pad}" width="${Math.round(w * 0.42)}" height="7" rx="2" fill="${bar}"/>`
  if (number !== undefined) {
    s += `<text x="${x + w - pad}" y="${y + pad + 7}" text-anchor="end" font-size="10" class="mono muted">${number}</text>`
  }
  if (picture) {
    // An image block in place of the lower lines: the asset copies share.
    const top = y + pad + 18 + 2 * 11
    const ph = h - (top - y) - pad
    s += `<rect x="${x + pad}" y="${top}" width="${w - 2 * pad}" height="${ph}" rx="3" fill="${t.accentSoft}"/>`
    s += `<path d="M ${x + pad + 6} ${top + ph - 6} l 16 -20 l 12 14 l 8 -9 l 14 15 z" fill="${t.accent}" opacity="0.55"/>`
    s += `<circle cx="${x + w - pad - 12}" cy="${top + 10}" r="5" fill="${t.amber}" opacity="0.8"/>`
    lines = 2
  }
  const step = Math.min(11, (h - pad * 2 - 18) / lines)
  for (let i = 0; i < lines; i++) {
    s += `<rect x="${x + pad}" y="${Math.round(y + pad + 18 + i * step)}" width="${Math.round((w - 2 * pad) * widths[i % widths.length])}" height="4" rx="2" fill="${t.pageLine}"/>`
  }
  return s
}

/** The code line along the bottom of each hero. */
function caption(code, note) {
  return `<text x="36" y="238" font-size="14" class="mono">${esc(code)}</text>` +
    (note ? `<text x="804" y="238" font-size="12.5" text-anchor="end" class="muted">${esc(note)}</text>` : '')
}

// ── Heroes: one per package ─────────────────────────────────────────────────

function mergeHero(t) {
  const files = [
    { name: 'a.pdf', x: 120, bar: t.accent, cls: 'srcL' },
    { name: 'b.pdf', x: 375, bar: t.green, cls: 'srcC' },
    { name: 'c.pdf', x: 630, bar: t.amber, cls: 'srcR' },
  ]
  const stack = (x, bar) => page(t, { x: x + 6, y: 40, bar }) + page(t, { x, y: 46, bar })
  const sources = files.map(f =>
    `<g class="anim ${f.cls}">${stack(f.x, f.bar)}<text x="${f.x + 45}" y="186" text-anchor="middle" font-size="13" class="mono muted">${f.name}</text></g>`
  ).join('\n')
  // Back to front: c's pages, then b's, then a's page 1 on top.
  const layers = [t.amber, t.amber, t.green, t.green, t.accent, t.accent]
  const merged = layers.map((bar, i) => page(t, { x: 375 + (5 - i) * 5, y: 46 - (5 - i) * 5 + 12, bar })).join('')
  return svg({
    width: 840, height: 260,
    title: '@utilitly/pdf-merge',
    desc: 'Three PDFs slide together into one merged PDF of six pages, in the order given.',
    css: `
.srcL, .srcC, .srcR { opacity: 0; }
.srcL { animation: srcL 6s ease-in-out infinite; }
.srcC { animation: srcC 6s ease-in-out infinite; }
.srcR { animation: srcR 6s ease-in-out infinite; }
.merged { animation: merged 6s ease-in-out infinite; }
@keyframes srcL { 0% { opacity: 0; transform: translateX(0); } 6%, 22% { opacity: 1; transform: translateX(0); } 48% { opacity: 1; transform: translateX(255px); } 54%, 100% { opacity: 0; transform: translateX(255px); } }
@keyframes srcC { 0% { opacity: 0; } 6%, 46% { opacity: 1; } 54%, 100% { opacity: 0; } }
@keyframes srcR { 0% { opacity: 0; transform: translateX(0); } 6%, 22% { opacity: 1; transform: translateX(0); } 48% { opacity: 1; transform: translateX(-255px); } 54%, 100% { opacity: 0; transform: translateX(-255px); } }
@keyframes merged { 0%, 48% { opacity: 0; transform: scale(0.94); } 56% { opacity: 1; transform: scale(1.03); } 61%, 90% { opacity: 1; transform: scale(1); } 97%, 100% { opacity: 0; transform: scale(1); } }`,
    body: `${sources}
<g class="anim merged">${merged}<text x="420" y="198" text-anchor="middle" font-size="13" class="mono">merged.pdf · 6 pages</text></g>
${caption('await mergePdfs([a, b, c])', 'one PDF, in the order you pass them')}`,
  }, t)
}

function splitHero(t) {
  // Groups sit at their final spots; the animation starts them stacked in the middle.
  const groups = [
    { cls: 'g1', x: 130, pages: [1, 2], label: '1-2', file: 'part1.pdf' },
    { cls: 'g2', x: 375, pages: [3], label: '3', file: 'part2.pdf' },
    { cls: 'g3', x: 620, pages: [4, 5, 6], label: '4-end', file: 'part3.pdf' },
  ]
  const drawGroup = g => {
    const n = g.pages.length
    // Back to front, so the group's first page is on top.
    const pages = g.pages.map((p, i) => ({ p, i })).reverse()
      .map(({ p, i }) => page(t, { x: g.x + i * 5, y: 60 - i * 5, number: p })).join('')
    const mid = g.x + 45 + (n - 1) * 2.5
    return `<g class="anim ${g.cls}">${pages}</g>
<g class="lbl"><rect x="${mid - 30}" y="20" width="60" height="22" rx="11" fill="${t.accentSoft}"/><text x="${mid}" y="35.5" text-anchor="middle" font-size="12.5" class="mono accent">${g.label}</text>
<text x="${mid}" y="200" text-anchor="middle" font-size="13" class="mono muted">${g.file}</text></g>`
  }
  return svg({
    width: 840, height: 260,
    title: '@utilitly/pdf-split',
    desc: 'A six-page PDF fans out into three files: pages 1-2, page 3, and pages 4 to the end.',
    css: `
.g1 { animation: g1 6s ease-in-out infinite; }
.g2 { animation: g2 6s ease-in-out infinite; }
.g3 { animation: g3 6s ease-in-out infinite; }
.lbl { animation: lbl 6s ease-in-out infinite; }
@keyframes g1 { 0%, 20% { transform: translate(245px, 0); } 46%, 90% { transform: translate(0, 0); } 100% { transform: translate(245px, 0); } }
@keyframes g2 { 0%, 20% { transform: translate(10px, -10px); } 46%, 90% { transform: translate(0, 0); } 100% { transform: translate(10px, -10px); } }
@keyframes g3 { 0%, 20% { transform: translate(-230px, -15px); } 46%, 90% { transform: translate(0, 0); } 100% { transform: translate(-230px, -15px); } }
@keyframes lbl { 0%, 46% { opacity: 0; } 54%, 86% { opacity: 1; } 90%, 100% { opacity: 0; } }`,
    body: `${[...groups].reverse().map(drawGroup).join('\n')}
${caption("await splitPdf(pdf, '1-2, 3, 4-end')", 'one file per part')}`,
  }, t)
}

function rotateHero(t) {
  const readouts = [
    { cls: 'r0', text: '/Rotate 0' },
    { cls: 'r90', text: '/Rotate 90' },
    { cls: 'r180', text: '/Rotate 180' },
    { cls: 'r270', text: '/Rotate 270' },
  ]
  return svg({
    width: 840, height: 260,
    title: '@utilitly/pdf-rotate',
    desc: "A page turns clockwise a quarter at a time while the page's /Rotate value reads 0, 90, 180 and 270.",
    css: `
.turn { transform: rotate(90deg); animation: turn 8s ease-in-out infinite; }
@keyframes turn { 0%, 14% { transform: rotate(0deg); } 22%, 36% { transform: rotate(90deg); } 44%, 58% { transform: rotate(180deg); } 66%, 80% { transform: rotate(270deg); } 88%, 100% { transform: rotate(360deg); } }
.r0, .r180, .r270 { opacity: 0; }
.r0 { animation: r0 8s steps(1, end) infinite; }
.r90 { animation: r90 8s steps(1, end) infinite; }
.r180 { animation: r180 8s steps(1, end) infinite; }
.r270 { animation: r270 8s steps(1, end) infinite; }
@keyframes r0 { 0% { opacity: 1; } 22% { opacity: 0; } 88% { opacity: 1; } }
@keyframes r90 { 0% { opacity: 0; } 22% { opacity: 1; } 44% { opacity: 0; } }
@keyframes r180 { 0% { opacity: 0; } 44% { opacity: 1; } 66% { opacity: 0; } }
@keyframes r270 { 0% { opacity: 0; } 66% { opacity: 1; } 88% { opacity: 0; } }`,
    body: `<circle cx="290" cy="118" r="104" fill="none" stroke="${t.stroke}" stroke-width="1.5" stroke-dasharray="3 6"/>
<path d="M 371 53 A 104 104 0 0 1 394 118" fill="none" stroke="${t.accent}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M 386 110 L 394 120 L 401 109" fill="none" stroke="${t.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
<g class="anim turn">${page(t, { x: 230, y: 40, w: 120, h: 156, lines: 8 })}</g>
<text x="470" y="88" font-size="13" class="muted">The page dictionary says</text>
${readouts.map(r => `<text x="470" y="128" font-size="30" class="mono accent ${r.cls}">${r.text}</text>`).join('\n')}
<text x="470" y="160" font-size="13" class="muted">Added to each page's own rotation and kept</text>
<text x="470" y="178" font-size="13" class="muted">within 0-270, so every reader agrees.</text>
${caption('await rotatePdf(pdf, 90)', 'any multiple of 90, any pages')}`,
  }, t)
}

/** Five slots, 120 apart, centred on the 840-wide canvas. */
const SLOTS = [135, 255, 375, 495, 615]

function deleteHero(t) {
  const doomed = new Set([2, 4])
  const shift = { 1: 120, 3: 0, 5: -120 }
  const pages = [1, 2, 3, 4, 5].map((n, i) => {
    const x = SLOTS[i]
    if (doomed.has(n)) {
      return `<g class="anim gone">${page(t, { x, y: 44, number: n })}
<g class="xmark"><circle cx="${x + 82}" cy="${52}" r="11" fill="${t.red}"/><path d="M ${x + 77} ${47} l 10 10 M ${x + 87} ${47} l -10 10" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/></g></g>`
    }
    return `<g class="anim keep k${n}">${page(t, { x, y: 44, number: n })}</g>`
  }).join('\n')
  return svg({
    width: 840, height: 260,
    title: '@utilitly/pdf-delete-pages',
    desc: 'Pages 2 and 4 of a five-page PDF are marked and lift away, and the remaining pages 1, 3 and 5 close the gap.',
    css: `
.gone { opacity: 0; animation: gone 6s ease-in-out infinite; }
@keyframes gone { 0% { opacity: 0; transform: translateY(0); } 6%, 26% { opacity: 1; transform: translateY(0); } 40%, 100% { opacity: 0; transform: translateY(-34px); } }
.xmark { animation: xmark 6s ease-out infinite; }
@keyframes xmark { 0%, 10% { opacity: 0; } 16%, 100% { opacity: 1; } }
${Object.entries(shift).map(([n, dx]) => `.k${n} { transform: translateX(${dx}px); animation: k${n} 6s ease-in-out infinite; }
@keyframes k${n} { 0%, 40% { transform: translateX(0); } 56%, 92% { transform: translateX(${dx}px); } 100% { transform: translateX(0); } }`).join('\n')}
.result { animation: result 6s ease-in-out infinite; }
@keyframes result { 0%, 56% { opacity: 0; } 62%, 88% { opacity: 1; } 94%, 100% { opacity: 0; } }`,
    body: `${pages}
<text x="420" y="196" text-anchor="middle" font-size="13" class="mono result">cleaned.pdf · 3 pages</text>
${caption("await deletePages(pdf, '2, 4')", 'the rest stay, in their order')}`,
  }, t)
}

function reorderHero(t) {
  const colors = [t.accent, t.green, t.amber, t.red, t.muted]
  // Page n starts in slot n-1. The new order is [3, 1, 2, 5, 4].
  const moves = {
    1: { dx: 120 }, 2: { dx: 120 }, 4: { dx: 120 },
    3: { dx: -240, lift: true }, 5: { dx: -120, lift: true },
  }
  const pageAt = n => `<g class="anim m${n}">${page(t, { x: SLOTS[n - 1], y: 50, number: n, bar: colors[n - 1] })}</g>`
  const keyframes = Object.entries(moves).map(([n, { dx, lift }]) => lift
    ? `.m${n} { transform: translate(${dx}px, 0); animation: m${n} 7s ease-in-out infinite; }
@keyframes m${n} { 0%, 18% { transform: translate(0, 0); } 30% { transform: translate(${dx / 2}px, -36px); } 42%, 86% { transform: translate(${dx}px, 0); } 98%, 100% { transform: translate(0, 0); } }`
    : `.m${n} { transform: translateX(${dx}px); animation: m${n} 7s ease-in-out infinite; }
@keyframes m${n} { 0%, 22% { transform: translateX(0); } 42%, 86% { transform: translateX(${dx}px); } 98%, 100% { transform: translateX(0); } }`).join('\n')
  return svg({
    width: 840, height: 260,
    title: '@utilitly/pdf-reorder-pages',
    desc: 'Five colour-coded pages move into a new order: page 3 jumps to the front, then 1, 2, 5 and 4.',
    css: `
${keyframes}
.order { animation: order 7s ease-in-out infinite; }
@keyframes order { 0%, 44% { opacity: 0; } 52%, 86% { opacity: 1; } 94%, 100% { opacity: 0; } }`,
    body: `${[1, 2, 4].map(pageAt).join('\n')}
${[5, 3].map(pageAt).join('\n')}
<text x="420" y="200" text-anchor="middle" font-size="13" class="mono order">[3, 1, 2, 5, 4]</text>
${caption('await reorderPages(pdf, [3, 1, 2, 5, 4])', 'every page, in the order you list')}`,
  }, t)
}

function duplicateHero(t) {
  // Three pages centred on slots 1-3; page 2 carries an image. Two copies of it
  // slide out, ending as 1, 2, 2, 2, 3 across all five slots.
  const pg = (x, n, extra = {}) => page(t, { x, y: 44, number: n, ...extra })
  return svg({
    width: 840, height: 260,
    title: '@utilitly/pdf-duplicate-pages',
    desc: 'Two copies of page 2 slide out from behind it, turning pages 1, 2, 3 into 1, 2, 2, 2, 3. The copies share the same image.',
    css: `
.left { transform: translateX(-120px); animation: left 6s ease-in-out infinite; }
@keyframes left { 0%, 20% { transform: translateX(0); } 40%, 88% { transform: translateX(-120px); } 98%, 100% { transform: translateX(0); } }
.right { transform: translateX(120px); animation: right 6s ease-in-out infinite; }
@keyframes right { 0%, 20% { transform: translateX(0); } 40%, 88% { transform: translateX(120px); } 98%, 100% { transform: translateX(0); } }
.copyA { animation: copyA 6s ease-in-out infinite; }
@keyframes copyA { 0%, 20% { opacity: 0; } 30%, 88% { opacity: 1; } 96%, 100% { opacity: 0; } }
.copyB { animation: copyB 6s ease-in-out infinite; }
@keyframes copyB { 0%, 20% { opacity: 0; transform: translateX(-120px); } 28% { opacity: 1; transform: translateX(-120px); } 44%, 88% { opacity: 1; transform: translateX(0); } 96% { opacity: 0; transform: translateX(0); } 100% { opacity: 0; transform: translateX(-120px); } }
.tag { animation: tag 6s ease-in-out infinite; }
@keyframes tag { 0%, 44% { opacity: 0; } 52%, 86% { opacity: 1; } 92%, 100% { opacity: 0; } }`,
    body: `<g class="anim copyB">${pg(495, 2, { picture: true })}</g>
<g class="anim copyA">${pg(375, 2, { picture: true })}</g>
<g class="anim left">${pg(255, 1)}</g>
<g class="anim left">${pg(375, 2, { picture: true })}</g>
<g class="anim right">${pg(495, 3)}</g>
<g class="tag">${[375, 495].map(x => `<rect x="${x + 21}" y="14" width="48" height="20" rx="10" fill="${t.accentSoft}"/><text x="${x + 45}" y="28" text-anchor="middle" font-size="11.5" class="mono accent">copy</text>`).join('')}
<text x="420" y="196" text-anchor="middle" font-size="13" class="mono">1 · 2 · 2 · 2 · 3, one copy of the image</text></g>
${caption("await duplicatePages(pdf, '2', { copies: 2 })", "copies share the page's images and fonts")}`,
  }, t)
}

// ── The Network panel every README carries ──────────────────────────────────

const NETWORK_TASKS = {
  root: { file: 'report.pdf', doing: 'processing report.pdf' },
  'pdf-merge': { file: 'a.pdf  b.pdf  c.pdf', doing: 'merging 3 files' },
  'pdf-split': { file: 'report.pdf', doing: 'splitting into 3 files' },
  'pdf-rotate': { file: 'scan.pdf', doing: 'rotating 12 pages' },
  'pdf-delete-pages': { file: 'scan.pdf', doing: 'deleting 2 of 12 pages' },
  'pdf-reorder-pages': { file: 'slides.pdf', doing: 'reordering 24 pages' },
  'pdf-duplicate-pages': { file: 'form.pdf', doing: 'duplicating page 2' },
}

function networkPanel(t, name) {
  const task = NETWORK_TASKS[name]
  const D = { x: 304, y: 24, w: 512, h: 184 }
  const col = { name: D.x + 14, status: D.x + 250, type: D.x + 320, size: D.x + 400 }
  const tabs = [['Elements', 0], ['Console', 74], ['Sources', 142], ['Network', 210]]
  const body = `<text x="${D.x + D.w / 2}" y="${D.y + 120}" text-anchor="middle" font-size="12.5" class="faint">Recording network activity…</text>
<text x="${D.x + D.w / 2}" y="${D.y + 140}" text-anchor="middle" font-size="12" class="faint">nothing to show: the PDF never leaves the tab</text>`
  const footer = `<text x="${D.x + 14}" y="${D.y + D.h - 9}" font-size="11.5" class="mono muted"><tspan class="accent" font-weight="700">0 requests</tspan>  |  0 B transferred  |  0 B resources</text>`
  return svg({
    width: 840, height: 232,
    title: `${name === 'root' ? '@utilitly packages' : `@utilitly/${name}`}: the Network panel stays empty`,
    desc: `While the app is ${task.doing}, the browser's Network panel stays empty: 0 requests, 0 bytes transferred.`,
    css: `
.fill { transform-box: fill-box; transform-origin: left center; animation: fill 5s ease-in-out infinite; }
.done { animation: done 5s ease-in-out infinite; }
.rec { animation: rec 1.2s ease-in-out infinite; }
@keyframes fill { 0%, 8% { transform: scaleX(0); } 78%, 96% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
@keyframes done { 0%, 78% { opacity: 0; } 84%, 96% { opacity: 1; } 100% { opacity: 0; } }
@keyframes rec { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }`,
    body: `<rect x="24" y="24" width="264" height="184" rx="10" fill="${t.panel}" stroke="${t.stroke}"/>
<text x="42" y="50" font-size="12" class="muted">your app</text>
<rect x="42" y="64" width="228" height="34" rx="7" fill="${t.card}" stroke="${t.stroke}"/>
<rect x="52" y="73" width="26" height="16" rx="3" fill="${t.red}"/><text x="65" y="85" text-anchor="middle" font-size="9" font-weight="700" style="fill:#ffffff">PDF</text>
<text x="86" y="85" font-size="12" class="mono">${esc(task.file)}</text>
<text x="42" y="126" font-size="14">${esc(task.doing)}</text>
<rect x="42" y="140" width="228" height="8" rx="4" fill="${t.pageLine}"/>
<rect x="42" y="140" width="228" height="8" rx="4" fill="${t.accent}" class="fill"/>
<text x="42" y="180" font-size="13" font-weight="600" class="done" style="fill:${t.green}">✓ done, in this tab</text>
<rect x="${D.x}" y="${D.y}" width="${D.w}" height="${D.h}" rx="10" fill="${t.panel}" stroke="${t.stroke}"/>
${tabs.map(([label, dx]) => `<text x="${D.x + 14 + dx}" y="${D.y + 20}" font-size="12" class="${label === 'Network' ? '' : 'muted'}"${label === 'Network' ? ' font-weight="600"' : ''}>${label}</text>`).join('')}
<rect x="${D.x + 224}" y="${D.y + 27}" width="52" height="2" fill="${t.accent}"/>
<line x1="${D.x}" y1="${D.y + 29.5}" x2="${D.x + D.w}" y2="${D.y + 29.5}" stroke="${t.stroke}"/>
<circle cx="${D.x + 20}" cy="${D.y + 43}" r="5" fill="${t.red}" class="rec"/>
<circle cx="${D.x + 40}" cy="${D.y + 43}" r="5" fill="none" stroke="${t.faint}" stroke-width="1.5"/><line x1="${D.x + 36.5}" y1="${D.y + 46.5}" x2="${D.x + 43.5}" y2="${D.y + 39.5}" stroke="${t.faint}" stroke-width="1.5"/>
<rect x="${D.x + 58}" y="${D.y + 37}" width="11" height="11" rx="2" fill="none" stroke="${t.faint}"/><text x="${D.x + 74}" y="${D.y + 47}" font-size="11.5" class="muted">Preserve log</text>
<rect x="${D.x + 170}" y="${D.y + 35}" width="150" height="16" rx="4" fill="${t.card}" stroke="${t.stroke}"/><text x="${D.x + 178}" y="${D.y + 47}" font-size="11" class="faint">Filter</text>
<line x1="${D.x}" y1="${D.y + 57.5}" x2="${D.x + D.w}" y2="${D.y + 57.5}" stroke="${t.stroke}"/>
<text x="${col.name}" y="${D.y + 73}" font-size="11.5" font-weight="600" class="muted">Name</text>
<text x="${col.status}" y="${D.y + 73}" font-size="11.5" font-weight="600" class="muted">Status</text>
<text x="${col.type}" y="${D.y + 73}" font-size="11.5" font-weight="600" class="muted">Type</text>
<text x="${col.size}" y="${D.y + 73}" font-size="11.5" font-weight="600" class="muted">Size</text>
<line x1="${D.x}" y1="${D.y + 79.5}" x2="${D.x + D.w}" y2="${D.y + 79.5}" stroke="${t.stroke}"/>
${body}
<line x1="${D.x}" y1="${D.y + D.h - 26.5}" x2="${D.x + D.w}" y2="${D.y + D.h - 26.5}" stroke="${t.stroke}"/>
${footer}`,
  }, t)
}

// ── Output ──────────────────────────────────────────────────────────────────

const HEROES = {
  'pdf-merge': mergeHero,
  'pdf-split': splitHero,
  'pdf-rotate': rotateHero,
  'pdf-delete-pages': deleteHero,
  'pdf-reorder-pages': reorderHero,
  'pdf-duplicate-pages': duplicateHero,
}

/** Every generated file, as { 'repo/relative/path.svg': contents }. */
export function renderAll() {
  const files = {}
  for (const [theme, t] of Object.entries(THEMES)) {
    files[`assets/network-${theme}.svg`] = networkPanel(t, 'root')
    for (const [name, hero] of Object.entries(HEROES)) {
      files[`packages/${name}/assets/hero-${theme}.svg`] = hero(t)
      files[`packages/${name}/assets/network-${theme}.svg`] = networkPanel(t, name)
    }
  }
  return files
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = renderAll()
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(ROOT, path)), { recursive: true })
    writeFileSync(join(ROOT, path), contents)
  }
  console.log(`Wrote ${Object.keys(files).length} SVGs.`)
}
