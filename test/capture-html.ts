#!/usr/bin/env node
// Capture the HTML goldens from whatever renderSlide currently is.
//
// Run this ONCE against the pre-migration .mjs, commit the result, and never run it again
// during Phases 1-3. The goldens are meant to be a record of behaviour as it was, not a
// record of intent — if a golden changes during the port, the port is wrong.
//
//   node test/capture-html.ts
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSlide } from './helpers/sut.ts';
import { corpus } from './helpers/corpus.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'test/golden/html');

/**
 * A slide that throws today must still throw after the port, with the same message. So a
 * throw is captured as a golden too, rather than crashing the capture.
 */
export function renderCase(slide: Record<string, unknown>): string {
  try {
    return renderSlide(slide as never);
  } catch (e) {
    return `!! THREW: ${(e as Error).message}\n`;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(OUT, { recursive: true });
  const cases = corpus();
  const written = new Set<string>();

  let threw = 0;
  for (const c of cases) {
    const html = renderCase(c.slide);
    if (html.startsWith('!! THREW:')) threw++;
    writeFileSync(join(OUT, `${c.name}.html`), html);
    written.add(`${c.name}.html`);
  }

  // Drop goldens whose case no longer exists, so a removed case cannot linger as a file
  // that nothing asserts against.
  let removed = 0;
  if (existsSync(OUT)) {
    for (const f of readdirSync(OUT)) {
      if (!written.has(f)) { rmSync(join(OUT, f)); removed++; }
    }
  }

  console.log(`captured ${cases.length} HTML goldens -> test/golden/html/`);
  if (threw) console.log(`  ${threw} case(s) throw today; the throw is pinned as the golden`);
  if (removed) console.log(`  removed ${removed} stale golden(s)`);
}
