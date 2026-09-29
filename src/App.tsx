import raw from './content.json'
import './theme.css'
import './index.css'

type Cta = { text: string; url: string }
type EventItem = {
  id: string; name: string; category: string; description: string
  date: string; time: string; venue: string; registerUrl: string
}
type Content = {
  nav?: { label: string; href: string }[]
  hero?: { badge: string; glyph?: string; title: string; subtitle: string; primaryCta: Cta; secondaryCta: Cta }
  events?: { heading: string; emptyText: string; items: EventItem[] }
  footer?: { heading: string; email: string; copyright: string }
}

const content = raw as Content

export default function App() {
  const { nav, hero, events, footer } = content

  return (
    <>
      <header className="nav">
        <nav>
          {nav?.map((n) => (
            <a key={n.href} href={n.href}>{n.label}</a>
          ))}
        </nav>
      </header>

      <main>
        {hero && (
          <section id="home" className="hero">
            {hero.glyph && <span className="glyph" aria-hidden="true">{hero.glyph}</span>}
            <span className="badge">{hero.badge}</span>
            <h1>{hero.title}</h1>
            <p>{hero.subtitle}</p>
            <div className="ctas">
              <a className="btn primary" href={hero.primaryCta.url}>{hero.primaryCta.text}</a>
              <a className="btn" href={hero.secondaryCta.url}>{hero.secondaryCta.text}</a>
            </div>
          </section>
        )}

        {events && (
          <section id="events" className="section">
            <h2>{events.heading}</h2>
            {events.items.length === 0 ? (
              <p>{events.emptyText}</p>
            ) : (
              <div className="grid">
                {events.items.map((e) => (
                  <article key={e.id} className="card">
                    <small>{e.category}</small>
                    <h3>{e.name}</h3>
                    <p>{e.description}</p>
                    <p>{e.date} · {e.time} · {e.venue}</p>
                    <a className="btn" href={e.registerUrl}>Register</a>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {footer && (
        <footer id="contact" className="footer">
          <h2>{footer.heading}</h2>
          <a href={`mailto:${footer.email}`}>{footer.email}</a>
          <p>{footer.copyright}</p>
        </footer>
      )}
    </>
  )
}
