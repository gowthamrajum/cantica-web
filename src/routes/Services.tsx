import { byDevice } from './variant'
import { Services as Mobile } from './mobile/Services'
import { Services as Desktop } from './desktop/Services'

/** Two versions — the phone screen and the desktop page. See ./variant. */
export const Services = byDevice(Mobile, Desktop)
