export interface DeadlineChipProps {
  /** DD MMM YYYY, e.g. "15 Jul 2026". Always mono. */
  date: string;
  /** Days until deadline. ≤14 shows countdown; negative flips the chip to Overdue (danger red). */
  daysLeft?: number;
  /** Uppercase mono label; default "Deadline". */
  label?: string;
}
