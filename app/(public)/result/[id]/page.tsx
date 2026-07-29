import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { UserMenu } from "@/components/app/user-menu";
import { isAdminRole } from "@/lib/auth/roles";
import { hashOwnerToken, ownerCookieName } from "@/lib/checks/ownership";
import { getCheck, getResultViewer } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import type { Profile, Result } from "@/lib/engine/evaluate";

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

  const result = check.result as unknown as Result;
  const profile = check.profile as unknown as Profile;
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
        path={result.path}
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

        <div className={styles.grid}>
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
        </div>

        <span className={styles.footer}>
          Independent · not affiliated with DAAD, uni-assist, or any embassy
        </span>
      </div>
    </main>
  );
}
