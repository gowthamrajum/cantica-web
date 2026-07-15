import { Emblem } from './Emblem'

/** An image slot. Pass `src` to show a real photo; otherwise it renders a warm,
 *  decorative placeholder (swap in real church photography later). */
export function PhotoFrame({
  src,
  alt = '',
  className = '',
  aspect = 'aspect-[4/5]',
  caption,
  tone = 'light'
}: {
  src?: string
  alt?: string
  className?: string
  aspect?: string
  caption?: string
  tone?: 'light' | 'dark'
}): JSX.Element {
  return (
    <div className={`relative overflow-hidden rounded-xl2 shadow-lift ring-1 ring-black/5 ${aspect} ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div
          className={`grain absolute inset-0 grid place-items-center ${
            tone === 'dark'
              ? 'bg-[radial-gradient(120%_90%_at_30%_0%,#22345c_0%,#141f38_55%,#0f1728_100%)] text-gold-300/40'
              : 'bg-[radial-gradient(120%_90%_at_30%_0%,#fffdf9_0%,#f6ecd8_55%,#efe2ca_100%)] text-gold-500/35'
          }`}
        >
          <Emblem className="h-1/3 w-1/3" />
          <span className={`pointer-events-none absolute inset-3 rounded-[1rem] ring-1 ${tone === 'dark' ? 'ring-white/10' : 'ring-gold-500/20'}`} />
        </div>
      )}
      {caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-900/75 to-transparent p-5">
          <span className="font-serif text-lg font-medium text-paper">{caption}</span>
        </div>
      )}
    </div>
  )
}
