// dice_turk.js — Kayıp Defter's dice. Same mechanism as dice.js, Ottoman/Anatolian world.
// Form texts are English instructions; the model writes the tweet in Turkish.

import { DEVICES as BASE_DEVICES, LENGTHS as BASE_LENGTHS, STRANGENESS as BASE_STRANGENESS } from './dice.js';

// setting: 'required' | 'optional' | 'none'
export const FORMS = [
  { id: 'fihrist', w: 1.4, setting: 'required', text: 'An archive finding-aid (fihrist) entry: record title, date, then a short scope note stating what the file contains and why that is impossible, flatly.' },
  { id: 'ifade', w: 1.3, setting: 'required', text: 'A witness statement (şahit ifadesi) given before a kadı or in a zabıt varakası: a few lines of direct speech describing something that could not have happened, as if it had. The kadı or clerk adds one administrative line.' },
  { id: 'seyir', w: 1.2, setting: 'required', text: 'A dated menzil/kervan/gemi/seyir defteri entry or field note: terse, observational. Something is wrong with the count, the sky, the road, or the crew.' },
  { id: 'seyahatname', w: 1.2, setting: 'required', text: 'A passage in the voice of Evliya Çelebi\'s Seyahatname: confident first person, hyperbole, local marvels, numbers that are too precise. Attribute it to a lost volume or a lost page. The marvel must be graspable at once.' },
  { id: 'ansiklopedi', w: 1.3, setting: 'required', text: 'The opening of an encyclopedia article (TDV İslâm Ansiklopedisi voice) on an invented event or place that breaks a rule of reality: HEADWORD IN CAPS (years), then flat reference prose.' },
  { id: 'gazete', w: 1.2, setting: 'required', text: 'A notice from a period newspaper (Takvîm-i Vekāyi, İkdam, Servet-i Fünûn, Akşam, Cumhuriyet…): kayıp ilanı, tekzip, resmî ilan, or düzeltme. Something reality-breaking in the voice of a classified ad. Newspaper name and date at the end.' },
  { id: 'kadi_sicili', w: 1.0, setting: 'required', text: 'An entry from a kadı sicili about something that should not be a legal matter: davacı, davalı, iddia, hüküm. Terse court register; the strangeness must be in the facts of the case, not only the wording.' },
  { id: 'mektup', w: 1.2, setting: 'required', text: 'An excerpt from a private letter, a consular dispatch, or a Venetian bailo\'s report, with a short sender/place/date attribution. The writer reports something impossible as routine news.' },
  { id: 'kitabe', w: 1.0, setting: 'required', text: 'The text of a mezar taşı or çeşme kitabesi, in its formulae (Hüve\'l-Bâkî, ruhuna fâtiha, sene…), where the deceased\'s or donor\'s afterlife, absence, or deeds are the story.' },
  { id: 'tabela', w: 1.0, setting: 'required', text: 'A museum label or a brown historical-site sign (Kültür ve Turizm Bakanlığı tabelası) in its slightly-too-solemn register. All caps allowed. States what happened here and the paperwork consequence.' },
  { id: 'hata_sevap', w: 1.0, setting: 'optional', text: 'A "hata-sevap cetveli" (Ottoman errata table) for a history book: "X yerine Y okunmalıdır", where the correction reveals something impossible about what the book recorded. Readable at a glance. The account\'s namesake form.' },
  { id: 'alternatif', w: 1.0, setting: 'required', text: 'No framing device. A plain statement of what happened in a version of history that did not make the record. The impossibility is in the first sentence.' },
  { id: 'ferman', w: 0.9, setting: 'required', text: 'A ferman, hüküm, or irade responding to a reality problem the province is having: who it is addressed to, what is ordered, in "emr-i şerifim vusûlünde…" cadence, plainly readable to a modern Turkish reader.' },
  { id: 'arzuhal', w: 0.8, setting: 'required', text: 'An arzuhal (petition) from a subject to the authorities: humble formulae, a grievance about something impossible.' },
  { id: 'dipnot', w: 0.8, setting: 'optional', text: 'A scholarly footnote (start with a number) to a book we never see. The footnote quietly states the impossible thing and moves on.' },
  { id: 'vakfiye', w: 0.8, setting: 'required', text: 'A condition (şart) from a vakfiye, the founding deed of a pious foundation, and the unsettling thing its perpetuity has been doing for centuries.' },
  { id: 'kronoloji', w: 0.7, setting: 'required', text: 'A 3–4 line dated timeline, one event per line, each making the last one worse. Line breaks between lines. Understandable without outside knowledge.' },
  { id: 'tahrir', w: 0.5, setting: 'required', text: 'A line from a tahrir defteri or avarız register: village, households, taxes owed, and one entry that cannot exist, charged for anyway.' },
  { id: 'tereke', w: 0.5, setting: 'required', text: 'A line or two from a tereke defteri (estate inventory): possessions, debts, division among heirs, where one item listed is impossible.' },
  { id: 'zabit', w: 0.5, setting: 'required', text: 'Minutes (zabıt) of a meclis, divan, encümen, or esnaf loncası meeting whose agenda item is something reality-breaking: motion, votes, outcome.' },
  { id: 'muzayede', w: 0.5, setting: 'required', text: 'An auction catalogue lot: lot number, object, date, provenance, estimate in TL. The object does something it should not.' },
  { id: 'mutercim', w: 0.4, setting: 'required', text: 'A mütercim/editor\'s note on how one word in a historical source was rendered, and what that did to history. The effect must be stated plainly.' },
  { id: 'lugat', w: 0.4, setting: 'optional', text: 'A dictionary entry (Kamus-ı Türkî or TDK style): headword, meaning, and an etymology traced to an invented, impossible event.' },
  { id: 'vecize', w: 0.3, setting: 'none', text: 'Two or three sentences of the archive\'s own house wisdom about defterler, records, or lost events, made concrete by one invented example.' },
  { id: 'kpss', w: 0.15, setting: 'required', text: 'A multiple-choice history exam question (KPSS / lise tarih style) with options A–E on separate lines, stating an impossible event plainly. No answer given.' },
];

export const DEVICES = [
  ...BASE_DEVICES,
  { id: 'calendar', w: 1.0, text: 'The Rumi, Hicri, and Miladi calendars disagree, and someone lived, owed money, or fought a war in the gap between them. (Don\'t print a date conversion you aren\'t sure of.)' },
  { id: 'script_reform', w: 0.7, text: 'A letter, sound, spelling, or word was lost or changed in a script or language reform (1928 harf inkılabı, dil devrimi, imla kılavuzu) and something left with it. Keep it about language, never about the people who led the reform.' },
  { id: 'surname', w: 0.6, text: 'Something went wrong, absurdly and administratively, during the 1934 Soyadı Kanunu registrations or a nüfus sayımı.' },
];

export const SETTINGS = [
  'Göbeklitepe, c. 9500 BCE', 'Çatalhöyük, c. 7000 BCE', 'Hattuşa, 13th c. BCE', 'Urartu, Tuşpa (Van), 8th c. BCE',
  'Phrygian Gordion, 8th c. BCE', 'Lydian Sardis, 6th c. BCE', 'Hellenistic Pergamon', 'Roman Ephesus',
  'Byzantine Constantinople, 6th c.', 'Byzantine Cappadocia, 10th c.', 'Orhun valley, Göktürk Khaganate, 8th c.', 'Karakhanid Kaşgar, 11th c.',
  'Malazgirt, 1071', 'Seljuk Konya, 13th c.', 'Seljuk Kayseri caravanserais, 13th c.', 'Ahlat, Seljuk graveyard, 13th c.',
  'Mongol-era Sivas, 1240s', 'Beylik-era Aydın and Birgi, 14th c.', 'Karamanid Larende, 14th c.', 'Empire of Trebizond, 14th c.',
  'Early Ottoman Bursa, 14th c.', 'Ottoman Edirne, 15th c.', 'Genoese Galata, 14th c.', 'Genoese Kaffa (Crimea), 15th c.',
  'Topkapı Palace kitchens, 16th c.', 'Süleymaniye külliyesi, 1550s', 'Ottoman Budin, 16th c.', 'Ottoman Bosnia, Saraybosna, 16th c.',
  'Ottoman Cairo, 16th c.', 'Ottoman Damascus, Hajj caravan, 17th c.', 'Ottoman Basra, 17th c.', 'Ottoman Yemen, Mocha coffee port, 17th c.',
  'Girit (Crete) siege of Kandiye, 1660s', 'Kamaniçe (Podolia), 1670s', 'Second siege of Vienna, 1683', 'Ottoman Belgrade, 18th c.',
  'Lale Devri İstanbul, 1720s', 'İbrahim Müteferrika\'s printing press, 1730s', 'Crimean Khanate, Bahçesaray, 18th c.', 'Ottoman Erzurum, 18th c.',
  'Ottoman Diyarbekir, 18th c.', 'Ottoman Mosul, 18th c.', 'Ottoman Selanik, 19th c.', 'Ottoman Trablusgarp (Tripoli), 19th c.',
  'Tanzimat İstanbul, 1840s', 'Bâbıâli bureaucracy, 1860s', 'Ottoman Hejaz, Medina, 1900s', 'Hejaz Railway, 1908',
  'Meşrutiyet Pera, 1909', 'Ottoman İzmir, Kordon, 1890s', 'Ottoman Trabzon, 1890s', 'Ottoman Tokat and Erbaa, 19th c.',
  'Ottoman Beirut, 1890s', 'Ottoman Kudüs, 1900s', 'Ottoman Halep, 1880s', 'Ottoman Kosovo vilayeti, 1900s',
  'Ottoman Tiflis trade, 18th c.', 'Ottoman Rhodes (Rodos), 16th c.', 'Ottoman Cyprus, 17th c. (customs and trade only)', 'Bozcaada wine trade, 19th c.',
  'Darülfünun, İstanbul, 1910s', 'Ankara, 1924', 'Harf İnkılabı classrooms, 1929', 'Soyadı Kanunu, nüfus idaresi, 1934–35',
  'Köy Enstitüleri, 1940s', 'İstanbul tramvayları, 1950s', 'Haydarpaşa Garı, 1930s', 'Kadıköy–Karaköy vapurları, 1960s',
  'Yeşilçam, 1960s', 'Turkish guest workers in Köln, 1960s', 'Zonguldak coal mines, 1950s', 'Rize çay fabrikaları, 1950s',
  'Kapadokya villages, 19th c.', 'Safranbolu, 19th c.', 'Mardin, 19th c.', 'Ottoman Sinop, 18th c.',
];

export const MOTIFS = [
  'lokum', 'simit', 'boza', 'salep', 'aşure', 'baklava', 'tarhana', 'pekmez', 'pilav', 'kuru fasulye', 'helva', 'şerbet',
  'kahve', 'çay', 'tütün', 'afyon', 'fındık', 'incir', 'kayısı', 'zeytin', 'ipek', 'safran', 'tuz', 'pirinç',
  'hamsi', 'lüfer', 'palamut', 'kedi', 'leylek', 'martı', 'tavus kuşu', 'deve', 'posta güvercini', 'ayı oynatıcısı', 'manda', 'arı',
  'lale', 'çınar', 'servi', 'gül', 'karanfil', 'nergis', 'kavak', 'asma',
  'lodos', 'poyraz', 'Boğaz akıntısı', 'sis', 'kar', 'zelzele', 'kuyruklu yıldız', 'güneş tutulması', 'uzun bir ikindi',
  'çeşme', 'sarnıç', 'kervansaray', 'hamam', 'han', 'köprü', 'sur', 'minare', 'saat kulesi', 'muvakkithane', 'kubbe', 'iskele',
  'tuğra', 'mühür', 'divit', 'hokka', 'kalemtıraş', 'ebru kâğıdı', 'yazma bir nüsha', 'eksik bir varak', 'bir imla hatası', 'bir harf',
  'yeniçeri kazanı', 'mehter', 'tulumbacılar', 'saka', 'hamal', 'kayıkçı', 'bekçi', 'tellal', 'kâtip', 'muhtar', 'nüfus memuru', 'tapu kâtibi',
  'fes', 'kavuk', 'bıyık', 'sakal', 'kaftan', 'pabuç', 'terlik', 'yorgan', 'kilim', 'şemsiye', 'gözlük', 'eldiven',
  'tavla', 'satranç', 'karagöz', 'meddah', 'ortaoyunu', 'güreş', 'cirit', 'uçurtma', 'havai fişek',
  'akçe', 'kuruş', 'borç senedi', 'faiz', 'narh', 'gümrük', 'bac', 'kira', 'iflas', 'tefeci',
  'ezan vakti', 'Rumi takvim', 'mali yıl', 'Salı günü', 'öğle vakti', 'bayram', 'Hıdırellez', 'Nevruz', 'Kasım günleri',
  'nazar boncuğu', 'muska', 'rüya tabiri', 'falcı', 'kayıp bir yüzük', 'sandık', 'çeyiz', 'düğün',
  'vapur', 'tramvay', 'telgraf', 'posta pulu', 'tren tarifesi', 'daktilo', 'gramofon', 'sokak adları', 'kapı numaraları', 'kuyruk',
  'elçiler', 'rehineler', 'padişah hediyeleri', 'antlaşma imzası', 'teşrifat', 'oturma düzeni', 'bir haritacı', 'bir mütercim',
];

export const REGISTERS = [
  { id: 'deadpan', w: 3, text: 'deadpan and clinical' },
  { id: 'osmanli', w: 1.5, text: 'Ottoman chancery formality, but readable to a modern Turkish reader (Ottoman terms yes, unreadable Persian-Arabic compounds no)' },
  { id: 'cumhuriyet', w: 1, text: 'early-Republic bureaucratic Turkish: tebliğ, tamim, müdürlük, numbered articles' },
  { id: 'akademik', w: 1, text: 'dry academic Turkish, a little pedantic, the way a tarih hocası writes' },
  { id: 'hüzünlü', w: 0.8, text: 'quietly elegiac, a little hüzün' },
  { id: 'küskün', w: 0.8, text: 'petty and aggrieved, as if the defter still holds a grudge' },
];

export const LENGTHS = BASE_LENGTHS;
export const STRANGENESS = BASE_STRANGENESS;
