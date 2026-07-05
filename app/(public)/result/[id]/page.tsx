// ponytail: deliberately unstyled stub — Session 5 designs this page from
// design/Result.dc.html. It only proves the shareable record round-trips.
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCheck } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import type { Result } from "@/lib/engine/evaluate";

import { ClaimOnReturn } from "./claim-on-return";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your result — UniPirate",
};

const PATH_LABELS: Record<Result["path"], string> = {
  direct: "Direct admission",
  subject_restricted: "Direct admission (subject-restricted)",
  studienkolleg: "Studienkolleg first, then university",
  insufficient: "Not eligible with this profile",
  unknown: "Not determined yet — see the open questions below",
};

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
  const result = check.result as Result;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>
      {shouldClaim && <ClaimOnReturn checkId={id} />}
      <h1>Your path to a German university</h1>
      <p>
        <strong>Path:</strong> {PATH_LABELS[result.path]}
      </p>
      <ul>
        <li>APS certificate: {result.aps.replace("_", " ")}</li>
        <li>TestAS: {result.testAS.replace("_", " ")}</li>
        <li>dMAT: {result.dMAT.replace("_", " ")}</li>
      </ul>

      {result.steps.length > 0 && (
        <>
          <h2>Your steps</h2>
          <ol>
            {result.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </>
      )}

      {result.documents.length > 0 && (
        <>
          <h2>Documents you will need</h2>
          <ul>
            {result.documents.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </>
      )}

      {result.unknowns.length > 0 && (
        <>
          <h2>Still to confirm</h2>
          <ul>
            {result.unknowns.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </>
      )}

      {result.citations.length > 0 && (
        <>
          <h2>Sources</h2>
          <ul>
            {result.citations.map((c) => (
              <li key={c.ruleId}>
                <a href={c.sourceUrl} rel="noopener noreferrer">
                  {c.sourceUrl}
                </a>{" "}
                — last verified:{" "}
                {c.verifiedAt
                  ? new Date(c.verifiedAt).toISOString().slice(0, 10)
                  : "not yet verified"}
              </li>
            ))}
          </ul>
        </>
      )}

      <p>
        <Link href="/check">Check another profile</Link>
      </p>
    </main>
  );
}
