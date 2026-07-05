/**
 * @startingPoint section="Feedback" subtitle="Progress meter and empty state" viewport="560x300"
 */
export interface ProgressMeterProps {
  /** Completed count. */
  value: number;
  /** Total count. */
  max: number;
  /** What is being counted: "Documents ready". */
  label: string;
}
