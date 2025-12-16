// bot.js
import 'dotenv/config';
import OpenAI from 'openai';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';

// ---------- env ----------
const {
  OPENAI_API_KEY,
  TWITTER_API_KEY_GPT,
  TWITTER_API_SECRET_GPT,
  TWITTER_ACCESS_TOKEN_GPT,
  TWITTER_ACCESS_SECRET_GPT,
  DRY_RUN: DRY_RUN_ENV,
} = process.env;

// ---------- clients ----------
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const twitter = new TwitterApi({
  appKey: TWITTER_API_KEY_GPT,
  appSecret: TWITTER_API_SECRET_GPT,
  accessToken: TWITTER_ACCESS_TOKEN_GPT,
  accessSecret: TWITTER_ACCESS_SECRET_GPT,
});

// ---------- settings ----------
const DRY_RUN = DRY_RUN_ENV === '1'; // "1" → don't actually post
const MAX_LEN = 240;
const MIN_LEN = 60;

// ---------- helpers ----------
function clampLen(s) {
  if (!s) return '';
  const t = s.trim();
  return t.length <= MAX_LEN ? t : t.slice(0, MAX_LEN).trim();
}

function normalizeLowerAllowPunct(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    // keep letters, numbers, whitespace, commas, semicolons, periods
    .replace(/[^\p{L}\p{N},;.\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- prompt ----------
const promptFile = './prompts/gpt_en.txt';
let basePrompt = `write in english only. produce one tweet.`;
try {
  basePrompt = fs.readFileSync(promptFile, 'utf8');
} catch (_) {
  console.warn(`[warn] couldn't read ${promptFile}; using fallback prompt`);
}

// ---------- openai call ----------
async function genRawTweetOnce() {
  const fullPrompt =
    `${basePrompt}\n\nnow write one tweet between ${MIN_LEN} and ${MAX_LEN} characters.`;

  const r = await openai.responses.create({
    model: 'gpt-5.1',          // change to 'gpt-5-mini' if you want cheaper
    temperature: 1.1,          // tweak as you like
    input: fullPrompt,
  });

  const raw =
    r.output_text ??
    r.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ??
    '';
  return raw.trim();
}

// generate, normalize, clamp
async function generateTweet() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await genRawTweetOnce();
    let t = normalizeLowerAllowPunct(raw);
    t = clampLen(t);
    if (t.length >= MIN_LEN) return t;
  }
  // last resort
  const raw = await genRawTweetOnce();
  return clampLen(normalizeLowerAllowPunct(raw));
}

// ---------- post ----------
async function post(text) {
  if (DRY_RUN) {
    console.log('[dry-run] would tweet:', JSON.stringify(text));
    return;
  }
  const resp = await twitter.v2.tweet(text);
  console.log('[posted]', resp.data?.id, JSON.stringify(text));
}

// ---------- main ----------
async function main() {
  if (!OPENAI_API_KEY) throw new Error('missing OPENAI_API_KEY');
  if (!TWITTER_API_KEY_GPT || !TWITTER_API_SECRET_GPT || !TWITTER_ACCESS_TOKEN_GPT || !TWITTER_ACCESS_SECRET_GPT) {
    console.warn('[warn] twitter creds missing or incomplete; forcing dry-run');
  }

  const tweet = await generateTweet();
  if (!tweet) {
    console.log('[skip] empty tweet');
    return;
  }

  // optional belt+suspenders moderation
  // const mod = await openai.moderations.create({ model: 'omni-moderation-latest', input: tweet });
  // if (mod.results?.[0]?.flagged) return console.log('[skip] flagged by moderation');

  await post(tweet);
}

main().catch(err => {
  console.error('[error]', err?.stack || err);
  process.exitCode = 1;
});
