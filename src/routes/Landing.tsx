import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Hero } from '../sections/Hero'
import { Welcome } from '../sections/Welcome'
import { Services } from '../sections/Services'
import { WatchBand } from '../sections/WatchBand'
import { Give } from '../sections/Give'
import { Visit } from '../sections/Visit'

export function Landing(): JSX.Element {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Welcome />
        <Services />
        <WatchBand />
        <Give />
        <Visit />
      </main>
      <Footer />
    </>
  )
}
