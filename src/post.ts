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

/**
 * Where the post is in its life, from written to published.
 *
 * These are ordered, and the order is the point: each state is a gate the one before it
 * has to clear. `approved` in particular is not a synonym for "finished" — it is a human
 * saying so, in chat, in as many words. Nothing in this repo may set it on its own, which
 * is why it sits between `review` (the machine and the author think it is done) and
 * `scheduled` (money and reputation are now committed).
 *
 * The split between `approved` and `scheduled` is the one that earns its keep: it is the
 * difference between "these words are right" and "these words are in Postiz, on a date".
 * Collapsing them loses the ability to answer "what is signed off and not yet queued",
 * which is the only question the publish step actually asks.
 */
export type PostStatus =
  /** Being written. Slides may be missing, copy may be wrong. */
  | 'draft'
  /** Finished and rendered, waiting on a human. NOT approved. */
  | 'review'
  /** A human approved it in chat. Words final, nothing uploaded. */
  | 'approved'
  /** Uploaded to Postiz and queued for a date. See `publish`. */
  | 'scheduled'
  /** Out. */
  | 'published';

/** In lifecycle order, so the studio can render them as a progression rather than a set. */
export const POST_STATUSES: PostStatus[] = ['draft', 'review', 'approved', 'scheduled', 'published'];

/** How far along a status is. Used to ask "at least approved?" without listing states. */
export function statusRank(s: PostStatus): number {
  const i = POST_STATUSES.indexOf(s);
  return i < 0 ? 0 : i;
}

/**
 * One channel this post went to.
 *
 * `format` is recorded because it is what decides WHICH render was uploaded — the 4:5
 * slides go to Instagram and the 9:16 slides go to TikTok, and after the fact nothing
 * else in the file says which pictures a given channel received.
 *
 * `postId` is Postiz's, filled in once the post exists there. It is what analytics is
 * looked up by later, and without it a published post is unmeasurable.
 */
export type PublishTarget = {
  /** Postiz platform identifier, e.g. `instagram-standalone`, `tiktok-business`. */
  platform: string;
  /** Postiz integration id — the specific connected channel. */
  integrationId: string;
  /** Which rendered format was uploaded here. */
  format: FormatId;
  /** Postiz post id, once it has been created there. */
  postId?: string;
};

/** What happened on the Postiz side. Absent until the post is scheduled. */
export type PublishRecord = {
  /** ISO 8601, UTC — the date Postiz will publish, or did. */
  scheduledFor?: string;
  targets: PublishTarget[];
};

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

/**
 * The words that go BESIDE the picture.
 *
 * The slides are the post to a reader who swipes; the caption is the post to everyone
 * who does not. Instagram and TikTok both publish one, both cap it at 2200 characters,
 * and neither will accept a carousel without one worth reading — so a post whose caption
 * is unwritten is rendered but not publishable.
 *
 * It lives on the post rather than per format, for the same reason slides do: two formats
 * are one post in two crops, and letting the caption fork would mean two things to keep
 * true. `title` is the single genuinely platform-bound field — TikTok photo posts carry a
 * 90-character title above the caption and Instagram has no equivalent — so it is one
 * extra field rather than an excuse for a second caption.
 */
export type Caption = {
  /** The caption itself. Plain text; line breaks survive to both platforms. */
  body: string;
  /**
   * Stored WITHOUT the leading `#`, added by captionText(). One canonical form, so the
   * length check cannot disagree with what is published over a missing hash.
   */
  hashtags?: string[];
  /** TikTok only, <= 90 chars. Instagram ignores it. */
  title?: string;
};

/** Both platforms report the same ceiling in their Postiz integration schema. */
export const CAPTION_MAX = 2200;
/** TikTok's `title` setting, from the same schema. */
export const TIKTOK_TITLE_MAX = 90;

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
  /** What gets published beside the slides. Absent until it is written. */
  caption?: Caption;
  slides: PostSlide[];
  /** Where it last rendered. Recorded because editing slide 1 renames the run directory. */
  lastRun?: string | null;
  /** The Postiz side. Absent until the post is scheduled. */
  publish?: PublishRecord;
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

/**
 * The caption exactly as it will be published: body, a blank line, then the tags.
 *
 * The `#` is added here rather than stored, so there is one canonical form and the length
 * check below can never disagree with what actually goes out. A tag the author wrote with
 * a hash anyway is tolerated rather than doubled.
 */
export function captionText(c: Caption | undefined): string {
  if (!c) return '';
  const tags = (c.hashtags ?? []).map(t => '#' + String(t).replace(/^#+/, ''));
  return tags.length ? `${c.body}\n\n${tags.join(' ')}` : c.body;
}

/**
 * What blocks PUBLISHING, as opposed to rendering.
 *
 * Split from checkPost on purpose. Nothing here can stop a render — compose never reads
 * the caption — so folding these in as errors would refuse to draw a post whose picture
 * is finished and whose words are not. checkPost therefore reports them as warnings,
 * while a publish path calls this and treats them as the errors they are there.
 */
export function checkCaption(post: Post): Problem[] {
  const out: Problem[] = [];
  const where = `${post.product}/${post.id}`;
  const c = post.caption;

  if (!c || !c.body.trim()) {
    out.push({ where, what: 'no caption — the slides render, but there is nothing to publish beside them' });
    return out;
  }

  const full = captionText(c);
  if (full.length > CAPTION_MAX) {
    out.push({ where, what: `caption is ${full.length} chars with its tags — Instagram and TikTok both cap it at ${CAPTION_MAX}` });
  }
  if (c.title && c.title.length > TIKTOK_TITLE_MAX) {
    out.push({ where, what: `title is ${c.title.length} chars — TikTok caps it at ${TIKTOK_TITLE_MAX}` });
  }
  for (const t of c.hashtags ?? []) {
    // A space inside a tag does not fail — it silently becomes two tags, the second of
    // which is whatever the rest of the words happened to be.
    if (/\s/.test(t)) out.push({ where, what: `hashtag "${t}" contains a space — it would publish as two tags` });
  }
  return out;
}

/**
 * Whether the post has earned the status it claims.
 *
 * Status is a claim about the world — "a human approved this", "this is queued at Postiz"
 * — and a JSON field can claim anything. These are the checks that make the later states
 * mean something, and like checkCaption they are publish-time errors rather than
 * render-time ones: a wrongly-labelled post still draws fine.
 *
 * What is deliberately NOT checked here: that a human really approved it. Nothing in a
 * file can prove that. The rule lives in the skill instead — approval is spoken in chat,
 * and this repo may never set `approved` on its own initiative.
 */
export function checkStatus(post: Post): Problem[] {
  const out: Problem[] = [];
  const where = `${post.product}/${post.id}`;
  const rank = statusRank(post.status);

  if (!POST_STATUSES.includes(post.status)) {
    out.push({ where, what: `unknown status "${post.status}" — have: ${POST_STATUSES.join(', ')}` });
    return out;
  }

  // Approved means the words are final. A post with nothing to publish beside the slides
  // cannot be final, whoever said so.
  if (rank >= statusRank('approved')) {
    for (const p of checkCaption(post)) out.push({ ...p, what: `${post.status}, but ${p.what}` });
    if (!post.slides.length) out.push({ where, what: `${post.status}, but has no slides` });
  }

  const targets = post.publish?.targets ?? [];

  if (rank >= statusRank('scheduled')) {
    if (!targets.length) out.push({ where, what: `${post.status}, but no publish targets — nothing records where it went` });
    if (!post.publish?.scheduledFor) {
      out.push({ where, what: `${post.status}, but no scheduledFor date` });
    } else if (Number.isNaN(Date.parse(post.publish.scheduledFor))) {
      out.push({ where, what: `scheduledFor "${post.publish.scheduledFor}" is not a date` });
    }
    for (const t of targets) {
      if (!t.integrationId) out.push({ where, what: `a ${t.platform} target has no integrationId` });
      if (!post.axes?.formats?.includes(t.format)) {
        // The channel was sent a crop this post never rendered.
        out.push({ where, what: `target ${t.platform} claims format "${t.format}", which is not in axes.formats` });
      }
    }
  } else if (post.publish) {
    out.push({ where, what: `status is "${post.status}" but a publish record exists — one of the two is stale` });
  }

  // Without Postiz's own id there is no analytics: the post is out and unmeasurable.
  if (rank >= statusRank('published')) {
    for (const t of targets) {
      if (!t.postId) out.push({ where, what: `published, but the ${t.platform} target has no postId — analytics cannot find it` });
    }
  }
  return out;
}

/** Reported by the studio and refused by compose. Kept here so both agree. */
export function checkPost(post: Post): Problem[] {
  const out: Problem[] = [];
  const where = `${post.product}/${post.id}`;
  if (!post.slides.length) out.push({ where, what: 'has no slides' });
  if (post.slides.length > 10) out.push({ where, what: `${post.slides.length} slides — Instagram caps a carousel at 10` });
  if (post.slides.length < 5) out.push({ level: 'warn', where, what: `${post.slides.length} slides — under 5 there is no room for a body` });
  if (!post.axes?.formats?.length) out.push({ where, what: 'no formats in axes' });
  // Demoted, not dropped: see checkCaption and checkStatus. The studio shows these so a
  // post cannot reach `approved` with no words beside it, and compose renders anyway.
  for (const p of checkCaption(post)) out.push({ ...p, level: 'warn' });
  for (const p of checkStatus(post)) out.push({ ...p, level: 'warn' });
  return out;
}
