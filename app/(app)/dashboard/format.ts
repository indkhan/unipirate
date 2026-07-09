/** Render an ISO `YYYY-MM-DD` date as `DD.MM.YYYY`, or "No date" when null. */
export function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}
