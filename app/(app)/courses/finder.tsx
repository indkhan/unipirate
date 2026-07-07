"use client";

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useMemo, useState, useTransition } from "react";

import { firstDeadline } from "@/lib/courses/import";
import type { Tables } from "@/lib/db/database.types";

import { addCourseToDashboard } from "./actions";
import { AddCourseSheet } from "./add-course-sheet";
import styles from "./finder.module.css";

type Course = Tables<"courses">;

function optionsFor(courses: Course[], key: "degree" | "language" | "location") {
  return [...new Set(courses.map((c) => c[key]).filter(Boolean))].sort() as string[];
}

export function Finder({
  courses,
  trackedIds,
}: {
  courses: Course[];
  trackedIds: string[];
}) {
  const posthog = usePostHog();
  const [query, setQuery] = useState("");
  const [degree, setDegree] = useState("");
  const [language, setLanguage] = useState("");
  const [location, setLocation] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const tracked = new Set([...trackedIds, ...added]);

  const filtered = useMemo(() => {
    // ponytail: client-side filter, move server-side when the catalog outgrows one fetch
    const q = query.trim().toLowerCase();
    return courses.filter(
      (c) =>
        (!q ||
          (c.name ?? "").toLowerCase().includes(q) ||
          (c.university_name ?? "").toLowerCase().includes(q)) &&
        (!degree || c.degree === degree) &&
        (!language || c.language === language) &&
        (!location || c.location === location),
    );
  }, [courses, query, degree, language, location]);

  function add(course: Course) {
    setPendingId(course.id);
    startTransition(async () => {
      try {
        await addCourseToDashboard(course.id);
        setAdded((ids) => [...ids, course.id]);
        posthog.capture("course_added_from_finder", { course_id: course.id });
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Course finder</h1>
        <p className={styles.subtitle}>
          Courses other students already imported and we reviewed. Add one to
          your dashboard with a click.
        </p>
      </div>

      <div className={styles.controls}>
        <input
          className={styles.search}
          type="search"
          placeholder="Search course or university…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.filters}>
          {(
            [
              ["Degree", degree, setDegree, optionsFor(courses, "degree")],
              ["Language", language, setLanguage, optionsFor(courses, "language")],
              ["City", location, setLocation, optionsFor(courses, "location")],
            ] as const
          ).map(([label, value, setValue, options]) => (
            <select
              key={label}
              className={styles.filter}
              aria-label={label}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="">{label}: all</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ))}
        </div>
        <span className={styles.count}>
          {filtered.length} of {courses.length} courses
        </span>
      </div>

      <div className={styles.grid}>
        {filtered.map((course) => {
          const deadline = firstDeadline(course.deadlines);
          const onDashboard = tracked.has(course.id);
          return (
            <article key={course.id} className={styles.courseCard}>
              <Link className={styles.cardName} href={`/courses/${course.id}`}>
                {course.name ?? "Untitled course"}
              </Link>
              <span className={styles.cardMeta}>
                {[course.university_name, course.location, course.degree]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <div className={styles.cardFoot}>
                <span className={styles.cardFootLabel}>Next deadline</span>
                <span className={styles.deadline}>
                  {deadline ?? "Not on the page"}
                </span>
              </div>
              <button
                className={styles.addButton}
                type="button"
                disabled={onDashboard || pendingId === course.id}
                onClick={() => add(course)}
              >
                {onDashboard
                  ? "On your dashboard"
                  : pendingId === course.id
                    ? "Adding…"
                    : "Add to my dashboard"}
              </button>
            </article>
          );
        })}
      </div>

      <div className={styles.footer}>
        <span className={styles.subtitle}>Can&apos;t find your course?</span>
        <AddCourseSheet />
      </div>
    </>
  );
}
