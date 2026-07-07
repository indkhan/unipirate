import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AssistantSidebar } from "@/components/app/assistant-sidebar";
import { UserMenu } from "@/components/app/user-menu";
import { countTodayAssistantQuestions } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";
import { syncDashboard } from "@/lib/tasks/sync";

import { DashboardViews } from "./dashboard-views";
import { RemoveCourseButton } from "./remove-course-button";
import { dashboardRouteStations, type DashboardRouteStation } from "./route-line";
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

function routeDots(stations: DashboardRouteStation[]) {
  const routeStyle = {
    "--route-columns": stations.length,
  } as React.CSSProperties & Record<"--route-columns", number>;

  return (
    <div className={styles.routeLine} style={routeStyle}>
      {stations.map((station) => (
        <div key={station.label} className={styles.routeStep}>
          <span
            className={`${styles.routeDot} ${
              station.active ? styles.routeDotActive : ""
            }`}
            aria-hidden
          />
          <span>{station.label}</span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const view = await syncDashboard(db, user.id);
  const route = dashboardRouteStations({
    hasApplications: view.rail.length > 0,
    hasProfile: view.hasProfile,
    result: view.result,
  });
  const questionsUsed = await countTodayAssistantQuestions(db, user.id);
  const dashboardViewsKey = [
    ...view.buckets.now,
    ...view.buckets.next,
    ...view.buckets.later,
    ...view.doneTasks,
  ]
    .map((task) =>
      [
        task.id,
        task.title,
        task.done ? "done" : "pending",
        task.dueDate ?? "",
        task.preferredBucket ?? "",
      ].join(":"),
    )
    .join("|");

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.topbar}>
            <Link className={styles.brand} href="/">
              UniPirate
            </Link>
            <div className={styles.headerActions}>
              <AssistantSidebar initialUsed={questionsUsed} />
              <UserMenu
                email={user.email ?? null}
                isAdmin={user.app_metadata?.role === "admin"}
              />
            </div>
          </div>

          <section className={styles.routeCard}>
            {routeDots(route)}
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
            ) : null}
            <DashboardViews
              key={dashboardViewsKey}
              buckets={view.buckets}
              doneTasks={view.doneTasks}
              calendarEvents={view.calendarEvents}
              applications={view.rail}
              todayIso={view.checkedAt}
            />
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
