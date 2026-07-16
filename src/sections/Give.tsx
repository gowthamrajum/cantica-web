import { CHURCH } from '../lib/church'
import { Reveal } from '../components/Reveal'

const ZEFFY_ID = 'e6f000a9-b7eb-4b75-8a76-f5ffca44013c'

export function Give(): JSX.Element {
  return (
    <section id="give" className="container-x scroll-mt-20 py-24 sm:py-28">
      <Reveal className="mx-auto max-w-xl text-center">
        <p className="eyebrow justify-center">Generosity</p>
        <h2 className="mt-4 font-serif text-3xl font-semibold text-ink sm:text-4xl">Give</h2>
        <blockquote className="mx-auto mt-5 max-w-lg font-serif text-lg italic leading-snug text-ink-soft">
          “Each of you should give what you have decided in your heart to give … for God loves a cheerful giver.”
          <span className="mt-3 block text-sm font-semibold uppercase not-italic tracking-label text-gold-600">2 Corinthians 9:7</span>
        </blockquote>
      </Reveal>

      <Reveal className="mx-auto mt-10 max-w-xl overflow-hidden rounded-xl2 border border-gold-200 bg-card shadow-soft">
        <iframe
          title="Give to Telugu Community Church"
          src={`https://www.zeffy.com/embed/donation-form/${ZEFFY_ID}`}
          className="block h-[1250px] w-full"
          style={{ border: 0 }}
          loading="lazy"
          allow="payment"
          allowTransparency
        />
      </Reveal>

      <p className="mx-auto mt-6 max-w-lg text-center text-sm text-ink-muted">
        Zeffy passes 100% of your gift on to the church. You can also give in person on Sunday, or by mail to {CHURCH.address}.{' '}
        <a
          href={`https://www.zeffy.com/en-US/donation-form/${ZEFFY_ID}`}
          target="_blank"
          rel="noopener"
          className="font-semibold text-gold-600 underline-offset-2 hover:underline"
        >
          Open the full form ↗
        </a>
      </p>
    </section>
  )
}
