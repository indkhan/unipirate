import Link from "next/link";

import type { Citation, Profile, Result } from "@/lib/engine/evaluate";

import styles from "./result.module.css";
import {
  buildRoute,
  buildVerdicts,
  countryLabel,
  documentPreview,
  intakeLabel,
  type ViewerVariant,
} from "./result-model";

function formatDate(value: string | null): string {
  if (!value) return "date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function SourceStamp({ citation }: { citation: Citation }) {
  const beta = citation.status === "beta";
  const label = beta ? "Beta source" : citation.status === "verified" ? "Verified" : "Official source";
  return (
    <a
      className={`${styles.stamp} ${beta ? styles.betaStamp : ""}`}
      href={citation.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}: open official source, checked ${formatDate(citation.verifiedAt)}`}
    >
      <span className={styles.stampSeal}>{beta ? "!" : "✓"}</span>
      <strong>{label}</strong>
      <span className={styles.stampSource}>
        {new URL(citation.sourceUrl).hostname.replace(/^www\./, "")}
      </span>
      <span>· {formatDate(citation.verifiedAt)}</span>
    </a>
  );
}

export function VerdictCard({ result, profileLine }: { result: Result; profileLine: string }) {
  const verdicts = buildVerdicts(result);
  return (
    <section className={`${styles.card} ${styles.verdictCard}`}>
      <div className={styles.cardHeading}>
        <h1>Your path</h1>
        {profileLine && <span className={styles.mono}>{profileLine}</span>}
      </div>
      <div className={styles.primaryVerdict}>
        <p>{verdicts[0].label}</p>
        {verdicts[0].citations.map((citation) => (
          <SourceStamp key={citation.ruleId} citation={citation} />
        ))}
        {verdicts[0].citations.length === 0 && (
          <span className={styles.unverified}>Official confirmation needed</span>
        )}
      </div>
      <div className={styles.requirements}>
        {verdicts.slice(1).map((verdict) => (
          <div className={styles.requirement} key={verdict.key}>
            <span>{verdict.label}</span>
            {verdict.citations.map((citation) => (
              <SourceStamp key={citation.ruleId} citation={citation} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function RouteCard({ result }: { result: Result }) {
  const stations = buildRoute(result);
  return (
    <section className={`${styles.card} ${styles.routeCard}`}>
      <span className={styles.eyebrow}>Your route</span>
      <ol className={styles.route}>
        {stations.map((station, index) => (
          <li className={styles.station} key={`${station.label}-${index}`}>
            <span className={`${styles.routeRail} ${styles[station.state]}`}>
              <span className={styles.routeDot}>
                {station.state === "done" ? "✓" : ""}
              </span>
            </span>
            <span className={styles.stationText}>
              <strong>{station.label}</strong>
              {station.state === "current" && <small>▸ You are here</small>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DocumentsCard({ result, viewer }: { result: Result; viewer: ViewerVariant }) {
  const preview = documentPreview(result.documents);
  return (
    <section className={`${styles.card} ${styles.documentsCard}`}>
      <div className={styles.cardHeading}>
        <h2>Your documents</h2>
        <span className={styles.mono}>
          {preview.visible.length} of {result.documents.length} shown
        </span>
      </div>
      {preview.visible.length > 0 ? (
        <ul className={styles.documents}>
          {preview.visible.map((document) => (
            <li key={document}>
              <span aria-hidden="true" />
              {document}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No verified document list is available for this result yet.</p>
      )}
      {preview.hiddenCount > 0 && (
        <p className={styles.gated}>
          + {preview.hiddenCount} more
          {viewer === "public" ? " — run your own check to see yours" : " — free when you save your path"}
        </p>
      )}
    </section>
  );
}

export function TimelineCard({ profile }: { profile: Profile }) {
  const intake = intakeLabel(profile);
  return (
    <section className={`${styles.card} ${styles.timelineCard}`}>
      <h2>Key dates</h2>
      <div className={styles.timelineEmpty}>
        <span className={styles.signalDot} aria-hidden="true" />
        <p>No verified key dates are available for this result yet.</p>
      </div>
      <p className={styles.mono}>
        {intake ? `Selected intake: ${intake}. ` : ""}
        Confirm dates with the linked official sources.
      </p>
    </section>
  );
}

export function UnknownsCard({ unknowns }: { unknowns: string[] }) {
  if (unknowns.length === 0) return null;
  return (
    <section className={`${styles.card} ${styles.unknownsCard}`}>
      <h2>Still to confirm</h2>
      <ul>
        {unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}
      </ul>
    </section>
  );
}

export function ConversionCard({
  checkId,
  viewer,
}: {
  checkId: string;
  viewer: ViewerVariant;
}) {
  if (viewer === "claimed_owner") {
    return (
      <section className={`${styles.conversion} ${styles.saved}`}>
        <h2>Path saved</h2>
        <p>This check is connected to your profile.</p>
      </section>
    );
  }

  const owner = viewer === "anonymous_owner";
  const href = owner
    ? `/login?next=${encodeURIComponent(`/result/${checkId}?claim=1`)}`
    : "/check";
  return (
    <section className={styles.conversion}>
      <h2>{owner ? "Save this path and track every deadline." : "Get your own path."}</h2>
      <p>
        {owner
          ? "Create a free account to keep your checklist and verified result."
          : "Your school and marks may give you a different result."}
      </p>
      <Link className={styles.primaryAction} href={href}>
        {owner ? "Save my path" : "Check my eligibility"}
      </Link>
    </section>
  );
}

export function PublicBanner() {
  return (
    <div className={styles.publicBanner}>
      <strong>This is someone else&apos;s shared path.</strong>
      <span>Your school and marks may give a different result.</span>
    </div>
  );
}

export function BetaBanner({ profile }: { profile: Profile }) {
  return (
    <div className={styles.betaBanner}>
      <span className={styles.signalDot} aria-hidden="true" />
      <span>
        <strong>Beta for {countryLabel(profile)}.</strong> Confirm with the linked official sources before paying any fee.
      </span>
    </div>
  );
}

