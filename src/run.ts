// One run = one immutable directory with its own id. Nothing is ever overwritten,
// so any image can be traced back to the exact inputs that produced it.
import { mkdirSync, writeFileSync, rmSync, symlinkSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { formatTag } from './formats.ts';
import { productTag } from './product.ts';
import type { Format, Product } from './types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RUNS = join(ROOT, 'out/runs');

/** Free-form metadata a caller attaches to a run; written verbatim into meta.json. */
export type RunMeta = Record<string, unknown>;

export type RunHandle = {
  id: string;
  dir: string;
  meta: RunMeta;
  /**
   * Running spend, in dollars. Callers mutate this.
   *
   * Note it is a plain number on a spread copy, so mutating it does NOT reach the
   * internal state that close() serialises — pass the total to close(extra) instead.
   * Transcribed as-is; changing it would change what lands in meta.json.
   */
  cost: number;
  images: string;
  slides: string;
  close(extra?: RunMeta): string;
};

/** 20260818-1432-7a3f — sortable, readable, collision-proof enough. */
export function newRunId(label = ''): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  const tag = randomBytes(2).toString('hex');
  return [stamp, label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''), tag].filter(Boolean).join('-');
}

export function openRun(label: string, meta: RunMeta = {}): RunHandle {
  const id = newRunId(label);
  const dir = join(RUNS, id);
  mkdirSync(join(dir, 'images'), { recursive: true });
  mkdirSync(join(dir, 'slides'), { recursive: true });
  const state = { id, dir, meta: { id, label, startedAt: new Date().toISOString(), ...meta }, cost: 0 };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(state.meta, null, 2));
  return {
    ...state,
    images: join(dir, 'images'),
    slides: join(dir, 'slides'),
    /** Record everything needed to reproduce this run, then point `latest` here. */
    close(extra: RunMeta = {}) {
      const meta = { ...state.meta, finishedAt: new Date().toISOString(), ...extra };
      writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
      const latest = join(RUNS, 'latest');
      try { rmSync(latest, { recursive: true, force: true }); } catch {}
      try { symlinkSync(id, latest, 'dir'); } catch {}
      return dir;
    },
  };
}

export function listRuns(): string[] {
  if (!existsSync(RUNS)) return [];
  return readdirSync(RUNS).filter(f => f !== 'latest').sort().reverse();
}

/* ─────────────────────────────────────────────────────────── compose run names */

/**
 * The name of a compose run, derived in ONE place.
 *
 * tools/compose.ts creates these directories and tools/matrix.ts goes looking for them
 * after shelling out — so the two had to agree on the name, and they agreed by having
 * two copies of the formula. They had already diverged in a way that happened not to
 * matter yet: compose pulls the digits out of --ref (so `--ref ref-12` yields `-r12`)
 * while matrix interpolates its number raw. matrix only ever passes numbers, which is
 * why nothing broke. A third caller, or a non-numeric ref in the matrix table, would
 * have produced a directory matrix could not find and a silent row of zero slides.
 *
 * Tag order is significance order: product, then the content axes, then format. The
 * product comes first so every run of one brand sorts together, and productTag is '' for
 * the default product — so every existing out/runs path stays byte-identical.
 */
export function composeDeckName(o: {
  product: Product; rubric: string; density: string; theme: string;
  ref?: string | number | null; format: Format; hook?: string | null;
}): string {
  const ref = o.ref == null || o.ref === '' ? '' : `-r${String(o.ref).match(/\d+/)?.[0] ?? o.ref}`;
  const hook = slugHook(o.hook);
  return `${o.rubric}${hook ? `--${hook}` : ''}-${o.density}-${o.theme}${ref}${formatTag(o.format)}`;
}

/**
 * The opening line, folded into a filesystem-safe slug.
 *
 * A rubric id says which SHAPE a post has — `edit-time`, `hot-takes` — and out/runs was
 * named only for that, so two posts built from the same rubric were two folders you had
 * to open to tell apart. The hook is what the post actually says, and it is the thing a
 * human is looking for when they scan the directory.
 *
 * Emphasis asterisks come out (`*already* made` is not a filename), and the slug is cut
 * at a word boundary rather than mid-word — a truncated folder name is going to be read
 * by someone, so it should end on a word.
 */
export function hookOf(slides: ReadonlyArray<object>): string | undefined {
  // `title` is optional on the slide union — `stat` carries value/unit instead — so a
  // rubric that opened on one would simply have no hook rather than fail to compile.
  // Today none do: every rubric opens on statement or bigQuestion, which the envelope
  // test in test/unit/plan.test.ts enforces.
  return (slides[0] as { title?: string } | undefined)?.title;
}

export function slugHook(title?: string | null, max = 48): string {
  if (!title) return '';
  const slug = String(title)
    .replace(/\*/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > max * 0.5 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '');
}

/** The directory a compose run writes into. Not created — callers mkdir it. */
export function composeRunDir(o: Parameters<typeof composeDeckName>[0]): string {
  return join(RUNS, `compose${productTag(o.product)}-${composeDeckName(o)}`);
}
