"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";

import type { CalendarEvent, DashboardTask, RailApplication } from "@/lib/tasks/sync";
import { daysUntil } from "@/lib/tasks/generate";

import {
  createManualTask,
  deleteManualTask,
  moveTaskToBucket,
  toggleTask,
  updateManualTask,
} from "./actions";
import styles from "./dashboard.module.css";

type BucketName = "now" | "next" | "later";

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

function applicationLabel(application: RailApplication): string {
  return [application.universityName, application.courseName].filter(Boolean).join(" · ");
}

type ManualTaskDialogProps = {
  applications: RailApplication[];
  mode: "add" | "edit";
  initialTask?: DashboardTask;
  onClose: () => void;
};

function ManualTaskDialog({
  applications,
  mode,
  initialTask,
  onClose,
}: ManualTaskDialogProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [sourceUrl, setSourceUrl] = useState(initialTask?.source?.url ?? "");
  const [dueDate, setDueDate] = useState(initialTask?.dueDate ?? "");
  const [applicationId, setApplicationId] = useState(initialTask?.applicationId ?? "");

  const isEdit = mode === "edit" && initialTask;

  function close() {
    if (isPending) return;
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={close}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-label={isEdit ? "Edit task" : "Add a task"}
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.sheetHead}>
          <h2 className={styles.sheetTitle}>{isEdit ? "Edit task" : "Add a task"}</h2>
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
              const payload = {
                title,
                description,
                sourceUrl: sourceUrl || null,
                dueDate: dueDate || null,
                applicationId: applicationId || null,
              };
              if (isEdit) {
                await updateManualTask({ id: initialTask.id, ...payload });
              } else {
                await createManualTask(payload);
              }
              onClose();
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
            aria-label="Task source URL"
            className={styles.taskInput}
            maxLength={2048}
            placeholder="https://example.com"
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
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
            {isEdit ? "Save task" : "Add task"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ManualTaskForm({ applications }: { applications: RailApplication[] }) {
  const [open, setOpen] = useState(false);

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
      <ManualTaskDialog
        applications={applications}
        mode="add"
        onClose={() => setOpen(false)}
      />
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

  if (task.kind !== "manual") return null;

  return (
    <>
      <div className={styles.taskActionRow} aria-label="Manual task actions">
        <button
          className={styles.taskIconButton}
          type="button"
          aria-label="Edit task"
          onClick={() => setEditing(true)}
        >
          <Pencil size={14} aria-hidden />
        </button>
        <button
          className={styles.taskIconButton}
          type="button"
          aria-label="Delete task"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await deleteManualTask({ id: task.id });
              router.refresh();
            });
          }}
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
      {editing ? (
        <ManualTaskDialog
          applications={applications}
          mode="edit"
          initialTask={task}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}

function NowTask({
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
  const [todayYear, todayMonth, todayDay] = todayIso.split("-").map(Number);
  const [visibleMonth, setVisibleMonth] = useState(
    () => `${todayYear}-${String(todayMonth).padStart(2, "0")}`,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [year, month] = visibleMonth.split("-").map(Number);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const dayEvents = map.get(event.dueDate) ?? [];
      dayEvents.push(event);
      map.set(event.dueDate, dayEvents);
    }
    return map;
  }, [events]);
  const selectedEvents = selectedDate
    ? eventsByDay.get(selectedDate) ?? []
    : events.filter((event) => event.dueDate.startsWith(monthPrefix));
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: mondayOffset + daysInMonth }, (_, index) => {
      const day = index - mondayOffset + 1;
      const date =
        day > 0 ? `${monthPrefix}-${String(day).padStart(2, "0")}` : null;
      return {
        day: day > 0 ? day : null,
        date,
        today:
          day === todayDay && year === todayYear && month === todayMonth,
        hasEvent: date ? eventsByDay.has(date) : false,
        selected: date !== null && date === selectedDate,
      };
    });
  }, [eventsByDay, month, monthPrefix, selectedDate, todayDay, todayMonth, todayYear, year]);

  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  function shiftMonth(delta: number) {
    const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
    const nextMonth = `${shifted.getUTCFullYear()}-${String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    setVisibleMonth(nextMonth);
    setSelectedDate(null);
  }

  return (
    <section className={styles.calendarPanel}>
      <div className={styles.calendarHead}>
        <h2 className={styles.calendarTitle}>{monthLabel}</h2>
        <div className={styles.calendarNav}>
          <button
            className={styles.calendarNavButton}
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            className={styles.calendarNavButton}
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div className={styles.weekdays}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.calGrid}>
        {cells.map((cell, index) => (
          <button
            key={`${cell.day ?? "blank"}-${index}`}
            className={`${styles.calCell} ${cell.today ? styles.calToday : ""} ${
              cell.selected ? styles.calSelected : ""
            }`}
            type="button"
            disabled={!cell.date}
            onClick={() => setSelectedDate(cell.date)}
          >
            <span>{cell.day ?? ""}</span>
            {cell.hasEvent ? <span className={styles.calDot} aria-hidden /> : null}
          </button>
        ))}
      </div>
      <div className={styles.eventList}>
        {selectedEvents.length === 0 ? (
          <span className={styles.noEvents}>
            {selectedDate ? "No tasks on this day." : "No dated tasks this month."}
          </span>
        ) : (
          selectedEvents.map((event) => (
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
  const [localBuckets, setLocalBuckets] = useState(buckets);
  const [localDoneTasks, setLocalDoneTasks] = useState(doneTasks);
  const [draggedTaskId, setDraggedTaskId] = useState("");
  const [dragOverBucket, setDragOverBucket] = useState<BucketName | null>(null);
  const [isMoving, startMoveTransition] = useTransition();

  function pendingTaskById(taskId: string) {
    return [...localBuckets.now, ...localBuckets.next, ...localBuckets.later].find(
      (task) => task.id === taskId,
    );
  }

  function removePendingTask(taskId: string) {
    setLocalBuckets((current) => {
      const next = {
        now: current.now.filter((pendingTask) => pendingTask.id !== taskId),
        next: current.next.filter((pendingTask) => pendingTask.id !== taskId),
        later: current.later.filter((pendingTask) => pendingTask.id !== taskId),
      };
      return next;
    });
  }

  function handleToggle(task: DashboardTask, done: boolean) {
    if (done) {
      const movedTask = pendingTaskById(task.id);
      removePendingTask(task.id);
      setLocalDoneTasks((current) => [
        { ...(movedTask ?? task), done: true },
        ...current.filter((doneTask) => doneTask.id !== task.id),
      ]);
      return;
    }

    setLocalDoneTasks((current) => current.filter((doneTask) => doneTask.id !== task.id));
    setLocalBuckets((current) => ({
      ...current,
      now: [{ ...task, done: false }, ...current.now],
    }));
  }

  function dropTask(bucket: BucketName) {
    if (!draggedTaskId) return;
    const taskId = draggedTaskId;
    setDraggedTaskId("");
    setDragOverBucket(null);
    const movedTask = pendingTaskById(taskId);
    removePendingTask(taskId);
    if (movedTask) {
      setLocalBuckets((current) => ({
        ...current,
        [bucket]: [
          { ...movedTask, preferredBucket: bucket },
          ...current[bucket].filter((task) => task.id !== taskId),
        ],
      }));
    }
    startMoveTransition(async () => {
      await moveTaskToBucket({ id: taskId, bucket });
    });
  }

  function dropZoneClass(bucket: BucketName) {
    return `${styles.dropSection} ${
      dragOverBucket === bucket ? styles.dropSectionActive : ""
    } ${isMoving ? styles.dropSectionMoving : ""}`;
  }

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
          <details
            className={`${styles.taskDetails} ${dropZoneClass("now")}`}
            open
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverBucket("now");
            }}
            onDragLeave={() => setDragOverBucket(null)}
            onDrop={(event) => {
              event.preventDefault();
              dropTask("now");
            }}
          >
            <summary>Now · {localBuckets.now.length}</summary>
            <div className={styles.sectionTaskStack}>
              {localBuckets.now.length === 0 ? (
                <div className={styles.quietPanel}>Nothing needs action today.</div>
              ) : (
                localBuckets.now.map((task) => (
                  <NowTask
                    key={task.key}
                    task={task}
                    todayIso={todayIso}
                    applications={applications}
                    onDragStart={setDraggedTaskId}
                    onToggle={handleToggle}
                  />
                ))
              )}
            </div>
          </details>

          <section className={styles.detailsStack}>
            <details
              className={`${styles.taskDetails} ${dropZoneClass("next")}`}
              open
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverBucket("next");
              }}
              onDragLeave={() => setDragOverBucket(null)}
              onDrop={(event) => {
                event.preventDefault();
                dropTask("next");
              }}
            >
              <summary>Next · {localBuckets.next.length}</summary>
              <div className={styles.sectionTaskStack}>
                {localBuckets.next.map((task) => (
                  <NowTask
                    key={task.key}
                    task={task}
                    todayIso={todayIso}
                    applications={applications}
                    onDragStart={setDraggedTaskId}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </details>
            <details
              className={`${styles.taskDetails} ${styles.laterDetails} ${dropZoneClass(
                "later",
              )}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverBucket("later");
              }}
              onDragLeave={() => setDragOverBucket(null)}
              onDrop={(event) => {
                event.preventDefault();
                dropTask("later");
              }}
            >
              <summary>Later · {localBuckets.later.length}</summary>
              <div className={styles.sectionTaskStack}>
                {localBuckets.later.map((task) => (
                  <NowTask
                    key={task.key}
                    task={task}
                    todayIso={todayIso}
                    applications={applications}
                    onDragStart={setDraggedTaskId}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </details>
            <details className={styles.taskDetails}>
              <summary>Done · {localDoneTasks.length}</summary>
              <div className={styles.sectionTaskStack}>
                {localDoneTasks.length === 0 ? (
                  <div className={styles.quietPanel}>Completed tasks will show here.</div>
                ) : (
                  localDoneTasks.map((task) => (
                    <NowTask
                      key={task.key}
                      task={task}
                      todayIso={todayIso}
                      applications={applications}
                      onDragStart={setDraggedTaskId}
                      onToggle={handleToggle}
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
