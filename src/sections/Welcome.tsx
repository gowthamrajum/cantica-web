import { CHURCH } from '../lib/church'
import { Reveal } from '../components/Reveal'
import { PhotoFrame } from '../components/PhotoFrame'

export function Welcome(): JSX.Element {
  return (
    <section id="welcome" className="container-x scroll-mt-20 py-24 sm:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <PhotoFrame aspect="aspect-[5/6]" caption="Sunday worship · 11 AM" className="mx-auto max-w-md" />
        </Reveal>

        <Reveal delay={120}>
          <p className="eyebrow">A warm welcome</p>
          <h2 className="mt-5 font-serif text-4xl font-semibold leading-[1.1] text-ink sm:text-[2.9rem]">
            Come as you are — <span className="text-gold-600">there’s a place for you.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">{CHURCH.welcome}</p>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            We gather to worship in our heart language, to open the Word together, and to care for one another as family. Whether you were born into faith or are only beginning to wonder, you’ll find a seat saved for you.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <span className="h-px w-12 bg-gold-500/70" />
            <span className="font-serif text-xl italic text-ink">The Telugu Community Church family</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
