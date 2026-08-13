import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfidenceCard } from '../components/ConfidenceCard'
import { Icon } from '../components/app/Icons'
import { prettyServiceName } from '../lib/format'
import {
  beaconRelease,
  claimOperator,
  getService,
  releaseOperator,
  type Background,
  type LiveState,
  type Theme
} from '../lib/relay'
import { operatorId } from '../lib/operatorId'
import { useLiveState } from '../lib/useLiveState'
import { useScreenVars } from '../lib/screenVars'
import {
  flattenDeck,
  liveKeysFor,
  outlineOf,
  publishFrame,
  publishOff,
  readEnvelope,
  useRemoteCommands,
  useWakeLock,
  type BroadcastFrame
} from '../lib/livecast'
import type { ServiceEnvelope, ServiceItem } from '../lib/buildService'

/** px; below this a gesture is a tap meant for a control, not a swipe. */
const SWIPE_MIN = 45

/**
 * Broadcast a saved service from this device.
 *
 * This screen IS the presenter: it holds the deck, publishes each slide to the
 * relay, and answers the phone Operator's commands — the job the desktop app
 * and its OBS overlay used to be needed for. The congregation watches on the
 * ordinary Viewer page; a volunteer can drive from Operator with the PIN below.
 */
export function Live(): JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const serviceId = Number(id)

  const [envelope, setEnvelope] = useState<ServiceEnvelope | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  // Nothing is on screen until the operator starts: a room that is live but not
  // yet showing a slide is what the audience page renders as "will begin shortly".
  const [cursor, setCursor] = useState(-1)
  const [blackout, setBlackout] = useState(false)
  const [clearText, setClearText] = useState(false)
  const [showLogo, setShowLogo] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  /** Set when the Operator ended it from their phone — why this screen closed. */
  const [ended, setEnded] = useState(false)
  /**
   * Whether this device is holding the service's operator seat.
   *
   * Starting a broadcast IS operating it — the person who pressed Broadcast is
   * standing there moving the slides — so this device takes the seat, and no
   * phone can drive the same service behind their back. Handing it over is a
   * deliberate act, below.
   */
  const [handedOver, setHandedOver] = useState(false)
  const me = useRef(operatorId()).current

  const keys = useMemo(() => liveKeysFor(serviceId), [serviceId])

  useEffect(() => {
    if (!Number.isFinite(serviceId)) {
      setFailed('That broadcast link isn’t valid.')
      return
    }
    let alive = true
    void getService(serviceId).then((row) => {
      if (!alive) return
      const env = row ? readEnvelope(row.serviceData) : null
      if (!env) setFailed('That service couldn’t be opened for broadcast.')
      else setEnvelope(env)
    })
    return () => {
      alive = false
    }
  }, [serviceId])

  /**
   * The deck, held as state rather than derived — because it can grow.
   *
   * A verse thrown up mid-sermon is appended to the item that is live, exactly
   * as it is on the desktop, so it sits inside the sermon instead of becoming a
   * section of its own and the order still reads as the service it is.
   */
  const [items, setItems] = useState<ServiceItem[]>([])
  useEffect(() => setItems(envelope?.service.items ?? []), [envelope])
  /** An item that has just been given a verse, waiting for the deck to catch up. */
  const jumpToLastOf = useRef<number | null>(null)
  /** How long that item's run was before the verses landed, so the jump can find
   *  the first NEW slide rather than the first old one. */
  const verseFrom = useRef(0)
  const deck = useMemo(() => flattenDeck(items), [items])
  const name = envelope?.service.name ?? 'Live Service'
  const theme = envelope?.service.theme as Theme | undefined
  const background = envelope?.service.background as Background | undefined

  const live = cursor >= 0 && cursor < deck.length ? deck[cursor] : null
  const upNext = cursor + 1 < deck.length ? deck[cursor + 1] : null

  // The viewer count comes from the relay on the OPERATOR channel — subscribing
  // as a viewer would count this presenter as one of the people watching.
  const { viewers } = useLiveState(keys.room, 'operator')

  const frame = useMemo<BroadcastFrame>(
    () => ({
      name,
      theme,
      background,
      order: outlineOf(items, live?.item ?? -1, live?.nth),
      blackout,
      clearText,
      showLogo,
      slide: live?.slide ?? null,
      next: upNext?.slide ?? null
    }),
    [name, theme, background, items, live, upNext, blackout, clearText, showLogo]
  )

  // Publish on every change, coalesced: moving a slide changes the frame two or
  // three times in one tick and the congregation only needs the last one.
  const [onAir, setOnAir] = useState(false)
  const latest = useRef(frame)
  useEffect(() => {
    latest.current = frame
    if (!keys.room || !envelope || ended) return
    const t = setTimeout(() => void publishFrame(keys.room, frame).then(setOnAir), 120)
    return () => clearTimeout(t)
  }, [frame, keys.room, envelope, ended])

  // Ended from the Operator's phone: off air at once, without waiting for
  // whoever is holding this device to notice the screen has changed.
  useEffect(() => {
    if (!ended || !keys.room) return
    void publishOff(keys.room, latest.current)
  }, [ended, keys.room])

  // Hold the operator seat while this screen is driving, renewing inside the
  // relay's lease. Handing over stops the renewal, and the seat lapses into a
  // phone's hands rather than being wrestled away from one.
  useEffect(() => {
    if (!keys.room || !envelope || ended || handedOver) return
    const renew = (): void => {
      void claimOperator(keys.room, keys.pin, me, { role: 'presenter' })
    }
    renew()
    const id = setInterval(renew, 12_000)
    const onHide = (): void => beaconRelease(keys.room, me)
    window.addEventListener('pagehide', onHide)
    // Whether this is a hand-over or the screen closing, the seat goes back at
    // once — a volunteer should not have to wait out a lease nobody is using.
    return () => {
      clearInterval(id)
      window.removeEventListener('pagehide', onHide)
      releaseOperator(keys.room, me)
    }
  }, [keys.room, keys.pin, me, envelope, ended, handedOver])

  // Leaving this screen ends the broadcast — the deck lives here, not on the
  // relay — so black the room out rather than freezing everyone on a slide.
  useEffect(() => {
    if (!keys.room || !envelope) return
    return () => {
      void publishOff(keys.room, latest.current)
    }
  }, [keys.room, envelope])

  // A stray refresh or a closed tab would take the service off air with it —
  // which is no longer true once it has been ended, so the guard lifts.
  useEffect(() => {
    if (!envelope || ended) return
    const warn = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [envelope, ended])

  useScreenVars()
  useWakeLock(!!envelope && !ended)
  useEffect(() => {
    document.documentElement.classList.add('channel-open')
    return () => document.documentElement.classList.remove('channel-open')
  }, [])

  const goTo = useCallback(
    (i: number) => setCursor(Math.max(-1, Math.min(deck.length - 1, i))),
    [deck.length]
  )
  const goNext = useCallback(() => setCursor((c) => Math.min(deck.length - 1, c + 1)), [deck.length])
  const goPrev = useCallback(() => setCursor((c) => Math.max(0, c - 1)), [])

  // Dropping the room once ended closes the control stream, which is what tells
  // the relay — and so the Operator's phone — that nothing is presenting here
  // any more. Staying subscribed would report the service as still on air.
  useRemoteCommands(
    ended ? '' : keys.room,
    keys.pin,
    useCallback(
      (cmd, arg) => {
        if (cmd === 'next') goNext()
        else if (cmd === 'prev') goPrev()
        else if (cmd === 'blackout') setBlackout((b) => !b)
        else if (cmd === 'clear') setClearText((c) => !c)
        else if (cmd === 'logo') setShowLogo((l) => !l)
        else if (cmd === 'end') setEnded(true)
        else if (cmd === 'verse' && arg && typeof arg === 'object') {
          // Onto whatever is live — which the operator only offers during the
          // sermon, so it is the sermon. Deliberately no timer: it stays up
          // until the operator moves on, because the preacher decides how long
          // a verse is wanted and a countdown would take it away mid-sentence.
          const at = cursor >= 0 && cursor < deck.length ? deck[cursor].item : -1
          if (at < 0) return
          // One slide per verse, as the desktop builds them. A whole passage on
          // one slide is unreadable from the back of a room.
          const passage = arg
          const parts = passage.slides?.length
            ? passage.slides
            : [{ label: passage.label, lines: passage.lines }]
          const built = parts
            .filter((sl) => sl.lines?.some((l) => l && l.trim()))
            .map((sl, k) => ({
              id: `v-${Date.now().toString(36)}-${k}-${Math.random().toString(36).slice(2, 6)}`,
              kind: 'scripture' as const,
              label: sl.label,
              lines: sl.lines,
              caption: sl.label
            }))
          if (!built.length) return
          setItems((list) => list.map((it, i) => (i === at ? { ...it, slides: [...it.slides, ...built] } : it)))
          // The cursor cannot move until the deck has been rebuilt around the
          // new slide, so the jump is deferred rather than computed against a
          // deck that is one slide out of date.
          verseFrom.current = deck.reduce((acc, d, i) => (d.item === at ? i + 1 : acc), 0)
          jumpToLastOf.current = at
        } else if (cmd === 'goto' && arg !== null && typeof arg === 'number') {
          // The outline the remote sees is the ITEM list, so a goto lands on the
          // first slide of that item.
          const at = deck.findIndex((d) => d.item === arg)
          if (at >= 0) goTo(at)
        }
      },
      [deck, cursor, goTo, goNext, goPrev]
    )
  )

  // The deferred jump: land on the verse that was just appended, which is the
  // last slide of the item it went into.
  useEffect(() => {
    const at = jumpToLastOf.current
    if (at == null) return
    jumpToLastOf.current = null
    // The FIRST of the verses just added, not the last: a passage is read from
    // its opening verse, and Next walks the rest.
    const first = deck.findIndex((d, i) => d.item === at && i >= verseFrom.current)
    if (first >= 0) setCursor(first)
  }, [deck])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // Slides move by swiping the screen, the way the Operator remote does — the
  // gesture is the whole surface, so it can be made without looking down for a
  // button. A short drag is a tap meant for one of the controls, not a swipe.
  const swipeFrom = useRef<{ x: number; y: number } | null>(null)
  const [swiped, setSwiped] = useState<'next' | 'prev' | null>(null)
  const onTouchStart = (e: ReactTouchEvent): void => {
    if (orderOpen) return
    const t = e.touches[0]
    swipeFrom.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: ReactTouchEvent): void => {
    const from = swipeFrom.current
    swipeFrom.current = null
    if (!from) return
    const t = e.changedTouches[0]
    const dx = t.clientX - from.x
    const dy = t.clientY - from.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return
    // Forward = swipe left OR up; back = swipe right OR down.
    const forward = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy < 0
    if (forward) goNext()
    else goPrev()
    setSwiped(forward ? 'next' : 'prev')
    setTimeout(() => setSwiped(null), 420)
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!confirmStop) return
    const t = setTimeout(() => setConfirmStop(false), 4000)
    return () => clearTimeout(t)
  }, [confirmStop])

  const viewerUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/+$/, '')}/c/${encodeURIComponent(
    keys.room
  )}`

  /**
   * Take the seat back from a phone.
   *
   * Forced, because the usual reason to want it back is that the phone it was
   * handed to has gone quiet — pocketed, flat, or carried out of the building —
   * and the service cannot wait out a lease to get its slides moving again.
   */
  const takeBack = async (): Promise<void> => {
    const r = await claimOperator(keys.room, keys.pin, me, { role: 'presenter', force: true })
    setHandedOver(false)
    setToast(r.ok ? 'You’re operating again' : 'Couldn’t reach the service')
  }

  const shareViewer = async (): Promise<void> => {
    try {
      if (navigator.share) {
        await navigator.share({ title: prettyServiceName(name), text: 'Follow the service live', url: viewerUrl })
        return
      }
      await navigator.clipboard.writeText(viewerUrl)
      setToast('Viewer link copied')
    } catch {
      /* cancelled, or the clipboard is blocked — nothing to report */
    }
  }

  // Local, not read back from the relay: the operator's own screen should move
  // the instant they press Next, not a network round trip later.
  const mirror: LiveState = {
    name,
    theme,
    background,
    blackout,
    clearText,
    showLogo,
    slide: live?.slide ?? null
  }
  const nextMirror: LiveState | null = upNext
    ? { name, theme, background, blackout: false, clearText: false, showLogo: false, slide: upNext.slide }
    : null

  if (failed) {
    return (
      <div className="lv-msg">
        <p>{failed}</p>
        <button className="lv-link" onClick={() => navigate('/build')}>
          Back to Service Builder
        </button>
      </div>
    )
  }
  if (!envelope) {
    return (
      <div className="lv-msg">
        <span className="spinner" />
        <p>Opening the service…</p>
      </div>
    )
  }
  if (!deck.length) {
    return (
      <div className="lv-msg">
        <p>This service has no slides to broadcast yet.</p>
        <button className="lv-link" onClick={() => navigate('/build')}>
          Back to Service Builder
        </button>
      </div>
    )
  }
  if (ended) {
    return (
      <div className="lv-msg">
        <p>
          <b className="text-white">The broadcast has ended.</b>
          <br />
          The operator took the service off air from their phone.
        </p>
        <button className="lv-link" onClick={() => navigate('/build')}>
          Back to Service Builder
        </button>
      </div>
    )
  }

  const showing = !!live && !blackout && !clearText && !showLogo
  const status = showing
    ? { label: 'LIVE', cls: 'bg-red-500 text-white' }
    : onAir
      ? { label: 'STANDBY', cls: 'bg-white/15 text-white/70' }
      : { label: 'CONNECTING', cls: 'bg-white/10 text-white/45' }

  return (
    <div className="lv-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="lv-head">
        <button className="lv-back" onClick={() => navigate('/build')} aria-label="Leave and stop broadcasting">
          <Icon name="back" size={18} strokeWidth={2.2} />
        </button>
        <div className="lv-headmain">
          <div className="lv-name">{prettyServiceName(name)}</div>
          <div className="lv-sub">
            {live ? `${cursor + 1} of ${deck.length} · ${live.title}` : `Not started · ${deck.length} slides ready`}
          </div>
        </div>
        <div className="lv-badges">
          {typeof viewers === 'number' && viewers > 0 && (
            <span className="lv-viewers">
              <Icon name="eye" size={13} strokeWidth={2} /> {viewers}
            </span>
          )}
          <span className={`lv-status ${status.cls}`}>{status.label}</span>
        </div>
      </header>

      <div className="lv-body">
        <section className="lv-section lv-current">
          <div className="lv-label">On screen</div>
          <div className="lv-card">
            <ConfidenceCard state={mirror} />
            {/* Nothing has been shown yet, and there is no button to press —
                say what the gesture is once, where the slide will appear. */}
            {cursor < 0 && <div className="lv-hint">Swipe to begin the service</div>}
          </div>
        </section>
        <section className="lv-section lv-next">
          <div className="lv-label">Next</div>
          <div className="lv-card">
            {nextMirror ? <ConfidenceCard state={nextMirror} /> : <div className="lv-end">End of service</div>}
          </div>
        </section>
      </div>

      <div className="lv-tools">
        <button
          className={`lv-tool${blackout ? ' is-on' : ''}`}
          onClick={() => setBlackout((b) => !b)}
          aria-pressed={blackout}
        >
          <Icon name="eye" size={17} />
          Black
        </button>
        <button
          className={`lv-tool${clearText ? ' is-on' : ''}`}
          onClick={() => setClearText((c) => !c)}
          aria-pressed={clearText}
        >
          <Icon name="text" size={17} />
          Clear
        </button>
        <button
          className={`lv-tool${showLogo ? ' is-on' : ''}`}
          onClick={() => setShowLogo((l) => !l)}
          aria-pressed={showLogo}
        >
          <Icon name="sparkle" size={17} />
          Logo
        </button>
        <button className="lv-tool" onClick={() => setOrderOpen(true)}>
          <Icon name="more" size={17} />
          Order
        </button>
      </div>

      {/* One bar: who is driving, and the two ways out. Sideways there is far
          more width than height, so these share a line rather than each taking
          one away from the slides. Whoever pressed Broadcast is operating it and
          holds the service's one operator seat until they pass it on — so the
          PIN is only worth showing once there is a seat for it to open. */}
      <div className="lv-bar">
        {handedOver ? (
          <>
            <span className="lv-seat-open">
              Operator PIN <b>{keys.pin}</b>
            </span>
            <span className="lv-seat-note">A phone can take over — you can still drive from here.</span>
            <button className="lv-link" onClick={() => void takeBack()}>
              Take back
            </button>
          </>
        ) : (
          <>
            <span className="lv-seat-mine">You’re operating</span>
            <span className="lv-seat-note" />
            <button className="lv-link" onClick={() => setHandedOver(true)}>
              Hand to a phone
            </button>
          </>
        )}
        <button className="lv-link" onClick={() => void shareViewer()}>
          Viewer link
        </button>
        <button className="lv-stop" onClick={() => (confirmStop ? navigate('/build') : setConfirmStop(true))}>
          {confirmStop ? 'Tap again to stop' : 'Stop'}
        </button>
      </div>

      {swiped && (
        <div className="lv-flash">
          <span>{swiped === 'next' ? '›' : '‹'}</span>
        </div>
      )}

      {orderOpen && (
        <div className="lv-sheet" role="dialog" aria-label="Order of service">
          <div className="lv-sheet-head">
            <span>Order of service</span>
            <button className="lv-back" onClick={() => setOrderOpen(false)} aria-label="Close">
              <Icon name="close" size={18} strokeWidth={2.2} />
            </button>
          </div>
          <div className="lv-sheet-body">
            {items.map((it, i) => {
              const at = deck.findIndex((d) => d.item === i)
              const count = deck.filter((d) => d.item === i).length
              return (
                <button
                  key={it.id}
                  className={`lv-item${live?.item === i ? ' is-live' : ''}`}
                  disabled={at < 0}
                  onClick={() => {
                    goTo(at)
                    setOrderOpen(false)
                  }}
                >
                  <span className="lv-item-n">{i + 1}</span>
                  <span className="lv-item-main">
                    <span className="lv-item-title">{it.title}</span>
                    <span className="lv-item-sub">
                      {it.kind === 'song' ? 'Song' : 'Reading'}
                      {it.slot === 'offering' ? ' · Offering' : it.slot === 'communion' ? ' · Communion' : ''} ·{' '}
                      {count} slide{count === 1 ? '' : 's'}
                    </span>
                  </span>
                  {live?.item === i && <span className="lv-now">NOW</span>}
                </button>
              )
            })}
          </div>
          <p className="lv-sheet-foot">
            The broadcast runs from this screen — leaving it takes the service off air.
          </p>
        </div>
      )}

      {toast && <div className="lv-toast">{toast}</div>}
    </div>
  )
}
