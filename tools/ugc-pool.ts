// Pools — one person's answers to the avatar SLOTS the decks ask for.
//
//   node tools/ugc-pool.ts --slots [deck…]     what the decks need, and what uses each
//   node tools/ugc-pool.ts --new <id>          start a pool: folder + a pool.json stub
//   node tools/ugc-pool.ts --check <id>        which slots that pool still cannot answer
//
// A deck names its photos as `../avatar/<file>.jpg`. Those names are SLOTS, not just
// paths: "gym-dumbbells" means "her, mid-workout, clean frame". A pool maps every slot
// to a file of its own, so a second person renders the same 20 posts as herself without
// editing a single deck — `node tools/ugc.ts <deck> --pool <id>`.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UGC = join(ROOT, 'products/soma/ugc');
const POOLS = join(UGC, 'pools');
const SLOT_RE = /(^|\/)avatar\/([^/]+)$/;

type Slide = { kind: string; photo?: string; text?: string; heading?: string };
type Deck = { deck: string; slides: Slide[] };

const decks = (): Deck[] => readdirSync(UGC)
  .filter(f => f.startsWith('deck-') && f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(UGC, f), 'utf8')) as Deck)
  .sort((a, b) => a.deck.localeCompare(b.deck));

/** slot -> every place it is used, so the person filling a pool knows what the frame is for. */
function slots(only: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const d of decks()) {
    if (only.length && !only.includes(d.deck)) continue;
    for (const [i, s] of d.slides.entries()) {
      const slot = s.photo?.match(SLOT_RE)?.[2];
      if (!slot) continue;
      const line = (s.text ?? s.heading ?? '').split('\n')[0];
      out.set(slot, [...(out.get(slot) ?? []), `${d.deck} #${i + 1}${line ? ` — ${line}` : ''}`]);
    }
  }
  return new Map([...out].sort((a, b) => b[1].length - a[1].length));
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === '--slots') {
  const s = slots(process.argv.slice(3));
  console.log(`${s.size} slots across ${decks().length} decks — most-used first\n`);
  for (const [slot, uses] of s) {
    console.log(`${slot}  (${uses.length}×)`);
    for (const u of uses) console.log(`    ${u}`);
  }
  console.log(`\nA pool must answer every slot a deck it renders uses.`);

} else if (cmd === '--new') {
  if (!arg) { console.error('usage: --new <id>'); process.exit(1); }
  const dir = join(POOLS, arg);
  const file = join(dir, 'pool.json');
  if (existsSync(file)) { console.error(`pool "${arg}" already exists: ${file}`); process.exit(1); }
  mkdirSync(dir, { recursive: true });
  // Every slot, mapped to "" — the stub IS the shopping list.
  const stub = Object.fromEntries([...slots([]).keys()].map(k => [k, '']));
  writeFileSync(file, `${JSON.stringify(stub, null, 2)}\n`);
  console.log(`pool "${arg}" created: ${file}`);
  console.log(`  1. drop your photos into ${dir}`);
  console.log(`  2. fill each slot with the file name that answers it (a file may answer several)`);
  console.log(`  3. node tools/ugc-pool.ts --check ${arg}`);

} else if (cmd === '--check') {
  if (!arg) { console.error('usage: --check <id>'); process.exit(1); }
  const dir = join(POOLS, arg);
  const map = JSON.parse(readFileSync(join(dir, 'pool.json'), 'utf8')) as Record<string, string>;
  const all = slots([]);
  const open: string[] = [];
  for (const [slot, uses] of all) {
    const f = map[slot];
    if (!f) open.push(`${slot}  (${uses.length}×) — unmapped`);
    else if (!existsSync(join(dir, f))) open.push(`${slot} -> ${f} — file not in pool`);
  }
  const ready = decks().filter(d => d.slides.every(s => {
    const slot = s.photo?.match(SLOT_RE)?.[2];
    return !slot || (map[slot] && existsSync(join(dir, map[slot])));
  }));
  console.log(`pool "${arg}": ${all.size - open.length}/${all.size} slots filled`);
  console.log(`renderable now: ${ready.length ? ready.map(d => d.deck).join(', ') : 'none'}`);
  if (open.length) {
    console.log(`\nstill open:`);
    for (const o of open) console.log(`  ${o}`);
  }

} else {
  console.error('usage: node tools/ugc-pool.ts --slots [deck…] | --new <id> | --check <id>');
  process.exit(1);
}
