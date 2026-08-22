// One full black-minimal set per content rubric (no graphics), all laid out on ONE page.
// Content is grounded in data/product.json + campaigns.json; copy avoids the voice.avoid claims.
//   RUN_ID=rubric-sets node tools/rubric-sets.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from '../src/chrome.ts';
import { renderSlide } from '../src/layouts.mjs';
import { formatFromArgv, formatCss, formatTag } from '../src/formats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FMT = formatFromArgv();
const W = FMT.w, H = FMT.h;

const fonts = readFileSync(join(ROOT, 'assets/fonts/fonts.css'), 'utf8')
  .replace(/url\((woff2\/[^)]+)\)/g, (_, r) => `url(data:font/woff2;base64,${readFileSync(join(ROOT, 'assets/fonts', r)).toString('base64')})`);
const tokens = readFileSync(join(ROOT, 'tokens/tokens.css'), 'utf8').replace(/@import[^\n]*\n/, '');
const sheet = readFileSync(join(ROOT, 'src/carousel.css'), 'utf8');
const page = inner => `<!doctype html><html><head><meta charset="utf-8">
<style>${fonts}</style><style>${tokens}</style><style>${sheet}</style><style>${formatCss(FMT)}</style>
<style>html,body{margin:0;background:#000}</style></head><body>${inner}</body></html>`;

const HANDLE = 'mubert.com/tools/cast';

// ---- the ten rubric sets (black minimalism, no bg art), 8+ slides each ----
const DECKS = [
  {
    id: 'hot-takes', name: 'Hot Takes', bucket: 'bright',
    promise: 'One opinionated line that stops the scroll. Product only at the end.',
    slides: [
      { layout: 'statement', kicker: 'Hot take', accent: 'accent-lime', title: 'Nobody stays for the *warm-up*' },
      { layout: 'stat', kicker: 'The whole audition', value: '60', unit: 'sec', accent: 'accent-carrot' },
      { layout: 'claim', kicker: 'The truth', accent: 'accent-carrot', title: 'Your *intro* is the skip button' },
      { layout: 'bigQuestion', kicker: 'So', accent: 'accent-purple', title: 'Why is it still *90 seconds* long?' },
      { layout: 'dontList', kicker: "Don't open with", accent: 'accent-carrot', title: 'The usual *five*', items: ['A slow hello', 'A mic check', 'The weather', 'Housekeeping', 'A long recap'] },
      { layout: 'tags', kicker: 'Cut all of it', items: ['Hellos', 'Mic check', 'The weather', 'Housekeeping', 'Dead air', 'Long recap', 'Sponsor pre-roll', 'Nervous laugh', 'So anyway…'] },
      { layout: 'steps', kicker: 'The fix', accent: 'accent-lime', title: 'Move your best line to *0:00*', items: ['Find it in the transcript', 'Cut it loose', 'Paste it at the very top'] },
      { layout: 'poster', kicker: 'Rule', accent: 'accent-purple', title: 'Open on the *punchline*' },
      { layout: 'bento', kicker: 'Inside Cast', accent: 'accent-pink', title: 'The tools for it', variant: 'k', items: [{ title: 'Transcript editing', icon: 'scissors' }, { title: 'Silence removal', icon: 'pause' }, { title: 'Filler removal', icon: 'eraser' }, { title: 'Chapters', icon: 'file' }] },
      { layout: 'splash', accent: 'accent-lime', title: 'Start where it gets *good*.' },
    ],
  },
  {
    id: 'inspiration', name: 'Inspiration', bucket: 'bright',
    promise: 'Motivate the creator to make and ship the thing — mindset, not features.',
    slides: [
      { layout: 'statement', theme: 'light', kicker: 'Inspiration', accent: 'accent-purple', title: 'You have something *worth saying*' },
      { layout: 'claim', theme: 'light', kicker: 'Truth', accent: 'accent-carrot', title: 'Done beats *perfect*' },
      { layout: 'bigQuestion', theme: 'light', kicker: 'So', accent: 'accent-purple', title: "What's actually *stopping* you?" },
      { layout: 'tags', theme: 'light', kicker: 'The excuses', items: ['Not a pro', 'Cheap mic', 'No studio', 'Sounds amateur', 'No time to edit', "Nobody's listening", 'Maybe next month', 'What if it flops'] },
      { layout: 'claim', theme: 'light', kicker: 'Remember', accent: 'accent-purple', title: 'Nobody starts *good*' },
      { layout: 'quote', theme: 'light', accent: 'accent-green', title: 'The best show is the one you *finish*.', author: 'Field note', role: '(cast)' },
      { layout: 'statement', theme: 'light', kicker: 'The move', accent: 'accent-carrot', title: 'Ship episode *one*' },
      { layout: 'callout', theme: 'light', kicker: 'The deal', accent: 'accent-purple', title: "Say the thing — we'll *finish* it", note: 'Production is necessary, but it was never the point. Bring the idea; the polish is handled.' },
      { layout: 'splash', theme: 'light', accent: 'accent-purple', title: 'Press *record*.' },
    ],
  },
  {
    id: 'feature-drop', name: 'Feature Drop', bucket: 'product',
    promise: 'One feature as the fix to one concrete pain — filler-word removal.',
    slides: [
      { layout: 'statement', kicker: 'The pain', accent: 'accent-carrot', title: 'Every *um* is a reason to leave' },
      { layout: 'bigQuestion', kicker: 'Count them', accent: 'accent-purple', title: 'How many *ums* in an hour of tape?' },
      { layout: 'claim', kicker: 'The truth', accent: 'accent-carrot', title: "You *can't* un-hear it" },
      { layout: 'steps', kicker: 'How it works', accent: 'accent-lime', title: 'Filler-word removal', items: ['Cast transcribes every word', 'The fillers get flagged in the text', 'Delete them — the audio follows'] },
      { layout: 'checklist', kicker: 'It catches', accent: 'accent-green', title: 'Um, uh, *like*, you know', items: ['Um, uh, er', 'Like, you know', 'So, basically, right', 'False starts and repeats'] },
      { layout: 'callout', kicker: 'One pass', accent: 'accent-lime', title: 'A whole episode, *de-ummed*', note: 'No waveform hunting — you edit the words, and the audio keeps up.' },
      { layout: 'comparison', kicker: 'Same take', accent: 'accent-lime', aTitle: 'Raw', a: ['Um, uh, like', 'Half-finished starts', 'Stop-start rhythm'], bTitle: 'Cleaned', b: ['Straight through', 'Every line lands', 'A steady pace'] },
      { layout: 'symbolHero', kicker: 'The feature', accent: 'accent-lime', icon: 'eraser', title: 'Filler-word *removal*', note: 'One tap clears every um, uh and like across the whole episode — from the transcript, not the waveform.' },
      { layout: 'bento', kicker: 'Same pass', accent: 'accent-pink', title: 'It travels with', variant: 'k', items: [{ title: 'Transcript editing', icon: 'scissors' }, { title: 'Silence removal', icon: 'pause' }, { title: 'Shorten pauses', icon: 'minus-solid' }, { title: 'Voice cleanup', icon: 'eraser' }] },
      { layout: 'splash', accent: 'accent-lime', title: 'Cut the filler, keep the *flow*.' },
    ],
  },
  {
    id: 'one-workflow', name: 'One Workflow', bucket: 'product',
    promise: 'The whole record→export pipeline in one place vs a mess of tools.',
    slides: [
      { layout: 'statement', kicker: 'Before', accent: 'accent-carrot', title: 'Seven tabs to finish *one* episode' },
      { layout: 'tags', kicker: 'The old stack', items: ['Recorder', 'DAW', 'Noise plugin', 'Transcriber', 'Leveler', 'Music library', 'Licensing', 'Chapter tool'] },
      { layout: 'statRow', kicker: 'The maths', accent: 'accent-lime', title: 'One pass replaces the *stack*', stats: [{ v: '7→1', l: 'tools' }] },
      { layout: 'claim', kicker: 'The idea', accent: 'accent-carrot', title: 'One place, or *no* place' },
      { layout: 'bento', kicker: 'In Cast', accent: 'accent-lime', title: 'One pass, six *moves*', variant: 'k', items: [{ title: 'Upload', icon: 'upload' }, { title: 'Clean the voice', icon: 'eraser' }, { title: 'Edit transcript', icon: 'scissors' }, { title: 'Structure', icon: 'file' }, { title: 'Add music', icon: 'music' }, { title: 'Export', icon: 'link' }] },
      { layout: 'timeline', kicker: 'Record to export', accent: 'accent-lime', title: 'The whole line', items: ['Upload', 'Clean', 'Transcript', 'Structure', 'Music', 'Export'] },
      { layout: 'claim', kicker: 'After', accent: 'accent-lime', title: 'Record to *export*, one place' },
      { layout: 'callout', kicker: 'No round-trips', accent: 'accent-purple', title: 'No exporting *between* tools', note: 'One project from raw file to publish-ready — no re-imports, no version chaos.' },
      { layout: 'splash', accent: 'accent-lime', title: 'The whole show, *end to end*.' },
    ],
  },
  {
    id: 'plan-picker', name: 'Plan Picker', bucket: 'product',
    promise: 'Which plan fits which creator — Free/Lite/Plus/Max, no hype.',
    slides: [
      { layout: 'bigQuestion', kicker: 'Which one', accent: 'accent-purple', title: 'Which plan fits *your* show?' },
      { layout: 'statement', kicker: 'Honest start', accent: 'accent-lime', title: 'Start where you *are*' },
      { layout: 'priceTiers', kicker: 'Plans', accent: 'accent-purple', title: 'Free to *Max*', items: [{ nm: 'Free', ch: '100 cr · 60 min', pr: '$0' }, { nm: 'Lite', ch: '700 cr · 10 h', pr: '$9.99' }, { nm: 'Plus', ch: '2,750 cr · licence', pr: '$29.74', hi: true }, { nm: 'Max', ch: 'unlimited · stems', pr: '$59.99' }] },
      { layout: 'checklist', kicker: 'Where it steps up', accent: 'accent-green', title: 'Licence lands on *Plus*', items: ['Commercial music licence from Plus', 'Lossless export from Plus', 'Stems on Max', 'Unlimited uploads on Max'] },
      { layout: 'comparison', kicker: 'The jump', accent: 'accent-purple', aTitle: 'Lite · $9.99', a: ['700 credits', '10 h / mo', 'HQ MP3'], bTitle: 'Plus · $29.74', b: ['2,750 credits', '25 h / mo', 'Lossless + licence'] },
      { layout: 'definition', kicker: 'One word', accent: 'accent-carrot', term: 'Credit', body: 'Mostly for *generated* music and SFX — not ordinary editing.' },
      { layout: 'callout', kicker: 'The line', accent: 'accent-lime', title: 'Most creators land on *Plus*', note: 'Commercial music licence and lossless export both start there.' },
      { layout: 'footnote', kicker: 'Small print', accent: 'accent-carrot', title: 'Prices *move*', note: 'Check the live pricing page before you publish any price or offer — plans and credits can change.' },
      { layout: 'splash', accent: 'accent-lime', title: 'Start on *Free*. Move up when it pays.' },
    ],
  },
  {
    id: 'how-to', name: 'How-To', bucket: 'guide',
    promise: 'A concrete method a creator can act on today — scoring music.',
    slides: [
      { layout: 'statement', kicker: 'Problem', accent: 'accent-carrot', title: 'Music that *buries* the voice' },
      { layout: 'bigQuestion', kicker: 'First', accent: 'accent-purple', title: 'Where should the music even *be*?' },
      { layout: 'claim', kicker: 'Principle', accent: 'accent-lime', title: 'Score the *silences*' },
      { layout: 'steps', kicker: 'The method', accent: 'accent-lime', title: 'Score it in *three* moves', items: ['Pick one track — it adapts to length', 'Duck it under the voice automatically', 'Keep it only where it earns the room'] },
      { layout: 'callout', kicker: 'Rule', accent: 'accent-purple', title: 'Music sets the *floor*, not the ceiling', note: 'If you hear the music before the words, it is too loud.' },
      { layout: 'dontList', kicker: "Don't", accent: 'accent-carrot', title: 'Four ways to *wreck* it', items: ['Loop one bed for the whole hour', 'Fade in on every single line', "Use a track you can't license", 'Let it fight the voice'] },
      { layout: 'iconRow', kicker: 'In Cast', accent: 'accent-lime', title: 'What does the *work*', items: [{ title: 'Adaptive music', icon: 'music' }, { title: 'Auto-ducking', icon: 'sliders' }, { title: 'Royalty-free', icon: 'gem' }] },
      { layout: 'checklist', kicker: 'Before you export', accent: 'accent-green', title: 'The music *check*', items: ['One track, reshaped to length', 'Ducked under every line', 'Only where it earns the room', 'Licence sorted before export'] },
      { layout: 'splash', accent: 'accent-lime', title: 'Scored, not *soundtracked*.' },
    ],
  },
  {
    id: 'mistakes', name: 'Mistakes', bucket: 'guide',
    promise: 'Things creators get wrong, named fast — the tag wall is the payload.',
    slides: [
      { layout: 'statement', kicker: 'Verdict', accent: 'accent-lime', title: 'It is not talent. It is *ten habits*' },
      { layout: 'stat', kicker: 'Fixable in', value: '1', unit: 'pass', accent: 'accent-carrot' },
      { layout: 'claim', kicker: 'The truth', accent: 'accent-carrot', title: 'Amateur is a *checklist*' },
      { layout: 'tags', kicker: 'The tells', items: ['Long intro', 'No structure', 'Room echo', 'Uneven levels', 'Filler everywhere', 'Dead air', 'Music too loud', 'No chapters', 'Mouth clicks', 'Abrupt ending'] },
      { layout: 'dontList', kicker: 'The worst four', accent: 'accent-carrot', title: 'Fix these *first*', items: ['A three-minute intro', 'No chapters at all', 'Music louder than you', 'Ending mid-sentence'] },
      { layout: 'steps', kicker: 'The fix', accent: 'accent-lime', title: 'Work the list, *top down*', items: ['Clean the voice', 'Cut filler and dead air', 'Level to one target', 'Add chapters'] },
      { layout: 'comparison', kicker: 'The gap', accent: 'accent-purple', aTitle: 'Reads amateur', a: ['Echoey room', 'Rambling', 'Levels jumping'], bTitle: 'Reads pro', b: ['Dry and close', 'Tight and paced', 'One steady level'] },
      { layout: 'callout', kicker: 'Order', accent: 'accent-lime', title: 'Fix the *room*, then the *file*', note: "You can't clean up what the room already ruined — record better, then edit." },
      { layout: 'splash', accent: 'accent-lime', title: 'Sound *finished*, not fancy.' },
    ],
  },
  {
    id: 'myth-vs-fact', name: 'Myth vs Fact', bucket: 'guide',
    promise: 'Kill beliefs with facts, leaning on real product boundaries.',
    slides: [
      { layout: 'bigQuestion', kicker: 'Three myths', accent: 'accent-purple', title: 'What keeps a show sounding *amateur*' },
      { layout: 'statement', kicker: 'Myth', accent: 'accent-carrot', title: 'A better *mic* fixes it' },
      { layout: 'claim', kicker: 'Fact', accent: 'accent-lime', title: 'You hear the *room*, not the mic' },
      { layout: 'statement', kicker: 'Myth', accent: 'accent-carrot', title: '“Royalty-free” means you are *covered*' },
      { layout: 'claim', kicker: 'Fact', accent: 'accent-lime', title: 'Rights follow the *source*' },
      { layout: 'callout', kicker: 'Why', accent: 'accent-purple', title: 'Uploaded tracks carry *their own* rights', note: "Cast's music uses samples Mubert fully owns, with commercial licensing on eligible plans. Music you upload yourself does not." },
      { layout: 'statement', kicker: 'Myth', accent: 'accent-carrot', title: 'Just fix it *in post*' },
      { layout: 'claim', kicker: 'Fact', accent: 'accent-lime', title: "Post can't fix a bad *take*" },
      { layout: 'iconRow', kicker: 'What helps', accent: 'accent-lime', title: 'Where Cast *actually* helps', items: [{ title: 'Voice cleanup', icon: 'eraser' }, { title: 'Generative music', icon: 'music' }, { title: 'Commercial licence', icon: 'gem' }] },
      { layout: 'splash', accent: 'accent-lime', title: 'Cleared on eligible *plans*.' },
    ],
  },
  {
    id: 'before-after', name: 'Before / After', bucket: 'product',
    promise: 'Raw recording vs finished episode — two states, hard contrast.',
    slides: [
      { layout: 'statement', kicker: 'Before', accent: 'accent-carrot', title: 'The raw file nobody should *hear*' },
      { layout: 'checklist', kicker: 'The pass', accent: 'accent-green', title: 'Gone in one *pass*', items: ['Um, uh, like — removed', 'Dead air — trimmed', 'Room hum — cleaned', 'Levels — evened out'] },
      { layout: 'beforeAfter', kicker: 'Voice', accent: 'accent-lime', before: 'Boxy, hum, plosives', after: 'Clean, close, present' },
      { layout: 'beforeAfter', kicker: 'Length', accent: 'accent-lime', before: '45 minutes of raw talk', after: '22 minutes, tight' },
      { layout: 'beforeAfter', kicker: 'Sound', accent: 'accent-lime', before: 'Silent gaps, no music', after: 'Scored, ducked, level' },
      { layout: 'claim', kicker: 'Same take', accent: 'accent-carrot', title: 'Same voice. *Finished*.' },
      { layout: 'stat', kicker: 'All of it in', value: '1', unit: 'pass', accent: 'accent-lime' },
      { layout: 'callout', kicker: 'How', accent: 'accent-purple', title: 'You edit the *words* — audio follows', note: 'Transcript-based editing, not waveform surgery. Change the text, the audio changes with it.' },
      { layout: 'splash', accent: 'accent-lime', title: 'Raw in, *ready* out.' },
    ],
  },
  {
    id: 'unnecessary-censorship', name: 'Unnecessary Censorship', bucket: 'bright',
    promise: 'Comedy — bleep ordinary words for effect, powered by custom censoring.',
    slides: [
      { layout: 'statement', kicker: 'New format', accent: 'accent-lime', title: 'Bleep the *boring* parts' },
      { layout: 'bigQuestion', kicker: 'What if', accent: 'accent-purple', title: 'You could bleep *anything*?' },
      { layout: 'statement', kicker: 'The bit', accent: 'accent-pink', title: 'Bleep the word ‘*algorithm*’. Every time.' },
      { layout: 'statement', kicker: 'The bit', accent: 'accent-pink', title: "Bleep your co-host's *name*. All episode." },
      { layout: 'tags', kicker: 'Bleep-worthy', items: ['Buzzwords', 'Hot takes', 'Spoilers', 'The boss', '“Synergy”', 'Ad reads', 'Your ex', 'Mondays'] },
      { layout: 'callout', kicker: 'Yes, really', accent: 'accent-lime', title: 'Custom censoring — any *word* you pick', note: 'Auto-detect profanity, or add your own words and names. Replace it with a beep — or any sound.' },
      { layout: 'checklist', kicker: 'How it works', accent: 'accent-green', title: 'Four taps', items: ['Auto-detect profanity', 'Add your own words and names', 'See them flagged in the transcript', 'Swap for a beep or any sound'] },
      { layout: 'claim', kicker: 'The joke', accent: 'accent-carrot', title: 'Comedy is *precise* censoring' },
      { layout: 'splash', accent: 'accent-pink', title: 'Bleep it like you *mean* it.' },
    ],
  },
];

const BUCKET_COLOR = { bright: '#E8FF59', product: '#7B8CFF', guide: '#6EE7A8' };

const OUT = join(ROOT, `out/runs/${process.env.RUN_ID || 'rubric-sets'}${formatTag(FMT)}`);
mkdirSync(join(OUT, 'cards'), { recursive: true });

const chrome = await Chrome.launch();
try {
  const p = await chrome.newPage(W, H);
  const blocks = [];
  for (const deck of DECKS) {
    const total = deck.slides.length;
    const thumbs = [];
    for (let i = 0; i < deck.slides.length; i++) {
      const s = { minimal: true, handle: HANDLE, ...deck.slides[i], index: i + 1, total };
      // Whole deck runs light — cream ground reads far better at a glance than black-on-black.
      s.theme = 'light';
      // superlime vanishes on cream; promote it to a readable accent.
      if (s.accent === 'accent-lime') s.accent = 'accent-purple';
      const id = `${deck.id}-${String(i + 1).padStart(2, '0')}-${s.layout}`;
      const hp = join(OUT, 'cards', `${id}.html`);
      writeFileSync(hp, page(renderSlide(s)));
      const pngPath = join(OUT, 'cards', `${id}.png`);
      writeFileSync(pngPath, await chrome.shoot(p, `file://${hp}`, W, H));
      thumbs.push(pngPath);
    }
    blocks.push({ deck, thumbs });
    process.stdout.write(`  ✓ ${deck.name} (${total})\n`);
  }
  await chrome.close(p);

  // ---- compose everything onto ONE page ----
  const THUMB = 196, GAP = 10, PAD = 44, HEADER = 78, BLOCKGAP = 30;
  const thumbH = Math.round(THUMB * H / W);
  const maxN = Math.max(...blocks.map(b => b.thumbs.length));
  const pageW = PAD * 2 + maxN * THUMB + (maxN - 1) * GAP;
  const TITLE = 96; // h1 + subtitle block above the rows
  const pageH = PAD * 2 + TITLE
    + blocks.length * (HEADER + thumbH) + (blocks.length - 1) * BLOCKGAP + 40;

  const block = ({ deck, thumbs }) => `
    <div class="blk">
      <div class="hd">
        <span class="n">${String(DECKS.indexOf(deck) + 1).padStart(2, '0')}</span>
        <span class="nm">${deck.name}</span>
        <span class="bk" style="--b:${BUCKET_COLOR[deck.bucket]}">${deck.bucket}</span>
        <span class="ct">${thumbs.length} slides</span>
        <span class="pr">${deck.promise}</span>
      </div>
      <div class="row">${thumbs.map(t => `<img src="file://${t}">`).join('')}</div>
    </div>`;

  const sheetHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#cfccc6;color:#1a1a1a;font-family:Inter,-apple-system,sans-serif;padding:${PAD}px;width:${pageW}px}
      h1{font:700 40px/1 Inter;letter-spacing:-1.5px;margin-bottom:6px}
      .sub{font:400 20px/1.4 Inter;color:#6a675f;margin-bottom:30px}
      .blk{margin-bottom:${BLOCKGAP}px}
      .hd{display:flex;align-items:baseline;gap:14px;height:${HEADER}px;padding-bottom:14px}
      .n{font:700 30px/1 Inter;color:#a7a49d;letter-spacing:-1px}
      .nm{font:700 30px/1 Inter;letter-spacing:-1px}
      .bk{font:700 14px/1 Inter;letter-spacing:2px;text-transform:uppercase;color:#1a1a1a;background:var(--b);padding:7px 12px;border-radius:20px}
      .ct{font:600 15px/1 Inter;color:#8a877f;letter-spacing:.5px}
      .pr{font:400 19px/1.35 Inter;color:#575651;margin-left:6px;max-width:${pageW - 520}px}
      .row{display:flex;gap:${GAP}px}
      .row img{width:${THUMB}px;height:${thumbH}px;display:block;border-radius:8px;background:#EEEBEA;border:1px solid rgba(0,0,0,.08)}
    </style></head><body>
      <h1>(cast) — content rubrics · light theme</h1>
      <div class="sub">One full set per rubric · ${DECKS.reduce((t, d) => t + d.slides.length, 0)} slides · grounded in product.json / campaigns.json</div>
      ${blocks.map(block).join('')}
    </body></html>`;
  const shp = join(OUT, 'rubric-sets.html');
  writeFileSync(shp, sheetHtml);
  const sp = await chrome.newPage(pageW, pageH);
  writeFileSync(join(OUT, 'rubric-sets.png'), await chrome.shoot(sp, `file://${shp}`, pageW, pageH));
  console.log(`\nONE PAGE -> ${OUT}/rubric-sets.png  (${pageW}x${pageH})  ${DECKS.reduce((t, d) => t + d.slides.length, 0)} slides`);
} finally { chrome.kill(); }
