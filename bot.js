// bot.js
import 'dotenv/config';
import OpenAI from 'openai';
import { TwitterApi } from 'twitter-api-v2';

// env
const {
  OPENAI_API_KEY,
  TWITTER_APP_KEY,
  TWITTER_APP_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET,
} = process.env;

const DRY_RUN = process.env.DRY_RUN === '1'; // set to "1" for local safe tests
const MAX_LEN = 240;
const MIN_LEN = 60;

// clients
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const twitter = new TwitterApi({
  appKey: TWITTER_APP_KEY,
  appSecret: TWITTER_APP_SECRET,
  accessToken: TWITTER_ACCESS_TOKEN,
  accessSecret: TWITTER_ACCESS_SECRET,
});
const rw = twitter.readWrite;

// utils
function clampLen(s) {
  if (!s) return '';
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_LEN) return t;
  return t.slice(0, MAX_LEN - 1).trimEnd() + '…';
}

function normalizeLowerNoPunct(s) {
  if (!s) return '';
  // kill punctuation; allow only letters, digits, and spaces
  // also collapse whitespace and lower-case
  return s
    .toLowerCase()
    .replace(/[^a-z0-9ğüşiöç\s]/g, '') // keep basic tr letters by letting them flow via lowercase + this pass
    .replace(/[.,!?;:'"(){}\[\]_+\-=/\\|@#$%^&*<>`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function genRawTweetOnce() {
  const prompt =
    'write one "esoteric schizo" style tweet between 60 and 240 characters. ' +
    'cryptic, unnervingly lucid, coherent but strange. all lowercase. no hashtags, no urls, no emojis. ' +
    'avoid punctuation; use only words and spaces. output just the tweet.';

  const r = await openai.responses.create({
    model: 'gpt-5-mini',
    input: prompt,
  });

  const raw =
    r.output_text ??
    r.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ??
    '';
  return raw;
}

async function generateTweet() {
  // try up to 2 times to hit min length
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await genRawTweetOnce();
    let t = normalizeLowerNoPunct(raw);
    t = clampLen(t);

    if (t.length >= MIN_LEN) return t;
  }
  // last resort: return whatever we got, clamped and normalized
  const raw = await genRawTweetOnce();
  return clampLen(normalizeLowerNoPunct(raw));
}

async function post(text) {
  if (DRY_RUN) {
    console.log('[dry-run] would tweet:', JSON.stringify(text));
    return;
  }
  const resp = await rw.v2.tweet(text);
  console.log('[posted]', resp.data?.id, JSON.stringify(text));
}

async function main() {
  // basic env sanity
  if (!OPENAI_API_KEY) throw new Error('missing OPENAI_API_KEY');
  if (!TWITTER_APP_KEY || !TWITTER_APP_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    console.log('[warn] twitter creds missing; running in dry-run mode');
  }

  const tweet = await generateTweet();
  if (!tweet) {
    console.log('[skip] empty tweet');
    return;
  }

  // optional moderation (uncomment if you want belt + suspenders)
  // const mod = await openai.moderations.create({ model: 'omni-moderation-latest', input: tweet });
  // if (mod.results?.[0]?.flagged) { console.log('[skip] flagged by moderation'); return; }

  await post(tweet);
}

main().catch(err => {
  console.error('[error]', err?.message || err);
  process.exitCode = 1;
});
