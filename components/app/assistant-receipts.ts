import { TaskReceiptSchema, type TaskReceipt } from "@/lib/tasks/manual";

// Receipts are scoped to one assistant response; another request's failure
// must never be hidden by a previously saved task.
export function responseTaskReceipts(parts: readonly unknown[]): TaskReceipt[] {
  const failures: TaskReceipt[] = [];
  const confirmed = new Map<string, Exclude<TaskReceipt, { status: "failed" }>>();
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const value = part as { type?: string; state?: string; output?: unknown; data?: unknown };
    if (value.type !== "data-task-receipt" && !(value.type === "tool-create_task" && value.state === "output-available")) continue;
    const parsed = TaskReceiptSchema.safeParse(value.type === "data-task-receipt" ? value.data : value.output);
    if (!parsed.success) continue;
    const receipt = parsed.data;
    if (receipt.status === "failed") failures.push(receipt);
    else {
      const previous = confirmed.get(receipt.task.id);
      if (!previous || (previous.status === "already_exists" && receipt.status === "created")) confirmed.set(receipt.task.id, receipt);
    }
  }
  return confirmed.size ? [...confirmed.values()] : failures;
}
