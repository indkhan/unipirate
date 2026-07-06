"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CalendarEvent, DashboardTask } from "@/lib/tasks/sync";
import { daysUntil } from "@/lib/tasks/generate";

import { toggleTask } from "./actions";
import styles from "./dashboard.module.css";

type DashboardViewsProps = {
  buckets: {
    now: DashboardTask[];
    next: DashboardTask[];
    later: DashboardTask[];
  };
  calendarEvents: CalendarEvent[];
  todayIso: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

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

function TaskToggle({ task }: { task: DashboardTask }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={styles.taskCheck}
      type="button"
      disabled={isPending}
      aria-label={task.done ? "Mark task not done" : "Mark task done"}
      onClick={() => {
        startTransition(async () => {
          await toggleTask({ id: task.id, done: !task.done });
          router.refresh();
        });
      }}
    >
      {task.done ? "✓" : ""}
    </button>
  );
}

function dueNote(task: DashboardTask, todayIso: string): string | null {
  if (!task.dueDate) return null;
  const days = daysUntil(task.dueDate, todayIso);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days <= 14) return `Due in ${days} days`;
  return null;
}

function MiniTask({ task }: { task: DashboardTask }) {
  return (
    <div className={styles.miniTask}>
      <span className={styles.miniBox} aria-hidden />
      <span className={styles.miniTitle}>{task.title}</span>
      <span className={styles.miniDue}>{task.verbatimDue ?? formatDate(task.dueDate)}</span>
    </div>
  );
}

function NowTask({ task, todayIso }: { task: DashboardTask; todayIso: string }) {
  const overdue = task.dueDate !== null && daysUntil(task.dueDate, todayIso) < 0;
  const note = dueNote(task, todayIso);

  return (
    <article className={`${styles.nowCard} ${overdue ? styles.nowCardOverdue : ""}`}>
      <TaskToggle task={task} />
      <div className={styles.nowBody}>
        <h3 className={styles.nowTitle}>{task.title}</h3>
        {note ? <span className={styles.dueNote}>{note}</span> : null}
        <div className={styles.taskMeta}>
          <span
            className={`${styles.taskTag} ${
              task.scope === "global" ? styles.tagGlobal : styles.tagUniversity
            }`}
          >
            {task.scope === "global" ? "Global" : "University"}
          </span>
          <span className={styles.taskDue}>
            {task.verbatimDue ?? formatDate(task.dueDate)}
          </span>
        </div>
        <Stamp source={task.source} />
      </div>
    </article>
  );
}

function Calendar({
  events,
  todayIso,
}: {
  events: CalendarEvent[];
  todayIso: string;
}) {
  const cells = useMemo(() => {
    const [year, month, today] = todayIso.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    const byDay = new Set(
      events
        .filter((event) => event.dueDate.startsWith(`${year}-${String(month).padStart(2, "0")}`))
        .map((event) => Number(event.dueDate.slice(8, 10))),
    );
    return Array.from({ length: mondayOffset + daysInMonth }, (_, index) => {
      const day = index - mondayOffset + 1;
      return {
        day: day > 0 ? day : null,
        today: day === today,
        hasEvent: day > 0 && byDay.has(day),
      };
    });
  }, [events, todayIso]);

  const [year, month] = todayIso.split("-").map(Number);
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <section className={styles.calendarPanel}>
      <h2 className={styles.calendarTitle}>{monthLabel}</h2>
      <div className={styles.weekdays}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.calGrid}>
        {cells.map((cell, index) => (
          <div
            key={`${cell.day ?? "blank"}-${index}`}
            className={`${styles.calCell} ${cell.today ? styles.calToday : ""}`}
          >
            <span>{cell.day ?? ""}</span>
            {cell.hasEvent ? <span className={styles.calDot} aria-hidden /> : null}
          </div>
        ))}
      </div>
      <div className={styles.eventList}>
        {events.length === 0 ? (
          <span className={styles.noEvents}>No dated tasks yet.</span>
        ) : (
          events.map((event) => (
            <div key={event.key} className={styles.eventRow}>
              <span>{event.title}</span>
              <span>{event.verbatimDue ?? formatDate(event.dueDate)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function DashboardViews({
  buckets,
  calendarEvents,
  todayIso,
}: DashboardViewsProps) {
  const [view, setView] = useState<"tasks" | "calendar">("tasks");

  return (
    <>
      <div className={styles.viewToggle} aria-label="Dashboard view">
        <button
          className={view === "tasks" ? styles.viewActive : ""}
          type="button"
          onClick={() => setView("tasks")}
        >
          Tasks
        </button>
        <button
          className={view === "calendar" ? styles.viewActive : ""}
          type="button"
          onClick={() => setView("calendar")}
        >
          Calendar
        </button>
      </div>

      {view === "tasks" ? (
        <div className={styles.taskStack}>
          <section className={styles.nowSection}>
            <span className={styles.sectionLabel}>Now</span>
            {buckets.now.length === 0 ? (
              <div className={styles.quietPanel}>Nothing needs action today.</div>
            ) : (
              buckets.now.map((task) => (
                <NowTask key={task.key} task={task} todayIso={todayIso} />
              ))
            )}
          </section>

          <section className={styles.detailsStack}>
            <details className={styles.taskDetails} open>
              <summary>Next · {buckets.next.length}</summary>
              <div className={styles.miniStack}>
                {buckets.next.map((task) => (
                  <MiniTask key={task.key} task={task} />
                ))}
              </div>
            </details>
            <details className={`${styles.taskDetails} ${styles.laterDetails}`}>
              <summary>Later · {buckets.later.length}</summary>
              <div className={styles.miniStack}>
                {buckets.later.map((task) => (
                  <MiniTask key={task.key} task={task} />
                ))}
              </div>
            </details>
          </section>
        </div>
      ) : (
        <Calendar events={calendarEvents} todayIso={todayIso} />
      )}
    </>
  );
}
