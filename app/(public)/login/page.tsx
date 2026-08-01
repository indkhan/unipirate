import { redirect } from "next/navigation";
import Link from "next/link";

import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/db/server";
import { ThemeToggle } from "@/components/app/theme-toggle";

import { LoginForm } from "./login-form";
import styles from "./login.module.css";

const supportedModes = ["signin", "signup", "magic", "forgot", "reset"] as const;
type AuthMode = (typeof supportedModes)[number];

function modeFromSearchParam(value: string | undefined): AuthMode {
  return supportedModes.includes(value as AuthMode) ? (value as AuthMode) : "signin";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const initialMode = modeFromSearchParam(params.mode);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (user && initialMode !== "reset") {
    redirect(nextPath.startsWith("/login") ? "/dashboard" : nextPath);
  }

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link className={styles.brand} href="/">
            UniPirate
          </Link>
          <div className={styles.navActions}>
            <Link className={styles.navLink} href="/check">
              Check eligibility
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className={styles.shell}>
        <div className={styles.story}>
          <p className={styles.eyebrow}>Your application command center</p>
          <h1>Save your Germany route and keep every next step in one place.</h1>
          <p>
            Sign in to claim checker results, track course deadlines, and ask
            UniPirate questions with sources attached.
          </p>
          <div className={styles.routePreview} aria-label="Saved application route">
            <span className={styles.activeDot} />
            <span className={styles.routeLine} />
            <span className={styles.routeDot} />
            <span className={styles.routeLine} />
            <span className={styles.routeDot} />
          </div>
          <div className={styles.trustGrid}>
            <article>
              <span>Source-first</span>
              <p>Eligibility claims stay tied to official URLs and review dates.</p>
            </article>
            <article>
              <span>No lock-in</span>
              <p>Your account stores the path; you still apply directly yourself.</p>
            </article>
          </div>
        </div>

        <LoginForm
          authError={params.error ?? null}
          initialMode={initialMode}
          nextPath={nextPath}
        />
      </section>
    </main>
  );
}
