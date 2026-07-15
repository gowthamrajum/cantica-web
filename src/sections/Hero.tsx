import { Link } from 'react-router-dom'
import { CHURCH } from '../lib/church'

export function Hero(): JSX.Element {
  return (
    <section id="top" className="relative flex min-h-[92svh] items-center overflow-hidden bg-navy-900 text-paper">
      {/* layered warm background */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#22345c_0%,#141f38_50%,#0b1120_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-[58%] rounded-full bg-gold-500/15 blur-[90px]" />
      <StainedGlass className="pointer-events-none absolute left-1/2 top-1/2 h-[118%] w-auto -translate-x-1/2 -translate-y-1/2 text-gold-300/[.13]" />
      <div className="grain absolute inset-0 opacity-40" />

      <div className="container-x relative z-10 py-28 text-center">
        <p className="eyebrow justify-center !text-gold-300 before:!bg-gold-300/60 after:ml-1 after:h-px after:w-8 after:bg-gold-300/60 after:content-['']">
          {CHURCH.name} · {CHURCH.city}
        </p>

        <h1 className="mx-auto mt-6 max-w-3xl font-serif text-[2.9rem] font-semibold leading-[1.08] tracking-[-0.01em] sm:text-6xl">
          Come and worship
          <br className="hidden sm:block" /> with us.
        </h1>

        <p className="mx-auto mt-5 font-serif text-xl italic text-gold-200/90 sm:text-2xl">{CHURCH.taglineTe}</p>

        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-paper/80">
          A warm, Christ-centered Telugu family in the heart of Dallas–Fort Worth. However you come, and wherever you are on the journey — you are welcome here.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#visit" className="btn-gold w-full sm:w-auto">Plan your visit</a>
          <Link to="/watch" className="btn-ghost-light w-full sm:w-auto">
            Follow the service
          </Link>
        </div>

        <div className="mt-10 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
          <span className="font-semibold text-paper/90">Sunday Worship</span>
          <span className="text-paper/60">·</span>
          <span className="text-paper/75">11:00 AM · 8001 Mustang Drive, Irving</span>
        </div>
      </div>

      {/* scroll cue */}
      <a href="#welcome" aria-label="Scroll down" className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-paper/50 transition hover:text-gold-300">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </a>
    </section>
  )
}

/** A stylised stained-glass lancet window, used as a faint backdrop motif. */
function StainedGlass({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 200 380" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5">
        <path d="M20 380V95C20 45 55 8 100 8s80 37 80 87v285" />
        <path d="M100 8v372" />
        <path d="M20 150h160M20 235h160M20 320h160" />
        <path d="M60 26v354M140 26v354" opacity=".6" />
        {/* tracery at the crown */}
        <circle cx="100" cy="70" r="26" opacity=".7" />
        <path d="M100 44v52M74 70h52" opacity=".5" />
      </g>
    </svg>
  )
}
