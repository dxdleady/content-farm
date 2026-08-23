// Where a generated background lives on disk, and why.
//
// The cache is content-addressed: identical inputs mean an identical filename, so an
// unchanged prompt on an unchanged reference is never paid for twice. That is the whole
// economics of the generator — copy edits and re-renders cost nothing, only genuinely new
// prompts spend.
//
// This formula was inlined in five tools. It drifted exactly once and the consequence was
// real: pack-from-ref omitted the ratio, which made its key correct only by accident and
// would have served 4:5 art for 9:16 requests the moment that tool learned --format.
// One definition removes that class of bug rather than guarding against it.
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Ratio } from './types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const CACHE_DIR: string = join(ROOT, 'assets/generated');

/**
 * The path a generated image is cached at.
 *
 * `ratio` only enters the key when it is NOT 4:5. That asymmetry is deliberate and must
 * stay: every Instagram image already on disk was keyed before the format axis existed,
 * and re-including 4:5 would invalidate all of them and re-buy the lot.
 */
export function cachePath(
  { model, prompt, ratio, refBytes }: { model: string; prompt: string; ratio: Ratio; refBytes: Buffer },
): string {
  const ratioTag = ratio === '4:5' ? '' : `|${ratio}`;
  const hash = createHash('sha256')
    .update(`${model}|${prompt}${ratioTag}`)
    .update(refBytes)
    .digest('hex')
    .slice(0, 16);
  return join(CACHE_DIR, `pack-${hash}.png`);
}
