"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";

import styles from "./dashboard.module.css";

type ImportedCourse = {
  name: string | null;
  university_name: string | null;
  deadlines: unknown;
  source_url: string;
  extraction_method: string | null;
};

export function AddCourseSheet({ variant }: { variant: "empty" | "rail" }) {
  const router = useRouter();
  const posthog = usePostHog();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportedCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetAndClose() {
    setOpen(false);
    setUrl("");
    setText("");
    setPreview(null);
    setError(null);
    router.refresh();
  }

  function firstDeadline(course: ImportedCourse): string {
    if (!Array.isArray(course.deadlines)) return "Not on the page";
    const line = course.deadlines.find(
      (item) => typeof item === "string" && /\d/.test(item),
    );
    return typeof line === "string" ? line : "Not on the page";
  }

  function sourceHost(sourceUrl: string): string {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      return sourceUrl;
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/courses/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, text }),
      });
      const payload = (await response.json()) as {
        error?: string;
        course?: ImportedCourse;
      };
      if (!response.ok) {
        posthog.capture("course_import_failed", { status: response.status });
        setError(payload.error ?? "Something went wrong — try again.");
        return;
      }
      posthog.capture("course_imported", {
        method: payload.course?.extraction_method,
      });
      setPreview(payload.course ?? null);
    } catch {
      setError("Something went wrong — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const trigger =
    variant === "empty" ? (
      <button className={styles.submit} type="button" onClick={() => setOpen(true)}>
        Add a course
      </button>
    ) : (
      <button className={styles.addLink} type="button" onClick={() => setOpen(true)}>
        + Add course
      </button>
    );

  if (!open) return trigger;

  return (
    <>
      {trigger}
      <div className={styles.overlay} onClick={resetAndClose}>
        <div
          className={styles.sheet}
          role="dialog"
          aria-label="Add a course"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.sheetHead}>
            <h2 className={styles.sheetTitle}>Add a course</h2>
            <button
              className={styles.sheetClose}
              type="button"
              aria-label="Close"
              onClick={resetAndClose}
            >
              ✕
            </button>
          </div>
          {preview ? (
            <div className={styles.sheetForm}>
              <div className={styles.previewBox}>
                <div className={styles.previewRow}>
                  <span>University</span>
                  <strong>{preview.university_name ?? "Pending review"}</strong>
                </div>
                <div className={styles.previewRow}>
                  <span>Program</span>
                  <strong>{preview.name ?? "Untitled course"}</strong>
                </div>
                <div className={styles.previewRow}>
                  <span>Deadline</span>
                  <strong className={styles.previewDeadline}>
                    {firstDeadline(preview)}
                  </strong>
                </div>
                <div className={styles.previewRow}>
                  <span>Source</span>
                  <strong>{sourceHost(preview.source_url)}</strong>
                </div>
              </div>
              <p className={styles.sheetHint}>
                This course is saved and queued for review. The dashboard will
                use the captured deadlines and requirements now.
              </p>
              <button className={styles.submit} type="button" onClick={resetAndClose}>
                Done
              </button>
            </div>
          ) : (
            <form className={styles.sheetForm} onSubmit={submit}>
              <p className={styles.sheetHint}>
                Open the DAAD or university course page, select everything
                (Ctrl+A), copy it, and paste both the link and the text here.
              </p>
              <input
                className={styles.urlInput}
                type="url"
                required
                placeholder="https://www.daad.de/en/study/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <textarea
                className={styles.textInput}
                required
                placeholder="Paste the full page text here"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {error ? <p className={styles.error}>{error}</p> : null}
              <button className={styles.submit} type="submit" disabled={busy}>
                {busy ? "Reading the page…" : "Read this page"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
