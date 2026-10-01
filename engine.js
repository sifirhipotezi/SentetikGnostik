// engine.js — shared generator for @ErrataEternal and @KayipDefter.
//
// How variety works: instead of keyword-guessing what the last tweet was about
// and telling the model what NOT to do, the code rolls a concrete brief
// (form × device × setting × motifs × register × length), avoiding recently
// used values. The model writes 3 candidates for that brief and picks one;
// the code then rejects anything too long or too similar to history.
// Each bot file just passes its own prompt, dice, history file and keys.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';

const {
  CLAUDE_API_KEY,
  CLAUDE_MODEL = 'claude-sonnet-5-5',
  TEMPERATURE, // optional; omitted from the request unless set
  DRY_RUN: DRY_RUN_ENV,
} = process.env;

const MAX_LEN = 270;          // twitter-weighted; hard limit 280, keep slack
const MIN_LEN = 40;
const HISTORY_SIZE = 500;     // kept on disk for dedupe + lore callbacks
const SHOW_RECENT = 8;        // how many recent tweets the model sees
const CALLBACK_CHANCE = 0.12; // chance to reference earlier invented lore
const MAX_ATTEMPTS = 3;       // each attempt is a PAID call
const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 1500;
// $ per million tokens (input, output) for the cost log; unknown models just skip the cost figure
const PRICES = {
  'claude-fable-5-1': [10, 50],
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-4-5-20251001': [1, 5],
};
// how far back each dimension is blocked from repeating
const AVOID = { form: 6, device: 4, setting: 50, motif: 40, register: 1, length: 1 };

// ---------- text utils ----------
// Twitter's weighted length: Latin/punctuation = 1, CJK/emoji/etc = 2.
export function tweetLength(s) {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    const light = c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247);
    n += light ? 1 : 2;
  }
  return n;
}

// Light cleanup only. The old normalize() stripped % - ? ( ) ° etc.
export function clean(s) {
  return (s || '')
    .replace(/^["“]|["”]$/g, '')
    .replace(/[*_`#]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const tokens = s => s.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const bigrams = s => { const t = tokens(s); return new Set(t.slice(1).map((w, i) => t[i] + ' ' + w)); };
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
// handles 1,042 and 1.042 thousands separators
const numbersIn = s => (s.match(/\d[\d.,]*\d|\d/g) || []).map(n => n.replace(/[.,]/g, '')).filter(n => n.length >= 2);
const opener = s => tokens(s).slice(0, 2).join(' ');

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

export function rollDice(D, history) {
  const form = weightedPick(D.FORMS, recentValues(history, 'form', AVOID.form));
  const device = weightedPick(D.DEVICES, recentValues(history, 'device', AVOID.device));
  let setting = null;
  if (form.setting === 'required' || (form.setting === 'optional' && Math.random() < 0.6)) {
    setting = weightedPick(D.SETTINGS, recentValues(history, 'setting', AVOID.setting));
  }
  const usedMotifs = recentValues(history, 'motifs', AVOID.motif);
  const m1 = weightedPick(D.MOTIFS, usedMotifs);
  const motifs = [m1, weightedPick(D.MOTIFS, new Set([...usedMotifs, m1]))];
  const register = weightedPick(D.REGISTERS, recentValues(history, 'register', AVOID.register));
  const length = weightedPick(D.LENGTHS, recentValues(history, 'length', AVOID.length));

  let callback = null;
  const lore = history.slice(0, -15).filter(h => h.coined);
  if (lore.length && Math.random() < CALLBACK_CHANCE) {
    const h = lore[Math.floor(Math.random() * lore.length)];
    callback = { name: h.coined, source: h.text };
  }
  return { form, device, setting, motifs, register, length, callback };
}

const diceSummary = d => ({
  form: d.form.id, device: d.device.id, setting: d.setting, motifs: d.motifs,
  register: d.register.id, length: d.length.id, callback: d.callback?.name || null,
});

// ---------- brief ----------
export function buildBrief(d, history, language) {
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
    'If two parts of the brief fight each other, FORM and DEVICE win; bend the rest.',
  ];
  if (language !== 'English') {
    lines.push(`LANGUAGE — write the entry in ${language}, natively. Think in ${language} from the first word; do not draft in English and translate.`);
  }
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

export function parseCandidates(raw) {
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no JSON in response');
  const obj = JSON.parse(raw.slice(a, b + 1));
  const cands = (obj.candidates || [])
    .map(c => ({ text: clean(typeof c === 'string' ? c : c.text), coined: c?.coined || null }))
    .filter(c => c.text);
  const pick = Number.isInteger(obj.pick) && cands[obj.pick] ? obj.pick : 0;
  return [cands[pick], ...cands.filter((_, i) => i !== pick)].filter(Boolean);
}

// ---------- bot ----------
export function createBot({ name, promptFile, dice, historyFile, twitterKeys, language = 'English' }) {
  let system = `You write one tweet of invented history in ${language}.`;
  try { system = fs.readFileSync(promptFile, 'utf8'); }
  catch { console.warn(`[warn] couldn't read ${promptFile}; using fallback`); }

  const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

  const loadHistory = () => {
    try { if (fs.existsSync(historyFile)) return JSON.parse(fs.readFileSync(historyFile, 'utf8')); }
    catch (e) { console.warn('[warn] could not load history:', e.message); }
    return [];
  };
  const saveHistory = h => fs.writeFileSync(historyFile, JSON.stringify(h.slice(-HISTORY_SIZE), null, 2), 'utf8');

  async function askClaude(brief) {
    const req = { model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system, messages: [{ role: 'user', content: brief }] };
    // hidden thinking was eating the whole token budget and leaving no text; this is a short creative task, so switch it off
    if (process.env.THINKING !== 'on') req.thinking = { type: 'between_tools' };
    if (TEMPERATURE) req.temperature = Number(TEMPERATURE);
    const msg = await anthropic.messages.create(req);
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');

    // every call is logged with its real token usage + cost, so you can see what a tweet actually costs
    const u = msg.usage || {};
    const p = PRICES[CLAUDE_MODEL];
    const cost = p ? ((u.input_tokens || 0) * p[0] + (u.output_tokens || 0) * p[1]) / 1e6 : null;
    console.log(`[${name}] call: ${u.input_tokens} in / ${u.output_tokens} out, stop=${msg.stop_reason}` +
      (cost != null ? `, ~$${cost.toFixed(4)}` : ''));

    if (!text.trim()) {
      // an empty reply is deterministic (e.g. all tokens went to hidden thinking, or a refusal).
      // retrying just pays for the same failure again, so abort instead.
      const err = new Error(`empty text (stop=${msg.stop_reason}, blocks=${msg.content.map(b => b.type).join(',') || 'none'})`);
      err.fatal = true;
      throw err;
    }
    return text;
  }

  async function generate(history) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const d = rollDice(dice, history);
      let raw = '', cands;
      try { raw = await askClaude(buildBrief(d, history, language)); cands = parseCandidates(raw); }
      catch (e) {
        console.warn(`[attempt ${attempt}] bad response: ${e.message}` + (raw ? `\n   raw: ${raw.slice(0, 300).replace(/\n/g, ' ')}` : ''));
        if (e.fatal) break;
        continue;
      }
      for (const c of cands) {
        const why = rejectReason(c.text, history);
        if (!why) return { ...c, dice: d, alternates: cands.filter(x => x !== c).map(x => x.text) };
        console.log(`[reject] ${why}\n         ${c.text.replace(/\n/g, ' / ')}`);
      }
    }
    return null; // better to skip a slot than post a truncated or repeated tweet
  }

  async function run(argv = process.argv) {
    if (!CLAUDE_API_KEY) throw new Error('missing CLAUDE_API_KEY');

    const pi = argv.indexOf('--preview');
    if (pi > -1) {
      const n = Number(argv[pi + 1]) || 5;
      const history = loadHistory(); // simulated in memory, never saved
      for (let i = 0; i < n; i++) {
        const t = await generate(history);
        if (!t) { console.log('\n(skipped: no candidate passed)'); continue; }
        const s = diceSummary(t.dice);
        console.log(`\n[${s.form} × ${s.device} | ${s.setting ?? '—'} | ${s.motifs.join(', ')}]`);
        console.log(t.text);
        t.alternates.forEach(a => console.log(`   alt: ${a.replace(/\n/g, ' / ')}`));
        history.push({ text: t.text, coined: t.coined, dice: s });
      }
      return;
    }

    const haveTwitter = Object.values(twitterKeys).every(Boolean);
    const dryRun = DRY_RUN_ENV === '1' || !haveTwitter;
    if (!haveTwitter) console.warn(`[${name}] twitter creds missing; dry-run`);

    const history = loadHistory();
    const t = await generate(history);
    if (!t) { console.log(`[${name}] skip: no acceptable candidate`); process.exitCode = 2; return; }

    console.log(`[${name}] dice`, JSON.stringify(diceSummary(t.dice)));
    let tweetId = null;
    if (dryRun) {
      console.log(`[${name}] dry-run\n` + t.text);
    } else {
      const resp = await new TwitterApi(twitterKeys).v2.tweet(t.text);
      tweetId = resp.data?.id ?? null;
      console.log(`[${name}] posted`, tweetId, '\n' + t.text);
    }
    history.push({ text: t.text, timestamp: new Date().toISOString(), tweetId, dryRun, coined: t.coined, dice: diceSummary(t.dice) });
    saveHistory(history);
  }

  return { run, generate, loadHistory };
}
