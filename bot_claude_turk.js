// bot_claude_turk.js — @KayipDefter (Türkçe)
//
//   node bot_claude_turk.js              generate + post one tweet
//   DRY_RUN=1 node bot_claude_turk.js    generate, log, save to history, don't post
//   node bot_claude_turk.js --preview 8  generate 8 in a row, print with dice, touch nothing

import path from 'path';
import { fileURLToPath } from 'url';
import { createBot } from './engine.js';
import * as dice from './dice_turk.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

createBot({
  name: 'kayipdefter',
  language: 'Turkish',
  promptFile: path.join(dir, 'prompts', 'claude_turk.txt'),
  historyFile: path.join(dir, 'tweet_history_turk.json'),
  dice,
  twitterKeys: {
    appKey: env.TWITTER_API_KEY_TURK,
    appSecret: env.TWITTER_API_SECRET_TURK,
    accessToken: env.TWITTER_ACCESS_TOKEN_TURK,
    accessSecret: env.TWITTER_ACCESS_SECRET_TURK,
  },
}).run().catch(err => {
  console.error('[error]', err?.stack || err);
  process.exitCode = 1;
});
