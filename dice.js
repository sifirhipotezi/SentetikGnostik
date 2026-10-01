// dice.js — the random brief for each tweet.
// The bot rolls these in code instead of asking the model to "be varied"
// (models are bad at randomness; they're good at executing a specific brief).
// Edit freely: add forms, settings, motifs. Weights default to 1.

// setting: 'required' | 'optional' | 'none'
export const FORMS = [
  { id: 'errata', w: 1.4, setting: 'optional', text: 'An errata slip for a history book we never see: "for X read Y", where the tiny correction changes everything. The account\'s namesake form.' },
  { id: 'encyclopedia', setting: 'required', text: 'The opening lines of an encyclopedia article on an invented event, person, office, or institution. Flat reference-work voice, dates in parentheses.' },
  { id: 'footnote', setting: 'optional', text: 'A scholarly footnote (start with a superscript or bracketed number) to a book we never see. The footnote quietly contains the real story.' },
  { id: 'index', w: 0.7, setting: 'none', text: 'A back-of-book index fragment, line breaks between entries. The story lives in the subentries and cross-references.' },
  { id: 'treaty', setting: 'required', text: 'A single article or clause of a treaty, charter, or edict, in its actual legal cadence.' },
  { id: 'court', setting: 'required', text: 'A court record or judgment: parties, claim, ruling, damages. Terse legal register.' },
  { id: 'obituary', setting: 'required', text: 'A death notice for an invented minor official, artisan, or office-holder whose job tells the story.' },
  { id: 'marker', w: 0.7, setting: 'required', text: 'The text of a roadside historical marker or museum placard, in that slightly-too-solemn register. All caps allowed.' },
  { id: 'auction', w: 0.8, setting: 'required', text: 'An auction-house lot description: lot number, object, date, provenance, estimate.' },
  { id: 'chronology', setting: 'required', text: 'A 3–4 line dated timeline, one event per line, each line escalating the last. Line breaks between lines.' },
  { id: 'ledger', w: 0.8, setting: 'required', text: 'Line items from an account book, inventory, customs register, or tax roll. The joke is in what gets counted.' },
  { id: 'letter', setting: 'required', text: 'An excerpt from a private letter or diplomatic dispatch, with a short sender/recipient/date attribution.' },
  { id: 'translator', setting: 'required', text: 'A translator\'s or editor\'s note on how one word in a historical source was rendered, and what that choice did to history.' },
  { id: 'etymology', w: 0.8, setting: 'optional', text: 'A dictionary etymology tracing a word (real or invented) back to an invented historical event.' },
  { id: 'exam', w: 0.6, setting: 'required', text: 'One exam question from a university history course about an invented event, with marks in parentheses. No answer.' },
  { id: 'notice', setting: 'required', text: 'A notice from a period newspaper: lost & found, wanted, public notice, or a correction/retraction.' },
  { id: 'logbook', setting: 'required', text: 'A ship\'s log, field notebook, or expedition diary entry: dated, terse, observational.' },
  { id: 'bibliography', w: 0.6, setting: 'none', text: 'One to three bibliography citations (author, title, place, year) whose titles alone tell the story.' },
  { id: 'divergence', w: 1.5, setting: 'required', text: 'No framing device. A plain statement of alternate history: one small, specific point of divergence and its disproportionate consequence.' },
  { id: 'proclamation', w: 0.8, setting: 'required', text: 'A royal or municipal proclamation, in read-aloud-in-the-square cadence.' },
  { id: 'minutes', w: 0.8, setting: 'required', text: 'Minutes of a council, synod, guild, or committee meeting: motion, vote count, outcome.' },
  { id: 'maxim', w: 0.4, setting: 'none', text: 'One or two sentences of the archive\'s own house wisdom about history, records, or forgetting, made concrete by one specific example.' },
];

export const DEVICES = [
  { id: 'divergence', w: 1.6, text: 'A real historical moment went one small detail differently, with outsized consequences. Stay close enough to real history that a reader half-believes it.' },
  { id: 'category_error', w: 1.2, text: 'Something abstract (a season, a silence, an echo, a colour, a weekday, a smell) is treated as a legal person, taxable good, combatant, or territory, and the system handles it seriously.' },
  { id: 'scale', text: 'A grotesque mismatch of scale: vast institutional machinery devoted to something tiny, or something enormous handled as petty paperwork.' },
  { id: 'mistranslation', w: 1.1, text: 'A clerical error, mistranslation, misheard word, or typo became law, scripture, geography, or a war, and nobody went back to fix it.' },
  { id: 'quiet_loss', text: 'Something that used to exist (a weekday, a colour, a sense, a sea, a letter, a profession, a direction) was abolished or lost, and the record notes it without fuss.' },
  { id: 'rule_change', w: 0.8, text: 'One law of nature was locally amended by decree, and administration proceeds accordingly.' },
  { id: 'plausible_fake', w: 1.2, text: 'No supernatural element at all. A perfectly plausible obscure historical fact that happens to be invented, absurd only on the second read.' },
  { id: 'vestigial_office', text: 'An office, ritual, or institution has outlived its purpose by centuries and is still running, with full staff.' },
  { id: 'petty_cause', text: 'A major historical event is traced, in exact detail, to a petty, domestic, or personal cause.' },
  { id: 'negotiation', text: 'People negotiate, sign treaties with, trade with, or litigate against an animal species, a landform, the weather, or the sea, and the other party behaves consistently.' },
  { id: 'recursion', w: 0.5, text: 'The record itself becomes part of the event: a chronicle that causes what it records, a map that annexes, a census that creates people.' },
  { id: 'anachronism', w: 0.35, text: 'An idea, word, habit, or object appears centuries early. Make it mundane and specific (a queueing system, a receipt, a sarcastic phrase), never a gadget.' },
];

// Place + period pairs, so the combination is coherent. Deliberately not just Europe.
export const SETTINGS = [
  'Uruk, c. 2900 BCE', 'Mohenjo-daro, c. 2300 BCE', 'Hattusa, 13th c. BCE', 'Nineveh, 7th c. BCE',
  'Carthage, 3rd c. BCE', 'Ptolemaic Alexandria', 'Han-dynasty Chang\'an', 'Axum, 4th c.',
  'Sasanian Ctesiphon', 'Byzantine Ravenna, 6th c.', 'Tang-dynasty Chang\'an, 8th c.', 'Abbasid Baghdad, 9th c.',
  'Heian Kyoto, 10th c.', 'Umayyad Córdoba, 10th c.', 'Norse Greenland, 11th c.', 'Song-dynasty Kaifeng, 11th c.',
  'Angkor, 12th c.', 'Cahokia, 12th c.', 'Novgorod, 12th–15th c.', 'Seljuk Konya, 13th c.',
  'Empire of Trebizond, 14th c.', 'Mali Empire, Timbuktu, 14th c.', 'Great Zimbabwe, 14th c.', 'Hanseatic Lübeck, 14th c.',
  'Republic of Ragusa, 15th c.', 'Majapahit Java, 14th c.', 'Avignon papacy, 14th c.', 'Timurid Samarkand, 15th c.',
  'Medieval Iceland, the Althing', 'Tenochtitlan, early 16th c.', 'Inca Cusco, early 16th c.', 'Kingdom of Kongo, 16th c.',
  'Kilwa Sultanate, 16th c.', 'Safavid Isfahan, 17th c.', 'Mughal Agra, 17th c.', 'Ottoman Bursa, 16th c.',
  'Venetian Crete, 16th c.', 'Polish–Lithuanian Commonwealth, 17th c.', 'Dutch Batavia, 17th c.', 'Portuguese Goa, 16th c.',
  'Potosí silver mines, 17th c.', 'Ayutthaya, 17th c.', 'Joseon Korea, 17th c.', 'Edo Japan, early 18th c.',
  'Restoration London, 1660s', 'Habsburg Vienna, 18th c.', 'Ottoman Erzurum, 18th c.', 'Qing Canton, 18th c.',
  'Colonial Lima, 18th c.', 'Revolutionary Paris, 1790s', 'Republic of Vermont, 1780s', 'Cape Colony, 1800s',
  'Sokoto Caliphate, 1810s', 'Napoleonic Ionian Islands', 'Imperial Russia, Tobolsk, 1830s', 'Victorian Manchester, 1840s',
  'Gold Rush San Francisco, 1850', 'Meiji Japan, 1870s', 'Ottoman Thessaloniki, 1890s', 'Klondike, 1898',
  'Zanzibar, 1896', 'Belle Époque Vienna, 1900s', 'Edwardian Antarctica expeditions', 'Weimar Berlin, 1920s',
  'Interwar Istanbul, 1920s', 'Soviet Kazakhstan, 1930s', 'Dust Bowl Oklahoma, 1930s', 'Post-war Bonn, 1950s',
  'Cold War Iceland, 1960s', 'Socialist Ulaanbaatar, 1970s', 'Apartheid-era Cape Town bureaucracy, 1970s', 'Brezhnev-era Tbilisi',
  'Faroe Islands, any century', 'Svalbard coal towns, 1920s', 'Tierra del Fuego, 1880s', 'Cappadocia, Byzantine era',
  'Medieval Welsh border marches', 'Basque whaling ports, 16th c.', 'Moravian mining towns, 15th c.', 'Ottoman Hejaz railway, 1908',
  'Swahili coast, Lamu, 17th c.', 'Ming-dynasty Nanjing, 15th c.', 'Burgundian Netherlands, 15th c.', 'Sicily under Frederick II, 13th c.',
];

// Concrete nouns to hang the joke on. Two are rolled per tweet.
export const MOTIFS = [
  'herring', 'lentils', 'salt', 'pepper', 'saffron', 'eels', 'figs', 'barley', 'honey', 'vinegar', 'olives', 'hazelnuts',
  'geese', 'bees', 'oxen', 'a single goat', 'pigeons', 'cormorants', 'camels', 'silkworms', 'oysters', 'a horse with a title',
  'bells', 'clocks', 'sundials', 'hourglasses', 'almanacs', 'abacuses', 'weights and measures', 'scales', 'seals and wax',
  'ink', 'vellum', 'erasers', 'commas', 'the letter Q', 'a missing page', 'marginal doodles', 'a misprint',
  'bridges', 'lighthouses', 'wells', 'canals', 'city walls', 'staircases', 'chimneys', 'windmills', 'a gate nobody uses',
  'fog', 'tides', 'eclipses', 'hailstorms', 'an unusually long dusk', 'drought', 'a comet', 'an earthquake that was very polite',
  'Tuesdays', 'leap years', 'the calendar', 'noon', 'midnight', 'the 13th month', 'birthdays', 'a holiday nobody remembers',
  'chess', 'backgammon', 'dice', 'playing cards', 'a ball game', 'kites', 'puppets', 'fireworks',
  'mustaches', 'wigs', 'hats', 'buttons', 'shoes', 'umbrellas', 'spectacles', 'gloves',
  'census-takers', 'tax collectors', 'notaries', 'lamplighters', 'ferrymen', 'town criers', 'cartographers', 'translators',
  'apologies', 'echoes', 'silence', 'whistling', 'laughter', 'yawning', 'sneezing', 'a particular rhyme',
  'maps', 'borders', 'an island that moved', 'a river with two names', 'a mountain nobody climbed', 'the coastline',
  'coins', 'debts', 'receipts', 'interest', 'IOUs', 'a currency of feathers', 'customs duties', 'tolls',
  'saints', 'relics', 'a minor heresy', 'a sermon that ran long', 'a pilgrimage', 'a monastery library',
  'ambassadors', 'hostages', 'gifts between rulers', 'a treaty signing', 'diplomatic precedence', 'a seating chart',
  'tulips', 'coffee', 'tea', 'tobacco', 'sugar', 'potatoes', 'opium poppies', 'chilli peppers',
  'bathhouses', 'cemeteries', 'prisons', 'post offices', 'libraries', 'observatories', 'zoos', 'menageries',
  'telegrams', 'stamps', 'train timetables', 'typewriters', 'gramophones', 'street names', 'house numbers', 'queues',
];

export const REGISTERS = [
  { id: 'deadpan', w: 3, text: 'deadpan and clinical' },
  { id: 'scholarly', w: 1.5, text: 'dry and scholarly, a little pedantic' },
  { id: 'official', w: 1, text: 'pompous and official' },
  { id: 'elegiac', w: 0.8, text: 'quietly elegiac, a little sad' },
  { id: 'petty', w: 0.8, text: 'petty and aggrieved, as if the record still holds a grudge' },
];

export const LENGTHS = [
  { id: 'short', w: 0.35, text: 'short: under 140 characters. Brevity is the joke.' },
  { id: 'medium', w: 0.45, text: 'medium: 140–210 characters.' },
  { id: 'long', w: 0.2, text: 'long: 210–270 characters. Only if every clause earns its place.' },
];
