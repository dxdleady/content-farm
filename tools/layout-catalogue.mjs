// One of every layout, single ground colour, through the REAL render path (chrome + tokens).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from '../src/chrome.ts';
import { renderSlide } from '../src/layouts.ts';
import { formatFromArgv, formatCss, formatTag } from '../src/formats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FMT = formatFromArgv();
const W = FMT.w, H = FMT.h;
const G = process.env.CARD_GROUND || 'superlime';   // token accent name
const fonts = readFileSync(join(ROOT,'assets/fonts/fonts.css'),'utf8')
  .replace(/url\((woff2\/[^)]+)\)/g,(_,r)=>`url(data:font/woff2;base64,${readFileSync(join(ROOT,'assets/fonts',r)).toString('base64')})`);
const tokens = readFileSync(join(ROOT,'tokens/tokens.css'),'utf8').replace(/@import[^\n]*\n/,'');
const sheet = readFileSync(join(ROOT,'src/carousel.css'),'utf8');
const page = inner => `<!doctype html><html><head><meta charset="utf-8">
<style>${fonts}</style><style>${tokens}</style><style>${sheet}</style>
<style>${formatCss(FMT)}</style>
<style>html,body{margin:0;background:#000}</style></head><body>${inner}</body></html>`;

const F=[{title:'Voice cleanup',icon:'eraser'},{title:'Word cuts',icon:'scissors'},{title:'Adaptive music',icon:'sound'},{title:'Auto-ducking',icon:'sliders'},{title:'Chapters',icon:'file'},{title:'Cleared licence',icon:'gem'}];
const A='accent-purple';   // single ink accent, one colour catalogue
// each entry: [layout, purpose, sample]
const CAT = [
  ['heroStatement','opening claim — one big line'],
  ['statement','Claim — mid-deck assertion',{kicker:'Truth',title:'Edit the *words*, not the waveform'}],
  ['stat','Giant Number — one stat dominates',{kicker:'Time back',value:'73',unit:'%'}],
  ['statRow','Stat Row — one number, stated',{kicker:'The maths',title:'One pass replaces the *stack*',stats:[{v:'7→1',l:'tools'}]}],
  ['quote','Pull Quote — testimonial',{title:'We just *delete the sentence*.',author:'Dana Reyes',role:'Signal & Noise'}],
  ['steps','Numbered Steps — a process',{kicker:'The fix',title:'Move your best line *up*',items:['Find it in the transcript','Cut it loose','Paste it at 0:00']}],
  ['checklist','Checklist — what is included',{kicker:'Inside',title:'Cleanup you never *touch*',items:['Filler words removed','Dead air trimmed','Room hum gone','Pauses tightened']}],
  ['dontList',"Don't List — mistakes crossed out",{kicker:'Openings',title:'Six ways to *lose* them',items:['Long hellos','Mic checks','The weather','Housekeeping','So anyway…']}],
  ['tags','Tag Cloud — scannable list',{kicker:'Openings',title:'Cut *all* of this',items:['Hellos','Mic check','The weather','Housekeeping','Dead air','So anyway…','Sponsor read','Recap','Apologies']}],
  ['bento','Feature Bento — feature grid',{kicker:'Features',title:'Six tools, *one* pass',items:F,variant:'k'}],
  ['iconRow','Icon Row — glyphs with labels',{kicker:'Features',title:'Everything in *one* place',items:F}],
  ['bigQuestion','Big Question — one provocation',{kicker:'Censoring',title:'What if podcast *censoring* was automatic?'}],
  ['priceTiers','Price Tiers — plans at a glance',{kicker:'Plans',title:'Pick your *tier*',items:[{nm:'Free',ch:'100 credits',pr:'$0'},{nm:'Lite',ch:'700 credits',pr:'$9.99'},{nm:'Plus',ch:'2,750 · licence',pr:'$29.74',hi:true},{nm:'Max',ch:'unlimited · stems',pr:'$59.99'}]}],
  ['callout','Callout — a boxed rule',{kicker:'Rule',title:'Start at the *punchline*.'}],
  ['fillWord','Fill Word — one word fills the frame',{kicker:'The problem',title:'*silence*'}],
  ['timeline','Timeline — steps on a line',{kicker:'The flow',title:'Record to *export*',items:['Upload','Clean','Transcript','Chapters','Music','Export']}],
  ['symbolHero','Symbol Hero — a big glyph + line',{icon:'scissors',title:'Cut a *sentence*, not a selection',note:'Select the words in the transcript — the audio follows. No waveform surgery, no fades to redraw.'}],
  ['footnote','Footnote — line + honest fine print',{kicker:'Licensing',title:'Commercially *licensed* music',note:"Generated from Mubert's fully owned sample library. Verify plan details before publishing."}],
  ['lineChart','Line Chart — trend with gradient fill',{kicker:'Retention',title:'Where they *stay*',accent:'accent-purple',points:[24,30,28,44,52,50,72,96],left:'0:00',right:'32:00'}],
  ['splash','Splash — closing brand card',{title:'Your cold open, found for you'}],
];
// heroStatement alias -> statement with display title
CAT[0]=['statement','Hero Statement — the opening line',{kicker:'Cold open',title:'The first *30 seconds* decide the rest'}];
CAT[1]=['claim','Claim — heavy grotesk assertion',{kicker:'Truth',title:'Edit the *words*, not the waveform'}];

const OUT = join(ROOT, `out/runs/${process.env.RUN_ID||'layout-catalogue'}${formatTag(FMT)}`);
mkdirSync(join(OUT,'cards'),{recursive:true});
const ONLY = process.env.CARD || null;   // CARD=stat renders just that layout
const chrome = await Chrome.launch();
const meta=[];
try {
  const p = await chrome.newPage(W,H);
  for (let i=0;i<CAT.length;i++){
    const [layout,purpose,sample]=CAT[i];
    if (ONLY && layout!==ONLY) continue;
    const s={ layout, minimal:true, ground:G, accent:A, index:(i%8)+1, total:8, handle:'mubert.com/tools/cast', ...(sample||{}) };
    const html=page(renderSlide(s));
    const id=`${String(i+1).padStart(2,'0')}-${layout}`;
    const hp=join(OUT,'cards',`${id}.html`); writeFileSync(hp,html);
    writeFileSync(join(OUT,'cards',`${id}.png`), await chrome.shoot(p,`file://${hp}`,W,H));
    meta.push({id,layout,name:purpose.split(' — ')[0],purpose:purpose.split(' — ')[1]||purpose});
    process.stdout.write(`  ✓ ${meta.at(-1).name}\n`);
  }
  if (ONLY) { console.log('single card:', ONLY); }
  const thumb=300, cols=4, rows=Math.ceil(meta.length/cols);
  const sh=`<!doctype html><html><body style="margin:0;background:#0f0f0f;color:#eee;font:13px/1.35 -apple-system;display:grid;grid-template-columns:repeat(${cols},${thumb}px);gap:22px;padding:24px;width:max-content">
  ${meta.map(m=>`<div><img src="file://${join(OUT,'cards',m.id)}.png" style="width:${thumb}px;display:block;border-radius:6px"><div style="font-weight:700;margin:8px 0 2px">${m.name}</div><div style="opacity:.6;font-size:12px">${m.purpose}</div></div>`).join('')}
  </body></html>`;
  const shp=join(OUT,'catalogue.html'); writeFileSync(shp,sh);
  const sp=await chrome.newPage(cols*thumb+22*(cols+1), Math.round(rows*(thumb*H/W+72)+48));
  writeFileSync(join(OUT,'catalogue.png'), await chrome.shoot(sp,`file://${shp}`,cols*thumb+22*(cols+1),Math.round(rows*(thumb*H/W+72)+48)));
  writeFileSync(join(OUT,'cards.json'), JSON.stringify(meta,null,2));
} finally { chrome.kill(); }
console.log(`\n${meta.length} cards -> ${OUT}/catalogue.png`);
