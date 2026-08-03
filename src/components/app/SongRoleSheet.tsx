import { Sheet } from './Sheet'
import { Icon, type IconName } from './Icons'
import type { SongRole } from '../../lib/buildService'

/** undefined = the worship set only. */
export type Role = SongRole | undefined

/**
 * What part a song plays. The "+ general" forms are not labels but a real
 * difference in the deck — the song is emitted twice, once into the worship set
 * and once into its slot — so this has to be asked rather than inferred from a
 * toggle that can only be on or off.
 *
 * Communion appears only on the month's first Sunday, because that is the only
 * service that serves it.
 */
export function SongRoleSheet({
  open,
  songName,
  value,
  firstSunday,
  onChange,
  onClose
}: {
  open: boolean
  songName: string
  value: Role
  /** Whether the service falls on the month's first Sunday. */
  firstSunday: boolean
  onChange: (next: Role) => void
  onClose: () => void
}): JSX.Element {
  const options: { id: Role; title: string; sub: string; tint: string; icon: IconName }[] = [
    { id: undefined, title: 'General song', sub: 'Sung in the worship set only', tint: 'bg-navy-700', icon: 'songs' },
    {
      id: 'offering+general',
      title: 'General and offering',
      sub: 'Sung in the worship set, and again at the offering',
      tint: 'bg-gold-500',
      icon: 'offering'
    },
    {
      id: 'offering',
      title: 'Offering only',
      sub: 'Sung at the offering and nowhere else',
      tint: 'bg-emerald-600',
      icon: 'offering'
    },
    ...(firstSunday
      ? ([
          {
            id: 'communion+general' as Role,
            title: 'General and communion',
            sub: 'Sung in the worship set, and again at communion',
            tint: 'bg-red-500',
            icon: 'communion' as IconName
          },
          {
            id: 'communion' as Role,
            title: 'Communion only',
            sub: 'Sung at communion and nowhere else',
            tint: 'bg-red-500',
            icon: 'communion' as IconName
          }
        ])
      : [])
  ]

  return (
    <Sheet open={open} title="When is this sung?" onClose={onClose}>
      <div className="px-[var(--gutter)]">
        <p className="-mt-1 mb-4 font-serif text-[17px] font-semibold text-ink">{songName}</p>
        <div className="list-group">
          {options.map((o) => (
            <button
              key={o.title}
              type="button"
              className="list-row has-ico"
              onClick={() => {
                onChange(o.id)
                onClose()
              }}
            >
              <span className={`list-ico ${o.tint}`}>
                <Icon name={o.icon} size={18} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="list-title block">{o.title}</span>
                <span className="list-sub block">{o.sub}</span>
              </span>
              {o.id === value && <Icon name="check" size={18} className="flex-none text-gold-600" strokeWidth={2.6} />}
            </button>
          ))}
        </div>
        <p className="px-1 pb-2 pt-3 text-[13px] leading-relaxed text-ink-muted">
          {firstSunday
            ? 'Communion is served on the month’s first Sunday, so it is offered here.'
            : 'Communion only appears on the month’s first Sunday.'}
        </p>
      </div>
    </Sheet>
  )
}
