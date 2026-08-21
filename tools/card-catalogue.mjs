// Render every card type once, single colour, labelled with name + purpose.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from '../src/chrome.mjs';
import { CARDS, CARD_IDS } from '../src/cards.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W=1080, H=1350;
const GROUND = process.env.CARD_GROUND || '#EEFF04';   // one colour for the whole catalogue
const INK = process.env.CARD_INK || '#0A0A0A';

const fonts = readFileSync(join(ROOT,'assets/fonts/fonts.css'),'utf8')
  .replace(/url\((woff2\/[^)]+)\)/g,(_,r)=>`url(data:font/woff2;base64,${readFileSync(join(ROOT,'assets/fonts',r)).toString('base64')})`);
const tokens = readFileSync(join(ROOT,'tokens/tokens.css'),'utf8').replace(/@import[^\n]*\n/,'');
const cardsCss = readFileSync(join(ROOT,'src/cards.css'),'utf8');
const page = inner => `<!doctype html><html><head><meta charset="utf-8">
<style>${fonts}</style><style>${tokens}</style><style>${cardsCss}</style>
<style>:root{--g:${GROUND};--ink:${INK}}html,body{margin:0}</style></head>
<body><div class="card">${inner}</div></body></html>`;

const F = [
  {title:'Voice cleanup',icon:'eraser'},{title:'Word cuts',icon:'scissors'},
  {title:'Adaptive music',icon:'sound'},{title:'Auto-ducking',icon:'sliders'},
  {title:'Chapters',icon:'file'},{title:'Cleared licence',icon:'gem'}];

// one realistic sample per card, all drawn from Cast facts
const SAMPLE = {
  heroStatement:{kicker:'Cold open',title:'The first *30 seconds* decide the rest'},
  claim:{kicker:'Truth',title:'Edit the *words*, not the waveform'},
  giantNumber:{kicker:'Time back',value:'73',unit:'%'},
  statRow:{stats:[{v:'7→1',l:'tools replaced'},{v:'0',l:'DAWs needed'},{v:'6',l:'steps to export'}]},
  pullQuote:{title:'We just *delete the sentence*.',author:'Dana Reyes',role:'Host, Signal & Noise'},
  numberedSteps:{kicker:'The fix',title:'Move your best line *up*',items:['Find it in the transcript','Cut it loose','Paste it at 0:00']},
  checklist:{kicker:'Inside',title:'Cleanup you never *touch*',items:['Filler words removed','Dead air trimmed','Room hum gone','Pauses tightened']},
  dontList:{kicker:'Openings die of',title:'Six ways to *lose* them',items:['Long hellos','Mic checks','The weather','Housekeeping','So anyway…']},
  tagCloud:{kicker:'Openings',title:'Cut *all* of this',items:['Hellos','Mic check','The weather','Housekeeping','Dead air','So anyway…','Sponsor read','Nervous laugh','Recap','Apologies']},
  featureBento:{kicker:'The box',title:'Six tools, *one* pass',items:F},
  bigQuestion:{title:'What if podcast *censoring* was automatic?'},
  comparison:{kicker:'Before / after',aTitle:'The old way',bTitle:'In Cast',a:['Open a DAW','Hunt the waveform','Place every bleep','Re-listen'],b:['Open the transcript','Flag the words','Censor in one click','Export']},
  beforeAfter:{kicker:'One pass',before:'Um, uh, like, dead air, room hum',after:'Clean, tight, ready to publish'},
  definition:{term:'cold open',ipa:'/koʊld ˈoʊpən/',body:'The first line of the episode — the one that earns the next thirty minutes.'},
  index:{kicker:'This week',title:'On the *feed*',items:[{t:'The 30-second rule',m:'01'},{t:'Why titles fail',m:'02'},{t:'Fix the room',m:'03'},{t:'Score the cut',m:'04'}]},
  priceTiers:{kicker:'Plans',title:'Pick your *tier*',items:[{nm:'Free',ch:'100 credits',pr:'$0'},{nm:'Lite',ch:'700 credits',pr:'$9.99'},{nm:'Plus',ch:'2,750 · licence',pr:'$29.74',hi:true},{nm:'Max',ch:'unlimited · stems',pr:'$59.99'}]},
  iconRow:{kicker:'Capabilities',title:'Everything in *one* place',items:F},
  callout:{kicker:'Rule',title:'Start at the *punchline*.'},
  meter:{kicker:'Drop-off',title:'Where listeners *leave*',left:'0:00',right:'0:30',pct:73},
  fillWord:{kicker:'The problem',title:'*silence*'},
  lowerThird:{kicker:'Now playing',title:'Score it like a *show*'},
  splitDiagonal:{kicker:'Hot take',title:'Nobody stays for the *warm-up*'},
  timeline:{kicker:'The flow',title:'Record to *export*',items:['Upload','Clean','Transcript','Chapters','Music','Export']},
  symbolHero:{icon:'scissors',title:'Cut a *sentence*, not a selection'},
  footnote:{kicker:'Licensing',title:'Commercially *licensed* music',note:'Music generated from Mubert\'s fully owned sample library. Verify plan details before publishing.'},
  splash:{title:'Your cold open, found for you'},
};

const OUT = join(ROOT, `out/runs/${process.env.RUN_ID||'card-catalogue'}`);
mkdirSync(join(OUT,'cards'),{recursive:true});

const chrome = await Chrome.launch();
const meta = [];
try {
  const p = await chrome.newPage(W,H);
  for (const id of CARD_IDS) {
    const html = page(CARDS[id].render(SAMPLE[id]||{}));
    const htmlPath = join(OUT,'cards',`${id}.html`);
    writeFileSync(htmlPath, html);
    writeFileSync(join(OUT,'cards',`${id}.png`), await chrome.shoot(p,`file://${htmlPath}`,W,H));
    meta.push({ id, name:CARDS[id].name, purpose:CARDS[id].purpose });
    process.stdout.write(`  ✓ ${CARDS[id].name}\n`);
  }
  // labelled catalogue sheet
  const thumb=300;
  const sheet = `<!doctype html><html><body style="margin:0;background:#0f0f0f;color:#eee;font:13px/1.35 -apple-system;display:grid;grid-template-columns:repeat(4,${thumb}px);gap:22px;padding:24px;width:max-content">
  ${meta.map(m=>`<div><img src="file://${join(OUT,'cards',m.id)}.png" style="width:${thumb}px;display:block;border-radius:6px"><div style="font-weight:700;margin:8px 0 2px">${m.name}</div><div style="opacity:.6;font-size:12px">${m.purpose}</div></div>`).join('')}
  </body></html>`;
  const sp = join(OUT,'catalogue.html'); writeFileSync(sp, sheet);
  const cols=4, rows=Math.ceil(meta.length/cols);
  const sw=cols*thumb+22*(cols+1), sh=rows*(thumb*H/W+72)+48;
  const spage = await chrome.newPage(sw, Math.round(sh));
  writeFileSync(join(OUT,'catalogue.png'), await chrome.shoot(spage,`file://${sp}`,sw,Math.round(sh)));
  writeFileSync(join(OUT,'cards.json'), JSON.stringify(meta,null,2));
} finally { chrome.kill(); }
console.log(`\n${meta.length} cards -> ${OUT}/catalogue.png`);
