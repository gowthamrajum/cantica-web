import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'

export function WatchBand(): JSX.Element {
  return (
    <section id="watch" className="relative scroll-mt-20 overflow-hidden bg-navy-800 text-paper">
      <div className="absolute -right-24 top-1/2 h-[60vmin] w-[60vmin] -translate-y-1/2 rounded-full bg-gold-500/10 blur-[100px]" />
      <div className="grain absolute inset-0 opacity-30" />
      <div className="container-x relative z-10 grid items-center gap-12 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="eyebrow !text-gold-300 before:!bg-gold-300/60">Can’t be there in person?</p>
          <h2 className="mt-5 font-serif text-4xl font-semibold leading-[1.1] sm:text-[2.9rem]">Worship with us, wherever you are.</h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/80">
            Every Sunday service streams live in Telugu — with the songs, scripture, and message following along on your screen, at home or across the world.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/watch" className="btn-gold w-full sm:w-auto">Follow the service</Link>
            <a href="#services" className="btn-ghost-light w-full sm:w-auto">See service times</a>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="relative mx-auto aspect-video w-full max-w-lg overflow-hidden rounded-xl2 bg-[radial-gradient(120%_100%_at_30%_0%,#22345c,#0f1728)] shadow-lift ring-1 ring-white/10">
            <div className="grain absolute inset-0 opacity-40" />
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live Sundays
            </div>
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-paper/95 text-navy-800 shadow-gold transition hover:scale-105">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-900/80 to-transparent p-5">
              <span className="font-serif text-lg text-paper">Sunday Worship · 11:00 AM</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
