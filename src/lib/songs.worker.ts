/// <reference lib="webworker" />
import { countSongs, getSong, listSongs, searchPage } from './songSearch'

/**
 * The songbook, off the main thread.
 *
 * Indexing four and a half thousand songs takes most of a second on a laptop
 * and several on a phone, and it used to happen on the first keystroke — so the
 * first thing anyone typed froze the app. Per-query cost is smaller but grows
 * with the library too, and it lands between one keypress and the next, which
 * is exactly where a stall is felt.
 *
 * So the library lives here instead. The worker owns the only copy of the song
 * data — eleven megabytes of it — which is also why `getSong` is answered here
 * rather than by handing the whole library to the main thread as well.
 */

type Req =
  | { id: number; op: 'list'; search: string }
  | { id: number; op: 'page'; search: string; offset: number; limit: number }
  | { id: number; op: 'get'; songId: number }
  | { id: number; op: 'count' }

self.onmessage = async (e: MessageEvent<Req>): Promise<void> => {
  const msg = e.data
  try {
    const value =
      msg.op === 'list'
        ? await listSongs(msg.search)
        : msg.op === 'page'
          ? await searchPage(msg.search, msg.offset, msg.limit)
          : msg.op === 'get'
            ? await getSong(msg.songId)
            : await countSongs()
    ;(self as unknown as Worker).postMessage({ id: msg.id, value })
  } catch (err) {
    // The caller is waiting on a promise; a silent failure would hang it for
    // the life of the page.
    ;(self as unknown as Worker).postMessage({
      id: msg.id,
      error: err instanceof Error ? err.message : 'search failed'
    })
  }
}
