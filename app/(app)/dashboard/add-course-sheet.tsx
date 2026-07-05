"use client";

import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";

import styles from "./dashboard.module.css";

export function AddCourseSheet({ variant }: { variant: "empty" | "rail" }) {
  const router = useRouter();
  const posthog = usePostHog();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        course?: { extraction_method: string | null };
      };
      if (!response.ok) {
        posthog.capture("course_import_failed", { status: response.status });
        setError(payload.error ?? "Something went wrong — try again.");
        return;
      }
      posthog.capture("course_imported", {
        method: payload.course?.extraction_method,
      });
      setOpen(false);
      setUrl("");
      setText("");
      router.refresh();
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
      <div className={styles.overlay} onClick={() => setOpen(false)}>
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
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <form
            onSubmit={submit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <p className={styles.sheetHint}>
              Open the DAAD or university course page, select everything
              (Ctrl+A), copy it, and paste both the link and the text here. We
              read the deadlines and requirements from it.
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
              placeholder="Paste the full page text here (Ctrl+A, Ctrl+C on the course page)"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error ? <p className={styles.error}>{error}</p> : null}
            <button className={styles.submit} type="submit" disabled={busy}>
              {busy ? "Reading the page…" : "Read this page"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
