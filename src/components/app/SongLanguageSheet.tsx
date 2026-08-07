import { Sheet } from './Sheet'
import { Icon } from './Icons'
import type { ServiceLang } from '../../lib/buildService'

/**
 * Which languages a song is projected in.
 *
 * Two toggles rather than three choices, because that is what the setting
 * actually is: the song has a Telugu line and a transliteration, and each is
 * either on the slide or not. "Both" was a third option sitting beside two that
 * already implied it, and on a narrow row it read as the only one — a select
 * showing "Both" says nothing about what the alternatives are.
 *
 * At least one has to stay on. A song in no language is a blank slide, so the
 * last one standing refuses rather than silently leaving nothing to sing from.
 */
export function SongLanguageSheet({
  open,
  value,
  onChange,
  onClose
}: {
  open: boolean
  value: ServiceLang
  onChange: (lang: ServiceLang) => void
  onClose: () => void
}): JSX.Element {
  const telugu = value === 'both' || value === 'telugu'
  const english = value === 'both' || value === 'english'

  const set = (te: boolean, en: boolean): void => {
    if (!te && !en) return
    onChange(te && en ? 'both' : te ? 'telugu' : 'english')
  }

  const rows: { on: boolean; title: string; sub: string; toggle: () => void }[] = [
    {
      on: telugu,
      title: 'తెలుగు',
      sub: 'The Telugu lines',
      toggle: () => set(!telugu, english)
    },
    {
      on: english,
      title: 'English',
      sub: 'The transliteration, so anyone can sing along',
      toggle: () => set(telugu, !english)
    }
  ]

  return (
    <Sheet open={open} title="Language" onClose={onClose}>
      <div className="list-group mt-1">
        {rows.map((r) => {
          // Turning off the only one left would leave the slide blank.
          const lastOne = r.on && rows.filter((x) => x.on).length === 1
          return (
            <button
              key={r.title}
              className="list-row w-full text-left"
              onClick={r.toggle}
              disabled={lastOne}
              aria-pressed={r.on}
              title={lastOne ? 'A song has to be in at least one language' : undefined}
            >
              <span className="min-w-0 flex-1">
                <span className="list-title block">{r.title}</span>
                <span className="list-sub block">{r.sub}</span>
              </span>
              <span
                className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full border ${
                  r.on ? 'border-gold-500 bg-gold-500 text-white' : 'border-ink-muted/40 text-transparent'
                } ${lastOne ? 'opacity-60' : ''}`}
              >
                <Icon name="check" size={13} strokeWidth={3.2} />
              </span>
            </button>
          )
        })}
      </div>
      <p className="px-[var(--gutter)] pt-2.5 text-[13px] leading-relaxed text-ink-muted">
        Both on is the usual choice — the Telugu line with its transliteration under it, on the same slide.
      </p>
    </Sheet>
  )
}
