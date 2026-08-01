import { z } from "zod";

export const AdminViewSchema = z.enum(["overview", "reviews", "rules", "tasks", "audit"]);
export const ReviewQueueSchema = z.enum(["pending", "conflicts"]);

const uuid = z.string().uuid();
const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export type AdminState = {
  view: z.infer<typeof AdminViewSchema>;
  queue: z.infer<typeof ReviewQueueSchema>;
  course?: string;
  rule?: string;
  country?: string;
  status?: "draft" | "beta" | "verified";
  attention?: "all" | "stale";
  state?: "active" | "retired" | "all";
  q?: string;
  message?: string;
};

export function parseAdminState(params: Record<string, string | string[] | undefined>): AdminState {
  const view = AdminViewSchema.catch("overview").parse(single(params.view));
  const queue = ReviewQueueSchema.catch("pending").parse(single(params.queue));
  const course = uuid.safeParse(single(params.course));
  const rule = uuid.safeParse(single(params.rule));
  const status = z.enum(["draft", "beta", "verified"]).safeParse(single(params.status));
  const attention = z.enum(["all", "stale"]).safeParse(single(params.attention));
  const state = z.enum(["active", "retired", "all"]).safeParse(single(params.state));
  const q = z.string().trim().max(120).safeParse(single(params.q));
  const message = z.string().trim().max(160).safeParse(single(params.message));
  return {
    view,
    queue,
    ...(course.success ? { course: course.data } : {}),
    ...(rule.success ? { rule: rule.data } : {}),
    ...(status.success ? { status: status.data } : {}),
    ...(attention.success ? { attention: attention.data } : {}),
    ...(state.success ? { state: state.data } : {}),
    ...(q.success && q.data ? { q: q.data } : {}),
    ...(message.success && message.data ? { message: message.data } : {}),
  };
}

export function adminHref(values: Partial<AdminState>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  return `/admin${query.size ? `?${query}` : ""}`;
}
