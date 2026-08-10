import { Screen } from '../components/app/Screen'
import { ListGroup, ListNote, ListRow } from '../components/app/List'
import { CHURCH } from '../lib/church'
import { Te } from '../components/Te'
import { useDesktopCapable, useViewPref } from '../lib/useDevice'

export function More(): JSX.Element {
  // The way back to the desktop version, shown only where there is one to go
  // to. The desktop footer offers the reverse; without this the switch there
  // would be a one-way door.
  const capable = useDesktopCapable()
  const [, setView] = useViewPref()

  return (
    <Screen
      title="More"
      eyebrow={<Te>{CHURCH.nameTe}</Te>}
      subtitle={`${CHURCH.tagline} · ${CHURCH.city}`}
    >
      <ListGroup label="Our church">
        <ListRow icon="calendar" tint="navy" title="Service times" subtitle="Worship, Bible study & prayer" to="/services" />
        <ListRow icon="pin" tint="green" title="Plan your visit" subtitle="Where we are, what to expect" to="/visit" />
        <ListRow icon="people" tint="plum" title="About us" subtitle="Who we are as a family" to="/about" />
        <ListRow icon="give" tint="red" title="Give" subtitle="Support the ministry" to="/give" />
        <ListRow icon="bell" tint="gold" title="Notifications" subtitle="Hear when the service goes live" to="/notifications" />
        <ListRow icon="plus" tint="gold" title="Add to your phone" subtitle="Install the app, or share it with your group" to="/install" />
      </ListGroup>

      <ListGroup label="Connect">
        <ListRow icon="globe" tint="navy" title="Church website" subtitle={CHURCH.website.replace('https://', '')} href={CHURCH.website} />
        <ListRow icon="pin" tint="gold" title="Get directions" subtitle={CHURCH.address} href={CHURCH.mapUrlG} />
      </ListGroup>

      <ListGroup label="For our team">
        <ListRow
          icon="sparkle"
          tint="plum"
          title="Service Builder"
          subtitle="Pick Sunday's songs and readings for Cantica"
          to="/build"
        />
        <ListRow
          icon="remote"
          tint="gold"
          title="Operator remote"
          subtitle="Drive the live slides from your phone"
          to="/remote"
        />
        <ListRow
          icon="bell"
          tint="navy"
          title="Send a notification"
          subtitle="Tell the church something — needs the PIN"
          to="/notify"
        />
      </ListGroup>
      <ListNote>
        The operator remote needs the control PIN shown in the Broadcast panel on the presenter computer.
      </ListNote>

      {capable && (
        <ListGroup label="This device">
          <ListRow
            icon="globe"
            tint="navy"
            title="Desktop version"
            subtitle="The full site, laid out for a big screen"
            onClick={() => setView('desktop')}
          />
        </ListGroup>
      )}

      <div className="px-[var(--gutter)] pb-2 pt-9 text-center">
        <p className="font-serif text-[15px] font-semibold text-ink">{CHURCH.name}</p>
        <Te as="p" className="mt-0.5 text-[13px] text-gold-600">
          {CHURCH.nameTe}
        </Te>
        <p className="mt-2 text-[12.5px] text-ink-muted">{CHURCH.address}</p>
        <p className="mt-3 text-[12.5px] text-ink-muted">Made with care for our church family.</p>
      </div>
    </Screen>
  )
}
