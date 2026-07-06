import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UserMenu } from "@/components/app/user-menu";
import { createClient } from "@/lib/db/server";
import { daysUntil } from "@/lib/tasks/generate";
import { syncDashboard } from "@/lib/tasks/sync";

import { DashboardViews } from "./dashboard-views";
import { RemoveCourseButton } from "./remove-course-button";
import styles from "./dashboard.module.css";
import { StatusSelect } from "./status-select";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your dashboard — UniPirate",
};

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function routeIndex(hasProfile: boolean, hasApplications: boolean): number {
  if (!hasProfile) return 0;
  if (!hasApplications) return 1;
  return 2;
}

function routeDots(index: number) {
  return ["Eligibility", "APS", "Applications", "Visa"].map((label, itemIndex) => (
    <div key={label} className={styles.routeStep}>
      <span
        className={`${styles.routeDot} ${
          itemIndex <= index ? styles.routeDotActive : ""
        }`}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  ));
}

export default async function DashboardPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const view = await syncDashboard(db, user.id);
  const route = routeIndex(view.hasProfile, view.rail.length > 0);

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.topbar}>
            <Link className={styles.brand} href="/">
              UniPirate
            </Link>
            <div className={styles.headerActions}>
              <Link className={styles.checkLink} href="/profile">
                Edit profile
              </Link>
              <UserMenu
                email={user.email ?? null}
                isAdmin={user.app_metadata?.role === "admin"}
              />
            </div>
          </div>

          <section className={styles.routeCard}>
            <div className={styles.routeLine}>{routeDots(route)}</div>
            <div className={styles.nextDeadlineLine}>
              <span>Next deadline</span>
              <span>
                {view.nextDeadline
                  ? `${view.nextDeadline.verbatim} · in ${view.nextDeadline.daysUntil} days`
                  : "No dated task yet"}
              </span>
            </div>
          </section>

          {!view.hasProfile ? (
            <Link className={styles.profilePrompt} href="/check">
              Finish eligibility check for global APS, visa, and blocked-account tasks.
            </Link>
          ) : null}
        </header>

        <div className={styles.dashboardGrid}>
          <main className={styles.mainColumn}>
            {view.empty ? (
              <section className={styles.empty}>
                <span className={styles.emptyDot} aria-hidden />
                <h2 className={styles.emptyTitle}>Add your first course</h2>
                <p className={styles.emptyText}>
                  Browse the courses other students already imported, or add any
                  DAAD or university course by its link.
                </p>
                <Link className={styles.submit} href="/courses">
                  Find courses
                </Link>
              </section>
            ) : view.allDone ? (
              <section className={styles.allDone}>
                <span className={styles.doneMark}>✓</span>
                <h2 className={styles.emptyTitle}>Nothing due today.</h2>
                <p className={styles.emptyText}>
                  {view.nextDeadline
                    ? `Your next deadline is in ${daysUntil(
                        view.nextDeadline.iso,
                        view.checkedAt,
                      )} days.`
                    : "Everything on the line is on time."}
                </p>
                <span className={styles.checkedLine}>
                  Checked against {view.universityCount} universities ·{" "}
                  {view.checkedAt}
                </span>
              </section>
            ) : (
              <DashboardViews
                buckets={view.buckets}
                calendarEvents={view.calendarEvents}
                todayIso={view.checkedAt}
              />
            )}
          </main>

          <section className={styles.rail}>
            <div className={styles.railHead}>
              <span className={styles.railLabel}>Your applications</span>
              <Link className={styles.addLink} href="/courses">
                + Find courses
              </Link>
            </div>
            {view.rail.length === 0 ? (
              <div className={styles.quietPanel}>No universities added yet.</div>
            ) : (
              <div className={styles.cards}>
                {view.rail.map((application) => (
                  <article key={application.id} className={styles.railCard}>
                    <div className={styles.cardHead}>
                      <Link
                        className={styles.cardName}
                        href={`/courses/${application.courseId}`}
                      >
                        {application.universityName}
                      </Link>
                      <RemoveCourseButton
                        courseId={application.courseId}
                        courseName={application.courseName}
                      />
                    </div>
                    <span className={styles.cardUni}>
                      {[application.courseName, application.detail]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <StatusSelect
                      applicationId={application.id}
                      status={application.status}
                    />
                    <div className={styles.cardFoot}>
                      <span className={styles.cardFootLabel}>Next deadline</span>
                      <span className={styles.deadline}>
                        {application.nextDeadline.verbatim ?? "Not on the page"}
                      </span>
                    </div>
                    <a
                      className={styles.sourceLink}
                      href={application.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {sourceHost(application.sourceUrl)} ↗
                    </a>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
