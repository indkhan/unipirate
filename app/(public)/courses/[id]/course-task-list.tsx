"use client";

import { useState, useTransition } from "react";

import type { CourseTaskDefinition } from "@/lib/tasks/course-tasks";
import { renderCourseTaskTitle } from "@/lib/tasks/course-tasks";
import { resolveCourseTaskUpdate, updateCourseTask } from "@/app/(app)/dashboard/actions";

type MyTask = {
  id: string;
  title: string;
  description: string | null;
  source_url: string | null;
  due_date: string | null;
  verbatim_due: string | null;
  admin_change_state: "current" | "update_pending" | "removal_pending";
};

export function CourseTaskList({
  definitions,
  myTasks,
  courseLabel,
  styles,
}: {
  definitions: CourseTaskDefinition[];
  myTasks: MyTask[] | null;
  courseLabel: string;
  styles: Record<string, string>;
}) {
  const [mode, setMode] = useState<"mine" | "admin">(
    myTasks ? "mine" : "admin",
  );
  const [isPending, startTransition] = useTransition();
  const resolve = (id: string, resolution: "adopt" | "keep" | "remove" | "manual") => {
    startTransition(async () => {
      await resolveCourseTaskUpdate({ id, resolution });
      window.location.reload();
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.factRow}>
        <span className={styles.sectionLabel}>Course tasks</span>
        {myTasks ? (
          <select value={mode} onChange={(event) => setMode(event.target.value as "mine" | "admin")}>
            <option value="mine">My tasks</option>
            <option value="admin">Admin tasks</option>
          </select>
        ) : null}
      </div>
      {mode === "admin" ? (
        definitions.length === 0 ? <p className={styles.emptyNote}>No verified course tasks yet.</p> : (
          <ul className={styles.requirements}>
            {definitions.map((definition) => (
              <li key={definition.id}>
                <strong>{renderCourseTaskTitle(definition.titleTemplate, courseLabel)}</strong>
                {definition.description ? ` — ${definition.description}` : ""}
                {definition.dueDate ? ` · ${definition.dueDate}` : ""}
              </li>
            ))}
          </ul>
        )
      ) : myTasks?.length === 0 ? <p className={styles.emptyNote}>No assigned tasks for this course.</p> : (
        <div className={styles.requirements}>
          {myTasks?.map((task) => (
            <details key={task.id}>
              <summary>{task.title}{task.admin_change_state !== "current" ? " · admin update available" : ""}</summary>
              <form onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                startTransition(async () => {
                  await updateCourseTask({
                    id: task.id,
                    title: form.get("title"),
                    description: form.get("description"),
                    sourceUrl: form.get("sourceUrl"),
                    dueDate: form.get("dueDate"),
                  });
                  window.location.reload();
                });
              }}>
                <input name="title" defaultValue={task.title} required />
                <textarea name="description" defaultValue={task.description ?? ""} />
                <input name="sourceUrl" type="url" defaultValue={task.source_url ?? ""} />
                <input name="dueDate" type="date" defaultValue={task.due_date ?? ""} />
                <button type="submit" disabled={isPending}>Save my edit</button>
              </form>
              {task.admin_change_state === "update_pending" ? <p>
                <button type="button" disabled={isPending} onClick={() => resolve(task.id, "keep")}>Keep my edit</button>
                <button type="button" disabled={isPending} onClick={() => resolve(task.id, "adopt")}>Use admin version</button>
              </p> : null}
              {task.admin_change_state === "removal_pending" ? <p>
                <button type="button" disabled={isPending} onClick={() => resolve(task.id, "manual")}>Keep as my task</button>
                <button type="button" disabled={isPending} onClick={() => resolve(task.id, "remove")}>Remove task</button>
              </p> : null}
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
