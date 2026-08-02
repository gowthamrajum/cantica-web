import { Screen } from '../components/app/Screen'
import { ListGroup, ListNote, ListRow } from '../components/app/List'
import { CHURCH } from '../lib/church'

export function More(): JSX.Element {
  return (
    <Screen title="More" eyebrow={CHURCH.nameTe} subtitle={`${CHURCH.tagline} · ${CHURCH.city}`}>
      <ListGroup label="Our church">
        <ListRow icon="calendar" tint="navy" title="Service times" subtitle="Worship, Bible study & prayer" to="/services" />
        <ListRow icon="pin" tint="green" title="Plan your visit" subtitle="Where we are, what to expect" to="/visit" />
        <ListRow icon="people" tint="plum" title="About us" subtitle="Who we are as a family" to="/about" />
        <ListRow icon="give" tint="red" title="Give" subtitle="Support the ministry" to="/give" />
      </ListGroup>

      <ListGroup label="Connect">
        <ListRow icon="globe" tint="navy" title="Church website" subtitle={CHURCH.website.replace('https://', '')} href={CHURCH.website} />
        <ListRow icon="pin" tint="gold" title="Get directions" subtitle={CHURCH.address} href={CHURCH.mapUrlG} />
      </ListGroup>

      <ListGroup label="For our team">
        <ListRow
          icon="remote"
          tint="gold"
          title="Operator remote"
          subtitle="Drive the live slides from your phone"
          to="/remote"
        />
      </ListGroup>
      <ListNote>
        The operator remote needs the control PIN shown in the Broadcast panel on the presenter computer.
      </ListNote>

      <div className="px-[var(--gutter)] pb-2 pt-9 text-center">
        <p className="font-serif text-[15px] font-semibold text-ink">{CHURCH.name}</p>
        <p className="mt-0.5 text-[13px] text-gold-600">{CHURCH.nameTe}</p>
        <p className="mt-2 text-[12.5px] text-ink-muted">{CHURCH.address}</p>
        <p className="mt-3 text-[12.5px] text-ink-muted">Made with care for our church family.</p>
      </div>
    </Screen>
  )
}
