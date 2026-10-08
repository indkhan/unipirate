import {beforeEach, expect, it, vi} from "vitest";
const mocks = vi.hoisted(() => ({getProfile: vi.fn(), listRuleVersions: vi.fn(), listGeneratedTasksByPrefix: vi.fn(), upsertGeneratedTasks: vi.fn(), listApplicationsWithCourses: vi.fn(), getApplicationOfferingCatalogue:vi.fn(),listActiveCourseTaskDefinitions:vi.fn()}));
vi.mock("@/lib/db/queries", () => mocks);
import {materializeAllTasksForUser} from "../materialize";
import {answers, raw, version, ruleId} from "@/lib/rules/__tests__/assessment-fixtures";
const step = {order: 1, text: " Synthetic current step "};
const v1 = version(1, {raw_snapshot: {...raw, outcomes: {path: "direct", steps: [step]}}});
beforeEach(() => {vi.resetAllMocks(); mocks.getProfile.mockResolvedValue({answers}); mocks.listRuleVersions.mockResolvedValue([v1]); mocks.listGeneratedTasksByPrefix.mockResolvedValue([]); mocks.listApplicationsWithCourses.mockResolvedValue([]);});
it("current task generation excludes future versions and uses stable logical keys/exact sources", async () => {
 mocks.listRuleVersions.mockResolvedValue([v1, version(2, {published_at: "2099-01-01T00:00:00Z", raw_snapshot: {...raw, outcomes: {steps: [{...step, text: "FUTURE"}]}}})]);
 await materializeAllTasksForUser({from: vi.fn()}, "student");
 expect(mocks.upsertGeneratedTasks).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({task_key: 'rule:'+ruleId+':step:1', title: step.text, source_url: raw.source_url, source_verified_at: raw.last_verified_at})]);
});
it.each([false, true])("existing personal/completed/inactive task remains byte-equivalent, done=%s", async done => {
 const task = {task_key: 'rule:'+ruleId+':step:1', title: "My reminder", due_date: "2027-01-15", done, preferred_bucket: "later", generated_active: false, has_personal_edits: true};
 const rows = [task]; const snapshot = JSON.stringify(rows); mocks.listGeneratedTasksByPrefix.mockResolvedValue(rows);
 await materializeAllTasksForUser({from: vi.fn()}, "student"); expect(mocks.upsertGeneratedTasks).toHaveBeenCalledWith(expect.anything(), []); expect(JSON.stringify(rows)).toBe(snapshot);
});
it("new nonmatching replacement cannot revive predecessor work", async () => {
 mocks.listRuleVersions.mockResolvedValue([v1, version(2, {raw_snapshot: {...raw, conditions: {target_degree: "master"}, outcomes: {steps: [step]}}})]);
 await materializeAllTasksForUser({from: vi.fn()}, "student"); expect(mocks.upsertGeneratedTasks).toHaveBeenCalledWith(expect.anything(), []);
});
it("missing intake does not generate scoped replacement or predecessor work", async () => {
 mocks.getProfile.mockResolvedValue({answers: {...answers, intake: null}}); mocks.listRuleVersions.mockResolvedValue([v1, version(2, {intake_from: 4053, raw_snapshot: {...raw, outcomes: {steps: [step]}}})]);
 await materializeAllTasksForUser({from: vi.fn()}, "student"); expect(mocks.upsertGeneratedTasks).toHaveBeenCalledWith(expect.anything(), []);
});

import {input as offeringInput,uuid,selection} from "./offering-process.fixtures";
it('offering materialization uses explicit application selection, suppresses generic submission and preserves requirements',async()=>{
 const course={id:uuid(2),name:'Course',university_name:'University',source_url:'https://example.invalid/course',created_at:'2000-01-01T00:00:00Z',review_status:'approved'};
 const application={id:uuid(5),course_id:course.id,status:'planning',offering_id:selection.offering_id,offering_applicant_context:selection.applicant_context,courses:course};
 mocks.listApplicationsWithCourses.mockResolvedValue([application]);mocks.getApplicationOfferingCatalogue.mockResolvedValue(offeringInput());
 mocks.listActiveCourseTaskDefinitions.mockResolvedValue([{id:uuid(10),kind:'submission',dueMode:'none',retiredAt:null,titleTemplate:'Legacy submit',sortOrder:30},{id:uuid(11),kind:'requirement',dueMode:'none',retiredAt:null,titleTemplate:'Prepare transcript',sortOrder:28}]);
 await materializeAllTasksForUser({from:vi.fn()},uuid(7));const rows=mocks.upsertGeneratedTasks.mock.calls.at(-1)![1];
 expect(rows.map((r:{task_key:string})=>r.task_key)).toEqual(expect.arrayContaining(['app:'+uuid(5)+':offering:'+uuid(3)+':process:vpd_request','app:'+uuid(5)+':offering:'+uuid(3)+':process:university_submission','app:'+uuid(5)+':course-task:'+uuid(11)]));
 expect(rows.some((r:{title:string})=>r.title==='Legacy submit')).toBe(false);expect(application.status).toBe('planning');
});
