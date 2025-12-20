// bot_claude_turk.js
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------- env ----------
const {
  CLAUDE_API_KEY,
  TWITTER_API_KEY_TURK,
  TWITTER_API_SECRET_TURK,
  TWITTER_ACCESS_TOKEN_TURK,
  TWITTER_ACCESS_SECRET_TURK,
  DRY_RUN: DRY_RUN_ENV,
} = process.env;

// ---------- clients ----------
const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY,
});

const twitter = new TwitterApi({
  appKey: TWITTER_API_KEY_TURK,
  appSecret: TWITTER_API_SECRET_TURK,
  accessToken: TWITTER_ACCESS_TOKEN_TURK,
  accessSecret: TWITTER_ACCESS_SECRET_TURK,
});

// ---------- settings ----------
const DRY_RUN = DRY_RUN_ENV === '1';
const MAX_LEN = 280; // twitter limit, turkish tweets can be longer
const MIN_LEN = 60;
const HISTORY_SIZE = 15;

// ---------- path setup ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTORY_FILE = path.join(__dirname, 'tweet_history_turk.json');

// ---------- helpers ----------
function clampLen(s) {
  if (!s) return '';
  const t = s.trim();
  return t.length <= MAX_LEN ? t : t.slice(0, MAX_LEN).trim();
}

function normalize(s) {
  if (!s) return '';
  return s
    .replace(/[^\p{L}\p{N},;:.''"\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- tweet history management ----------
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const history = JSON.parse(data);
      console.log(`[history] loaded ${history.length} previous tweets`);
      return history;
    } else {
      console.log('[history] no history file found, starting fresh');
    }
  } catch (e) {
    console.warn('[warn] could not load tweet history:', e.message);
  }
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    console.log(`[history] saved ${history.length} tweets to ${HISTORY_FILE}`);
  } catch (e) {
    console.warn('[warn] could not save tweet history:', e.message);
  }
}

function addToHistory(tweet, detectedType) {
  const history = loadHistory();
  const patterns = extractPatterns(tweet);
  history.push({
    text: tweet,
    timestamp: new Date().toISOString(),
    type: detectedType,
    patterns: patterns,
  });
  while (history.length > HISTORY_SIZE) {
    history.shift();
  }
  saveHistory(history);
}

// ---------- type detection ----------
// keyword matching for Ottoman/Turkish archival themes
function detectType(text) {
  const lower = text.toLowerCase();
  
  // SOURCE TYPES - Ottoman/Turkish document types
  const sourcePatterns = {
    ferman: ['ferman', 'berat', 'hatt-ı', 'hattı', 'buyruldu', 'irade'],
    defter: ['defter', 'sicil', 'kayıt', 'sicili'],
    salname: ['salname', 'salnâme', 'yıllık'],
    vilayet: ['vilayet', 'vilâyet', 'sancak', 'eyalet', 'kaza'],
    census: ['nüfus', 'sayım', 'tahrir'],
    archaeological: ['kazı', 'arkeolog', 'mozaik', 'heykel', 'kalıntı', 'höyük'],
    architectural: ['cami', 'kilise', 'saray', 'han', 'hamam', 'medrese', 'kule', 'sur'],
    meteorological: ['hava', 'yağmur', 'fırtına', 'güneş', 'rasathane'],
    personal: ['günlük', 'mektup', 'hatırat', 'şahit', 'tanık'],
    institutional: ['meclis', 'divan', 'kurul', 'rapor', 'tutanak'],
    archive: ['arşiv', 'belge', 'evrak', 'vesika'],
  };

  // ANOMALY TYPES
  const anomalyPatterns = {
    temporal: ['tarih', 'yıl', 'önce', 'sonra', 'gelecek', 'geçmiş', 'zaman'],
    spatial: ['yer', 'mekan', 'mekân', 'boyut', 'mesafe', 'konum'],
    administrative: ['kayıp', 'yok', 'mevcut değil', 'bulunamadı', 'hiç', 'olmayan'],
    anachronistic: ['imkansız', 'olamaz', 'olmamalı', 'yanlış dönem', 'erken'],
    bureaucratic: ['dosya', 'katalog', 'numara', 'referans', 'indeks'],
    memorial: ['hatıra', 'anı', 'anma', 'unutulmuş'],
  };

  // ERA detection - Ottoman/Turkish specific
  const eraPatterns = {
    byzantine: [/bizans/i, /konstantinopolis/i, /ms\s*[3-9]\d{2}/i, /ms\s*1[0-4]\d{2}/i, /doğu roma/i],
    early_ottoman: [/1[23]\d{2}/i, /kuruluş/i, /beylik/i, /osman.*gazi/i, /orhan/i],
    classical_ottoman: [/1[5-6]\d{2}/i, /kanuni/i, /fatih/i, /yavuz/i, /muhteşem/i],
    late_ottoman: [/1[78]\d{2}/i, /tanzimat/i, /meşrutiyet/i, /abdül/i, /ıslahat/i],
    republican: [/19[2-9]\d/i, /20\d{2}/i, /cumhuriyet/i, /atatürk/i, /ankara/i],
    hicri: [/hicri/i, /hicrî/i, /h\.\s*\d+/i],
    rumi: [/rumi/i, /rumî/i, /r\.\s*\d+/i],
  };

  // Detect source type
  let sourceType = 'general_source';
  for (const [type, keywords] of Object.entries(sourcePatterns)) {
    if (keywords.some(kw => lower.includes(kw))) {
      sourceType = type;
      break;
    }
  }

  // Detect anomaly type
  let anomalyType = 'general_anomaly';
  for (const [type, keywords] of Object.entries(anomalyPatterns)) {
    if (keywords.some(kw => lower.includes(kw))) {
      anomalyType = type;
      break;
    }
  }

  // Detect era
  let era = 'unspecified_era';
  for (const [eraName, patterns] of Object.entries(eraPatterns)) {
    if (patterns.some(p => p.test ? p.test(text) : lower.includes(p))) {
      era = eraName;
      break;
    }
  }

  // Detect opening structure (Turkish patterns)
  let opening = 'narrative';
  if (lower.startsWith('topkapı') || lower.startsWith('arşiv')) opening = 'archive_ref';
  else if (lower.startsWith('ferman') || lower.startsWith('berat')) opening = 'edict';
  else if (lower.startsWith('kayıt') || lower.startsWith('numara') || lower.startsWith('dosya')) opening = 'catalog_entry';
  else if (/^\d{4}/.test(lower)) opening = 'date_start';
  else if (lower.startsWith('kazı') || lower.startsWith('arkeolog')) opening = 'archaeological';
  else if (lower.startsWith('vilayet') || lower.startsWith('vilâyet')) opening = 'vilayet';

  return `${sourceType}|${anomalyType}|${era}|${opening}`;
}

function parseType(compositeType) {
  const [source, anomaly, era, opening] = compositeType.split('|');
  return { source, anomaly, era, opening };
}

// ---------- phrase pattern detection ----------
function extractPatterns(text) {
  const lower = text.toLowerCase();
  const patterns = [];
  
  const phraseMarkers = [
    // Turkish structural phrases
    { pattern: /kayıt (yok|bulunamadı|mevcut değil)/i, name: 'kayit_yok' },
    { pattern: /hiçbir (kayıt|belge|iz)/i, name: 'hicbir_kayit' },
    { pattern: /açıklama (yok|bulunamadı)/i, name: 'aciklama_yok' },
    { pattern: /hâlâ (devam|mevcut|var)/i, name: 'hala_devam' },
    { pattern: /kimse (bilmiyor|hatırlamıyor)/i, name: 'kimse_bilmiyor' },
    { pattern: /otantik/i, name: 'otantik' },
    { pattern: /doğrulandı|doğrulanmış/i, name: 'dogrulandi' },
    { pattern: /kayboldu|kayıp/i, name: 'kayboldu' },
    { pattern: /rapor (edilmedi|etmedi)/i, name: 'rapor_edilmedi' },
    { pattern: /mühür/i, name: 'muhur' },
    { pattern: /imza/i, name: 'imza' },
    
    // Ottoman terminology
    { pattern: /ferman/i, name: 'ferman' },
    { pattern: /vilayet|vilâyet/i, name: 'vilayet' },
    { pattern: /salname|salnâme/i, name: 'salname' },
    { pattern: /defter/i, name: 'defter' },
    { pattern: /sicil/i, name: 'sicil' },
    
    // Location patterns
    { pattern: /topkapı/i, name: 'topkapi' },
    { pattern: /istanbul/i, name: 'istanbul' },
    { pattern: /ankara/i, name: 'ankara' },
    { pattern: /konya/i, name: 'konya' },
    { pattern: /bursa/i, name: 'bursa' },
    { pattern: /edirne/i, name: 'edirne' },
    
    // Era markers
    { pattern: /bizans/i, name: 'bizans' },
    { pattern: /osmanlı/i, name: 'osmanli' },
    { pattern: /cumhuriyet/i, name: 'cumhuriyet' },
    
    // Ending patterns
    { pattern: /\.\s*(ama|fakat|ancak)/i, name: 'end_but' },
    { pattern: /\.\s*kayıtlar normal/i, name: 'end_normal' },
  ];
  
  for (const { pattern, name } of phraseMarkers) {
    if (pattern.test(text)) {
      patterns.push(name);
    }
  }
  
  // Extract first 3 words as opening signature
  const words = lower.replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, '').split(/\s+/).slice(0, 4);
  if (words.length >= 3) {
    patterns.push(`opening:${words.slice(0, 3).join('_')}`);
  }
  
  return patterns;
}

// ---------- prompt ----------
const promptFile = path.join(__dirname, 'prompts', 'claude_turk.txt');

let basePrompt = 'Türkçe yaz. Tek tweet üret.';
try {
  basePrompt = fs.readFileSync(promptFile, 'utf8');
} catch (e) {
  console.warn(`[warn] couldn't read ${promptFile}; using fallback prompt`);
}

// ---------- claude call ----------
async function genRawTweetOnce(history) {
  const recentTypes = history.map(h => h.type);
  const recentTexts = history.map(h => h.text);
  const recentPatterns = history.flatMap(h => h.patterns || []);
  
  let avoidanceContext = '';
  
  if (recentTypes.length > 0) {
    const recentParsed = recentTypes.map(parseType);
    
    const sourceCounts = {};
    const anomalyCounts = {};
    const eraCounts = {};
    const openingCounts = {};
    
    recentParsed.forEach(p => {
      sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
      anomalyCounts[p.anomaly] = (anomalyCounts[p.anomaly] || 0) + 1;
      eraCounts[p.era] = (eraCounts[p.era] || 0) + 1;
      openingCounts[p.opening] = (openingCounts[p.opening] || 0) + 1;
    });
    
    const overusedSources = Object.entries(sourceCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    const overusedAnomalies = Object.entries(anomalyCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    const overusedEras = Object.entries(eraCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    const overusedOpenings = Object.entries(openingCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    
    const lastTweet = recentParsed[recentParsed.length - 1];
    
    avoidanceContext += `\n\nVARIETY REQUIREMENTS FOR THIS TWEET:`;
    avoidanceContext += `\n- DO NOT use source type: ${lastTweet.source} (used in last tweet)`;
    avoidanceContext += `\n- DO NOT use anomaly type: ${lastTweet.anomaly} (used in last tweet)`;
    if (lastTweet.era !== 'unspecified_era') {
      avoidanceContext += `\n- AVOID era: ${lastTweet.era} (used in last tweet)`;
    }
    avoidanceContext += `\n- DO NOT start with: ${lastTweet.opening} style opening`;
    
    if (overusedSources.length > 0) {
      avoidanceContext += `\n- OVERUSED sources to avoid: ${overusedSources.join(', ')}`;
    }
    if (overusedAnomalies.length > 0) {
      avoidanceContext += `\n- OVERUSED anomaly types to avoid: ${overusedAnomalies.join(', ')}`;
    }
    if (overusedEras.length > 0) {
      avoidanceContext += `\n- OVERUSED eras to avoid: ${overusedEras.join(', ')}`;
    }
  }
  
  if (recentPatterns.length > 0) {
    const patternCounts = {};
    recentPatterns.forEach(p => {
      patternCounts[p] = (patternCounts[p] || 0) + 1;
    });
    
    const overusedPhrases = Object.entries(patternCounts)
      .filter(([p, c]) => c >= 2 && !p.startsWith('opening:'))
      .map(([p]) => p.replace(/_/g, ' '));
    
    if (overusedPhrases.length > 0) {
      avoidanceContext += `\n- OVERUSED phrases/structures to avoid: "${overusedPhrases.join('", "')}"`;
    }
    
    const lastPatterns = history[history.length - 1]?.patterns || [];
    const lastPhrases = lastPatterns
      .filter(p => !p.startsWith('opening:'))
      .map(p => p.replace(/_/g, ' '));
    if (lastPhrases.length > 0) {
      avoidanceContext += `\n- DO NOT use these phrases from last tweet: "${lastPhrases.slice(0, 3).join('", "')}"`;
    }
  }
  
  if (recentTexts.length > 0) {
    const samplesToShow = recentTexts.slice(-5);
    avoidanceContext += `\n\nLAST ${samplesToShow.length} TWEETS (DO NOT repeat similar content, phrasing, or structure):\n${samplesToShow.map(t => `- "${t}"`).join('\n')}`;
  }

  const fullPrompt =
    `${basePrompt}${avoidanceContext}\n\nProduce ONE fresh, unique tweet in Turkish between ${MIN_LEN} and ${MAX_LEN} characters. Ensure maximum variety from recent tweets.`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    temperature: 0.9,
    messages: [
      { role: 'user', content: fullPrompt }
    ],
  });

  return msg.content?.[0]?.text?.trim() ?? '';
}

// ---------- generate ----------
async function generateTweet() {
  const history = loadHistory();
  
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await genRawTweetOnce(history);
    let t = normalize(raw);
    t = clampLen(t);
    if (t.length >= MIN_LEN) return t;
  }
  return clampLen(normalize(await genRawTweetOnce(history)));
}

// ---------- post ----------
async function post(text) {
  const detectedType = detectType(text);
  const patterns = extractPatterns(text);
  
  console.log('[analysis] type:', detectedType);
  console.log('[analysis] patterns:', patterns.join(', ') || '(none)');
  
  if (DRY_RUN) {
    console.log('[dry-run] would tweet:', JSON.stringify(text));
    addToHistory(text, detectedType);
    return;
  }
  
  const resp = await twitter.v2.tweet(text);
  console.log('[posted]', resp.data?.id, JSON.stringify(text));
  addToHistory(text, detectedType);
}

// ---------- main ----------
async function main() {
  if (!CLAUDE_API_KEY) throw new Error('missing CLAUDE_API_KEY');

  if (
    !TWITTER_API_KEY_TURK ||
    !TWITTER_API_SECRET_TURK ||
    !TWITTER_ACCESS_TOKEN_TURK ||
    !TWITTER_ACCESS_SECRET_TURK
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