#!/usr/bin/env node
// One row per rubric, each in a DIFFERENT design (density × theme) and a different
// ref — a 10-row matrix showing the composition system at a glance.
//   node tools/matrix.ts [--format ig|tiktok] [--product cast]
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from '../src/chrome.ts';
import { formatFromArgv, formatTag } from '../src/formats.ts';
import { productFromArgv } from '../src/product.ts';
import { rubricsFor } from '../src/plan.ts';
import { composeDeckName, composeRunDir, hookOf } from '../src/run.ts';
import { FONTS as fonts } from '../src/assets.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FMT = formatFromArgv();
const P = productFromArgv();
const RUBRICS = rubricsFor(P);
const W = FMT.w, H = FMT.h;

// 10 rubrics, all different combinations (density · theme · ref)
const M: Combo[] = [
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

type Combo = { r: string; d: string; t: string; ref: number | null };
type Run = { c: Combo; deckName: string; slides: string[] };
const runs: Run[] = [];
for (const c of M) {
  // The name and the directory come from src/run.ts, the same call compose.ts makes.
  // This tool shells out and then reads back what compose wrote, so the two agreeing is
  // a hard requirement — and they used to agree only by having the formula twice.
  const runKey = { product: P, rubric: c.r, density: c.d, theme: c.t, ref: c.ref, format: FMT,
    hook: hookOf(RUBRICS[c.r]?.slides ?? []) };
  const deckName = composeDeckName(runKey);
  const dir = composeRunDir(runKey);
  const args = ['--rubric', c.r, '--density', c.d, '--theme', c.t, '--no-fx',
    '--format', FMT.id, '--product', P.id,
    ...(c.ref ? ['--ref', String(c.ref)] : [])];
  process.stdout.write(`▶ ${deckName}\n`);
  try { execSync(`node tools/compose.ts ${args.map(a => `'${a}'`).join(' ')}`, { cwd: ROOT, stdio: 'pipe' }); }
  catch (e) { console.log(`  ! compose failed: ${String((e as { stderr?: string }).stderr || (e as Error).message).slice(0, 140)}`); }
  let slides: string[] = [];
  try { slides = readdirSync(dir).filter(f => /^\d\d-.*\.png$/.test(f)).sort().map(f => join(dir, f)); } catch {}
  runs.push({ c, deckName, slides });
  console.log(`  ${slides.length} slides`);
}

// ---- assemble the matrix ----
const TH = 152, thH = Math.round(TH * H / W), GAP = 8, LAB = 250, PAD = 26, ROWGAP = 16;
const maxN = Math.max(1, ...runs.map(r => r.slides.length));
const pageW = PAD * 2 + LAB + maxN * (TH + GAP);
const pageH = PAD * 2 + 64 + runs.length * thH + (runs.length - 1) * ROWGAP;
const enc = (p: string) => 'file://' + encodeURI(p).replace(/#/g, '%23');
const cap = (s: string) => s.replace(/(^|-)([a-z])/g, (_, a, b) => (a ? ' ' : '') + b.toUpperCase());

const row = ({ c, slides }: Run) => `<div style="display:flex;gap:${GAP}px;margin-bottom:${ROWGAP}px;align-items:flex-start">
  <div style="width:${LAB}px;flex:0 0 ${LAB}px;padding-right:14px">
    <div style="font:700 21px Inter;color:#f3f3f3;letter-spacing:-.3px">${cap(c.r)}</div>
    <div style="font:600 13px Inter;color:#7f7f8a;letter-spacing:1px;text-transform:uppercase;margin-top:6px">${c.d} · ${c.t}${c.ref ? ` · ref ${c.ref}` : ''}</div>
  </div>
  ${slides.map((s: string) => `<img src="${enc(s)}" style="width:${TH}px;height:${thH}px;display:block;border-radius:5px;background:#000">`).join('')}
</div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style></head>
<body style="margin:0;background:#0c0c0c;padding:${PAD}px;width:${pageW}px;font-family:Inter">
  <div style="font:700 32px Inter;color:#fff;letter-spacing:-1px;margin-bottom:6px">(cast) — rubric × design × ref matrix</div>
  <div style="font:400 17px Inter;color:#8a8a8a;margin-bottom:26px">every row a different rubric, density, theme and reference · ${FMT.name} ${W}×${H} · film-grain house treatment</div>
  ${runs.map(row).join('')}
</body></html>`;

const OUT = join(ROOT, `out/runs/matrix${formatTag(FMT)}`); mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'matrix.html'), html);
const chrome = await Chrome.launch();
try {
  const p = await chrome.newPage(pageW, pageH);
  writeFileSync(join(OUT, 'matrix.png'), await chrome.shoot(p, `file://${join(OUT, 'matrix.html')}`, pageW, pageH));
} finally { chrome.kill(); }
console.log(`\nmatrix -> ${OUT}/matrix.png  (${pageW}x${pageH})`);
