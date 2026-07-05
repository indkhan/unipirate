export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/hello";
  try {
    const url = new URL(value, "https://unipirate.local");
    if (url.origin !== "https://unipirate.local") return "/hello";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/hello";
  }
}

