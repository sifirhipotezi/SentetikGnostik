// bot_claude.js
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
const HISTORY_SIZE = 15; // how many recent tweets to remember

// ---------- path setup ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTORY_FILE = path.join(__dirname, 'tweet_history.json');

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
  // keep only the last N entries
  while (history.length > HISTORY_SIZE) {
    history.shift();
  }
  saveHistory(history);
}

// ---------- type detection ----------
// keyword matching based on ErrataEternal themes
function detectType(text) {
  const lower = text.toLowerCase();
  
  // SOURCE TYPES - what kind of document/record is referenced
  const sourcePatterns = {
    manuscript: ['manuscript', 'codex', 'marginalia', 'glossa', 'rubric', 'colophon', 'psalter', 'folio', 'parchment', 'vellum', 'scribe'],
    municipal: ['municipal', 'census', 'city record', 'town record', 'registry', 'civil record', 'birth record', 'death record'],
    architectural: ['stairwell', 'building', 'room', 'door', 'window', 'hallway', 'basement', 'attic', 'apartment', 'house', 'cathedral', 'church'],
    meteorological: ['rain', 'weather', 'storm', 'fog', 'snow', 'cloud', 'wind', 'meteorolog', 'barometric'],
    digital: ['email', 'file', 'database', 'server', 'digital', 'computer', 'internet', 'online', 'usb', 'qr code', 'website'],
    biological: ['body', 'blood', 'bone', 'birth', 'death', 'dream', 'sleep', 'memory', 'remember', 'skeletal', 'x-ray', 'xray'],
    institutional: ['council', 'committee', 'board', 'vote', 'minutes', 'proceedings', 'report', 'inspector'],
    personal: ['diary', 'letter', 'journal', 'account', 'witness', 'reported', 'claimed'],
    mirror: ['mirror', 'reflection', 'glass'],
    archaeological: ['excavat', 'dig site', 'archaeolog', 'stratigraphy', 'artifact', 'ruin', 'tomb', 'burial', 'pottery', 'shard'],
    paleontological: ['fossil', 'paleontolog', 'dinosaur', 'skeleton', 'bone bed', 'specimen', 'titanosaur', 'extinction'],
    geological: ['ice core', 'sediment', 'strata', 'layer', 'core sample', 'geological', 'rock formation'],
    ancient_text: ['cuneiform', 'tablet', 'hieroglyph', 'papyrus', 'inscription', 'stone tablet', 'clay tablet', 'scroll'],
    cave_art: ['cave painting', 'petroglyph', 'rock art', 'lascaux', 'altamira', 'pigment', 'ochre'],
  };

  // ANOMALY TYPES - what kind of glitch is documented
  const anomalyPatterns = {
    temporal: ['timeline', 'century', 'year', 'date', 'time', 'before', 'after', 'future', 'past', 'anachroni'],
    spatial: ['space', 'location', 'place', 'room', 'dimension', 'step', 'distance'],
    synchronicity: ['coincidence', 'synchron', 'same time', 'simultaneously'],
    ontological: ['exist', 'real', 'consensus', 'reality', 'canon', 'apocryph'],
    bureaucratic: ['filed', 'catalog', 'entry', 'item', 'case', 'index', 'archive'],
    philosophical: ['déjà vu', 'consciousness', 'collective unconscious', 'friction'],
    anachronistic: ['predates', 'impossible', 'shouldn\'t exist', 'wrong era', 'out of place', 'undisturbed', 'same depth', 'no explanation'],
    stratigraphic: ['stratigraphy', 'layer', 'depth', 'strata', 'sediment', 'core sample'],
  };

  // DATE ERA detection
  const eraPatterns = {
    prehistoric: [/million (BCE|years ago)/i, /\d+ BCE/, /cretaceous/i, /pleistocene/i, /paleolithic/i, /neolithic/i, /ice age/i, /bronze age/i, /iron age/i, /mesolithic/i, /holocene/i, /jurassic/i, /triassic/i, /permian/i, /carboniferous/i],
    ancient: [/mesopotamia/i, /sumerian/i, /babylonian/i, /assyrian/i, /cuneiform/i, /uruk/i, /egypt.*pharaoh/i, /pyramid/i, /hieroglyph/i, /ancient (greece|rome|egypt|persia)/i, /roman empire/i, /athen/i, /sparta/i],
    archaeological: [/excavat/i, /dig site/i, /stratigraphy/i, /fossil/i, /paleontolog/i, /ice core/i, /cave painting/i, /lascaux/i, /archaeological/i, /artifact/i, /carbon dating/i],
    medieval: [/1[2-4]\d{2}/, /13th century/, /14th century/, /12th century/, /middle ages/i, /medieval/i],
    earlymodern: [/1[5-7]\d{2}/, /15th century/, /16th century/, /17th century/],
    industrial: [/18\d{2}/, /19th century/],
    modern: [/19\d{2}/, /20\d{2}/, /20th century/, /21st century/],
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
  if (lower.startsWith('filed under') || lower.startsWith('filing')) opening = 'filed';
  else if (lower.startsWith('marginalia') || lower.startsWith('found a marginalia')) opening = 'marginalia';
  else if (lower.startsWith('item') || lower.startsWith('entry') || lower.startsWith('case') || lower.startsWith('catalog')) opening = 'catalog_entry';
  else if (lower.startsWith('cross-reference')) opening = 'crossref';
  else if (lower.startsWith('the ')) opening = 'the_statement';
  else if (lower.startsWith('every ') || lower.startsWith('all ')) opening = 'universal';

  return `${sourceType}|${anomalyType}|${era}|${opening}`;
}

// Parse the composite type to get individual components
function parseType(compositeType) {
  const [source, anomaly, era, opening] = compositeType.split('|');
  return { source, anomaly, era, opening };
}

// ---------- phrase pattern detection ----------
// catches recurring sentence structures and pet phrases
function extractPatterns(text) {
  const lower = text.toLowerCase();
  const patterns = [];
  
  // Common phrase patterns that tend to repeat
  const phraseMarkers = [
    // structural phrases
    { pattern: /this is why/i, name: 'this_is_why' },
    { pattern: /that's why/i, name: 'thats_why' },
    { pattern: /no one knows/i, name: 'no_one_knows' },
    { pattern: /no records? exist/i, name: 'no_records' },
    { pattern: /still (ongoing|continues|persists)/i, name: 'still_ongoing' },
    { pattern: /recently discovered/i, name: 'recently_discovered' },
    { pattern: /has been (dead|gone|missing)/i, name: 'has_been_dead' },
    { pattern: /none of them/i, name: 'none_of_them' },
    { pattern: /all of them/i, name: 'all_of_them' },
    { pattern: /the same (night|day|moment|time)/i, name: 'same_time' },
    { pattern: /we('re| are) (in|all)/i, name: 'we_are' },
    { pattern: /you('re| are) (just|actually|experiencing)/i, name: 'you_are' },
    
    // ending patterns
    { pattern: /\. it (never|still|always)/i, name: 'end_it_never' },
    { pattern: /\. (he|she|they|it) (is|was|were) still/i, name: 'end_still' },
    { pattern: /\. the \w+ (never|is still|was never)/i, name: 'end_the_never' },
    { pattern: /no explanation (proposed|offered|given)/i, name: 'no_explanation' },
    { pattern: /no other source/i, name: 'no_other_source' },
    { pattern: /(core|layer|site) is undisturbed/i, name: 'undisturbed' },
    
    // thematic phrases
    { pattern: /consensus reality/i, name: 'consensus_reality' },
    { pattern: /collective unconscious/i, name: 'collective_unconscious' },
    { pattern: /error handl/i, name: 'error_handling' },
    { pattern: /timeline(s)? (brush|chang|shift)/i, name: 'timeline_change' },
    { pattern: /narrative friction/i, name: 'narrative_friction' },
    { pattern: /ontological/i, name: 'ontological' },
    { pattern: /substrate/i, name: 'substrate' },
    
    // archaeological/prehistoric patterns
    { pattern: /carbon dating/i, name: 'carbon_dating' },
    { pattern: /predates .* by/i, name: 'predates_by' },
    { pattern: /chemical analysis/i, name: 'chemical_analysis' },
    { pattern: /at same depth/i, name: 'same_depth' },
    { pattern: /authentically/i, name: 'authentically' },
    
    // number/date patterns  
    { pattern: /entry \d+/i, name: 'entry_number' },
    { pattern: /item \d+/i, name: 'item_number' },
    { pattern: /case (report )?\d+/i, name: 'case_number' },
    { pattern: /catalog (note|entry)/i, name: 'catalog_note' },
    { pattern: /archaeological report/i, name: 'archaeological_report' },
    { pattern: /paleontological anomaly/i, name: 'paleontological_anomaly' },
    { pattern: /filed under impossible/i, name: 'filed_impossible' },
  ];
  
  for (const { pattern, name } of phraseMarkers) {
    if (pattern.test(text)) {
      patterns.push(name);
    }
  }
  
  // Extract first 3-4 words as opening signature
  const words = lower.replace(/[^\w\s]/g, '').split(/\s+/).slice(0, 4);
  if (words.length >= 3) {
    patterns.push(`opening:${words.slice(0, 3).join('_')}`);
  }
  
  return patterns;
}

// ---------- prompt ----------
const promptFile = path.join(__dirname, 'prompts', 'claude_en.txt');

let basePrompt = 'write in english only. produce one tweet.';
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
  
  // build context about recent tweets to avoid repetition
  let avoidanceContext = '';
  
  if (recentTypes.length > 0) {
    // Parse all recent types into their components
    const recentParsed = recentTypes.map(parseType);
    
    // Count each dimension separately
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
    
    // Find what's been overused (2+ times)
    const overusedSources = Object.entries(sourceCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    const overusedAnomalies = Object.entries(anomalyCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    const overusedEras = Object.entries(eraCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    const overusedOpenings = Object.entries(openingCounts).filter(([_, c]) => c >= 2).map(([t]) => t);
    
    // Get the LAST tweet's characteristics to avoid immediate repetition
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
  
  // Add phrase pattern avoidance
  if (recentPatterns.length > 0) {
    const patternCounts = {};
    recentPatterns.forEach(p => {
      patternCounts[p] = (patternCounts[p] || 0) + 1;
    });
    
    // Find overused phrases (appeared 2+ times)
    const overusedPhrases = Object.entries(patternCounts)
      .filter(([p, c]) => c >= 2 && !p.startsWith('opening:'))
      .map(([p]) => p.replace(/_/g, ' '));
    
    if (overusedPhrases.length > 0) {
      avoidanceContext += `\n- OVERUSED phrases/structures to avoid: "${overusedPhrases.join('", "')}"`;
    }
    
    // Get last tweet's patterns to avoid immediate repetition
    const lastPatterns = history[history.length - 1]?.patterns || [];
    const lastPhrases = lastPatterns
      .filter(p => !p.startsWith('opening:'))
      .map(p => p.replace(/_/g, ' '));
    if (lastPhrases.length > 0) {
      avoidanceContext += `\n- DO NOT use these phrases from last tweet: "${lastPhrases.slice(0, 3).join('", "')}"`;
    }
  }
  
  if (recentTexts.length > 0) {
    // show last 5 tweets so Claude knows what NOT to repeat
    const samplesToShow = recentTexts.slice(-5);
    avoidanceContext += `\n\nLAST ${samplesToShow.length} TWEETS (DO NOT repeat similar content, phrasing, or structure):\n${samplesToShow.map(t => `- "${t}"`).join('\n')}`;
  }

  const fullPrompt =
    `${basePrompt}${avoidanceContext}\n\nProduce ONE fresh, unique tweet between ${MIN_LEN} and ${MAX_LEN} characters. Ensure maximum variety from recent tweets.`;

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