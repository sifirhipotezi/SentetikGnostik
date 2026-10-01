// bot_claude.js — @ErrataEternal (English)
//
//   node bot_claude.js              generate + post one tweet
//   DRY_RUN=1 node bot_claude.js    generate, log, save to history, don't post
//   node bot_claude.js --preview 8  generate 8 in a row, print with dice, touch nothing

import path from 'path';
import { fileURLToPath } from 'url';
import { createBot } from './engine.js';
import * as dice from './dice.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

createBot({
  name: 'errata',
  language: 'English',
  promptFile: path.join(dir, 'prompts', 'claude_en.txt'),
  historyFile: path.join(dir, 'tweet_history.json'),
  dice,
  twitterKeys: {
    appKey: env.TWITTER_API_KEY_CLAUDE,
    appSecret: env.TWITTER_API_SECRET_CLAUDE,
    accessToken: env.TWITTER_ACCESS_TOKEN_CLAUDE,
    accessSecret: env.TWITTER_ACCESS_SECRET_CLAUDE,
  },
}).run().catch(err => {
  console.error('[error]', err?.stack || err);
  process.exitCode = 1;
});
