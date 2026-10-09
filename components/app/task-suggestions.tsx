"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./task-suggestions.module.css";

// Presentation-only view of a task proposal row. Compatible with the worker
// `TaskProposal` DTO (import it when available); no DB I/O happens here.
export type TaskProposalView = {
  id: string;
  user_id: string;
  application_id: string | null;
  course_id: string | null;
  semantic_action_key: string;
  stage: "preliminary" | "verified";
  title: string;
  description: string | null;
  reason: string;
  due_date: string | null;
  verbatim_due: string | null;
  evidence: { source_url: string; source_quote: string; last_verified_at: string | null }[];
  source_version_id: string | null;
  offering_id: string | null;
  intake_term: string | null;
  intake_year: number | null;
  applicant_group: string | null;
  input_fingerprint: string;
  material_fingerprint: string;
  status: "pending" | "approved" | "dismissed" | "superseded" | "needs_recheck";
  revision: number;
  approved_revision: number | null;
  approved_task_id: string | null;
  base_task_revision: number | null;
  before_task: {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    done: boolean;
    planning_revision: number | null;
  } | null;
  change_fields: string[];
  legacy_task_key: string | null;
  created_at: string;
  updated_at: string;
};

export type ApproveEdit = { title: string; description: string | null; dueDate: string | null };
export type ApproveSelectionItem = { id: string; revision: number; edit?: ApproveEdit };
export type ConfirmSelectionItem = { id: string; revision: number; title: string; dueDate: string | null };

export type SuggestionsListProps = {
  proposals: TaskProposalView[];
  applicationNames: Record<string, string>;
  approve: (selection: ApproveSelectionItem[]) => Promise<void>;
  reject: (id: string, revision: number) => Promise<void>;
};

export type ProposalPopupProps = SuggestionsListProps & { onClose?: () => void };

function groupKey(p: TaskProposalView): string {
  return p.course_id ?? p.application_id ?? "general";
}

function groupLabel(key: string, names: Record<string, string>, proposals: TaskProposalView[]): string {
  if (key === "general") return "General";
  const appId = proposals.find((p) => groupKey(p) === key)?.application_id;
  if (appId && names[appId]) return names[appId];
  return names[key] ?? "Course";
}

function StageChip({ stage }: { stage: TaskProposalView["stage"] }) {
  return stage === "verified" ? (
    <span className={`${styles.stage} ${styles.stageReviewed}`}>Reviewed source</span>
  ) : (
    <span className={`${styles.stage} ${styles.stagePreliminary}`}>
      Preliminary — confirm with official source
    </span>
  );
}

function DateLine({ p }: { p: TaskProposalView }) {
  // Parsed dates are only ever a personal reminder. The literal source
  // wording is shown verbatim, never as the parsed value.
  return (
    <>
      {p.stage === "verified" && p.verbatim_due ? (
        <p className={styles.verbatim}>Due: {p.verbatim_due}</p>
      ) : null}
      {p.due_date ? (
        <span className={styles.due}>Personal reminder: {p.due_date}</span>
      ) : (
        <span className={styles.dueLabel}>No date — personal reminder only</span>
      )}
    </>
  );
}

function Evidence({ p }: { p: TaskProposalView }) {
  if (!p.evidence.length) return null;
  return (
    <div className={styles.evidence}>
      {p.evidence.map((e) => (
        <div key={e.source_url}>
          <blockquote>{e.source_quote}</blockquote>
          <a className={styles.evidenceLink} href={e.source_url} target="_blank" rel="noreferrer">
            {e.source_url}
          </a>
          <div className={styles.evidenceMeta}>
            {e.last_verified_at ? `Source verified: ${e.last_verified_at}` : "Verification date unavailable"}
          </div>
        </div>
      ))}
    </div>
  );
}

function UpdateBox({ p }: { p: TaskProposalView }) {
  // Update kind only: pending + approved_task_id + before_task.
  if (!(p.status === "pending" && p.approved_task_id && p.before_task)) return null;
  const b = p.before_task;
  return (
    <div className={styles.updateBox}>
      <p className={styles.updateTitle}>Update to your task</p>
      <div className={styles.updateCols}>
        <div className={styles.updateBefore}>
          <strong>Before</strong>
          <span>{b.title}</span>
          {b.description ? <span>{b.description}</span> : null}
          {b.due_date ? <span>Personal reminder: {b.due_date}</span> : null}
          <span className={styles.doneState}>{b.done ? "Completed" : "Not completed yet"}</span>
        </div>
        <div className={styles.updateAfter}>
          <strong>After</strong>
          <span>{p.title}</span>
          {p.description ? <span>{p.description}</span> : null}
          {p.due_date ? <span>Personal reminder: {p.due_date}</span> : null}
          {p.change_fields.length ? <span>Changed: {p.change_fields.join(", ")}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function ConfirmApprovalDialog({
  selection,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  selection: ConfirmSelectionItem[];
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-label="Confirm approval">
      <div className={styles.confirmBox}>
        <h2 className={styles.confirmTitle}>
          Approve {selection.length} suggestion{selection.length === 1 ? "" : "s"}?
        </h2>
        <p className={styles.reason}>
          Only the suggestions listed here will be approved. Anything arriving afterwards is not included.
        </p>
        <ul className={styles.confirmList}>
          {selection.map((s) => (
            <li key={s.id} className={styles.confirmItem}>
              <strong>{s.title}</strong>
              <span>{s.dueDate ? `Personal reminder: ${s.dueDate}` : "No date — personal reminder only"}</span>
            </li>
          ))}
        </ul>
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actionRow}>
          <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} disabled={pending} onClick={onConfirm}>
            {pending ? "Approving…" : "Confirm approval"}
          </button>
          <button type="button" className={styles.button} disabled={pending} onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function ProposalCard({
  p,
  checked,
  showCheckbox,
  busy,
  error,
  onToggle,
  onApproveRequest,
  onRejectRequest,
}: {
  p: TaskProposalView;
  checked: boolean;
  showCheckbox: boolean;
  busy: boolean;
  error: string | null;
  onToggle: (id: string, checked: boolean) => void;
  onApproveRequest: (id: string, revision: number, edit?: ApproveEdit) => void;
  onRejectRequest: (id: string, revision: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.description ?? "");
  const [dueDate, setDueDate] = useState(p.due_date ?? "");
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        {showCheckbox ? (
          <input
            type="checkbox"
            className={styles.select}
            checked={checked}
            onChange={(e) => onToggle(p.id, e.target.checked)}
            aria-label={`Select ${p.title}`}
          />
        ) : null}
        <h4 className={styles.cardTitle}>{p.title}</h4>
        <StageChip stage={p.stage} />
      </div>
      <div className={styles.meta}>
        <DateLine p={p} />
      </div>
      {p.description ? <p className={styles.description}>{p.description}</p> : null}
      <p className={styles.reason}>{p.reason}</p>
      <UpdateBox p={p} />
      <Evidence p={p} />
      {editing ? (
        <div className={styles.editForm}>
          <label>
            Title
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Description
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            Personal reminder date
            <input
              className={styles.dateInput}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <div className={styles.actionRow}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={busy || !title.trim()}
              onClick={() =>
                onApproveRequest(p.id, p.revision, {
                  title: title.trim(),
                  description: description ? description : null,
                  dueDate: dueDate ? dueDate : null,
                })
              }
            >
              Approve with edits
            </button>
            <button type="button" className={styles.button} disabled={busy} onClick={() => setEditing(false)}>
              Cancel edit
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actionRow}>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={busy}
            onClick={() => onApproveRequest(p.id, p.revision)}
          >
            Approve
          </button>
          <button type="button" className={styles.button} disabled={busy} onClick={() => setEditing(true)}>
            Edit &amp; approve
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            onClick={() => onRejectRequest(p.id, p.revision)}
          >
            {busy ? "Working…" : "Reject"}
          </button>
        </div>
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
    </article>
  );
}

export function SuggestionsList({ proposals, applicationNames, approve, reject }: SuggestionsListProps) {
  const pending = useMemo(() => proposals.filter((p) => p.status === "pending"), [proposals]);
  const history = useMemo(() => proposals.filter((p) => p.status !== "pending"), [proposals]);
  const groups = useMemo(() => {
    const order: string[] = [];
    for (const p of pending) {
      const k = groupKey(p);
      if (!order.includes(k)) order.push(k);
    }
    order.sort((a, b) => (a === "general" ? -1 : b === "general" ? 1 : a.localeCompare(b)));
    return order.map((key) => ({ key, items: pending.filter((p) => groupKey(p) === key) }));
  }, [pending]);

  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<{ items: ConfirmSelectionItem[]; edits: Map<string, ApproveEdit> } | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const mutationBusy = useRef(false);

  const byId = useMemo(() => new Map(pending.map((p) => [p.id, p])), [pending]);

  function toggle(id: string, next: boolean) {
    setSelected((s) => (next ? [...new Set([...s, id])] : s.filter((v) => v !== id)));
  }

  function requestApprove(entries: { id: string; revision: number; edit?: ApproveEdit }[]) {
    const items: ConfirmSelectionItem[] = [];
    const edits = new Map<string, ApproveEdit>();
    for (const e of entries) {
      const p = byId.get(e.id);
      if (!p || p.status !== "pending" || p.revision !== e.revision) continue;
      items.push({ id: p.id, revision: p.revision, title: e.edit?.title ?? p.title, dueDate: e.edit ? e.edit.dueDate : p.due_date });
      if (e.edit) edits.set(p.id, e.edit);
    }
    if (!items.length) return;
    setConfirmError(null);
    // Snapshot now: proposals arriving after this dialog opens are excluded.
    setConfirming({ items, edits });
  }

  async function confirmApprove() {
    if (!confirming || mutationBusy.current) return;
    mutationBusy.current = true;
    setConfirmPending(true);
    setConfirmError(null);
    const selection: ApproveSelectionItem[] = confirming.items.map((s) => {
      const edit = confirming.edits.get(s.id);
      return edit ? { id: s.id, revision: s.revision, edit } : { id: s.id, revision: s.revision };
    });
    try {
      await approve(selection);
      const done = new Set(selection.map((s) => s.id));
      setSelected((s) => s.filter((id) => !done.has(id)));
      setConfirming(null);
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Approval failed. Nothing was approved.");
    } finally {
      mutationBusy.current = false;
      setConfirmPending(false);
    }
  }

  async function rejectOne(id: string, revision: number) {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    setRowBusy(id);
    setRowErrors((m) => ({ ...m, [id]: "" }));
    try {
      await reject(id, revision);
      setSelected((s) => s.filter((v) => v !== id));
    } catch (e) {
      setRowErrors((m) => ({ ...m, [id]: e instanceof Error ? e.message : "Reject failed." }));
    } finally {
      mutationBusy.current = false;
      setRowBusy(null);
    }
  }

  const selectedPending = selected.filter((id) => byId.has(id));
  const cardProps = (p: TaskProposalView) => ({
    p,
    checked: selected.includes(p.id),
    showCheckbox: true,
    busy: rowBusy === p.id || confirmPending,
    error: rowErrors[p.id] ?? null,
    onToggle: toggle,
    onApproveRequest: (id: string, revision: number, edit?: ApproveEdit) =>
      requestApprove([{ id, revision, ...(edit ? { edit } : {}) }]),
    onRejectRequest: rejectOne,
  });

  return (
    <section className={styles.list} aria-label="Task suggestions">
      <div className={styles.bulkRow}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={!selectedPending.length || confirmPending}
          onClick={() =>
            requestApprove(selectedPending.map((id) => ({ id, revision: byId.get(id)!.revision })))
          }
        >
          Approve selected ({selectedPending.length})
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={!pending.length || confirmPending}
          onClick={() => requestApprove(pending.map((p) => ({ id: p.id, revision: p.revision })))}
        >
          Approve all shown ({pending.length})
        </button>
      </div>

      {groups.map((g) => (
        <section key={g.key} className={styles.group} aria-label={groupLabel(g.key, applicationNames, pending)}>
          <h3 className={styles.groupTitle}>
            {groupLabel(g.key, applicationNames, pending)} ({g.items.length})
          </h3>
          {g.items.map((p) => (
            <ProposalCard key={`${p.id}:${p.revision}`} {...cardProps(p)} />
          ))}
        </section>
      ))}

      {pending.length === 0 ? (
        <p className={styles.reason}>No pending suggestions. New arrivals will appear here.</p>
      ) : null}

      {history.length ? (
        <details className={styles.history}>
          <summary>History ({history.length}) — approved, dismissed and recheck</summary>
          <div className={styles.historyList}>
            {history.map((p) => (
              <div key={p.id} className={styles.historyItem}>
                <span className={styles.historyStatus}>{p.status.replace("_", " ")}</span>
                <span>{p.title}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {confirming ? (
        <ConfirmApprovalDialog
          selection={confirming.items}
          pending={confirmPending}
          error={confirmError}
          onConfirm={confirmApprove}
          onClose={() => (confirmPending ? undefined : setConfirming(null))}
        />
      ) : null}
    </section>
  );
}

export function ProposalPopup({ proposals, applicationNames, approve, reject, onClose }: ProposalPopupProps) {
  const pending = useMemo(() => proposals.filter((p) => p.status === "pending"), [proposals]);
  const groups = useMemo(() => {
    const order: string[] = [];
    for (const p of pending) {
      const k = groupKey(p);
      if (!order.includes(k)) order.push(k);
    }
    return order.map((key) => ({ key, items: pending.filter((p) => groupKey(p) === key) }));
  }, [pending]);
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState<ConfirmSelectionItem[] | null>(null);
  const [edits, setEdits] = useState<Map<string, ApproveEdit>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutationBusy = useRef(false);

  if (!pending.length || !groups.length) return null;
  const safeIndex = Math.min(index, groups.length - 1);
  const group = groups[safeIndex];

  async function approveOne(id: string, revision: number, edit?: ApproveEdit) {
    const p = pending.find((v) => v.id === id);
    if (!p) return;
    setEdits(edit ? new Map([[id, edit]]) : new Map());
    setError(null);
    setConfirming([{ id, revision, title: edit?.title ?? p.title, dueDate: edit ? edit.dueDate : p.due_date }]);
  }

  async function doConfirm() {
    if (!confirming || mutationBusy.current) return;
    mutationBusy.current = true;
    setBusy(true);
    setError(null);
    try {
      await approve(
        confirming.map((s) => {
          const edit = edits.get(s.id);
          return edit ? { id: s.id, revision: s.revision, edit } : { id: s.id, revision: s.revision };
        }),
      );
      setConfirming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed. Nothing was approved.");
    } finally {
      mutationBusy.current = false;
      setBusy(false);
    }
  }

  async function rejectOne(id: string, revision: number) {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    setBusy(true);
    setError(null);
    try {
      await reject(id, revision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed.");
    } finally {
      mutationBusy.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={styles.popup} role="dialog" aria-modal="false" aria-label="New task suggestion">
      <div className={styles.popupHead}>
        <h3 className={styles.groupTitle}>
          {groupLabel(group.key, applicationNames, pending)} ({safeIndex + 1} of {groups.length})
        </h3>
        <button type="button" className={styles.button} disabled={busy} onClick={onClose}>
          Close
        </button>
      </div>
      {groups.length > 1 ? (
        <div className={styles.popupNav}>
          <button
            type="button"
            className={styles.button}
            disabled={safeIndex === 0 || busy}
            onClick={() => setIndex(safeIndex - 1)}
          >
            Previous
          </button>
          <span>
            {safeIndex + 1} / {groups.length}
          </span>
          <button
            type="button"
            className={styles.button}
            disabled={safeIndex >= groups.length - 1 || busy}
            onClick={() => setIndex(safeIndex + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
      {group.items.map((p) => (
        <ProposalCard
          key={`${p.id}:${p.revision}`}
          p={p}
          checked={false}
          showCheckbox={false}
          busy={busy}
          error={null}
          onToggle={() => undefined}
          onApproveRequest={approveOne}
          onRejectRequest={rejectOne}
        />
      ))}
      {error ? <p className={styles.error}>{error}</p> : null}
      {confirming ? (
        <ConfirmApprovalDialog
          selection={confirming}
          pending={busy}
          error={error}
          onConfirm={doConfirm}
          onClose={() => (busy ? undefined : setConfirming(null))}
        />
      ) : null}
    </div>
  );
}
