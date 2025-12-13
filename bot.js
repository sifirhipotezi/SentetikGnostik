import 'dotenv/config';
import OpenAI from 'openai';
import { TwitterApi } from 'twitter-api-v2';

const {
  OPENAI_API_KEY,
  TWITTER_APP_KEY,
  TWITTER_APP_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET,
} = process.env;

const DRY_RUN = process.env.DRY_RUN === '1';
const MAX_LEN = 240;

if (!OPENAI_API_KEY) throw new Error('missing OPENAI_API_KEY');

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const twitter = new TwitterApi({
  appKey: TWITTER_APP_KEY,
  appSecret: TWITTER_APP_SECRET,
  accessToken: TWITTER_ACCESS_TOKEN,
  accessSecret: TWITTER_ACCESS_SECRET,
});
const rwClient = twitter.readWrite;

function clampTweet(text) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_LEN) return t;
  return t.slice(0, MAX_LEN - 1).trimEnd() + '…';
}

async function generateTweet() {
  const prompt = `write ONE tweet in turkish or english, <=230 chars, lowercase, slightly esoteric / philosophical, no hashtags, no urls.`;

  const r = await openai.responses.create({
    model: 'gpt-5-mini',
    input: prompt,
  });

  // try the convenience field first
  if (r.output_text) return clampTweet(r.output_text);

  // fallback parser for safety
  const firstOutput = Array.isArray(r.output) ? r.output[0] : null;
  const firstContent = firstOutput?.content?.find(c => c.type === 'output_text');
  const raw = firstContent?.text ?? '';
  return clampTweet(raw);
}

async function postToX(text) {
  if (DRY_RUN) {
    console.log('[dry-run] would tweet:', JSON.stringify(text));
    return;
  }
  const res = await rwClient.v2.tweet(text);
  console.log('[posted]', res.data?.id, JSON.stringify(text));
}

async function main() {
  const tweet = await generateTweet();
  if (!tweet) {
    console.log('[skip] empty tweet text');
    return;
  }

  // optional moderation, uncomment when you feel like being responsible:
  // const mod = await openai.moderations.create({
  //   model: 'omni-moderation-latest',
  //   input: tweet,
  // });
  // if (mod.results[0].flagged) {
  //   console.log('[skip] flagged by moderation');
  //   return;
  // }

  await postToX(tweet);
}

main().catch(err => {
  console.error('[error]', err?.message || err);
  process.exitCode = 1;
});
    