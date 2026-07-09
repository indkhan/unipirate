"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";

import dashStyles from "../dashboard/dashboard.module.css";
import { addCourseToDashboard } from "./actions";
import styles from "./finder.module.css";

type FoundCourse = {
  id: string;
  name: string | null;
  university_name: string | null;
  review_status: "pending" | "approved" | "rejected";
  extraction_method: string | null;
};

type LookupState =
  | { step: "url" }
  | { step: "found"; course: FoundCourse; onDashboard: boolean }
  | { step: "paste"; conflictsWith: string | null };

type AddCourseSheetProps = {
  trackedIds?: string[];
  triggerLabel?: string;
  triggerClassName?: string;
};

export function AddCourseSheet({
  trackedIds = [],
  triggerLabel = "Add it by URL",
  triggerClassName,
}: AddCourseSheetProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ step: "url" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setUrl("");
    setText("");
    setLookup({ step: "url" });
    setError(null);
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/courses/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      error?: string;
      deduped?: boolean;
      course?: FoundCourse | null;
      onDashboard?: boolean;
    };
    if (!response.ok) {
      const error = new Error(payload.error ?? "Something went wrong — try again.");
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }
    return payload;
  }

  async function checkUrl(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = await post({ url });
      if (payload.course) {
        setLookup({
          step: "found",
          course: payload.course,
          onDashboard: payload.onDashboard ?? trackedIds.includes(payload.course.id),
        });
      } else {
        setLookup({ step: "paste", conflictsWith: null });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addExisting(course: FoundCourse) {
    setBusy(true);
    setError(null);
    try {
      await addCourseToDashboard(course.id);
      posthog.capture("course_added_from_finder", { course_id: course.id });
      close();
      router.refresh();
    } catch {
      setError("Something went wrong — try again.");
      setBusy(false);
    }
  }

  async function submitText(event: React.FormEvent) {
    if (lookup.step !== "paste") return;
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = await post({
        url,
        text,
        ...(lookup.conflictsWith ? { conflictsWith: lookup.conflictsWith } : {}),
      });
      if (lookup.conflictsWith) {
        posthog.capture("course_update_submitted", {
          course_id: lookup.conflictsWith,
        });
      } else {
        posthog.capture("course_imported", {
          method: payload.course?.extraction_method,
        });
      }
      close();
      router.refresh();
    } catch (e) {
      posthog.capture("course_import_failed", {
        status: e instanceof Error ? (e as Error & { status?: number }).status : undefined,
      });
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  const trigger = (
    <button
      className={triggerClassName ?? styles.addButton}
      type="button"
      onClick={() => setOpen(true)}
    >
      {triggerLabel}
    </button>
  );

  if (!open) return trigger;

  const foundCourseOnDashboard = lookup.step === "found" && lookup.onDashboard;

  return (
    <>
      {trigger}
      <div className={dashStyles.overlay} onClick={close}>
        <div
          className={dashStyles.sheet}
          role="dialog"
          aria-label="Add a course"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={dashStyles.sheetHead}>
            <h2 className={dashStyles.sheetTitle}>Add a course</h2>
            <button
              className={dashStyles.sheetClose}
              type="button"
              aria-label="Close"
              onClick={close}
            >
              ✕
            </button>
          </div>

          {lookup.step === "url" ? (
            <form
              onSubmit={checkUrl}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <p className={dashStyles.sheetHint}>
                Paste the DAAD or university course link first — we check
                whether it&apos;s already here.
              </p>
              <input
                className={dashStyles.urlInput}
                type="url"
                required
                placeholder="https://www.daad.de/en/study/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {error ? <p className={dashStyles.error}>{error}</p> : null}
              <button className={dashStyles.submit} type="submit" disabled={busy}>
                {busy ? "Checking…" : "Check this link"}
              </button>
            </form>
          ) : null}

          {lookup.step === "found" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p className={dashStyles.sheetHint}>
                This course is already here
                {lookup.course.review_status === "pending"
                  ? " (still in review)"
                  : ""}
                :
              </p>
              <article className={dashStyles.card}>
                <span className={dashStyles.cardName}>
                  {lookup.course.name ?? "Untitled course"}
                </span>
                <span className={dashStyles.cardUni}>
                  {lookup.course.university_name ?? "University pending review"}
                </span>
              </article>
              {error ? <p className={dashStyles.error}>{error}</p> : null}
              {foundCourseOnDashboard ? (
                <button className={dashStyles.submit} type="button" disabled>
                  Already in dashboard
                </button>
              ) : (
              <button
                className={dashStyles.submit}
                type="button"
                disabled={busy}
                onClick={() => addExisting(lookup.course)}
              >
                {busy ? "Adding…" : "Add to my dashboard"}
              </button>
              )}
              <button
                className={styles.addButton}
                type="button"
                disabled={busy}
                onClick={() =>
                  setLookup({ step: "paste", conflictsWith: lookup.course.id })
                }
              >
                The page changed — submit an update
              </button>
            </div>
          ) : null}

          {lookup.step === "paste" ? (
            <form
              onSubmit={submitText}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <p className={dashStyles.sheetHint}>
                {lookup.conflictsWith
                  ? "Open the course page, select everything (Ctrl+A), copy it, and paste the text here. An admin compares it with the saved version and keeps the correct one."
                  : "Open the course page, select everything (Ctrl+A), copy it, and paste the text here. We read the deadlines and requirements from it."}
              </p>
              <textarea
                className={dashStyles.textInput}
                required
                placeholder="Paste the full page text here (Ctrl+A, Ctrl+C on the course page)"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {error ? <p className={dashStyles.error}>{error}</p> : null}
              <button className={dashStyles.submit} type="submit" disabled={busy}>
                {busy
                  ? "Reading the page…"
                  : lookup.conflictsWith
                    ? "Submit the update"
                    : "Read this page"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </>
  );
}
