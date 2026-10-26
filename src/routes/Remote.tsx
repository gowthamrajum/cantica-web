import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  beaconRelease,
  claimOperator,
  getControlStatus,
  getSessions,
  releaseOperator,
  sendControl,
  type ControlCmd,
  type VersePayload,
  type GotoTarget,
  type OperatorRole,
  type OperatorSeat,
  type SessionSummary
} from '../lib/relay'
import { operatorId } from '../lib/operatorId'
import { useLiveState } from '../lib/useLiveState'
import { SermonVerseForm } from '../components/app/SermonVerseForm'
import { Icon } from '../components/app/Icons'
import { loadBible, teBook, type IndexedBible } from '../lib/bible'
import { versesFor, type Reference, type VerseLang } from '../lib/reference'
import { ConfidenceDeck } from '../components/ConfidenceDeck'
import { ConfidenceCard } from '../components/ConfidenceCard'
import { chaptersOf, groupByBook, refKey, useSermonHistory } from '../lib/sermonHistory'
import { LogoBadge } from '../components/Logo'
import { prettyServiceName } from '../lib/format'
import { useScreenVars } from '../lib/screenVars'

const STORE_KEY = 'tcc-remote'

/** [28,29,30,32] -> "28-30,32": the reference as a person would say it. */
function verseSpan(vs: number[]): string {
  const out: string[] = []
  for (let i = 0; i < vs.length; i++) {
    let j = i
    while (j + 1 < vs.length && vs[j + 1] === vs[j] + 1) j++
    out.push(j > i ? `${vs[i]}-${vs[j]}` : `${vs[i]}`)
    i = j
  }
  return out.join(',')
}
/** Well inside the relay's 40s lease, so one dropped renewal isn't a lost seat. */
const RENEW_MS = 12_000

/** `seat` is which job this phone does; absent on a connection saved before there were two. */
type Saved = { room: string; pin: string; label?: string; seat?: OperatorSeat }

const SEAT_NAME: Record<OperatorSeat, string> = { service: 'Service', sermon: 'Sermon' }
const otherSeat = (s: OperatorSeat): OperatorSeat => (s === 'sermon' ? 'service' : 'sermon')

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

export function Remote(): JSX.Element {
  const [params] = useSearchParams()
  const [conn, setConn] = useState<Saved | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Deep link from the desktop (?room=&pin=) connects straight away; otherwise
  // fall back to a previously saved session so a PWA refresh stays connected.
  useEffect(() => {
    const room = params.get('room') || ''
    const pin = params.get('pin') || ''
    const seat: OperatorSeat = params.get('seat') === 'sermon' ? 'sermon' : 'service'
    if (room && pin) {
      void tryConnect(room, pin, seat).then((r) => (r.ok ? setConn({ room, pin, seat }) : setBusy(r.error ?? null)))
    } else {
      const s = loadSaved()
      // A saved session is only worth resuming if this phone can still drive it:
      // someone else may have taken the seat while this one was closed.
      if (s) void tryConnect(s.room, s.pin, s.seat ?? 'service').then((r) => (r.ok ? setConn(s) : setBusy(r.error ?? null)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORE_KEY)
    setConn(null)
  }, [])

  const connect = useCallback((s: Saved) => {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
    setConn(s)
  }, [])

  /**
   * Swap jobs on this phone — for the Sunday one person does both.
   *
   * The new seat is taken before the old one is let go, so a refusal ("someone
   * else is running the sermon") leaves this phone exactly where it was.
   */
  const switchSeat = useCallback(async (): Promise<string | null> => {
    if (!conn) return null
    const from = conn.seat ?? 'service'
    const to = otherSeat(from)
    const r = await tryConnect(conn.room, conn.pin, to)
    if (!r.ok) return r.error ?? 'Couldn’t switch.'
    releaseOperator(conn.room, operatorId(), from)
    connect({ ...conn, seat: to })
    return null
  }, [conn, connect])

  return conn ? (
    // Keyed on the seat: switching jobs is a fresh screen with its own lease
    // heartbeat, not the old one carrying on with a different label.
    <OperatorMirror
      key={conn.seat ?? 'service'}
      conn={conn}
      onDisconnect={disconnect}
      onBadPin={disconnect}
      onSwitchSeat={switchSeat}
    />
  ) : (
    <Connect
      initialRoom={params.get('room') || ''}
      initialPin={params.get('pin') || ''}
      initialError={busy}
      onConnect={connect}
    />
  )
}

/** How long to tell someone to wait for a lapsed lease, in plain words. */
const waitHint = (freeInMs?: number): string => {
  const s = Math.ceil((freeInMs ?? 40_000) / 1000)
  return s > 45 ? 'a minute or so' : s > 20 ? 'about half a minute' : 'a few seconds'
}

/** Being turned away is only useful if it says who to go and ask. */
const takenMessage = (claim: { role?: OperatorRole; freeInMs?: number }, seat: OperatorSeat): string =>
  claim.role === 'presenter'
    ? 'The device that started this broadcast is operating it. Whoever has it can tap “Hand to a phone” on their live screen to pass the slides over.'
    : seat === 'sermon'
      ? `Another phone is already running the sermon. If theirs has gone to sleep, try again in ${waitHint(claim.freeInMs)} — or connect as Service.`
      : `Another phone is already running the service — only one can drive the slides at a time. If theirs has gone to sleep, try again in ${waitHint(claim.freeInMs)} — or connect as Sermon.`

/**
 * Validate a room + PIN, then claim the operator seat.
 *
 * The claim is part of connecting, not of the first tap: a volunteer who is
 * about to be refused should learn it here, not by pressing Next during a song
 * and finding nothing moves.
 */
async function tryConnect(room: string, pin: string, seat: OperatorSeat): Promise<{ ok: boolean; error?: string }> {
  try {
    const st = await getControlStatus(room, pin, operatorId(), seat)
    if (!st.online)
      return { ok: false, error: 'No presenter is connected to this service yet. Start broadcasting first.' }
    if (!st.pinOk) return { ok: false, error: 'That PIN didn’t match.' }
    const claim = await claimOperator(room, pin, operatorId(), { role: 'remote', seat })
    if (claim.status === 409 && claim.error === 'operator-taken')
      return { ok: false, error: takenMessage(claim, seat) }
    if (!claim.ok) return { ok: false, error: 'Could not reach the service. Check your connection.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the service. Check your connection.' }
  }
}

// -------------------------------------------------------------------- connect
function Connect({
  initialRoom,
  initialPin,
  initialError,
  onConnect
}: {
  initialRoom: string
  initialPin: string
  /** Why an automatic reconnect was refused, e.g. the seat is taken. */
  initialError: string | null
  onConnect: (s: Saved) => void
}): JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [room, setRoom] = useState(initialRoom)
  const [label, setLabel] = useState<string | undefined>(undefined)
  const [pin, setPin] = useState(initialPin)
  /** Which job this phone is joining to do. */
  const [seat, setSeat] = useState<OperatorSeat>('service')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  useEffect(() => setError(initialError), [initialError])

  useEffect(() => {
    let alive = true
    void getSessions()
      .then((d) => alive && setSessions(d.sessions))
      .catch(() => alive && setSessions([]))
    return () => {
      alive = false
    }
  }, [])

  const submit = async (): Promise<void> => {
    if (!room || pin.length < 3) {
      setError('Enter the room and its PIN.')
      return
    }
    setBusy(true)
    setError(null)
    const r = await tryConnect(room, pin, seat)
    if (r.ok) onConnect({ room, pin, label, seat })
    else setError(r.error ?? 'Could not connect.')
    setBusy(false)
  }

  return (
    <div className="min-h-[100dvh] bg-[#0b1120] text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-10">
        <div className="mb-8 flex items-center gap-3">
          <LogoBadge className="h-11 w-11" />
          <div>
            {/* The page had no h1 at all — this line was its title in every
                sense except the one a screen reader can use. */}
            <h1 className="font-serif text-lg font-semibold">Operator</h1>
            <div className="text-[13px] text-white/55">Run the slides or the sermon from your phone — one phone for each</div>
          </div>
        </div>

        {!room && (
          <>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-white/45">Live services</p>
            {sessions === null && <p className="py-6 text-white/50">Checking…</p>}
            {sessions && sessions.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-white/60">
                Nothing is live right now. Start broadcasting on the presenter computer, then come back.
              </p>
            )}
            <div className="grid gap-3">
              {sessions?.map((s) => (
                <button
                  key={s.room}
                  onClick={() => {
                    setRoom(s.room)
                    setLabel(s.label)
                  }}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-left transition active:scale-[0.99]"
                >
                  <span className={`h-2.5 w-2.5 flex-none rounded-full ${s.waiting ? 'bg-amber-400' : 'animate-pulse bg-red-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{prettyServiceName(s.label)}</span>
                    <span className="block text-xs text-white/45">{s.waiting ? 'Waiting to begin' : 'Live now'}</span>
                  </span>
                  <span className="text-white/30">›</span>
                </button>
              ))}
            </div>
          </>
        )}

        {room && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
            <div className="mb-1 text-[13px] text-white/50">Connecting to</div>
            <div className="mb-4 font-serif text-xl font-semibold">{prettyServiceName(label)}</div>

            {/* Two jobs, two phones: one runs the slides, one puts up verses
                during the sermon. Each sees only its own controls. */}
            <div className="mb-1.5 text-[13px] font-semibold text-white/60">I’m running</div>
            <div className="mb-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Job">
              {(
                [
                  ['service', 'Service', 'Slides, songs & order'],
                  ['sermon', 'Sermon', 'Verses during the sermon']
                ] as const
              ).map(([id, name, hint]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={seat === id}
                  onClick={() => {
                    setSeat(id)
                    setError(null)
                  }}
                  className={`rounded-xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                    seat === id ? 'border-amber-400 bg-amber-400/10' : 'border-white/15 bg-[#0b1120]'
                  }`}
                >
                  <span className="block font-semibold">{name}</span>
                  <span className="block text-xs text-white/50">{hint}</span>
                </button>
              ))}
            </div>

            <label className="mb-1.5 block text-[13px] font-semibold text-white/60">Control PIN</label>
            <input
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="••••"
              className="w-full rounded-xl border border-white/15 bg-[#0b1120] px-4 py-3.5 text-center text-2xl font-semibold tracking-[0.4em] text-white outline-none focus:border-amber-400"
            />

            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

            <button
              onClick={() => void submit()}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-amber-500 py-3.5 font-semibold text-[#1a1204] transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? 'Checking…' : 'Connect'}
            </button>
            <button onClick={() => setRoom('')} className="mt-3 w-full py-2 text-sm text-white/50">
              ← Pick a different service
            </button>
          </div>
        )}

        <div className="mt-auto pt-10 text-center text-xs text-white/35">
          The PIN is shown in the <b className="text-white/50">Broadcast</b> panel on the presenter computer.
          <div className="mt-2">
            <Link to="/watch" className="text-white/45 underline-offset-2 hover:underline">
              ← Back to services
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------- operator (confidence view)
const SWIPE_MIN = 45 // px; below this a gesture is a tap, not a swipe

function OperatorMirror({
  conn,
  onDisconnect,
  onBadPin,
  onSwitchSeat
}: {
  conn: Saved
  onDisconnect: () => void
  onBadPin: () => void
  /** Swap this phone to the other job; resolves to why not, or null once done. */
  onSwitchSeat: () => Promise<string | null>
}): JSX.Element {
  const navigate = useNavigate()
  // Operators see the unsuppressed deck (every slide), unlike audience/OBS viewers.
  const { state, connected, viewers } = useLiveState(conn.room, 'operator')
  const liveShowing = !!state?.slide && !state.blackout && !state.clearText && !state.showLogo
  /**
   * Whether the sermon is the item on screen.
   *
   * The operator already receives the outline with the live item marked, so
   * this needs nothing new from the relay. Matched on the title in both
   * languages — it is the church's own section card, built from a template, and
   * the same test the desktop importer uses to find it.
   */
  const onSermon = !!state?.order?.some((it) => it.live && /sermon|వాక్యోపదేశం/i.test(it.title ?? ''))
  /** The section being played, for the header read-out. */
  const here = state?.order?.find((it) => it.live)
  /** A book to start the reference field with, from + in the history. */
  const [prefill, setPrefill] = useState<{ text: string; n: number } | undefined>(undefined)
  /**
   * Service or sermon — two jobs, two phones.
   *
   * Running the service is the slides and Next. Running the sermon is quoting
   * scripture: what to put up, what already went up, what to go back to. Each
   * phone holds its own seat on the relay and shows only its own job, so the
   * person quoting verses can't move the slides out from under the person
   * running them.
   */
  const seat: OperatorSeat = conn.seat ?? 'service'
  const isSermon = seat === 'sermon'
  const [switching, setSwitching] = useState(false)
  /** Every passage sent today, so going back to one is a tap, not a retype. */
  const history = useSermonHistory(conn.room)
  /** The order of service, as a drawer over the operator's controls. */
  const [orderOpen, setOrderOpen] = useState(false)
  /**
   * A passage is on the lower third and can be taken off it.
   *
   * Set when a verse is sent, cleared when it is taken off — or when the
   * service leaves the sermon, because a button that removes "the last quote"
   * is nonsense once nobody is quoting anything.
   *
   * One reference can be several verses and therefore several slides; the
   * presenter remembers them as a group, so this is one button whether the
   * operator sent John 3:16 or Romans 8:28-30.
   */
  const [quoteOnStream, setQuoteOnStream] = useState(false)
  /**
   * The passage last put up, so the verse either side of it is one tap away.
   *
   * A preacher reads on, or backs up, and reaching for the sheet to retype a
   * reference that differs by one is exactly the wrong amount of work to be
   * doing while they are talking. Held as the resolved reference rather than
   * the text that produced it, so walking on from "Rom 8:28-30" means verse 31
   * without re-parsing anything.
   *
   * Cleared with the quote itself: once nobody is quoting, "the verse after"
   * has nothing to be after.
   */
  const [lastRef, setLastRef] = useState<{ ref: Reference; lang: VerseLang } | null>(null)
  /** Both bibles, loaded only once a verse has actually been sent — a phone
   *  that never quotes anything should not pay for them. */
  const [bibles, setBibles] = useState<{ te: IndexedBible | null; en: IndexedBible | null } | null>(null)
  useEffect(() => {
    if ((!lastRef && !isSermon) || bibles) return
    let alive = true
    void Promise.all([loadBible('telugu'), loadBible('web')]).then(([te, en]) => {
      if (alive) setBibles({ te, en })
    })
    return () => {
      alive = false
    }
  }, [lastRef, bibles, isSermon])

  /**
   * The verse before and after what is up, when there is one.
   *
   * Same chapter only. Running off either end of a chapter means the next
   * reference is a different chapter — and often a different thought — which is
   * a decision for the person reading, not for a button that says "v13".
   */
  const neighbours = (() => {
    if (!lastRef?.ref.verses?.length || !bibles) return { before: null as number | null, after: null as number | null }
    const { book, chapter, verses } = lastRef.ref
    const all = (bibles.te?.byBook[book]?.[chapter] ?? bibles.en?.byBook[book]?.[chapter] ?? []).map((v) => v.verse)
    if (!all.length) return { before: null, after: null }
    const lo = Math.min(...verses)
    const hi = Math.max(...verses)
    return {
      before: all.includes(lo - 1) ? lo - 1 : null,
      after: all.includes(hi + 1) ? hi + 1 : null
    }
  })()
  /**
   * Whether the finger that is down has moved — i.e. is scrolling, not tapping.
   *
   * A touch that drags still delivers a click to whatever it started on, so
   * flicking the drawer to find a section jumped the service to whichever row
   * happened to be under the thumb. On a phone mid-service that is the worst
   * possible false positive: the screen changes in front of the congregation
   * and the operator did not ask for it.
   *
   * Held in a ref, not state: the click handler has to read it during the same
   * gesture, and a re-render between move and click would be both too late and
   * a re-render nobody needs while a list is being flung.
   */
  const scrolled = useRef(false)
  const touchStartY = useRef(0)
  useEffect(() => {
    if (onSermon) return
    // The verse either side of "the last quote" means nothing once the service
    // has moved on from the sermon.
    setLastRef(null)
  }, [onSermon])
  const [feedback, setFeedback] = useState<ControlCmd | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  // Ending affects everyone watching, so it is asked rather than done on a tap
  // that could just as easily have been a mis-hit going for Exit.
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding] = useState(false)
  const [ended, setEnded] = useState(false)
  /** Set if the seat went to another phone while this one was away. */
  const [lostSeat, setLostSeat] = useState(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const me = useRef(operatorId()).current

  // The rotated root is sized from the JS-measured screen (--mvw/--mvh), not
  // from vw/vh — see useScreenVars for why iOS needs that.
  useScreenVars()

  // Paint the document dark so the site's paper background never peeks through the
  // safe-area insets while operating.
  useEffect(() => {
    document.documentElement.classList.add('channel-open')
    return () => document.documentElement.classList.remove('channel-open')
  }, [])

  /**
   * Hold the operator seat for as long as this screen is open.
   *
   * The relay's lease lapses if nobody renews it, so this heartbeat is what says
   * the phone is still here — and its refusal is how we find out somebody else
   * has taken over, which can happen after a lock screen or a dead spot has kept
   * this phone quiet long enough for the lease to run out.
   */
  useEffect(() => {
    // Once the seat has gone, stop reaching for it. Left running, this would
    // quietly take it back the moment it fell free — from the phone that now
    // holds it, or from whoever is operating the NEXT service in this room —
    // while this screen still says the turn was lost.
    if (ended || lostSeat) return
    let alive = true
    const renew = async (): Promise<void> => {
      const r = await claimOperator(conn.room, conn.pin, me, { role: 'remote', seat })
      if (!alive) return
      if (r.status === 409 && r.error === 'operator-taken') setLostSeat(true)
    }
    void renew()
    const id = setInterval(() => void renew(), RENEW_MS)
    // A phone that has been put away is not operating: hand the seat straight
    // back rather than making the next volunteer wait out the lease.
    const onHide = (): void => beaconRelease(conn.room, me)
    window.addEventListener('pagehide', onHide)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('pagehide', onHide)
    }
  }, [conn.room, conn.pin, me, seat, ended, lostSeat])

  const run = useCallback(
    async (cmd: ControlCmd, arg?: number | VersePayload | GotoTarget): Promise<void> => {
      setFeedback(cmd)
      setTimeout(() => setFeedback(null), 450)
      try {
        const r = await sendControl(conn.room, conn.pin, cmd, arg, me)
        if (r.status === 401) {
          setFlash('PIN no longer valid')
          setTimeout(onBadPin, 900)
        } else if (r.error === 'not-operator') {
          setLostSeat(true)
        } else if (r.status === 409 || r.error === 'presenter-offline') {
          setFlash('Presenter is offline')
        } else if (!r.ok) {
          setFlash('Command failed')
        }
      } catch {
        setFlash('No connection')
      }
    },
    [conn.room, conn.pin, me, onBadPin]
  )

  /**
   * Put the verse before or after what is up, without opening the sheet.
   *
   * Sent as its own quote rather than as a widened range: the presenter builds
   * one slide per verse and goes live on the first of them, so re-sending
   * 3:12-13 would put verse 12 back on the wall to get to 13. One verse, and
   * the buttons then offer the one after that — which is how somebody reading
   * on actually moves.
   */
  /**
   * The passage last put up, and where its slides are in the deck.
   *
   * A presenter appends one slide per verse to the END of the live item and
   * goes live on the first, so a passage sent while that item had C slides
   * occupies slides C, C+1, … — and `goto {item, slide}` reaches any of them.
   * That is how Psalm 23:1-3 can be walked from this phone, which has no Next
   * of its own (Next is the service phone's).
   */
  const [passage, setPassage] = useState<{ item: number; first: number; verses: number[] } | null>(null)

  // Off the sermon, the passage's slides are no longer where the phone is.
  useEffect(() => {
    if (!onSermon) setPassage(null)
  }, [onSermon])

  /** Everything that follows a passage going up, wherever it was sent from. */
  const sent = useCallback(
    async (payload: VersePayload, ref: Reference, lang: VerseLang): Promise<{ item: number; first: number } | null> => {
      const item = state?.order?.findIndex((o) => o.live) ?? -1
      const first = item >= 0 ? (state?.order?.[item]?.count ?? 0) : 0
      await run('verse', payload)
      setQuoteOnStream(true)
      setLastRef({ ref, lang })
      history.add(ref, lang, payload.label)
      // Each slide is labelled "<book> <chapter>:<verse>", so the verse numbers
      // come straight off the labels — the same numbers the presenter shows.
      const verses = (payload.slides ?? []).map((sl) => Number(sl.label.split(':').pop()))
      const ok = item >= 0 && verses.every(Number.isFinite)
      setPassage(ok ? { item, first, verses } : null)
      return ok ? { item, first } : null
    },
    [state, run, history]
  )
  const sendRef = useCallback(
    async (ref: Reference, lang: VerseLang): Promise<void> => {
      if (!bibles) return
      const payload = versesFor(ref, bibles.te, bibles.en, lang)
      if (payload) await sent(payload, ref, lang)
    },
    [bibles, sent]
  )
  const quoteNeighbour = useCallback(
    async (verse: number): Promise<void> => {
      if (!lastRef) return
      await sendRef({ ...lastRef.ref, verses: [verse] }, lastRef.lang)
    },
    [lastRef, sendRef]
  )

  /**
   * Which verse of the passage is on screen: the live slide's position in its
   * item, measured from where the passage starts. Null once the presenter is
   * somewhere else — the sermon card, the outline, the next section.
   */
  const liveItem = state?.order?.findIndex((o) => o.live) ?? -1
  const liveNth = liveItem >= 0 ? state?.order?.[liveItem]?.nth : undefined
  const passageAt =
    passage && liveItem === passage.item && typeof liveNth === 'number'
      ? (() => {
          const k = liveNth - 1 - passage.first
          return k >= 0 && k < passage.verses.length ? k : null
        })()
      : null
  /** Show verse k of the passage — a jump within slides already in the deck. */
  const showPassageVerse = useCallback(
    (k: number): void => {
      if (passage) void run('goto', { item: passage.item, slide: passage.first + k })
    },
    [passage, run]
  )
  /**
   * The ‹ and › steps. Inside a passage they walk its verses; past either end
   * they quote the next verse of the chapter, as they always did.
   */
  const stepBefore =
    passage && passageAt !== null && passageAt > 0
      ? { verse: passage.verses[passageAt - 1], go: () => showPassageVerse(passageAt - 1) }
      : lastRef && neighbours.before !== null
        ? { verse: neighbours.before, go: () => void quoteNeighbour(neighbours.before as number) }
        : null
  const stepAfter =
    passage && passageAt !== null && passageAt < passage.verses.length - 1
      ? { verse: passage.verses[passageAt + 1], go: () => showPassageVerse(passageAt + 1) }
      : lastRef && neighbours.after !== null
        ? { verse: neighbours.after, go: () => void quoteNeighbour(neighbours.after as number) }
        : null

  /**
   * The language switched while a verse is on screen: put the same passage up
   * again in that language, and land on the verse that was showing — not back
   * on its first. Switching is a correction to what is up, not only a setting
   * for the next reference.
   */
  const relang = useCallback(
    async (lang: VerseLang): Promise<void> => {
      if (!bibles || !lastRef || lastRef.lang === lang || passageAt === null) return
      const k = passageAt
      const payload = versesFor(lastRef.ref, bibles.te, bibles.en, lang)
      if (!payload) return
      const at = await sent(payload, lastRef.ref, lang)
      if (at && k > 0) await run('goto', { item: at.item, slide: at.first + k })
    },
    [bibles, lastRef, passageAt, sent, run]
  )

  /** Where the sermon sits in the order, so the sermon phone can go there. */
  const sermonIndex = state?.order?.findIndex((it) => /sermon|వాక్యోపదేశం/i.test(it.title ?? '')) ?? -1
  const books = groupByBook(history.items)
  /** The passage up now — the history row to mark. */
  const upKey = quoteOnStream && lastRef ? refKey(lastRef.ref) : null

  /**
   * The sermon's outline, when it has one — the preacher's points are where
   * the sermon is, and the card is only its heading.
   */
  const sermonOutline = state?.order?.find((o) => o.live)?.outline
  /** The outline (or, with none, the sermon card), over any verses put up since. */
  const jumpToSermon = useCallback(async (): Promise<void> => {
    const i = state?.order?.findIndex((o) => o.live) ?? -1
    if (i < 0) return
    const outline = state?.order?.[i]?.outline
    if (typeof outline === 'number') await run('goto', { item: i, slide: outline })
    else await run('goto', i)
  }, [state, run])

  /** The section after the sermon, over the rest of them. */
  const jumpToNextSection = useCallback(async (): Promise<void> => {
    const order = state?.order ?? []
    const i = order.findIndex((o) => o.live)
    if (i >= 0 && i + 1 < order.length) await run('goto', i + 1)
  }, [state, run])

  const exit = useCallback((): void => {
    releaseOperator(conn.room, me)
    onDisconnect()
    navigate('/watch')
  }, [conn.room, me, onDisconnect, navigate])

  /**
   * Take the whole service off air.
   *
   * The command travels the same path as Next: the relay carries it and the
   * presenter — the computer, or the phone that started this from Service
   * Builder — is what actually stops publishing. So a presenter that doesn't
   * know the command leaves the broadcast up, and we say so rather than
   * claiming it ended.
   */
  const endBroadcast = useCallback(async (): Promise<void> => {
    setConfirmEnd(false)
    setEnding(true)
    try {
      const r = await sendControl(conn.room, conn.pin, 'end', undefined, me)
      if (r.status === 401) {
        setFlash('PIN no longer valid')
        return
      }
      if (r.error === 'not-operator') {
        setLostSeat(true)
        return
      }
      if (r.status === 409 || r.error === 'presenter-offline') {
        setFlash('Nothing is presenting — it’s already off air')
        return
      }
      if (r.status === 400) {
        setFlash('This service can’t be ended from the phone')
        return
      }
      if (!r.ok) {
        setFlash('Couldn’t end the broadcast')
        return
      }
      // Delivered is not the same as done. A presenter that ends stops listening
      // for commands, so the room reporting nobody online is the proof — and
      // without it we would tell the operator a service was off air while it
      // carried on in the hall.
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500))
        const st = await getControlStatus(conn.room, conn.pin).catch(() => null)
        if (st && !st.online) {
          setEnded(true)
          setTimeout(exit, 1400)
          return
        }
      }
      setFlash('The presenter didn’t stop — it may still be on air')
    } catch {
      setFlash('No connection')
    } finally {
      setEnding(false)
    }
  }, [conn.room, conn.pin, me, exit])

  /**
   * Anything laid over the deck — the order drawer, a sheet, a confirmation.
   *
   * A touch that begins inside one of these is doing that thing, not driving
   * the service. Scrolling the drawer to find a section is a swipe UP, and a
   * swipe up is Next: reading the order moved the slide on the wall, once per
   * flick, in front of everybody.
   *
   * Asked of the ELEMENT rather than of the open/closed state, so an overlay
   * added later is covered without anyone remembering to come back here.
   */
  const OVERLAY = '.op2-drawer-wrap, .op2-ask, .sheet, .sheet-backdrop, .vf-books, .op2-hist'

  /**
   * Off the deck and onto the viewer.
   *
   * A phone that has lost the seat is not an operator any more, and leaving it
   * on a dead remote is the worst of the options — it is somebody standing at
   * the back who now cannot see the service at all. The viewer for this same
   * room is one route away and shows exactly what the congregation sees.
   *
   * Automatic after a moment, so nobody has to read a dialog to get out of a
   * screen that no longer does anything, but with a button too for whoever is
   * already looking at it.
   */
  const toViewer = useCallback(() => {
    // The seat is already gone; onDisconnect clears the stored connection so
    // this phone does not come back as an operator on the next launch.
    onDisconnect()
    navigate(`/c/${encodeURIComponent(conn.room)}`, { replace: true })
  }, [conn.room, onDisconnect, navigate])

  useEffect(() => {
    if (!lostSeat || ended) return
    const t = setTimeout(toViewer, 6000)
    return () => clearTimeout(t)
  }, [lostSeat, ended, toViewer])

  const onTouchStart = (e: TouchEvent): void => {
    // A swipe must not move slides from under the confirmation — and the
    // sermon phone doesn't move slides at all; that is the service phone's job.
    if (isSermon || confirmEnd || ending || ended || lostSeat) return
    const target = e.target as Element | null
    if (target?.closest?.(OVERLAY)) return
    const t = e.touches[0]
    startRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent): void => {
    const s = startRef.current
    startRef.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return
    // Forward (Next) = swipe left OR up; Back (Prev) = swipe right OR down.
    const forward = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy < 0
    void run(forward ? 'next' : 'prev')
  }

  // Desktop: arrow / page keys and space drive the deck.
  useEffect(() => {
    // …but not while something is open over it. Arrow keys scroll the drawer,
    // and scrolling it should not also walk the service.
    if (isSermon || confirmEnd || ending || ended || lostSeat || orderOpen) return
    const onKey = (e: KeyboardEvent): void => {
      // Not while something is being typed. Space is both "next slide" and the
      // commonest character in a reference, so without this, typing "John 3:16"
      // advanced the service — and the operator had no way to know the two were
      // the same key.
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        void run('next')
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        void run('prev')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run, isSermon, confirmEnd, ending, ended, lostSeat, orderOpen])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2200)
    return () => clearTimeout(t)
  }, [flash])

  // Off the sermon, there is no "last quote" to take down — and a button that
  // acts on nothing is worse than one that is missing.
  useEffect(() => {
    if (!onSermon) setQuoteOnStream(false)
  }, [onSermon])

  const status = liveShowing
    ? { label: 'LIVE', cls: 'bg-red-500 text-white' }
    : connected
      ? { label: 'STANDBY', cls: isSermon ? 'bg-black/10 text-black/60' : 'bg-white/15 text-white/70' }
      : { label: 'OFFLINE', cls: isSermon ? 'bg-black/5 text-black/40' : 'bg-white/10 text-white/45' }

  return (
    // The sermon phone is typed on, so it is never turned sideways for the
    // phone: the keyboard comes up along the physical bottom edge, and on a
    // turned frame that put it beside the field instead of under it.
    // …and it is light: the sermon phone is read and typed on at arm's length
    // in a lit hall, where the service phone's dark screen is for the back of a
    // dim room watching the slides.
    <div className={`op2-root${isSermon ? ' op2-upright op2-light' : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="op2-head">
        <div className="op2-headmain">
          <h1 className="op2-service">{prettyServiceName(state?.name || conn.label) || 'Live service'}</h1>
          {/* Which section, and where in it — the same "3/10" the drawer shows,
              but without having to open the drawer to see it. An operator
              tracking how much of a song is left should not have to cover the
              slide they are reading to find out. */}
          {here && (
            <p className="op2-where">
              <span className="op2-where-title">{here.title}</span>
              {here.count ? (
                <span className="op2-where-n">
                  {here.nth ? `${here.nth}/${here.count}` : here.count}
                </span>
              ) : null}
            </p>
          )}
        </div>
        <div className="op2-badges">
          <span className={`op2-status ${status.cls}`}>{status.label}</span>
          {/* Ending is the operator's, not just the presenter's: they are the one
              who knows the service is over. */}
          {/* Which job this phone is doing, and the way to the other one. The
              dot on the service phone says the sermon has started — the moment
              a verse might be wanted — without changing anything by itself. */}
          <span className={`op2-role${isSermon ? ' is-sermon' : ''}`}>{SEAT_NAME[seat]}</span>
          <button
            className="op2-switch"
            disabled={switching}
            onClick={async () => {
              setSwitching(true)
              const why = await onSwitchSeat()
              setSwitching(false)
              if (why) setFlash(why)
            }}
            title={`Switch this phone to ${SEAT_NAME[otherSeat(seat)]}`}
          >
            {switching ? '…' : `→ ${SEAT_NAME[otherSeat(seat)]}`}
            {!isSermon && onSermon && <span className="op2-tab-dot" aria-label="the sermon is on" />}
          </button>
          {!isSermon && (
            <>
              {/* The whole service, one tap away. An operator who has to reach a
                  different section has been walking there with Next until now —
                  past every slide in between, all of them going out on the
                  screen on the way. */}
              <button onClick={() => setOrderOpen(true)} className="op2-order-btn" title="Order of service">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              {/* Ending is the operator's, not just the presenter's: they are
                  the one who knows the service is over. */}
              <button onClick={() => setConfirmEnd(true)} className="op2-stop">
                End
              </button>
            </>
          )}
          <button onClick={exit} aria-label="Exit operator" className="op2-exit">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Sliding over rather than pushing the controls aside: the operator is
          mid-service, and a layout that reflows under their thumb is how the
          wrong thing gets tapped. */}
      {orderOpen && (
        <div className="op2-drawer-wrap" role="dialog" aria-label="Order of service">
          <button className="op2-drawer-scrim" aria-label="Close" onClick={() => setOrderOpen(false)} />
          <div className="op2-drawer">
            <div className="op2-drawer-head">
              <span>Order of service</span>
              <button onClick={() => setOrderOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {/* One guard for the whole list — the events bubble, so every row
                is covered by it and no row can forget. */}
            <div
              className="op2-drawer-list"
              onPointerDown={(e) => {
                scrolled.current = false
                touchStartY.current = e.clientY
              }}
              onPointerMove={(e) => {
                // A few pixels is a thumb resting, not a scroll.
                if (Math.abs(e.clientY - touchStartY.current) > 8) scrolled.current = true
              }}
              // The browser takes the gesture over once it decides this is a
              // scroll, and stops sending moves — so the cancel is the only
              // thing that says so on the platforms that do it that way.
              onPointerCancel={() => {
                scrolled.current = true
              }}
              onScroll={() => {
                scrolled.current = true
              }}
            >
              {(state?.order ?? []).map((it, i) => (
                <button
                  key={`${it.title}-${i}`}
                  className={`op2-drawer-item${it.live ? ' is-live' : ''}`}
                  onClick={() => {
                    if (scrolled.current) return
                    void run('goto', i)
                    setOrderOpen(false)
                  }}
                >
                  <span className="op2-drawer-n">{i + 1}</span>
                  <span className="op2-drawer-title">{it.title}</span>
                  {/* How far through, on the section being played; how much
                      there is, on the rest. An operator deciding whether to
                      jump wants the size of what they are jumping into. */}
                  {it.count ? (
                    <span className="op2-drawer-count">
                      {it.live && it.nth ? `${it.nth}/${it.count}` : it.count}
                    </span>
                  ) : null}
                  {it.live && <span className="op2-drawer-now">NOW</span>}
                </button>
              ))}
              {!(state?.order ?? []).length && (
                <p className="op2-drawer-empty">The order will appear here once the service is live.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="op2-body">
        {!isSermon ? (
          <ConfidenceDeck state={state} />
        ) : (
          <div className="op2-sermon">
            {/* Left: everything quoted today, by book. Tapping a passage puts it
                back up; + on a book opens the sheet with that book typed, which
                is most of what a preacher who stays in one book needs. */}
            <aside className="op2-hist" aria-label="Verses sent today">
              <div className="op2-hist-head">
                <Icon name="bible" size={16} />
                <span className="op2-hist-title">Verses today</span>
                {history.items.length > 0 && <span className="op2-hist-count">{history.items.length}</span>}
                {books.length > 0 && (
                  <button onClick={history.clear} className="op2-hist-clear">
                    Clear
                  </button>
                )}
              </div>
              <div className="op2-hist-list">
                {books.map((g) => (
                  <section key={g.book} className="op2-hist-book">
                    <header className="op2-hist-bookhead">
                      <div className="op2-hist-bookname-wrap">
                        <span lang="te" className="op2-hist-bookname">{teBook(g.book)}</span>
                        {teBook(g.book) !== g.book && <span className="op2-hist-bookkey">{g.book}</span>}
                      </div>
                      {/* Two ways to start the next reference: from the book
                          (a new chapter), or — on each chapter row below — from
                          the book AND the chapter, which is where a preacher
                          usually stays. */}
                    </header>
                    <div className="op2-hist-chapters">
                      {chaptersOf(g.verses).map(({ chapter, verses }) => (
                        <div key={chapter} className="op2-hist-chapter">
                          <span className="op2-hist-ch" aria-label={`Chapter ${chapter}`}>
                            {chapter}
                          </span>
                          <div className="op2-hist-refs">
                            {verses.map((v) => (
                              <button
                                key={v.key}
                                className={`op2-hist-ref${v.key === upKey ? ' is-up' : ''}`}
                                disabled={!onSermon || !bibles}
                                aria-label={`Put ${v.label} on screen`}
                                onClick={() => void sendRef(v.ref, v.lang)}
                              >
                                {v.key === upKey && <span className="op2-hist-live" aria-hidden="true" />}
                                {v.ref.verses?.length ? verseSpan(v.ref.verses) : 'All'}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Where the next reference starts, on a line of its own:
                        the book (for a new chapter), or one of its chapters
                        (for another verse in it). */}
                    {onSermon && (
                      <div className="op2-hist-actions">
                        <button
                          className="op2-hist-add is-book"
                          aria-label={`Type another reference in ${g.book}`}
                          title={`${g.book} …`}
                          onClick={() => setPrefill((p) => ({ text: `${teBook(g.book)} `, n: (p?.n ?? 0) + 1 }))}
                        >
                          <Icon name="book-add" size={17} />
                          <span>Book</span>
                        </button>
                        {chaptersOf(g.verses).map(({ chapter }) => (
                          <button
                            key={chapter}
                            className="op2-hist-add is-chapter"
                            aria-label={`Another verse from ${g.book} ${chapter}`}
                            title={`${g.book} ${chapter}:…`}
                            onClick={() =>
                              setPrefill((p) => ({ text: `${teBook(g.book)} ${chapter}:`, n: (p?.n ?? 0) + 1 }))
                            }
                          >
                            <Icon name="chapter-add" size={17} />
                            <span>{chapter}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
                {!books.length && (
                  <div className="op2-hist-empty">
                    <Icon name="bible" size={28} />
                    <p>Verses you put on screen are kept here, by book and chapter, for the rest of today.</p>
                  </div>
                )}
              </div>
            </aside>

            {/* Right: what goes up next, how the sermon moves, and what is up. */}
            <div className="op2-sermon-main">
              {onSermon ? (
                <>
                  <SermonVerseForm
                    te={bibles?.te ?? null}
                    en={bibles?.en ?? null}
                    prefill={prefill}
                    onSend={sent}
                    onLangChange={(l) => void relang(l)}
                  />
                  {/* The verses of the passage that is up, each one a tap away.
                      A passage goes up on its first verse; this is how the rest
                      of it gets read from this phone. */}
                  {passage && passage.verses.length > 1 && passageAt !== null && (
                    <div className="op2-passage" role="group" aria-label="Verses of this passage">
                      <span className="op2-passage-label">Verse</span>
                      {passage.verses.map((v, k) => (
                        <button
                          key={`${v}-${k}`}
                          className={k === passageAt ? 'is-up' : ''}
                          aria-pressed={k === passageAt}
                          onClick={() => showPassageVerse(k)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Both are ordinary `goto`s: it already means "the first slide
                      of item N", and a verse is appended INSIDE the sermon item —
                      so the sermon card is goto(live) and the next section is
                      goto(live + 1), however many verses went up in between. */}
                  <div className="op2-sermon-nav">
                    {/* The verse either side, only when it exists in the same
                        chapter, and the button says which one. */}
                    {stepBefore && (
                      <button className="op2-vstep" onClick={stepBefore.go}>
                        ‹ v{stepBefore.verse}
                      </button>
                    )}
                    {/* Icons, not words: these two are reached for between
                        verses without reading, and the labels took half the
                        row. The name is still there for a screen reader and
                        on a long press. */}
                    {(() => {
                      const home = typeof sermonOutline === 'number' ? 'Back to outline' : 'Back to sermon'
                      return (
                        <button className="op2-navicon" onClick={() => void jumpToSermon()} aria-label={home} title={home}>
                          <Icon name="home" size={22} />
                        </button>
                      )
                    })()}
                    <button
                      className="op2-navicon"
                      onClick={() => void jumpToNextSection()}
                      aria-label="Next section"
                      title="Next section"
                    >
                      <Icon name="next" size={22} />
                    </button>
                    {/* Off the live stream, beside Next: only once a passage is
                        up there to take down. The room and the church's phones
                        keep it — this is the strip over the camera. */}
                    {quoteOnStream && !ended && (
                      <button
                        className="op2-navicon op2-streamoff"
                        aria-label="Remove from live stream — the passage stays on the screens and phones"
                        title="Remove from live stream"
                        onClick={() => {
                          void run('verseoff')
                          setQuoteOnStream(false)
                        }}
                      >
                        <Icon name="no-entry" size={24} />
                      </button>
                    )}
                    {stepAfter && (
                      <button className="op2-vstep" onClick={stepAfter.go}>
                        v{stepAfter.verse} ›
                      </button>
                    )}
                  </div>
                </>
              ) : (
                // Verses only go up during the sermon — anywhere else they would
                // land in the middle of a song. Say so, and offer the way there.
                <div className="op2-sermon-off">
                  <p>The sermon isn’t on screen yet.</p>
                  {sermonIndex >= 0 && (
                    <button onClick={() => void run('goto', sermonIndex)}>Go to the sermon</button>
                  )}
                </div>
              )}
              <section className="op2-section op2-sermon-now">
                <div className="op2-label">Current</div>
                <div className="op2-card">
                  <ConfidenceCard state={state} />
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <div className="op2-flash">
          <span>{feedback === 'next' ? '›' : feedback === 'prev' ? '‹' : ''}</span>
        </div>
      )}
      {flash && <div className="op2-toast">{flash}</div>}

      {/* The seat went elsewhere: stop pretending this phone still drives the
          service, and get off the deck rather than leave a dead remote in
          somebody's hand. */}
      {lostSeat && !ended && (
        <div className="op2-ask" role="dialog" aria-label="Another phone is operating">
          <p className="op2-ask-title">{isSermon ? 'Someone else is running the sermon now' : 'Someone else is driving now'}</p>
          <p className="op2-ask-body">
            One phone runs the {isSermon ? 'sermon' : 'slides'} at a time. Either this one was asleep or out of signal
            long enough to give the seat up, or somebody with the master PIN took it.
          </p>
          <p className="op2-ask-body">
            You’re being moved to the viewer, so you can still follow the service.
          </p>
          <div className="op2-ask-row">
            <button className="op2-ask-yes" onClick={toViewer}>
              Watch the service
            </button>
            <button className="op2-ask-no" onClick={exit}>
              Leave
            </button>
          </div>
        </div>
      )}

      {(confirmEnd || ending || ended) && (
        <div className="op2-ask" role="dialog" aria-label="End the broadcast">
          {ended ? (
            <p className="op2-ask-title">The broadcast has ended.</p>
          ) : ending ? (
            <>
              <p className="op2-ask-title">Ending…</p>
              <p className="op2-ask-body">Waiting for the presenter to go off air.</p>
            </>
          ) : (
            <>
              <p className="op2-ask-title">End the broadcast?</p>
              <p className="op2-ask-body">
                The service goes off air for everyone watching
                {typeof viewers === 'number' && viewers > 0
                  ? ` — ${viewers} ${viewers === 1 ? 'person is' : 'people are'} following right now`
                  : ''}
                . Starting it again means going back to the device that began it.
              </p>
              <div className="op2-ask-row">
                <button className="op2-ask-no" onClick={() => setConfirmEnd(false)}>
                  Keep going
                </button>
                <button className="op2-ask-yes" onClick={() => void endBroadcast()}>
                  End broadcast
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

