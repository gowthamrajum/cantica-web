import { Sheet } from './Sheet'
import { Icon } from './Icons'
import type { OfferingUse } from '../../lib/buildService'

/** undefined = worship set only. */
export type OfferingRole = OfferingUse | undefined

/**
 * What part a song plays. "General and offering" is not a label but a real
 * difference in the deck — the song is emitted twice, once into the worship set
 * and once at the offering — so it has to be asked rather than inferred from a
 * toggle that can only be on or off.
 */
export function OfferingRoleSheet({
  open,
  songName,
  value,
  onChange,
  onClose
}: {
  open: boolean
  songName: string
  value: OfferingRole
  onChange: (next: OfferingRole) => void
  onClose: () => void
}): JSX.Element {
  const options: { id: OfferingRole; title: string; sub: string; tint: string }[] = [
    {
      id: undefined,
      title: 'General song',
      sub: 'Sung in the worship set only',
      tint: 'bg-navy-700'
    },
    {
      id: 'both',
      title: 'General and offering',
      sub: 'Sung in the worship set, and again at the offering',
      tint: 'bg-gold-500'
    },
    {
      id: 'only',
      title: 'Offering only',
      sub: 'Sung at the offering and nowhere else',
      tint: 'bg-emerald-600'
    }
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
                <Icon name={o.id === undefined ? 'songs' : 'give'} size={18} strokeWidth={2.2} />
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
          Cantica drops each into its own place in the Sunday order.
        </p>
      </div>
    </Sheet>
  )
}
