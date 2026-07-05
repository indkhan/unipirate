export interface VerifiedStampProps {
  /** Citation, e.g. "uni-assist FAQ §2.1" or "DAAD.de". Renders as a dotted-underline link. */
  source?: string;
  /** Last-verified date, DD MMM YYYY, e.g. "12 Jun 2026". */
  date?: string;
  /** Link to the source document. */
  href?: string;
  /** chip = inline (default, most uses); stamp = block seal with a slight rotation, for hero/marketing moments. */
  variant?: 'chip' | 'stamp';
}
