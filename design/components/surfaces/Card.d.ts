export interface CardProps {
  /** Card title — Archivo, sentence case. Omit for plain containers. */
  title?: string;
  /** Optional right-aligned header element (a quiet Button, a chip). */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** CSS padding override; default var(--space-5). */
  padding?: string;
}
