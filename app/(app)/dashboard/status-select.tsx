"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setApplicationStatus } from "./actions";
import styles from "./dashboard.module.css";

const LABELS = {
  planning: "Preparing docs",
  applied: "Submitted",
  admitted: "Admitted",
  rejected: "Rejected",
} as const;

type Status = keyof typeof LABELS;

export function StatusSelect({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const value = ["planning", "applied", "admitted", "rejected"].includes(status)
    ? (status as Status)
    : "planning";

  return (
    <select
      className={`${styles.statusSelect} ${styles[`status_${value}`]}`}
      value={value}
      disabled={isPending}
      aria-label="Application status"
      onChange={(event) => {
        const next = event.target.value as Status;
        startTransition(async () => {
          await setApplicationStatus({ id: applicationId, status: next });
          router.refresh();
        });
      }}
    >
      {Object.entries(LABELS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
