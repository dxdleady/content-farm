// Background generation stage ("nano banana" = Google Gemini 2.5 Flash Image).
//
//   API KEY -> put it in  .env  at the project root:
//       GEMINI_API_KEY=AIza...
//   (GOOGLE_API_KEY and an exported shell env var work too.)
//   Get one at https://aistudio.google.com/apikey
//
// Every prompt is wrapped in a fixed STYLE LOCK so generated art stays inside the
// (cast) visual language. Results are content-hashed into assets/generated/ and
// reused, so re-rendering a deck costs nothing. With no key present the stage is
// skipped and slides fall back to their CSS gradients.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { MODELS } from './providers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'assets/generated');
const REFS = join(ROOT, 'refs/style');

try { process.loadEnvFile(join(ROOT, '.env')); } catch { /* no .env — fine */ }

export const MODEL = process.env.BANANA_MODEL || 'gemini-2.5-flash-image';
export const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;

/* ------------------------------------------------------------------ style lock */
// The brand frame lives in tokens; the art direction lives in src/styles.json so it
// can be swapped per slide without touching code.
const T = JSON.parse(readFileSync(join(ROOT, 'tokens/tokens.json'), 'utf8'));
const S = JSON.parse(readFileSync(join(ROOT, 'src/styles.json'), 'utf8'));

export const PRESETS = Object.keys(S.treatments);
export const DEFAULT_PRESET = S.default;

export function styleLock(preset = S.default) {
  const t = S.treatments[preset];
  if (!t) throw new Error(`unknown bgStyle "${preset}" — have: ${PRESETS.join(', ')}`);
  return [
    'STYLE LOCK — follow exactly:',
    ...S.base.map(l => `· ${l}`),
    `· ${t.palette ?? S.palette}`,
    '',
    `TREATMENT — ${preset}:`,
    ...t.lines.map(l => `· ${l}`),
  ].join('\n');
}

// Kept exported for anything that just wants the default frame.
export const STYLE_LOCK = styleLock();

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
// Sending the whole board averages every generation into the same mush, and burns
// tokens. A small deterministic sample per subject keeps each frame committed to a
// few references instead of the mean of all of them.
const REF_SAMPLE = Number(process.env.REF_SAMPLE || 5);

/**
 * Visual references — they condition style, never subject matter.
 * refs/style/<preset>/ wins when it exists, otherwise the flat refs/style/ set is used,
 * so a preset like ps1 isn't dragged back towards photography by unrelated refs.
 */
export function refFile(path) {
  const bytes = readFileSync(path);
  const ext = path.split('.').pop().toLowerCase();
  return {
    name: path.split('/').pop(),
    mimeType: MIME[ext],
    data: bytes.toString('base64'),
    hash: createHash('sha256').update(bytes).digest('hex').slice(0, 12),
  };
}

export function refs(preset, seed = null) {
  const scoped = preset ? join(REFS, preset) : null;
  const dir = scoped && existsSync(scoped) ? scoped : REFS;
  if (!existsSync(dir)) return [];
  let files = readdirSync(dir).filter(f => MIME[f.split('.').pop().toLowerCase()]).sort();
  if (seed !== null) {
    // deterministic Fisher-Yates keyed on the subject, so a re-render reuses the cache
    const h = createHash('sha256').update(String(seed)).digest();
    for (let i = files.length - 1; i > 0; i--) {
      const j = ((h[i % h.length] << 8 | h[(i * 7 + 3) % h.length]) >>> 0) % (i + 1);
      [files[i], files[j]] = [files[j], files[i]];
    }
  }
  return files
    .slice(0, REF_SAMPLE)
    .map(f => {
      const bytes = readFileSync(join(dir, f));
      return {
        name: f,
        mimeType: MIME[f.split('.').pop().toLowerCase()],
        data: bytes.toString('base64'),
        hash: createHash('sha256').update(bytes).digest('hex').slice(0, 12),
      };
    });
}

// The attached images outrank the prose. The old note told the model to keep only
// light and colour from them, which is exactly why generations came back as
// "my text description, tinted with ref colours".
const REF_NOTE = `
THE ATTACHED IMAGES ARE THE TARGET LOOK. Reproduce them: the same framing and crop,
the same pose energy, the same lighting, the same surface texture and rendering
artefacts, the same colour treatment, the same graphic devices and props.
Someone should be able to put your output in the same folder and not notice.
The line below says only WHAT to depict — the images decide HOW. Do not substitute
a different style, do not clean it up, do not make it tasteful.`.trim();

/**
 * Deterministic per-subject shuffle of the wildcard pools. Same subject always
 * yields the same directives (so the cache stays valid), different subjects
 * diverge hard — which is what stops every frame being the same safe portrait.
 * Bump `variant` to re-roll a slide without touching its text.
 */
function wildcards(subject, variant = 0) {
  const pools = S.wildcards ?? {};
  const seed = createHash('sha256').update(`${subject}|${variant}`).digest();
  const picks = [];
  let i = 0;
  for (const [name, list] of Object.entries(pools)) {
    if (name.startsWith('$') || !Array.isArray(list)) continue;
    picks.push(`· ${list[seed[i % seed.length] % list.length]}`);
    i += 3;
  }
  return picks.length
    ? `\n\nFRAME IT LIKE THIS — all of the following at once:\n${picks.join('\n')}\n\n${S.misbehave ?? ''}`
    : '';
}

/**
 * With an image-to-image model the reference is the actual input, not a hint, so
 * the prompt only has to name what changes. Text-to-image can never hold a look
 * this way — that was the whole problem with the earlier generations.
 */
function editPrompt({ subject, framing, colorName, color }) {
  return [
    'Keep this image\'s exact rendering style: the same medium, engine, texture, grain,',
    'contrast, edge quality and level of polish. Do not clean it up or modernise it.',
    '',
    `Change the subject to: ${subject}.`,
    `Change the framing to: ${framing}.`,
    `Change the dominant colour to ${colorName} (${color}) and key the whole frame to it.`,
    '',
    'CRITICAL: the output must contain NO text of any kind — no words, letters, numerals,',
    'signage, labels, logos or watermarks, not even on objects in the scene. If the subject',
    'would normally carry writing, leave that surface blank. Any person is invented.',
  ].join('\n');
}

export const EDIT_MODELS = Object.keys(MODELS);

/**
 * Solo-ref prompt. One reference image is the whole art direction; the text only
 * names the three axes we deliberately move off it. Mixing several references
 * averages them into mush, so this keeps the ratio at one image to one output.
 */
const SOLO_NOTE = `
THE ATTACHED IMAGE IS THE EXACT LOOK TO REPRODUCE.
Copy how it is made: the medium, the lighting, the surface texture and grain, the
contrast, the edge quality, the level of polish, the graphic devices, the way the
subject meets the frame. If it is a game render, render a game. If it is a photocopied
collage, photocopy a collage. If it is harsh flash on film, shoot harsh flash on film.

NOW CHANGE EXACTLY THREE THINGS AND NOTHING ELSE:`.trim();

const SOLO_TAIL = `
Everything not listed above stays as close to the reference as you can get it.
Do not make it cleaner, safer, calmer or more tasteful than the reference.`.trim();

function soloPrompt({ subject, framing, color, colorName }) {
  return [
    SOLO_NOTE,
    `· SUBJECT -> ${subject}`,
    `· ANGLE & FRAMING -> ${framing}`,
    `· DOMINANT COLOUR -> ${colorName} ${color}. The whole frame is keyed to it; the reference's own palette is discarded.`,
    '',
    SOLO_TAIL,
    '',
    'NON-NEGOTIABLE:',
    ...S.hard.map(l => `· ${l}`),
  ].join('\n');
}

// Two modes. With refs the prose shrinks to the non-negotiables so it cannot
// out-shout the images; without refs the full written lock does the work.
const promptFor = (subject, nRefs = 0, preset = S.default, colors = null, variant = 0) => {
  const pin = colors?.length
    ? `\n\nCOLOUR: lean on ${colors.join(' and ')}, but the references decide the palette if they disagree.`
    : '';
  const head = nRefs
    ? `${REF_NOTE}\n\nNON-NEGOTIABLE:\n${S.hard.map(l => `· ${l}`).join('\n')}`
    : styleLock(preset);
  return `${head}${pin}\n\nDEPICT: ${subject}${wildcards(subject, variant)}`;
};

/* ------------------------------------------------------------------ generation */
function cachePath(subject, aspect, refList, preset, colors, variant) {
  const sig = `${MODEL}|${aspect}|${promptFor(subject, refList.length, preset, colors, variant)}|${refList.map(r => r.hash).join(',')}`;
  const h = createHash('sha256').update(sig).digest('hex').slice(0, 16);
  return join(CACHE, `bg-${h}.png`);
}

/**
 * Returns an absolute path to a background PNG, or null when generation is
 * unavailable (no key / API error) so the caller can fall back to CSS.
 */
export async function background(subject, { aspect = '4:5', force = false, preset = S.default, colors = null, refPaths = null, variant = 0, solo = null, model = null, size = '512*640' } = {}) {
  if (!subject && !solo) return null;

  // Preferred path: an edit model, with the reference as the real input image.
  const editModel = model ?? (solo && refPaths?.length && process.env.WAVESPEED_API_KEY
    ? (process.env.EDIT_MODEL || 'qwen-edit') : null);
  if (editModel && refPaths?.length) {
    const text = editPrompt(solo);
    const sig = `${editModel}|${size}|${text}|${refPaths.map(p => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12)).join(',')}`;
    const out = join(CACHE, `bg-${createHash('sha256').update(sig).digest('hex').slice(0, 16)}.png`);
    if (!force && existsSync(out)) return out;
    mkdirSync(CACHE, { recursive: true });
    try {
      const buf = await MODELS[editModel].call({ prompt: text, refs: refPaths, size });
      writeFileSync(out, buf);
      return out;
    } catch (e) {
      console.warn(`  ! ${editModel} failed: ${e.message.slice(0, 140)} — falling back to ${MODEL}`);
    }
  }
  const refList = refPaths ? refPaths.map(refFile) : refs(preset, `${subject}|${variant}`);
  const text = solo ? soloPrompt(solo) : promptFor(subject, refList.length, preset, colors, variant);
  const out = solo
    ? join(CACHE, `bg-${createHash('sha256').update(`${MODEL}|${aspect}|${text}|${refList.map(r => r.hash).join(',')}`).digest('hex').slice(0, 16)}.png`)
    : cachePath(subject, aspect, refList, preset, colors, variant);
  if (!force && existsSync(out)) return out;

  const key = apiKey();
  if (!key) return null;

  mkdirSync(CACHE, { recursive: true });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{
      role: 'user',
      parts: [
        ...refList.map(r => ({ inlineData: { mimeType: r.mimeType, data: r.data } })),
        { text },
      ],
    }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } },
  };

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      const json = await res.json();
      const part = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
      if (!part) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 300)}`);
      writeFileSync(out, Buffer.from(part.inlineData.data, 'base64'));
      return out;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  console.warn(`  ! background generation failed (${subject.slice(0, 40)}…): ${lastErr.message}`);
  return null;
}

/* ------------------------------------------------------------------ diagnostics */
export function status() {
  const key = apiKey();
  if (!key) {
    return `background stage: OFF — no GEMINI_API_KEY. Add it to .env at the project root ` +
           `(see .env.example); slides fall back to CSS gradients.`;
  }
  const all = existsSync(REFS) ? readdirSync(REFS).filter(f => MIME[f.split('.').pop().toLowerCase()]).length : 0;
  const scoped = PRESETS.filter(p => existsSync(join(REFS, p)));
  const refLine = (all ? `${all} refs, ${REF_SAMPLE} sampled per image` : 'no refs')
    + (scoped.length ? ` (+scoped: ${scoped.join(', ')})` : '');
  return `background stage: ON — ${MODEL}, key ${key.slice(0, 6)}…${key.slice(-4)}, ${refLine}, `
       + `presets: ${PRESETS.join('/')} (default ${S.default})`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(status());
  if (process.argv[2]) {
    // node src/bgen.mjs <preset> <subject…>
    const first = process.argv[2];
    const preset = PRESETS.includes(first) ? first : S.default;
    const subject = process.argv.slice(PRESETS.includes(first) ? 3 : 2).join(' ');
    const p = await background(subject, { force: true, preset });
    console.log(p ? `wrote ${p}` : 'no image produced');
  }
}
