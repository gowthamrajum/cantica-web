// Single source of truth for church-specific content.
import type { ServiceLink } from './links'

export { usableLinks } from './links'
export type { ServiceLink } from './links'

export interface ServiceTime {
  name: string
  te: string
  when: string
  where: string
  note?: string
  /** Short form for compact rows ("Sun · 11:00 AM"). */
  short: string
  /** How to join or watch this one from home. */
  links?: ServiceLink[]
}

export const CHURCH = {
  name: 'Telugu Community Church',
  nameTe: 'తెలుగు కమ్యూనిటీ చర్చి',
  short: 'TCC',
  city: 'Irving, Texas',
  tagline: 'Grace and peace to you',
  taglineTe: 'రండి, ఆయనను ఆరాధిద్దాం',
  welcome:
    'We are a warm, Christ-centered Telugu family in the heart of the Dallas–Fort Worth metroplex. Wherever you are on your journey of faith, there is a place for you here.',
  website: 'https://teluguchurchdfw.org',
  giving: 'https://teluguchurchdfw.org',
  address: '8001 Mustang Drive, Irving, TX 75038',
  mapUrl: 'https://maps.apple.com/?q=8001%20Mustang%20Drive%20Irving%20TX%2075038',
  mapUrlG: 'https://www.google.com/maps/search/?api=1&query=8001+Mustang+Drive+Irving+TX+75038',
  liveTime: 'Sundays · 11:00 AM',
  // Watch stream (the existing Cantica relay). Kept for the Watch CTA.
  watchUrl: 'https://grey-gratis-ice.onrender.com/broadcasts',
  // ---------------------------------------------------------------------
  // The `url` fields below are the church's own addresses and are the one
  // thing here nobody can guess. Paste them in and the buttons appear; leave
  // one blank and its button stays hidden rather than leading nowhere.
  // ---------------------------------------------------------------------
  services: [
    {
      name: 'Worship Service',
      te: 'ఆరాధన సేవ',
      when: 'Sunday · 11:00 AM',
      short: 'Sun · 11:00 AM',
      where: 'In person · 8001 Mustang Drive',
      note: 'The whole family gathers.',
      links: [{ label: 'Watch on YouTube', url: '', kind: 'youtube' }]
    },
    {
      name: 'Bible Study',
      te: 'బైబిల్ స్టడీ',
      when: 'Wednesday · 8:00 PM',
      short: 'Wed · 8:00 PM',
      where: 'Online · on Zoom',
      note: 'Grow deeper in the Word.',
      links: [{ label: 'Join on Zoom', url: '', kind: 'zoom' }]
    },
    {
      name: 'Saturday Prayer',
      te: 'ప్రార్థన సభ',
      when: 'Saturday · 8:00 PM',
      short: 'Sat · 8:00 PM',
      where: 'Online · on Zoom',
      note: 'We pray together.',
      links: [{ label: 'Join on Zoom', url: '', kind: 'zoom' }]
    }
  ] satisfies ServiceTime[],

  /** What a first-time visitor can expect on a Sunday. */
  expect: [
    { t: 'Worship in Telugu', d: 'Songs and the message in our heart language, with warmth for every generation.' },
    { t: 'Come as you are', d: 'No dress code, no pressure — just a friendly welcome at the door.' },
    { t: 'Families welcome', d: 'Children and grandparents worship together as one family.' }
  ],

  /** Longer-form "about us" copy, carried over from the old welcome section. */
  about: [
    'We are a warm, Christ-centered Telugu family in the heart of the Dallas–Fort Worth metroplex. Wherever you are on your journey of faith, there is a place for you here.',
    'We gather to worship in our heart language, to open the Word together, and to care for one another as family. Whether you were born into faith or are only beginning to wonder, you’ll find a seat saved for you.'
  ],

  /** Zeffy donation form — Zeffy passes 100% of a gift on to the church. */
  zeffyId: 'e6f000a9-b7eb-4b75-8a76-f5ffca44013c'
}

export const zeffyEmbedUrl = `https://www.zeffy.com/embed/donation-form/${CHURCH.zeffyId}`
export const zeffyFormUrl = `https://www.zeffy.com/en-US/donation-form/${CHURCH.zeffyId}`

/** The next weekly gathering, as a friendly "Today"/"Tomorrow"/weekday label. */
export function nextGathering(now = new Date()): { service: ServiceTime; when: string } {
  // day-of-week each service falls on, matched to CHURCH.services order.
  const days = [0, 3, 6] // Sunday, Wednesday, Saturday
  const hours = [11, 20, 20]
  const today = now.getDay()

  let best = 0
  let bestDelta = Infinity
  for (let i = 0; i < days.length; i++) {
    let delta = (days[i] - today + 7) % 7
    // Already past today's start time → it's next week's.
    if (delta === 0 && now.getHours() >= hours[i] + 2) delta = 7
    if (delta < bestDelta) {
      bestDelta = delta
      best = i
    }
  }

  const service = CHURCH.services[best]
  const when = bestDelta === 0 ? 'Today' : bestDelta === 1 ? 'Tomorrow' : service.short.split(' · ')[0]
  return { service, when }
}
