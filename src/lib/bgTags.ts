/**
 * Tags for the background library — suggested from a video's name so a
 * library stays searchable without anyone typing much. Motion-background
 * packs name their files descriptively ("Christmas Candlelight Motion
 * Background 23", "Rocky Falls Motion Background 07"), so the words already
 * say what is in them; this turns those words into a small, consistent set.
 */
const RULES: [RegExp, string][] = [
  [/christmas|xmas|nativity|advent/i, 'christmas'],
  [/easter|resurrection|risen/i, 'easter'],
  [/good friday|cross|calvary|crown/i, 'cross'],
  [/candle/i, 'candles'],
  [/light(s)?\b|bokeh|glow|sparkle/i, 'lights'],
  [/water|falls?\b|river|lake|ocean|sea\b|rain|stream|creek|wave/i, 'water'],
  [/mountain|hill|peak|rock(y)?\b|canyon|cliff/i, 'mountains'],
  [/cloud|sky|sunset|sunrise|dawn|dusk|horizon/i, 'sky'],
  [/forest|tree|leaf|leaves|wood(s)?\b|meadow|field|grass|flower|bloom|garden|nature/i, 'nature'],
  [/spring|awakening/i, 'spring'],
  [/summer/i, 'summer'],
  [/autumn|fall colou?rs|harvest/i, 'autumn'],
  [/winter|snow|frost|ice\b/i, 'winter'],
  [/abstract|particle|shape|geometric|gradient/i, 'abstract'],
  [/space|stars?\b|galaxy|nebula|cosmic/i, 'space'],
  [/worship|praise|glory/i, 'worship']
]

/** Tags a name suggests — the rules above, in their order, no repeats. */
export function suggestTags(name: string): string[] {
  const out: string[] = []
  for (const [re, tag] of RULES) if (re.test(name) && !out.includes(tag)) out.push(tag)
  return out
}

/** As the relay keeps them: lower-case, trimmed, no leading #, no repeats. */
export function cleanTag(t: string): string {
  return t.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, 24)
}
