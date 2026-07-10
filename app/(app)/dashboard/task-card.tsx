"use client";

import { useTransition } from "react";

import type { DashboardTask, RailApplication } from "@/lib/tasks/view";
import { daysUntil } from "@/lib/tasks/generate";

import { toggleTask } from "./actions";
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
      </div>
    </article>
  );
}
