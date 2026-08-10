import { Link } from 'react-router-dom'
import { Band, BandHead, CardGrid, Page } from '../../components/desktop/Page'
import { ExpectCard, InviteBand, ServiceCard } from '../../components/desktop/Cards'
import { Icon, type IconName } from '../../components/app/Icons'
import { Logo } from '../../components/Logo'
import { Te } from '../../components/Te'
import { PhotoFrame } from '../../components/PhotoFrame'
import { CHURCH } from '../../lib/church'

/**
 * What we are for. Three sentences a visitor could repeat back after one read —
 * the church's own answer to "why does this exist", not a list of programmes.
 */
const PURPOSE: { icon: IconName; title: string; te: string; body: string }[] = [
  {
    icon: 'songs',
    title: 'To worship in our heart language',
    te: 'ఆరాధన',
    body: 'We sing and pray in Telugu because it is the language our faith learned to speak in. Nobody should have to translate their own worship.'
  },
  {
    icon: 'bible',
    title: 'To open the Word together',
    te: 'వాక్యం',
    body: 'Scripture read plainly, taught honestly, and carried home. Sunday, midweek Bible study, and whenever two of us sit down with it.'
  },
  {
    icon: 'people',
    title: 'To care for one another as family',
    te: 'కుటుంబం',
    body: 'Meals, prayer, and showing up. Far from where most of us were born, this is the family that notices when you are missing.'
  }
]

export function About(): JSX.Element {
  return (
    <Page
      title={`About us · ${CHURCH.name}`}
      hero={
        <div className="dk-hero dk-hero-light">
          <div className="dk-wrap">
            <div className="dk-hero-row">
              <div>
                <span className="dk-eyebrow">A warm welcome</span>
                <h1 className="dk-hero-title">
                  Come as you are — <span className="text-gold-600">there’s a place for you.</span>
                </h1>
                <p className="dk-hero-lede">{CHURCH.welcome}</p>
                <Te as="p" className="dk-hero-te">
                  {CHURCH.taglineTe}
                </Te>
                <div className="dk-hero-cta">
                  <Link to="/visit" className="dk-btn dk-btn-gold dk-btn-lg">
                    Plan your visit
                  </Link>
                  <Link to="/services" className="dk-btn dk-btn-quiet dk-btn-lg">
                    Service times <Icon name="chevron" size={16} strokeWidth={2.4} />
                  </Link>
                </div>
              </div>
              <div className="dk-hero-art">
                <PhotoFrame tone="dark" aspect="aspect-[4/5]" caption="Sunday worship · 11 AM" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      {/* Who we are — the long-form copy, given the width to be read as prose. */}
      <Band tone="paper">
        <div className="grid gap-[clamp(32px,4vw,72px)] lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)]">
          <div>
            <span className="dk-eyebrow">Who we are</span>
            <h2 className="dk-band-title" lang="te">
              {CHURCH.nameTe}
            </h2>
            <div className="mt-6 flex items-center gap-3.5">
              <Logo className="h-16 w-14 flex-none" />
              <div>
                <p className="font-serif text-[17px] font-semibold text-ink">{CHURCH.name}</p>
                <p className="text-[14.5px] text-gold-600">{CHURCH.city}</p>
              </div>
            </div>
          </div>
          <div>
            <div className="dk-prose">
              {CHURCH.about.map((p, i) => (
                <p key={i} className={i === 0 ? 'text-[19px] leading-[1.65] text-ink' : undefined}>
                  {p}
                </p>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-4 border-t border-line pt-6">
              <span className="h-px w-10 flex-none bg-gold-500/70" />
              <span className="font-serif text-[18px] italic text-ink">The {CHURCH.name} family</span>
            </div>
          </div>
        </div>
      </Band>

      {/* What we are for. */}
      <Band tone="navy">
        <BandHead
          tone="dark"
          eyebrow="What we are for"
          title="Three things we gather to do"
          sub="Everything else this church does is downstream of these."
        />
        <CardGrid cols={3}>
          {PURPOSE.map((p) => (
            <article key={p.title} className="dk-purpose">
              <span className="dk-purpose-ico">
                <Icon name={p.icon} size={24} strokeWidth={1.9} />
              </span>
              <Te as="p" className="dk-purpose-te">
                {p.te}
              </Te>
              <h3 className="dk-purpose-title">{p.title}</h3>
              <p className="dk-purpose-body">{p.body}</p>
            </article>
          ))}
        </CardGrid>
      </Band>

      <Band tone="paper">
        <BandHead
          eyebrow="Your first Sunday"
          title="What to expect"
          sub="If you have never been, this is the whole of it."
          action={{ to: '/visit', label: 'Plan your visit' }}
        />
        <CardGrid cols={3}>
          {CHURCH.expect.map((e, i) => (
            <ExpectCard key={e.t} n={i + 1} title={e.t} body={e.d} />
          ))}
        </CardGrid>
      </Band>

      <Band tone="panel">
        <BandHead
          eyebrow="Come and see"
          title="When we gather"
          sub="Three rhythms hold our week together — in person on Sunday, and online midweek."
          action={{ to: '/services', label: 'All service times' }}
        />
        <CardGrid cols={3}>
          {CHURCH.services.map((s) => (
            <ServiceCard key={s.name} service={s} />
          ))}
        </CardGrid>
      </Band>

      <Band tone="gold">
        <InviteBand />
      </Band>
    </Page>
  )
}
