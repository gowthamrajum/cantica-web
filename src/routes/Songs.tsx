import { byDevice } from './variant'
import { Songs as Mobile } from './mobile/Songs'
import { Songs as Desktop } from './desktop/Songs'

/** Two versions — the phone screen and the desktop page. See ./variant. */
export const Songs = byDevice(Mobile, Desktop)
