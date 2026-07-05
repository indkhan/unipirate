"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { claimResult } from "./actions";

export function ClaimOnReturn({ checkId }: { checkId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void claimResult(checkId).then((outcome) => {
      if (!active) return;
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      router.replace(`/result/${checkId}`);
      router.refresh();
    });
    return () => {
      active = false;
    };
  }, [checkId, router]);

  return <p role="status">{error ?? "Saving this path to your profile…"}</p>;
}

