import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { UserMenu } from "@/components/app/user-menu";
import { isAdminRole } from "@/lib/auth/roles";
import { hashOwnerToken, ownerCookieName } from "@/lib/checks/ownership";
import { getCheck, listRuleVersions, getRuleVersionsByIds, getResultViewer } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { AssessmentMetadataSchema, compareAssessments, evaluateAssessment, parseStoredAssessment } from "@/lib/rules/assessment";
import { currentAssessmentContext } from "@/lib/rules/current";

import { AnswersSchema, buildProfile } from "@/app/(public)/check/steps";

import { ClaimOnReturn } from "./claim-on-return";
import { ResultAnalytics, ShareControls } from "./result-client";
import {
  BetaBanner,
  ConversionCard,
  DocumentsCard,
  PublicBanner,
  RouteCard,
  TimelineCard,
  UnknownsCard,
  VerdictCard,
} from "./result-components";
import styles from "./result.module.css";
import {
  isBetaCountry,
  profileSummary,
  visibleUnknowns,
  type ViewerVariant,
} from "./result-model";

export const dynamic = "force-dynamic";

const ResultIdSchema = z.string().uuid();

export const metadata = {
  title: "Your result — UniPirate",
};

async function viewerFor(checkId: string): Promise<ViewerVariant> {
  const db = await createClient();
  const token = (await cookies()).get(ownerCookieName(checkId))?.value;
  return getResultViewer(db, checkId, token ? hashOwnerToken(token) : null);
}

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const { id } = await params;
  const parsedId = ResultIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const shouldClaim = (await searchParams).claim === "1";
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const check = await getCheck(db, parsedId.data);
  if (!check) notFound();

  // answers is the stored source of truth; the profile is derived, never stored
  const answers = AnswersSchema.safeParse(check.answers);
  if (!answers.success) return <main className={styles.page}><h1>Assessment unavailable</h1><p>The saved answers are invalid. Original provenance and a current reassessment are unavailable.</p><Link href="/check">Start a new check</Link></main>;
  const profile = buildProfile(answers.data);
  const metadata = AssessmentMetadataSchema.safeParse(check.assessment_metadata);
  const exactIds = metadata.success ? [...metadata.data.selectedVersionIds, ...metadata.data.selectionIssues.map(issue => issue.versionId)] : [];
  const exact = await getRuleVersionsByIds(db, exactIds).catch(() => []);
  const history = parseStoredAssessment(check, exact);
  const context = currentAssessmentContext();
  const current = await listRuleVersions(db).then(versions => evaluateAssessment(profile, versions, context)).catch(() => null);
  const result = current?.result;
  const comparison = history.original && current ? compareAssessments(history.original, current) : null;
  const viewer = await viewerFor(parsedId.data);
  const resultDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(check.created_at));

  return (
    <main className={styles.page}>
      <ResultAnalytics
        checkId={parsedId.data}
        viewer={viewer}
        country={profile.certificateCountry ?? profile.nationality ?? null}
        path={result?.path ?? "unknown"}
      />
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">UniPirate</Link>
          <div className={styles.headerActions}>
            <span className={styles.headerMeta}>Result · {resultDate}</span>
            <ThemeToggle />
            {user ? (
              <UserMenu
                email={user.email ?? null}
                isAdmin={isAdminRole(user.app_metadata)}
              />
            ) : (
              <Link
                className={styles.dashboardLink}
                href={`/login?next=${encodeURIComponent(`/result/${parsedId.data}?claim=1`)}`}
              >
                Sign in
              </Link>
            )}
          </div>
        </header>

        {shouldClaim && <ClaimOnReturn checkId={parsedId.data} />}

        {(viewer === "public" || isBetaCountry(profile)) && (
          <div className={styles.banners}>
            {viewer === "public" && <PublicBanner />}
            {isBetaCountry(profile) && <BetaBanner profile={profile} />}
          </div>
        )}

        <section aria-label="Assessment history">
          <h2>Original assessment</h2>
          {history.original ? <>
            <p>Evaluated at {history.original.metadata.evaluatedAt} · {history.original.metadata.engineRevision}</p>
            <VerdictCard result={history.original.result} profile={profile} profileLine={profileSummary(profile)} />
            <RouteCard result={history.original.result} />
            <DocumentsCard result={history.original.result} viewer={viewer} />
            <UnknownsCard unknowns={visibleUnknowns(history.original.result, profile, true)} />
            <details><summary>Original immutable rule evidence</summary>
              {[...history.original.selectedVersions, ...history.original.diagnosticVersions].map(version => <div key={version.id}>
                <p>Rule {version.rule_id} · Version {version.id} · {version.provenance}</p>
                <pre style={{whiteSpace: "pre-wrap", overflowWrap: "anywhere"}}>{JSON.stringify(version.raw_snapshot, null, 2)}</pre>
              </div>)}
              {history.original.metadata.selectionIssues.map(issue => <p key={issue.ruleId}>Unresolved scope: {issue.reason}</p>)}
            </details>
          </> : <p>Original assessment provenance unavailable. Saved answers: {check.created_at}. Current assessment below is a new evaluation.</p>}
          <h2>Current reassessment</h2>
          <p>Evaluated at {context.evaluatedAt}</p>
          {comparison && <p>{comparison.policyChanged ? "Policy or assessment changed." : "Policy and assessment unchanged."} {comparison.explanationChanged ? "Source or explanation changed." : "Source and explanation unchanged."} {comparison.newCoverage ? "New coverage is available." : ""}</p>}
          {current?.metadata.selectionIssues.map(issue => <p key={issue.ruleId}>Current scope unresolved: {issue.reason}</p>)}
        </section>
        {!current && <p>Current rule knowledge unavailable. Confirm your requirements with <a href="https://www.uni-assist.de/en/how-to-apply/get-information/">the official application source</a>.</p>}
        {result && <div className={styles.grid}>
          <div className={styles.primary}>
            <VerdictCard
              result={result}
              profile={profile}
              profileLine={profileSummary(profile)}
            />
            <RouteCard result={result} />
            <UnknownsCard unknowns={visibleUnknowns(result, profile)} />
          </div>
          <div className={styles.secondary}>
            <DocumentsCard result={result} viewer={viewer} />
            <TimelineCard profile={profile} />
            <ShareControls checkId={parsedId.data} />
            <ConversionCard checkId={parsedId.data} viewer={viewer} />
          </div>
        </div>}

        <span className={styles.footer}>
          Independent · not affiliated with DAAD, uni-assist, or any embassy
        </span>
      </div>
    </main>
  );
}
