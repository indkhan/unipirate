import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { hashOwnerToken, ownerCookieName } from "@/lib/checks/ownership";
import { getCheck } from "@/lib/db/queries";
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
  type ViewerVariant,
} from "./result-model";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your result — UniPirate",
};

async function viewerFor(checkId: string): Promise<ViewerVariant> {
  const db = await createClient();
  const token = (await cookies()).get(ownerCookieName(checkId))?.value;
  const { data, error } = await db.rpc(
    "result_viewer",
    {
      p_check_id: checkId,
      p_token_hash: token ? hashOwnerToken(token) : null,
    } as never,
  );
  if (error) return "public";
  if (data === "anonymous_owner" || data === "claimed_owner") return data;
  return "public";
}

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const { id } = await params;
  const shouldClaim = (await searchParams).claim === "1";
  const db = await createClient();
  const check = await getCheck(db, id);
  if (!check) notFound();

  const result = check.result as unknown as Result;
  const profile = check.profile as unknown as Profile;
  const viewer = await viewerFor(id);
  const resultDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(check.created_at));

  return (
    <main className={styles.page}>
      <ResultAnalytics
        checkId={id}
        viewer={viewer}
        country={profile.certificateCountry ?? profile.nationality ?? null}
        path={result.path}
      />
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">UniPirate</Link>
          <span className={styles.headerMeta}>Result · {resultDate}</span>
        </header>

        {shouldClaim && <ClaimOnReturn checkId={id} />}

        {(viewer === "public" || isBetaCountry(profile)) && (
          <div className={styles.banners}>
            {viewer === "public" && <PublicBanner />}
            {isBetaCountry(profile) && <BetaBanner profile={profile} />}
          </div>
        )}

        <div className={styles.grid}>
          <div className={styles.primary}>
            <VerdictCard result={result} profileLine={profileSummary(profile)} />
            <RouteCard result={result} />
            <UnknownsCard unknowns={result.unknowns} />
          </div>
          <div className={styles.secondary}>
            <DocumentsCard result={result} viewer={viewer} />
            <TimelineCard profile={profile} />
            <ShareControls checkId={id} />
            <ConversionCard checkId={id} viewer={viewer} />
          </div>
        </div>

        <span className={styles.footer}>
          Independent · not affiliated with DAAD, uni-assist, or any embassy
        </span>
      </div>
    </main>
  );
}
