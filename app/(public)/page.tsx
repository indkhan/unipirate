import Link from "next/link";

import styles from "./home.module.css";

const routeStations = ["Eligibility", "APS", "Applications", "Visa", "Germany"];

const countries = [
  { code: "in", name: "India" },
  { code: "pk", name: "Pakistan" },
  { code: "sa", name: "Saudi Arabia" },
];

export const metadata = {
  title: "Your path to a German public university — UniPirate",
  description:
    "Check your route to a German public university with sourced eligibility guidance.",
};

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link className={styles.brand} href="/">
            UniPirate
          </Link>
          <Link className={styles.signIn} href="/login">
            Sign in
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.routePreview} aria-label="Your application route">
            {routeStations.map((station, index) => (
              <div className={styles.routeStation} key={station}>
                <span
                  className={
                    index === 0 ? styles.currentDot : styles.upcomingDot
                  }
                />
                <span className={index === 0 ? styles.currentLabel : ""}>
                  {station}
                </span>
                {index < routeStations.length - 1 && (
                  <span className={styles.routeSegment} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Study in Germany · public universities</p>
            <h1>See your path to a German public university.</h1>
            <p>
              Answer a few questions. We match your profile against sourced
              admission rules and show what to do next.
            </p>
          </div>

          <div className={styles.checkerCard}>
            <div className={styles.questionRow}>
              <h2>Where did you finish school?</h2>
              <span>Start here</span>
            </div>
            <p className={styles.cardHint}>
              Choose the country that issued your school certificate.
            </p>
            <div className={styles.countryGrid}>
              {countries.map((country) => (
                <Link
                  className={styles.countryCard}
                  href={`/check?country=${country.code}`}
                  key={country.code}
                >
                  {country.name}
                  <span aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
            <p className={styles.checkMeta}>
              Free · no email needed · missing rules return an honest “unknown”
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <p className={styles.sectionLabel}>How it works</p>
          <h2>From uncertainty to a clear next step.</h2>
          <div className={styles.steps}>
            <article>
              <span className={styles.stepNumber}>1</span>
              <div>
                <h3>Tell us about your education</h3>
                <p>
                  Your curriculum, certificate, grades, intended degree, and
                  intake determine which rules apply.
                </p>
              </div>
            </article>
            <article>
              <span className={styles.stepNumber}>2</span>
              <div>
                <h3>We evaluate the published rules</h3>
                <p>
                  The eligibility engine uses reviewed rule records. It does not
                  invent an answer when information is missing.
                </p>
              </div>
            </article>
            <article>
              <span className={styles.finalStepDot} aria-hidden="true" />
              <div>
                <h3>Get a shareable route</h3>
                <p>
                  See your likely admission path, required processes, documents,
                  and the sources behind the result.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.trustSection}`}>
        <div className={styles.container}>
          <p className={styles.sectionLabel}>Built for careful decisions</p>
          <h2>Sources stay attached to the answer.</h2>
          <p className={styles.sectionIntro}>
            Admission advice becomes risky when the source disappears. Result
            claims show the official source, review date, and rule status. When
            the available rules cannot support an answer, UniPirate tells you
            what still needs confirmation.
          </p>
          <div className={styles.sourceCard}>
            <div className={styles.sourceTopline}>
              <span className={styles.verifiedMark}>✓ Source checked</span>
              <span>OFFICIAL SOURCE · REVIEW DATE</span>
            </div>
            <p>
              Every supported result links back to the rule record and its
              source. Beta information is marked clearly.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <p className={styles.sectionLabel}>Why UniPirate</p>
          <h2>Guidance without the sales pitch.</h2>
          <div className={styles.comparison}>
            <article>
              <span>Commission consultants</span>
              <p>Their recommendations may depend on commercial partnerships.</p>
            </article>
            <article>
              <span>Doing it alone</span>
              <p>You can, but the relevant rules are spread across many sources.</p>
            </article>
            <article className={styles.highlightCard}>
              <span>UniPirate</span>
              <p>
                A focused eligibility route with sources, review dates, and
                explicit uncertainty.
              </p>
            </article>
          </div>
          <Link className={styles.primaryAction} href="/check">
            Check my eligibility
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <Link className={styles.brand} href="/">
            UniPirate
          </Link>
          <p>
            Independent. Not affiliated with DAAD, uni-assist, or any embassy.
          </p>
          <p>Built by a student who made the journey from Saudi Arabia to Saarbrücken.</p>
        </div>
      </footer>
    </main>
  );
}
