// bot_claude.js — @ErrataEternal
//
//   node bot_claude.js              generate + post one tweet
//   DRY_RUN=1 node bot_claude.js    generate, log, save to history, don't post
//   node bot_claude.js --preview 8  generate 8 in a row, print them + their dice, touch nothing
//
// How variety works now: instead of keyword-guessing what the last tweet was
// about and telling the model what NOT to do, the code rolls a concrete brief
// (form × device × setting × motifs × register × length), avoiding recently
// used values. The model writes 3 candidates for that brief and picks one;
// the code then rejects anything too long or too similar to history.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { FORMS, DEVICES, SETTINGS, MOTIFS, REGISTERS, LENGTHS } from './dice.js';

// ---------- env ----------
const {
  CLAUDE_API_KEY,
  CLAUDE_MODEL = 'claude-opus-5-5',
  TEMPERATURE, // optional; omitted from the request unless set
  TWITTER_API_KEY_CLAUDE,
  TWITTER_API_SECRET_CLAUDE,
  TWITTER_ACCESS_TOKEN_CLAUDE,
  TWITTER_ACCESS_SECRET_CLAUDE,
  DRY_RUN: DRY_RUN_ENV,
} = process.env;

// ---------- settings ----------
const MAX_LEN = 270;          // twitter-weighted; hard 280, keep a little slack
const MIN_LEN = 40;
const HISTORY_SIZE = 500;     // kept on disk for dedupe + lore callbacks
const SHOW_RECENT = 8;        // how many recent tweets the model sees
const CALLBACK_CHANCE = 0.12; // chance to reference earlier invented lore
const MAX_ATTEMPTS = 3;

// how far back each dimension is blocked from repeating
const AVOID = { form: 6, device: 4, setting: 50, motif: 40, register: 1, length: 1 };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, 'tweet_history.json');
const PROMPT_FILE = path.join(__dirname, 'prompts', 'claude_en.txt');

// ---------- history ----------
export function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch (e) {
    console.warn('[warn] could not load history:', e.message);
  }
  return [];
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-HISTORY_SIZE), null, 2), 'utf8');
}

// ---------- text utils ----------
// Twitter's weighted length: most Latin/punctuation = 1, CJK/emoji/etc = 2.
export function tweetLength(s) {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    const light = c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247);
    n += light ? 1 : 2;
  }
  return n;
}

// Light cleanup only. The old normalize() stripped %, -, ", ?, (, ) etc,
// which is why tweets said "Battery at 23" and "postsurgery".
export function clean(s) {
  return (s || '')
    .replace(/^["“]|["”]$/g, '')      // stray wrapping quotes
    .replace(/[*_`#]/g, '')            // markdown / hashtags
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const tokens = s => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const bigrams = s => { const t = tokens(s); return new Set(t.slice(1).map((w, i) => t[i] + ' ' + w)); };
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
const numbersIn = s => (s.match(/\d[\d,]*\d|\d/g) || []).map(n => n.replace(/,/g, '')).filter(n => n.length >= 2);
const opener = s => tokens(s).slice(0, 2).join(' ');

// returns null if OK, otherwise a reason string
export function rejectReason(text, history) {
  const len = tweetLength(text);
  if (len > MAX_LEN) return `too long (${len})`;
  if (len < MIN_LEN) return `too short (${len})`;
  const recent = history.slice(-100);
  const bg = bigrams(text);
  for (const h of recent) {
    const sim = jaccard(bg, bigrams(h.text));
    if (sim > 0.22) return `too similar (${sim.toFixed(2)}) to: ${h.text.slice(0, 60)}…`;
  }
  const op = opener(text);
  if (recent.slice(-8).some(h => opener(h.text) === op)) return `reused opener "${op}"`;
  const used = new Set(recent.slice(-15).flatMap(h => numbersIn(h.text)));
  const clash = numbersIn(text).filter(n => used.has(n) && n.length >= 3);
  if (clash.length) return `reused number(s) ${clash.join(', ')}`;
  return null;
}

// ---------- dice ----------
function weightedPick(items, exclude = new Set(), key = x => x.id ?? x) {
  let pool = items.filter(x => !exclude.has(key(x)));
  if (!pool.length) pool = items;
  const total = pool.reduce((s, x) => s + (x.w ?? 1), 0);
  let r = Math.random() * total;
  for (const x of pool) { r -= x.w ?? 1; if (r <= 0) return x; }
  return pool[pool.length - 1];
}

const recentValues = (history, field, n) =>
  new Set(history.slice(-n).flatMap(h => {
    const v = h.dice?.[field];
    return Array.isArray(v) ? v : v ? [v] : [];
  }));

export function rollDice(history) {
  const form = weightedPick(FORMS, recentValues(history, 'form', AVOID.form));
  const device = weightedPick(DEVICES, recentValues(history, 'device', AVOID.device));

  let setting = null;
  if (form.setting === 'required' || (form.setting === 'optional' && Math.random() < 0.6)) {
    setting = weightedPick(SETTINGS, recentValues(history, 'setting', AVOID.setting));
  }

  const usedMotifs = recentValues(history, 'motifs', AVOID.motif);
  const m1 = weightedPick(MOTIFS, usedMotifs);
  const motifs = [m1, weightedPick(MOTIFS, new Set([...usedMotifs, m1]))];

  const register = weightedPick(REGISTERS, recentValues(history, 'register', AVOID.register));
  const length = weightedPick(LENGTHS, recentValues(history, 'length', AVOID.length));

  // lore callback: reuse something the archive coined a while ago
  let callback = null;
  const lore = history.slice(0, -15).filter(h => h.coined);
  if (lore.length && Math.random() < CALLBACK_CHANCE) {
    const h = lore[Math.floor(Math.random() * lore.length)];
    callback = { name: h.coined, source: h.text };
  }

  return { form, device, setting, motifs, register, length, callback };
}

// ---------- prompt ----------
let SYSTEM = 'You write one tweet of invented history.';
try { SYSTEM = fs.readFileSync(PROMPT_FILE, 'utf8'); }
catch { console.warn(`[warn] couldn't read ${PROMPT_FILE}; using fallback`); }

export function buildBrief(d, history) {
  const lines = [
    'Publish the next entry. Brief:',
    '',
    `FORM — ${d.form.text}`,
    `DEVICE — ${d.device.text}`,
    d.setting
      ? `SETTING — ${d.setting}. A starting point: shift a few decades or miles if it makes the entry better.`
      : 'SETTING — none assigned; place and time are your call, or leave them out.',
    `MOTIFS — ${d.motifs.join(' / ')}. Build on at least one, ideally as the hinge of the joke. Using both is optional.`,
    `REGISTER — ${d.register.text}.`,
    `LENGTH — ${d.length.text}`,
  ];
  if (d.callback) {
    lines.push(`CALLBACK — glancingly mention "${d.callback.name}", which the archive published earlier ("${d.callback.source}"). Don't explain it; regular readers will recognise it.`);
  }

  const recent = history.slice(-SHOW_RECENT).map(h => h.text);
  if (recent.length) {
    lines.push('', 'RECENTLY PUBLISHED (for contrast only; do not echo their nouns, numbers, openings, shapes, or punchlines):');
    recent.forEach(t => lines.push(`- ${t.replace(/\n/g, ' / ')}`));
  }
  const nums = [...new Set(history.slice(-15).flatMap(h => numbersIn(h.text)).filter(n => n.length >= 3))];
  if (nums.length) lines.push('', `NUMBERS USED RECENTLY (don't reuse): ${nums.join(', ')}`);

  lines.push(
    '',
    'Write 3 candidates that take genuinely different angles on this brief (different hinge, different punchline, not three phrasings of one idea). Then pick the one a well-read stranger would most want to screenshot.',
    'Reply with JSON only, no prose, no code fences:',
    '{"candidates":[{"text":"...","coined":"proper name of a new event/office/institution you invented, or null"},{...},{...}],"pick":0}',
  );
  return lines.join('\n');
}

// ---------- claude ----------
const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

export function parseCandidates(raw) {
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no JSON in response');
  const obj = JSON.parse(raw.slice(a, b + 1));
  const cands = (obj.candidates || [])
    .map(c => ({ text: clean(typeof c === 'string' ? c : c.text), coined: c?.coined || null }))
    .filter(c => c.text);
  const pick = Number.isInteger(obj.pick) && cands[obj.pick] ? obj.pick : 0;
  // model's pick first, then the rest as fallbacks
  return [cands[pick], ...cands.filter((_, i) => i !== pick)].filter(Boolean);
}

async function askClaude(brief) {
  const req = {
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    system: SYSTEM,
    messages: [{ role: 'user', content: brief }],
  };
  if (TEMPERATURE) req.temperature = Number(TEMPERATURE);
  const msg = await anthropic.messages.create(req);
  return msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

export async function generateTweet(history) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const dice = rollDice(history);
    const brief = buildBrief(dice, history);
    let cands;
    try {
      cands = parseCandidates(await askClaude(brief));
    } catch (e) {
      console.warn(`[attempt ${attempt}] bad response: ${e.message}`);
      continue;
    }
    for (const c of cands) {
      const why = rejectReason(c.text, history);
      if (!why) return { ...c, dice, alternates: cands.filter(x => x !== c).map(x => x.text) };
      console.log(`[reject] ${why}\n         ${c.text.replace(/\n/g, ' / ')}`);
    }
  }
  return null; // better to skip a slot than post a truncated or repeated tweet
}

const diceSummary = d => ({
  form: d.form.id,
  device: d.device.id,
  setting: d.setting,
  motifs: d.motifs,
  register: d.register.id,
  length: d.length.id,
  callback: d.callback?.name || null,
});

// ---------- main ----------
async function main() {
  if (!CLAUDE_API_KEY) throw new Error('missing CLAUDE_API_KEY');

  const previewIdx = process.argv.indexOf('--preview');
  if (previewIdx > -1) {
    const n = Number(process.argv[previewIdx + 1]) || 5;
    const history = loadHistory(); // simulated in memory, never saved
    for (let i = 0; i < n; i++) {
      const t = await generateTweet(history);
      if (!t) { console.log('\n(skipped: no candidate passed)'); continue; }
      console.log(`\n[${diceSummary(t.dice).form} × ${diceSummary(t.dice).device} | ${t.dice.setting ?? '—'} | ${t.dice.motifs.join(', ')}]`);
      console.log(t.text);
      t.alternates.forEach(a => console.log(`   alt: ${a.replace(/\n/g, ' / ')}`));
      history.push({ text: t.text, coined: t.coined, dice: diceSummary(t.dice) });
    }
    return;
  }

  const haveTwitter = TWITTER_API_KEY_CLAUDE && TWITTER_API_SECRET_CLAUDE && TWITTER_ACCESS_TOKEN_CLAUDE && TWITTER_ACCESS_SECRET_CLAUDE;
  const dryRun = DRY_RUN_ENV === '1' || !haveTwitter;
  if (!haveTwitter) console.warn('[warn] twitter creds missing; dry-run');

  const history = loadHistory();
  const t = await generateTweet(history);
  if (!t) { console.log('[skip] no acceptable candidate this run'); process.exitCode = 2; return; }

  console.log('[dice]', JSON.stringify(diceSummary(t.dice)));
  let tweetId = null;
  if (dryRun) {
    console.log('[dry-run]\n' + t.text);
  } else {
    const twitter = new TwitterApi({
      appKey: TWITTER_API_KEY_CLAUDE,
      appSecret: TWITTER_API_SECRET_CLAUDE,
      accessToken: TWITTER_ACCESS_TOKEN_CLAUDE,
      accessSecret: TWITTER_ACCESS_SECRET_CLAUDE,
    });
    const resp = await twitter.v2.tweet(t.text);
    tweetId = resp.data?.id ?? null;
    console.log('[posted]', tweetId, '\n' + t.text);
  }

  history.push({
    text: t.text,
    timestamp: new Date().toISOString(),
    tweetId,
    dryRun,
    coined: t.coined,
    dice: diceSummary(t.dice),
  });
  saveHistory(history);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[error]', err?.stack || err);
    process.exitCode = 1;
  });
}
