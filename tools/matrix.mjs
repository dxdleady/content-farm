#!/usr/bin/env node
// One row per rubric, each in a DIFFERENT design (density × theme) and a different
// ref — a 10-row matrix showing the composition system at a glance.
//   node tools/matrix.mjs
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from '../src/chrome.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1080, H = 1350;

// 10 rubrics, all different combinations (density · theme · ref)
const M = [
  { r: 'hot-takes',              d: 'half',    t: 'color', ref: 1  },
  { r: 'inspiration',            d: 'full',    t: 'light', ref: 4  },
  { r: 'feature-drop',           d: 'light',   t: 'dark',  ref: 12 },
  { r: 'one-workflow',           d: 'minimal', t: 'dark',  ref: null },
  { r: 'plan-picker',            d: 'light',   t: 'color', ref: 2  },
  { r: 'how-to',                 d: 'half',    t: 'dark',  ref: 19 },
  { r: 'mistakes',               d: 'full',    t: 'color', ref: 5  },
  { r: 'myth-vs-fact',           d: 'light',   t: 'light', ref: 6  },
  { r: 'before-after',           d: 'minimal', t: 'color', ref: null },
  { r: 'unnecessary-censorship', d: 'full',    t: 'dark',  ref: 27 },
];

const runs = [];
for (const c of M) {
  const deckName = `${c.r}-${c.d}-${c.t}${c.ref ? `-r${c.ref}` : ''}`;
  const dir = join(ROOT, `out/runs/compose-${deckName}`);
  const args = ['--rubric', c.r, '--density', c.d, '--theme', c.t, '--no-fx', ...(c.ref ? ['--ref', String(c.ref)] : [])];
  process.stdout.write(`▶ ${deckName}\n`);
  try { execSync(`node tools/compose.mjs ${args.map(a => `'${a}'`).join(' ')}`, { cwd: ROOT, stdio: 'pipe' }); }
  catch (e) { console.log(`  ! compose failed: ${String(e.stderr || e.message).slice(0, 140)}`); }
  let slides = [];
  try { slides = readdirSync(dir).filter(f => /^\d\d-.*\.png$/.test(f)).sort().map(f => join(dir, f)); } catch {}
  runs.push({ c, deckName, slides });
  console.log(`  ${slides.length} slides`);
}

// ---- assemble the matrix ----
const TH = 152, thH = Math.round(TH * H / W), GAP = 8, LAB = 250, PAD = 26, ROWGAP = 16;
const maxN = Math.max(1, ...runs.map(r => r.slides.length));
const pageW = PAD * 2 + LAB + maxN * (TH + GAP);
const pageH = PAD * 2 + 64 + runs.length * thH + (runs.length - 1) * ROWGAP;
const enc = p => 'file://' + encodeURI(p).replace(/#/g, '%23');
const cap = s => s.replace(/(^|-)([a-z])/g, (_, a, b) => (a ? ' ' : '') + b.toUpperCase());
const fonts = readFileSync(join(ROOT, 'assets/fonts/fonts.css'), 'utf8').replace(/url\((woff2\/[^)]+)\)/g, (_, r) => `url(data:font/woff2;base64,${readFileSync(join(ROOT, 'assets/fonts', r)).toString('base64')})`);

const row = ({ c, slides }) => `<div style="display:flex;gap:${GAP}px;margin-bottom:${ROWGAP}px;align-items:flex-start">
  <div style="width:${LAB}px;flex:0 0 ${LAB}px;padding-right:14px">
    <div style="font:700 21px Inter;color:#f3f3f3;letter-spacing:-.3px">${cap(c.r)}</div>
    <div style="font:600 13px Inter;color:#7f7f8a;letter-spacing:1px;text-transform:uppercase;margin-top:6px">${c.d} · ${c.t}${c.ref ? ` · ref ${c.ref}` : ''}</div>
  </div>
  ${slides.map(s => `<img src="${enc(s)}" style="width:${TH}px;height:${thH}px;display:block;border-radius:5px;background:#000">`).join('')}
</div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style></head>
<body style="margin:0;background:#0c0c0c;padding:${PAD}px;width:${pageW}px;font-family:Inter">
  <div style="font:700 32px Inter;color:#fff;letter-spacing:-1px;margin-bottom:6px">(cast) — rubric × design × ref matrix</div>
  <div style="font:400 17px Inter;color:#8a8a8a;margin-bottom:26px">every row a different rubric, density, theme and reference · film-grain house treatment</div>
  ${runs.map(row).join('')}
</body></html>`;

const OUT = join(ROOT, 'out/runs/matrix'); mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'matrix.html'), html);
const chrome = await Chrome.launch();
try {
  const p = await chrome.newPage(pageW, pageH);
  writeFileSync(join(OUT, 'matrix.png'), await chrome.shoot(p, `file://${join(OUT, 'matrix.html')}`, pageW, pageH));
} finally { chrome.kill(); }
console.log(`\nmatrix -> ${OUT}/matrix.png  (${pageW}x${pageH})`);
