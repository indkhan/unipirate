/**
 * Validates a user-supplied `next` redirect target. Only same-origin paths
 * pass; anything absolute, protocol-relative, or malformed falls back to
 * /dashboard — this is what keeps login/confirm/callback free of open
 * redirects.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  try {
    const url = new URL(value, "https://unipirate.local");
    if (url.origin !== "https://unipirate.local") return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}

