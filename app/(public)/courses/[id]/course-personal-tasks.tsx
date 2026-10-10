"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask, toggleTask } from "@/app/(app)/dashboard/actions";
import { TaskActions } from "@/app/(app)/dashboard/manual-task";
import { addCourseToDashboard } from "@/app/(app)/courses/actions";
import type { DashboardTask } from "@/lib/tasks/view";
import styles from "./course.module.css";

export function CoursePersonalTasks({ courseId, applicationId, tasks, signedIn }: {
  courseId: string;
  applicationId: string | null;
  tasks: DashboardTask[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<{ content: string; id: string } | null>(null);
  function run(action: () => Promise<void>) {
    startTransition(async () => {
      setError(null);
      try { await action(); router.refresh(); }
      catch (error) { setError(error instanceof Error ? error.message : "Changes were not saved. Try again."); }
    });
  }
  function row(task: DashboardTask) {
    return <article key={task.id} className={styles.personalTask}>
      <div className={styles.personalTaskHead}>
        <button type="button" className={styles.personalToggle} disabled={pending}
          aria-label={task.done ? "Mark task not done" : "Mark task done"}
          onClick={() => run(() => toggleTask({ id: task.id, done: !task.done }))}>{task.done ? "✓" : ""}</button>
        <h3>{task.title}</h3>
      </div>
      {task.description ? <p className={styles.personalNotes}>{task.description}</p> : null}
      {task.dueDate ? <p className={styles.emptyNote}>Personal reminder date: {task.dueDate}</p> : null}
      {task.source ? <a href={task.source.url} target="_blank" rel="noreferrer">Personal source · unverified</a> : null}
      <TaskActions task={task} applications={[]} />
    </article>;
  }
  const completed = tasks.filter(task => task.done);
  return <section className={styles.card} aria-label="Personal tasks">
    <h2 className={styles.personalHeading}>Personal tasks</h2>
    <p className={styles.emptyNote}>Your reminders for this course, shared with your dashboard.</p>
    {error ? <p role="alert">{error}</p> : null}
    {!signedIn ? <Link href={`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`}>Sign in to add personal tasks</Link>
      : !applicationId ? <button className={styles.personalButton} disabled={pending} onClick={() => run(() => addCourseToDashboard(courseId))}>Add course to dashboard</button>
      : <>
        {tasks.filter(task => !task.done).map(row)}
        {completed.length ? <details className={styles.personalCompleted}><summary>Completed ({completed.length})</summary>{completed.map(row)}</details> : null}
        <form className={styles.personalForm} onSubmit={event => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const payload = { title: data.get("title"), description: data.get("description"), dueDate: data.get("dueDate"), sourceUrl: data.get("sourceUrl"), applicationId };
          const content = JSON.stringify(payload);
          if (operation.current?.content !== content) operation.current = { content, id: crypto.randomUUID() };
          const operationId = operation.current.id;
          run(async () => { await createTask({ ...payload, operationId }); form.reset(); operation.current = null; });
        }}>
          <label>Task title<input name="title" aria-label="Task title" required maxLength={240} placeholder="Prepare my documents" /></label>
          <label>Notes <span>(optional)</span><textarea name="description" aria-label="Task description" maxLength={2000} rows={3} /></label>
          <div className={styles.personalFields}>
            <label>Reminder date <span>(optional)</span><input name="dueDate" aria-label="Task due date" type="date" /></label>
            <label>Personal source <span>(optional)</span><input name="sourceUrl" aria-label="Task source URL" type="url" maxLength={2048} placeholder="https://" /></label>
          </div>
          <button className={styles.personalButton} type="submit" disabled={pending}>Add task</button>
        </form>
      </>}
  </section>;
}
