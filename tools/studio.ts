#!/usr/bin/env node
// Studio — a local dashboard for reviewing, fixing and signing off posts.
//   node tools/studio.ts [--port 4321] [--product cast]
//
// Everything else in this repo is a CLI, and reviewing a post through one means opening a
// PNG in Finder, hunting the copy in a 327-line TypeScript file, re-running compose, and
// opening the PNG again. The judgement this loop needs — is that slide readable, does it
// say anything — is exactly the judgement a terminal cannot help with.
//
// Two rules shape what this is allowed to do:
//
//   * It never writes TypeScript. Copy edits land in drafts (see src/draft.ts): JSON
//     patches over a rubric. Rubrics keep their authored comments, and the 335-file golden
//     corpus never moves, because drafts live outside the directories the corpus globs.
//   * It never spends money. Every render it triggers passes --no-generate, so a cache
//     miss is reported as a price rather than paid. Copy edits cannot miss the art cache
//     anyway — the key is built from the art prompt, not the slide text (src/cache.ts) —
//     but "cannot" beats "should not" when there is a card on file.
//
// Zero dependencies, like the rest of the repo: node:http is a builtin, and the page is
// one hand-written HTML file with no framework and no build step.
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { productFromArgv, PRODUCTS } from '../src/product.ts';
import { rubricsFor } from '../src/plan.ts';
import { RUNS } from '../src/run.ts';
import { validateSlide, nameSets, type Problem } from '../src/validate.ts';
import { asRubric, checkPost, listPosts, loadPost, postPath, savePost, type Post } from '../src/post.ts';
import type { Product, Slide } from '../src/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'tools/studio/app.html');

const arg = (k: string, d: string): string => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? (process.argv[i + 1] ?? d) : d;
};
const PORT = Number(arg('port', '4321'));
const P: Product = productFromArgv();
// Rubrics are a view over the post files (src/plan.ts), and posts are JSON read from disk
// on every call — so unlike the old arrangement, an edit made here or in an editor is
// visible on the next request without restarting the server.
const rubrics = () => rubricsFor(P);

/* ------------------------------------------------------------------ reading runs */

type RunSummary = {
  id: string;
  deck: string;
  rubric: string;
  product: string;
  density: string;
  theme: string;
  ref: string | null;
  format: string;
  hook: string;
  slides: number;
  mtime: string;
};

/** Only compose writes a deck.json, and only compose runs are posts. */
function isRun(id: string): boolean {
  return existsSync(join(RUNS, id, 'deck.json'));
}

function runIds(): string[] {
  if (!existsSync(RUNS)) return [];
  return readdirSync(RUNS).filter(f => f !== 'latest' && isRun(f));
}

function readDeck(id: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(RUNS, id, 'deck.json'), 'utf8')) as Record<string, unknown>;
}

/**
 * What makes two run folders the SAME post.
 *
 * `compose --format ig,tiktok` writes two directories, and listing directories as posts
 * showed one post twice — which is wrong twice over: it doubles the review queue, and it
 * hides the thing you actually want to check, which is whether the same words survive
 * both crops. Format is the one axis that is a VIEW of a post rather than a different
 * post, so it is the one axis left out of the key. The hook is in it because editing
 * slide 1 renames the run folder (src/run.ts:135) and genuinely does make a new post.
 */
function postKey(r: RunSummary): string {
  return [r.product, r.rubric, r.density, r.theme, r.ref ?? '', r.hook].join('|');
}

function summarise(id: string): RunSummary {
  const d = readDeck(id);
  const slides = (d.slides ?? []) as Array<Record<string, unknown>>;
  const fmt = (d.format ?? {}) as { id?: string };
  return {
    id,
    deck: String(d.deck ?? id),
    rubric: String(d.rubric ?? ''),
    product: String(d.product ?? 'cast'),
    density: String(d.density ?? ''),
    theme: String(d.theme ?? ''),
    ref: d.ref == null ? null : String(d.ref),
    format: String(fmt.id ?? 'ig'),
    hook: String(slides[0]?.title ?? ''),
    slides: slides.length,
    mtime: statSync(join(RUNS, id, 'deck.json')).mtime.toISOString(),
  };
}

/** One RENDERED post, and the run folder each format landed in. */
type RenderedPost = {
  key: string;
  hook: string;
  rubric: string;
  product: string;
  density: string;
  theme: string;
  ref: string | null;
  slides: number;
  mtime: string;
  formats: Array<{ id: string; run: string }>;
};

function renders(): RenderedPost[] {
  const byKey = new Map<string, RunSummary[]>();
  for (const r of runIds().map(summarise)) {
    const k = postKey(r);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r);
  }
  return [...byKey.entries()]
    .map(([key, runs]) => {
      // ig first, then whatever else — the 4:5 canvas is the one the copy was written for.
      const sorted = [...runs].sort((a, b) => (a.format === 'ig' ? -1 : b.format === 'ig' ? 1 : a.format.localeCompare(b.format)));
      const lead = sorted[0]!;
      return {
        key, hook: lead.hook, rubric: lead.rubric, product: lead.product,
        density: lead.density, theme: lead.theme, ref: lead.ref, slides: lead.slides,
        mtime: sorted.map(r => r.mtime).sort().at(-1)!,
        formats: sorted.map(r => ({ id: r.format, run: r.id })),
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

/** The formats a given run has siblings in, so the page can offer a switch. */
function siblingsOf(id: string): Array<{ id: string; run: string }> {
  const me = summarise(id);
  const mine = postKey(me);
  return renders().find(p => p.key === mine)?.formats ?? [{ id: me.format, run: id }];
}

/* ------------------------------------------------------------------ the API */

/** A run, expanded: every slide with its image, its copy and its own problems. */
function postDetail(id: string) {
  const deck = readDeck(id);
  const slides = (deck.slides ?? []) as Slide[];
  const sets = nameSets(P);
  // Every format this same post was rendered into. The page switches between them in
  // place rather than listing them as separate posts — and the copy is READ FROM THIS
  // RUN's deck.json only, because the words are identical across formats by construction.
  const siblings = siblingsOf(id);

  return {
    ...summarise(id),
    siblings,
    deckPath: join(RUNS, id, 'deck.json'),
    contactSheet: Object.fromEntries(siblings
      .filter(f => existsSync(join(RUNS, f.run, 'contact-sheet.png')))
      .map(f => [f.id, `/img/${f.run}/contact-sheet.png`])),
    slides: slides.map((s, i) => {
      const name = `${String(i + 1).padStart(2, '0')}-${s.layout}`;
      return {
        i,
        layout: s.layout,
        name,
        // Keyed by format so switching is a src swap, not another round trip.
        png: Object.fromEntries(siblings
          .filter(f => existsSync(join(RUNS, f.run, `${name}.png`)))
          .map(f => [f.id, `/img/${f.run}/${name}.png`])),
        copy: copyOf(s),
        problems: validateSlide(P, s, `slide ${i + 1}`, sets),
      };
    }),
  };
}

/** The fields a human edits. Everything else on a slide is machinery. */
const COPY_KEYS = ['title', 'kicker', 'note', 'lede', 'items', 'value', 'unit',
  'before', 'after', 'a', 'b', 'aTitle', 'bTitle', 'author', 'role', 'accent'] as const;

function copyOf(s: Slide): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of COPY_KEYS) {
    const v = (s as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * A post file, expanded the same way a rendered run is, so the page draws both with one
 * component.
 *
 * There is no patch layer here any more. A post HOLDS its words — the studio edits them in
 * place — which is what "a rubric is a template, a post is a post" actually means once you
 * follow it through. The drift problem that the old draft model needed a guard for simply
 * does not exist: nothing sits underneath a post that can move.
 */
function postFileDetail(post: Post) {
  const sets = nameSets(P);
  const rubric = asRubric(post);
  const run = post.lastRun && isRun(post.lastRun) ? post.lastRun : null;
  // A post names several formats and compose renders one folder per format. Offer the
  // same in-place switch a rendered run gets — they are one post, not several.
  const siblings = run ? siblingsOf(run) : [];

  return {
    post,
    problems: checkPost(post),
    siblings,
    slides: rubric.slides.map((s, i) => {
      const name = `${String(i + 1).padStart(2, '0')}-${s.layout}`;
      const entry = post.slides[i];
      return {
        i,
        layout: s.layout,
        name,
        // One image per format, so switching does not re-fetch the whole post.
        png: Object.fromEntries(siblings
          .filter(f => existsSync(join(RUNS, f.run, `${name}.png`)))
          .map(f => [f.id, `/img/${f.run}/${name}.png`])),
        copy: copyOf(s),
        status: entry?.status ?? 'unseen',
        review: entry?.review ?? '',
        problems: validateSlide(P, s, `slide ${i + 1}`, sets),
      };
    }),
  };
}

/* ------------------------------------------------------------------ rendering */

/**
 * Re-render a post. Always --no-generate: see the note at the top of this file. Resolves
 * with the child's exit code so the caller can tell "rendered" (0) from "that would have
 * cost money" (2) from "it broke" (1).
 */
function renderPost(d: Post): Promise<{ code: number; log: string }> {
  return new Promise(res => {
    const args = ['tools/compose.ts', '--post', d.id, '--product', d.product, '--no-generate'];
    const child = spawn(process.execPath, args, { cwd: ROOT });
    let log = '';
    child.stdout.on('data', b => { log += b; });
    child.stderr.on('data', b => { log += b; });
    child.on('close', code => res({ code: code ?? 1, log }));
  });
}

/* ------------------------------------------------------------------ http */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
};

const json = (res: ServerResponse, code: number, body: unknown): void => {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'content-type': MIME['.json']!, 'content-length': Buffer.byteLength(s) });
  res.end(s);
};

function body(req: IncomingMessage): Promise<string> {
  return new Promise((ok, no) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 4e6) { no(new Error('body too large')); req.destroy(); } });
    req.on('end', () => ok(b));
    req.on('error', no);
  });
}

/**
 * Serve a file from under `base`, and only from under `base`.
 *
 * The check is on the RESOLVED path, not the URL: `/img/a/../../../../etc/passwd` is a
 * perfectly ordinary-looking URL whose resolution escapes the directory. Comparing after
 * resolution is the only version of this check that works.
 */
function serveUnder(res: ServerResponse, base: string, rel: string): void {
  const full = resolvePath(base, rel);
  if (full !== base && !full.startsWith(base + '/')) { json(res, 403, { error: 'outside the served directory' }); return; }
  if (!existsSync(full) || !statSync(full).isFile()) { json(res, 404, { error: 'no such file' }); return; }
  const buf = readFileSync(full);
  res.writeHead(200, { 'content-type': MIME[extname(full)] ?? 'application/octet-stream', 'content-length': buf.length });
  res.end(buf);
}

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  const seg = path.split('/').filter(Boolean);

  try {
    if (path === '/' || path === '/index.html') {
      if (!existsSync(APP)) { json(res, 500, { error: `missing ${APP}` }); return; }
      const html = readFileSync(APP, 'utf8');   // re-read per request: edit and reload
      res.writeHead(200, { 'content-type': MIME['.html']! });
      res.end(html);
      return;
    }

    if (seg[0] === 'img' && seg.length >= 3) {
      serveUnder(res, RUNS, seg.slice(1).join('/'));
      return;
    }

    if (path === '/api/state') {
      json(res, 200, {
        product: { id: P.id, name: P.name, handle: P.handle },
        products: Object.keys(PRODUCTS),
        rubrics: Object.entries(rubrics()).map(([id, r]) => ({ id, name: r.name, bucket: r.bucket, promise: r.promise, slides: r.slides.length })),
        renders: renders(),
        posts: listPosts(P),
      });
      return;
    }

    // A rendered run, not a post file. The two share this route and are told apart by
    // where they live: a run is a directory under out/runs, a post is a file under
    // copy/posts. Runs are checked first because their ids are the more specific — they
    // carry the density, theme and format that a post id does not.
    if (seg[0] === 'api' && seg[1] === 'post' && seg[2] && isRun(seg[2])) {
      json(res, 200, postDetail(seg[2]));
      return;
    }

    if (seg[0] === 'api' && seg[1] === 'post' && seg[2] && !isRun(seg[2])) {
      // A post FILE. The run route above catches directory ids first, so the two cannot
      // be confused — a run id is a folder in out/runs, a post id is a file in copy/posts.
      const id = seg[2];
      const action = seg[3];

      if (req.method === 'PUT' && !action) {
        const d = JSON.parse(await body(req)) as Post;
        if (d.id !== id) { json(res, 400, { error: `body id "${d.id}" does not match the URL "${id}"` }); return; }
        json(res, 200, { post: savePost(P, d) });
        return;
      }
      if (action === 'render' && req.method === 'POST') {
        const result = await renderPost(loadPost(P, id));
        json(res, 200, result);
        return;
      }
      if (action === 'validate' || !action) {
        if (!existsSync(postPath(P, id))) { json(res, 404, { error: `no run or post "${id}"` }); return; }
        json(res, 200, postFileDetail(loadPost(P, id)));
        return;
      }
    }

    json(res, 404, { error: `no route for ${req.method} ${path}` });
  } catch (e) {
    json(res, 500, { error: (e as Error).message });
  }
}

/** Exported so tests can bind port 0 rather than fighting a fixed one. */
export function studio() {
  return createServer((req, res) => { void handle(req, res); });
}

// Only listen when run directly, so importing this in a test does not open a port.
if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  studio().listen(PORT, () => {
    console.log(`\nstudio — ${P.name}  ·  ${Object.keys(rubrics()).length} posts  ·  ${runIds().length} posts`);
    console.log(`\n  http://localhost:${PORT}\n`);
    console.log('  posts are JSON, read per request — edit and reload, no restart.');
    console.log('  every render passes --no-generate, so nothing here can spend.\n');
  });
}

export type { Problem, RunSummary };
