"use client";

import { useTransition } from "react";

import type { DashboardTask, RailApplication } from "@/lib/tasks/view";
import { daysUntil } from "@/lib/tasks/generate";

import { resolveCourseTaskUpdate, toggleTask } from "./actions";
import { formatDate } from "./format";
import { TaskActions } from "./manual-task";
import styles from "./dashboard.module.css";

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Stamp({ source }: { source: DashboardTask["source"] }) {
  if (!source) return null;
  const verified = source.verifiedAt ? source.verifiedAt.slice(0, 10) : "confirm";
  return (
    <a className={styles.stamp} href={source.url} target="_blank" rel="noreferrer">
      <span className={styles.stampSeal}>✓</span>
      {sourceHost(source.url)} · {verified}
    </a>
  );
}

function TaskToggle({
  task,
  onToggle,
}: {
  task: DashboardTask;
  onToggle: (task: DashboardTask, done: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={styles.taskCheck}
      type="button"
      disabled={isPending}
      aria-label={task.done ? "Mark task not done" : "Mark task done"}
      onClick={() => {
        const nextDone = !task.done;
        onToggle(task, nextDone);
        startTransition(async () => {
          await toggleTask({ id: task.id, done: nextDone });
        });
      }}
    >
      {task.done ? "✓" : ""}
    </button>
  );
}

function CourseTaskChange({ task }: { task: DashboardTask }) {
  const [isPending, startTransition] = useTransition();
  if (task.kind !== "course_task" || task.adminChangeState === "current") return null;
  const removed = task.adminChangeState === "removal_pending";
  const snapshotValue = (key: string) => {
    const value = task.adminSnapshot?.[key];
    return typeof value === "string" || value === null ? value : undefined;
  };
  const adminTitle = typeof task.adminSnapshot?.title === "string"
    ? task.adminSnapshot.title
    : "the latest admin task";
  const changes = [
    ["Title", task.title, snapshotValue("title")],
    ["Description", task.description, snapshotValue("description")],
    ["Deadline", task.verbatimDue ?? task.dueDate, snapshotValue("verbatim_due") ?? snapshotValue("due_date")],
    ["Source", task.source?.url ?? null, snapshotValue("source_url")],
  ].filter(([, current, next]) => next !== undefined && current !== next);
  const resolve = (resolution: "adopt" | "keep" | "remove" | "manual") => {
    startTransition(async () => {
      await resolveCourseTaskUpdate({ id: task.id, resolution });
      window.location.reload();
    });
  };
  return (
    <div className={`${styles.taskActionRow} ${styles.courseTaskChange}`} aria-label="Admin task update">
      <span className={styles.taskDue}>
        {removed ? "Admin removed this task." : `Admin updated this task: ${adminTitle}`}
      </span>
      {changes.length > 0 ? (
        <div className={styles.courseTaskChangeDetails}>
          {changes.map(([label, current, next]) => (
            <p key={label}>
              <strong>{label} changed</strong>
              <span>Was: {current ?? "None"}</span>
              <span>Now: {next ?? "None"}</span>
            </p>
          ))}
        </div>
      ) : null}
      {removed ? (
        <>
          <button className={styles.taskTextButton} type="button" disabled={isPending} onClick={() => resolve("manual")}>Keep mine</button>
          <button className={styles.taskTextButton} type="button" disabled={isPending} onClick={() => resolve("remove")}>Remove</button>
        </>
      ) : (
        <>
          <button className={styles.taskTextButton} type="button" disabled={isPending} onClick={() => resolve("keep")}>Keep mine</button>
          <button className={styles.taskTextButton} type="button" disabled={isPending} onClick={() => resolve("adopt")}>Use admin</button>
        </>
      )}
    </div>
  );
}

export function NowTask({
  task,
  todayIso,
  applications,
  onDragStart,
  onToggle,
}: {
  task: DashboardTask;
  todayIso: string;
  applications: RailApplication[];
  onDragStart: (taskId: string) => void;
  onToggle: (task: DashboardTask, done: boolean) => void;
}) {
  const overdue = task.dueDate !== null && daysUntil(task.dueDate, todayIso) < 0;
  const taskDetail = [task.description, task.verbatimDue ?? formatDate(task.dueDate)]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`${styles.nowCard} ${overdue ? styles.nowCardOverdue : ""}`}
      draggable={!task.done}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart(task.id);
      }}
      onDragEnd={() => onDragStart("")}
    >
      <TaskToggle task={task} onToggle={onToggle} />
      <div className={styles.nowBody}>
        <h3 className={styles.nowTitle}>{task.title}</h3>
        <div className={styles.taskMeta}>
          <span
            className={`${styles.taskTag} ${
              task.scope === "global" ? styles.tagGlobal : styles.tagUniversity
            }`}
          >
            {task.scope === "global" ? "Global" : "University"}
          </span>
          <span className={styles.taskDue}>{taskDetail}</span>
        </div>
        <Stamp source={task.source} />
        <TaskActions task={task} applications={applications} />
        <CourseTaskChange task={task} />
      </div>
    </article>
  );
}
