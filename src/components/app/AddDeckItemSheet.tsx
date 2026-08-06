import { Sheet } from './Sheet'
import { Icon } from './Icons'

/**
 * What goes in at the point the operator tapped.
 *
 * The four things a service is made of, in the order they come up: the songs
 * and readings this app already knows how to build, and the two ways a video or
 * a photo gets in — a link to one that is already somewhere, or a file off the
 * phone that has to be put somewhere first.
 */
export type AddKind = 'song' | 'psalm' | 'media' | 'url'

export function AddDeckItemSheet({
  open,
  position,
  uploadReady,
  onPick,
  onClose
}: {
  open: boolean
  /** "before Sermon", "at the end" — so it is never a mystery where this lands. */
  position: string
  /** False when no media store is configured; the row says so rather than failing. */
  uploadReady: boolean
  onPick: (kind: AddKind) => void
  onClose: () => void
}): JSX.Element {
  const row = (
    kind: AddKind,
    icon: 'songs' | 'text' | 'watch' | 'globe',
    tint: string,
    title: string,
    sub: string,
    disabled = false
  ): JSX.Element => (
    <button
      type="button"
      className="list-row has-ico"
      onClick={() => onPick(kind)}
      disabled={disabled}
    >
      <span className={`list-ico ${disabled ? 'bg-ink-muted' : tint}`}>
        <Icon name={icon} size={18} strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="list-title block">{title}</span>
        <span className="list-sub block">{sub}</span>
      </span>
      {!disabled && <Icon name="chevron" size={17} className="list-chev" />}
    </button>
  )

  return (
    <Sheet open={open} title="Add to the service" onClose={onClose}>
      <div className="px-[var(--gutter)]">
        <p className="-mt-1 mb-4 text-[14.5px] leading-relaxed text-ink-muted">Goes in {position}.</p>
      </div>
      <div className="list-group">
        {row('song', 'songs', 'bg-navy-700', 'Song', 'From the songbook, arranged as you like it')}
        {row('psalm', 'text', 'bg-navy-500', 'Responsive reading', 'A psalm, in Telugu and English')}
        {row('url', 'globe', 'bg-gold-500', 'Link', 'A YouTube link, or any video or image already online')}
        {row(
          'media',
          'watch',
          'bg-red-500',
          'File from this device',
          uploadReady
            ? 'Upload a video or photo and put it in the order'
            : 'No media store is set up yet — paste a link instead',
          !uploadReady
        )}
      </div>
    </Sheet>
  )
}
