import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database, Json } from "../database.types";
import { insertCourse, getApplicationOfferingCatalogue, ensureApplication, setApplicationOfferingSelection, listTasks, insertTask } from "../queries";
import { publishAdminCourseResearch, listAdminCourseResearchHistory } from "../admin-queries";
import { buildResearchDraft } from "@/lib/courses/research";
import { resolveOfferingProcess } from "@/lib/tasks/offering-process";
import { materializeCourseTasksForApplication } from "@/lib/tasks/materialize";
import { buildDashboardView } from "@/lib/tasks/view";
import { courseProcessLocalConfig } from "./course-process-local-config";

// Explicit opt-in, disposable local database only. No linked project or provider I/O.
const { api, publicKey, serviceKey, enabled } = courseProcessLocalConfig(process.env);
describe.skipIf(!enabled)("protected research publication → application planner (actual local RLS)", () => {
  it.each(["direct", "uni_assist", "vpd_then_university"] as const)("consumes the published %s producer contract and preserves personal history", async route => {
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const provisioner = createClient<Database>(api!, serviceKey!, options);
    const admin = createClient<Database>(api!, publicKey!, options);
    const student = createClient<Database>(api!, publicKey!, options);
    const actors: string[] = [];
    try {
      for (const [client, role] of [[admin, "admin"], [student, "student"]] as const) {
        const email = `course-process-${randomUUID()}@example.invalid`, password = randomUUID() + "Aa1!";
        const created = await provisioner.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } });
        expect(created.error).toBeNull(); actors.push(created.data.user!.id);
        expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
      }
      const url = `https://www.daad.de/SYNTHETIC-process-${randomUUID()}`;
      const name = "Synthetic process contract", university = "Synthetic university", group = "Non-EU applicants";
      const scope = "Winter 2027 Non-EU applicants";
      const portal = "https://example.invalid/SYNTHETIC-portal";
      const stage = route === "direct" ? "university" : "uniassist";
      const wording = stage === "university" ? "University application" : "uni-assist application";
      const entries = [
        { key: "route", kind: "route", verbatim: `Synthetic application route ${route}.`, route, deadline_kind: null, quote: `Synthetic application route ${route}.` },
        { key: `application_link:${stage}`, kind: "description", verbatim: portal, route: null, deadline_kind: null, quote: `${wording} portal ${portal}` },
        { key: `deadline:${stage}:application_closing`, kind: "deadline", verbatim: `${wording} closes 15 July 2027.`, route: null, deadline_kind: "application_closing", quote: `${wording} closes 15 July 2027.` },
        ...(route === "vpd_then_university" ? [
          { key: "application_link:vpd", kind: "description", verbatim: portal + "/vpd", route: null, deadline_kind: null, quote: `VPD portal ${portal}/vpd` },
          { key: "deadline:vpd:vpd_preparation_target", kind: "deadline", verbatim: "VPD preparation target 1 June 2027.", route: null, deadline_kind: "vpd_preparation_target", quote: "VPD preparation target 1 June 2027." },
          { key: "application_link:university", kind: "description", verbatim: portal + "/university", route: null, deadline_kind: null, quote: `University application portal ${portal}/university` },
          { key: "deadline:university:application_closing", kind: "deadline", verbatim: "University application closes 1 August 2027.", route: null, deadline_kind: "application_closing", quote: "University application closes 1 August 2027." },
        ] : []),
      ];
      const content = [name, university, scope, ...entries.map(e => e.quote)].join("\n\n");
      const draft = buildResearchDraft({ url, name, university, text: content.padEnd(200, " ") }, [{ url, content, origin: "web", retrieved_at: "2026-10-07T00:00:00Z" }], {
        offerings: [{ intake_term: "winter", intake_year: 2027, applicant_group: group, scope: { source_url: url, source_quote: scope }, facts: entries.map(({ quote, ...e }) => ({ ...e, applicability: group, evidence: [{ source_url: url, source_quote: quote }] })) }],
      }, []);
      expect(draft.offerings).toHaveLength(1);
      const course = await insertCourse(student, { imported_by: actors[1], source_url: url, normalized_url: url, name, university_name: university, field_extraction: { research: draft } as unknown as Json });
      expect((await getApplicationOfferingCatalogue(student, course.id, null)).programme).toBeNull();
      const accepted = entries.map(e => "0:" + e.key);
      await publishAdminCourseResearch(admin, course.id, accepted, actors[0], accepted.map(key => ({ key, reason: "Synthetic local fixture: compared complete literal captures and exact intake/applicant scope." })));
      expect((await listAdminCourseResearchHistory(admin, course.id)).every(r => r.status === "available")).toBe(true);
      const initial = await getApplicationOfferingCatalogue(student, course.id, null);
      const offering = initial.offerings[0];
      expect(offering.applicability).toEqual({ source_scope: scope });
      const catalogue = await getApplicationOfferingCatalogue(student, course.id, offering.id);
      expect(catalogue.versions[0].facts.filter(f => f.status === "verified").every(f => f.date === null)).toBe(true);
      const selection = { offering_id: offering.id, applicant_context: { applicant_group: group, confirmed: true } };
      const plan = resolveOfferingProcess({ ...catalogue, courseId: course.id, selection });
      expect(plan.route).toBe(route);
      const expectedStages = route === "direct" ? ["university_submission"] : route === "uni_assist" ? ["uni_assist_submission"] : ["vpd_request", "university_submission"];
      expect(plan.stages.map(s => s.kind)).toEqual(expectedStages);
      expect(plan.stages[0].portal?.verbatim).toBe(route === "vpd_then_university" ? portal + "/vpd" : portal);
      const application = await ensureApplication(student, actors[1], course.id);
      await setApplicationOfferingSelection(student, actors[1], { id: application.id, selection });
      await materializeCourseTasksForApplication(student, actors[1], application.id);
      const rows = (await listTasks(student, actors[1])).filter(t => t.application_id === application.id);
      expect(rows.filter(t => !t.task_key?.endsWith("fee_confirmation")).map(t => t.due_date)).toEqual(route === "vpd_then_university" ? ["2027-06-01", "2027-08-01"] : ["2027-07-15"]);
      const saved = rows[0];
      const personal = await insertTask(student, { user_id: actors[1], application_id: application.id, title: "Personal manual reminder", task_key: null, due_date: "2027-04-01" });
      expect((await student.from("tasks").update({ title: "Personal pending reminder", has_personal_edits: true, due_date: "2027-03-01" }).eq("id", saved.id)).error).toBeNull();
      await materializeCourseTasksForApplication(student, actors[1], application.id);
      const personalDashboard = await buildDashboardView(student, actors[1]);
      expect([...personalDashboard.buckets.now, ...personalDashboard.buckets.next, ...personalDashboard.buckets.later].find(t => t.id === saved.id)?.dueDate).toBe("2027-03-01");
      expect((await student.from("tasks").update({ title: "Personal completed reminder", done: true, has_personal_edits: true, due_date: "2027-03-01" }).eq("id", saved.id)).error).toBeNull();
      await materializeCourseTasksForApplication(student, actors[1], application.id);
      expect((await listTasks(student, actors[1])).find(t => t.id === saved.id)).toMatchObject({ title: "Personal completed reminder", done: true, due_date: "2027-03-01" });
      const dashboard = await buildDashboardView(student, actors[1]);
      expect(dashboard.doneTasks.some(t => t.id === saved.id)).toBe(true);
      await expect(setApplicationOfferingSelection(student, actors[1], { id: application.id, selection: { ...selection, applicant_context: { applicant_group: "Other applicants", confirmed: true } } })).rejects.toThrow();
      expect((await student.from("applications").update({ offering_applicant_context: { applicant_group: "Other applicants", confirmed: true } }).eq("id", application.id)).error).not.toBeNull();
      expect(resolveOfferingProcess({ ...catalogue, courseId: course.id, selection: { ...selection, offering_id: randomUUID() } }).route).toBe("unresolved");
      // Even an authenticated owner cannot forge immutable reviewed authority.
      expect((await student.from("course_offering_versions").insert({ offering_id: offering.id, version: 99, review_status: "verified", reviewed_by: actors[1], reviewed_at: new Date().toISOString(), facts: catalogue.versions[0].facts as unknown as Json })).error).not.toBeNull();
      const retained = await listTasks(student, actors[1]);
      // A normal protected review that withholds the route supersedes old authority.
      await publishAdminCourseResearch(admin, course.id, [], actors[0], []);
      const current = await getApplicationOfferingCatalogue(student, course.id, offering.id);
      const unavailable = resolveOfferingProcess({ ...current, courseId: course.id, selection });
      expect(unavailable.version?.version).toBe(2); expect(unavailable.route).toBe("unresolved");
      await materializeCourseTasksForApplication(student, actors[1], application.id);
      expect(await listTasks(student, actors[1])).toEqual(retained);
      const updatedDashboard = await buildDashboardView(student, actors[1]);
      expect(updatedDashboard.doneTasks.some(t => t.id === saved.id)).toBe(true);
      expect([...updatedDashboard.buckets.now, ...updatedDashboard.buckets.next, ...updatedDashboard.buckets.later].some(t => t.key?.includes(":process:"))).toBe(false);
      expect([...updatedDashboard.buckets.now, ...updatedDashboard.buckets.next, ...updatedDashboard.buckets.later].find(t => t.id === personal.id)).toMatchObject({ title: "Personal manual reminder", dueDate: "2027-04-01" });
      expect((await student.from("applications").select("status").eq("id", application.id).single()).data?.status).toBe("planning");
    } finally {
      await admin.auth.signOut({ scope: "local" }); await student.auth.signOut({ scope: "local" });
      for (const id of actors) await provisioner.auth.admin.deleteUser(id);
    }
  }, 60_000);
});
