// Contact sheets — a whole post on one picture, for review.
//
//   node tools/ugc-sheets.ts <deck…>            e.g. soma-5secrets soma-10ways
//   node tools/ugc-sheets.ts --all
//
// Eleven slides is eleven files to open; one sheet is one glance. Sheets land in
// out/ugc/_sheets/. This is a review tool — every defect this format has shipped was
// caught by looking, not by reading the JSON.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from '../src/chrome.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UGC = join(ROOT, 'out/ugc');
const OUT = join(UGC, '_sheets');
const CELL = 360, COLS = 3;

const args = process.argv.slice(2);
const decks = args[0] === '--all'
  ? readdirSync(UGC).filter(d => !d.startsWith('_') && existsSync(join(UGC, d, '01-photo.png')))
  : args;

if (!decks.length) {
  console.error('usage: node tools/ugc-sheets.ts <deck…> | --all');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const chrome = await Chrome.launch();
try {
  for (const d of decks) {
    const dir = join(UGC, d);
    if (!existsSync(dir)) { console.warn(`  ! no such render: ${d}`); continue; }
    const files = readdirSync(dir).filter(f => f.endsWith('.png')).sort();
    const rows = Math.ceil(files.length / COLS);
    const W = COLS * CELL, H = rows * (Math.round(CELL * 16 / 9) + 22);
    const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#111;font:12px monospace;color:#ddd}
.g{display:grid;grid-template-columns:repeat(${COLS},${CELL}px)}
.c img{width:${CELL}px;height:${Math.round(CELL * 16 / 9)}px;object-fit:contain;display:block;background:#000}
.c span{display:block;text-align:center;padding:3px 0}
</style><div class="g">${files.map(f =>
      `<div class="c"><img src="file://${resolve(dir, f)}"><span>${f}</span></div>`).join('')}</div>`;
    const htmlPath = join(OUT, `${d}.html`);
    writeFileSync(htmlPath, html);
    writeFileSync(join(OUT, `${d}.png`), await chrome.shootPooled(`file://${htmlPath}`, W, H));
    console.log(`  ✓ ${d} — ${files.length} slides`);
  }
} finally {
  chrome.kill();
}
console.log(`\nsheets -> ${OUT}`);
