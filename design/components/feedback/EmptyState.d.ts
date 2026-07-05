export interface EmptyStateProps {
  /** What's empty, stated plainly: "No applications yet". */
  title: string;
  /** Reassuring next step, 1–2 sentences. */
  body?: string;
  /** One Button, usually secondary. */
  action?: React.ReactNode;
}
