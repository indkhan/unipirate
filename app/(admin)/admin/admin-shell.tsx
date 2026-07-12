import Link from "next/link";
import { ClipboardCheck, History, LayoutDashboard, ListChecks, ScrollText } from "lucide-react";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { adminHref, type AdminState } from "./admin-state";

export type AdminCounts = { reviews: number; staleRules: number; tasks: number };

const items = [
  ["overview", "Overview", LayoutDashboard],
  ["reviews", "Reviews", ClipboardCheck],
  ["rules", "Rules", ScrollText],
  ["tasks", "Course tasks", ListChecks],
  ["audit", "Audit history", History],
] as const;

export function AdminShell({ state, counts, children }: { state: AdminState; counts: AdminCounts; children: React.ReactNode }) {
  const count = (view: string) => view === "reviews" ? counts.reviews : view === "rules" ? counts.staleRules : view === "tasks" ? counts.tasks : 0;
  return <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
    <header className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-4 lg:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--route-blue)]">UniPirate operations</p><h1 className="font-heading text-2xl font-bold">Admin workspace</h1></div>
        <div className="flex items-center gap-2"><ThemeToggle /><Button asChild variant="outline"><Link href="/dashboard">Back to app</Link></Button></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:p-6">
      <nav aria-label="Admin workspace" className="flex gap-2 overflow-x-auto lg:sticky lg:top-6 lg:h-fit lg:flex-col">
        {items.map(([view, label, Icon]) => <Link key={view} href={adminHref({ view })} className={cn("flex min-h-12 shrink-0 items-center gap-3 rounded-lg border border-transparent px-3 text-sm font-semibold text-[var(--ink-secondary)] transition-colors hover:bg-[var(--route-blue-tint)] focus-visible:outline-2 focus-visible:outline-[var(--route-blue)]", state.view === view && "border-[var(--line)] bg-[var(--surface)] text-[var(--route-blue)] shadow-sm")}>
          <Icon aria-hidden className="size-4" /><span>{label}</span>{count(view) > 0 && <span className="ml-auto rounded-full bg-[var(--signal-tint)] px-2 py-0.5 text-xs text-[var(--signal)]">{count(view)}</span>}
        </Link>)}
      </nav>
      <div className="min-w-0">{state.message && <div role="status" className="mb-4 rounded-lg border border-[var(--verified-line)] bg-[var(--verified-tint)] px-4 py-3 text-sm text-[var(--verified)]">{state.message}</div>}{children}</div>
    </div>
  </main>;
}
