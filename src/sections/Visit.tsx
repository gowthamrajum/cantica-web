import { CHURCH } from '../lib/church'
import { Reveal } from '../components/Reveal'

const EXPECT = [
  { t: 'Worship in Telugu', d: 'Songs and the message in our heart language, with warmth for every generation.' },
  { t: 'Come as you are', d: 'No dress code, no pressure — just a friendly welcome at the door.' },
  { t: 'Families welcome', d: 'Children and grandparents worship together as one family.' }
]

export function Visit(): JSX.Element {
  return (
    <section id="visit" className="scroll-mt-20 border-t border-line bg-panel/60">
      <div className="container-x grid items-center gap-12 py-24 sm:py-28 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="eyebrow">Plan your visit</p>
          <h2 className="mt-5 font-serif text-4xl font-semibold text-ink sm:text-[2.9rem]">We’d love to meet you.</h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">
            Join us this Sunday at 11:00 AM. Here’s a little of what to expect when you arrive.
          </p>

          <ul className="mt-8 space-y-5">
            {EXPECT.map((e) => (
              <li key={e.t} className="flex gap-4">
                <span className="mt-1 grid h-6 w-6 flex-none place-items-center rounded-full bg-gold-500 text-white">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11" /></svg>
                </span>
                <div>
                  <p className="font-semibold text-ink">{e.t}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-ink-soft">{e.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <div className="card-classic overflow-hidden">
            <div className="relative grid h-56 place-items-center bg-[radial-gradient(120%_120%_at_50%_0%,#22345c,#0f1728)] text-paper">
              <div className="grain absolute inset-0 opacity-30" />
              <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" strokeWidth="1.6" className="relative text-gold-300">
                <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.6" />
              </svg>
            </div>
            <div className="p-7">
              <p className="text-sm font-bold uppercase tracking-label text-gold-600">Our location</p>
              <p className="mt-3 font-serif text-xl text-ink">{CHURCH.address}</p>
              <p className="mt-1 text-ink-soft">{CHURCH.liveTime}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={CHURCH.mapUrlG} target="_blank" rel="noopener" className="btn-primary">Get directions</a>
                <a href={CHURCH.website} target="_blank" rel="noopener" className="btn-ghost">Visit our website</a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
