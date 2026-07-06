"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { removeCourse } from "./actions";
import styles from "./dashboard.module.css";

type RemoveCourseButtonProps = {
  courseId: string;
  courseName: string;
};

export function RemoveCourseButton({
  courseId,
  courseName,
}: RemoveCourseButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={styles.removeCourse}
      type="button"
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm(
          `Remove "${courseName}" from your dashboard?`,
        );
        if (!confirmed) return;

        startTransition(async () => {
          await removeCourse({ id: courseId });
          router.refresh();
        });
      }}
    >
      {isPending ? "Removing..." : "Remove"}
    </button>
  );
}
