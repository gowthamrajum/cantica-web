import { Link } from 'react-router-dom'
import { Band, BandHead, CardGrid, Page } from '../../components/desktop/Page'
import { ExpectCard, InviteBand } from '../../components/desktop/Cards'
import { Icon } from '../../components/app/Icons'
import { PhotoFrame } from '../../components/PhotoFrame'
import { CHURCH } from '../../lib/church'

/** The practical questions, answered in the order a first-time visitor asks them. */
const PRACTICAL = [
  { q: 'When should I arrive?', a: 'A few minutes before 11. If you are late, come in anyway — nobody will turn round.' },
  { q: 'What do people wear?', a: 'Whatever you own. Some dress up, most don’t, and neither is the point.' },
  { q: 'Where do I park?', a: 'On site at 8001 Mustang Drive, free, with room close to the door.' },
  { q: 'What about my children?', a: 'Bring them. Children and grandparents worship in the same room, and the noise is welcome.' },
  { q: 'Is it all in Telugu?', a: 'The singing and the message are, and the scripture is read in Telugu and English.' },
  { q: 'Will I have to speak?', a: 'No. You are welcome to sit, listen, and leave without being asked anything.' }
]

export function Visit(): JSX.Element {
  return (
    <Page
      title={`Plan your visit · ${CHURCH.name}`}
      hero={
        <div className="dk-hero dk-hero-light">
          <div className="dk-wrap">
            <div className="dk-hero-row">
              <div>
                <span className="dk-eyebrow">We’d love to meet you</span>
                <h1 className="dk-hero-title">Plan your visit</h1>
                <p className="dk-hero-lede">
                  We gather {CHURCH.liveTime.replace(' · ', ' at ')} on Mustang Drive in Irving. Here is a little of
                  what to expect when you arrive — and everything you might otherwise have to ask someone.
                </p>
                <div className="dk-hero-cta">
                  <a
                    href={CHURCH.mapUrlG}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dk-btn dk-btn-gold dk-btn-lg"
                  >
                    Get directions <Icon name="external" size={16} strokeWidth={2.2} />
                  </a>
                  <Link to="/watch" className="dk-btn dk-btn-quiet dk-btn-lg">
                    Watch from home <Icon name="chevron" size={16} strokeWidth={2.4} />
                  </Link>
                </div>
              </div>
              <div className="dk-hero-art">
                <PhotoFrame tone="dark" aspect="aspect-[4/5]" caption="8001 Mustang Drive, Irving" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      {/* Where and when, stated once, unmissably. */}
      <Band tone="navy">
        <div className="grid gap-[clamp(28px,3.5vw,64px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <span className="dk-eyebrow text-gold-300">Our location</span>
            <p className="mt-3 font-serif text-[clamp(26px,2.4vw,34px)] font-semibold leading-tight text-paper">
              {CHURCH.address}
            </p>
            <p className="mt-3 text-[17px] text-paper/70">{CHURCH.liveTime}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={CHURCH.mapUrlG} target="_blank" rel="noopener noreferrer" className="dk-btn dk-btn-gold">
                Google Maps <Icon name="external" size={15} strokeWidth={2.2} />
              </a>
              <a href={CHURCH.mapUrl} target="_blank" rel="noopener noreferrer" className="dk-btn dk-btn-ghost-light">
                Apple Maps <Icon name="external" size={15} strokeWidth={2.2} />
              </a>
            </div>
          </div>
          <div className="grid content-center gap-4">
            {CHURCH.services.map((s) => (
              <div key={s.name} className="dk-when-row">
                <span className="dk-when-name">
                  {s.name}
                  <span className="dk-when-te">{s.te}</span>
                </span>
                <span className="dk-when-time">{s.short}</span>
                <span className="dk-when-where">{s.where}</span>
              </div>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="paper">
        <BandHead
          eyebrow="Your first Sunday"
          title="What to expect"
          sub="Come as you are — there’s no dress code and no pressure. If it’s your first time, find anyone at the door and they’ll help you get settled."
        />
        <CardGrid cols={3}>
          {CHURCH.expect.map((e, i) => (
            <ExpectCard key={e.t} n={i + 1} title={e.t} body={e.d} />
          ))}
        </CardGrid>
      </Band>

      <Band tone="panel">
        <BandHead eyebrow="Before you come" title="The questions everyone asks" />
        <CardGrid cols={3}>
          {PRACTICAL.map((p) => (
            <div key={p.q} className="dk-qa">
              <h3 className="dk-qa-q">{p.q}</h3>
              <p className="dk-qa-a">{p.a}</p>
            </div>
          ))}
        </CardGrid>
      </Band>

      {/* No service cards here: the navy band above already gives all three
          gatherings with their times and where each one happens. Saying it
          twice on one page makes the page longer, not clearer. */}

      <Band tone="gold">
        <InviteBand />
      </Band>
    </Page>
  )
}
