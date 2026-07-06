import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getApprovedCourses, listApplications } from "@/lib/db/queries";
import { createClient } from "@/lib/db/server";

import styles from "../dashboard/dashboard.module.css";
import { Finder } from "./finder";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Course finder — UniPirate",
};

export default async function CourseFinderPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [courses, applications] = await Promise.all([
    getApprovedCourses(db),
    listApplications(db, user.id),
  ]);
  const trackedIds = applications.map((a) => a.course_id);

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">
            UniPirate
          </Link>
          <div className={styles.headerActions}>
            <Link className={styles.signOut} href="/dashboard">
              Dashboard
            </Link>
          </div>
        </header>
        <Finder courses={courses} trackedIds={trackedIds} />
      </div>
    </div>
  );
}
