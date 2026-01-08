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
const MAX_LEN = 280;
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

// ---------- location detection ----------
const LOCATIONS = {
  // Major cities
  istanbul: ['istanbul', 'konstantinopolis', 'konstantiniyye', 'dersaadet', 'payitaht'],
  ankara: ['ankara', 'angora', 'ancyra'],
  izmir: ['izmir', 'smyrna', 'smirna'],
  bursa: ['bursa', 'prusa', 'hüdavendigar'],
  edirne: ['edirne', 'adrianopolis', 'adrianople'],
  konya: ['konya', 'iconium', 'karaman'],
  trabzon: ['trabzon', 'trabzond', 'trapezunt', 'trebizond'],
  sivas: ['sivas', 'sebasteia', 'sebastia'],
  erzurum: ['erzurum', 'theodosiopolis'],
  diyarbakir: ['diyarbakır', 'diyarbakir', 'amid', 'amida'],
  
  // Istanbul neighborhoods
  uskudar: ['üsküdar', 'uskudar', 'scutari', 'chrysopolis'],
  beyoglu: ['beyoğlu', 'beyoglu', 'pera', 'galata'],
  kadikoy: ['kadıköy', 'kadikoy', 'chalcedon', 'kalkedon'],
  fatih: ['fatih', 'suriçi'],
  besiktas: ['beşiktaş', 'besiktas'],
  eyup: ['eyüp', 'eyup'],
  eminonu: ['eminönü', 'eminonu'],
  
  // Other important cities
  kayseri: ['kayseri', 'caesarea', 'kayseriye'],
  antalya: ['antalya', 'attalia', 'adalya'],
  gaziantep: ['gaziantep', 'antep', 'aintab'],
  sanliurfa: ['şanlıurfa', 'sanliurfa', 'urfa', 'edessa'],
  mardin: ['mardin'],
  van: ['van', 'tuşpa'],
  amasya: ['amasya', 'amasia'],
  tokat: ['tokat'],
  sinop: ['sinop', 'sinope'],
  samsun: ['samsun', 'amisos'],
  
  // Historical/archaeological sites
  efes: ['efes', 'ephesos', 'ephesus'],
  bergama: ['bergama', 'pergamon', 'pergamum'],
  truva: ['truva', 'troya', 'troy', 'troia'],
  hattusa: ['hattuşa', 'hattusa', 'boğazköy', 'bogazkoy'],
  gobekli: ['göbeklitepe', 'gobekli tepe', 'göbekli'],
  catalhoyuk: ['çatalhöyük', 'catalhoyuk'],
  nemrut: ['nemrut', 'nemrud'],
  ani: ['ani'],
  
  // Regions
  kapadokya: ['kapadokya', 'cappadocia', 'kapadokia'],
  trakya: ['trakya', 'thrace', 'rumeli'],
  anadolu: ['anadolu', 'anatolia'],
  
  // Palaces/specific buildings (as locations)
  topkapi: ['topkapı', 'topkapi'],
  dolmabahce: ['dolmabahçe', 'dolmabahce'],
  yildiz: ['yıldız sarayı', 'yildiz'],
  ayasofya: ['ayasofya', 'hagia sophia'],
  sultanahmet: ['sultanahmet'],
};

function detectLocation(text) {
  const lower = text.toLowerCase();
  
  for (const [location, keywords] of Object.entries(LOCATIONS)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return location;
    }
  }
  
  return 'unspecified_location';
}

// ---------- type detection ----------
function detectType(text) {
  const lower = text.toLowerCase();
  
  // SOURCE TYPES
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

  // ERA detection
  const eraPatterns = {
    byzantine: [/bizans/i, /konstantinopolis/i, /ms\s*[3-9]\d{2}/i, /ms\s*1[0-4]\d{2}/i, /doğu roma/i],
    early_ottoman: [/1[23]\d{2}/i, /kuruluş/i, /beylik/i, /osman.*gazi/i, /orhan/i],
    classical_ottoman: [/1[5-6]\d{2}/i, /kanuni/i, /fatih/i, /yavuz/i, /muhteşem/i],
    late_ottoman: [/1[78]\d{2}/i, /tanzimat/i, /meşrutiyet/i, /abdül/i, /ıslahat/i],
    republican: [/19[2-9]\d/i, /20\d{2}/i, /cumhuriyet/i, /atatürk/i],
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

  // Detect opening structure
  let opening = 'narrative';
  if (lower.startsWith('topkapı') || lower.startsWith('arşiv')) opening = 'archive_ref';
  else if (lower.startsWith('ferman') || lower.startsWith('berat')) opening = 'edict';
  else if (lower.startsWith('kayıt') || lower.startsWith('numara') || lower.startsWith('dosya')) opening = 'catalog_entry';
  else if (/^\d{4}/.test(lower)) opening = 'date_start';
  else if (lower.startsWith('kazı') || lower.startsWith('arkeolog')) opening = 'archaeological';
  else if (lower.startsWith('vilayet') || lower.startsWith('vilâyet')) opening = 'vilayet';

  // Detect location
  const location = detectLocation(text);

  return `${sourceType}|${anomalyType}|${era}|${opening}|${location}`;
}

function parseType(compositeType) {
  const parts = compositeType.split('|');
  return { 
    source: parts[0] || 'general_source', 
    anomaly: parts[1] || 'general_anomaly', 
    era: parts[2] || 'unspecified_era', 
    opening: parts[3] || 'narrative',
    location: parts[4] || 'unspecified_location'
  };
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
    const locationCounts = {};
    
    recentParsed.forEach(p => {
      sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
      anomalyCounts[p.anomaly] = (anomalyCounts[p.anomaly] || 0) + 1;
      eraCounts[p.era] = (eraCounts[p.era] || 0) + 1;
      openingCounts[p.opening] = (openingCounts[p.opening] || 0) + 1;
      locationCounts[p.location] = (locationCounts[p.location] || 0) + 1;
    });
    
    const overusedSources = Object.entries(sourceCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    const overusedAnomalies = Object.entries(anomalyCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    const overusedEras = Object.entries(eraCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    const overusedLocations = Object.entries(locationCounts)
      .filter(([loc, c]) => c >= 2 && loc !== 'unspecified_location')
      .map(([t]) => t);
    
    const lastTweet = recentParsed[recentParsed.length - 1];
    
    avoidanceContext += `\n\nVARIETY REQUIREMENTS FOR THIS TWEET:`;
    avoidanceContext += `\n- DO NOT use source type: ${lastTweet.source} (used in last tweet)`;
    avoidanceContext += `\n- DO NOT use anomaly type: ${lastTweet.anomaly} (used in last tweet)`;
    if (lastTweet.era !== 'unspecified_era') {
      avoidanceContext += `\n- AVOID era: ${lastTweet.era} (used in last tweet)`;
    }
    avoidanceContext += `\n- DO NOT start with: ${lastTweet.opening} style opening`;
    if (lastTweet.location !== 'unspecified_location') {
      avoidanceContext += `\n- DO NOT use location: ${lastTweet.location} (used in last tweet)`;
    }
    
    if (overusedSources.length > 0) {
      avoidanceContext += `\n- OVERUSED sources to avoid: ${overusedSources.join(', ')}`;
    }
    if (overusedAnomalies.length > 0) {
      avoidanceContext += `\n- OVERUSED anomaly types to avoid: ${overusedAnomalies.join(', ')}`;
    }
    if (overusedEras.length > 0) {
      avoidanceContext += `\n- OVERUSED eras to avoid: ${overusedEras.join(', ')}`;
    }
    if (overusedLocations.length > 0) {
      avoidanceContext += `\n- OVERUSED locations to avoid: ${overusedLocations.join(', ')}`;
    }
    
    // List all recent locations to encourage variety
    const recentLocs = recentParsed
      .map(p => p.location)
      .filter(loc => loc !== 'unspecified_location');
    if (recentLocs.length > 0) {
      avoidanceContext += `\n- Recent locations used (try somewhere different): ${[...new Set(recentLocs)].join(', ')}`;
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
  const parsed = parseType(detectedType);
  
  console.log('[analysis] type:', detectedType);
  console.log('[analysis] location:', parsed.location);
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