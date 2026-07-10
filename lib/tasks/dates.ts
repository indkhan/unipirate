/** Today's date as an ISO `YYYY-MM-DD` string in the Berlin timezone.
 * All deadline math is anchored to German local time. */
export function todayIsoBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
