// Single source of truth for church-specific content.
export interface ServiceTime {
  name: string
  te: string
  when: string
  where: string
  note?: string
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
  services: [
    { name: 'Worship Service', te: 'ఆరాధన సేవ', when: 'Sunday · 11:00 AM', where: 'In person · 8001 Mustang Drive', note: 'The whole family gathers.' },
    { name: 'Bible Study', te: 'బైబిల్ స్టడీ', when: 'Wednesday · 8:00 PM', where: 'Online · on Zoom', note: 'Grow deeper in the Word.' },
    { name: 'Saturday Prayer', te: 'ప్రార్థన సభ', when: 'Saturday · 8:00 PM', where: 'Online · on Zoom', note: 'We pray together.' }
  ] satisfies ServiceTime[]
}
