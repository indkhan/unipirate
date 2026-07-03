"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/db/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/hello";
  }

  async function signUpWithPassword() {
    setIsLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/confirm` },
    });

    setIsLoading(false);
    setMessage(
      error
        ? error.message
        : "Account created. Check your email to confirm your account.",
    );
  }

  async function sendMagicLink() {
    setIsLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/confirm` },
    });

    setIsLoading(false);
    setMessage(error ? error.message : "Check your email for a login link.");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form
        onSubmit={signInWithPassword}
        className="flex w-full max-w-sm flex-col gap-3"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-md border px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
    </main>
  );
}
