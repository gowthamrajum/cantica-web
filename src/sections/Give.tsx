import { CHURCH } from '../lib/church'
import { Reveal } from '../components/Reveal'

export function Give(): JSX.Element {
  return (
    <section id="give" className="container-x scroll-mt-20 py-24 sm:py-28">
      <Reveal className="relative mx-auto max-w-3xl overflow-hidden rounded-xl2 border border-gold-200 bg-[radial-gradient(120%_140%_at_50%_-20%,#fffdf9,#f6ecd8)] px-8 py-14 text-center shadow-soft sm:px-14">
        <div className="grain absolute inset-0 opacity-50" />
        <div className="relative z-10">
          <p className="eyebrow justify-center">Generosity</p>
          <blockquote className="mx-auto mt-6 max-w-xl font-serif text-2xl font-medium italic leading-snug text-ink sm:text-[1.7rem]">
            “Each of you should give what you have decided in your heart to give … for God loves a cheerful giver.”
          </blockquote>
          <p className="mt-4 text-sm font-semibold uppercase tracking-label text-gold-600">2 Corinthians 9:7</p>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
            Your generosity sustains our worship, cares for our community, and carries the good news further. Thank you for giving.
          </p>
          <a href={CHURCH.giving} target="_blank" rel="noopener" className="btn-gold mt-9">
            Give online
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 5h5v5M19 5l-9 9M18 14v4a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h4" />
            </svg>
          </a>
          <p className="mt-6 text-sm text-ink-muted">You can also give in person on Sunday, or by mail to {CHURCH.address}.</p>
        </div>
      </Reveal>
    </section>
  )
}
