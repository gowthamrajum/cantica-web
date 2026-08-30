import { Sheet } from './Sheet'
import { Icon } from './Icons'

export type ShareAs = 'pdf' | 'pptx'

/**
 * Which file to share.
 *
 * The two are for different people. The sheet is read — from a stand, on a
 * phone, printed — and it carries the .cantica.json inside it so the projection
 * machine gets the service with it. The deck is projected, on a laptop that has
 * PowerPoint and nothing else, which is why it is pictures rather than text:
 * Telugu renders correctly whether or not the font is installed.
 *
 * Said plainly here rather than left to the names, because "PDF or PowerPoint"
 * is a question about file types and the real question is what it is for.
 */
export function ShareFormatSheet({
  open,
  slides,
  onPick,
  onClose
}: {
  open: boolean
  /** How many slides a deck would come to — the honest warning about the wait. */
  slides: number
  onPick: (as: ShareAs) => void
  onClose: () => void
}): JSX.Element {
  const rows: { as: ShareAs; title: string; sub: string }[] = [
    {
      as: 'pdf',
      title: 'PDF sheet',
      sub: 'To read from — one part per page, with the Cantica file inside it'
    },
    {
      as: 'pptx',
      title: 'PowerPoint slides',
      sub:
        slides > 0
          ? `To project — ${slides} slide${slides === 1 ? '' : 's'}, opens anywhere`
          : 'To project — opens in PowerPoint, Keynote or Google Slides'
    }
  ]

  return (
    <Sheet open={open} title="Share as" onClose={onClose}>
      <div className="list-group mt-1">
        {rows.map((r) => (
          <button key={r.as} className="list-row w-full text-left" onClick={() => onPick(r.as)}>
            <span className="min-w-0 flex-1">
              <span className="list-title block">{r.title}</span>
              <span className="list-sub block">{r.sub}</span>
            </span>
            <Icon name="chevron" size={16} className="flex-none opacity-40" />
          </button>
        ))}
      </div>
      {slides > 60 && (
        <p className="px-[var(--gutter)] pt-2.5 text-[13px] leading-relaxed text-ink-muted">
          The slides are drawn one at a time, so a service this long takes a minute or so to build. Leave
          the screen on while it works.
        </p>
      )}
    </Sheet>
  )
}
