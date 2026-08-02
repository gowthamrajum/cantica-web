import { useLayoutEffect, useRef } from 'react'
import { Sheet } from './Sheet'
import type { ServiceEnvelope, ServiceSlide } from '../../lib/buildService'

/**
 * How the picked songs and psalms will look once Cantica shows them.
 *
 * The cards render from the SAME envelope the export writes, on the theme and
 * background Cantica applies, and size their text by MEASURING it the way
 * Cantica's useFitText does rather than guessing. So the line-per-slide split
 * shown here is the split you get on the projector.
 */

/** Largest font (px) that fits the lines into the box, as Cantica finds it. */
function useFitText(deps: unknown[], lineHeight = 1.22): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = (): void => {
      const box = el.parentElement
      if (!box) return
      const availW = box.clientWidth
      const availH = box.clientHeight * 0.92
      if (!availW || !availH) return
      el.style.lineHeight = String(lineHeight)
      let lo = 6
      let hi = 400
      for (let i = 0; i < 18 && hi - lo > 0.4; i++) {
        const mid = (lo + hi) / 2
        el.style.fontSize = `${mid}px`
        if (el.scrollWidth <= availW + 1 && el.scrollHeight <= availH + 1) lo = mid
        else hi = mid
      }
      el.style.fontSize = `${lo}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

function SlideCard({
  slide,
  theme,
  background
}: {
  slide: ServiceSlide
  theme: Record<string, unknown>
  background: Record<string, unknown>
}): JSX.Element {
  const lines = slide.lines ?? []
  const ref = useFitText([lines.join('\n'), slide.singleLine])
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ aspectRatio: '16 / 9', background: String(background?.value ?? '#0a0720') }}
    >
      <div className="absolute inset-0" style={{ background: '#000', opacity: Number(theme?.scrim ?? 0.35) }} />
      {/* Padding out here, fit box unpadded — measuring against a padded box
          counts its own padding as free space and the text runs off the card. */}
      <div className="absolute inset-0" style={{ padding: '4% 6%' }}>
        <div className="flex h-full w-full items-center justify-center overflow-hidden">
          <div
            ref={ref}
            style={{
              display: 'inline-block',
              // A single-line slide carries no cap so its width stays honest and
              // the fit can shrink it — as Cantica's .oneline does.
              maxWidth: slide.singleLine ? 'none' : '92%',
              whiteSpace: slide.singleLine ? 'pre' : 'pre-wrap',
              wordBreak: slide.singleLine ? 'normal' : 'break-word',
              textAlign: 'center',
              color: String(theme?.textColor ?? '#fff'),
              fontFamily: String(theme?.fontFamily ?? 'inherit'),
              fontWeight: 700,
              textShadow: '0 2px 18px rgba(0,0,0,0.65)'
            }}
          >
            {lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>
      </div>
      <span className="absolute left-1.5 top-1 text-[10px] font-semibold text-white/70">{slide.label}</span>
    </div>
  )
}

export function SlidePreview({
  open,
  envelope,
  title,
  onClose
}: {
  open: boolean
  envelope: ServiceEnvelope | null
  title: string
  onClose: () => void
}): JSX.Element | null {
  const items = envelope?.service.items ?? []
  const total = items.reduce((n, it) => n + (it.slides?.length ?? 0), 0)
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <p className="mb-3 text-[13px] text-ink-muted">
        {items.length} item{items.length === 1 ? '' : 's'} · {total} slide{total === 1 ? '' : 's'} — sized by
        measuring the text, as Cantica does, so this is the split you'll get.
      </p>
      {total === 0 ? (
        <p className="text-[15px] text-ink-muted">Nothing to preview yet.</p>
      ) : (
        items.map((it) => (
          <div key={it.id} className="mb-5 last:mb-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[15px] font-semibold">{it.title}</span>
              {it.slot === 'offering' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Offering
                </span>
              )}
              <span className="text-[12px] text-ink-muted">
                {it.slides.length} slide{it.slides.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {it.slides.map((s) => (
                <SlideCard
                  key={s.id}
                  slide={s}
                  theme={envelope!.service.theme as Record<string, unknown>}
                  background={envelope!.service.background as Record<string, unknown>}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </Sheet>
  )
}
