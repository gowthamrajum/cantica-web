// Bibles are vendored as static files under public/data/bible and served by the
// app itself (no API). Fetched whole once per language, indexed, memory-cached
// (+ service-worker cached for offline). Telugu OV + WEBBE share versification.
export type Lang = 'te' | 'en' | 'both'

export interface Verse {
  book: string
  chapter: number
  verse: number
  text: string
}
interface RawBible {
  name: string
  language: string
  order: string[]
  names?: Record<string, string>
  verses: Verse[]
}
export interface IndexedBible {
  name: string
  order: string[]
  byBook: Record<string, Record<number, Verse[]>>
  chapters: Record<string, number>
}

// Telugu book names, bundled so they render instantly and in English-only mode.
export const TE_BOOKS: Record<string, string> = {
  Genesis: 'ఆదికాండము', Exodus: 'నిర్గమకాండము', Leviticus: 'లేవీయకాండము', Numbers: 'సంఖ్యాకాండము',
  Deuteronomy: 'ద్వితీయోపదేశకాండము', Joshua: 'యెహొషువ', Judges: 'న్యాయాధిపతులు', Ruth: 'రూతు',
  '1 Samuel': 'సమూయేలు మొదటి గ్రంథము', '2 Samuel': 'సమూయేలు రెండవ గ్రంథము',
  '1 Kings': 'రాజులు మొదటి గ్రంథము', '2 Kings': 'రాజులు రెండవ గ్రంథము',
  '1 Chronicles': 'దినవృత్తాంతములు మొదటి గ్రంథము', '2 Chronicles': 'దినవృత్తాంతములు రెండవ గ్రంథము',
  Ezra: 'ఎజ్రా', Nehemiah: 'నెహెమ్యా', Esther: 'ఎస్తేరు', Job: 'యోబు గ్రంథము', Psalms: 'కీర్తనల గ్రంథము',
  Proverbs: 'సామెతలు', Ecclesiastes: 'ప్రసంగి', 'Song of Songs': 'పరమగీతము', Isaiah: 'యెషయా గ్రంథము',
  Jeremiah: 'యిర్మీయా', Lamentations: 'విలాపవాక్యములు', Ezekiel: 'యెహెజ్కేలు', Daniel: 'దానియేలు',
  Hosea: 'హొషేయ', Joel: 'యోవేలు', Amos: 'ఆమోసు', Obadiah: 'ఓబద్యా', Jonah: 'యోనా', Micah: 'మీకా',
  Nahum: 'నహూము', Habakkuk: 'హబక్కూకు', Zephaniah: 'జెఫన్యా', Haggai: 'హగ్గయి', Zechariah: 'జెకర్యా',
  Malachi: 'మలాకీ', Matthew: 'మత్తయి సువార్త', Mark: 'మార్కు సువార్త', Luke: 'లూకా సువార్త',
  John: 'యోహాను సువార్త', Acts: 'అపొస్తలుల కార్యములు', Romans: 'రోమీయులకు',
  '1 Corinthians': '1 కొరింథీయులకు', '2 Corinthians': '2 కొరింథీయులకు', Galatians: 'గలతీయులకు',
  Ephesians: 'ఎఫెసీయులకు', Philippians: 'ఫిలిప్పీయులకు', Colossians: 'కొలొస్సయులకు',
  '1 Thessalonians': '1 థెస్సలొనీకయులకు', '2 Thessalonians': '2 థెస్సలొనీకయులకు',
  '1 Timothy': '1 తిమోతికి', '2 Timothy': '2 తిమోతికి', Titus: 'తీతుకు', Philemon: 'ఫిలేమోనుకు',
  Hebrews: 'హెబ్రీయులకు', James: 'యాకోబు', '1 Peter': '1 పేతురు', '2 Peter': '2 పేతురు',
  '1 John': '1 యోహాను', '2 John': '2 యోహాను', '3 John': '3 యోహాను', Jude: 'యూదా', Revelation: 'ప్రకటన గ్రంథము'
}
export function teBook(book: string): string {
  return TE_BOOKS[book] ?? book
}

// Loaded via dynamic import → a lazy, hashed JS chunk (no .json network request).
const loaders: Record<'telugu' | 'web', () => Promise<{ default: unknown }>> = {
  telugu: () => import('../data/bibleTe.json'),
  web: () => import('../data/bibleEn.json')
}
const cache: Partial<Record<'telugu' | 'web', Promise<IndexedBible>>> = {}

function index(raw: RawBible): IndexedBible {
  const byBook: Record<string, Record<number, Verse[]>> = {}
  const chapters: Record<string, number> = {}
  for (const v of raw.verses) {
    const b = (byBook[v.book] ??= {})
    ;(b[v.chapter] ??= []).push(v)
    if (v.chapter > (chapters[v.book] ?? 0)) chapters[v.book] = v.chapter
  }
  return { name: raw.name, order: raw.order, byBook, chapters }
}

export function loadBible(which: 'telugu' | 'web'): Promise<IndexedBible> {
  if (!cache[which]) {
    cache[which] = loaders[which]().then((m) => index(m.default as RawBible))
  }
  return cache[which]!
}
