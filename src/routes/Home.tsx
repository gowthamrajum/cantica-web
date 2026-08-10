import { byDevice } from './variant'
import { Home as Mobile } from './mobile/Home'
import { Home as Desktop } from './desktop/Home'

/** Two versions — the phone screen and the desktop page. See ./variant. */
export const Home = byDevice(Mobile, Desktop)
