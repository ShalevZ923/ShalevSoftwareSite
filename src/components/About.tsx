import { Icon } from "./ui";

const appVersion = import.meta.env.VITE_APP_VERSION?.trim() || "1.6.0-beta.2";

export function About({ onOpenCatalog }: { onOpenCatalog: () => void }) {
  return (
    <article className="page about-page">
      <header className="about-hero">
        <p className="about-kicker">Development Management</p>
        <h1 id="page-title" tabIndex={-1}>
          We triage the noise, then we publish what we support.
        </h1>
        <p className="about-lede">
          Tool Atlas is the catalog Development Management keeps for developers:
          the software we stand behind, the trusted way to get it, and the
          shortest path to using it without guessing.
        </p>
        <div className="about-hero-actions">
          <button type="button" className="primary-button" onClick={onOpenCatalog}>
            Open the catalog <Icon name="arrow" />
          </button>
          <a href="mailto:devex@atlas.local" className="about-secondary">
            Talk to the team <Icon name="mail" size={16} />
          </a>
        </div>
      </header>

      <section className="about-mission" aria-labelledby="about-mission-title">
        <div className="about-section-heading">
          <p className="about-kicker">Why this exists</p>
          <h2 id="about-mission-title">A shared answer, not another inbox.</h2>
          <p>
            Developers should not have to hunt for an approved build, wait on a
            thread to learn whether a tool is supported, or reconstruct setup
            from folklore. We built this catalog so triage has a destination.
          </p>
        </div>
        <div className="about-mission-grid">
          <article>
            <span className="point-number">01</span>
            <h3>Triage the request</h3>
            <p>
              When someone asks “can I use this?”, Development Management
              decides: already supported, needs a path, or out of scope. The
              catalog is that decision made visible.
            </p>
          </article>
          <article>
            <span className="point-number">02</span>
            <h3>Name what we support</h3>
            <p>
              Every listing is software we are willing to stand behind — with
              platform, lifecycle, owner, and a trusted download or pointer.
              If it is not here, it is not our supported set.
            </p>
          </article>
          <article>
            <span className="point-number">03</span>
            <h3>Show how to use it</h3>
            <p>
              Guides answer the immediate work: install, configure, use
              safely, and ask for help. Support is a named person or team, not
              a generic desk.
            </p>
          </article>
        </div>
      </section>

      <section className="about-team" aria-labelledby="about-team-title">
        <p className="about-kicker">Who built this</p>
        <h2 id="about-team-title">Development Management, with Shalev.</h2>
        <p>
          This catalog was built by the Development Management team — the
          group that sits between developer questions and the software we
          actually support. We do not try to list the entire industry. We
          publish the set we will help you with.
        </p>
        <p>
          Shalev designed and built Tool Atlas as the front door for that
          work: one place to compare tools, take a trusted path, read a
          practical guide, and see who owns the outcome.
        </p>
        <div className="about-people">
          <article className="about-person">
            <span className="about-person-mark" aria-hidden="true">SZ</span>
            <div>
              <strong>Shalev</strong>
              <small>Built Tool Atlas · Development Management</small>
            </div>
          </article>
          <article className="about-person">
            <span className="about-person-mark about-person-mark-team" aria-hidden="true">
              DM
            </span>
            <div>
              <strong>Development Management</strong>
              <small>Triage, support ownership, and the catalog you are in</small>
            </div>
          </article>
        </div>
      </section>

      <section className="about-howto" aria-labelledby="about-howto-title">
        <div className="about-section-heading">
          <p className="about-kicker">How to use it</p>
          <h2 id="about-howto-title">Four moves, then you are unblocked.</h2>
        </div>
        <ol className="about-steps">
          <li>
            <h3>Search the catalog</h3>
            <p>Filter by category, platform, and lifecycle until the right tool is in view.</p>
          </li>
          <li>
            <h3>Read the ownership</h3>
            <p>Check who supports it and whether the release is current, new, or legacy.</p>
          </li>
          <li>
            <h3>Take the trusted path</h3>
            <p>Use the listed download or same-server artifact — not an unofficial mirror.</p>
          </li>
          <li>
            <h3>Follow the guide</h3>
            <p>Install, configure, and request help from the people named on the entry.</p>
          </li>
        </ol>
      </section>

      <section className="principles" aria-labelledby="about-principles-title">
        <h2 id="about-principles-title">How we maintain the catalog</h2>
        <div>
          <article>
            <h3>Useful over exhaustive</h3>
            <p>
              We lead with supported software, then make lifecycle status clear
              when a legacy tool remains necessary.
            </p>
          </article>
          <article>
            <h3>Ownership is explicit</h3>
            <p>
              A product listing includes the team responsible for the
              platform — not an anonymous help desk.
            </p>
          </article>
          <article>
            <h3>Documentation is practical</h3>
            <p>
              Guides answer the immediate question: install, configure, use
              safely, and request help.
            </p>
          </article>
        </div>
      </section>

      <p className="about-version">
        <small>Version {appVersion}</small>
      </p>
    </article>
  );
}
