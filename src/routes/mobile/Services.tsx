import { Link } from 'react-router-dom'
import { Screen, Section } from '../../components/app/Screen'
import { Icon } from '../../components/app/Icons'
import { Logo } from '../../components/Logo'
import { Te } from '../../components/Te'
import { CHURCH, usableLinks } from '../../lib/church'

export function Services(): JSX.Element {
  return (
    <Screen
      variant="push"
      title="Service times"
      back={{ to: '/more', label: 'More' }}
      eyebrow="Gather with us"
      subtitle="Three rhythms hold our week together — in person on Sunday, and online midweek. All are welcome at every one."
    >
      <Section className="space-y-3 px-[var(--gutter)]">
        {CHURCH.services.map((s) => (
          <article key={s.name} className="app-card mx-0 p-5">
            <div className="flex items-start gap-3.5">
              {/* Bare mark, not on a navy disc — the logo is blue and needs a
                  light backing to read. */}
              <Logo className="h-14 w-12 flex-none" />
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-[19px] font-semibold leading-tight text-ink">{s.name}</h2>
                <Te as="p" className="mt-0.5 text-[15px] font-medium text-gold-600">
                  {s.te}
                </Te>
              </div>
            </div>
            <div className="mt-4 space-y-1 border-t border-line pt-3.5">
              <p className="text-[15px] font-semibold text-ink">{s.when}</p>
              <p className="text-[14.5px] text-ink-soft">{s.where}</p>
              {s.note && <p className="pt-1.5 text-[14px] italic text-ink-muted">{s.note}</p>}
            </div>
            {/* Two of these three gatherings happen online and used to say so
                without saying where. This is the where. */}
            {usableLinks(s.links).length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-2">
                {usableLinks(s.links).map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`btn-app text-[15px] ${l.kind === 'youtube' ? 'btn-app-gold' : 'btn-app-quiet'} flex-1`}
                  >
                    {l.label} <Icon name="external" size={16} strokeWidth={2.2} />
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </Section>

      <Section>
        <div className="app-card p-5">
          <p className="font-serif text-[17px] font-semibold text-ink">Can’t be there in person?</p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">
            Every Sunday service streams live in Telugu — with the songs, scripture, and message following along on
            your screen, at home or across the world.
          </p>
          <Link to="/watch" className="btn-app btn-app-gold btn-block mt-4">
            Follow the service <Icon name="chevron" size={17} strokeWidth={2.4} />
          </Link>
        </div>
      </Section>
    </Screen>
  )
}
