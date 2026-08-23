// A post: one concrete thing that gets published.
//
// This replaces the arrangement where "rubric" meant two incompatible things at once. A
// rubric was named like a template and contained 23 352 characters of finished copy across
// 102 slides — so `myth-vs-fact` was not a shape you could pick for a new topic, it was
// one specific post about microphones, with the topic already baked in. Choosing it for
// something else was impossible, which made the word "template" a lie.
//
// The split:
//
//   post    (here)          the topic, the words, the axes it renders with, and the
//                           human's verdict on each slide. One file per published thing.
//   rubric  (src/plan.ts)   the SHAPE — a beat sequence and what each slot is for. No
//                           words. Picked for a post by relevance.
//
// Posts are JSON, not TypeScript, for the same reason drafts were: tools/studio.ts writes
// them, and a web form must not be editing a source file full of authored comments.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Problem } from './validate.ts';
import type { FormatId, Product, Rubric, RubricSlide } from './types.ts';

/** The human's verdict on one slide. `unseen` means nobody has looked yet. */
export type SlideStatus = 'unseen' | 'ok' | 'redo';

/** The verdict on the post. `ready` is the sign-off the studio exists to produce. */
export type PostStatus = 'draft' | 'review' | 'ready';

/** The compose axes this post renders with. Mirrors the flags, so it round-trips. */
export type PostAxes = {
  density: string;
  theme: string;
  ref?: string | number | null;
  formats: FormatId[];
};

/**
 * A slide: the copy itself, plus the review state that hangs off it.
 *
 * `review`, not `note` — `note` is REAL COPY on callout, symbolHero and footnote, and
 * naming the reviewer's comment the same thing silently deleted the words on twelve
 * slides the first time this was written. Review state must never share a name with a
 * layout field.
 */
export type PostSlide = RubricSlide & {
  status?: SlideStatus;
  /** Why it needs redoing, or what was checked. Never rendered. */
  review?: string;
};

export type Post = {
  id: string;
  product: string;
  name: string;
  bucket: 'bright' | 'product' | 'guide';
  /** What this post promises the reader — the thing its hook obliges it to deliver. */
  promise: string;
  /** Which rubric SHAPE it follows. Null while a post predates the shape it belongs to. */
  rubric: string | null;
  status: PostStatus;
  axes: PostAxes;
  note?: string;
  slides: PostSlide[];
  /** Where it last rendered. Recorded because editing slide 1 renames the run directory. */
  lastRun?: string | null;
  updatedAt?: string;
};

/* ------------------------------------------------------------------ views */

/**
 * The post as a Rubric.
 *
 * Everything downstream — compose, the golden corpus, nine tools — was written against
 * `Rubric`, and none of it cares where the slides came from. Handing back that exact shape
 * is what let the copy move out of TypeScript without a single golden moving.
 *
 * `status` and `review` are stripped: they are review state, not content, and letting
 * them ride along would put them in deck.json for no reason. Note what is NOT stripped —
 * `note` — because on callout, symbolHero and footnote that is the copy itself.
 */
export function asRubric(p: Post): Rubric {
  return {
    name: p.name,
    bucket: p.bucket,
    promise: p.promise,
    slides: p.slides.map(s => {
      const { status: _s, review: _r, ...copy } = s;
      return copy as RubricSlide;
    }),
  };
}

/* ------------------------------------------------------------------ storage */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Posts land in out/, alongside the renders they produce, because that is where generated
 * things go — a post is written interactively and then composed, not hand-maintained in
 * the source tree the way a template is.
 *
 * Scoped by product so two brands cannot collide on an id, and exempted from .gitignore
 * so the words survive a cleanup of out/.
 */
export function postDir(p: Product): string {
  return join(ROOT, 'out/posts', p.id);
}

export function postPath(p: Product, id: string): string {
  return join(postDir(p), `${id}.json`);
}

export function loadPost(p: Product, id: string): Post {
  const f = postPath(p, id);
  if (!existsSync(f)) throw new Error(`no post "${id}" for product "${p.id}" at ${f}`);
  return JSON.parse(readFileSync(f, 'utf8')) as Post;
}

/** Every post of a product. A malformed file is reported, not fatal — one bad file must
 *  not blank the studio's list. */
export function listPosts(p: Product): Array<Post | { id: string; error: string }> {
  const dir = postDir(p);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
    const id = f.slice(0, -5);
    try { return JSON.parse(readFileSync(join(dir, f), 'utf8')) as Post; }
    catch (e) { return { id, error: (e as Error).message }; }
  });
}

/** Only the posts that parsed, keyed by id — what the render path wants. */
export function postsById(p: Product): Record<string, Post> {
  const out: Record<string, Post> = {};
  for (const x of listPosts(p)) if (!('error' in x)) out[x.id] = x;
  return out;
}

export function savePost(p: Product, post: Post, now = new Date()): Post {
  mkdirSync(postDir(p), { recursive: true });
  const stamped = { ...post, updatedAt: now.toISOString() };
  writeFileSync(postPath(p, post.id), JSON.stringify(stamped, null, 2) + '\n');
  return stamped;
}

/** Filesystem-safe id from free text, so a post can be named after its hook. */
export function postId(s: string): string {
  return String(s).replace(/\*/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

/** Reported by the studio and refused by compose. Kept here so both agree. */
export function checkPost(post: Post): Problem[] {
  const out: Problem[] = [];
  const where = `${post.product}/${post.id}`;
  if (!post.slides.length) out.push({ where, what: 'has no slides' });
  if (post.slides.length > 10) out.push({ where, what: `${post.slides.length} slides — Instagram caps a carousel at 10` });
  if (post.slides.length < 5) out.push({ level: 'warn', where, what: `${post.slides.length} slides — under 5 there is no room for a body` });
  if (!post.axes?.formats?.length) out.push({ where, what: 'no formats in axes' });
  return out;
}
