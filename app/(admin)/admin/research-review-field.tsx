"use client";

import { useId, useRef, useState } from "react";

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
  defaultAccepted = false,
  defaultReason = "",
}: {
  offeringIndex: number;
  factKey: string;
  verbatim: string | null;
  status: string;
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
        <input type="checkbox" name="accepted" value={fieldId} disabled />
        Accept {factKey}: {verbatim ?? "Unresolved"} ({status})
      </label>
    );
  }

  return (
    <>
      <label className="flex gap-2">
        <input
          type="checkbox"
          name="accepted"
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
            name="reconciled"
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
            name={reasonName}
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
