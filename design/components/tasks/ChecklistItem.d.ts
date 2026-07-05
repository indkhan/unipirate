/**
 * @startingPoint section="Tasks" subtitle="Checklist item with deadline chip and verified stamp slots" viewport="560x260"
 */
export interface ChecklistItemProps {
  /** Task, imperative sentence case: "Get your transcripts attested". */
  label: string;
  /** One line of supporting context. */
  detail?: string;
  checked?: boolean;
  onToggle?: () => void;
  /** Slot for a <DeadlineChip>. */
  deadline?: React.ReactNode;
  /** Slot for a <VerifiedStamp>. */
  verified?: React.ReactNode;
}
