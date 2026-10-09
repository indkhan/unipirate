"use client";

import type { ResearchDraft } from "@/lib/courses/research";
import { patchCourseResearchDraftAction } from "./actions";
import { ActionButton } from "./action-button";

import { createContext, useContext, useId, useRef, useState } from "react";

export const RECONCILIATION_REASON_MIN = 20;
export const RECONCILIATION_REASON_MAX = 2000;

/**
 * Trimmed-length check mirroring the server Zod boundary
 * (`z.string().trim().min(20).max(2000)`). Pure, zero I/O.
 * Returns an accessible field message, or null when valid.
 */
export function validateReconciliationReason(
  value: string | null | undefined,
): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0) {
    return "Source reconciliation rationale is required for each accepted fact. Enter at least 20 characters.";
  }
  if (trimmed.length < RECONCILIATION_REASON_MIN) {
    return `Rationale needs ${RECONCILIATION_REASON_MIN - trimmed.length} more characters (at least 20, currently ${trimmed.length}).`;
  }
  if (trimmed.length > RECONCILIATION_REASON_MAX) {
    return "Rationale must be 2000 characters or fewer.";
  }
  return null;
}

/**
 * Per-fact review controls. Only a selected (accepted) pending fact requires
 * the reconciliation checkbox and trimmed 20..2000 rationale; unselected
 * facts render those controls disabled, so the browser excludes them from
 * submission and validation and they stay unresolved server-side. Entered
 * rationale text is preserved across deselection and revalidated on reselect.
 * Each instance validates independently via native browser validity, so an
 * invalid rationale keeps the user on the review page with no server call.
 */
export function ResearchFactReview({
  offeringIndex,
  factKey,
  verbatim,
  status,
  formId,
  defaultAccepted = false,
  defaultReason = "",
}: {
  offeringIndex: number;
  factKey: string;
  verbatim: string | null;
  status: string;
  formId?: string;
  defaultAccepted?: boolean;
  defaultReason?: string;
}) {
  const fieldId = `${offeringIndex}:${factKey}`;
  const reasonName = `reconciliation_reason:${fieldId}`;
  const [accepted, setAccepted] = useState(defaultAccepted);
  const [reason, setReason] = useState(defaultReason);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const messageId = useId();
  const reasonError = accepted ? validateReconciliationReason(reason) : null;

  if (status !== "pending") {
    return (
      <label className="flex gap-2">
        <input type="checkbox" form={formId} name="accepted" value={fieldId} disabled />
        Accept {factKey}: {verbatim ?? "Unresolved"} ({status})
      </label>
    );
  }

  return (
    <>
      <label className="flex gap-2">
        <input
          type="checkbox"
          form={formId} name="accepted"
          value={fieldId}
          checked={accepted}
          onChange={(event) => {
            const next = event.target.checked;
            setAccepted(next);
            // Preserve the entered rationale text across deselection. A
            // disabled control is excluded from form submission and
            // constraint validation, so an unselected fact submits neither
            // its reconciled decision nor its rationale; reselecting
            // re-enables the same names and revalidates the kept text.
            reasonRef.current?.setCustomValidity(
              next ? (validateReconciliationReason(reason) ?? "") : "",
            );
          }}
        />
        Accept {factKey}: {verbatim ?? "Unresolved"} ({status})
      </label>
      <div className="grid gap-2">
        <label>
          <input
            type="checkbox"
            form={formId} name="reconciled"
            value={fieldId}
            required={accepted}
            disabled={!accepted}
          />
          I compared the full captured sources, including omitted text, and
          confirmed applicability for this field. Known conflicts require
          separate correction before acceptance.
        </label>
        <label>
          Source reconciliation rationale (cite the captured source URLs and
          explain applicability)
          <textarea
            ref={reasonRef}
            form={formId} name={reasonName}
            required={accepted}
            minLength={accepted ? RECONCILIATION_REASON_MIN : undefined}
            maxLength={RECONCILIATION_REASON_MAX}
            disabled={!accepted}
            aria-invalid={reasonError !== null}
            aria-describedby={reasonError ? messageId : undefined}
            className="w-full rounded border p-2"
            value={reason}
            onChange={(event) => {
              const next = event.target.value;
              setReason(next);
              event.target.setCustomValidity(
                accepted ? (validateReconciliationReason(next) ?? "") : "",
              );
            }}
            onBlur={(event) => {
              event.target.setCustomValidity(
                accepted
                  ? (validateReconciliationReason(event.target.value) ?? "")
                  : "",
              );
            }}
          />
        </label>
        {reasonError && (
          <p role="alert" id={messageId} className="text-sm text-red-700">
            {reasonError}
          </p>
        )}
      </div>
    </>
  );
}

const ResearchReviewContext = createContext<{ expected: string; draft: ResearchDraft } | null>(null);
export function ResearchReviewProvider({ expected, draft, children }: { expected: string; draft: ResearchDraft; children: React.ReactNode }) {
  return <ResearchReviewContext.Provider value={{ expected, draft }}>{children}</ResearchReviewContext.Provider>;
}
function usePendingResearch() {
  const context = useContext(ResearchReviewContext);
  if (!context) throw new Error("Pending research review context unavailable");
  return context;
}
export function ResearchSectionReject({ courseId, offering, kind }: { courseId: string; offering: number; kind: ResearchDraft["offerings"][number]["facts"][number]["kind"] }) {
  const { expected, draft } = usePendingResearch();
  return <form action={async data => { data.set("expected", expected); await patchCourseResearchDraftAction(data); }} className="grid gap-2">
    <input type="hidden" name="id" value={courseId} />
    <p>Reject selected {kind} fields in this offering only:</p>
    {draft.offerings[offering].facts.filter(f => f.kind === kind).map(f => <label key={f.key}><input type="checkbox" name="entry" value={JSON.stringify({ offering, key: f.key })}
      disabled={draft.review?.rejected.some(e => e.offering === offering && e.key === f.key)} />{f.key}</label>)}
    <label>Section rejection reason<textarea name="reason" required minLength={20} maxLength={2000} onChange={e => e.target.setCustomValidity(validateReconciliationReason(e.target.value) ?? "")} /></label>
    <ActionButton pendingText="Rejecting…" confirm="Reject only the selected visible fields in this section? Original values remain privately retained.">Reject selected {kind} fields</ActionButton>
  </form>;
}
// Each button operates only its surrounding visible kind/offerings fieldset.
export function ResearchSectionControls() {
  return <div className="flex gap-3">
    <button type="button" onClick={event => {
      event.currentTarget.closest("fieldset")?.querySelectorAll<HTMLInputElement>('input[name="accepted"]:not(:disabled)').forEach(input => { if (!input.checked) input.click(); });
    }}>Accept eligible fields in this section</button>
    <button type="button" onClick={event => {
      event.currentTarget.closest("fieldset")?.querySelectorAll<HTMLDetailsElement>('details[data-field-editor]').forEach(editor => { editor.open = true; });
    }}>Edit fields in this section</button>
  </div>;
}
export function ResearchFieldEditor({ courseId, offering, factKey }: {
  courseId: string; offering: number; factKey: string;
}) {
  const { expected, draft } = usePendingResearch();
  const save = async (data: FormData) => { data.set("expected", expected); await patchCourseResearchDraftAction(data); };
  const fact = draft.offerings[offering].facts.find(f => f.key === factKey)!;
  const rejection = draft.review?.rejected.find(e => e.offering === offering && e.key === factKey);
  const conflict = draft.conflicts.find(c => c.offering === offering && c.key === factKey);
  const [verbatim, setVerbatim] = useState(fact.verbatim ?? "");
  const captures = draft.observations.filter(o => o.origin !== "paste");
  const [captureIndex, setCaptureIndex] = useState(Math.max(0, captures.findIndex(o => o.url === fact.evidence[0]?.source_url && o.retrieved_at === fact.evidence[0]?.retrieved_at)));
  const [quote, setQuote] = useState(fact.evidence[0]?.source_quote ?? "");
  const [route, setRoute] = useState(fact.route);
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const capture = captures[captureIndex];
  const replacement = { ...fact, status: "pending", verbatim, route,
    evidence: capture ? [{ source_url: capture.url, retrieved_at: capture.retrieved_at, source_quote: quote,
      source_hash: null, verified_by: null, last_verified_at: null }] : [] };
  const identity = <input type="hidden" name="id" value={courseId} />;
  if (rejection) return <div><p>Rejected privately: {rejection.reason}. Original retained; publication stays unknown.</p>
    <form action={save}>{identity}<input type="hidden" name="patch" value={JSON.stringify({ kind: "restore", offering, key: factKey })} />
      <ActionButton pendingText="Restoring…" confirm="Restore this original as unverified pending research?">Restore to pending</ActionButton></form></div>;
  return <details data-field-editor className="rounded border p-2"><summary>{conflict ? "Resolve conflict explicitly" : "Edit or reject field"}: {factKey}</summary>
    {conflict && <p>Original alternatives: {conflict.alternatives.map(a => a.verbatim).join(" / ")}. Explain the source-backed correction; reconciliation alone cannot resolve this conflict.</p>}
    <form action={save} className="grid gap-2" onSubmit={event => {
      reasonRef.current?.setCustomValidity(validateReconciliationReason(reason) ?? "");
      if (!event.currentTarget.reportValidity()) event.preventDefault();
    }}>{identity}
      <label>Literal corrected value<textarea required maxLength={4000} value={verbatim} onChange={e => setVerbatim(e.target.value)} /></label>
      {fact.kind === "route" && <label>Source-supported route<select value={route ?? "unresolved"} onChange={e => setRoute(e.target.value as typeof route)}>
        <option value="unresolved">Unresolved</option><option value="direct">Direct</option><option value="uni_assist">uni-assist</option><option value="vpd_then_university">VPD then university</option>
      </select></label>}
      <label>Stored official capture<select value={captureIndex} onChange={e => { setCaptureIndex(Number(e.target.value)); setQuote(""); }}>
        {captures.map((o, i) => <option key={i} value={i}>{o.url} · {o.retrieved_at}</option>)}
      </select></label>
      {capture && <pre className="max-h-40 overflow-auto whitespace-pre-wrap">{capture.content}</pre>}
      <label>Contiguous literal evidence quote<textarea required maxLength={4000} value={quote} onChange={e => setQuote(e.target.value)} /></label>
      <label>Correction rationale<textarea ref={reasonRef} required maxLength={2000} value={reason} onChange={e => { setReason(e.target.value); e.target.setCustomValidity(validateReconciliationReason(e.target.value) ?? ""); }} /></label>
      <input type="hidden" name="patch" value={JSON.stringify({ kind: conflict ? "resolve_conflict" : "edit", offering, key: factKey, reason, replacement })} />
      <ActionButton disabled={!capture} pendingText="Saving…" confirm={conflict ? "Resolve only this conflict with the source-backed correction and retain original alternatives in pending history?" : undefined}>{conflict ? "Save explicit conflict correction" : "Save field as pending"}</ActionButton>
    </form>
    <form action={save} className="mt-2 grid gap-2">{identity}
      <input type="hidden" name="entry" value={JSON.stringify({ offering, key: factKey })} />
      <label>Rejection reason<textarea name="reason" required minLength={20} maxLength={2000} onChange={e => e.target.setCustomValidity(validateReconciliationReason(e.target.value) ?? "")} /></label>
      <ActionButton pendingText="Rejecting…" confirm="Reject this field privately? Its original is retained and cannot be published as accepted.">Reject field</ActionButton>
    </form>
  </details>;
}
