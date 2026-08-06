import type { Song, SongMeta, Stanza } from './songSearch'

export type { Song, SongMeta, Stanza }

/**
 * The songbook's public face.
 *
 * Everything here is answered by a worker, because the library is now large
 * enough that indexing it blocks: nearly a second on a laptop, several on a
 * phone, and it landed on the first keystroke. The work is the same work — the
 * worker runs the very module a caller would otherwise have run inline — it
 * simply happens somewhere the typing cursor cannot feel it.
 *
 * The API is unchanged and was already asynchronous, so nothing that uses the
 * songbook had to learn about any of this.
 *
 * Where a worker cannot be had — an old browser, a test, a build script — the
 * same module is imported directly and everything still works, slower and on
 * the main thread. That fallback is not hypothetical: it is what makes the
 * search auditable under node.
 */

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
}

let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, Pending>()
/** Set once a worker has failed, so we stop trying to use it. */
let workerBroken = false

function ensureWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./songs.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; value?: unknown; error?: string }>) => {
      const p = waiting.get(e.data.id)
      if (!p) return
      waiting.delete(e.data.id)
      if (e.data.error) p.reject(new Error(e.data.error))
      else p.resolve(e.data.value)
    }
    // A worker that dies takes every in-flight question with it. Fail them all
    // and fall back, rather than leaving callers waiting on a promise that can
    // no longer be answered.
    worker.onerror = () => {
      workerBroken = true
      worker = null
      for (const [, p] of waiting) p.reject(new Error('search worker stopped'))
      waiting.clear()
    }
    return worker
  } catch {
    workerBroken = true
    return null
  }
}

function ask<T>(msg: Record<string, unknown>): Promise<T> | null {
  const w = ensureWorker()
  if (!w) return null
  const id = ++seq
  const p = new Promise<T>((resolve, reject) => {
    waiting.set(id, { resolve: resolve as (v: unknown) => void, reject })
  })
  w.postMessage({ ...msg, id })
  return p
}

/** The same module the worker runs, loaded here only if we have to. */
const inline = (): Promise<typeof import('./songSearch')> => import('./songSearch')

/** Ask the worker; if there isn't one, or it fails, do it here instead. */
async function run<T>(msg: Record<string, unknown>, direct: (m: Awaited<ReturnType<typeof inline>>) => Promise<T>): Promise<T> {
  const viaWorker = ask<T>(msg)
  if (viaWorker) {
    try {
      return await viaWorker
    } catch {
      // Fall through: a broken worker should degrade to a slow songbook, not
      // to no songbook.
      workerBroken = true
    }
  }
  return direct(await inline())
}

/** How many songs the bundled library holds. */
export function countSongs(): Promise<number> {
  return run({ op: 'count' }, (m) => m.countSongs())
}

/** Name-only list for the index, filtered by an optional search term. */
export function listSongs(search = ''): Promise<SongMeta[]> {
  return run({ op: 'list', search }, (m) => m.listSongs(search))
}

/**
 * One page of results, with the total so a list knows whether to go on.
 *
 * Preferred over listSongs for anything that renders a list: a common word
 * matches most of the songbook, and every one of those matches would otherwise
 * be copied out of the worker to render the first screenful.
 */
export function searchSongs(
  search = '',
  offset = 0,
  limit = 50
): Promise<{ songs: SongMeta[]; total: number }> {
  return run({ op: 'page', search, offset, limit }, (m) => m.searchPage(search, offset, limit))
}

export function getSong(id: number): Promise<Song | undefined> {
  return run({ op: 'get', songId: id }, (m) => m.getSong(id))
}

/**
 * Start indexing now, without waiting to be asked.
 *
 * The first search pays for the index. Called when a screen that will obviously
 * need the songbook opens, that cost is spent while the operator is still
 * reading the page instead of while they are typing into it.
 */
export function warmSongs(): void {
  void listSongs('').catch(() => {})
}
