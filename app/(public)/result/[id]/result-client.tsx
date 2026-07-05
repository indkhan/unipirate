"use client";

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

import styles from "./result.module.css";
import type { ViewerVariant } from "./result-model";

type AnalyticsProps = {
  checkId: string;
  viewer: ViewerVariant;
  country: string | null;
  path: string;
};

export function ResultAnalytics({
  checkId,
  viewer,
  country,
  path,
}: AnalyticsProps) {
  const posthog = usePostHog();

  useEffect(() => {
    const key = `unipirate-result-viewed:${checkId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    posthog.capture("result_viewed", {
      check_id: checkId,
      viewer,
      country,
      path,
    });
  }, [checkId, country, path, posthog, viewer]);

  return null;
}

export function ShareControls({ checkId }: { checkId: string }) {
  const posthog = usePostHog();
  const [copied, setCopied] = useState(false);

  function shareUrl() {
    return `${window.location.origin}/result/${checkId}`;
  }

  function capture(channel: "copy" | "whatsapp" | "telegram") {
    posthog.capture("result_shared", { check_id: checkId, channel });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl());
    capture("copy");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function openShare(channel: "whatsapp" | "telegram") {
    const url = shareUrl();
    const destination =
      channel === "whatsapp"
        ? `https://wa.me/?text=${encodeURIComponent(`My path to a German public university: ${url}`)}`
        : `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("My path to a German public university")}`;
    capture(channel);
    window.open(destination, "_blank", "noopener,noreferrer");
  }

  return (
    <section className={styles.share} aria-label="Share this result">
      <button type="button" onClick={copyLink}>
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      <button type="button" onClick={() => openShare("whatsapp")}>
        WhatsApp
      </button>
      <button type="button" onClick={() => openShare("telegram")}>
        Telegram
      </button>
    </section>
  );
}

export function SignupResultLink({
  checkId,
  href,
  children,
}: {
  checkId: string;
  href: string;
  children: React.ReactNode;
}) {
  const posthog = usePostHog();
  return (
    <Link
      className={styles.primaryAction}
      href={href}
      onClick={() =>
        posthog.capture("signup_from_result", { check_id: checkId })
      }
    >
      {children}
    </Link>
  );
}

