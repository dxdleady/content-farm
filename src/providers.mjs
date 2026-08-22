// Image providers. Gemini is text-to-image (a reference can only ever be a hint);
// WaveSpeed hosts image-to-image / edit models, where the reference IS the input.
import { readFileSync } from 'node:fs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

export const dataUri = (path) => {
  const ext = path.split('.').pop().toLowerCase();
  return `data:${MIME[ext] ?? 'image/jpeg'};base64,${readFileSync(path).toString('base64')}`;
};

const KEY = () => process.env.WAVESPEED_API_KEY;

/** Submit a job to a WaveSpeed model and poll until it returns an image. */
export async function wavespeed(model, input, { timeoutMs = 600000 } = {}) {
  const key = KEY();
  if (!key) throw new Error('WAVESPEED_API_KEY missing');

  const res = await fetch(`https://api.wavespeed.ai/api/v3/${model}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${model}: ${res.status} ${JSON.stringify(body).slice(0, 300)}`);

  const id = body?.data?.id;
  if (!id) throw new Error(`${model}: no job id in ${JSON.stringify(body).slice(0, 300)}`);

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await sleep(1500);
    const r = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${id}/result`, {
      headers: { authorization: `Bearer ${key}` },
    });
    const j = await r.json().catch(() => ({}));
    const d = j?.data ?? {};
    if (d.status === 'completed') {
      const url = d.outputs?.[0];
      if (!url) throw new Error(`${model}: completed with no output`);
      return Buffer.from(await (await fetch(url)).arrayBuffer());
    }
    if (d.status === 'failed') throw new Error(`${model}: ${d.error ?? 'failed'}`);
  }
  throw new Error(`${model}: timed out`);
}

/**
 * The canvas ratio a background is generated for. Models split into two camps —
 * some take a named aspect_ratio, some want explicit pixels — so every ratio the
 * formats registry can ask for is mapped to both. '4:5' is the default and keeps
 * the exact values these adapters shipped with, so Instagram output is unchanged.
 */
const SIZE = { '4:5': '512*640', '9:16': '576*1024' };          // small working size
const SIZE_HI = { '4:5': '1024*1536', '9:16': '1024*1792' };    // gpt-image-1.5
const SIZE_REDUX = { '4:5': '832*1088', '9:16': '768*1344' };
// p-image speaks in thirds/quarters, not fifths
const AR_PIMAGE = { '4:5': '3:4', '9:16': '9:16' };

/**
 * Model adapters — each maps a common call shape onto that model's own schema,
 * so callers never learn a provider's parameter names.
 *   call({ prompt, refs: [paths], ratio, size })
 */
export const MODELS = {
  'p-image': {
    price: 0.01,
    call: ({ prompt, refs, ratio = '4:5' }) => wavespeed('pruna-ai/p-image/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: AR_PIMAGE[ratio], output_format: 'png',
    }),
  },
  'flux2-flash': {
    price: 0.013,
    call: ({ prompt, refs, ratio = '4:5', size }) => wavespeed('wavespeed-ai/flux-2-flash/edit', {
      prompt, images: refs.map(dataUri), size: size ?? SIZE[ratio],
    }),
  },
  'qwen-edit': {
    price: 0.02,
    call: ({ prompt, refs, ratio = '4:5', size }) => wavespeed('wavespeed-ai/qwen-image/edit-plus', {
      prompt, images: refs.map(dataUri), size: size ?? SIZE[ratio], output_format: 'png',
    }),
  },
  'kontext': {
    price: 0.02,
    call: ({ prompt, refs, ratio = '4:5', size }) => wavespeed('wavespeed-ai/flux-kontext-dev-ultra-fast', {
      prompt, image: dataUri(refs[0]), size: size ?? SIZE[ratio], output_format: 'png',
    }),
  },
  'grok': {
    price: 0.025,
    call: ({ prompt, refs }) => wavespeed('x-ai/grok-imagine-image/edit', {
      prompt, image: dataUri(refs[0]),
    }),
  },
  'seedream4': {
    price: 0.027,
    call: ({ prompt, refs, ratio = '4:5', size }) => wavespeed('bytedance/seedream-v4/edit', {
      prompt, images: refs.map(dataUri), size: size ?? SIZE[ratio],
    }),
  },
  'nano-banana': {
    price: 0.038,
    call: ({ prompt, refs, ratio = '4:5' }) => wavespeed('google/nano-banana/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: ratio, output_format: 'png',
    }),
  },
  'gpt-image-2': {
    price: 0.07,
    call: ({ prompt, refs, ratio = '4:5' }) => wavespeed('openai/gpt-image-2/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: ratio,
      quality: 'low', resolution: '1k', output_format: 'png',
    }),
  },
  'gpt-image-1.5': {
    price: 0.10,
    call: ({ prompt, refs, ratio = '4:5', size }) => wavespeed('openai/gpt-image-1.5/edit', {
      prompt, images: refs.map(dataUri), size: size ?? SIZE_HI[ratio],
      quality: 'low', input_fidelity: 'high', output_format: 'png',
    }),
  },
  // Style-transfer rather than text-editing: the reference carries the look by
  // construction, so grime and print artefacts survive instead of being "improved".
  'uso': {
    price: 0.08,
    call: ({ prompt, refs }) => wavespeed('bytedance/uso', {
      prompt, reference_images: refs.map(dataUri),
    }),
  },
  'redux': {
    price: 0.025,
    call: ({ refs, ratio = '4:5', size }) => wavespeed('wavespeed-ai/flux-redux-dev', {
      image: dataUri(refs[0]), size: size ?? SIZE_REDUX[ratio], output_format: 'png',
    }),
  },
  // nano-banana 2 — same price as gpt-image-2 but renders at 2k
  'banana-2k': {
    price: 0.07,
    call: ({ prompt, refs, ratio = '4:5' }) => wavespeed('google/nano-banana-2/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: ratio,
      resolution: '2k', output_format: 'png',
    }),
  },
  'banana-1k': {
    price: 0.07,
    call: ({ prompt, refs, ratio = '4:5' }) => wavespeed('google/nano-banana-2/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: ratio,
      resolution: '1k', output_format: 'png',
    }),
  },
  'banana-4k': {
    price: 0.07,
    call: ({ prompt, refs, ratio = '4:5' }) => wavespeed('google/nano-banana-2/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: ratio,
      resolution: '4k', output_format: 'png',
    }),
  },
  'seedream45': {
    price: 0.04,
    call: ({ prompt, refs, ratio = '4:5', size }) => wavespeed('bytedance/seedream-v4.5/edit', {
      prompt, images: refs.map(dataUri), size: size ?? SIZE[ratio],
    }),
  },
};
