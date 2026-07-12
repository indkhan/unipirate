import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { getCountries } from "@/lib/db/queries";
import {
  getAdminCourse, getAdminRule, listAdminCourses, listAdminCourseTaskDefinitions,
  listAdminRules, listConflictCourses, listPendingCourses,
  listPendingCourseTaskSourceReviews, listRecentAdminAuditEvents,
} from "@/lib/db/admin-queries";

import { AdminShell } from "./admin-shell";
import { adminHref, parseAdminState } from "./admin-state";
import { AuditLog } from "./audit-log";
import { ConflictQueue, CourseQueue, CourseTaskLibrary, CourseTaskSourceReviewQueue } from "./course-queue";
import { OverviewPanel } from "./overview-panel";
import { RuleEditor, RulesTable } from "./rules-panel";

export const dynamic = "force-dynamic";
type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
const stale = (date: string | null) => !date || Date.now() - new Date(date).getTime() > 1000 * 60 * 60 * 24 * 183;

export default async function AdminPage({ searchParams }: Props) {
  const state = parseAdminState((await searchParams) ?? {});
  const { db } = await requireAdmin();
  const [allRules, pending, conflicts, sourceReviews, courses] = await Promise.all([
    listAdminRules(db, {}), listPendingCourses(db), listConflictCourses(db),
    listPendingCourseTaskSourceReviews(db), listAdminCourses(db),
  ]);
  const staleRules = allRules.filter(rule => stale(rule.last_verified_at));
  const counts = { reviews: pending.length + conflicts.length + sourceReviews.length, staleRules: staleRules.length, tasks: courses.filter(c => c.review_status === "approved").length };
  let content: React.ReactNode;

  if (state.view === "overview") {
    const events = await listRecentAdminAuditEvents(db, 5);
    content = <OverviewPanel counts={{ pending: pending.length, source: sourceReviews.length, conflicts: conflicts.length, stale: staleRules.length, drafts: allRules.filter(r => r.status === "draft").length, beta: allRules.filter(r => r.status === "beta").length }} events={events} />;
  } else if (state.view === "reviews") {
    const tabs = [["pending", "Pending courses", pending.length], ["source-changes", "Source changes", sourceReviews.length], ["conflicts", "Conflicts", conflicts.length]] as const;
    let panel: React.ReactNode;
    if (state.queue === "source-changes") panel = <CourseTaskSourceReviewQueue reviews={sourceReviews} />;
    else if (state.queue === "conflicts") panel = <ConflictQueue conflicts={state.course ? conflicts.filter(c => c.id === state.course) : conflicts} />;
    else {
      const selected = state.course ? pending.find(c => c.id === state.course) : pending[0];
      const defs = selected ? await listAdminCourseTaskDefinitions(db, selected.id) : [];
      panel = <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]"><div className="grid h-fit gap-2">{pending.map(course => <Link key={course.id} href={adminHref({ view: "reviews", queue: "pending", course: course.id })} className="rounded-lg border bg-card p-3 text-sm hover:border-[var(--route-blue)] focus-visible:outline-2 focus-visible:outline-[var(--route-blue)]"><strong className="block truncate">{course.name ?? "Untitled course"}</strong><span className="block truncate text-muted-foreground">{course.university_name ?? "University unknown"}</span><span className="mt-2 block text-xs text-[var(--signal)]">{course.extraction_method ?? "Unknown extraction"}</span></Link>)}</div><CourseQueue courses={selected ? [selected] : []} definitionsByCourse={new Map(selected ? [[selected.id, defs]] : [])} /></div>;
    }
    content = <Workspace title="Course reviews" description="Verify imported facts and resolve official source changes."><div className="mb-4 flex gap-2 overflow-x-auto">{tabs.map(([queue,label,n]) => <Button key={queue} asChild variant={state.queue === queue ? "default" : "outline"}><Link href={adminHref({ view: "reviews", queue })}>{label} · {n}</Link></Button>)}</div>{panel}</Workspace>;
  } else if (state.view === "rules") {
    const countries = await getCountries(db);
    const needle = state.q?.toLowerCase();
    const filtered = allRules.filter(r => (!state.status || r.status === state.status) && (!state.country || r.country_code === state.country) && (state.attention !== "stale" || stale(r.last_verified_at)) && (!needle || `${r.slug} ${r.country_code} ${r.source_url}`.toLowerCase().includes(needle)));
    const selected = state.rule ? await getAdminRule(db, state.rule) : undefined;
    content = <Workspace title="Eligibility rules" description="Find, edit, and verify deterministic eligibility rules."><form className="mb-4 grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-[1fr_180px_150px_120px_auto]"><input type="hidden" name="view" value="rules" /><input name="q" defaultValue={state.q} placeholder="Search slug or source" className="h-10 rounded-md border bg-background px-3" /><select name="country" defaultValue={state.country ?? ""} className="h-10 rounded-md border bg-background px-2"><option value="">All countries</option>{countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select><select name="status" defaultValue={state.status ?? ""} className="h-10 rounded-md border bg-background px-2"><option value="">All statuses</option><option>draft</option><option>beta</option><option>verified</option></select><select name="attention" defaultValue={state.attention ?? "all"} className="h-10 rounded-md border bg-background px-2"><option value="all">All</option><option value="stale">Stale</option></select><Button type="submit">Filter</Button></form><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px]"><RulesTable rules={filtered} selectedRuleId={state.rule} /><RuleEditor rule={selected} countries={countries} /></div></Workspace>;
  } else if (state.view === "tasks") {
    const approved = courses.filter(c => c.review_status === "approved" && (!state.q || `${c.name} ${c.university_name}`.toLowerCase().includes(state.q.toLowerCase())));
    const selected = state.course ? await getAdminCourse(db, state.course) : approved[0];
    const defs = selected ? await listAdminCourseTaskDefinitions(db, selected.id) : [];
    content = <Workspace title="Course task library" description="Task changes can update students planning the selected course."><form className="mb-4 flex gap-2"><input type="hidden" name="view" value="tasks" /><input name="q" defaultValue={state.q} placeholder="Search course or university" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3" /><Button type="submit">Search</Button></form><div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]"><div className="grid h-fit gap-2">{approved.map(c => <Link key={c.id} className="rounded-lg border bg-card p-3 text-sm hover:border-[var(--route-blue)]" href={adminHref({ view: "tasks", course: c.id, q: state.q })}><strong className="block">{c.name ?? "Untitled course"}</strong><span className="text-muted-foreground">{c.university_name ?? "University unknown"}</span></Link>)}</div><CourseTaskLibrary courses={selected ? [selected] : []} definitionsByCourse={new Map(selected ? [[selected.id, defs]] : [])} /></div></Workspace>;
  } else {
    const events = await listRecentAdminAuditEvents(db, 100);
    content = <Workspace title="Audit history" description="A chronological record of consequential admin changes."><AuditLog events={events} /></Workspace>;
  }
  return <AdminShell state={state} counts={counts}>{content}</AdminShell>;
}

function Workspace({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section><div className="mb-5"><h2 className="text-xl font-bold">{title}</h2><p className="text-sm text-[var(--ink-secondary)]">{description}</p></div>{children}</section>;
}
