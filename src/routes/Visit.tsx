import { byDevice } from './variant'
import { Visit as Mobile } from './mobile/Visit'
import { Visit as Desktop } from './desktop/Visit'

/** Two versions — the phone screen and the desktop page. See ./variant. */
export const Visit = byDevice(Mobile, Desktop)
