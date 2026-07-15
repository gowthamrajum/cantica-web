import { CHURCH } from '../lib/church'
import { Reveal } from '../components/Reveal'
import { Emblem } from '../components/Emblem'

export function Services(): JSX.Element {
  return (
    <section id="services" className="scroll-mt-20 border-y border-line bg-panel/70">
      <div className="container-x py-24 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow justify-center">Gather with us</p>
          <h2 className="mt-5 font-serif text-4xl font-semibold text-ink sm:text-[2.9rem]">Times of worship &amp; prayer</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Three rhythms hold our week together — in person on Sunday, and online midweek. All are welcome at every one.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {CHURCH.services.map((s, i) => (
            <Reveal key={s.name} delay={i * 110}>
              <article className="card-classic group flex h-full flex-col p-7 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-navy-700 text-gold-300 shadow-soft">
                  <Emblem className="h-7 w-7" />
                </span>
                <h3 className="mt-6 font-serif text-2xl font-semibold text-ink">{s.name}</h3>
                <p className="mt-1 text-lg font-medium text-gold-600">{s.te}</p>
                <div className="mt-5 space-y-1.5 text-[15px] text-ink-soft">
                  <p className="font-semibold text-ink">{s.when}</p>
                  <p>{s.where}</p>
                </div>
                {s.note && <p className="mt-5 border-t border-line pt-4 text-[15px] italic text-ink-muted">{s.note}</p>}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
