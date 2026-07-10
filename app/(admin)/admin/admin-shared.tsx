/** Shared presentational helpers for the admin panels. */

export function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function statusBadge(status: string) {
  return (
    <span className="inline-flex rounded-md border bg-muted px-1.5 py-0.5 text-xs font-medium">
      {status}
    </span>
  );
}
