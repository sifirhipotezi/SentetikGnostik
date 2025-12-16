// bot_claude.js
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';

// ---------- env ----------
const {
  CLAUDE_API_KEY,
  TWITTER_API_KEY_CLAUDE,
  TWITTER_API_SECRET_CLAUDE,
  TWITTER_ACCESS_TOKEN_CLAUDE,
  TWITTER_ACCESS_SECRET_CLAUDE,
  DRY_RUN: DRY_RUN_ENV,
} = process.env;

// ---------- clients ----------
const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY,
});

const twitter = new TwitterApi({
  appKey: TWITTER_API_KEY_CLAUDE,
  appSecret: TWITTER_API_SECRET_CLAUDE,
  accessToken: TWITTER_ACCESS_TOKEN_CLAUDE,
  accessSecret: TWITTER_ACCESS_SECRET_CLAUDE,
});

// ---------- settings ----------
const DRY_RUN = DRY_RUN_ENV === '1';
const MAX_LEN = 240;
const MIN_LEN = 60;

// ---------- helpers ----------
function clampLen(s) {
  if (!s) return '';
  const t = s.trim();
  return t.length <= MAX_LEN ? t : t.slice(0, MAX_LEN).trim();
}

function normalize(s) {
  if (!s) return '';
  return s
    .replace(/[^\p{L}\p{N},;:.'\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- prompt ----------
import path from "path";
import { fileURLToPath } from "url";

// resolve absolute path to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- prompt ----------
const promptFile = path.join(__dirname, "prompts", "claude_en.txt");

let basePrompt = "write in english only. produce one tweet.";
try {
  basePrompt = fs.readFileSync(promptFile, "utf8");
} catch (e) {
  console.warn(`[warn] couldn't read ${promptFile}; using fallback prompt`);
}

// ---------- claude call ----------
async function genRawTweetOnce() {
  const fullPrompt =
    `${basePrompt}\n\nproduce ONE tweet between ${MIN_LEN} and ${MAX_LEN} characters.`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
     temperature: 0.8,
    messages: [
      { role: 'user', content: fullPrompt }
    ],
  });

  return msg.content?.[0]?.text?.trim() ?? '';
}

// ---------- generate ----------
async function generateTweet() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await genRawTweetOnce();
    let t = normalize(raw); // changed function name
    t = clampLen(t);
    if (t.length >= MIN_LEN) return t;
  }
  return clampLen(normalize(await genRawTweetOnce()));
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
  if (!CLAUDE_API_KEY) throw new Error('missing CLAUDE_API_KEY');

  if (
    !TWITTER_API_KEY_CLAUDE ||
    !TWITTER_API_SECRET_CLAUDE ||
    !TWITTER_ACCESS_TOKEN_CLAUDE ||
    !TWITTER_ACCESS_SECRET_CLAUDE
  ) {
    console.warn('[warn] twitter creds missing; forcing dry-run');
  }

  const tweet = await generateTweet();
  if (!tweet) {
    console.log('[skip] empty tweet');
    return;
  }

  await post(tweet);
}

main().catch(err => {
  console.error('[error]', err?.stack || err);
  process.exitCode = 1;
});
