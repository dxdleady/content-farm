#!/usr/bin/env node
// One reference -> one image. Picks N random refs and, for each, reproduces its
// treatment while deliberately moving three axes: subject, framing, dominant colour.
// Writes a side-by-side sheet so the ref and its offspring can be judged as a pair.
//
//   node tools/ref-sweep.ts [count] [--seed=<n>]

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { background, status } from '../src/bgen.ts';
import { Chrome } from '../src/chrome.ts';
import { productFromArgv } from '../src/product.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = productFromArgv();
const REFS = join(ROOT, 'refs/style');
const OUT = join(ROOT, 'out/ref-sweep');
const T = JSON.parse(readFileSync(P.tokensJson, 'utf8'));
const S = JSON.parse(readFileSync(join(ROOT, 'src/styles.json'), 'utf8'));

const count = Number(process.argv[2]) || 5;
const seedArg = (process.argv.find(a => a.startsWith('--seed=')) ?? '').split('=')[1] ?? '0';

// Subjects stay inside the product's world so the sweep is usable, not just pretty.
const SUBJECTS = [
  'a host mid-sentence, mouth open, too close to a big microphone',
  'someone yanking headphones off one ear',
  'a person alone in a padded booth, tiny in the space',
  'two people talking over each other across a table',
  'a fist coming down on a bare metal desk',
  'a listener pulling one earbud out mid-step',
  'a face reacting to hearing their own voice played back',
  'a mouth mid-laugh, everything else out of frame',
  'a figure hunched over a mixing desk at 3am',
  'someone holding a mic like a weapon',
];

const ACCENTS = Object.entries(T.color.accent) as Array<[string, string]>;

const rng = (s: string | number) => {
  const h = createHash('sha256').update(String(s)).digest();
  let i = 0;
  return () => h[(i = (i + 5) % h.length)]! / 255;
};

function pick<T>(list: T[], r: () => number): T { return list[Math.floor(r() * list.length) % list.length]!; }

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const files = readdirSync(REFS).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
if (!files.length) { console.error('refs/style is empty'); process.exit(1); }

console.log(status());
const r = rng(`sweep|${seedArg}`);
const chosen = shuffle(files, r).slice(0, count);

mkdirSync(OUT, { recursive: true });
const rows = [];

for (const [i, refName] of chosen.entries()) {
  const rr = rng(`${refName}|${seedArg}`);
  const subject = pick(SUBJECTS, rr);
  // styles.json keeps a `$note` string alongside the wildcard pools, so the declared type
  // is `string[] | string`. Only the array pools are ever named here.
  const pool = (k: string) => S.wildcards[k] as string[];
  const framing = [pick(pool('angle'), rr), pick(pool('crop'), rr), pick(pool('lens'), rr)].join('; ');
  const [colorName, color] = pick(ACCENTS, rr);

  process.stdout.write(`  ${i + 1}/${chosen.length}  ${refName.slice(0, 10)} -> ${colorName.padEnd(11)} ${subject.slice(0, 44)}…\n`);
  // background() short-circuits on a falsy subject unless `solo` is supplied, which it is.
  const png = await background(null as unknown as string, {
    refPaths: [join(REFS, refName)],
    solo: { subject, framing, color, colorName },
    model: process.env.EDIT_MODEL || 'qwen-edit',
  });
  rows.push({ refName, png, subject, framing, colorName, color });
}

// side-by-side sheet: reference left, its offspring right
const html = `<!doctype html><html><body style="margin:0;background:#141414;font:12px/1.4 -apple-system;color:#aaa">
${rows.map((x, i) => `<div style="display:grid;grid-template-columns:340px 340px 1fr;gap:14px;padding:14px;border-bottom:1px solid #262626;align-items:start">
  <div><img src="file://${join(REFS, x.refName)}" style="width:340px;display:block"><div style="padding-top:6px">ref ${i + 1}</div></div>
  <div>${x.png ? `<img src="file://${x.png}" style="width:340px;display:block">` : '<div style="width:340px;height:425px;background:#222"></div>'}<div style="padding-top:6px;color:${x.color}">${x.colorName}</div></div>
  <div style="padding-top:2px"><b style="color:#ddd">${x.subject}</b><br><span style="color:#777">${x.framing.replace(/; /g, '<br>')}</span></div>
</div>`).join('')}
</body></html>`;
const htmlPath = join(OUT, 'sheet.html');
writeFileSync(htmlPath, html);

const chrome = await Chrome.launch();
try {
  const h = rows.length * 452 + 20;
  const page = await chrome.newPage(1100, h);
  writeFileSync(join(OUT, 'sheet.png'), await chrome.shoot(page, `file://${htmlPath}`, 1100, h));
} finally { chrome.kill(); }

console.log(`\n${rows.filter(x => x.png).length}/${rows.length} pairs -> ${join(OUT, 'sheet.png')}`);
