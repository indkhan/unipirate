import Link from "next/link";
import type { ReactNode } from "react";

import { AssistantSidebar } from "./assistant-sidebar";
import styles from "./authenticated-topbar.module.css";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { SuggestionNotifications } from "./suggestion-notifications";

type AuthenticatedTopbarProps = {
  email: string | null;
  isAdmin?: boolean;
  initialAssistantUsed: number;
  children?: ReactNode;
  hideSuggestionPopup?:boolean;
};

export function AuthenticatedTopbar({
  email,
  isAdmin = false,
  initialAssistantUsed,
  children,
  hideSuggestionPopup=false,
}: AuthenticatedTopbarProps) {
  return (
    <div className={styles.topbar}>
      <Link className={styles.brand} href="/dashboard">
        UniPirate
      </Link>
      <div className={styles.actions}>
        {children}
        {email&&!isAdmin?<SuggestionNotifications popup={!hideSuggestionPopup}/>:null}
        <AssistantSidebar initialUsed={initialAssistantUsed} />
        <ThemeToggle />
        <UserMenu email={email} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
