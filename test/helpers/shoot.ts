// Shared Chrome plumbing for Tier 3: one browser for a whole run, plus the environment
// fingerprint that decides whether byte-comparison is meaningful on this machine.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { Chrome } from '../../src/chrome.ts';
import { renderSlide } from './sut.ts';
import { GRAIN, assetHashInputs } from './page.ts';
import { slidePage } from '../../src/page.ts';
// Named, not defaulted: this harness is the arbiter, so it must not inherit whatever
// slidePage decides the default product is on some later day.
import { PRODUCTS, DEFAULT_PRODUCT } from '../../src/product.ts';
import type { PngCase } from './png-cases.ts';

export type Fingerprint = {
  chrome: string; node: string; platform: string; fontsSha: string; cssSha: string;
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export function fingerprint(): Fingerprint {
  const bin = process.env.CHROME_BIN
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  let chrome = 'unknown';
  if (existsSync(bin)) {
    try { chrome = execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim(); } catch { /* leave unknown */ }
  }
  const assets = assetHashInputs();
  return {
    chrome,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    fontsSha: sha(assets.fonts),
    cssSha: sha(assets.css),
  };
}

/** Which fingerprint fields differ. Empty means byte-comparison is valid here. */
export function fingerprintDrift(a: Fingerprint, b: Fingerprint): string[] {
  return (Object.keys(a) as Array<keyof Fingerprint>)
    .filter(k => a[k] !== b[k])
    .map(k => `${k}: golden=${a[k]} here=${b[k]}`);
}

export const pageFor = (c: PngCase): string => {
  const inner = renderSlide(c.slide as never);
  // Both wrappers are the SHARED one now; only the tail differs, exactly as before the
  // extraction. The frozen copies in ./page.ts stay untouched as the arbiter that the
  // extraction is checked against — see the wrapper tests in test/png/golden.test.ts.
  return c.wrapper === 'render'
    ? slidePage(inner, c.format, PRODUCTS[DEFAULT_PRODUCT], `:root{--grain:${GRAIN}}`)
    : slidePage(inner, c.format);
};

/**
 * Screenshot every case with one browser. Returns raw PNG buffers keyed by case id.
 * The HTML is written to disk because Chrome loads it over file://, matching how every
 * tool in the repo renders.
 */
export async function shootAll(
  cases: PngCase[],
  writeHtml: (id: string, html: string) => string,
  onProgress?: (id: string, i: number, ms: number) => void,
): Promise<Map<string, Buffer>> {
  const shots = new Map<string, Buffer>();
  const chrome = await Chrome.launch();
  try {
    // shootPooled reuses a target and recycles it on a wedge. This harness is where that wedge was
    // first diagnosed; the workaround now lives in Chrome itself, so the tools get it too.
    for (const [i, c] of cases.entries()) {
      const t0 = Date.now();
      const path = writeHtml(c.id, pageFor(c));
      shots.set(c.id, await chrome.shootPooled(`file://${path}`, c.format.w, c.format.h));
      onProgress?.(c.id, i, Date.now() - t0);
    }
  } finally {
    chrome.kill();
  }
  return shots;
}

export const hashPng = (buf: Buffer) => `sha256:${createHash('sha256').update(buf).digest('hex')}`;
