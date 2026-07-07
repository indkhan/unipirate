"use client";

import {
  ArrowRight,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import { createClient } from "@/lib/db/client";

import styles from "./login.module.css";

type AuthMode = "signin" | "signup" | "magic" | "forgot" | "reset";
type MessageTone = "info" | "success" | "error";

const modeCopy: Record<AuthMode, { title: string; body: string; cta: string }> = {
  signin: {
    title: "Welcome back",
    body: "Open your dashboard, saved results, course tracker, and assistant.",
    cta: "Sign in",
  },
  signup: {
    title: "Create your account",
    body: "Save your eligibility route and keep your applications organized.",
    cta: "Create account",
  },
  magic: {
    title: "Send a magic link",
    body: "Get a one-click sign-in link in your email. No password needed.",
    cta: "Send magic link",
  },
  forgot: {
    title: "Reset your password",
    body: "We will send a secure link so you can choose a new password.",
    cta: "Send reset link",
  },
  reset: {
    title: "Choose a new password",
    body: "Set a fresh password for this account, then continue to UniPirate.",
    cta: "Update password",
  },
};

export function LoginForm({
  authError,
  initialMode,
  nextPath,
}: {
  authError: boolean;
  initialMode: AuthMode;
  nextPath: string;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(
    authError ? "That link could not be verified. Please try again." : null,
  );
  const [tone, setTone] = useState<MessageTone>(authError ? "error" : "info");
  const [isLoading, setIsLoading] = useState(false);

  const copy = modeCopy[mode];
  const showPassword = mode === "signin" || mode === "signup" || mode === "reset";
  const showConfirmPassword = mode === "signup" || mode === "reset";
  const showEmail = mode !== "reset";
  const safeNextPath = useMemo(
    () => (nextPath.startsWith("/login") ? "/dashboard" : nextPath),
    [nextPath],
  );

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage(null);
    setTone("info");
    setPassword("");
    setConfirmPassword("");
  }

  function validatePasswords() {
    if (!showPassword) return true;
    if (password.length < 6) {
      setTone("error");
      setMessage("Use at least 6 characters for your password.");
      return false;
    }
    if (showConfirmPassword && password !== confirmPassword) {
      setTone("error");
      setMessage("The passwords do not match yet.");
      return false;
    }
    return true;
  }

  function buildConfirmUrl(next = safeNextPath) {
    return `${location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validatePasswords()) return;

    setIsLoading(true);
    setMessage(null);
    setTone("info");
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      if (error) {
        setTone("error");
        setMessage(error.message);
        return;
      }
      window.location.href = safeNextPath;
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildConfirmUrl(safeNextPath),
        },
      });
      setIsLoading(false);
      if (error) {
        setTone("error");
        setMessage(error.message);
        return;
      }
      if (data.session) {
        window.location.href = safeNextPath;
        return;
      }
      setTone("success");
      setMessage("Account created. Check your email to confirm it.");
      return;
    }

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: buildConfirmUrl(safeNextPath),
        },
      });
      setIsLoading(false);
      setTone(error ? "error" : "success");
      setMessage(error ? error.message : "Check your email for your magic link.");
      return;
    }

    if (mode === "forgot") {
      const resetNext = `/login?mode=reset&next=${encodeURIComponent(safeNextPath)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: buildConfirmUrl(resetNext),
      });
      setIsLoading(false);
      setTone(error ? "error" : "success");
      setMessage(
        error
          ? error.message
          : "Check your email for a password reset link. It will bring you back here.",
      );
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      setTone("error");
      setMessage(error.message);
      return;
    }
    setTone("success");
    setMessage("Password updated. Taking you to your dashboard.");
    window.setTimeout(() => {
      window.location.href = safeNextPath;
    }, 500);
  }

  async function continueWithGoogle() {
    setIsLoading(true);
    setMessage(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(safeNextPath)}`,
      },
    });
    if (error) {
      setTone("error");
      setMessage(error.message);
      setIsLoading(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="auth-title">
      <div className={styles.panelHeader}>
        <p className={styles.panelTopline}>Account access</p>
        <h2 id="auth-title">{copy.title}</h2>
        <p>{copy.body}</p>
      </div>

      {mode !== "reset" && (
        <>
          <div className={styles.modeSwitcher} aria-label="Choose sign-in method">
            <button
              aria-pressed={mode === "signin"}
              className={styles.modeButton}
              disabled={isLoading}
              onClick={() => switchMode("signin")}
              type="button"
            >
              Sign in
            </button>
            <button
              aria-pressed={mode === "signup"}
              className={styles.modeButton}
              disabled={isLoading}
              onClick={() => switchMode("signup")}
              type="button"
            >
              Sign up
            </button>
            <button
              aria-pressed={mode === "magic"}
              className={styles.modeButton}
              disabled={isLoading}
              onClick={() => switchMode("magic")}
              type="button"
            >
              Magic link
            </button>
          </div>

          <button
            className={styles.oauthButton}
            disabled={isLoading}
            onClick={continueWithGoogle}
            type="button"
          >
            <ShieldCheck aria-hidden="true" />
            Continue with Google
          </button>

          <div className={styles.divider}>or use email</div>
        </>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        {showEmail && (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <span className={styles.inputWrap}>
              <Mail aria-hidden="true" className={styles.inputIcon} />
              <input
                autoComplete="email"
                className={styles.input}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </span>
          </label>
        )}

        {showPassword && (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {mode === "reset" ? "New password" : "Password"}
            </span>
            <span className={styles.inputWrap}>
              <Lock aria-hidden="true" className={styles.inputIcon} />
              <input
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className={styles.input}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
                type="password"
                value={password}
              />
            </span>
          </label>
        )}

        {showConfirmPassword && (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Confirm password</span>
            <span className={styles.inputWrap}>
              <KeyRound aria-hidden="true" className={styles.inputIcon} />
              <input
                autoComplete="new-password"
                className={styles.input}
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Type it again"
                required
                type="password"
                value={confirmPassword}
              />
            </span>
          </label>
        )}

        <div className={styles.formMeta}>
          <p className={styles.hint}>
            {mode === "signin"
              ? "Use the same email you used to save your checker result."
              : "Supabase sends the email. Delivery depends on your auth setup."}
          </p>
          {mode === "signin" && (
            <button
              className={styles.linkButton}
              disabled={isLoading}
              onClick={() => switchMode("forgot")}
              type="button"
            >
              Forgot password?
            </button>
          )}
        </div>

        <button className={styles.primaryButton} disabled={isLoading} type="submit">
          {isLoading ? "Working..." : copy.cta}
          {!isLoading && <ArrowRight aria-hidden="true" />}
        </button>

        {mode === "forgot" && (
          <button
            className={styles.secondaryButton}
            disabled={isLoading}
            onClick={() => switchMode("signin")}
            type="button"
          >
            Back to sign in
          </button>
        )}
      </form>

      {message && (
        <p className={styles.message} data-tone={tone} role="status">
          {message}
        </p>
      )}

      <div className={styles.helper}>
        <p className={styles.helperTitle}>What gets saved</p>
        <p>
          Your profile answers, claimed results, course list, generated tasks,
          and assistant history stay in your account.
        </p>
      </div>
    </section>
  );
}
