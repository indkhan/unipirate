"use client";

import { useState, useTransition } from "react";

import type { CalendarEvent, DashboardTask, RailApplication } from "@/lib/tasks/view";

import { moveTaskToBucket } from "./actions";
import { Calendar } from "./calendar";
import { ManualTaskForm } from "./manual-task";
import { NowTask } from "./task-card";
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
