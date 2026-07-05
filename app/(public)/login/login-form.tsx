"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/db/client";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);
    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);
    if (error) setMessage(error.message);
    else window.location.href = nextPath;
  }

  async function signUpWithPassword() {
    setIsLoading(true);
    setMessage(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
      },
    });
    setIsLoading(false);
    if (error) setMessage(error.message);
    else if (data.session) window.location.href = nextPath;
    else setMessage("Account created. Check your email to confirm your account.");
  }

  async function sendMagicLink() {
    setIsLoading(true);
    setMessage(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
      },
    });
    setIsLoading(false);
    setMessage(error ? error.message : "Check your email for a login link.");
  }

  return (
    <>
      <form
        onSubmit={signInWithPassword}
        className="flex w-full max-w-sm flex-col gap-3"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="rounded-md border px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="rounded-md border px-3 py-2"
        />
        <Button type="submit" disabled={isLoading}>
          Sign in
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={signUpWithPassword}
        >
          Create account
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={sendMagicLink}
        >
          Send magic link
        </Button>
      </form>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </>
  );
}

