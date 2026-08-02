import { Link } from 'react-router-dom'
import { Screen, Section } from '../components/app/Screen'
import { ListGroup, ListRow } from '../components/app/List'
import { Icon } from '../components/app/Icons'
import { Logo } from '../components/Logo'
import { PhotoFrame } from '../components/PhotoFrame'
import { CHURCH } from '../lib/church'

export function About(): JSX.Element {
  return (
    <Screen
      variant="push"
      title="About us"
      back={{ to: '/more', label: 'More' }}
      eyebrow="A warm welcome"
      subtitle="Come as you are — there’s a place for you."
    >
      <Section className="px-[var(--gutter)]">
        <PhotoFrame aspect="aspect-[16/10]" caption="Sunday worship · 11 AM" />
      </Section>

      <Section>
        <div className="app-card p-5">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-6 flex-none" />
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-600">{CHURCH.nameTe}</p>
          </div>
          {CHURCH.about.map((p, i) => (
            <p key={i} className={`text-[15.5px] leading-relaxed text-ink-soft ${i === 0 ? 'mt-3.5' : 'mt-3'}`}>
              {p}
            </p>
          ))}
          <div className="mt-5 flex items-center gap-3.5 border-t border-line pt-4">
            <span className="h-px w-9 flex-none bg-gold-500/70" />
            <span className="font-serif text-[16px] italic text-ink">The {CHURCH.name} family</span>
          </div>
        </div>
      </Section>

      <ListGroup label="Come and see">
        <ListRow icon="calendar" tint="navy" title="Service times" subtitle="Worship, Bible study & prayer" to="/services" />
        <ListRow icon="pin" tint="green" title="Plan your visit" subtitle={CHURCH.address} to="/visit" />
        <ListRow icon="watch" tint="red" title="Follow the service" subtitle="Streams live in Telugu" to="/watch" />
      </ListGroup>

      <Section>
        <div className="app-card-dark px-5 py-7 text-center">
          <div className="grain absolute inset-0 opacity-40" />
          <div className="relative">
            <p className="font-serif text-[19px] italic leading-snug text-gold-200/90">{CHURCH.taglineTe}</p>
            <p className="mt-2.5 text-[14.5px] text-paper/70">{CHURCH.tagline}</p>
            <Link to="/give" className="btn-app btn-app-ghost-light mt-5 inline-flex text-[15px]">
              Support the ministry <Icon name="chevron" size={16} strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </Section>
    </Screen>
  )
}
