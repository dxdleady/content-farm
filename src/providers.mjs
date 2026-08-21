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
 * Model adapters — each maps a common call shape onto that model's own schema,
 * so callers never learn a provider's parameter names.
 *   call({ prompt, refs: [paths], size })
 */
export const MODELS = {
  'p-image': {
    price: 0.01,
    call: ({ prompt, refs }) => wavespeed('pruna-ai/p-image/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: '3:4', output_format: 'png',
    }),
  },
  'flux2-flash': {
    price: 0.013,
    call: ({ prompt, refs, size = '512*640' }) => wavespeed('wavespeed-ai/flux-2-flash/edit', {
      prompt, images: refs.map(dataUri), size,
    }),
  },
  'qwen-edit': {
    price: 0.02,
    call: ({ prompt, refs, size = '512*640' }) => wavespeed('wavespeed-ai/qwen-image/edit-plus', {
      prompt, images: refs.map(dataUri), size, output_format: 'png',
    }),
  },
  'kontext': {
    price: 0.02,
    call: ({ prompt, refs, size = '512*640' }) => wavespeed('wavespeed-ai/flux-kontext-dev-ultra-fast', {
      prompt, image: dataUri(refs[0]), size, output_format: 'png',
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
    call: ({ prompt, refs, size = '512*640' }) => wavespeed('bytedance/seedream-v4/edit', {
      prompt, images: refs.map(dataUri), size,
    }),
  },
  'nano-banana': {
    price: 0.038,
    call: ({ prompt, refs }) => wavespeed('google/nano-banana/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: '4:5', output_format: 'png',
    }),
  },
  'gpt-image-2': {
    price: 0.07,
    call: ({ prompt, refs }) => wavespeed('openai/gpt-image-2/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: '4:5',
      quality: 'low', resolution: '1k', output_format: 'png',
    }),
  },
  'gpt-image-1.5': {
    price: 0.10,
    call: ({ prompt, refs }) => wavespeed('openai/gpt-image-1.5/edit', {
      prompt, images: refs.map(dataUri), size: '1024*1536',
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
    call: ({ refs, size = '832*1088' }) => wavespeed('wavespeed-ai/flux-redux-dev', {
      image: dataUri(refs[0]), size, output_format: 'png',
    }),
  },
  // nano-banana 2 — same price as gpt-image-2 but renders at 2k
  'banana-2k': {
    price: 0.07,
    call: ({ prompt, refs }) => wavespeed('google/nano-banana-2/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: '4:5',
      resolution: '2k', output_format: 'png',
    }),
  },
  'banana-1k': {
    price: 0.07,
    call: ({ prompt, refs }) => wavespeed('google/nano-banana-2/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: '4:5',
      resolution: '1k', output_format: 'png',
    }),
  },
  'banana-4k': {
    price: 0.07,
    call: ({ prompt, refs }) => wavespeed('google/nano-banana-2/edit', {
      prompt, images: refs.map(dataUri), aspect_ratio: '4:5',
      resolution: '4k', output_format: 'png',
    }),
  },
  'seedream45': {
    price: 0.04,
    call: ({ prompt, refs, size = '512*640' }) => wavespeed('bytedance/seedream-v4.5/edit', {
      prompt, images: refs.map(dataUri), size,
    }),
  },
};
