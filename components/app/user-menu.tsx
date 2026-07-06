"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { createClient } from "@/lib/db/client";

import styles from "./user-menu.module.css";

type UserMenuProps = {
  email: string | null;
  isAdmin?: boolean;
};

function initials(email: string | null): string {
  return (email ?? "?").slice(0, 2).toUpperCase();
}

export function UserMenu({ email, isAdmin = false }: UserMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className={styles.wrap}>
      <details className={styles.menu}>
        <summary className={styles.summary} aria-label="Open profile menu">
          {initials(email)}
        </summary>
        <div className={styles.panel}>
          <span className={styles.email}>{email ?? "Signed in"}</span>
          <Link className={styles.link} href="/dashboard">
            Dashboard
          </Link>
          <Link className={styles.link} href="/profile">
            Profile
          </Link>
          <Link className={styles.link} href="/check">
            New eligibility check
          </Link>
          {isAdmin ? (
            <Link className={styles.link} href="/admin">
              Admin
            </Link>
          ) : null}
          <button
            className={styles.button}
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await createClient().auth.signOut();
                router.push("/login");
                router.refresh();
              });
            }}
          >
            {isPending ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </details>
    </div>
  );
}
