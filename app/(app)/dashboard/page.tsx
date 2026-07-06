import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getMyCourses } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import type { Tables } from "@/lib/db/database.types";

import { AddCourseSheet } from "./add-course-sheet";
import styles from "./dashboard.module.css";
import { RemoveCourseButton } from "./remove-course-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your dashboard — UniPirate",
};

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function firstDeadline(course: Tables<"courses">): string | null {
  const deadlines = course.deadlines;
  if (!Array.isArray(deadlines)) return null;
  // Skip audience headers like "Non-EU students:" — show the first dated line.
  const line = deadlines.find((d) => typeof d === "string" && /\d/.test(d));
  return typeof line === "string" ? line.replace(/^[:\s]+/, "") : null;
}

const BADGE: Record<
  Tables<"courses">["review_status"],
  { label: string; className: string }
> = {
  pending: { label: "In review", className: "badgePending" },
  approved: { label: "Approved", className: "badgeApproved" },
  rejected: { label: "Rejected", className: "badgeRejected" },
};

export default async function DashboardPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const courses = await getMyCourses(db, user.id);
  const initials = (user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">
            UniPirate
          </Link>
          <div className={styles.headerActions}>
            <form action={signOut}>
              <button className={styles.signOut} type="submit">
                Sign out
              </button>
            </form>
            <span className={styles.avatar}>{initials}</span>
          </div>
        </header>

        {courses.length === 0 ? (
          <section className={styles.empty}>
            <span className={styles.emptyDot} aria-hidden />
            <h2 className={styles.emptyTitle}>Add your first course</h2>
            <p className={styles.emptyText}>
              Paste any DAAD or university course link plus the page text. We
              pull out the deadlines and requirements for you.
            </p>
            <AddCourseSheet variant="empty" />
          </section>
        ) : (
          <section className={styles.rail}>
            <div className={styles.railHead}>
              <span className={styles.railLabel}>Your courses</span>
              <AddCourseSheet variant="rail" />
            </div>
            <div className={styles.cards}>
              {courses.map((course) => {
                const badge = BADGE[course.review_status];
                const deadline = firstDeadline(course);
                const courseName = course.name ?? "Untitled course";
                const canOpenCourse = course.review_status !== "rejected";
                return (
                  <article key={course.id} className={styles.card}>
                    <div className={styles.cardHead}>
                      {canOpenCourse ? (
                        <Link
                          className={styles.cardName}
                          href={`/courses/${course.id}`}
                        >
                          {courseName}
                        </Link>
                      ) : (
                        <span className={styles.cardName}>{courseName}</span>
                      )}
                      <RemoveCourseButton
                        courseId={course.id}
                        courseName={courseName}
                      />
                    </div>
                    <span className={styles.cardUni}>
                      {[course.university_name, course.location, course.degree]
                        .filter(Boolean)
                        .join(" · ") || "Details pending review"}
                    </span>
                    <span className={`${styles.badge} ${styles[badge.className]}`}>
                      {badge.label}
                    </span>
                    <div className={styles.cardFoot}>
                      <span className={styles.cardFootLabel}>Next deadline</span>
                      <span className={styles.deadline}>
                        {deadline ?? "Not on the page"}
                      </span>
                    </div>
                    <a
                      className={styles.sourceLink}
                      href={course.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {new URL(course.source_url).hostname} ↗
                    </a>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
