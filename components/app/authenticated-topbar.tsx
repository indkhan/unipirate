import Link from "next/link";
import type { ReactNode } from "react";

import { AssistantSidebar } from "./assistant-sidebar";
import styles from "./authenticated-topbar.module.css";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type AuthenticatedTopbarProps = {
  email: string | null;
  isAdmin?: boolean;
  initialAssistantUsed: number;
  children?: ReactNode;
};

export function AuthenticatedTopbar({
  email,
  isAdmin = false,
  initialAssistantUsed,
  children,
}: AuthenticatedTopbarProps) {
  return (
    <div className={styles.topbar}>
      <Link className={styles.brand} href="/">
        UniPirate
      </Link>
      <div className={styles.actions}>
        {children}
        <AssistantSidebar initialUsed={initialAssistantUsed} />
        <ThemeToggle />
        <UserMenu email={email} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
