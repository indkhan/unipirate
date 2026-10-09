import type { ResearchAuditRecord } from "@/lib/courses/research";

/** Records reach this view only after protected admin-query validation. */
export function ResearchHistory({ records }: { records: ResearchAuditRecord[] }) {
  if (!records.length) return null;
  return <section className="mt-3 grid gap-3 rounded border p-3">
    <h4 className="font-semibold">Protected research reconciliation history</h4>
    {records.map((record, index) => record.status === "unavailable"
      ? <p role="alert" key={record.id + index}>Protected research history unavailable: invalid stored audit record. No reviewer or fact claims can be shown.</p>
      : <details key={record.id + index}>
        <summary>Version {record.payload.version.version} · {record.payload.reviewed_at} · reviewed by {record.payload.reviewed_by}</summary>
        <p>Canonical course: {record.canonicalId} · submitted course: {record.payload.submitted_course_id}</p>
        <p>{record.payload.identity.name} · {record.payload.identity.university}</p>
        <p>Offering {record.payload.version.offering_id} · immutable version {record.payload.version.id}</p>
        <p>{record.payload.scope.intake_term} {record.payload.scope.intake_year} · {record.payload.scope.applicant_group}</p>
        <blockquote>{record.payload.scope.scope.source_quote} · <a href={record.payload.scope.scope.source_url} target="_blank" rel="noreferrer">{record.payload.scope.scope.source_url}</a></blockquote>
        <pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(record.payload.scope.applicability, null, 2)}</pre>
        <p>Accepted local field keys: {record.payload.accepted_keys.join(", ") || "None; fields remain unresolved"}</p>
        {record.payload.decisions.map(decision => <p key={decision.key}>{decision.key}: {decision.reason}</p>)}
        {record.payload.review && <div>
          <p>Reviewer/time record the publication attestation of these stored pending decisions, not authenticated original edit authorship.</p>
          {record.payload.review.rejected.map(e => <p key={e.key}>Rejected {e.key}: {e.reason}</p>)}
          {record.payload.review.changes.map((e, i) => <details key={i}><summary>{i + 1}. {e.kind} · {e.key}: {e.reason}</summary>
            <p>Original unverified wording: {e.before.verbatim ?? "Unresolved"}</p>
            {e.before.evidence.map((capture, j) => <blockquote key={j}>{capture.source_quote} · {capture.source_url} · retrieved {capture.retrieved_at} · {capture.source_hash ?? "Captured-text hash unavailable (legacy)"}</blockquote>)}
            {e.conflict && <pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(e.conflict.alternatives, null, 2)}</pre>}
          </details>)}
        </div>}
        <p>Captured-text SHA-256 identifies exact stored UTF-8 observation content, not remote file authenticity. Legacy null/historical identities remain unchanged.</p>
        {record.payload.observations.map((capture, i) => <article key={i}>
          <p>{capture.origin} · <a href={capture.url} target="_blank" rel="noreferrer">{capture.url}</a> · retrieved {capture.retrieved_at}</p>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{capture.content}</pre>
        </article>)}
      </details>)}
  </section>;
}

export function UntrustedLegacyReconciliation({ value }: { value: unknown }) {
  if (value === undefined) return null;
  return <details className="mt-3 rounded border p-3">
    <summary>Untrusted legacy reconciliation data — caller-editable metadata</summary>
    <p>These raw values do not authenticate a reviewer, time, decision or published version. Protected history is shown separately.</p>
    <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre>
  </details>;
}
