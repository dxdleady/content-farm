// Shared Chrome plumbing for Tier 3: one browser for a whole run, plus the environment
// fingerprint that decides whether byte-comparison is meaningful on this machine.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { Chrome } from '../../src/chrome.ts';
import { renderSlide } from './sut.ts';
import { renderPage, composePage, assetHashInputs } from './page.ts';
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
  return c.wrapper === 'render' ? renderPage(inner, c.format) : composePage(inner, c.format);
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
    // A fresh target per case. Reusing one page across ~30 navigations of 2MB documents
    // wedged the capture indefinitely — Page.captureScreenshot never returned and the
    // 20s load timeout never fired, so there was nothing to catch. Targets are cheap;
    // correctness here is worth more than the milliseconds.
    for (const [i, c] of cases.entries()) {
      const t0 = Date.now();
      const path = writeHtml(c.id, pageFor(c));
      const page = await chrome.newPage(c.format.w, c.format.h);
      try {
        shots.set(c.id, await chrome.shoot(page, `file://${path}`, c.format.w, c.format.h));
      } finally {
        await chrome.close(page);
      }
      onProgress?.(c.id, i, Date.now() - t0);
    }
  } finally {
    chrome.kill();
  }
  return shots;
}

export const hashPng = (buf: Buffer) => `sha256:${createHash('sha256').update(buf).digest('hex')}`;
