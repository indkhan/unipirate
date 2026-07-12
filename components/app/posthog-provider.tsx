"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

import { getClientEnv } from "@/lib/env";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const env = getClientEnv();
    if (!env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      // Enables automatic pageview + pageleave capture, incl. SPA navigations.
      defaults: "2025-05-24",
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
