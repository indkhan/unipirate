import Link from "next/link";
import type { Tables } from "@/lib/db/database.types";
import { adminHref } from "./admin-state";
import { formatDateTime } from "./admin-shared";

export function OverviewPanel({ counts, events }: { counts: { pending: number; source: number; conflicts: number; stale: number; drafts: number; beta: number }; events: Tables<"admin_audit_events">[] }) {
  const cards = [
    ["Pending courses", counts.pending, adminHref({ view: "reviews", queue: "pending" })],
    ["Source changes", counts.source, adminHref({ view: "reviews", queue: "source-changes" })],
    ["Course conflicts", counts.conflicts, adminHref({ view: "reviews", queue: "conflicts" })],
    ["Stale rules", counts.stale, adminHref({ view: "rules", attention: "stale" })],
    ["Draft rules", counts.drafts, adminHref({ view: "rules", status: "draft" })],
    ["Beta rules", counts.beta, adminHref({ view: "rules", status: "beta" })],
  ] as const;
  return <section><div className="mb-5"><h2 className="text-xl font-bold">What needs attention</h2><p className="text-sm text-[var(--ink-secondary)]">Review official information before it reaches students.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, href]) => <Link key={label} href={href} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-[var(--route-blue)] focus-visible:outline-2 focus-visible:outline-[var(--route-blue)]"><span className="text-sm text-[var(--ink-secondary)]">{label}</span><strong className="mt-2 block text-3xl">{value}</strong><span className="mt-3 block text-sm font-semibold text-[var(--route-blue)]">Open queue →</span></Link>)}</div>
    <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><h3 className="font-bold">Recent activity</h3><Link className="text-sm font-semibold text-[var(--route-blue)]" href={adminHref({ view: "audit" })}>View all</Link></div><div className="mt-3 divide-y divide-[var(--line)]">{events.map(e => <div key={e.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span><strong>{e.action}</strong> on {e.table_name}</span><span className="text-[var(--ink-muted)]">{formatDateTime(e.created_at)}</span></div>)}{events.length === 0 && <p className="py-4 text-sm text-[var(--ink-muted)]">No admin activity yet.</p>}</div></div>
  </section>;
}
