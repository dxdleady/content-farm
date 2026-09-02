// Capture the real product site for CTA slides.
//
//   node tools/site-shot.ts <product> <url> <name> [width] [height]
//
// The CTA slide puts a screenshot in a phone frame, so what goes in it has to be
// the actual product. SOMA's came out of its own repo; (cast) is a web app, so
// the honest source is the live page. Shot at phone width by default — a desktop
// capture scaled into a phone frame is unreadable at 1080×1920.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from '../src/chrome.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [productId, url, name, w = '390', h = '844'] = process.argv.slice(2);

if (!productId || !url || !name) {
  console.log('usage: node tools/site-shot.ts <product> <url> <name> [width] [height]');
  process.exit(1);
}

const dir = join(ROOT, 'products', productId, 'ugc', 'assets', 'screens');
mkdirSync(dir, { recursive: true });

const chrome = await Chrome.launch();
try {
  const page = await chrome.newPage(Number(w), Number(h));
  // shoot() takes a URL; a remote one is the same to CDP as a file one.
  const buf = await chrome.shoot(page, url, Number(w), Number(h));
  const out = join(dir, `${name}.png`);
  writeFileSync(out, buf);
  console.log(`→ ${out}`);
} finally {
  await chrome.close();
}
