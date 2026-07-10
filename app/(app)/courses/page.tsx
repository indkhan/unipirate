import type { Metadata } from "next";

import { AuthenticatedTopbar } from "@/components/app/authenticated-topbar";
import { requireUser } from "@/lib/auth/session";
import {
  countTodayAssistantQuestions,
  getApprovedCourses,
  listApplications,
} from "@/lib/db/queries";

import styles from "../dashboard/dashboard.module.css";
import { AddCourseSheet } from "./add-course-sheet";
import { Finder } from "./finder";
import finderStyles from "./finder.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Course finder — UniPirate",
};

export default async function CourseFinderPage() {
  const { db, user } = await requireUser("/courses");

  const [courses, applications, questionsUsed] = await Promise.all([
    getApprovedCourses(db),
    listApplications(db, user.id),
    countTodayAssistantQuestions(db, user.id),
  ]);
  const trackedIds = applications.map((a) => a.course_id);

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <header className={styles.header}>
          <AuthenticatedTopbar
            email={user.email ?? null}
            isAdmin={user.app_metadata?.role === "admin"}
            initialAssistantUsed={questionsUsed}
          >
            <AddCourseSheet
              trackedIds={trackedIds}
              triggerLabel="Add course"
              triggerClassName={finderStyles.navAddButton}
            />
          </AuthenticatedTopbar>
        </header>
        <Finder courses={courses} trackedIds={trackedIds} />
      </div>
    </div>
  );
}
