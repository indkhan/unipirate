"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import type { DashboardTask, RailApplication } from "@/lib/tasks/view";

import {
  createManualTask,
  deleteManualTask,
  updateManualTask,
  updateCourseTask,
} from "./actions";
import styles from "./dashboard.module.css";

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
                if (initialTask.kind === "course_task") {
                  await updateCourseTask({ id: initialTask.id, ...payload });
                } else {
                  await updateManualTask({ id: initialTask.id, ...payload });
                }
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

export function ManualTaskForm({ applications }: { applications: RailApplication[] }) {
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

export function ManualTaskActions({
  task,
  applications,
}: {
  task: DashboardTask;
  applications: RailApplication[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  if (task.kind !== "manual" && task.kind !== "course_task") return null;

  return (
    <>
      <div className={styles.taskActionRow} aria-label="Manual task actions">
        {task.kind === "manual" ? <button
          className={styles.taskIconButton}
          type="button"
          aria-label="Edit task"
          onClick={() => setEditing(true)}
        >
          <Pencil size={14} aria-hidden />
        </button> : null}
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
