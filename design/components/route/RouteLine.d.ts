/**
 * @startingPoint section="Route" subtitle="The signature transit-line journey with a you-are-here marker" viewport="700x160"
 */
export interface RouteLineProps {
  /** Station labels in journey order; strings or { label, sub } (sub renders only in vertical). Default: Eligibility → APS → Applications → Visa → Germany. */
  stations?: Array<string | { label: string; sub?: string }>;
  /** Index of the station the student is at. Earlier = done (blue + check), later = upcoming (hollow). */
  currentIndex?: number;
  /** horizontal on desktop, vertical on mobile. */
  orientation?: 'horizontal' | 'vertical';
  /** Marker caption; default "You are here". */
  hereLabel?: string;
}
