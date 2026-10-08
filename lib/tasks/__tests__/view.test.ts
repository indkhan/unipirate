import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(), listRuleVersions: vi.fn(), listApplicationsWithCourses: vi.fn(), listTasks: vi.fn(), getApplicationOfferingCatalogue:vi.fn(),listCourseSubmissionDefinitionIds:vi.fn(),
}));
vi.mock("@/lib/db/queries", () => mocks);



import { legacyPublishedAps } from "@/lib/engine/__tests__/aps-legacy-published.fixture";
import { version } from "@/lib/rules/__tests__/assessment-fixtures";
import { buildDashboardView } from "../view";

const task = {
  id: "task", task_key: "app:application:course-task:definition", title: "Submit application",
  application_id: "application", course_task_definition_id: "definition", done: false,
  due_date: "2026-10-15", verbatim_due: "15 October 2026", preferred_bucket: null,
  sort_order: 30, source_url: null, description: null, admin_change_state: "current", admin_snapshot: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getProfile.mockResolvedValue(null);
  mocks.listRuleVersions.mockResolvedValue([]);
  mocks.listTasks.mockResolvedValue([task]);
});

describe("application task visibility", () => {
  it("hides obsolete pending APS work without rewriting saved edits or completion", async () => {
    mocks.getProfile.mockResolvedValue({ answers: { targetDegree: "bachelor", certificateCountry: "in", nationality: "in", curriculumType: "national", board: "cbse", schoolGradePercent: 82, jeeAdvanced: false, visaApplicationCountry: "sa", targetField: "cs", intake: null } });
    mocks.listRuleVersions.mockResolvedValue(legacyPublishedAps.map((rule, index) => version(index+1, {rule_id: rule.id, raw_snapshot: rule})));
    mocks.listApplicationsWithCourses.mockResolvedValue([]);
    const pending = { ...task, id: "old", task_key: "rule:f5361a7c-bddf-45fd-9c8d-a23e736f16cc:step:10", course_task_definition_id: null, application_id: null, title: "My certificate reminder", has_personal_edits: true };
    const completed = { ...pending, id: "completed", done: true };
    const manual = { ...pending, id: "manual", task_key: null };
    const course = {...task, id: "course", title: "My APS course reminder", has_personal_edits: true};
    mocks.listApplicationsWithCourses.mockResolvedValue([{id: "application", status: "planning", courses: null}]);
    const rows = [pending, completed, manual, course];
    const snapshot = structuredClone(rows);
    mocks.listTasks.mockResolvedValue(rows);
    const view = await buildDashboardView({ from: vi.fn() }, "student");
    expect([...view.buckets.now, ...view.buckets.next, ...view.buckets.later].map(t => t.id)).toEqual(["manual", "course"]);
    expect(view.doneTasks.map(t => t.id)).toEqual(["completed"]);
    expect(rows[0].title).toBe("My certificate reminder");
    expect(rows).toEqual(snapshot);
    expect(rows[0].done).toBe(false);
  });
  it.each(["applied", "admitted", "rejected"])("hides pending preparation tasks for %s applications", async (status) => {
    mocks.listApplicationsWithCourses.mockResolvedValue([{ id: "application", status, courses: null }]);
    const view = await buildDashboardView({ from: vi.fn() }, "student");
    expect([...view.buckets.now, ...view.buckets.next, ...view.buckets.later]).toEqual([]);
    expect(view.calendarEvents).toEqual([]);
    expect(view.nextDeadline).toBeNull();
  });
  it("preserves completed work and manual reminders on submitted applications", async () => {
    mocks.listApplicationsWithCourses.mockResolvedValue([{ id: "application", status: "applied", courses: null }]);
    mocks.listTasks.mockResolvedValue([
      { ...task, done: true },
      { ...task, id: "manual", task_key: null, course_task_definition_id: null },
    ]);
    const view = await buildDashboardView({ from: vi.fn() }, "student");
    expect(view.doneTasks.map((task) => task.id)).toEqual(["task"]);
    expect(view.buckets.now.map((task) => task.id)).toEqual(["manual"]);
  });
  it("shows preparation tasks again when the application returns to planning", async () => {
    mocks.listApplicationsWithCourses.mockResolvedValue([{ id: "application", status: "planning", courses: null }]);
    const view = await buildDashboardView({ from: vi.fn() }, "student");
    expect(view.buckets.now.map((task) => task.id)).toEqual(["task"]);
    expect(view.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

import {input as offeringInput,uuid,selection,offering,version as offeringVersion,stages} from "./offering-process.fixtures";
import {resolveOfferingProcess,generateOfferingProcessTasks} from "../offering-process";
const offeringApplication=()=>({id:uuid(5),course_id:uuid(2),status:'planning',offering_id:selection.offering_id,offering_applicant_context:selection.applicant_context,courses:{id:uuid(2),name:'Course',university_name:'University',review_status:'approved',source_url:'https://example.invalid/course',deadlines:['Winter deadline 15 July 2000']}});
const offeringRow=()=>{const generated=generateOfferingProcessTasks(uuid(5),'planning',resolveOfferingProcess(offeringInput()));return generated.map((g,i)=>({...task,id:uuid(50+i),task_key:g.key,title:g.title,application_id:uuid(5),course_task_definition_id:null,due_date:g.dueDate,verbatim_due:g.verbatimDue,admin_snapshot:g.adminSnapshot,source_url:g.source?.url,source_verified_at:g.source?.verifiedAt}));};
it('offering rail/calendar share selected stages and hide duplicate legacy submission, preserving manual/requirement/history',async()=>{
 mocks.listApplicationsWithCourses.mockResolvedValue([offeringApplication()]);mocks.getApplicationOfferingCatalogue.mockResolvedValue(offeringInput());mocks.listCourseSubmissionDefinitionIds.mockResolvedValue(['definition']);
 const rows=[...offeringRow(),{...task,id:'legacy',application_id:uuid(5)},{...task,id:'legacy-done',done:true,application_id:uuid(5)},{...task,id:'manual',task_key:null,course_task_definition_id:null,application_id:uuid(5),due_date:null},{...task,id:'requirement',task_key:'app:'+uuid(5)+':course-task:requirement',course_task_definition_id:'requirement',application_id:uuid(5)}];const before=JSON.stringify(rows);mocks.listTasks.mockResolvedValue(rows);
 const v=await buildDashboardView({from:vi.fn()},uuid(7));expect(v.rail[0].nextDeadline).toEqual({iso:'2027-06-01',verbatim:stages[4].verbatim});expect(v.calendarEvents.map(e=>e.key)).not.toContain(task.task_key);expect(v.calendarEvents.map(e=>e.dueDate)).toEqual(expect.arrayContaining(['2027-06-01','2027-08-01']));expect(v.doneTasks.map(t=>t.id)).toContain('legacy-done');expect([...v.buckets.now,...v.buckets.next,...v.buckets.later].map(t=>t.id)).toEqual(expect.arrayContaining(['manual','requirement']));expect(JSON.stringify(rows)).toBe(before);
});
it('VPD done leaves university pending and application planning, rail advances consistently',async()=>{
 const app=offeringApplication();mocks.listApplicationsWithCourses.mockResolvedValue([app]);mocks.getApplicationOfferingCatalogue.mockResolvedValue(offeringInput());mocks.listCourseSubmissionDefinitionIds.mockResolvedValue([]);
 const rows=offeringRow();rows[0].done=true;mocks.listTasks.mockResolvedValue(rows);const v=await buildDashboardView({from:vi.fn()},uuid(7));expect(v.doneTasks.map(t=>t.key)).toContain(rows[0].task_key);expect(v.calendarEvents.map(e=>e.dueDate)).toEqual(['2027-08-01']);expect(v.rail[0].nextDeadline.iso).toBe('2027-08-01');expect(app.status).toBe('planning');expect(rows[1].done).toBe(false);
});
it.each(['applied','admitted','rejected'])('offering pending tasks and calendar are hidden for %s, completed history stays',async status=>{
 mocks.listApplicationsWithCourses.mockResolvedValue([{...offeringApplication(),status}]);mocks.getApplicationOfferingCatalogue.mockResolvedValue(offeringInput());mocks.listCourseSubmissionDefinitionIds.mockResolvedValue([]);const rows=offeringRow();rows[0].done=true;mocks.listTasks.mockResolvedValue(rows);const v=await buildDashboardView({from:vi.fn()},uuid(7));expect([...v.buckets.now,...v.buckets.next,...v.buckets.later]).toEqual([]);expect(v.doneTasks).toHaveLength(1);expect(v.calendarEvents).toEqual([]);expect(v.rail[0].nextDeadline.iso).toBeNull();
});
it('context changes hide stale pending tasks without removing completed edits',async()=>{
 const nextOffering={...offering,id:uuid(33),intake_term:'summer'};mocks.listApplicationsWithCourses.mockResolvedValue([{...offeringApplication(),offering_id:nextOffering.id}]);mocks.getApplicationOfferingCatalogue.mockResolvedValue({...offeringInput(),offerings:[nextOffering],versions:[{...offeringVersion('direct',stages),offering_id:nextOffering.id}]});mocks.listCourseSubmissionDefinitionIds.mockResolvedValue([]);const rows=offeringRow();rows[0].done=true;rows[0].title='Personal completed VPD';mocks.listTasks.mockResolvedValue(rows);const v=await buildDashboardView({from:vi.fn()},uuid(7));expect(v.doneTasks[0].title).toBe('Personal completed VPD');expect(v.calendarEvents).toEqual([]);expect([...v.buckets.now,...v.buckets.next,...v.buckets.later]).toEqual([]);expect(v.rail[0].nextDeadline.iso).toBeNull();
});
it('latest unresolved hides old pending stage and never restores legacy cross-intake deadline',async()=>{
 mocks.listApplicationsWithCourses.mockResolvedValue([offeringApplication()]);mocks.getApplicationOfferingCatalogue.mockResolvedValue({...offeringInput(),versions:[offeringVersion('unresolved')]});mocks.listCourseSubmissionDefinitionIds.mockResolvedValue(['definition']);mocks.listTasks.mockResolvedValue([...offeringRow(),{...task,application_id:uuid(5)}]);const v=await buildDashboardView({from:vi.fn()},uuid(7));expect(v.calendarEvents).toEqual([]);expect(v.rail[0].nextDeadline).toEqual({iso:null,verbatim:null});expect(v.rail[0].offeringProcess?.plan.reason).toContain('unresolved');
});
it('obsolete uni-assist task hides by identity while PROC02/manual/completed history stays',async()=>{
 mocks.listApplicationsWithCourses.mockResolvedValue([]);const legacy={...task,task_key:'rule:uni-assist-vpd-process:step:20',course_task_definition_id:null,application_id:null,title:'Personal edit'};mocks.listTasks.mockResolvedValue([legacy,{...legacy,id:'done',done:true},{...legacy,id:'visa',task_key:'rule:visa-appointment-in:step:44'},{...legacy,id:'manual',task_key:null}]);const v=await buildDashboardView({from:vi.fn()},uuid(7));expect([...v.buckets.now,...v.buckets.next,...v.buckets.later].map(t=>t.id).sort()).toEqual(['manual','visa']);expect(v.doneTasks.map(t=>t.id)).toEqual(['done']);
});
