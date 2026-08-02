import { Screen, Section } from '../components/app/Screen'
import { ListGroup, ListRow } from '../components/app/List'
import { Icon } from '../components/app/Icons'
import { CHURCH } from '../lib/church'

export function Visit(): JSX.Element {
  return (
    <Screen
      variant="push"
      title="Plan your visit"
      back={{ to: '/more', label: 'More' }}
      eyebrow="We’d love to meet you"
      subtitle={`Join us ${CHURCH.liveTime.toLowerCase()}. Here’s a little of what to expect when you arrive.`}
    >
      <Section>
        <div className="app-card-dark p-5">
          <div className="grain absolute inset-0 opacity-40" />
          <div className="relative">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-gold-300">
              <Icon name="pin" size={22} />
            </span>
            <p className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-300">Our location</p>
            <p className="mt-2 font-serif text-[19px] leading-snug">{CHURCH.address}</p>
            <p className="mt-1 text-[14.5px] text-paper/70">{CHURCH.liveTime}</p>
            <div className="mt-5 flex gap-2.5">
              <a href={CHURCH.mapUrlG} target="_blank" rel="noopener noreferrer" className="btn-app btn-app-gold flex-1 text-[15px]">
                Directions
              </a>
              <a
                href={CHURCH.website}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-app btn-app-ghost-light flex-1 text-[15px]"
              >
                Website
              </a>
            </div>
          </div>
        </div>
      </Section>

      <ListGroup label="What to expect">
        {CHURCH.expect.map((e) => (
          <ListRow key={e.t} icon="check" tint="gold" title={e.t} subtitle={e.d} chevron={false} />
        ))}
      </ListGroup>

      <ListGroup label="When we gather">
        {CHURCH.services.map((s) => (
          <ListRow key={s.name} title={s.name} subtitle={`${s.te} · ${s.where}`} value={s.short} chevron={false} />
        ))}
      </ListGroup>

      <p className="px-[calc(var(--gutter)+4px)] pt-5 text-[13px] leading-relaxed text-ink-muted">
        Come as you are — there’s no dress code and no pressure. If it’s your first time, find anyone at the door and
        they’ll help you get settled.
      </p>
    </Screen>
  )
}
