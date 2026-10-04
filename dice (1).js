// dice.js — the random brief for each tweet.
// The bot rolls these in code instead of asking the model to "be varied"
// (models are bad at randomness; they're good at executing a specific brief).
// Edit freely: add forms, settings, motifs. Weights default to 1.

// setting: 'required' | 'optional' | 'none'
export const FORMS = [
  { id: 'errata', w: 1.0, setting: 'optional', text: 'An errata slip for a history book we never see: "for X read Y", where the correction reveals something impossible or sinister about what the book had been recording. The account\'s namesake form. The correction must be readable at a glance.' },
  { id: 'encyclopedia', w: 1.3, setting: 'required', text: 'The opening lines of an encyclopedia article on an invented event, place, person, or phenomenon that breaks a rule of reality. Flat reference-work voice, dates in parentheses.' },
  { id: 'catalog', w: 1.4, setting: 'required', text: 'An archive finding-aid entry: shelfmark or record title, date, then a scope note that states what the file contains and why that is impossible, flatly.' },
  { id: 'deposition', w: 1.3, setting: 'required', text: 'A witness statement or sworn deposition (a few lines, direct speech) describing something that could not have happened, as if it had. The magistrate or clerk adds a one-line administrative response.' },
  { id: 'logbook', w: 1.4, setting: 'required', text: 'A ship\'s log, field notebook, caravan journal, or expedition diary entry: dated, terse, observational. Something is wrong with the count, the sky, the map, or the crew.' },
  { id: 'letter', w: 1.2, setting: 'required', text: 'An excerpt from a private letter or diplomatic dispatch, with a short sender/place/date attribution. The writer reports something impossible as routine news.' },
  { id: 'obituary', w: 1.0, setting: 'required', text: 'A death notice or burial-register entry in which the dead person\'s behaviour after, before, or instead of death is the story.' },
  { id: 'marker', w: 1.2, setting: 'required', text: 'The text of a roadside historical marker or museum placard, in that solemn register. All caps allowed. States what happened here, and the paperwork consequence.' },
  { id: 'notice', w: 1.0, setting: 'required', text: 'A notice from a period newspaper: lost & found, wanted, public notice, or a correction/retraction. Something reality-breaking is dealt with in the voice of a classified ad.' },
  { id: 'divergence', w: 0.9, setting: 'required', text: 'No framing device. One plain statement about what happened in a version of history that did not make the record. The impossibility is in the first sentence.' },
  { id: 'footnote', w: 0.8, setting: 'optional', text: 'A scholarly footnote (start with a number) to a book we never see. The footnote quietly states the impossible thing and moves on.' },
  { id: 'court', w: 0.9, setting: 'required', text: 'A court record or judgment about something that should not be a legal matter: parties, claim, ruling, penalty. Terse legal register. The strangeness must be in the facts of the case, not just the wording.' },
  { id: 'proclamation', w: 0.7, setting: 'required', text: 'A royal or municipal proclamation, in read-aloud-in-the-square cadence, responding to a reality problem the town is having.' },
  { id: 'transcript', w: 0.9, setting: 'required', text: 'Two to four lines of an interview or oral-history transcript (speaker labels). The speaker casually mentions something impossible.' },
  { id: 'auction', w: 0.6, setting: 'required', text: 'An auction-house lot description: lot number, object, date, provenance, estimate. The object does something it should not.' },
  { id: 'chronology', w: 0.7, setting: 'required', text: 'A 3–4 line dated timeline, one event per line, each line making the previous one worse. Line breaks between lines. The sequence must be understandable without outside knowledge.' },
  { id: 'ledger', w: 0.6, setting: 'required', text: 'Line items from an account book or customs register where one item is impossible and has been charged for anyway.' },
  { id: 'translator', w: 0.5, setting: 'required', text: 'A translator\'s or editor\'s note on how one word in a historical source was rendered, and what that choice did to history. The effect must be stated plainly.' },
  { id: 'minutes', w: 0.5, setting: 'required', text: 'Minutes of a council, guild, or committee meeting where the agenda item is something reality-breaking: motion, vote, outcome.' },
  { id: 'etymology', w: 0.4, setting: 'optional', text: 'A dictionary etymology tracing a word to an invented historical event that is itself impossible.' },
  { id: 'treaty', w: 0.5, setting: 'required', text: 'A single article of a treaty or edict, in real legal cadence, that makes clear in the text itself who the parties are and what impossible thing is being agreed to. No decoding allowed.' },
  { id: 'maxim', w: 0.3, setting: 'none', text: 'Two or three sentences of the archive\'s own house wisdom about records, memory, or events that were lost, made concrete by one specific invented example.' },
  { id: 'index', w: 0.15, setting: 'none', text: 'A back-of-book index fragment, line breaks between entries. The impossible fact must be readable from the entries alone, without outside knowledge.' },
  { id: 'exam', w: 0.15, setting: 'required', text: 'One exam question from a history course about an impossible event, stating the event plainly. No answer.' },
  { id: 'bibliography', w: 0.1, setting: 'none', text: 'One to three bibliography citations whose titles alone state the impossible thing.' },
];

export const DEVICES = [
  { id: 'impossible_event', w: 2.2, text: 'An event that is documented in detail but could not have happened: a town that was absent for a week and invoiced anyway, a battle two sides witnessed that no army fought, a day that occurred twice. State the impossible fact flatly in the first sentence.' },
  { id: 'record_contradiction', w: 1.7, text: 'The record contains something that cannot be in it: an entry dated before the event it records, a signature from someone dead or unborn, a witness to his own funeral, a name filed with no person. Plain, specific, wrong.' },
  { id: 'wrong_world', w: 1.4, text: 'One law of nature or fact of geography is locally different, and the record treats it as routine (a river running uphill for a decade, a coast found a day\'s walk inland, a village where the hours do not all arrive). Administration proceeds accordingly.' },
  { id: 'paper_only', w: 1.3, text: 'Something exists only on paper: a town on every ledger that no one visited, a person who paid taxes for nineteen years without being seen, a king who reigned between two kings. The paperwork is flawless; the thing is not there.' },
  { id: 'quiet_loss', w: 1.0, text: 'Something that used to exist (a weekday, a colour, a sense, a sea, a letter, a profession, a direction) was removed from the world, and the record notes it without fuss.' },
  { id: 'recursion', w: 0.9, text: 'The record itself becomes part of the event: a chronicle that causes what it records, a map that annexes the land it draws, a census that creates people.' },
  { id: 'negotiation', w: 0.8, text: 'People negotiate with, litigate against, or pay taxes to an animal species, a landform, the weather, or the sea, and the other party behaves consistently. Real consequences, not whimsy.' },
  { id: 'category_error', w: 0.8, text: 'Something abstract (a season, a silence, an echo, a colour, a weekday, a smell) is treated as a legal person, taxable good, or combatant, and the system handles it with total seriousness.' },
  { id: 'vestigial_office', w: 0.7, text: 'An office, ritual, or institution has outlived its purpose, and its purpose turns out to have been something unsettling that is still going on.' },
  { id: 'divergence', w: 0.8, text: 'A real historical moment went one small detail differently, with outsized, slightly eerie consequences. Stay close to real history.' },
  { id: 'mistranslation', w: 0.5, text: 'A clerical error, mistranslation, or misheard word became law, geography, or a war, and nobody went back to fix it. The consequence must be plainly stated.' },
  { id: 'anachronism', w: 0.3, text: 'An idea, word, or habit appears centuries early. Make it mundane and specific (a queueing system, a receipt, a sarcastic phrase), never a gadget.' },
  { id: 'scale', w: 0.5, text: 'Vast institutional machinery devoted to something tiny, or something enormous handled as petty paperwork, where the enormous thing is actually impossible.' },
  { id: 'petty_cause', w: 0.3, text: 'A major historical event is traced, in exact detail, to a petty, domestic, or personal cause that is itself slightly impossible.' },
  { id: 'plausible_fake', w: 0.1, text: 'A plausible obscure historical fact that happens to be invented, absurd only on the second read.' },
];

// how far reality has failed in this entry
export const STRANGENESS = [
  { id: 'clear', w: 0.3, text: 'CLEAR. One impossible thing, stated plainly and early. Documented, witnessed, filed.' },
  { id: 'severe', w: 0.55, text: 'SEVERE. Reality has visibly failed. After the first impossibility, add a second detail that makes it worse, not merely stranger. The reader should feel the floor move while the clerk stays calm.' },
  { id: 'wry', w: 0.15, text: 'WRY. Only slightly off: alternate history with a single skewed fact. Still instantly legible.' },
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
