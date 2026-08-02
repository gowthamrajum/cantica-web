import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icons'

/** A titled group of rows — the inset grouped list every native settings screen uses. */
export function ListGroup({ label, children }: { label?: string; children: ReactNode }): JSX.Element {
  return (
    <>
      {label && <div className="list-label">{label}</div>}
      <div className={`list-group${label ? '' : ' mt-2'}`}>{children}</div>
    </>
  )
}

/** Tinted icon tiles, so a row is scannable by colour before you read it. */
const TINT = {
  navy: 'bg-navy-700',
  gold: 'bg-gold-500',
  green: 'bg-emerald-600',
  red: 'bg-red-500',
  plum: 'bg-navy-500'
} as const
export type Tint = keyof typeof TINT

interface RowProps {
  icon?: IconName
  tint?: Tint
  title: string
  subtitle?: ReactNode
  /** Right-aligned secondary text (a value, a time, a count). */
  value?: ReactNode
  /** Internal route. */
  to?: string
  /** External URL — opens in a new tab and shows the external glyph. */
  href?: string
  onClick?: () => void
  chevron?: boolean
  children?: ReactNode
}

export function ListRow({
  icon,
  tint = 'navy',
  title,
  subtitle,
  value,
  to,
  href,
  onClick,
  chevron,
  children
}: RowProps): JSX.Element {
  const showChevron = chevron ?? (!!to || !!onClick)
  const body = (
    <>
      {icon && (
        <span className={`list-ico ${TINT[tint]}`}>
          <Icon name={icon} size={18} strokeWidth={2} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="list-title block">{title}</span>
        {subtitle && <span className="list-sub block">{subtitle}</span>}
        {children}
      </span>
      {value && <span className="flex-none text-[14px] font-medium text-ink-muted">{value}</span>}
      {href && <Icon name="external" size={16} className="list-chev" />}
      {showChevron && !href && <Icon name="chevron" size={17} className="list-chev" />}
    </>
  )

  const cls = `list-row${icon ? ' has-ico' : ''}`

  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    )
  }
  if (to) {
    return (
      <Link className={cls} to={to}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

/** Explanatory copy under a group, in the muted native-footnote style. */
export function ListNote({ children }: { children: ReactNode }): JSX.Element {
  return <p className="px-[calc(var(--gutter)+4px)] pt-2.5 text-[13px] leading-relaxed text-ink-muted">{children}</p>
}
