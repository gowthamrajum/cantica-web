import { Screen, Section } from '../components/app/Screen'
import { ListGroup, ListRow } from '../components/app/List'
import { CHURCH, zeffyEmbedUrl, zeffyFormUrl } from '../lib/church'

export function Give(): JSX.Element {
  return (
    <Screen
      variant="push"
      title="Give"
      back={{ to: '/more', label: 'More' }}
      eyebrow="Generosity"
      subtitle="Your giving supports worship, teaching, and the care of our church family."
    >
      <Section>
        <blockquote className="app-card p-5">
          <p className="font-serif text-[17px] italic leading-snug text-ink-soft">
            “Each of you should give what you have decided in your heart to give … for God loves a cheerful giver.”
          </p>
          <p className="mt-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-600">2 Corinthians 9:7</p>
        </blockquote>
      </Section>

      {/* The Zeffy form is a third-party embed and can't be styled to match, so it
          gets its own bordered card rather than pretending to be native chrome. */}
      <Section>
        <div className="app-card overflow-hidden border-gold-200">
          <iframe
            title="Give to Telugu Community Church"
            src={zeffyEmbedUrl}
            className="block h-[1250px] w-full"
            style={{ border: 0 }}
            loading="lazy"
            allow="payment"
          />
        </div>
      </Section>

      <ListGroup label="Other ways to give">
        <ListRow icon="external" tint="gold" title="Open the full form" subtitle="zeffy.com" href={zeffyFormUrl} />
        <ListRow icon="pin" tint="green" title="In person" subtitle="On Sunday at the worship service" chevron={false} />
        <ListRow icon="globe" tint="navy" title="By mail" subtitle={CHURCH.address} chevron={false} />
      </ListGroup>
    </Screen>
  )
}
