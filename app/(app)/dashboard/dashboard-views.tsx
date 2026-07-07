"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import type { CalendarEvent, DashboardTask, RailApplication } from "@/lib/tasks/sync";
import { daysUntil } from "@/lib/tasks/generate";

import {
  createManualTask,
  deleteManualTask,
  toggleTask,
  updateManualTask,
} from "./actions";
import styles from "./dashboard.module.css";

type DashboardViewsProps = {
  buckets: {
    now: DashboardTask[];
    next: DashboardTask[];
    later: DashboardTask[];
  };
  doneTasks: DashboardTask[];
  calendarEvents: CalendarEvent[];
  applications: RailApplication[];
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

function applicationLabel(application: RailApplication): string {
  return [application.universityName, application.courseName].filter(Boolean).join(" · ");
}

function ManualTaskForm({ applications }: { applications: RailApplication[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [applicationId, setApplicationId] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setApplicationId("");
  }

  function close() {
    if (isPending) return;
    reset();
    setOpen(false);
  }

  const trigger = (
    <button className={styles.addTaskButton} type="button" onClick={() => setOpen(true)}>
      <Plus size={16} aria-hidden />
      Add task
    </button>
  );

  if (!open) return trigger;

  return (
    <>
      {trigger}
      <div className={styles.overlay} onClick={close}>
        <div
          className={styles.sheet}
          role="dialog"
          aria-label="Add a task"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.sheetHead}>
            <h2 className={styles.sheetTitle}>Add a task</h2>
            <button
              className={styles.sheetClose}
              type="button"
              aria-label="Close"
              onClick={close}
            >
              <X size={20} aria-hidden />
            </button>
          </div>
          <p className={styles.sheetHint}>
            Keep personal reminders next to your generated application steps.
          </p>

          <form
            className={styles.addTaskForm}
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                await createManualTask({
                  title,
                  description,
                  dueDate: dueDate || null,
                  applicationId: applicationId || null,
                });
                reset();
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <input
              aria-label="Task title"
              className={styles.taskInput}
              maxLength={240}
              placeholder="Book APS courier appointment"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              aria-label="Task description"
              className={styles.taskTextarea}
              maxLength={2000}
              placeholder="Add notes, links, or details"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <input
              aria-label="Task due date"
              className={styles.taskDateInput}
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            {applications.length > 0 ? (
              <select
                aria-label="Attach task to application"
                className={styles.taskSelect}
                value={applicationId}
                onChange={(event) => setApplicationId(event.target.value)}
              >
                <option value="">General</option>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {applicationLabel(application)}
                  </option>
                ))}
              </select>
            ) : null}
            <button className={styles.taskSubmit} type="submit" disabled={isPending}>
              Add task
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function ManualTaskActions({
  task,
  applications,
}: {
  task: DashboardTask;
  applications: RailApplication[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [applicationId, setApplicationId] = useState(task.applicationId ?? "");

  if (task.kind !== "manual") return null;

  if (editing) {
    return (
      <form
        className={styles.editTaskForm}
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            await updateManualTask({
              id: task.id,
              title,
              description,
              dueDate: dueDate || null,
              applicationId: applicationId || null,
            });
            setEditing(false);
            router.refresh();
          });
        }}
      >
        <input
          aria-label="Task title"
          className={styles.taskInput}
          maxLength={240}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          aria-label="Task description"
          className={styles.taskTextarea}
          maxLength={2000}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <input
          aria-label="Task due date"
          className={styles.taskDateInput}
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        {applications.length > 0 ? (
          <select
            aria-label="Attach task to application"
            className={styles.taskSelect}
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}
          >
            <option value="">General</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {applicationLabel(application)}
              </option>
            ))}
          </select>
        ) : null}
        <div className={styles.taskActionRow}>
          <button className={styles.taskSubmit} type="submit" disabled={isPending}>
            Save
          </button>
          <button
            className={styles.taskTextButton}
            type="button"
            disabled={isPending}
            onClick={() => {
              setTitle(task.title);
              setDescription(task.description ?? "");
              setDueDate(task.dueDate ?? "");
              setApplicationId(task.applicationId ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={styles.taskActionRow}>
      <button className={styles.taskTextButton} type="button" onClick={() => setEditing(true)}>
        <Pencil size={14} aria-hidden />
        Edit
      </button>
      <button
        className={styles.taskTextButton}
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await deleteManualTask({ id: task.id });
            router.refresh();
          });
        }}
      >
        <Trash2 size={14} aria-hidden />
        Delete
      </button>
    </div>
  );
}

function NowTask({
  task,
  todayIso,
  applications,
}: {
  task: DashboardTask;
  todayIso: string;
  applications: RailApplication[];
}) {
  const overdue = task.dueDate !== null && daysUntil(task.dueDate, todayIso) < 0;

  return (
    <article className={`${styles.nowCard} ${overdue ? styles.nowCardOverdue : ""}`}>
      <TaskToggle task={task} />
      <div className={styles.nowBody}>
        <h3 className={styles.nowTitle}>{task.title}</h3>
        {task.description ? (
          <p className={styles.taskDescription}>{task.description}</p>
        ) : null}
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
        <ManualTaskActions task={task} applications={applications} />
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
  doneTasks,
  calendarEvents,
  applications,
  todayIso,
}: DashboardViewsProps) {
  const [view, setView] = useState<"tasks" | "calendar">("tasks");

  return (
    <>
      <div className={styles.taskToolbar}>
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
        <ManualTaskForm applications={applications} />
      </div>

      {view === "tasks" ? (
        <div className={styles.taskStack}>
          <section className={styles.nowSection}>
            <span className={styles.sectionLabel}>Now</span>
            {buckets.now.length === 0 ? (
              <div className={styles.quietPanel}>Nothing needs action today.</div>
            ) : (
              buckets.now.map((task) => (
                <NowTask
                  key={task.key}
                  task={task}
                  todayIso={todayIso}
                  applications={applications}
                />
              ))
            )}
          </section>

          <section className={styles.detailsStack}>
            <details className={styles.taskDetails} open>
              <summary>Next · {buckets.next.length}</summary>
              <div className={styles.sectionTaskStack}>
                {buckets.next.map((task) => (
                  <NowTask
                    key={task.key}
                    task={task}
                    todayIso={todayIso}
                    applications={applications}
                  />
                ))}
              </div>
            </details>
            <details className={`${styles.taskDetails} ${styles.laterDetails}`}>
              <summary>Later · {buckets.later.length}</summary>
              <div className={styles.sectionTaskStack}>
                {buckets.later.map((task) => (
                  <NowTask
                    key={task.key}
                    task={task}
                    todayIso={todayIso}
                    applications={applications}
                  />
                ))}
              </div>
            </details>
            <details className={styles.taskDetails}>
              <summary>Done · {doneTasks.length}</summary>
              <div className={styles.sectionTaskStack}>
                {doneTasks.length === 0 ? (
                  <div className={styles.quietPanel}>Completed tasks will show here.</div>
                ) : (
                  doneTasks.map((task) => (
                    <NowTask
                      key={task.key}
                      task={task}
                      todayIso={todayIso}
                      applications={applications}
                    />
                  ))
                )}
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
