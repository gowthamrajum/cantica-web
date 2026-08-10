import { byDevice } from './variant'
import { About as Mobile } from './mobile/About'
import { About as Desktop } from './desktop/About'

/** Two versions — the phone screen and the desktop page. See ./variant. */
export const About = byDevice(Mobile, Desktop)
