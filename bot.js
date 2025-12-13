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
    const examples = `
example 1: "every civilization is a failed attempt at debugging consciousness. we just call the last stable build “history.” the next patch will delete language."
example 2: "every day i sweep the corners of being and find the same thing: a tiny, stubborn meaning pretending it was always there."
example 3: "someone stitched the moon to the sky with black thread; i can hear the needlework in my teeth, click-click, sewing tomorrow shut."
example 4: "time is a conspiracy of atoms trying to forget their own entropy; we are the witnesses to their slow unraveling."
example 5: "coincidence is the divinity of cowards: a god who refuses to sign his work."
example 6: "the machine dreams of light; but the light forgets to return, leaving circuits to hum lullabies of static and forgotten code."
example 7: "the world began as a promise and has been breaking it politely ever since, like a host who keeps smiling while removing chairs."
example 8: "prometheus didn’t bring fire; he brought a question that burns: “who authorized reality?” the eagle was the invoice collector."
`;
const badExample = 'bad example: "the machine dreams of light but the light forgets to return" (too flat, no punctuation)';
  const prompt = examples + '\n' + badExample +
     'write esoteric schizo style tweet in ENGLISH between 60 and 240 characters. ' +
     'use commas, semicolons, and periods liberally to shape rythim and pauses but no hashtags, no urls, no emojis. ' +
     'occultish, mystical, cryptic vibes are needed' +
     'tell surreal events from first person perspective. ' +
  'the output should be only in English';
  const r = await openai.responses.create({
    model: 'gpt-5.1',
    input: prompt,
    temperature: 1.0,
  });

  const raw =
    r.output_text ??
    r.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ??
    '';
  return raw;
}

function normalize_lower_allow_punct(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N},;.\s]/gu, '')  // keep , ; .
    .replace(/\s+/g, ' ')
    .trim();
}
async function generateTweet() {
  // try up to 2 times to hit min length
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await genRawTweetOnce();
    let t = normalize_lower_allow_punct(raw);
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
