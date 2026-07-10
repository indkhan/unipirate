import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/components/app/theme-toggle";
import {
  getCourseById,
  listActiveCourseTaskDefinitions,
  listApplications,
  listTasks,
} from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";

import styles from "./course.module.css";
import { CourseTaskList } from "./course-task-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Course — UniPirate",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Only structured facts extracted from the official page are rendered here —
// never prose from the source. The source link is the primary action.
export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const db = await createClient();
  const course = await getCourseById(db, id);
  if (!course) notFound();
  if (course.review_status === "rejected") notFound();

  const deadlines = asStrings(course.deadlines);
  const requirements = asStrings(course.requirements);
  const tuition = typeof course.tuition === "string" ? course.tuition : null;
  const host = new URL(course.source_url).hostname;
  const definitions = await listActiveCourseTaskDefinitions(db, course.id);
  const { data: auth } = await db.auth.getUser();
  let myTasks: Awaited<ReturnType<typeof listTasks>> | null = null;
  if (auth.user) {
    const applications = await listApplications(db, auth.user.id);
    const application = applications.find((item) => item.course_id === course.id);
    if (application) {
      myTasks = (await listTasks(db, auth.user.id)).filter(
        (task) => task.application_id === application.id && task.course_task_definition_id !== null,
      );
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">
            UniPirate
          </Link>
          <div className={styles.headerActions}>
            <span className={styles.meta}>Course facts · from the source</span>
            <ThemeToggle />
          </div>
        </header>

        {course.review_status !== "approved" ? (
          <p className={styles.pendingBanner}>
            In review — only you can see this course until it is approved.
          </p>
        ) : null}

        <section className={styles.card}>
          <h1 className={styles.courseName}>
            {course.name ?? "Untitled course"}
          </h1>
          {course.university_name ? (
            <span className={styles.university}>{course.university_name}</span>
          ) : null}
          <div className={styles.factRow}>
            <span className={styles.factLabel}>Location</span>
            <span className={styles.factValue}>
              {course.location ?? "Not on the page"}
            </span>
          </div>
          <div className={styles.factRow}>
            <span className={styles.factLabel}>Degree</span>
            <span className={styles.factValue}>
              {course.degree ?? "Not on the page"}
            </span>
          </div>
          <div className={styles.factRow}>
            <span className={styles.factLabel}>Teaching language</span>
            <span className={styles.factValue}>
              {course.language ?? "Not on the page"}
            </span>
          </div>
          <div className={styles.factRow}>
            <span className={styles.factLabel}>Tuition per semester</span>
            <span className={styles.factValue}>
              {tuition ?? "Not on the page"}
            </span>
          </div>
        </section>

        {course.description ? (
          <details className={styles.descriptionDisclosure}>
            <summary className={styles.descriptionSummary}>
              <span className={styles.sectionLabel}>Description/content</span>
              <span className={styles.toggleText} aria-hidden="true" />
            </summary>
            <p className={styles.description}>{course.description}</p>
          </details>
        ) : null}

        <section className={styles.sourceCard}>
          <span className={styles.sectionLabel}>Official source</span>
          <a
            className={styles.sourceButton}
            href={course.source_url}
            target="_blank"
            rel="noreferrer"
          >
            View the official course page ↗
          </a>
          <div className={styles.sourceMeta}>
            <span>{host}</span>
            <span>Imported {formatDate(course.created_at)}</span>
          </div>
        </section>

        <section className={styles.card}>
          <span className={styles.sectionLabel}>Application deadlines</span>
          {deadlines.length === 0 ? (
            <p className={styles.emptyNote}>
              No deadlines were found on the page — confirm on the official
              course page above.
            </p>
          ) : (
            deadlines.map((line, i) => (
              <div key={i} className={styles.deadline}>
                {/\d/.test(line) ? (
                  <span className={styles.deadlineText}>
                    {line.replace(/^[:\s]+/, "")}
                  </span>
                ) : (
                  <span className={styles.deadlineHeader}>{line}</span>
                )}
              </div>
            ))
          )}
        </section>

        <section className={styles.card}>
          <span className={styles.sectionLabel}>Requirements</span>
          {requirements.length === 0 ? (
            <p className={styles.emptyNote}>
              No requirements were found on the page — confirm on the official
              course page above.
            </p>
          ) : (
            <ul className={styles.requirements}>
              {requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          )}
        </section>

        <CourseTaskList
          definitions={definitions}
          myTasks={myTasks}
          courseLabel={course.university_name ?? course.name ?? "this university"}
          styles={styles}
        />
      </div>
    </div>
  );
}
